import type { MealPeriod } from './types';

/** Rough GT Dining meal windows, used only to pick a sensible default meal period. */
export function currentMealPeriod(now: Date = new Date()): Exclude<MealPeriod, 'snack'> {
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < 10.5) return 'breakfast';
  if (hour < 15) return 'lunch';
  return 'dinner';
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
