// AI-generated: developed with the DeepSeek Harness agent (model GLM-5.3 Flash); human-directed.

import { onBeforeUnmount, watch, type Ref } from "vue";

import {
  LONG_PRESS_MIN_MS,
  TAP_MAX_MS,
  TAP_MAX_TRAVEL_PX,
  TWO_FINGER_PX_PER_NOTCH,
  wheelNotches,
} from "../components/remoteInputTypes";

/**
 * useRemoteTouchGestures — the touch grammar of the virtual-mouse
 * mode (2026-11-15 user direction, the industry convention: ToDesk /
 * RD Client posture):
 *
 * - single finger DRAG → the virtual pointer MOVES (relative, touchpad
 *   semantics — the finger is not the pointer);
 * - single finger TAP (≤ 250 ms, < 8 px travel) → left click;
 * - single finger LONG-PRESS (≥ 500 ms, < 8 px travel) → right click;
 * - two fingers scrolling → wheel notches (53 px per notch, fingers up
 *   = scroll up).
 *
 * The recogniser speaks DISPLAY pixels and reports through the
 * caller's handlers; a host wires them onto a `useVirtualPointer`
 * (nudge/tap/press/wheel). Pointer-type mouse/pen events are not
 * handled here at all — those users keep the direct-absolute grammar.
 *
 * `enabled` gates the whole grammar: bind it to the mode switch so the
 * same surface can host the direct grammar when the mode is off.
 */
export interface TouchGestureHandlers {
  /** Relative drag in display px (already incremental). */
  onDelta(dx: number, dy: number): void;
  /** Quick tap — mask is the button bit set (left by convention). */
  onTap(mask: number): void;
  /** Long-press — right click by convention. */
  onLongPress(mask: number): void;
  /** Two-finger vertical scroll → wheel notches (positive = up). */
  onWheel(units: number): void;
}

