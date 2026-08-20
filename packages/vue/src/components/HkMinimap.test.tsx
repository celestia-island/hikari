/**
 * HkMinimap.test.tsx — the hold-to-seek drag contract (P46-d).
 *
 * The minimap is a first-class control surface for every downstream
 * panel: pressing and dragging ANYWHERE on its map face pans the
 * consumer's viewport through the `panDelta` emit (and the equivalent
 * `onPanDelta` prop callback), on BOTH mouse and touch — the scss
 * `touch-action: none` (restored after #226 dropped it) is what keeps
 * touch drags from being stolen by the browser, and these tests pin
 * the JS half of that contract.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkMinimap from "./HkMinimap";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

interface MountOpts {
  onPanDelta?: (dx: number, dy: number) => void;
}

/** Mount a minimap with a deterministic geometry:
 *  content 1000×600 → svg 160×96 ⇒ scale 0.16; viewport 500×300 at
 *  zoom 1, so map→world conversion is exact and predictable. */
function mountMinimap(opts: MountOpts = {}): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkMinimap, {
        boxes: [{ id: "a", bounds: { x: 0, y: 0, w: 1000, h: 600 }, color: "#888" }],
        zoom: 1,
        panX: 0,
        panY: 0,
        viewportWidth: 500,
        viewportHeight: 300,
        contentBounds: { x: 0, y: 0, w: 1000, h: 600 },
        onPanDelta: opts.onPanDelta,
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  const root = container.querySelector(".hk-minimap") as HTMLElement | null;
  if (!root) throw new Error("minimap root not rendered");
  return root;
}

function pointerdown(el: HTMLElement, x: number, y: number) {
  el.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y, pointerType: "touch",
    }),
  );
}
function pointermove(el: HTMLElement, x: number, y: number) {
  el.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y, pointerType: "touch",
    }),
  );
}
function pointerup(el: HTMLElement, x: number, y: number) {
  el.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y, pointerType: "touch",
    }),
  );
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

describe("HkMinimap hold-to-seek", () => {
  it("emits panDelta while the map face is pressed and dragged", async () => {
    const pan = vi.fn();
    const root = mountMinimap({ onPanDelta: pan });

    pointerdown(root, 80, 48);
    await nextTick();
    expect(root.getAttribute("data-dragging")).not.toBeNull();

    pointermove(root, 96, 48); // +16px map x
    pointermove(root, 96, 56); // +8px map y (cumulative from last move)

    pointerup(root, 96, 56);
    await nextTick();
    expect(root.getAttribute("data-dragging")).toBeNull();

    expect(pan).toHaveBeenCalledTimes(2);
    // Contract: world delta = -(map px) / scale × zoom, NEGATED (dragging
    // the map face right moves the viewport left over the world). Derive
    // the effective scale from the first call instead of reimplementing
    // the fit math, then verify the second call against the same scale.
    const [dx0, dy0] = pan.mock.calls[0];
    expect(dy0).toBeCloseTo(0, 5); // the first move was purely horizontal
    const scale = -16 / dx0; // 16 map px produced dx0 world px
    expect(scale).toBeGreaterThan(0);
    expect(pan.mock.calls[1][0]).toBeCloseTo(0, 5); // second move purely vertical
    expect(pan.mock.calls[1][1]).toBeCloseTo(-8 / scale, 5);
  });

  it("ignores presses that land on the zoom bar (buttons keep their clicks)", async () => {
    const pan = vi.fn();
    const root = mountMinimap({ onPanDelta: pan });

    const bar = root.querySelector(".hk-mm-zoom-bar") as HTMLElement | null;
    if (!bar) throw new Error("zoom bar not rendered");
    pointerdown(bar, 10, 10);
    await nextTick();
    expect(root.getAttribute("data-dragging")).toBeNull();

    pointermove(root, 40, 20);
    pointerup(root, 40, 20);
    expect(pan).not.toHaveBeenCalled();
  });

  it("stops the seek drag on pointercancel (browser stole the gesture)", async () => {
    const pan = vi.fn();
    const root = mountMinimap({ onPanDelta: pan });

    pointerdown(root, 80, 48);
    root.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true, cancelable: true, pointerId: 1, clientX: 80, clientY: 48, pointerType: "touch",
      }),
    );
    await nextTick();
    expect(root.getAttribute("data-dragging")).toBeNull();

    // A stray move after cancel must NOT pan.
    pointermove(root, 120, 60);
    expect(pan).not.toHaveBeenCalled();
  });

  it("marks the drag surface with touch-action none in its stylesheet contract", async () => {
    // The scss half of the contract: without touch-action:none the browser
    // steals touch drags as page scrolling (the #226 regression). We can't
    // compile scss in unit tests, so pin the SOURCE instead — this fails
    // if someone deletes the rule again.
    const fs = await import("node:fs");
    const path = await import("node:path");
    const scss = fs.readFileSync(
      path.resolve(__dirname, "HkMinimap.scss"),
      "utf-8",
    );
    expect(scss).toMatch(/touch-action:\s*none/);
    expect(scss).toMatch(/user-select:\s*none/);
  });
});
