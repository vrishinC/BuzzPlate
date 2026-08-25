-- BuzzPlate initial schema

create extension if not exists "pgcrypto";

-- ============================================================
-- profiles
-- ============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  daily_calories int not null,
  daily_protein_g int not null,
  daily_carbs_g int,
  daily_fat_g int,
  dietary_tags text[] not null default '{}',
  meal_split jsonb not null default '{"breakfast":0.25,"lunch":0.35,"dinner":0.3,"snack":0.10}',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "own profile" on profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- menu_cache
-- ============================================================
create table menu_cache (
  id uuid primary key default gen_random_uuid(),
  dining_hall text not null,
  meal_period text not null,
  menu_date date not null,
  items_json jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (dining_hall, meal_period, menu_date)
);

alter table menu_cache enable row level security;

create policy "read menu cache" on menu_cache
  for select
  using (auth.role() = 'authenticated');

-- No insert/update/delete policy: writes only via service-role key in Edge Functions.

-- ============================================================
-- log_entries
-- ============================================================
create table log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  meal_period text not null,
  source text not null check (source in ('gt_menu', 'photo_gt_match', 'photo_outside')),
  dish_name text not null,
  calories int not null,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  photo_storage_path text,
  gt_menu_item_ref jsonb,
  created_at timestamptz not null default now()
);

alter table log_entries enable row level security;

create policy "own log entries" on log_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index log_entries_user_date_idx on log_entries (user_id, log_date);

-- ============================================================
-- storage: food-photos bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('food-photos', 'food-photos', false)
on conflict (id) do nothing;

create policy "own food photos" on storage.objects
  for all
  using (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'food-photos' and (storage.foldername(name))[1] = auth.uid()::text);
