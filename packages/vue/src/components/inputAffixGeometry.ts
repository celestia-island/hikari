/**
 * Geometry predicate for HkInput's narrow-box affix auto-degrade.
 *
 * The centered default reserves the WIDER of the two measured affix
 * widths on BOTH sides (`--hk-input-affix-*-w` → symmetric
 * padding-inline), so the centered caret, typed text and placeholder
 * stay on the box axis no matter which side carries an affix. That
 * reservation is an optical-centering trade paid in dead line width on
 * the affix-less side. While the box is wide the trade is invisible;
 * once the box can no longer fit three widest-affix widths plus the
 * base paddings, it stops paying: the symmetric reservation leaves a
 * usable line of `boxW - 2·base - 2·widest`, which is narrower than
 * ONE widest affix exactly when `boxW < 3·widest + 2·base` — and the
 * whole affix-less side turns into permanently dead space no caret or
 * placeholder can enter (2026-11-17 chest report: the new-workspace
 * remote-URL field in a near-full-width phone bottom drawer with a
 * ~120px platform chip in the #prefix slot left the right third of the
 * line empty; the caller had passed no `align`, so the centered
 * default owned the geometry).
 *
 * `isAffixLineCramped` is that judgment as a pure function — unit-test
 * pin, mutation target. HkInput re-runs it from its shared
 * ResizeObserver (affix widths + the box's own clientWidth) and stamps
 * `data-affix-cramped` on CENTERED non-textarea boxes when it fires;
 * the sheet then switches the element padding and the
 * placeholder-marquee window to the per-side reservation — byte-for-
 * byte the arithmetic of an explicit `align="start"` / `align="end"`
 * box. Only the RESERVATION degrades: `text-align` stays centered, and
 * explicit alignments never carry the marker, so their behavior is
 * untouched.
 */

/**
 * Base horizontal padding of the input element, mirroring the sheet's
 * `var(--space-12)` (0.75rem at the default 16px root). The predicate
 * is a coarse threshold, not a layout measurement — the nominal pixel
 * value is all it needs, so rem drift under a non-default root size
 * (a few px) cannot flip a desktop-scale box.
 */
export const AFFIX_BASE_PAD_PX = 12;

/**
 * Whether the symmetric centered affix reservation would crush the
 * input line. Fires exactly when the box cannot fit
 * `3 × max(startW, endW) + 2 × base` — i.e. when the line the
 * symmetric reservation leaves would be strictly narrower than the
 * widest affix that caused it. Two deliberate non-cases:
 * - no affixes (`widest <= 0`): the reservation is zero either way,
 *   there is nothing to degrade;
 * - no measured box width (`boxW <= 0`, NaN included): SSR, the pre-
 *   mount window and `display:none` all report zero, and speculative
 *   geometry must not win over the published default — the shared
 *   ResizeObserver delivers a real width before first paint, and the
 *   marker follows it.
 */
export function isAffixLineCramped(
  startW: number,
  endW: number,
  boxW: number,
): boolean {
  const widest = Math.max(startW, endW);
  if (!(widest > 0) || !(boxW > 0)) return false;
  return boxW < 3 * widest + 2 * AFFIX_BASE_PAD_PX;
}
