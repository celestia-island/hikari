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

/** Score an object across several text fields (weighted sum). */
export function fuzzyScoreFields(
  query: string,
  fields: Array<{ text: string; weight?: number }>,
): FuzzyMatch {
  let total = 0;
  let any = false;
  for (const field of fields) {
    const m = fuzzyScore(query, field.text);
    if (m.matched) {
      any = true;
      total += m.score * (field.weight ?? 1);
    }
  }
  return any ? { matched: true, score: total } : { matched: false, score: 0 };
}

/** Filter + rank a list by fuzzy query; returns scored matches. */
export function fuzzySearch<T>(
  query: string,
  records: T[],
  fieldsOf: (rec: T) => Array<{ text: string; weight?: number }>,
): Array<{ record: T; score: number }> {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return records.map((record) => ({ record, score: 0 }));
  }
  return records
    .map((record) => {
      let total = 0;
      for (const term of terms) {
        const m = fuzzyScoreFields(term, fieldsOf(record));
        if (!m.matched) return null;
        total += m.score;
      }
      return { record, score: total };
    })
    .filter((x): x is { record: T; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);
}
