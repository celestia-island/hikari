// Shared floating-tooltip geometry for HkTooltip (component) and the
// document-level tooltip bridge (runtime/tooltipBridge.ts). One placement
// switch, one zoom story: whatever hosts a popup against a trigger rect
// positions it through this helper so the two surfaces can never drift.
import type { CSSProperties } from "vue";
import { ancestorZoom } from "./cssZoom";

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
 */
export function tooltipPositionStyle(
  rect: DOMRect,
  placement: TooltipPlacement,
  maxWidth?: string,
): CSSProperties {
  const z = ancestorZoom(document.body);
  const local = (v: number) => `${v / z}px`;
  const style: CSSProperties = {};

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
