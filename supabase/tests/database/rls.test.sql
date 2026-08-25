-- RLS integration tests, run via: supabase test db
-- Requires the pgTAP extension (bundled with the Supabase local stack) and
-- Docker (`supabase start`) — see supabase/config.toml [db.seed] / [test].
--
-- Pattern: fake a Postgres session for a given auth.users row by setting the
-- same GUCs PostgREST sets before running a query, then assert what RLS lets
-- through. See https://supabase.com/docs/guides/database/extensions/pgtap.

begin;
select plan(14);

create extension if not exists pgtap with schema extensions;
create schema if not exists tests;

-- ---------------------------------------------------------------
-- Fixtures: two auth users, each with a profile.
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@gatech.edu'),
  ('22222222-2222-2222-2222-222222222222', 'bob@gatech.edu');

insert into public.profiles (id, email, daily_calories, daily_protein_g)
values
  ('11111111-1111-1111-1111-111111111111', 'alice@gatech.edu', 2000, 150),
  ('22222222-2222-2222-2222-222222222222', 'bob@gatech.edu', 2200, 160);

insert into public.log_entries (id, user_id, meal_period, source, dish_name, calories)
values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'lunch', 'gt_menu', 'Alice Lunch', 500),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'lunch', 'gt_menu', 'Bob Lunch', 600);

insert into public.menu_cache (dining_hall, meal_period, menu_date, items_json)
values ('west-village', 'lunch', current_date, '[]'::jsonb);

-- Helper: simulate PostgREST's session for a given user.
create or replace function tests.authenticate_as(p_user_id uuid) returns void as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('role', 'authenticated', true);
end;
$$ language plpgsql;

create or replace function tests.authenticate_as_anon() returns void as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  perform set_config('role', 'anon', true);
end;
$$ language plpgsql;

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
select tests.authenticate_as('11111111-1111-1111-1111-111111111111');

select is(
  (select count(*) from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'alice can select her own profile'
);

select is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'alice cannot select bob''s profile'
);

update public.profiles set daily_calories = 2100 where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select daily_calories from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  2100,
  'alice can update her own profile'
);

update public.profiles set daily_calories = 9999 where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*) from public.profiles where id = '22222222-2222-2222-2222-222222222222' and daily_calories = 9999),
  0::bigint,
  'alice cannot update bob''s profile (RLS silently filters the row)'
);

-- ---------------------------------------------------------------
-- log_entries
-- ---------------------------------------------------------------
select is(
  (select count(*) from public.log_entries where user_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'alice can select her own log entries'
);

select is(
  (select count(*) from public.log_entries where user_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'alice cannot select bob''s log entries'
);

select lives_ok(
  $$ insert into public.log_entries (user_id, meal_period, source, dish_name, calories)
     values ('11111111-1111-1111-1111-111111111111', 'dinner', 'gt_menu', 'Alice Dinner', 400) $$,
  'alice can insert a log entry for herself'
);

select throws_ok(
  $$ insert into public.log_entries (user_id, meal_period, source, dish_name, calories)
     values ('22222222-2222-2222-2222-222222222222', 'dinner', 'gt_menu', 'Fake Bob Entry', 400) $$,
  '42501',
  null,
  'alice cannot insert a log entry for bob'
);

delete from public.log_entries where id = '44444444-4444-4444-4444-444444444444';
select is(
  (select count(*) from public.log_entries where id = '44444444-4444-4444-4444-444444444444'),
  1::bigint,
  'delete of bob''s entry by alice affects zero rows (still exists)'
);

-- ---------------------------------------------------------------
-- menu_cache: readable by any authenticated user, not writable by users
-- ---------------------------------------------------------------
select is(
  (select count(*) from public.menu_cache),
  1::bigint,
  'authenticated users can read menu_cache'
);

select throws_ok(
  $$ insert into public.menu_cache (dining_hall, meal_period, menu_date, items_json)
     values ('brittain', 'breakfast', current_date, '[]'::jsonb) $$,
  '42501',
  null,
  'authenticated users cannot write menu_cache (service-role only)'
);

-- ---------------------------------------------------------------
-- anon role
-- ---------------------------------------------------------------
select tests.authenticate_as_anon();

select is(
  (select count(*) from public.profiles),
  0::bigint,
  'anon cannot read any profiles'
);

select is(
  (select count(*) from public.log_entries),
  0::bigint,
  'anon cannot read any log entries'
);

select is(
  (select count(*) from public.menu_cache),
  0::bigint,
  'anon cannot read menu_cache (requires authenticated role)'
);

select * from finish();
rollback;
