// Shared floating-tooltip geometry for HkTooltip (component) and the
// document-level tooltip bridge (runtime/tooltipBridge.ts). One placement
// switch, one zoom story: whatever hosts a popup against a trigger rect
// positions it through this helper so the two surfaces can never drift.
import type { CSSProperties } from "vue";
import { ancestorZoom } from "./cssZoom";
import { popupViewportRect, type PopupViewportRect } from "./popupBounds";
import { clampWithGutter, viewportGutterPx } from "./viewportGutter";
import {
  TOOLTIP_COLLIDE_CLEARANCE_PX,
  TOOLTIP_OVERLAP_ATTR,
  clearCrossShift,
  collectTooltipObstacles,
  tooltipOverlapArea,
  type TooltipRect,
} from "./tooltipCollision";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

/** Gap between the trigger rect and the popup, in root visual px. */
export const TOOLTIP_GAP_PX = 8;

/**
 * Build the inline style that pins a `position: fixed` popup to one side
 * of a trigger rect.
 *
 * The popup floats OUTSIDE the page's zoomed subtrees — the HkTooltip
 * component teleports it into #hk-overlay-root and the bridge appends
 * it there too, both mounted under unzoomed <body>, outside every
 * zoomed subtree — while `rect`
 * is already in the root visual space (standardized zoom
 * reports ancestor zoom applied). The browser scales the tooltip's local
 * px back up at paint, so the visual rect values must be written divided
 * by the cumulative zoom or the tooltip drifts zoom× off its trigger
 * (chest's root-level manual DPI scale). This contract quietly assumes
 * the overlay root itself never carries a CSS zoom: the anchor math here
 * divides by ancestorZoom(document.body) only, while the clamp pass
 * below divides by ancestorZoom(popup) — the two agree exactly because
 * the root sits unzoomed between them.
 *
 * `width: max-content` is the position-independence contract (same rule
 * as .hk-popover-panel): a fixed element otherwise shrink-to-fits against
 * `viewport - left`, so a trigger near the viewport edge squeezes the
 * bubble down to the leftover space — the vertical one-glyph-per-line
 * column on mobile (the jump-to-date tooltip report). max-content sizes
 * the box to its text wherever it sits; applyTooltipPosition then clamps
 * it back into the viewport.
 */
export function tooltipPositionStyle(
  rect: DOMRect,
  placement: TooltipPlacement,
  maxWidth?: string,
): CSSProperties {
  const z = ancestorZoom(document.body);
  const local = (v: number) => `${v / z}px`;
  const style: CSSProperties = {};

  style.width = "max-content";
  if (maxWidth) {
    style.maxWidth = maxWidth;
  }

  switch (placement) {
    case "top":
      style.top = local(rect.top - TOOLTIP_GAP_PX);
      style.left = local(rect.left + rect.width / 2);
      style.transform = "translate(-50%, -100%)";
      break;
    case "bottom":
      style.top = local(rect.bottom + TOOLTIP_GAP_PX);
      style.left = local(rect.left + rect.width / 2);
      style.transform = "translate(-50%, 0)";
      break;
    case "left":
      style.top = local(rect.top + rect.height / 2);
      style.left = local(rect.left - TOOLTIP_GAP_PX);
      style.transform = "translate(-100%, -50%)";
      break;
    case "right":
      style.top = local(rect.top + rect.height / 2);
      style.left = local(rect.right + TOOLTIP_GAP_PX);
      style.transform = "translate(0, -50%)";
      break;
  }

  return style;
}

/** Space left on the given side of the trigger rect, inside the popup
 *  viewport, minus the trigger gap. */
function sideSpace(
  rect: DOMRect,
  side: TooltipPlacement,
  frame: PopupViewportRect,
): number {
  switch (side) {
    case "top":
      return rect.top - frame.y - TOOLTIP_GAP_PX;
    case "bottom":
      return frame.y + frame.height - rect.bottom - TOOLTIP_GAP_PX;
    case "left":
      return rect.left - frame.x - TOOLTIP_GAP_PX;
    case "right":
      return frame.x + frame.width - rect.right - TOOLTIP_GAP_PX;
  }
}

