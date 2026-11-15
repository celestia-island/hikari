// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

import { reactive, watch, type Ref } from "vue";

import {
  clampToViewport,
  type RemoteViewport,
  type VirtualPointerState,
} from "../components/remoteInputTypes";

/**
 * useVirtualPointer — the virtual-mouse state machine (2026-11-15
 * remote-control direction: a pointer that MOVES with the finger
 * instead of BEING the finger).
 *
 * The pointer lives in REMOTE pixels inside the viewport; gestures and
 * dock buttons mutate it through the only four transitions it has
 * (nudge / press / tap / wheel), and every transition reports through
 * the caller's sinks — the composable never talks to a transport
 * itself, so the same state feeds a wire, a HUD, or a test.
 *
 * Consumers compose:
 * - touch gestures (`useRemoteTouchGestures`) call `nudge`/`tap`/
 *   `wheel` with DISPLAY-pixel deltas plus the display box, and the
 *   composable rescales into remote pixels;
 * - the dock (HkRemoteInputDock) calls `press`/`wheel` through a
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
  /** Move by display-pixel delta, rescaled to remote px. */
  nudge(displayDx: number, displayDy: number, displayPx: number): void;
  /** Press and release a mask (tap-click); reports both transitions. */
  tap(mask: number): void;
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
  // stranded outside the new bounds could never reach edge UI).
  watch(
    () => viewport.value,
    (vp) => {
      const clamped = clampToViewport(state.x, state.y, vp);
      if (clamped.x !== state.x || clamped.y !== state.y) {
        state.x = clamped.x;
        state.y = clamped.y;
      }
    },
  );

  function nudge(displayDx: number, displayDy: number, displayPx: number) {
    if (displayPx <= 0 || viewport.value.width <= 0) return;
    const scale = viewport.value.width / displayPx;
    const next = clampToViewport(
      state.x + displayDx * scale,
      state.y + displayDy * scale,
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
    state.x = clamped.x;
    state.y = clamped.y;
  }

  return { state, nudge, tap, press, wheel, setViewport };
}
