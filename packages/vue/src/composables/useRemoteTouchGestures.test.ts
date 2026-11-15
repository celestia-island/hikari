import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

import { useRemoteTouchGestures } from "./useRemoteTouchGestures";


/** Dispatch a TouchEvent the recogniser sees (happy-dom carries no
 * real touch layout — the handler only reads clientX/Y and the touch
 * lists, which a synthetic TouchEvent accepts). */
function touch(el: Element, type: "touchstart" | "touchmove" | "touchend", touches: { id: number; x: number; y: number }[], changed: { id: number; x: number; y: number }[] = touches) {
  const mk = (t: { id: number; x: number; y: number }) => ({
    identifier: t.id, clientX: t.x, clientY: t.y,
  });
  const ev = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    touches: ReturnType<typeof mk>[];
    changedTouches: ReturnType<typeof mk>[];
  };
  Object.defineProperty(ev, "touches", { value: touches.map(mk) });
  Object.defineProperty(ev, "changedTouches", { value: changed.map(mk) });
  el.dispatchEvent(ev);
}

function setup() {
  const host = ref<HTMLElement | null>(document.createElement("div"));
  const enabled = ref(true);
  const h = {
    onDelta: vi.fn(),
    onTap: vi.fn(),
    onLongPress: vi.fn(),
    onWheel: vi.fn(),
  };
  const api = useRemoteTouchGestures(host, h, enabled);
  return { host, enabled, h, api, el: host.value! };
}

