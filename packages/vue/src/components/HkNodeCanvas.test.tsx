import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";

import HkNodeCanvas, { NODE_CANVAS_DEFAULTS } from "./HkNodeCanvas";

/**
 * HkNodeCanvas tests — the camera protocol the three node surfaces share:
 * fit-before-first-paint, grid-snapped zoom that keeps the point under the
 * cursor fixed, panning, the coordinate round trip, and the minimap corner.
 */

interface Instance {
  camera: { k: number; x: number; y: number };
  viewport: { width: number; height: number };
  fit: () => void;
  zoomBy: (direction: 1 | -1, at?: { x: number; y: number }) => void;
  panBy: (dx: number, dy: number) => void;
  screenToWorld: (p: { x: number; y: number }) => { x: number; y: number };
  worldToScreen: (p: { x: number; y: number }) => { x: number; y: number };
}

const apps: App[] = [];
let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;
const VIEWPORT = { width: 800, height: 600 };
const BOUNDS = { x: 0, y: 0, width: 400, height: 200 };

beforeEach(() => {
  originalRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.classList?.contains("hk-node-canvas")) {
      return {
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        top: 0,
        left: 0,
        right: VIEWPORT.width,
        bottom: VIEWPORT.height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return originalRect.call(this);
  };
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  };
});

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  HTMLElement.prototype.getBoundingClientRect = originalRect;
});

function mount(props: Record<string, unknown>, slots: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = ref<Instance | null>(null);
  const Root = defineComponent({
    setup() {
      return () => h(HkNodeCanvas, { ref: instance as never, ...props }, slots);
    },
  });
  const app = createApp(Root);
  app.mount(container);
  apps.push(app);
  return { container, instance };
}

describe("HkNodeCanvas", () => {
  it("paints the FITTED camera on the very first frame", async () => {
    // The bug this exists to prevent: a large graph starting at 1:1 and
    // snapping into place a frame later. The bounds here are far wider than
    // the viewport, so fitting must shrink — and it must have happened by the
    // time the first render is inspected.
    const wide = { x: 0, y: 0, width: 4000, height: 2000 };
    const { container, instance } = mount({ contentBounds: wide, fitOnLoad: true });
    await nextTick();
    const cam = instance.value?.camera;
    expect(cam).toBeTruthy();
    expect(cam!.k).toBeLessThan(1);
    expect(cam!.k).toBe(NODE_CANVAS_DEFAULTS.minZoom);

    const layer = container.querySelector<HTMLElement>(".hk-node-canvas-layer");
    expect(layer?.style.transform).toContain(`scale(${cam!.k})`);
  });

  it("does not blow a small graph up past the fit cap", async () => {
    // Zooming in is the user's call, not the initial frame's.
    const { instance } = mount({ contentBounds: BOUNDS, fitOnLoad: true });
    await nextTick();
    expect(instance.value!.camera.k).toBe(NODE_CANVAS_DEFAULTS.fitCap);
  });

  it("snaps zoom to the grid and keeps it in range", async () => {
    const { instance } = mount({ contentBounds: BOUNDS });
    await nextTick();
    instance.value?.fit();
    const before = instance.value!.camera.k;
    instance.value?.zoomBy(1);
    const after = instance.value!.camera.k;
    expect(after).toBeGreaterThan(before);
    // A grid-snapped value is a whole number of steps.
    expect(Math.abs(after / NODE_CANVAS_DEFAULTS.zoomGridStep - Math.round(after / NODE_CANVAS_DEFAULTS.zoomGridStep))).toBeLessThan(1e-6);
    expect(after).toBeLessThanOrEqual(NODE_CANVAS_DEFAULTS.maxZoom);
  });

  it("keeps the point under the cursor fixed while zooming", async () => {
    const { instance } = mount({ contentBounds: BOUNDS });
    await nextTick();
    instance.value?.fit();
    const at = { x: 120, y: 90 };
    const worldBefore = instance.value!.screenToWorld(at);
    instance.value?.zoomBy(1, at);
    const worldAfter = instance.value!.screenToWorld(at);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
  });

  it("pans without changing the zoom", async () => {
    const { instance } = mount({ contentBounds: BOUNDS });
    await nextTick();
    instance.value?.fit();
    const before = { ...instance.value!.camera };
    instance.value?.panBy(30, -20);
    const after = instance.value!.camera;
    expect(after.k).toBe(before.k);
    expect(after.x).toBeCloseTo(before.x + 30, 6);
    expect(after.y).toBeCloseTo(before.y - 20, 6);
  });

  it("round-trips a point through screen and world space", async () => {
    const { instance } = mount({ contentBounds: BOUNDS });
    await nextTick();
    instance.value?.fit();
    const screen = { x: 333, y: 222 };
    const back = instance.value!.worldToScreen(instance.value!.screenToWorld(screen));
    expect(back.x).toBeCloseTo(screen.x, 6);
    expect(back.y).toBeCloseTo(screen.y, 6);
  });

  it("does not zoom when zooming is off, nor pan when panning is off", async () => {
    const { instance } = mount({ contentBounds: BOUNDS, zoomable: false, pannable: false, fitOnLoad: false });
    await nextTick();
    const before = { ...instance.value!.camera };
    instance.value?.zoomBy(1);
    // zoomBy is the imperative API and stays available; the GESTURE is what
    // the flags gate, so assert the rendered surface carries the flags.
    const { container } = mount({ contentBounds: BOUNDS, zoomable: false, pannable: false });
    await nextTick();
    expect(container.querySelector(".hk-node-canvas")?.hasAttribute("data-pannable")).toBe(false);
    expect(before.k).toBe(1);
  });

  it("mounts the minimap by default and takes it away when asked", async () => {
    const withMap = mount({ contentBounds: BOUNDS }, { minimap: () => h("div", { class: "map" }, "map") });
    await nextTick();
    const holder = withMap.container.querySelector(".hk-node-canvas-minimap");
    expect(holder?.getAttribute("data-placement")).toBe("bottom-right");
    expect(holder?.querySelector(".map")).toBeTruthy();

    const without = mount({ contentBounds: BOUNDS, minimap: false });
    await nextTick();
    expect(without.container.querySelector(".hk-node-canvas-minimap")).toBeNull();
  });

  it("emits camera updates instead of keeping them when controlled", async () => {
    const onUpdate = vi.fn();
    const { instance } = mount({ contentBounds: BOUNDS, camera: { k: 1, x: 0, y: 0 }, "onUpdate:camera": onUpdate });
    await nextTick();
    instance.value?.fit();
    expect(onUpdate).toHaveBeenCalled();
    // Controlled: the internal camera did not move on its own.
    expect(instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });
  });
});
