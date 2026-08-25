import type { LogEntry, Macros, MealPeriod, MealSplit, Profile } from './types';

function sumLoggedMacros(entries: LogEntry[]): Macros {
  return entries.reduce<Macros>(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + Number(e.protein_g ?? 0),
      carbsG: acc.carbsG + Number(e.carbs_g ?? 0),
      fatG: acc.fatG + Number(e.fat_g ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

function mealSplitShare(mealSplit: MealSplit, mealPeriod: MealPeriod): number {
  return mealSplit[mealPeriod] ?? 0;
}

/** Full-day macro targets derived from the profile's daily goals. */
export function dailyTargets(profile: Profile): Macros {
  return {
    calories: profile.daily_calories,
    proteinG: profile.daily_protein_g,
    carbsG: profile.daily_carbs_g ?? 0,
    fatG: profile.daily_fat_g ?? 0,
  };
}

/**
 * Remaining budget for the given meal period: that meal's share of the daily
 * target, minus everything logged so far today (across all meals). This lets
 * an early over/under at breakfast roll forward into lunch's suggestions
 * instead of suggesting the same fixed slice every meal.
 */
export function remainingBudgetForMeal(
  profile: Profile,
  mealPeriod: MealPeriod,
  todaysEntries: LogEntry[],
): Macros {
  const share = mealSplitShare(profile.meal_split, mealPeriod);
  const target = dailyTargets(profile);
  const logged = sumLoggedMacros(todaysEntries);

  return {
    calories: target.calories * share - logged.calories,
    proteinG: target.proteinG * share - logged.proteinG,
    carbsG: target.carbsG * share - logged.carbsG,
    fatG: target.fatG * share - logged.fatG,
  };
}

export function remainingDailyBudget(
  profile: Profile,
  todaysEntries: LogEntry[],
): Macros {
  const target = dailyTargets(profile);
  const logged = sumLoggedMacros(todaysEntries);
  return {
    calories: target.calories - logged.calories,
    proteinG: target.proteinG - logged.proteinG,
    carbsG: target.carbsG - logged.carbsG,
    fatG: target.fatG - logged.fatG,
  };
}

export { sumLoggedMacros };
