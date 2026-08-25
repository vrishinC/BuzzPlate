import type { NormalizedMenuItem } from './nutrislice.ts';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter((t) => t.length > 1));
}

/** Levenshtein distance, used as a tiebreaker for near-identical short names. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Jaccard token overlap in [0, 1], blended with normalized edit-distance similarity. */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;

  const ta = tokenize(a);
  const tb = tokenize(b);
  let intersection = 0;
  for (const t of ta) if (tb.has(t)) intersection++;
  const union = ta.size + tb.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;

  const maxLen = Math.max(na.length, nb.length, 1);
  const editSim = 1 - levenshtein(na, nb) / maxLen;

  return 0.7 * jaccard + 0.3 * editSim;
}

export interface FuzzyMatchResult {
  item: NormalizedMenuItem;
  score: number;
}

/** Best match for `dishName` among `candidates`, or null if nothing clears the confidence bar. */
export function findBestMenuMatch(
  dishName: string,
  candidates: NormalizedMenuItem[],
  minScore = 0.45,
): FuzzyMatchResult | null {
  let best: FuzzyMatchResult | null = null;
  for (const item of candidates) {
    const score = similarity(dishName, item.name);
    if (!best || score > best.score) {
      best = { item, score };
    }
  }
  if (!best || best.score < minScore) return null;
  return best;
}
