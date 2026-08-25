// GT Dining is served through Nutrislice at techdining.nutrislice.com, but the
// JSON API actually lives on a separate host discovered by probing the live
// site's network calls (not documented anywhere): techdining.api.nutrislice.com
//
// Verified 2026-08-24 against https://techdining.api.nutrislice.com/menu/api/schools/
const NUTRISLICE_API_BASE = 'https://techdining.api.nutrislice.com';

// Slugs confirmed against the live /menu/api/schools/ endpoint. Do not guess new
// ones without re-checking that endpoint — Nutrislice slugs are not predictable
// from display names (e.g. "West Village" -> "west-village", but
// "North Ave Dining Hall" -> "north-ave-dining-hall", not "north-avenue-...").
export const DINING_HALLS = {
  brittain: { slug: 'brittain', name: 'Brittain Dining Hall' },
  'north-ave-dining-hall': {
    slug: 'north-ave-dining-hall',
    name: 'North Ave Dining Hall',
  },
  'west-village': { slug: 'west-village', name: 'West Village' },
} as const;

export type DiningHallId = keyof typeof DINING_HALLS;

export const MEAL_PERIODS = ['breakfast', 'lunch', 'dinner'] as const;
export type MealPeriod = (typeof MEAL_PERIODS)[number];

export function isDiningHallId(value: string): value is DiningHallId {
  return value in DINING_HALLS;
}

export function isMealPeriod(value: string): value is MealPeriod {
  return (MEAL_PERIODS as readonly string[]).includes(value);
}

// Icon slugs Nutrislice attaches to food items. Split into dietary claims
// (positive attributes a diet can require) and allergens/composition markers
// (things a diet can exclude). Verified against real West Village items on
// 2026-08-24 — see icon slugs like "vegan", "gluten-friendly", "pork", "milk".
const DIETARY_TAG_ICON_SLUGS = new Set([
  'vegan',
  'vegetarian',
  'gluten-friendly',
  'halal',
  'kosher',
]);

const ALLERGEN_ICON_SLUGS = new Set([
  'milk',
  'egg',
  'wheat',
  'containing-gluten',
  'soy',
  'fish',
  'sesame',
  'pork',
  'beef',
  'coconut',
  'poultry',
]);

export interface NormalizedMenuItem {
  id: string;
  name: string;
  station: string;
  diningHall: DiningHallId;
  mealPeriod: MealPeriod;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  allergens: string[];
  dietaryTags: string[];
  nutritionEstimated: boolean;
  /** What "1 serving" means per Nutrislice, e.g. "1 breast", "1 cup" — null when unspecified. */
  servingSizeLabel: string | null;
}

interface NutrisliceFoodIcon {
  slug: string;
}

interface NutrisliceFood {
  id: number;
  name: string;
  has_nutrition_info?: boolean;
  rounded_nutrition_info?: {
    calories?: number | null;
    g_protein?: number | null;
    g_carbs?: number | null;
    g_fat?: number | null;
    g_fiber?: number | null;
    mg_sodium?: number | null;
  };
  icons?: { food_icons?: NutrisliceFoodIcon[] };
  serving_size_info?: {
    serving_size_amount?: string | number | null;
    serving_size_unit?: string | null;
  } | null;
}

interface NutrisliceMenuItem {
  id: number;
  is_station_header?: boolean;
  text?: string;
  food?: NutrisliceFood | null;
}

interface NutrisliceDay {
  date: string;
  menu_items: NutrisliceMenuItem[];
}

interface NutrisliceWeekResponse {
  days: NutrisliceDay[];
}

export class MenuFetchError extends Error {}

function servingSizeLabel(food: NutrisliceFood): string | null {
  const amount = food.serving_size_info?.serving_size_amount;
  const unit = food.serving_size_info?.serving_size_unit;
  if (!amount && !unit) return null;
  return [amount, unit].filter(Boolean).join(' ').trim() || null;
}

/** Fetches one week of menu data and extracts the items for `isoDate`, normalized to our shape. */
export async function fetchAndNormalizeMenu(
  diningHall: DiningHallId,
  mealPeriod: MealPeriod,
  isoDate: string,
): Promise<NormalizedMenuItem[]> {
  const [year, month, dayOfMonth] = isoDate.split('-');
  const slug = DINING_HALLS[diningHall].slug;
  const url = `${NUTRISLICE_API_BASE}/menu/api/weeks/school/${slug}/menu-type/${mealPeriod}/${year}/${month}/${dayOfMonth}/`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BuzzPlate/1.0)' },
  });

  if (!res.ok) {
    throw new MenuFetchError(
      `Nutrislice returned ${res.status} for ${diningHall}/${mealPeriod}/${isoDate}`,
    );
  }

  const data: NutrisliceWeekResponse = await res.json();
  const day = data.days?.find((d) => d.date === isoDate);
  if (!day) return [];

  const items: NormalizedMenuItem[] = [];
  let currentStation = 'Other';

  for (const entry of day.menu_items) {
    if (entry.is_station_header) {
      currentStation = entry.text?.trim() || 'Other';
      continue;
    }
    if (!entry.food) continue;

    const food = entry.food;
    const nutrition = food.rounded_nutrition_info;
    const hasNutrition = Boolean(food.has_nutrition_info && nutrition);

    const iconSlugs = (food.icons?.food_icons ?? []).map((i) => i.slug);
    const dietaryTags = iconSlugs.filter((s) => DIETARY_TAG_ICON_SLUGS.has(s));
    const allergens = iconSlugs.filter((s) => ALLERGEN_ICON_SLUGS.has(s));

    items.push({
      id: `${diningHall}:${mealPeriod}:${isoDate}:${food.id}:${entry.id}`,
      name: food.name,
      station: currentStation,
      diningHall,
      mealPeriod,
      calories: hasNutrition ? nutrition!.calories ?? null : null,
      proteinG: hasNutrition ? nutrition!.g_protein ?? null : null,
      carbsG: hasNutrition ? nutrition!.g_carbs ?? null : null,
      fatG: hasNutrition ? nutrition!.g_fat ?? null : null,
      fiberG: hasNutrition ? nutrition!.g_fiber ?? null : null,
      sodiumMg: hasNutrition ? nutrition!.mg_sodium ?? null : null,
      allergens,
      dietaryTags,
      nutritionEstimated: !hasNutrition,
      servingSizeLabel: servingSizeLabel(food),
    });
  }

  return items;
}
