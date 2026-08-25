import { describe, expect, it } from 'vitest';
import { filterMenuByDietaryTags } from './dietaryFilter';
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

describe('filterMenuByDietaryTags', () => {
  it('returns everything when no tags are set', () => {
    const items = [item({ id: '1', name: 'Bacon' })];
    expect(filterMenuByDietaryTags(items, [])).toHaveLength(1);
  });

  it('excludes items with a pork allergen when no-pork is set', () => {
    const items = [
      item({ id: '1', name: 'Bacon', allergens: ['pork'] }),
      item({ id: '2', name: 'Chicken', allergens: ['poultry'] }),
    ];
    const result = filterMenuByDietaryTags(items, ['no-pork']);
    expect(result.map((i) => i.id)).toEqual(['2']);
  });

  it('excludes items with a beef allergen when no-beef is set', () => {
    const items = [
      item({ id: '1', name: 'Cheeseburger', allergens: ['beef'] }),
      item({ id: '2', name: 'Grilled Chicken', allergens: ['poultry'] }),
    ];
    const result = filterMenuByDietaryTags(items, ['no-beef']);
    expect(result.map((i) => i.id)).toEqual(['2']);
  });

  it('combines no-pork and no-beef as independent exclusions', () => {
    const items = [
      item({ id: '1', name: 'Bacon', allergens: ['pork'] }),
      item({ id: '2', name: 'Cheeseburger', allergens: ['beef'] }),
      item({ id: '3', name: 'Grilled Chicken', allergens: ['poultry'] }),
    ];
    const result = filterMenuByDietaryTags(items, ['no-pork', 'no-beef']);
    expect(result.map((i) => i.id)).toEqual(['3']);
  });

  it('requires the vegan icon when vegan is set', () => {
    const items = [
      item({ id: '1', name: 'Salad', dietaryTags: ['vegan', 'vegetarian'] }),
      item({ id: '2', name: 'Cheese Pizza', dietaryTags: ['vegetarian'] }),
    ];
    const result = filterMenuByDietaryTags(items, ['vegan']);
    expect(result.map((i) => i.id)).toEqual(['1']);
  });

  it('combines multiple tags as AND conditions', () => {
    const items = [
      item({ id: '1', name: 'Halal Gluten Free Chicken', dietaryTags: ['halal', 'gluten-friendly'], allergens: ['poultry'] }),
      item({ id: '2', name: 'Halal Bread', dietaryTags: ['halal'] }),
    ];
    const result = filterMenuByDietaryTags(items, ['halal', 'gluten-friendly']);
    expect(result.map((i) => i.id)).toEqual(['1']);
  });
});
