import { describe, expect, it } from 'vitest';
import { dishNameWithQuantity, scaleItemMacros, sumScaledMacros } from './quantity';
import type { MenuItem } from './types';

function item(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: '1',
    name: 'Grilled Chicken Breast',
    station: 'Grill Station',
    diningHall: 'west-village',
    mealPeriod: 'lunch',
    calories: 200,
    proteinG: 20,
    carbsG: 0,
    fatG: 5,
    fiberG: 0,
    sodiumMg: 300,
    allergens: [],
    dietaryTags: [],
    nutritionEstimated: false,
    servingSizeLabel: '1 breast',
    ...overrides,
  };
}

describe('scaleItemMacros', () => {
  it('returns base macros unchanged at 1x', () => {
    const result = scaleItemMacros(item(), 1);
    expect(result).toEqual({ calories: 200, proteinG: 20, carbsG: 0, fatG: 5 });
  });

  it('scales macros proportionally at other quantities', () => {
    const result = scaleItemMacros(item(), 1.5);
    expect(result).toEqual({ calories: 300, proteinG: 30, carbsG: 0, fatG: 7.5 });
  });

  it('treats missing macros as zero rather than NaN', () => {
    const result = scaleItemMacros(item({ calories: null, proteinG: null }), 2);
    expect(result.calories).toBe(0);
    expect(result.proteinG).toBe(0);
  });
});

describe('sumScaledMacros', () => {
  it('sums scaled macros across multiple items', () => {
    const items = [
      { item: item({ id: '1', calories: 200, proteinG: 20 }), quantity: 1 },
      { item: item({ id: '2', calories: 100, proteinG: 5 }), quantity: 2 },
    ];
    const result = sumScaledMacros(items);
    expect(result.calories).toBe(400);
    expect(result.proteinG).toBe(30);
  });
});

describe('dishNameWithQuantity', () => {
  it('leaves the name alone at 1x', () => {
    expect(dishNameWithQuantity('Rice', 1)).toBe('Rice');
  });

  it('annotates the name at other quantities', () => {
    expect(dishNameWithQuantity('Rice', 1.5)).toBe('Rice (×1.5)');
  });
});
