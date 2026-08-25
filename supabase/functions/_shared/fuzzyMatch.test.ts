import { assertEquals } from 'jsr:@std/assert@1';
import { findBestMenuMatch } from './fuzzyMatch.ts';
import type { NormalizedMenuItem } from './nutrislice.ts';

function makeItem(name: string): NormalizedMenuItem {
  return {
    id: `id:${name}`,
    name,
    station: 'Grill Station',
    diningHall: 'west-village',
    mealPeriod: 'lunch',
    calories: 400,
    proteinG: 30,
    carbsG: 20,
    fatG: 10,
    fiberG: 3,
    sodiumMg: 500,
    servingSizeLabel: null,
    allergens: [],
    dietaryTags: [],
    nutritionEstimated: false,
  };
}

Deno.test('findBestMenuMatch picks an exact name match', () => {
  const candidates = [makeItem('Hamburger Patty'), makeItem('Grilled Chicken Breast')];
  const result = findBestMenuMatch('Grilled Chicken Breast', candidates);
  assertEquals(result?.item.name, 'Grilled Chicken Breast');
  assertEquals(result?.score, 1);
});

Deno.test('findBestMenuMatch tolerates minor wording differences', () => {
  const candidates = [makeItem('Hamburger Patty'), makeItem('Grilled Chicken Breast')];
  const result = findBestMenuMatch('grilled chicken breast (grill station)', candidates);
  assertEquals(result?.item.name, 'Grilled Chicken Breast');
});

Deno.test('findBestMenuMatch returns null when nothing is close enough', () => {
  const candidates = [makeItem('Hamburger Patty'), makeItem('Pepperoni Pizza')];
  const result = findBestMenuMatch('Miso Glazed Salmon', candidates);
  assertEquals(result, null);
});

Deno.test('findBestMenuMatch returns null on an empty candidate list', () => {
  const result = findBestMenuMatch('Anything', []);
  assertEquals(result, null);
});

Deno.test('findBestMenuMatch picks the closer of two similar candidates', () => {
  const candidates = [makeItem('Chicken Tenders'), makeItem('Chicken Tikka Masala')];
  const result = findBestMenuMatch('Chicken Tikka', candidates);
  assertEquals(result?.item.name, 'Chicken Tikka Masala');
});
