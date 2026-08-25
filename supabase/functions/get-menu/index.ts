// get-menu: returns the normalized menu for a dining hall + meal period + date.
// Serves from menu_cache when fresh (<= 45 min old), otherwise fetches from
// Nutrislice, normalizes, upserts the cache, and returns.
//
// Request body: { diningHall: string, mealPeriod: string, date?: string (YYYY-MM-DD) }
import {
  DiningHallId,
  MealPeriod,
  MenuFetchError,
  fetchAndNormalizeMenu,
  isDiningHallId,
  isMealPeriod,
} from '../_shared/nutrislice.ts';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const CACHE_FRESH_MS = 45 * 60 * 1000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let body: { diningHall?: string; mealPeriod?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { diningHall, mealPeriod, date } = body;

  if (!diningHall || !isDiningHallId(diningHall)) {
    return jsonResponse(
      { error: `Invalid or missing diningHall: ${diningHall}` },
      400,
    );
  }
  if (!mealPeriod || !isMealPeriod(mealPeriod)) {
    return jsonResponse(
      { error: `Invalid or missing mealPeriod: ${mealPeriod}` },
      400,
    );
  }
  const menuDate = date ?? todayIso();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(menuDate)) {
    return jsonResponse({ error: `Invalid date: ${menuDate}` }, 400);
  }

  const supabase = getSupabaseAdmin();

  const { data: cached, error: cacheReadError } = await supabase
    .from('menu_cache')
    .select('items_json, fetched_at')
    .eq('dining_hall', diningHall)
    .eq('meal_period', mealPeriod)
    .eq('menu_date', menuDate)
    .maybeSingle();

  if (cacheReadError) {
    console.error('menu_cache read error', cacheReadError);
  }

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age <= CACHE_FRESH_MS) {
      return jsonResponse({
        diningHall,
        mealPeriod,
        date: menuDate,
        items: cached.items_json,
        source: 'cache',
      });
    }
  }

  try {
    const items = await fetchAndNormalizeMenu(
      diningHall as DiningHallId,
      mealPeriod as MealPeriod,
      menuDate,
    );

    const { error: upsertError } = await supabase.from('menu_cache').upsert(
      {
        dining_hall: diningHall,
        meal_period: mealPeriod,
        menu_date: menuDate,
        items_json: items,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'dining_hall,meal_period,menu_date' },
    );
    if (upsertError) {
      console.error('menu_cache upsert error', upsertError);
    }

    return jsonResponse({
      diningHall,
      mealPeriod,
      date: menuDate,
      items,
      source: 'live',
    });
  } catch (err) {
    console.error('menu fetch failed', err);

    // Fail gracefully: serve stale cache if we have it, otherwise an
    // explicit "menu unavailable" state rather than a 500.
    if (cached) {
      return jsonResponse({
        diningHall,
        mealPeriod,
        date: menuDate,
        items: cached.items_json,
        source: 'stale-cache',
        warning: 'Live menu fetch failed; showing last known menu.',
      });
    }

    return jsonResponse({
      diningHall,
      mealPeriod,
      date: menuDate,
      items: [],
      source: 'unavailable',
      warning:
        err instanceof MenuFetchError
          ? err.message
          : 'Menu is temporarily unavailable.',
    });
  }
});
