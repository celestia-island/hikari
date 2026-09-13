// Shared floating-tooltip geometry for HkTooltip (component) and the
// document-level tooltip bridge (runtime/tooltipBridge.ts). One placement
// switch, one zoom story: whatever hosts a popup against a trigger rect
// positions it through this helper so the two surfaces can never drift.
import type { CSSProperties } from "vue";
import { ancestorZoom } from "./cssZoom";
import { clampWithGutter, viewportGutterPx } from "./viewportGutter";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

/** Gap between the trigger rect and the popup, in root visual px. */
export const TOOLTIP_GAP_PX = 8;

/**
 * Build the inline style that pins a `position: fixed` popup to one side
 * of a trigger rect.
 *
 * The popup teleports to <body> — inside any root CSS zoom subtree —
 * while `rect` is already in the root visual space (standardized zoom
 * reports ancestor zoom applied). The browser scales the tooltip's local
 * px back up at paint, so the visual rect values must be written divided
 * by the cumulative zoom or the tooltip drifts zoom× off its trigger
 * (chest's root-level manual DPI scale).
 *
 * `width: max-content` is the position-independence contract (same rule
 * as .hk-popover-panel): a fixed element otherwise shrink-to-fits against
 * `viewport - left`, so a trigger near the viewport edge squeezes the
 * bubble down to the leftover space — the vertical "跳转到日期" one-glyph
 * column on mobile. max-content sizes the box to its text wherever it
 * sits; applyTooltipPosition then clamps it back into the viewport.
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

/** Space left on each side of the trigger rect, minus the trigger gap. */
function sideSpace(
  rect: DOMRect,
  side: TooltipPlacement,
  vw: number,
  vh: number,
): number {
  switch (side) {
    case "top":
      return rect.top - TOOLTIP_GAP_PX;
    case "bottom":
      return vh - rect.bottom - TOOLTIP_GAP_PX;
    case "left":
      return rect.left - TOOLTIP_GAP_PX;
    case "right":
      return vw - rect.right - TOOLTIP_GAP_PX;
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
 * cannot hold the measured popup inside the viewport gutter but the
 * opposite side can — same criterion as HkPopover's autoFlip, so the
 * surfaces rule their geometry identically. Returns the placement to use.
 */
export function resolveTooltipFlip(
  rect: DOMRect,
  placement: TooltipPlacement,
  popup: { width: number; height: number },
  vw: number,
  vh: number,
  gutter: number,
): TooltipPlacement {
  const preferred = sideSpace(rect, placement, vw, vh);
  const need = (placement === "top" || placement === "bottom" ? popup.height : popup.width) + gutter;
  if (preferred >= need) return placement;
  const alternate = oppositeSide(placement);
  const alternateSpace = sideSpace(rect, alternate, vw, vh);
  return alternateSpace > preferred ? alternate : placement;
}

/**
 * Position a live popup element against a trigger rect: apply the shared
 * placement style, then measure the REAL box and pull it inside the
 * viewport gutter — capping an oversized bubble, flipping the side when
 * the preferred one is starved, and shifting the remainder so no edge
 * ever crosses the gutter (the mobile/desktop --viewport-gutter token).
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

  const vw = window.innerWidth;
  const vh = window.innerHeight;
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
  const maxW = vw - 2 * gutter;
  const maxH = vh - 2 * gutter;
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

  const side = resolveTooltipFlip(rect, placement, measured, vw, vh, gutter);
  let final = measured;
  if (side !== placement) {
    applyBase(side);
    applyCaps(); // caps survive the flip — they belong to the box, not the side
    final = popup.getBoundingClientRect();
  }

  // Shift whatever is left over (centered under a near-edge trigger, the
  // flipped side, a cap) so both edges sit inside the gutter. The delta
  // is measured in root visual px but the written coordinates are local
  // (divided by the cumulative zoom) AND offset from the box edge by the
  // placement transform (translate(-50%) makes style.left the box
  // CENTER) — so the shift adds onto the current written value instead
  // of the measured edge.
  const dx = clampWithGutter(final.left, final.width, vw, gutter) - final.left;
  const dy = clampWithGutter(final.top, final.height, vh, gutter) - final.top;
  if (dx !== 0 || dy !== 0) {
    const curLeft = Number.parseFloat(popup.style.left) || 0;
    const curTop = Number.parseFloat(popup.style.top) || 0;
    popup.style.left = `${curLeft + dx / z}px`;
    popup.style.top = `${curTop + dy / z}px`;
  }
}
