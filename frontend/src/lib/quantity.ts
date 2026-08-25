import type { Macros, MenuItem } from './types';

/** Scales a menu item's base (1 serving) macros by a quantity multiplier. */
export function scaleItemMacros(item: MenuItem, quantity: number): Macros {
  return {
    calories: (item.calories ?? 0) * quantity,
    proteinG: (item.proteinG ?? 0) * quantity,
    carbsG: (item.carbsG ?? 0) * quantity,
    fatG: (item.fatG ?? 0) * quantity,
  };
}

export function sumScaledMacros(items: { item: MenuItem; quantity: number }[]): Macros {
  return items.reduce<Macros>(
    (acc, { item, quantity }) => {
      const m = scaleItemMacros(item, quantity);
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

/** Dish name annotated with quantity when it's not a plain single serving, e.g. "Chicken Breast (x1.5)". */
export function dishNameWithQuantity(name: string, quantity: number): string {
  return quantity === 1 ? name : `${name} (×${quantity})`;
}
