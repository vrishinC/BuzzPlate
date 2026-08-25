import type { MenuItem } from './types';

const REQUIRES_ICON: Record<string, string> = {
  vegetarian: 'vegetarian',
  vegan: 'vegan',
  'gluten-friendly': 'gluten-friendly',
  halal: 'halal',
  kosher: 'kosher',
};

const EXCLUDES_ALLERGEN: Record<string, string> = {
  'no-pork': 'pork',
  'no-beef': 'beef',
};

/** Dietary tags are a hard filter everywhere menu items are shown or scored. */
export function filterMenuByDietaryTags(
  items: MenuItem[],
  dietaryTags: string[],
): MenuItem[] {
  if (dietaryTags.length === 0) return items;

  const requiredIcons = dietaryTags
    .map((tag) => REQUIRES_ICON[tag])
    .filter((icon): icon is string => Boolean(icon));
  const excludedAllergens = dietaryTags
    .map((tag) => EXCLUDES_ALLERGEN[tag])
    .filter((allergen): allergen is string => Boolean(allergen));

  return items.filter((item) => {
    if (excludedAllergens.some((allergen) => item.allergens.includes(allergen))) {
      return false;
    }
    return requiredIcons.every((icon) => item.dietaryTags.includes(icon));
  });
}