export function useRemoteTouchGestures(
  host: Ref<HTMLElement | null>,
  handlers: TouchGestureHandlers,
  enabled: Ref<boolean>,
) {
  interface TouchRecord {
    x: number;
    y: number;
    startX: number;
    startY: number;
    startAt: number;
  }

  const active = new Map<number, TouchRecord>();
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  let wheelBaseY: number | null = null;

  function clearLongPress() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  /** Drop any in-flight gesture without firing its tail. */
  function reset() {
    active.clear();
    clearLongPress();
    longPressFired = false;
    wheelBaseY = null;
  }

  function onStart(e: TouchEvent) {
    if (!enabled.value) return;
    if (e.touches.length === 2) {
      // Second finger lands: the gesture becomes a wheel — the
      // single-finger timers stand down.
      clearLongPress();
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      wheelBaseY = (a.clientY + b.clientY) / 2;
      active.set(a.identifier, rec(a));
      active.set(b.identifier, rec(b));
      return;
    }
    if (e.touches.length !== 1) {
      reset(); // 3+ fingers: not our grammar
      return;
    }
    const t = e.touches[0]!;
    active.set(t.identifier, rec(t));
    longPressFired = false;
    clearLongPress();
    longPressTimer = setTimeout(() => {
      // The timer is the one path that fires OUTSIDE an event entry —
      // re-check the gate so a disarm between events stays disarmed.
      if (!enabled.value) return;
      const t0 = [...active.values()][0];
      if (!t0 || active.size !== 1) return;
      if (travelOf(t0) < TAP_MAX_TRAVEL_PX) {
        longPressFired = true;
        handlers.onLongPress(0b100); // right click
      }
    }, LONG_PRESS_MIN_MS);
  }

  function rec(t: Touch): TouchRecord {
    return { x: t.clientX, y: t.clientY, startX: t.clientX, startY: t.clientY, startAt: Date.now() };
  }

  function travelOf(t: TouchRecord) {
    return Math.hypot(t.x - t.startX, t.y - t.startY);
  }

  function onMove(e: TouchEvent) {
    if (!enabled.value || active.size === 0) return;
    if (e.touches.length === 2 && wheelBaseY !== null) {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      const midY = (a.clientY + b.clientY) / 2;
      const fingersUp = wheelBaseY - midY; // >0: fingers moved up
      if (Math.abs(fingersUp) >= TWO_FINGER_PX_PER_NOTCH) {
        // The shared coefficient (wheelNotches); the threshold keeps
        // sub-notch jitter from re-triggering, and the consumed travel
        // resets the base so the residue never double-counts.
        const units = wheelNotches(-fingersUp);
        if (units !== 0) handlers.onWheel(units);
        wheelBaseY = midY;
      }
      return;
    }
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    const prev = active.get(t.identifier);
    if (!prev) return;
    const dx = t.clientX - prev.x;
    const dy = t.clientY - prev.y;
    prev.x = t.clientX;
    prev.y = t.clientY;
    // Moving cancels the pending long-press; after a FIRED long-press
    // a further drag is dead travel (the click already happened).
    if (travelOf(prev) >= TAP_MAX_TRAVEL_PX) clearLongPress();
    if (longPressFired) return;
    handlers.onDelta(dx, dy);
  }

  function onEnd(e: TouchEvent) {
    if (!enabled.value) return;
    if (wheelBaseY !== null) {
      if (e.touches.length < 2) reset(); // a wheel ends when a finger lifts
      return;
    }
    if (e.changedTouches.length === 1 && active.size === 1) {
      const t = e.changedTouches[0]!;
      const rec = active.get(t.identifier);
      clearLongPress();
      if (rec) {
        const held = Date.now() - rec.startAt;
        if (!longPressFired && travelOf(rec) < TAP_MAX_TRAVEL_PX && held <= TAP_MAX_MS) {
          handlers.onTap(0b001); // left click
        }
      }
    }
    reset();
  }

  function onCancel() {
    reset();
  }

  let unbind: (() => void) | null = null;
  let boundEl: HTMLElement | null = null;
  let prevTouchAction: string | null = null;

  /** Claim the touch stream: without this the browser takes the
   *  two-finger moves as pinch-zoom and cancels our touches before a
   *  single notch lands (useContextMenu documents the same trap).
   *  Only while ENABLED — a mounted-but-off grammar must not suppress
   *  the host's native pinch/pan (the R5 finding). */
  function claimTouchAction() {
    const el = boundEl;
    if (!el || !enabled.value || prevTouchAction !== null) return;
    prevTouchAction = el.style.touchAction || "";
    el.style.touchAction = "none";
  }
  function releaseTouchAction() {
    const el = boundEl;
    if (!el || prevTouchAction === null) return;
    // Restore the host's own value; an empty prior value clears the
    // property (assigning "" is a no-op in some engines' style sets).
    if (prevTouchAction === "") {
      el.style.removeProperty("touch-action");
    } else {
      el.style.touchAction = prevTouchAction;
    }
    prevTouchAction = null;
  }

  function attach(el: HTMLElement | null) {
    unbind?.();
    unbind = null;
    // Release with the OLD element still bound (the previous host's
    // touch-action must go back before the pointer moves on).
    releaseTouchAction();
    boundEl = el;
    // A stale half-gesture (a finger left over from a disabled or
    // rebound session) must not poison the next one's bookkeeping.
    reset();
    if (!el) return;
    claimTouchAction();
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onCancel);
    unbind = () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }

  const stop = watch(host, attach, { immediate: true });
  // The gate stops the grammar AT the flip, not after the next event;
  // the touch claim follows it — disarmed restores the host's native
  // gestures, re-armed reclaims them. flush: 'sync' so a disarm→rearm
  // bounce inside one tick still resets the stale gesture's tail.
  const stopEnabled = watch(
    enabled,
    (on) => {
      if (!on) {
        reset();
        releaseTouchAction();
      } else {
        claimTouchAction();
      }
    },
    { flush: "sync" },
  );
  onBeforeUnmount(() => {
    stop();
    stopEnabled();
    unbind?.();
    releaseTouchAction();
    reset();
  });

  return { reset };
}
