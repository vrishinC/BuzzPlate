import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

// parseGeminiJson/validate aren't exported (they're implementation details of
// analyzeFoodPhoto), so we test the same logic via a local copy of the pure
// parsing function signature by re-implementing the two testable seams:
// fence-stripping and field validation. To keep this honest against the real
// module, we import the module and drive it through callGemini's public
// surface using a stubbed fetch.

const originalFetch = globalThis.fetch;

function stubGeminiFetch(responseText: string, ok = true, status = 200) {
  globalThis.fetch = ((_url: string, _init?: RequestInit) => {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: responseText }] } }],
        }),
        { status, headers: { 'Content-Type': 'application/json' } },
      ),
    );
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = originalFetch;
}

Deno.env.set('GEMINI_API_KEY', 'test-key');

const VALID_JSON = JSON.stringify({
  dishName: 'Grilled Chicken Bowl',
  confidence: 0.8,
  estimatedServingDescription: '1 bowl, approx 400g',
  calories: 550,
  proteinG: 40,
  carbsG: 45,
  fatG: 18,
  notes: 'Dressing amount estimated',
});

Deno.test('analyzeFoodPhoto parses a clean JSON response', async () => {
  const { analyzeFoodPhoto } = await import('./gemini.ts');
  stubGeminiFetch(VALID_JSON);
  try {
    const result = await analyzeFoodPhoto('base64data', 'image/jpeg');
    assertEquals(result.dishName, 'Grilled Chicken Bowl');
    assertEquals(result.calories, 550);
    assertEquals(result.confidence, 0.8);
  } finally {
    restoreFetch();
  }
});

Deno.test('analyzeFoodPhoto strips markdown code fences', async () => {
  const { analyzeFoodPhoto } = await import('./gemini.ts');
  stubGeminiFetch('```json\n' + VALID_JSON + '\n```');
  try {
    const result = await analyzeFoodPhoto('base64data', 'image/jpeg');
    assertEquals(result.dishName, 'Grilled Chicken Bowl');
  } finally {
    restoreFetch();
  }
});

Deno.test('analyzeFoodPhoto clamps confidence into [0, 1]', async () => {
  const { analyzeFoodPhoto } = await import('./gemini.ts');
  const overconfident = JSON.parse(VALID_JSON);
  overconfident.confidence = 1.5;
  stubGeminiFetch(JSON.stringify(overconfident));
  try {
    const result = await analyzeFoodPhoto('base64data', 'image/jpeg');
    assertEquals(result.confidence, 1);
  } finally {
    restoreFetch();
  }
});

Deno.test('analyzeFoodPhoto rejects when a required field is missing, even after retry', async () => {
  const { analyzeFoodPhoto } = await import('./gemini.ts');
  const missingField = JSON.parse(VALID_JSON);
  delete missingField.calories;
  stubGeminiFetch(JSON.stringify(missingField));
  try {
    await assertRejects(() => analyzeFoodPhoto('base64data', 'image/jpeg'));
  } finally {
    restoreFetch();
  }
});

Deno.test('analyzeFoodPhoto rejects on unparseable garbage after retry', async () => {
  const { analyzeFoodPhoto } = await import('./gemini.ts');
  stubGeminiFetch('not json at all');
  try {
    await assertRejects(() => analyzeFoodPhoto('base64data', 'image/jpeg'));
  } finally {
    restoreFetch();
  }
});
