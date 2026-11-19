// HkSlideConfirm — the fat slide-to-confirm (a traced orthogonal lane
// with random right-angle turns, not a straight pull).
//
// The contract these tests pin (2026-11-19 user direction): arrows walk
// the lane and reaching the end emits confirm ONCE; a premature pointer
// release snaps the knob back to zero (no emit); dragging off the
// corridor snaps back too; a seeded mount reproduces the exact lane; and
// the whole surface is operable from a keyboard alone. Pointer geometry
// works in jsdom through an injected track rect (the same trick the
// pointer-family tests use).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkSlideConfirm from "./HkSlideConfirm";
import { generateSlidePath, slidePixelPoints, slidePointAtT } from "./slideConfirmPath";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(renderNode: () => ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: renderNode });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

const root = () => document.body.querySelector<HTMLElement>(".hk-slide-confirm")!;
const knob = () => document.body.querySelector<HTMLElement>(".hk-slide-confirm-knob")!;

function injectRect(el: HTMLElement, width = 300, height = 120) {
  el.getBoundingClientRect = () =>
    ({
      width,
      height,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** Pointer event with real coordinates (jsdom dispatches to the handler).
 *  setPointerCapture is absent in jsdom — the component guards it. */
function pointer(el: HTMLElement, type: string, x: number, y: number) {
  el.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y }),
  );
}

function key(el: HTMLElement, keyName: string) {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, bubbles: true, cancelable: true }));
}

const now = () => Number(knob().getAttribute("aria-valuenow"));

describe("HkSlideConfirm", () => {
  it("renders the fat track, the lane svg and the slider knob", () => {
    mount(() => h(HkSlideConfirm, { seed: 42 }));
    expect(document.body.querySelector(".hk-slide-confirm")).not.toBeNull();
    expect(document.body.querySelector(".hk-slide-confirm-lane-path")).not.toBeNull();
    const handle = knob();
    expect(handle.getAttribute("role")).toBe("slider");
    expect(handle.getAttribute("aria-valuemin")).toBe("0");
    expect(handle.getAttribute("aria-valuemax")).toBe("100");
    expect(handle.getAttribute("aria-valuenow")).toBe("0");
  });

  it("a seed reproduces the exact lane", () => {
    mount(() => h(HkSlideConfirm, { seed: 20261119 }));
    const laneA = document.body.querySelector(".hk-slide-confirm-lane-path")!.getAttribute("points");
    mount(() => h(HkSlideConfirm, { seed: 20261119 }));
    const laneB = document.body.querySelector(".hk-slide-confirm-lane-path")!.getAttribute("points");
    expect(laneA).toBeTruthy();
    expect(laneA).toBe(laneB);
  });

  it("arrows walk the lane and the end fires confirm exactly once", async () => {
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 7, onConfirm }));
    const handle = knob();
    handle.focus();
    // ~24 steps traverse the lane; walk a couple extra to prove once-only.
    for (let i = 0; i < 30; i++) key(handle, "ArrowRight");
    await nextTick();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(now()).toBe(100);
    // The done state: the success label replaces the idle one.
    expect(document.body.querySelector(".hk-slide-confirm-done-label")).not.toBeNull();
    expect(document.body.querySelector(".hk-slide-confirm-label")).toBeNull();
    // Post-confirm keys never re-fire.
    for (let i = 0; i < 5; i++) key(handle, "ArrowRight");
    await nextTick();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Home resets and Left/Down retreat without firing", async () => {
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 7, onConfirm }));
    const handle = knob();
    for (let i = 0; i < 10; i++) key(handle, "ArrowRight");
    await nextTick();
    expect(now()).toBeGreaterThan(0);
    key(handle, "ArrowLeft");
    await nextTick();
    expect(now()).toBeLessThan(Math.round((10 / 24) * 100));
    key(handle, "Home");
    await nextTick();
    expect(now()).toBe(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("a premature pointer release snaps back to zero without emitting", async () => {
    const onConfirm = vi.fn();
    const container = mount(() => h(HkSlideConfirm, { seed: 42, onConfirm }));
    injectRect(root(), 300, 120);
    const handle = knob();
    pointer(handle, "pointerdown", 24, 20);
    // Drag halfway along the lane's first horizontal run: the pointer's
    // lane height comes from the SEEDED geometry (the pre-gesture render
    // still carries the degenerate 0-box position, so parsing the
    // transform would read a stale lane).
    const startPx = slidePixelPoints(generateSlidePath(42).points, 252, 72)[0]!;
    const y = 24 + startPx.y;
    pointer(handle, "pointermove", 100, y);
    pointer(handle, "pointermove", 130, y);
    await nextTick();
    expect(now()).toBeGreaterThan(0);
    pointer(handle, "pointerup", 130, y - 24 + 20);
    await nextTick();
    // Snapped back: progress zeroed, no confirmation, idle returns.
    expect(now()).toBe(0);
    expect(onConfirm).not.toHaveBeenCalled();
    void container;
  });

  it("dragging off the corridor is a failed attempt (snap back)", async () => {
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 42, onConfirm }));
    injectRect(root(), 300, 120);
    const handle = knob();
    pointer(handle, "pointerdown", 24, 20);
    // First move along the lane to arm progress (lane height from the
    // seeded geometry — same reason as above).
    const startPx = slidePixelPoints(generateSlidePath(42).points, 252, 72)[0]!;
    const y = 24 + startPx.y;
    pointer(handle, "pointermove", 60, y);
    await nextTick();
    expect(now()).toBeGreaterThan(0);
    // …then teleport far off the lane: the corridor is gone → snap.
    pointer(handle, "pointermove", 60, 118);
    await nextTick();
    expect(now()).toBe(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("completing the lane by pointer emits confirm once", async () => {
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 42, onConfirm }));
    injectRect(root(), 300, 120);
    const handle = knob();
    pointer(handle, "pointerdown", 24, 20);
    // Trace a dense polyline: the pointer visits every corridor step of
    // the seeded lane (the pure module computes the same geometry).
    const pixel = slidePixelPoints(generateSlidePath(42).points, 300 - 48, 120 - 48);
    for (let i = 0; i <= 100; i++) {
      const p = slidePointAtT(pixel, i / 100);
      pointer(handle, "pointermove", 24 + p.x, 24 + p.y);
    }
    await nextTick();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(now()).toBe(100);
  });

  it("disabled blocks pointer and keyboard paths", () => {
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 42, disabled: true, onConfirm }));
    const handle = knob();
    expect(handle.getAttribute("aria-disabled")).toBe("true");
    expect(handle.getAttribute("tabindex")).toBe("-1");
    key(handle, "End");
    pointer(handle, "pointerdown", 24, 20);
    pointer(handle, "pointermove", 100, 20);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(now()).toBe(0);
  });
});
