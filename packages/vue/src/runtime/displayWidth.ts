/**
 * East-Asian display width, measured in full-width glyph units.
 *
 * The window-stack breadcrumb caps every layer label at a fixed number of
 * full-width units instead of a fixed number of characters: ten CJK
 * ideographs and twenty Latin letters occupy the same ~120px at the strip's
 * 12px type size, so a code-point cap would let a Latin title run twice as
 * wide as a Chinese one and re-open the very overflow the cap exists to
 * close. One full-width glyph = 1 unit, one half-width glyph = 0.5.
 *
 * Full-width: CJK ideographs (incl. the compatibility and astral blocks),
 * kana, hangul, the CJK punctuation/symbol blocks and the full-width forms
 * — the glyphs an East-Asian font advances two Latin columns for. Emoji are
 * wide by presentation, so they count as one unit as well.
 *
 * Zero-width: combining marks, joiners and variation selectors — they ride
 * along with the glyph they modify and must not consume budget of their own
 * (and must never be the glyph the cut lands on).
 */

/** Glyphs that advance one full-width column. */
const FULL_WIDTH_RE =
  /[\u1100-\u115F\u2E80-\u303E\u3040-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]|[\u{1F000}-\u{1FAFF}]|[\u{20000}-\u{3FFFD}]/u;

/** Glyphs that take no room of their own. */
const ZERO_WIDTH_RE = /[\u0300-\u036F\u200B-\u200F\u2060\uFE00-\uFE0F]/u;

/** The single-glyph ellipsis every truncation in this module appends.
 *  U+2026 is East-Asian WIDE in the fonts this library renders with (a CJK
 *  fallback advances a full em for it), so it is counted as one full-width
 *  unit — the budget must not promise room the closing glyph then eats. */
export const ELLIPSIS = "\u2026";

/** One code point's width in full-width units (0, 0.5 or 1). */
export function glyphWidthUnits(ch: string): number {
  if (!ch) return 0;
  if (ZERO_WIDTH_RE.test(ch)) return 0;
  if (ch === ELLIPSIS) return 1;
  return FULL_WIDTH_RE.test(ch) ? 1 : 0.5;
}

/** A string's width in full-width units — iterates code points, so an
 *  astral CJK ideograph (a surrogate pair) counts once, not twice. */
export function displayWidthUnits(text: string): number {
  let units = 0;
  for (const ch of text) units += glyphWidthUnits(ch);
  return units;
}

/**
 * Cut `text` so it renders at most `maxUnits` full-width units wide, closing
 * the cut with an ellipsis. The ellipsis is INSIDE the budget: a label capped
 * at 10 units renders ten ideographs, or nine ideographs plus the ellipsis —
 * never eleven glyphs of which the last one is a dot. Text that already fits
 * is returned unchanged (byte-for-byte, so callers can diff for "truncated").
 */
export function clampToDisplayWidth(
  text: string,
  maxUnits: number,
  ellipsis: string = ELLIPSIS,
): string {
  if (!(maxUnits > 0)) return "";
  if (displayWidthUnits(text) <= maxUnits) return text;
  const budget = maxUnits - displayWidthUnits(ellipsis);
  let units = 0;
  let kept = "";
  for (const ch of text) {
    const w = glyphWidthUnits(ch);
    if (units + w > budget) break;
    units += w;
    kept += ch;
  }
  // A cut that lands after a space would render as a floating ellipsis
  // ("Hello wor …"); pull the trailing whitespace back under the cut.
  return `${kept.replace(/\s+$/u, "")}${ellipsis}`;
}
