// Tooltip-vs-tooltip collision — the auto-spread pass behind
// applyTooltipPosition.
//
// Two tooltips can be on screen at once (a rich hover card from one
// surface and a plain bubble from another — both live in the overlay
// root), and until now they simply painted over each other: each popup
// anchored to its own trigger with no knowledge of its siblings. This
// module gives the positioning pass the two facts it needs to spread
// them apart:
//
//   - `collectTooltipObstacles` — every OTHER visible tooltip popup
//     sharing the mover's home (the overlay root, or its parent when a
//     host mounts popups elsewhere), as raw visual-space rects. Only
//     tooltips participate: popovers/menus/select panels annotate
//     different things and live in lower z bands, so a tooltip keeps
//     deliberately covering them.
//   - pure geometry helpers — strict overlap detection for scoring and
//     an interval-based nearest-clear-shift for dodging along one axis.
//
// The mover YIELDS to already-visible tooltips (first shown keeps its
// anchored spot, the newcomer moves), the dodge never crosses the
// viewport gutter (the shift range IS the gutter-clamped range, and
// flip candidates are clamped before scoring), and an author who wants
// popups to stack on purpose opts a tooltip out entirely with
// `data-hk-tooltip-overlap` — exempt popups neither dodge nor block.
//
// Everything here degrades to a no-op without layout (happy-dom/jsdom
// report zero rects, which the obstacle filter drops), so tests and
// hidden popups keep the pre-collision placement math untouched.
//
// AI disclosure: drafted by GLM via the ZCode agent, directed and
// reviewed by langyo — SySL-1.0 §2.3.

/**
 * The deliberate-overlap escape hatch: a tooltip popup carrying this
 * attribute is excluded from collision entirely — it never dodges other
 * tooltips and they never dodge it. HkTooltip exposes it as the
 * `overlap` prop, the tooltip bridge as the `overlap` option, and hosts
 * that position their own `.hk-tooltip-popup` through
 * `applyTooltipPosition` can set the attribute by hand.
 */
export const TOOLTIP_OVERLAP_ATTR = "data-hk-tooltip-overlap";

/** Minimum clearance between two spread-apart tooltips — the same 8px a
 *  tooltip keeps from its trigger, so a dodged bubble never looks glued
 *  to the one it avoided. */
export const TOOLTIP_COLLIDE_CLEARANCE_PX = 8;

/** Overlaps below this area (px²) are rounding noise, not collisions —
 *  a subpixel gBCR edge must not send a tooltip scurrying. */
const OVERLAP_EPSILON_PX = 0.5;

/** A plain visual-space rect (DOMRect-compatible subset). */
export interface TooltipRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Strictly-overlapping test with subpixel tolerance: shared edges and
 *  rounding-level grazes are not collisions. */
export function tooltipRectsOverlap(a: TooltipRect, b: TooltipRect): boolean {
  return (
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left) > OVERLAP_EPSILON_PX &&
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top) > OVERLAP_EPSILON_PX
  );
}

/** Total overlapping area between `rect` and every obstacle — the score
 *  the positioning pass minimizes. */
export function tooltipOverlapArea(rect: TooltipRect, obstacles: TooltipRect[]): number {
  let total = 0;
  for (const o of obstacles) {
    const w = Math.min(rect.left + rect.width, o.left + o.width) - Math.max(rect.left, o.left);
    const h = Math.min(rect.top + rect.height, o.top + o.height) - Math.max(rect.top, o.top);
    if (w > OVERLAP_EPSILON_PX && h > OVERLAP_EPSILON_PX) total += w * h;
  }
  return total;
}

/**
 * Every visible tooltip popup that would collide with `popup` — its
 * siblings under the overlay root (or, when the popup is mounted
 * elsewhere, its parent), minus itself and every
 * `data-hk-tooltip-overlap`-exempt element, each carrying a nonempty
 * measured box. Zero-rect siblings (no layout, `display: none`,
 * mid-unmount) cannot collide and are dropped, which is what makes the
 * whole pass a no-op in test DOMs.
 */
export function collectTooltipObstacles(popup: HTMLElement): TooltipRect[] {
  if (typeof document === "undefined") return [];
  const home = popup.closest("#hk-overlay-root") ?? popup.parentElement;
  if (!home) return [];
  const obstacles: TooltipRect[] = [];
  for (const el of home.querySelectorAll<HTMLElement>(".hk-tooltip-popup.hk-tooltip-visible")) {
    if (el === popup) continue;
    if (el.hasAttribute(TOOLTIP_OVERLAP_ATTR)) continue;
    const box = el.getBoundingClientRect();
    if (!(box.width > 0 && box.height > 0)) continue;
    obstacles.push({ left: box.left, top: box.top, width: box.width, height: box.height });
  }
  return obstacles;
}

/**
 * The nearest offset along one axis that moves a box of `size` px clear
 * of every obstacle, or null when no position inside `[min, max]`
 * avoids them all. `forbidden` holds each obstacle's projection on the
 * shift axis already EXPANDED by the clearance on both ends; a box
 * position `p` is forbidden when `p + size` crosses a projection's start
 * or `p` falls short of its end. The viewport clamp stays
 * authoritative: the answer always lands inside `[min, max]` — a dodge
 * can never trade a tooltip overlap for an off-screen bubble.
 */
export function clearCrossShift(
  preferred: number,
  size: number,
  forbidden: Array<{ lo: number; hi: number }>,
  min: number,
  max: number,
): number | null {
  if (!(max >= min)) return null; // the box cannot fit the clamp — stay put
  const sorted = forbidden
    .map((f) => ({ lo: f.lo - size, hi: f.hi }))
    .sort((a, b) => a.lo - b.lo);
  // Merge the forbidden intervals, then walk the allowed gaps they leave
  // inside the clamp range.
  const gaps: Array<{ lo: number; hi: number }> = [];
  let cursor = min;
  for (const f of sorted) {
    if (f.hi <= cursor) continue; // swallowed by a previous interval
    if (f.lo >= max) break; // everything further is outside the range
    if (f.lo > cursor) gaps.push({ lo: cursor, hi: Math.min(f.lo, max) });
    cursor = Math.max(cursor, f.hi);
    if (cursor >= max) break;
  }
  if (cursor <= max) gaps.push({ lo: cursor, hi: max });
  let best: number | null = null;
  for (const g of gaps) {
    const candidate = Math.min(Math.max(preferred, g.lo), g.hi);
    if (best === null || Math.abs(candidate - preferred) < Math.abs(best - preferred)) {
      best = candidate;
    }
  }
  return best === null ? null : best - preferred;
}