describe("useRemoteTouchGestures", () => {
  it("reports single-finger drags as incremental deltas", () => {
    const { el, h } = setup();
    touch(el, "touchstart", [{ id: 1, x: 100, y: 100 }]);
    touch(el, "touchmove", [{ id: 1, x: 120, y: 90 }]);
    touch(el, "touchmove", [{ id: 1, x: 125, y: 90 }]);
    expect(h.onDelta.mock.calls).toEqual([[20, -10], [5, 0]]);
  });

  it("a quick still tap is a left click", () => {
    const { el, h } = setup();
    touch(el, "touchstart", [{ id: 1, x: 50, y: 50 }]);
    touch(el, "touchend", [], [{ id: 1, x: 52, y: 51 }]); // 2.8px travel
    expect(h.onTap).toHaveBeenCalledWith(0b001);
    expect(h.onLongPress).not.toHaveBeenCalled();
  });

  it("a still long-press is a right click and kills the later tap", () => {
    vi.useFakeTimers();
    const { el, h } = setup();
    touch(el, "touchstart", [{ id: 1, x: 50, y: 50 }]);
    vi.advanceTimersByTime(600);
    expect(h.onLongPress).toHaveBeenCalledWith(0b100);
    touch(el, "touchend", [], [{ id: 1, x: 51, y: 50 }]);
    expect(h.onTap).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("a dragged touch neither taps nor long-presses", () => {
    vi.useFakeTimers();
    const { el, h } = setup();
    touch(el, "touchstart", [{ id: 1, x: 50, y: 50 }]);
    touch(el, "touchmove", [{ id: 1, x: 90, y: 50 }]); // 40px > 8px
    vi.advanceTimersByTime(600);
    touch(el, "touchend", [], [{ id: 1, x: 90, y: 50 }]);
    expect(h.onTap).not.toHaveBeenCalled();
    expect(h.onLongPress).not.toHaveBeenCalled();
    expect(h.onDelta).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("two-finger vertical scroll emits wheel notches per 53px", () => {
    const { el, h } = setup();
    touch(el, "touchstart", [{ id: 1, x: 100, y: 100 }]);
    touch(el, "touchstart", [{ id: 1, x: 100, y: 100 }, { id: 2, x: 150, y: 150 }]);
    // Fingers rise 60px together: one notch up; the consumed travel
    // resets the base (residue discarded).
    touch(el, "touchmove", [{ id: 1, x: 100, y: 40 }, { id: 2, x: 150, y: 90 }]);
    expect(h.onWheel).toHaveBeenCalledWith(1);
    expect(h.onDelta).not.toHaveBeenCalled();
  });

  it("a wheel gesture ends when a finger lifts; drag does not resume", () => {
    const { el, h } = setup();
    touch(el, "touchstart", [{ id: 1, x: 100, y: 100 }]);
    touch(el, "touchstart", [{ id: 1, x: 100, y: 100 }, { id: 2, x: 150, y: 150 }]);
    touch(el, "touchend", [{ id: 2, x: 150, y: 150 }], [{ id: 2, x: 150, y: 150 }]);
    h.onDelta.mockClear();
    touch(el, "touchmove", [{ id: 1, x: 130, y: 100 }]); // stale single finger
    expect(h.onDelta).not.toHaveBeenCalled();
  });

  it("disabled: the whole grammar is inert", () => {
    const { el, h, enabled } = setup();
    enabled.value = false;
    touch(el, "touchstart", [{ id: 1, x: 100, y: 100 }]);
    touch(el, "touchmove", [{ id: 1, x: 130, y: 100 }]);
    touch(el, "touchend", [], [{ id: 1, x: 130, y: 100 }]);
    expect(h.onDelta).not.toHaveBeenCalled();
    expect(h.onTap).not.toHaveBeenCalled();
  });

  it("disarmed MID-GESTURE: the pending long-press dies with the flip", () => {
    vi.useFakeTimers();
    const { el, h, enabled } = setup();
    touch(el, "touchstart", [{ id: 1, x: 50, y: 50 }]);
    enabled.value = false; // the mode radio flips while the finger rests
    vi.advanceTimersByTime(600);
    expect(h.onLongPress, "no right-click after the disarm").not.toHaveBeenCalled();
    // And the stale record is gone: a fresh tap works immediately.
    enabled.value = true;
    touch(el, "touchend", [], [{ id: 1, x: 51, y: 50 }]);
    expect(h.onTap).not.toHaveBeenCalled(); // the old gesture's tail — dead
    touch(el, "touchstart", [{ id: 2, x: 80, y: 80 }]);
    touch(el, "touchend", [], [{ id: 2, x: 81, y: 80 }]);
    expect(h.onTap).toHaveBeenCalledWith(0b001); // fresh finger: alive
    vi.useRealTimers();
  });

  it("the host element's touch-action is claimed and restored", async () => {
    const { host } = setup();
    const el = host.value!;
    expect(el.style.touchAction, "claimed while attached").toBe("none");
    host.value = null; // rebind to nothing → restore
    await nextTick(); // the host watch flushes pre-render
    expect(el.style.touchAction, "restored on detach").toBe("");
    // A host-owned value survives the claim/detach cycle verbatim, and
    // a flap back onto the same element re-captures the ORIGINAL (not
    // the 'none' we set while attached).
    el.style.touchAction = "pan-y";
    host.value = el;
    await nextTick();
    expect(el.style.touchAction, "claimed again").toBe("none");
    host.value = null;
    await nextTick();
    expect(el.style.touchAction, "host value restored").toBe("pan-y");
  });

  it("a DISABLED grammar never claims touch-action (native gestures live)", async () => {
    const host = ref<HTMLElement | null>(document.createElement("div"));
    const enabled = ref(false);
    useRemoteTouchGestures(host, {
      onDelta: () => {}, onTap: () => {}, onLongPress: () => {}, onWheel: () => {},
    }, enabled);
    const el = host.value!;
    expect(el.style.touchAction, "mounted-but-off leaves the host alone").toBe("");
    // Re-armed mid-flight: claims; disarmed again: restores.
    enabled.value = true;
    expect(el.style.touchAction, "re-armed claims").toBe("none");
    enabled.value = false;
    expect(el.style.touchAction, "disarmed restores").toBe("");
  });

  it("disarm→rearm inside the tap window: the old finger's tail is dead", () => {
    const { el, h, enabled } = setup();
    touch(el, "touchstart", [{ id: 1, x: 50, y: 50 }]);
    enabled.value = false; // flip away…
    enabled.value = true; // …and back, before the finger lifts
    touch(el, "touchend", [], [{ id: 1, x: 51, y: 50 }]);
    expect(h.onTap, "the pre-flip gesture's tail fires nothing").not.toHaveBeenCalled();
  });

  it("a rebound surface starts clean (no stale records)", async () => {
    const { el, h, host } = setup();
    touch(el, "touchstart", [{ id: 1, x: 50, y: 50 }]); // a gesture in flight…
    const el2 = document.createElement("div");
    host.value = el2; // …the host ref flaps to a NEW element
    await nextTick();
    // The fresh surface must not inherit the stale record: a normal
    // tap on el2 lands.
    touch(el2, "touchstart", [{ id: 2, x: 60, y: 60 }]);
    touch(el2, "touchend", [], [{ id: 2, x: 61, y: 60 }]);
    expect(h.onTap).toHaveBeenCalledWith(0b001);
  });
});
