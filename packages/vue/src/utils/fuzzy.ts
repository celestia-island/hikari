export interface FuzzyMatch {
  matched: boolean;
  /** Higher is better. 0 when not matched. */
  score: number;
}

/**
 * Lightweight subsequence fuzzy matcher with word-boundary scoring
 * (upstreamed from shittim-chest). A query "matches" a haystack if the
 * query characters appear in order; the score rewards consecutive runs
 * and matches at word boundaries (spaces, camelCase transitions,
 * punctuation), so typing "rep err" surfaces "Report: execution error"
 * over a stray "repairs ferry".
 */
export function fuzzyScore(query: string, haystack: string): FuzzyMatch {
  if (!query) return { matched: true, score: 0 };
  const q = query.toLowerCase();
  const h = haystack.toLowerCase();
  let qi = 0;
  let score = 0;
  let run = 0;
  let prevBoundary = true;
  for (let hi = 0; hi < h.length && qi < q.length; hi++) {
    if (h[hi] !== q[qi]) {
      run = 0;
      prevBoundary = /[\s\-_.,/()[\]]/.test(h[hi]) || (hi > 0 && /[a-z0-9]/.test(h[hi - 1]) && /[A-Z]/.test(h[hi]));
      continue;
    }
    qi++;
    run++;
    score += 1 + (prevBoundary ? 2 : 0) + (run > 1 ? 1 : 0);
    prevBoundary = false;
  }
  if (qi < q.length) return { matched: false, score: 0 };
  return { matched: true, score };
}

/** Score an object across several string fields (weighted sum). */
export function fuzzyScoreFields(
  query: string,
  fields: Array<[string, number]>,
): FuzzyMatch {
  let total = 0;
  let any = false;
  for (const [field, weight] of fields) {
    const m = fuzzyScore(query, field);
    if (m.matched) {
      any = true;
      total += m.score * weight;
    }
  }
  return any ? { matched: true, score: total } : { matched: false, score: 0 };
}

/** Filter + rank a list by fuzzy query over the given field getters. */
export function fuzzySearch<T>(
  query: string,
  items: T[],
  getFields: (item: T) => Array<[string, number]>,
): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, m: fuzzyScoreFields(query, getFields(item)) }))
    .filter(({ m }) => m.matched)
    .sort((a, b) => b.m.score - a.m.score)
    .map(({ item }) => item);
}
