import { supabase } from './supabaseClient';
import type { AnalyzeFoodPhotoResponse, DiningHallId, GetMenuResponse, MealPeriod } from './types';

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw error;
  return data as T;
}

export function getMenu(
  diningHall: DiningHallId,
  mealPeriod: Exclude<MealPeriod, 'snack'>,
  date?: string,
): Promise<GetMenuResponse> {
  return invoke<GetMenuResponse>('get-menu', { diningHall, mealPeriod, date });
}

export function analyzeFoodPhoto(
  storagePath: string,
  sourceType: 'gt_item' | 'outside',
): Promise<AnalyzeFoodPhotoResponse> {
  return invoke<AnalyzeFoodPhotoResponse>('analyze-food-photo', {
    storagePath,
    sourceType,
  });
}
