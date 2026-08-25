import type { Macros, MenuItem } from './types';

export interface ScoredCombo {
  items: MenuItem[];
  totals: Macros;
  score: number;
}

/** Items with usable macros for scoring — excludes anything Nutrislice has no real numbers for. */
function scorable(items: MenuItem[]): MenuItem[] {
  return items.filter(
    (i) => !i.nutritionEstimated && i.calories !== null && i.calories > 0,
  );
}

function macrosOf(item: MenuItem): Macros {
  return {
    calories: item.calories ?? 0,
    proteinG: item.proteinG ?? 0,
    carbsG: item.carbsG ?? 0,
    fatG: item.fatG ?? 0,
  };
}

function sumMacros(items: MenuItem[]): Macros {
  return items.reduce<Macros>(
    (acc, item) => {
      const m = macrosOf(item);
      return {
        calories: acc.calories + m.calories,
        proteinG: acc.proteinG + m.proteinG,
        carbsG: acc.carbsG + m.carbsG,
        fatG: acc.fatG + m.fatG,
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function proteinPerCalorie(item: MenuItem): number {
  const cal = item.calories ?? 0;
  if (cal <= 0) return 0;
  return (item.proteinG ?? 0) / cal;
}

/**
 * Protein is treated as the tight constraint when hitting the remaining
 * protein target would require an unusually protein-dense combo (more than
 * ~1g protein per 12.5 kcal, i.e. >32% of calories from protein — well above
 * a typical ~15-20% baseline). Below that, calorie fit drives the score.
 */
function isProteinTight(remaining: Macros): boolean {
  if (remaining.calories <= 0) return remaining.proteinG > 0;
  return remaining.proteinG / remaining.calories > 0.08;
}

function uniqueStationRatio(items: MenuItem[]): number {
  const stations = new Set(items.map((i) => i.station));
  return stations.size / items.length;
}

function clip01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function fitScore(target: number, actual: number): number {
  if (target <= 0) return actual <= 0 ? 1 : 0;
  return clip01(1 - Math.abs(target - actual) / target);
}

function scoreCombo(items: MenuItem[], remaining: Macros): number {
  const totals = sumMacros(items);
  const calorieFit = fitScore(remaining.calories, totals.calories);
  const proteinFit = fitScore(Math.max(remaining.proteinG, 0), totals.proteinG);
  const stationDiversity = uniqueStationRatio(items);
  const avgProteinDensity =
    items.reduce((sum, i) => sum + proteinPerCalorie(i), 0) / items.length;

  if (isProteinTight(remaining)) {
    return (
      0.45 * proteinFit +
      0.25 * calorieFit +
      0.15 * stationDiversity +
      0.15 * clip01(avgProteinDensity * 10)
    );
  }
  return 0.55 * calorieFit + 0.25 * proteinFit + 0.2 * stationDiversity;
}

function* combinations<T>(pool: T[], size: number): Generator<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = 0; i <= pool.length - size; i++) {
    for (const rest of combinations(pool.slice(i + 1), size - 1)) {
      yield [pool[i], ...rest];
    }
  }
}

/** How many items two combos share, used to keep alternates from being near-duplicates. */
function overlapCount(a: MenuItem[], b: MenuItem[]): number {
  const ids = new Set(a.map((i) => i.id));
  return b.filter((i) => ids.has(i.id)).length;
}

export interface SuggestionOptions {
  /** How many top-ranked candidate items to draw combos from. Keeps combinatorics bounded. */
  candidatePoolSize?: number;
  /** Max fraction over the calorie budget a combo may land at (0.1 = 10%). */
  calorieOverageTolerance?: number;
  /** How many alternative combos to return. */
  maxResults?: number;
}

/**
 * Ranks small combos (2-3 items) of menu items against the remaining macro
 * budget for a meal. Deterministic and debuggable by design: no model call,
 * every combo's score is a transparent function of calorie fit, protein fit,
 * and station diversity, with protein weighted more heavily when the
 * remaining budget is protein-tight.
 */
export function suggestMealCombos(
  menuItems: MenuItem[],
  remaining: Macros,
  options: SuggestionOptions = {},
): ScoredCombo[] {
  const {
    candidatePoolSize = 10,
    calorieOverageTolerance = 0.1,
    maxResults = 3,
  } = options;

  const candidates = scorable(menuItems);
  if (candidates.length === 0) return [];

  const calorieCeiling =
    remaining.calories > 0
      ? remaining.calories * (1 + calorieOverageTolerance)
      : Infinity;

  const proteinTight = isProteinTight(remaining);
  const pool = [...candidates]
    .sort((a, b) => {
      if (proteinTight) return proteinPerCalorie(b) - proteinPerCalorie(a);
      // Otherwise rank by closeness to a single-item slice of the calorie budget.
      const targetSlice = remaining.calories > 0 ? remaining.calories / 2 : 0;
      return (
        Math.abs((a.calories ?? 0) - targetSlice) -
        Math.abs((b.calories ?? 0) - targetSlice)
      );
    })
    .slice(0, candidatePoolSize);

  const evaluated: ScoredCombo[] = [];
  for (const size of [2, 3]) {
    if (pool.length < size) continue;
    for (const combo of combinations(pool, size)) {
      const totals = sumMacros(combo);
      if (totals.calories > calorieCeiling) continue;
      evaluated.push({ items: combo, totals, score: scoreCombo(combo, remaining) });
    }
  }

  evaluated.sort((a, b) => b.score - a.score);

  const results: ScoredCombo[] = [];
  for (const combo of evaluated) {
    if (results.length >= maxResults) break;
    const tooSimilar = results.some(
      (chosen) => overlapCount(chosen.items, combo.items) >= Math.min(chosen.items.length, combo.items.length),
    );
    if (tooSimilar) continue;
    results.push(combo);
  }

  return results;
}
