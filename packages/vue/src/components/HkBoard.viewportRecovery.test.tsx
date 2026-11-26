import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import HkBoard, { type BoardNodeInput } from "./HkBoard";

/**
 * A board must come back by itself when its container goes from "no box"
 * to a real one.
 *
 * Measured on the docs site (2026-11-26): the mermaid card's canvas
 * collapsed to 2px inside a flex row, HkBoard mounted against a 0-width
 * viewport, and the camera stayed at that degenerate fit — the diagram was
 * invisible until the reader pressed the minimap's reset. The fix has two
 * halves: `boardFit` no longer returns a NEGATIVE scale, and the
 * ResizeObserver path re-fits on the first real size after a degenerate
 * one. This pins the second half.
 */
const nodes: BoardNodeInput[] = [
  { id: "a", x: 0, y: 0, w: 120, h: 80, label: "A" },
  { id: "b", x: 400, y: 0, w: 120, h: 80, label: "B" },
];

const VIEW_W = 800;
const VIEW_H = 600;

/** happy-dom lays nothing out; the box is whatever these getters say. */
const box = { w: 0, h: 0 };

let observers: Array<() => void> = [];

class FakeResizeObserver {
  constructor(private readonly cb: () => void) {}
  observe(): void {
    // Browsers deliver one notification as soon as observation starts, not
    // only on a later change; mirror that so a mount-time refresh is
    // exercised the same way it is in Chrome.
    observers.push(this.cb);
    this.cb();
  }
  disconnect(): void {
    observers = observers.filter((cb) => cb !== this.cb);
  }
  unobserve(): void {}
}

/** Fire every live observer once, as a browser would after a layout change. */
function triggerResize(): void {
  for (const cb of [...observers]) cb();
}

function scaleOf(transform: string): number {
  return Number(/scale\((-?[\d.]+)\)/.exec(transform)?.[1] ?? 0);
}

function mountBoard(): { transform: () => string; unmount: () => void } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const app = createApp(defineComponent({
    setup: () => () => h(HkBoard, { nodes }),
  }));
  app.mount(host);
  return {
    transform: () => document.body.querySelector<HTMLElement>(".hk-board-world")!.style.transform,
    unmount: () => app.unmount(),
  };
}

describe("HkBoard viewport recovery", () => {
  // happy-dom defines neither of these as own prototype properties worth
  // keeping, but the repo's convention is to snapshot + restore (see
  // HkBoard.scale.test.ts) so a non-isolated runner cannot inherit the stubs.
  let savedWidth: PropertyDescriptor | undefined;
  let savedHeight: PropertyDescriptor | undefined;

  beforeEach(() => {
    savedWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    savedHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => box.w,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => box.h,
    });
    observers = [];
    box.w = 0;
    box.h = 0;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    observers = [];
    if (savedWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", savedWidth);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    if (savedHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", savedHeight);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientHeight;
    delete (globalThis as unknown as Record<string, unknown>).ResizeObserver;
  });

  it("re-fits once the container grows from a degenerate box to a real one", async () => {
    // The measured docs-hub shape: a 2px-wide canvas (its border only) with a
    // real height, i.e. narrower than the fit padding.
    box.w = 2;
    box.h = 304;
    const { transform, unmount } = mountBoard();
    await nextTick();
    await new Promise((r) => setTimeout(r, 30));
    // No negative (mirrored) framing is allowed to survive the mount.
    expect(scaleOf(transform())).toBeGreaterThanOrEqual(0);

    box.w = VIEW_W;
    box.h = VIEW_H;
    triggerResize();
    await nextTick();
    await new Promise((r) => setTimeout(r, 260)); // fit tween is ~170ms

    const k = scaleOf(transform());
    // (800 - 80) / (620 content width incl. the 20px bbox margin) ≈ 1.16,
    // capped at 1.25 — the point is that a real, positive fit happened
    // without the reader pressing reset.
    expect(k).toBeGreaterThan(0.5);
    expect(k).toBeLessThanOrEqual(1.25 + 1e-6);
    unmount();
  });

  it("does not overrule a host that drives its own camera", async () => {
    box.w = VIEW_W;
    box.h = VIEW_H;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const board = ref<{ zoomToPercent: (p: number) => void } | null>(null);
    const app = createApp(defineComponent({
      setup: () => () => h(HkBoard, { nodes, ref: board }),
    }));
    app.mount(host);
    await nextTick();
    await new Promise((r) => setTimeout(r, 260));

    // The host picks its own framing (a 2× zoom, not the fit).
    board.value?.zoomToPercent(200);
    await nextTick();
    await new Promise((r) => setTimeout(r, 260));
    const hostChoice = scaleOf(document.body.querySelector<HTMLElement>(".hk-board-world")!.style.transform);
    expect(hostChoice).toBeGreaterThan(1.5);

    // Collapse to the docs-hub shape, then come back: the recovery path
    // must NOT re-frame over the host's own choice.
    box.w = 2;
    box.h = 304;
    triggerResize();
    await nextTick();
    box.w = VIEW_W;
    box.h = VIEW_H;
    triggerResize();
    await nextTick();
    await new Promise((r) => setTimeout(r, 260));
    const after = scaleOf(document.body.querySelector<HTMLElement>(".hk-board-world")!.style.transform);
    expect(after).toBeCloseTo(hostChoice, 6);
    app.unmount();
  });

  it("keeps a real mount fit untouched when the first size is already real", async () => {
    box.w = VIEW_W;
    box.h = VIEW_H;
    const { transform, unmount } = mountBoard();
    await nextTick();
    await new Promise((r) => setTimeout(r, 260));
    const mounted = scaleOf(transform());
    expect(mounted).toBeGreaterThan(0.5);

    // An ordinary resize (no degenerate predecessor) must not re-frame the
    // camera — the reader owns it after mount.
    box.w = 1000;
    triggerResize();
    await nextTick();
    await new Promise((r) => setTimeout(r, 40));
    expect(scaleOf(transform())).toBeCloseTo(mounted, 6);
    unmount();
  });
});