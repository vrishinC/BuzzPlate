# BuzzPlate

GT Dining nutrition tracker. React/Vite frontend + Supabase (Postgres/RLS,
Auth, Storage, Edge Functions) backend. Two logging paths — on-campus GT menu
picks and photo logging via Gemini — write to one shared `log_entries` table.

## Layout

- `frontend/` — React + TS + Tailwind app
- `supabase/migrations/` — schema + RLS
- `supabase/functions/get-menu/` — GT Dining menu fetch/normalize/cache
- `supabase/functions/analyze-food-photo/` — Gemini photo analysis + GT-item fuzzy match
- `supabase/tests/database/rls.test.sql` — pgTAP RLS tests

## Prerequisites

- Node 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (works via `npx supabase`)
- Docker Desktop — required for `supabase start` (local Postgres) and
  `supabase test db`. **Not available in the environment this was built in**,
  so the migrations, Edge Functions, and pgTAP tests are written correctly
  against verified schemas/APIs but have not been run against a live local
  stack. Run `supabase start` once Docker is available and smoke-test before
  relying on this in production.
- A Gemini API key ([Google AI Studio](https://aistudio.google.com/apikey))

## Setup

```bash
# 1. Local Supabase stack (applies supabase/migrations automatically)
npx supabase start

# 2. Edge Function secrets (never put these in the frontend)
cp supabase/functions/.env.example supabase/functions/.env
# fill in GEMINI_API_KEY in supabase/functions/.env
npx supabase functions serve --env-file supabase/functions/.env

# 3. Frontend
cd frontend
cp .env.example .env
# fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from `npx supabase status`
npm install
npm run dev
```

Deploying to a hosted Supabase project instead of local:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase functions deploy get-menu
npx supabase functions deploy analyze-food-photo
npx supabase secrets set GEMINI_API_KEY=... GEMINI_MODEL=gemini-2.0-flash
```

## Tests

```bash
# Suggestion algorithm, dietary filtering, budget math (frontend)
cd frontend && npm test

# Gemini JSON parsing/validation, fuzzy matching (Edge Functions, needs Deno)
deno test --allow-env supabase/functions/_shared/

# RLS policies (needs Docker / supabase start)
npx supabase test db
```

## GT Dining data source (verified 2026-08-24)

Nutrislice serves GT Dining's *pages* at `techdining.nutrislice.com`, but the
JSON API lives on a separate host discovered by probing the live site:
`https://techdining.api.nutrislice.com`. Confirmed real dining-hall slugs (via
`/menu/api/schools/`): `brittain`, `north-ave-dining-hall`, `west-village`.
Menu-type slugs are `breakfast` / `lunch` / `dinner` for all three, used on
weekends too (no separate brunch endpoint — hours just differ, and the schools
endpoint carries per-day hours if you need to refine "currently open" beyond
the simple time-of-day heuristic in `frontend/src/lib/mealTiming.ts`). Full
endpoint: `/menu/api/weeks/school/{slug}/menu-type/{meal}/{yyyy}/{mm}/{dd}/`.
Some items (e.g. build-your-own grill items) carry no real nutrition data —
these come back with `nutritionEstimated: true` and are shown but excluded
from suggestion scoring and "Log" actions that need real macros.
