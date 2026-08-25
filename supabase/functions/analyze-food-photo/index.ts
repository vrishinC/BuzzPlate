// analyze-food-photo: fetches a photo the client already uploaded to the
// private `food-photos` bucket, sends it to Gemini for a nutrition estimate,
// and (for sourceType "gt_item") fuzzy-matches the result against today's
// cached GT menu items across all halls/meals.
//
// Request body: { storagePath: string, sourceType: "gt_item" | "outside" }
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { getSupabaseAdmin, getSupabaseForRequest } from '../_shared/supabaseAdmin.ts';
import { analyzeFoodPhoto } from '../_shared/gemini.ts';
import { findBestMenuMatch } from '../_shared/fuzzyMatch.ts';
import type { NormalizedMenuItem } from '../_shared/nutrislice.ts';

const PHOTO_BUCKET = 'food-photos';

function guessMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Identify the caller so we only ever read their own photo (storage RLS
  // also enforces this, but check explicitly for a clean error message).
  const userClient = getSupabaseForRequest(req);
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  let body: { storagePath?: string; sourceType?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { storagePath, sourceType } = body;
  if (!storagePath || typeof storagePath !== 'string') {
    return jsonResponse({ error: 'Missing storagePath' }, 400);
  }
  if (sourceType !== 'gt_item' && sourceType !== 'outside') {
    return jsonResponse(
      { error: `Invalid sourceType: ${sourceType}` },
      400,
    );
  }
  if (!storagePath.startsWith(`${user.id}/`)) {
    return jsonResponse({ error: 'storagePath does not belong to caller' }, 403);
  }

  const admin = getSupabaseAdmin();

  const { data: fileData, error: downloadError } = await admin.storage
    .from(PHOTO_BUCKET)
    .download(storagePath);
  if (downloadError || !fileData) {
    console.error('photo download failed', downloadError);
    return jsonResponse({ error: 'Could not read uploaded photo' }, 404);
  }

  let analysis;
  try {
    const buffer = await fileData.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);
    analysis = await analyzeFoodPhoto(base64, guessMimeType(storagePath));
  } catch (err) {
    console.error('gemini analysis failed', err);
    return jsonResponse(
      { error: 'Nutrition analysis failed, please try again' },
      502,
    );
  }

  let gtMatch: { item: NormalizedMenuItem; score: number } | null = null;
  if (sourceType === 'gt_item') {
    const today = new Date().toISOString().slice(0, 10);
    const { data: cacheRows, error: cacheError } = await admin
      .from('menu_cache')
      .select('items_json')
      .eq('menu_date', today);

    if (cacheError) {
      console.error('menu_cache read failed during fuzzy match', cacheError);
    } else if (cacheRows) {
      const allItems: NormalizedMenuItem[] = cacheRows.flatMap(
        (row) => row.items_json as NormalizedMenuItem[],
      );
      gtMatch = findBestMenuMatch(analysis.dishName, allItems);
    }
  }

  return jsonResponse({
    analysis,
    gtMatch: gtMatch
      ? { item: gtMatch.item, confidence: gtMatch.score }
      : null,
  });
});
