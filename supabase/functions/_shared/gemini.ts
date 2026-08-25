// Thin wrapper around the Gemini generateContent API for food-photo analysis.
// Server-side only: GEMINI_API_KEY must never reach the frontend.

const DEFAULT_MODEL = 'gemini-2.0-flash';

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

const REQUIRED_FIELDS: (keyof FoodAnalysis)[] = [
  'dishName',
  'confidence',
  'estimatedServingDescription',
  'calories',
  'proteinG',
  'carbsG',
  'fatG',
  'notes',
];

const PROMPT = `You are a nutrition estimation assistant. Look at this photo of food and estimate its nutritional content.

Respond with ONLY a raw JSON object, no markdown code fences, no explanation text before or after. The JSON object must have exactly these fields:
{
  "dishName": string (short name of the dish),
  "confidence": number (0 to 1, how confident you are in this identification),
  "estimatedServingDescription": string (e.g. "1 cup, approx 250g"),
  "calories": number (kcal, whole number),
  "proteinG": number (grams),
  "carbsG": number (grams),
  "fatG": number (grams),
  "notes": string (brief caveats about the estimate, e.g. "hidden dressing/oil not visible")
}

Estimate as accurately as possible from visual portion size. If multiple foods are visible, treat it as one combined plate and sum the values.`;

/** Strips markdown code fences a model may add despite instructions not to. */
function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function validate(parsed: unknown): FoodAnalysis {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Gemini response is not a JSON object');
  }
  const obj = parsed as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      throw new Error(`Gemini response missing field: ${field}`);
    }
  }

  const numberFields: (keyof FoodAnalysis)[] = [
    'confidence',
    'calories',
    'proteinG',
    'carbsG',
    'fatG',
  ];
  for (const field of numberFields) {
    if (typeof obj[field] !== 'number' || !Number.isFinite(obj[field])) {
      throw new Error(`Gemini response field ${field} is not a finite number`);
    }
  }
  if (typeof obj.dishName !== 'string' || obj.dishName.trim() === '') {
    throw new Error('Gemini response field dishName is not a non-empty string');
  }
  if (typeof obj.estimatedServingDescription !== 'string') {
    throw new Error('Gemini response field estimatedServingDescription is not a string');
  }
  if (typeof obj.notes !== 'string') {
    throw new Error('Gemini response field notes is not a string');
  }

  return {
    dishName: obj.dishName as string,
    confidence: Math.max(0, Math.min(1, obj.confidence as number)),
    estimatedServingDescription: obj.estimatedServingDescription as string,
    calories: Math.max(0, obj.calories as number),
    proteinG: Math.max(0, obj.proteinG as number),
    carbsG: Math.max(0, obj.carbsG as number),
    fatG: Math.max(0, obj.fatG as number),
    notes: obj.notes as string,
  };
}

function parseGeminiJson(rawText: string): FoodAnalysis {
  const stripped = stripFences(rawText);
  const parsed = JSON.parse(stripped);
  return validate(parsed);
}

async function callGemini(
  apiKey: string,
  model: string,
  imageBase64: string,
  mimeType: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') {
    throw new Error('Gemini response missing candidate text');
  }
  return text;
}

/** Calls Gemini and parses the result, retrying once (fresh call) on a parse failure. */
export async function analyzeFoodPhoto(
  imageBase64: string,
  mimeType: string,
): Promise<FoodAnalysis> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
  const model = Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const rawText = await callGemini(apiKey, model, imageBase64, mimeType);
      return parseGeminiJson(rawText);
    } catch (err) {
      lastError = err;
      console.error(`Gemini analysis attempt ${attempt + 1} failed`, err);
    }
  }
  throw new Error(
    `Gemini analysis failed after retry: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
