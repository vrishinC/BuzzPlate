export type MealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const DINING_HALLS = [
  { id: 'brittain', name: 'Brittain Dining Hall' },
  { id: 'north-ave-dining-hall', name: 'North Ave Dining Hall' },
  { id: 'west-village', name: 'West Village' },
] as const;

export type DiningHallId = (typeof DINING_HALLS)[number]['id'];

export const MENU_MEAL_PERIODS: Exclude<MealPeriod, 'snack'>[] = [
  'breakfast',
  'lunch',
  'dinner',
];

export const DIETARY_TAG_OPTIONS = [
  'vegetarian',
  'vegan',
  'gluten-friendly',
  'halal',
  'kosher',
  'no-pork',
  'no-beef',
] as const;

export type DietaryTag = (typeof DIETARY_TAG_OPTIONS)[number];

export const DIETARY_TAG_LABELS: Record<DietaryTag, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  'gluten-friendly': 'Gluten-friendly',
  halal: 'Halal',
  kosher: 'Kosher',
  'no-pork': 'No pork',
  'no-beef': 'Hindu (no beef)',
};

export interface MealSplit {
  breakfast: number;
  lunch: number;
  dinner: number;
  snack: number;
}

export const DEFAULT_MEAL_SPLIT: MealSplit = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

export interface Profile {
  id: string;
  email: string;
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  dietary_tags: string[];
  meal_split: MealSplit;
  created_at: string;
}

export interface MenuItem {
  id: string;
  name: string;
  station: string;
  diningHall: DiningHallId;
  mealPeriod: Exclude<MealPeriod, 'snack'>;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sodiumMg: number | null;
  allergens: string[];
  dietaryTags: string[];
  nutritionEstimated: boolean;
  servingSizeLabel: string | null;
}

export interface GetMenuResponse {
  diningHall: DiningHallId;
  mealPeriod: string;
  date: string;
  items: MenuItem[];
  source: 'cache' | 'live' | 'stale-cache' | 'unavailable';
  warning?: string;
}

export type LogSource = 'gt_menu' | 'photo_gt_match' | 'photo_outside';

export interface LogEntry {
  id: string;
  user_id: string;
  log_date: string;
  meal_period: MealPeriod;
  source: LogSource;
  dish_name: string;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  photo_storage_path: string | null;
  gt_menu_item_ref: MenuItem | null;
  created_at: string;
}

export type LogEntryInsert = Omit<LogEntry, 'id' | 'created_at'>;

export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodAnalysis {
  dishName: string;
  confidence: number;
  estimatedServingDescription: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  notes: string;
}

export interface AnalyzeFoodPhotoResponse {
  analysis: FoodAnalysis;
  gtMatch: { item: MenuItem; confidence: number } | null;
}
