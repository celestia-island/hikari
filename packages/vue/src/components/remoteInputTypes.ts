// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

/**
 * Remote-input shared vocabulary — the types and pure helpers the
 * remote-control components (HkRemoteInputDock, HkVirtualCursor, the
 * touch-gesture and virtual-pointer composables) speak, and the
 * contract a HOST (e.g. shittim-chest's RemoteDesktopCanvas) wires to
 * its transport.
 *
 * The button-mask convention is the UI mask the node-console canvas
 * already speaks on its wire: bit0 left, bit1 MIDDLE, bit2 right. It
 * is deliberately NOT the VNC mask (bit1 right) — hosts that ride a
 * VNC-shaped transport remap at their boundary, exactly like
 * useDesktopSession.sendPointer does; keeping the UI mask here means
 * the components compose with the existing canvas handlers verbatim.
 */

/** UI button mask: bit0 left, bit1 middle, bit2 right. */
export const MASK_LEFT = 0b001 as const;
export const MASK_MIDDLE = 0b010 as const;
export const MASK_RIGHT = 0b100 as const;
/**
 * The minimal action surface a dock needs from the host. The host
 * closes over its own pointer state (the virtual pointer's current
 * position, or its own equivalent) — the components never own
 * coordinates, only button bits and wheel notches.
 */
export interface RemoteButtonActions {
  /**
   * The PAD's OWN held bits (its absolute mask), called on every pad
   * transition. This is NOT the global pressed set: the host MUST
   * union it with every other holder (a virtual pointer's held state,
   * another surface's hold) before sending the wire frame —
   * forwarding it verbatim would release a co-resident hold's bit
   * (one holder per bit, the same law the cursor's lobes enforce
   * structurally).
   */
  setButtons(padHeldMask: number): void;
  /**
   * Vertical wheel notches at the host's current pointer position;
   * positive scrolls up/away from the operator.
   */
  wheel(units: number): void;
}

/** The remote screen's pixel coordinate space the pointer lives in. */
export interface RemoteViewport {
  width: number;
  height: number;
}

/** Live virtual-pointer state (remote pixels + UI button mask). */
export interface VirtualPointerState {
  x: number;
  y: number;
  buttons: number;
}

/** Remote pixels per display pixel along ONE axis (degenerate boxes
 *  stay 1:1 instead of exploding). Callers scale each axis with its
 *  own pair — a fill/cover transform stretches them differently. */
export function displayScale(remotePx: number, displayPx: number): number {
  if (displayPx <= 0 || remotePx <= 0) return 1;
  return remotePx / displayPx;
}

/** Clamp a point into the remote viewport (inclusive pixel edges). */
export function clampToViewport(
  x: number,
  y: number,
  viewport: RemoteViewport,
): { x: number; y: number } {
  const maxX = Math.max(0, Math.floor(viewport.width) - 1);
  const maxY = Math.max(0, Math.floor(viewport.height) - 1);
  return {
    x: Math.min(Math.max(0, Math.round(x)), maxX),
    y: Math.min(Math.max(0, Math.round(y)), maxY),
  };
}

/** Wheel notches from a display-pixel vertical scroll (the canvas
 * coefficient: 53 display px per notch, positive scrolls up). */
export function wheelNotches(displayDy: number): number {
  return Math.round(-displayDy / 53);
}

/** A tap: quick (≤ 250 ms) and still (< 8 display px travelled). */
export const TAP_MAX_MS = 250;
export const TAP_MAX_TRAVEL_PX = 8;

/** A long-press: held ≥ 500 ms and still (< 8 display px travelled). */
export const LONG_PRESS_MIN_MS = 500;

/** Two-finger scroll: 53 display px of averaged travel per notch. */
export const TWO_FINGER_PX_PER_NOTCH = 53;