/** The side opposite `placement` (the only flip tooltips ever need). */
function oppositeSide(placement: TooltipPlacement): TooltipPlacement {
  switch (placement) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

/**
 * Flip a top↔bottom / left↔right preference when the requested side
 * cannot hold the measured popup inside the popup viewport's gutter but
 * the opposite side can — same criterion as HkPopover's autoFlip, so the
 * surfaces rule their geometry identically. The popup viewport is the
 * full window minus the app-chrome band the host configured
 * (popupBounds), so a tooltip anchored on the first row under a custom
 * title bar flips below its trigger instead of pinning over the strip.
 * Returns the placement to use.
 */
export function resolveTooltipFlip(
  rect: DOMRect,
  placement: TooltipPlacement,
  popup: { width: number; height: number },
  frame: PopupViewportRect,
  gutter: number,
): TooltipPlacement {
  const preferred = sideSpace(rect, placement, frame);
  const need = (placement === "top" || placement === "bottom" ? popup.height : popup.width) + gutter;
  if (preferred >= need) return placement;
  const alternate = oppositeSide(placement);
  const alternateSpace = sideSpace(rect, alternate, frame);
  return alternateSpace > preferred ? alternate : placement;
}

/**
 * Position a live popup element against a trigger rect: apply the shared
 * placement style, then measure the REAL box and pull it inside the
 * viewport gutter — capping an oversized bubble, flipping the side when
 * the preferred one is starved, and shifting the remainder so no edge
 * ever crosses the gutter (the mobile/desktop --viewport-gutter token).
 * Fellow visible tooltips in the popup's home are dodged too: the box
 * shifts along the cross axis, flips to the alternate side, or both —
 * never leaving the gutter (runtime/tooltipCollision.ts).
 *
 * Without layout (happy-dom/jsdom, hidden popups) measurement reports a
 * zero rect and the call degrades to exactly the pure
 * tooltipPositionStyle output — the clamps are additive, never
 * load-bearing for the base anchor math.
 */
export function applyTooltipPosition(
  popup: HTMLElement,
  rect: DOMRect,
  placement: TooltipPlacement,
  maxWidth?: string,
): void {
  // Fresh base every call: a previous show's caps (maxWidth/maxHeight)
  // must not leak into this one's box.
  const applyBase = (side: TooltipPlacement) => {
    popup.style.maxWidth = maxWidth ?? "";
    popup.style.maxHeight = "";
    popup.style.overflow = "";
    Object.assign(popup.style, tooltipPositionStyle(rect, side, maxWidth));
  };
  applyBase(placement);

  const box = popup.getBoundingClientRect();
  if (!(box.width > 0 && box.height > 0)) return; // no layout — pure base stands

  // The popup viewport: the window minus the app-chrome band the host
  // configured (a frameless shell's title bar), full-window when none —
  // in which case every number below is exactly the raw-window math.
  const frame = popupViewportRect();
  const gutter = viewportGutterPx();
  const z = ancestorZoom(popup);

  // Cap a bubble that cannot fit between the gutters: max-width reflows
  // the text (break-word wraps it), max-height clips the pathological
  // viewport-tall title (tooltips are pointer-events: none — scrolling
  // one is unreachable, so clipping beats spilling past the edge). The
  // caps live in their own writer because the FLIP below rewrites the
  // base style — without re-applying them, the flipped side would
  // measure and pin the UNCAPPED box and spill past the opposite edge.
  let capW = "";
  let capH = "";
  let clip = false;
  // Floor at 0: a band so tight the gutters overrun the frame must not
  // write negative (invalid) inline lengths — the cap degrades to 0 and
  // collapses the bubble, the honest reading of an impossible frame.
  const maxW = Math.max(0, frame.width - 2 * gutter);
  const maxH = Math.max(0, frame.height - 2 * gutter);
  if (box.width > maxW) {
    capW = `${maxW / z}px`;
  }
  if (box.height > maxH) {
    capH = `${maxH / z}px`;
    clip = true;
  }
  const applyCaps = () => {
    if (capW) popup.style.maxWidth = capW;
    if (capH) {
      popup.style.maxHeight = capH;
      popup.style.overflow = "hidden";
    }
  };

  let measured = box;
  if (capW || capH) {
    applyCaps();
    measured = popup.getBoundingClientRect();
  }

  const side = resolveTooltipFlip(rect, placement, measured, frame, gutter);
  let final = measured;
  if (side !== placement) {
    applyBase(side);
    applyCaps(); // caps survive the flip — they belong to the box, not the side
    final = popup.getBoundingClientRect();
  }

  // The viewport gutter for a measured box, as visual-px deltas onto the
  // written anchor.
  const gutterShift = (box: DOMRect) => ({
    dx: clampWithGutter(box.left - frame.x, box.width, frame.width, gutter) - (box.left - frame.x),
    dy: clampWithGutter(box.top - frame.y, box.height, frame.height, gutter) - (box.top - frame.y),
  });
  let shift = gutterShift(final);

  // ── tooltip-vs-tooltip collision (runtime/tooltipCollision.ts) ──────
  // Fellow visible tooltips sharing the popup's home are obstacles: the
  // newcomer yields (first shown keeps its anchored spot) along a
  // preference ladder — keep the side (cross-axis dodge), else flip and
  // dodge there; the first candidate with ZERO overlap wins, else the
  // least-overlapping one does (the dodge enforces the 8px clearance,
  // scoring only asks zero raw overlap — a 3px graze scores 0 and needs
  // no move). Every candidate is gutter-clamped FIRST, so a dodge can
  // never trade a tooltip overlap for an off-screen bubble. An author
  // stacking popups on purpose opts a tooltip out with
  // data-hk-tooltip-overlap and none of this runs for it — an exempt
  // mover keeps its anchored spot and an exempt sibling never blocks.
  const obstacles = popup.hasAttribute(TOOLTIP_OVERLAP_ATTR)
    ? []
    : collectTooltipObstacles(popup);
  if (obstacles.length > 0) {
    const horizontal = side === "top" || side === "bottom";
    const placed: TooltipRect = {
      left: final.left + shift.dx,
      top: final.top + shift.dy,
      width: final.width,
      height: final.height,
    };
    // Nearest cross-axis offset that parks the box the clearance away
    // from every obstacle, inside the gutter-clamped range.
    const dodge = (box: TooltipRect): number | null => {
      const p = horizontal ? box.left : box.top;
      const size = horizontal ? box.width : box.height;
      const lo = horizontal ? frame.x + gutter : frame.y + gutter;
      const hi = (horizontal ? frame.x + frame.width : frame.y + frame.height) - size - gutter;
      return clearCrossShift(
        p,
        size,
        obstacles.map((o) => ({
          lo: (horizontal ? o.left : o.top) - TOOLTIP_COLLIDE_CLEARANCE_PX,
          hi: (horizontal ? o.left + o.width : o.top + o.height) + TOOLTIP_COLLIDE_CLEARANCE_PX,
        })),
        lo,
        hi,
      );
    };
    type Candidate = { rect: TooltipRect; side: TooltipPlacement; dx: number; dy: number };
    let best: Candidate = { rect: placed, side, dx: shift.dx, dy: shift.dy };
    let bestScore = tooltipOverlapArea(best.rect, obstacles);
    const move = dodge(placed);
    if (move !== null && move !== 0) {
      const dodged: Candidate = horizontal
        ? { rect: { ...placed, left: placed.left + move }, side, dx: shift.dx + move, dy: shift.dy }
        : { rect: { ...placed, top: placed.top + move }, side, dx: shift.dx, dy: shift.dy + move };
      const score = tooltipOverlapArea(dodged.rect, obstacles);
      if (score < bestScore) {
        best = dodged;
        bestScore = score;
      }
    }
    // The alternate side only enters the ladder when the anchored one
    // cannot be made clear — realizing it costs two style rewrites and
    // a forced layout, all wasted when the dodge already scored zero.
    let realized: TooltipPlacement | null = null;
    if (bestScore > 0) {
      const alternate = oppositeSide(side);
      applyBase(alternate);
      applyCaps();
      realized = alternate;
      const altBox = popup.getBoundingClientRect();
      const alt = gutterShift(altBox);
      const altPlaced: TooltipRect = {
        left: altBox.left + alt.dx,
        top: altBox.top + alt.dy,
        width: altBox.width,
        height: altBox.height,
      };
      const altCandidate: Candidate = { rect: altPlaced, side: alternate, dx: alt.dx, dy: alt.dy };
      const altScore = tooltipOverlapArea(altPlaced, obstacles);
      if (altScore < bestScore) {
        best = altCandidate;
        bestScore = altScore;
      }
      const altMove = dodge(altPlaced);
      if (altMove !== null && altMove !== 0) {
        const altDodged: Candidate = horizontal
          ? { rect: { ...altPlaced, left: altPlaced.left + altMove }, side: alternate, dx: alt.dx + altMove, dy: alt.dy }
          : { rect: { ...altPlaced, top: altPlaced.top + altMove }, side: alternate, dx: alt.dx, dy: alt.dy + altMove };
        const altDodgedScore = tooltipOverlapArea(altDodged.rect, obstacles);
        if (altDodgedScore < bestScore) {
          best = altDodged;
          bestScore = altDodgedScore;
        }
      }
    }
    // The alternate realize above left ITS base in the inline style;
    // rewind when the winner is the original side. The rewrite must
    // carry the caps — they belong to the box, not the side.
    if (realized !== null && best.side !== realized) {
      applyBase(side);
      applyCaps();
    }
    shift = { dx: best.dx, dy: best.dy };
  }

  // Shift whatever is left over (centered under a near-edge trigger, the
  // flipped side, a cap, a collision dodge) so both edges sit inside the
  // gutter — measured
  // against the popup viewport, so the gutter rides just inside the
  // app-chrome band rather than inside the raw window edge. The clamp is
  // computed frame-relative and re-based onto the frame origin (with no
  // band configured the origin is 0 and this is the plain gutter clamp).
  // The delta is measured in root visual px but the written coordinates
  // are local (divided by the cumulative zoom) AND offset from the box
  // edge by the placement transform (translate(-50%) makes style.left
  // the box CENTER) — so the shift adds onto the current written value
  // instead of the measured edge.
  const dx = shift.dx;
  const dy = shift.dy;
  if (dx !== 0 || dy !== 0) {
    const curLeft = Number.parseFloat(popup.style.left) || 0;
    const curTop = Number.parseFloat(popup.style.top) || 0;
    popup.style.left = `${curLeft + dx / z}px`;
    popup.style.top = `${curTop + dy / z}px`;
  }
}
