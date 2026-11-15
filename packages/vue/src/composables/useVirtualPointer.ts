// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

import { reactive, watch, type Ref } from "vue";

import {
  clampToViewport,
  displayScale,
  type RemoteViewport,
  type VirtualPointerState,
} from "../components/remoteInputTypes";

/**
 * useVirtualPointer — the virtual-mouse state machine (2026-11-15
 * remote-control direction: a pointer that MOVES with the finger
 * instead of BEING the finger).
 *
 * The pointer lives in REMOTE pixels inside the viewport; gestures and
 * dock buttons mutate it through its transitions (nudge / press /
 * click / wheel), and every transition reports through the caller's
 * sinks — the composable never talks to a transport itself, so the
 * same state feeds a wire, a HUD, or a test.
 *
 * Two button semantics, deliberately distinct (the R2 ownership
 * finding): `press(mask, down)` is a HELD button (dock pads, cursor
 * lobes — persistent state); `click(mask)` is a TRANSIENT click (a
 * gesture tap / long-press) that rides ALONGSIDE whatever is held —
 * the down frame ORs the bit in, the up frame restores the held
 * baseline, and `state.buttons` is never touched. A tap can therefore
 * never silently release a button another surface holds.
 *
 * Consumers compose:
 * - touch gestures (`useRemoteTouchGestures`) call `nudge`/`click`/
 *   `wheel` with DISPLAY-pixel deltas plus the display box, and the
 *   composable rescales into remote pixels (per-axis: a fill/cover
 *   transform stretches differently on each axis);
 * - the dock (HkRemoteInputDock) drives `press` through a
 *   RemoteButtonActions adapter the host builds from this state.
 */
export interface VirtualPointerSinks {
  /** Absolute pointer update (remote px + full UI mask) on every
   *  position or button transition. */
  pointer(x: number, y: number, buttons: number): void;
  /** Wheel notches (positive = up) at the pointer's position. */
  wheel(units: number): void;
}

export interface UseVirtualPointer {
  /** Live state (reactive; remote px + UI mask). */
  state: VirtualPointerState;
  /** Move by a display-pixel delta inside a display box, rescaled
   *  per-axis into remote px. */
  nudge(displayDx: number, displayDy: number, display: { width: number; height: number }): void;
  /** Press and release a mask (tap-click); reports both transitions. */
  tap(mask: number): void;
  /** A TRANSIENT click alongside held buttons (see the docblock). */
  click(mask: number): void;
  /** Press (down=true) or release one mask's buttons. */
  press(mask: number, down: boolean): void;
  /** Wheel notches at the pointer's position. */
  wheel(units: number): void;
  /** Viewport changed (frame size arrived): re-center if the pointer
   *  left the new bounds. */
  setViewport(vp: RemoteViewport): void;
}

export function useVirtualPointer(
  viewport: Ref<RemoteViewport>,
  sinks: VirtualPointerSinks,
): UseVirtualPointer {
  const state: VirtualPointerState = reactive({
    x: Math.max(0, Math.floor(viewport.value.width / 2)),
    y: Math.max(0, Math.floor(viewport.value.height / 2)),
    buttons: 0,
  });

  function report() {
    sinks.pointer(state.x, state.y, state.buttons);
  }

  // Keep the pointer inside the viewport as frames resize (a pointer
  // stranded outside the new bounds could never reach edge UI). Watch
  // the DIMENSIONS: hosts commonly mutate the viewport object in place
  // (the ResizeObserver shape), which a reference watch never sees.
  watch(
    () => [viewport.value.width, viewport.value.height],
    () => {
      const clamped = clampToViewport(state.x, state.y, viewport.value);
      if (clamped.x !== state.x || clamped.y !== state.y) {
        state.x = clamped.x;
        state.y = clamped.y;
        // The wire must learn the new position too — a silent clamp
        // would leave the remote cursor outside the visible screen.
        report();
      }
    },
  );

  function nudge(displayDx: number, displayDy: number, display: { width: number; height: number }) {
    // Per-axis scales: a fill/cover transform stretches each axis
    // differently; one shared scale would skew vertical sensitivity.
    const sx = displayScale(viewport.value.width, display.width);
    const sy = displayScale(viewport.value.height, display.height);
    const next = clampToViewport(
      state.x + displayDx * sx,
      state.y + displayDy * sy,
      viewport.value,
    );
    if (next.x === state.x && next.y === state.y) return;
    state.x = next.x;
    state.y = next.y;
    report();
  }

  function press(mask: number, down: boolean) {
    const next = down ? state.buttons | mask : state.buttons & ~mask;
    if (next === state.buttons) return;
    state.buttons = next;
    report();
  }

  function click(mask: number) {
    // Transient: the down frame carries held|mask, the up frame
    // restores the held baseline — held buttons survive the click.
    sinks.pointer(state.x, state.y, state.buttons | mask);
    sinks.pointer(state.x, state.y, state.buttons);
  }

  function tap(mask: number) {
    press(mask, true);
    press(mask, false);
  }

  function wheel(units: number) {
    if (units === 0) return;
    sinks.wheel(units);
  }

  function setViewport(vp: RemoteViewport) {
    const clamped = clampToViewport(state.x, state.y, vp);
    if (clamped.x !== state.x || clamped.y !== state.y) {
      state.x = clamped.x;
      state.y = clamped.y;
      report();
    }
  }

  return { state, nudge, tap, click, press, wheel, setViewport };
}
