import { describe, expect, it } from 'vitest';
import { remainingBudgetForMeal, remainingDailyBudget } from './budget';
import type { LogEntry, Profile } from './types';

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    email: 'a@gatech.edu',
    daily_calories: 2000,
    daily_protein_g: 150,
    daily_carbs_g: 200,
    daily_fat_g: 60,
    dietary_tags: [],
    meal_split: { breakfast: 0.25, lunch: 0.35, dinner: 0.3, snack: 0.1 },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'e1',
    user_id: 'u1',
    log_date: '2026-08-24',
    meal_period: 'breakfast',
    source: 'gt_menu',
    dish_name: 'Eggs',
    calories: 300,
    protein_g: 20,
    carbs_g: 20,
    fat_g: 10,
    photo_storage_path: null,
    gt_menu_item_ref: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('remainingBudgetForMeal', () => {
  it('gives the full meal-split share when nothing has been logged today', () => {
    const profile = makeProfile();
    const result = remainingBudgetForMeal(profile, 'lunch', []);
    expect(result.calories).toBeCloseTo(2000 * 0.35);
    expect(result.proteinG).toBeCloseTo(150 * 0.35);
  });

  it('subtracts everything logged today, not just that meal period', () => {
    const profile = makeProfile();
    const entries = [makeEntry({ meal_period: 'breakfast', calories: 400, protein_g: 30 })];
    const result = remainingBudgetForMeal(profile, 'lunch', entries);
    expect(result.calories).toBeCloseTo(2000 * 0.35 - 400);
    expect(result.proteinG).toBeCloseTo(150 * 0.35 - 30);
  });

  it('can go negative when a meal has been overeaten', () => {
    const profile = makeProfile();
    const entries = [makeEntry({ calories: 3000, protein_g: 300 })];
    const result = remainingBudgetForMeal(profile, 'breakfast', entries);
    expect(result.calories).toBeLessThan(0);
  });
});

describe('remainingDailyBudget', () => {
  it('subtracts all logged macros from the full daily target', () => {
    const profile = makeProfile();
    const entries = [
      makeEntry({ calories: 400, protein_g: 30, carbs_g: 40, fat_g: 15 }),
      makeEntry({ calories: 600, protein_g: 40, carbs_g: 50, fat_g: 20, meal_period: 'lunch' }),
    ];
    const result = remainingDailyBudget(profile, entries);
    expect(result.calories).toBe(2000 - 1000);
    expect(result.proteinG).toBe(150 - 70);
    expect(result.carbsG).toBe(200 - 90);
    expect(result.fatG).toBe(60 - 35);
  });
});
