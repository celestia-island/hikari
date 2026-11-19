// HkSlideConfirm — the fat slide-to-confirm (a traced orthogonal lane
// with random right-angle turns, not a straight pull).
//
// The contract these tests pin (2026-11-19 user direction): arrows walk
// the lane and reaching the end emits confirm ONCE; a premature pointer
// release snaps the knob back to zero (no emit); dragging off the
// corridor snaps back too; a seeded mount reproduces the exact lane; a
// seed change regenerates and resets; the whole surface is operable from
// a keyboard alone. Pointer geometry works in jsdom through an injected
// track rect; drags TRACE along the seeded lane in small steps (a real
// drag never teleports — the walk refuses single-event corner jumps).
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";

import HkSlideConfirm from "./HkSlideConfirm";
import {
  generateSlidePath,
  slidePixelPoints,
  slidePointAtT,
} from "./slideConfirmPath";

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

/** The seeded lane in the component's REAL inner frame (300×120 track
 *  minus the 24px TRACK_PAD per side). */
const lane42 = () => slidePixelPoints(generateSlidePath(42).points, 252, 72);

/** Trace the lane from fromT to toT in small pointer steps (a real drag
 *  never teleports; the walk refuses single-event corner jumps). */
function trace(handle: HTMLElement, pixel: ReturnType<typeof lane42>, fromT: number, toT: number, steps: number) {
  for (let i = 1; i <= steps; i++) {
    const t = fromT + ((toT - fromT) * i) / steps;
    const p = slidePointAtT(pixel, t);
    pointer(handle, "pointermove", 24 + p.x, 24 + p.y);
  }
}

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
    mount(() => h(HkSlideConfirm, { seed: 42, onConfirm }));
    injectRect(root(), 300, 120);
    const handle = knob();
    const pixel = lane42();
    // pointerdown lands ON the knob (the seeded start point) so the grab
    // offset is zero — the traced point is the knob center.
    pointer(handle, "pointerdown", 24 + pixel[0]!.x, 24 + pixel[0]!.y);
    // Trace halfway along the lane in real drag steps.
    trace(handle, pixel, 0, 0.5, 12);
    await nextTick();
    expect(now()).toBeGreaterThan(0);
    pointer(handle, "pointerup", 24, 24);
    await nextTick();
    // Snapped back: progress zeroed, no confirmation, idle returns.
    expect(now()).toBe(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("dragging off the corridor is a failed attempt (snap back)", async () => {
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 42, onConfirm }));
    injectRect(root(), 300, 120);
    const handle = knob();
    const pixel = lane42();
    pointer(handle, "pointerdown", 24 + pixel[0]!.x, 24 + pixel[0]!.y);
    // Trace the first quarter of the lane to arm progress.
    trace(handle, pixel, 0, 0.25, 8);
    await nextTick();
    expect(now()).toBeGreaterThan(0);
    // …then teleport far off the lane: the corridor is gone → snap.
    pointer(handle, "pointermove", 60, 118);
    await nextTick();
    expect(now()).toBe(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("a straight pull cannot cut the turns (trace is enforced)", async () => {
    // The S1 corridor-slip probe: hold the pointer at ONE height and drag
    // straight across the whole track — the walk must stop at the first
    // lane change instead of chord-diagonaling through the turns.
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 42, onConfirm }));
    injectRect(root(), 300, 120);
    const handle = knob();
    const pixel = lane42();
    pointer(handle, "pointerdown", 24 + pixel[0]!.x, 24 + pixel[0]!.y);
    const y = 24 + pixel[0]!.y;
    pointer(handle, "pointermove", 130, y);
    pointer(handle, "pointermove", 276, y);
    await nextTick();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("completing the lane by pointer emits confirm once", async () => {
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 42, onConfirm }));
    injectRect(root(), 300, 120);
    const handle = knob();
    const pixel = lane42();
    pointer(handle, "pointerdown", 24 + pixel[0]!.x, 24 + pixel[0]!.y);
    // Trace the WHOLE lane densely (the pure module computes the same
    // geometry the component maps).
    trace(handle, pixel, 0, 1, 120);
    await nextTick();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(now()).toBe(100);
    // Done state short-circuits further pointer input.
    trace(handle, pixel, 1, 1, 3);
    await nextTick();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("a seed change regenerates the lane and resets progress", async () => {
    // The documented contract: a seed change lays a fresh route AND
    // resets the gesture (a half-traced knob must not carry over).
    const seed = ref(1);
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: seed.value, onConfirm }));
    const handle = knob();
    handle.focus();
    key(handle, "ArrowRight");
    await nextTick();
    expect(now()).toBeGreaterThan(0);

    seed.value = 20261119;
    await nextTick();
    expect(now()).toBe(0);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disabled blocks pointer and keyboard paths", () => {
    const onConfirm = vi.fn();
    mount(() => h(HkSlideConfirm, { seed: 42, disabled: true, onConfirm }));
    const handle = knob();
    expect(handle.getAttribute("aria-disabled")).toBe("true");
    expect(handle.getAttribute("tabindex")).toBe("-1");
    key(handle, "End");
    pointer(handle, "pointerdown", 24, 24);
    pointer(handle, "pointermove", 100, 24);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(now()).toBe(0);
  });
});
