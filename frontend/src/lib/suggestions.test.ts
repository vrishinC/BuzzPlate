import { describe, expect, it } from 'vitest';
import { suggestMealCombos } from './suggestions';
import type { MenuItem } from './types';

function item(overrides: Partial<MenuItem> & { id: string; name: string }): MenuItem {
  return {
    station: 'Grill Station',
    diningHall: 'west-village',
    mealPeriod: 'lunch',
    calories: 300,
    proteinG: 15,
    carbsG: 20,
    fatG: 10,
    fiberG: 2,
    sodiumMg: 400,
    allergens: [],
    dietaryTags: [],
    nutritionEstimated: false,
    servingSizeLabel: null,
    ...overrides,
  };
}

describe('suggestMealCombos', () => {
  it('never returns a combo more than 10% over the calorie budget', () => {
    const items: MenuItem[] = [
      item({ id: '1', name: 'Chicken Breast', calories: 250, proteinG: 40 }),
      item({ id: '2', name: 'Rice', calories: 300, proteinG: 5, station: 'Deli Bar' }),
      item({ id: '3', name: 'Burger', calories: 700, proteinG: 25, station: 'Grill Station' }),
      item({ id: '4', name: 'Fries', calories: 500, proteinG: 4, station: 'Grill Station' }),
    ];
    const remaining = { calories: 600, proteinG: 30, carbsG: 60, fatG: 20 };

    const results = suggestMealCombos(items, remaining);

    for (const combo of results) {
      expect(combo.totals.calories).toBeLessThanOrEqual(600 * 1.1);
    }
  });

  it('excludes items with no reliable nutrition data from combos', () => {
    const items: MenuItem[] = [
      item({ id: '1', name: 'Chicken Breast', calories: 250, proteinG: 40 }),
      item({
        id: '2',
        name: 'Mystery Grill Item',
        calories: 1,
        proteinG: 0,
        nutritionEstimated: true,
        station: 'Grill Station',
      }),
      item({ id: '3', name: 'Rice', calories: 300, proteinG: 5, station: 'Deli Bar' }),
    ];
    const remaining = { calories: 600, proteinG: 30, carbsG: 60, fatG: 20 };

    const results = suggestMealCombos(items, remaining);

    for (const combo of results) {
      expect(combo.items.some((i) => i.id === '2')).toBe(false);
    }
  });

  it('favors protein-dense items when protein is the tight constraint', () => {
    const items: MenuItem[] = [
      item({ id: 'lean', name: 'Grilled Chicken', calories: 200, proteinG: 40, station: 'Grill Station' }),
      item({ id: 'carby', name: 'Pasta', calories: 400, proteinG: 8, station: 'Pasta' }),
      item({ id: 'fatty', name: 'Fries', calories: 400, proteinG: 4, station: 'Grill Station' }),
      item({ id: 'lean2', name: 'Turkey Breast', calories: 220, proteinG: 35, station: 'Deli Bar' }),
    ];
    // Large protein ask relative to calories -> protein-tight per the >0.08 g/kcal heuristic.
    const remaining = { calories: 500, proteinG: 60, carbsG: 20, fatG: 10 };

    const results = suggestMealCombos(items, remaining);

    expect(results.length).toBeGreaterThan(0);
    const topComboIds = results[0].items.map((i) => i.id);
    expect(topComboIds).toEqual(expect.arrayContaining(['lean']));
    expect(topComboIds).not.toContain('carby');
  });

  it('prefers combos that span multiple stations over single-station combos with similar fit', () => {
    const items: MenuItem[] = [
      item({ id: 'a1', name: 'Grill Item A', calories: 300, proteinG: 20, station: 'Grill Station' }),
      item({ id: 'a2', name: 'Grill Item B', calories: 300, proteinG: 20, station: 'Grill Station' }),
      item({ id: 'b1', name: 'Salad Item A', calories: 300, proteinG: 20, station: 'Salad Bar' }),
    ];
    const remaining = { calories: 600, proteinG: 40, carbsG: 40, fatG: 20 };

    const results = suggestMealCombos(items, remaining);
    const top = results[0];
    const stations = new Set(top.items.map((i) => i.station));
    expect(stations.size).toBeGreaterThan(1);
  });

  it('returns up to 3 alternative combos that are not near-duplicates of each other', () => {
    const items: MenuItem[] = Array.from({ length: 8 }, (_, i) =>
      item({
        id: `item-${i}`,
        name: `Item ${i}`,
        calories: 200 + i * 10,
        proteinG: 15 + i,
        station: i % 2 === 0 ? 'Grill Station' : 'Deli Bar',
      }),
    );
    const remaining = { calories: 500, proteinG: 30, carbsG: 40, fatG: 15 };

    const results = suggestMealCombos(items, remaining, { maxResults: 3 });

    expect(results.length).toBeLessThanOrEqual(3);
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const idsA = new Set(results[i].items.map((x) => x.id));
        const overlap = results[j].items.filter((x) => idsA.has(x.id)).length;
        expect(overlap).toBeLessThan(Math.min(results[i].items.length, results[j].items.length));
      }
    }
  });

  it('returns an empty list when no items have usable nutrition data', () => {
    const items: MenuItem[] = [
      item({ id: '1', name: 'Mystery', calories: null, proteinG: null, nutritionEstimated: true }),
    ];
    const results = suggestMealCombos(items, { calories: 500, proteinG: 30, carbsG: 40, fatG: 15 });
    expect(results).toEqual([]);
  });
});
