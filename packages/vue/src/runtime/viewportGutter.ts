// Shared viewport-edge gutter — the one number every floating layer keeps
// between itself and the viewport edge.
//
// HkPopover / HkSelectPanel / HkMenu each used to carry a private
// `VIEWPORT_PAD = 8` with no desktop variant, and HkTooltip carried no
// clamp at all (a tooltip anchored near the right edge was squeezed to
// the leftover shrink-to-fit space — one or two glyphs per line). This
// module replaces all of them: the magnitude lives in the
// `--viewport-gutter` L2 token (scale.scss, 16px desktop / 8px mobile via
// the <768px media query), and the JS side reads that SAME token so the
// CSS caps (`calc(100vw - 2 * var(--viewport-gutter))`) and the clamp
// math can never drift apart. Hosts that never load the scale sheet fall
// back to the same numbers derived from innerWidth.
//
// Deliberately NOT zoom-corrected: the consumers (HkPopover's visual-px
// clamp, tooltipPosition's visual-space shift) all work in root visual
// coordinates and pass the value straight through, matching the 8px
// behavior this replaces. A one-zoom-step error in an 8–16px gutter is
// invisible; a missing clamp was not.

/** The L2 token carrying the gutter (declared in scale.scss). */
export const VIEWPORT_GUTTER_VAR = "--viewport-gutter";

/** Fallback gutter on mobile-width viewports (innerWidth < 768). */
export const MOBILE_GUTTER_PX = 8;

/** Fallback gutter on desktop-width viewports, and the SSR answer. */
export const DESKTOP_GUTTER_PX = 16;

/** The breakpoint the CSS media query in scale.scss mirrors. */
export const GUTTER_MOBILE_MAX_WIDTH = 768;

/**
 * The viewport gutter in CSS px. Reads `--viewport-gutter` off
 * `:root` when it resolves to a positive px length (the shipped scale
 * sheet always declares it), else falls back to 8px below the 768px
 * breakpoint and 16px at or above it — the exact numbers the media
 * query writes.
 */
export function viewportGutterPx(win?: Window | null): number {
  if (typeof window === "undefined") return DESKTOP_GUTTER_PX;
  const w = win ?? window;
  try {
    const raw = w
      .getComputedStyle(w.document.documentElement)
      .getPropertyValue(VIEWPORT_GUTTER_VAR)
      .trim();
    // px-only by contract: a var() can reach us unresolved ("1rem" would
    // parseFloat to 1) and a garbage value must never shrink the gutter.
    if (raw.endsWith("px")) {
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
  } catch {
    /* no DOM — fall through to the breakpoint fallback */
  }
  return w.innerWidth < GUTTER_MOBILE_MAX_WIDTH ? MOBILE_GUTTER_PX : DESKTOP_GUTTER_PX;
}

/**
 * Clamp a cross/main-axis coordinate so a box of `size` px stays inside
 * `[gutter, viewportSize - gutter]`. This is the clamp shape every
 * anchored surface shared (HkPopover's cross + main axis, HkSelectPanel's
 * top/left): below the gutter when it fits, else pinned to the gutter.
 */
export function clampWithGutter(
  value: number,
  size: number,
  viewportSize: number,
  gutter: number,
): number {
  return Math.max(gutter, Math.min(value, viewportSize - size - gutter));
}
