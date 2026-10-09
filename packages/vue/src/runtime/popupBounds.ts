// App-chrome popup bounds — the developer-facing inset that shrinks the
// region every JS-positioned popup may occupy.
//
// A desktop shell routinely reserves part of the window for chrome a
// popup must never cover. The report that motivated this module: a
// frameless Tauri app draws its own title bar and anchors tooltips on
// the first row beneath it — every positioner here measured against the
// raw window plus the gutter alone, so those tooltips pinned up over the
// caption strip. The host declares the occupied band ONCE and every
// positioner (both tooltip surfaces, HkPopover, HkSelectPanel / HkMenu
// cascades, the context-menu quadrant pick) centers, flips and clamps
// inside the remainder. The configuration is per JS realm — a Tauri
// tray or overlay window is its own realm and simply configures nothing.
//
// The pattern is the one --viewport-gutter established: one magnitude
// shared by declarative consumers and the JS math. configurePopupInsets
// mirrors the four numbers onto :root as
// `--hk-popup-inset-{top,right,bottom,left}` (the useSafeArea variable
// convention), and popupViewportRect() is the JS side of the same
// contract — the window rect inset by the band. Values are root visual
// px (measure chrome with getBoundingClientRect), deliberately NOT
// zoom-corrected — same story as the gutter.
//
// This is developer configuration, not user theming: the shell sets it
// at bootstrap from its real layout and re-sets it when that layout
// changes (maximize, a phone-layout bar raising). null clears the band.
// Scope: the JS-positioned floating surfaces honor the band today
// (tooltips, popovers, select/menu popouts, context-menu quadrants);
// CSS-positioned overlays (modals, drawers, bottom sheets) do not yet —
// a bottom band will underlap them until they read the mirrored vars.
//
// AI disclosure: drafted by GLM via the ZCode agent, directed and
// reviewed by langyo — SySL-1.0 §2.3.
import { reportHkRuntime } from "./registry";

/** The app-chrome band: how much of the window each side reserves. */
export interface PopupInsets {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/** The band with every side resolved (unset sides are 0). */
export interface ResolvedPopupInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The :root variables the insets mirror onto (useSafeArea convention). */
export const POPUP_INSET_VARS: Record<keyof ResolvedPopupInsets, string> = {
  top: "--hk-popup-inset-top",
  right: "--hk-popup-inset-right",
  bottom: "--hk-popup-inset-bottom",
  left: "--hk-popup-inset-left",
};

/** The region popups may occupy, in root visual px. */
export interface PopupViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

let current: Readonly<ResolvedPopupInsets> = { top: 0, right: 0, bottom: 0, left: 0 };
let runtimeReport: ReturnType<typeof reportHkRuntime> | null = null;

function sanitize(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function reportOnce(): void {
  if (runtimeReport) return;
  runtimeReport = reportHkRuntime("popupBounds", {
    kind: "context",
    description:
      "App-chrome popup bounds — the inset band every popup positions inside",
    read: () => ({ insets: { ...current }, viewport: popupViewportRect() }),
    write: (op) => {
      if (op.type === "configure") {
        configurePopupInsets((op.insets as PopupInsets | null) ?? null);
        return;
      }
      throw new Error(`unknown popupBounds write op: ${op.type}`);
    },
  });
}

/**
 * Declare the app-chrome band popups must stay out of, in root visual px
 * (measure the chrome with getBoundingClientRect). Re-callable — the new
 * insets REPLACE the old ones wholesale, so a shell re-declares on every
 * layout change; null clears the band. Non-finite and non-positive sides
 * sanitize to 0, so a mis-measured bar degrades to "no band on that
 * side" instead of corrupting the frame.
 */
export function configurePopupInsets(insets: PopupInsets | null): void {
  current = Object.freeze(
    insets
      ? {
          top: sanitize(insets.top),
          right: sanitize(insets.right),
          bottom: sanitize(insets.bottom),
          left: sanitize(insets.left),
        }
      : { top: 0, right: 0, bottom: 0, left: 0 },
  );
  if (typeof document !== "undefined") {
    const rootStyle = document.documentElement.style;
    for (const side of Object.keys(POPUP_INSET_VARS) as Array<keyof ResolvedPopupInsets>) {
      // Zeroes are WRITTEN, not removed, so re-configuring can never
      // leave a stale larger value on a side the new band dropped.
      rootStyle.setProperty(POPUP_INSET_VARS[side], `${current[side]}px`);
    }
  }
  reportOnce();
  runtimeReport?.pulse();
}

/** The currently configured band — zeros when nothing was configured. */
export function popupInsets(): Readonly<ResolvedPopupInsets> {
  return current;
}

/**
 * The region popups may occupy: the window inset by the configured band.
 * Width and height floor at 0 — an over-wide band collapses the frame,
 * and every clamp then pins to its leading edge, the honest answer to
 * an impossible configuration.
 */
export function popupViewportRect(win?: Window | null): PopupViewportRect {
  reportOnce();
  if (typeof window === "undefined") return { x: 0, y: 0, width: 0, height: 0 };
  const w = win ?? window;
  const x = Math.min(current.left, w.innerWidth);
  const y = Math.min(current.top, w.innerHeight);
  return {
    x,
    y,
    width: Math.max(0, w.innerWidth - x - Math.min(current.right, w.innerWidth - x)),
    height: Math.max(0, w.innerHeight - y - Math.min(current.bottom, w.innerHeight - y)),
  };
}
