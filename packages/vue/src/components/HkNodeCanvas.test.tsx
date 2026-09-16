import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, isRef, nextTick, onUpdated, ref, type App } from "vue";

import HkNodeCanvas, { NODE_CANVAS_DEFAULTS } from "./HkNodeCanvas";

/**
 * HkNodeCanvas tests — the camera protocol the three node surfaces share:
 * fit-before-first-paint, grid-snapped zoom that keeps the point under the
 * cursor fixed, panning, the coordinate round trip, and the minimap corner.
 */

interface Instance {
  camera: { k: number; x: number; y: number };
  viewport: { width: number; height: number };
  fit: () => boolean;
  zoomBy: (direction: 1 | -1, at?: { x: number; y: number }) => void;
  panBy: (dx: number, dy: number) => void;
  screenToWorld: (p: { x: number; y: number }) => { x: number; y: number };
  worldToScreen: (p: { x: number; y: number }) => { x: number; y: number };
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const apps: App[] = [];
let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;
const VIEWPORT = { width: 800, height: 600 };
const BOUNDS = { x: 0, y: 0, width: 400, height: 200 };

/** What the mocked `getBoundingClientRect` reports; 0×0 stands for "not laid out yet". */
let viewportRect = { ...VIEWPORT };
/** Where the canvas sits on the page, so a test can offset the root rect. */
let viewportOffset = { left: 0, top: 0 };
/** Live ResizeObserver callbacks, so a test can play the "tab became visible" beat. */
let resizeCallbacks: Array<() => void> = [];

function triggerResize() {
  for (const callback of resizeCallbacks) callback();
}

beforeEach(() => {
  viewportRect = { ...VIEWPORT };
  viewportOffset = { left: 0, top: 0 };
  resizeCallbacks = [];
  originalRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.classList?.contains("hk-node-canvas")) {
      return {
        width: viewportRect.width,
        height: viewportRect.height,
        top: viewportOffset.top,
        left: viewportOffset.left,
        right: viewportOffset.left + viewportRect.width,
        bottom: viewportOffset.top + viewportRect.height,
        x: viewportOffset.left,
        y: viewportOffset.top,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return originalRect.call(this);
  };
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    constructor(callback: () => void) {
      resizeCallbacks.push(callback);
    }
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
      return () => {
        // Refs are read inside the render, so a test can change a prop (a graph
        // arriving after mount) and watch the component react to it.
        const resolved: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(props)) {
          resolved[key] = isRef(value) ? value.value : value;
        }
        return h(HkNodeCanvas, { ref: instance as never, ...resolved }, slots);
      };
    },
  });
  const app = createApp(Root);
  app.mount(container);
  apps.push(app);
  return {
    container,
    instance,
    root: container.querySelector<HTMLElement>(".hk-node-canvas")!,
  };
}

/** A pointer event, whatever the environment's constructor support is. */
function pointerEvent(
  type: string,
  init: { pointerId: number; clientX: number; clientY: number; buttons?: number },
): Event {
  const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  // A real drag carries the held button on every move; a hover carries none.
  const buttons = init.buttons ?? (type === "pointerup" ? 0 : 1);
  const event = new Ctor(type, { bubbles: true, cancelable: true, button: 0, buttons });
  for (const [key, value] of Object.entries({ ...init, buttons })) {
    Object.defineProperty(event, key, { value, configurable: true });
  }
  return event;
}

/**
 * happy-dom's WheelEvent drops clientX/clientY (its MouseEvent does not), so
 * the cursor position has to be attached by hand for the cursor-anchored wheel
 * path to be exercised at all.
 */
function wheelEvent(init: { deltaY: number; clientX: number; clientY: number }): WheelEvent {
  const event = new WheelEvent("wheel", { deltaY: init.deltaY, bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: init.clientX, configurable: true });
  Object.defineProperty(event, "clientY", { value: init.clientY, configurable: true });
  return event;
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

  it("uses the whole grid step when the ideal factor lands exactly on the grid", async () => {
    // 720 / 1200 is exactly 0.6, twelve grid steps — but in binary it is
    // 11.999999999999998 steps, so a bare floor throws a whole step away and
    // frames the content 8% smaller than the padding budget allows.
    const { instance } = mount({
      contentBounds: { x: 0, y: 0, width: 1200, height: 800 },
      fitOnLoad: true,
    });
    await nextTick();
    expect(instance.value!.camera.k).toBe(0.6);
  });

  it("does not keep a pan armed after a release that happens off the canvas", async () => {
    // The gesture is only captured once it passes the slop, so a press near the
    // edge that drifts out and releases outside never sends this element a
    // pointerup. A later hover must not move the camera on its own.
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    const capture = vi.fn();
    root.setPointerCapture = capture;

    root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 11, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 11, clientX: 102, clientY: 101 }));
    document.body.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 11, clientX: 102, clientY: 101, buttons: 0 }),
    );

    root.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 11, clientX: 300, clientY: 260, buttons: 0 }),
    );
    expect(capture).not.toHaveBeenCalled();
    expect(instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });
  });

  it("leaves the pan to the host when the host claims the pointerdown", async () => {
    // Node dragging is the core gesture of every consumer: a card that prevents
    // the default on its own pointerdown keeps the pan — and the root capture
    // that would cut its drag short — out of the way.
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    const card = document.createElement("div");
    card.addEventListener("pointerdown", (event) => event.preventDefault());
    root.appendChild(card);
    const capture = vi.fn();
    root.setPointerCapture = capture;

    const press = pointerEvent("pointerdown", { pointerId: 12, clientX: 100, clientY: 100 });
    card.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 12, clientX: 160, clientY: 100 }));
    expect(capture).not.toHaveBeenCalled();
    expect(instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });
  });

  it("does not loop when the host writes the emitted camera back", async () => {
    // The natural host spelling: `v-model:camera` plus a bounds object literal,
    // which is a fresh identity on every render. Framing has to settle instead
    // of emitting, re-rendering and framing again for ever.
    const camera = ref({ k: 1, x: 0, y: 0 });
    let renders = 0;
    let emits = 0;
    const instance = ref<Instance | null>(null);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Root = defineComponent({
      setup() {
        return () => {
          renders++;
          return h(HkNodeCanvas, {
            ref: instance as never,
            contentBounds: { x: 0, y: 0, width: BOUNDS.width, height: BOUNDS.height },
            camera: camera.value,
            "onUpdate:camera": (next: { k: number; x: number; y: number }) => {
              emits++;
              camera.value = next;
            },
          });
        };
      },
    });
    const app = createApp(Root);
    app.mount(container);
    apps.push(app);

    for (let frame = 0; frame < 5; frame++) await nextTick();
    expect(renders).toBeLessThan(10);
    // The host owns a controlled camera: automatic framing never touches it.
    expect(camera.value).toEqual({ k: 1, x: 0, y: 0 });

    // An imperative fit frames it once; the second one has nothing to change,
    // so it must stay silent instead of emitting the same camera again.
    instance.value?.fit();
    await nextTick();
    const afterFirst = emits;
    expect(afterFirst).toBeGreaterThan(0);
    instance.value?.fit();
    instance.value?.fit();
    await nextTick();
    expect(emits).toBe(afterFirst);
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

  it("ignores the wheel when zooming is off and the drag when panning is off", async () => {
    // zoomBy/panBy are the imperative API and stay available to the host; the
    // flags gate the GESTURES, so this has to dispatch real events.
    const { instance, root } = mount({
      contentBounds: BOUNDS,
      zoomable: false,
      pannable: false,
      fitOnLoad: false,
    });
    await nextTick();
    const before = { ...instance.value!.camera };

    const wheel = wheelEvent({ deltaY: -100, clientX: 400, clientY: 300 });
    root.dispatchEvent(wheel);
    // A surface that cannot zoom must not swallow the page scroll either.
    expect(wheel.defaultPrevented).toBe(false);
    expect(instance.value!.camera).toEqual(before);

    const capture = vi.fn();
    root.setPointerCapture = capture;
    root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 1, clientX: 160, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointerup", { pointerId: 1, clientX: 160, clientY: 100 }));
    expect(capture).not.toHaveBeenCalled();
    expect(instance.value!.camera).toEqual(before);
    expect(root.hasAttribute("data-pannable")).toBe(false);
    // Nothing consumes the gesture, so the page keeps its touch scrolling.
    expect(root.style.touchAction).toBe("");

    const on = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    expect(on.root.hasAttribute("data-pannable")).toBe(true);
    expect(on.root.style.touchAction).toBe("none");
  });

  it("zooms towards the cursor on the wheel", async () => {
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    const at = { x: 600, y: 150 };
    const worldBefore = instance.value!.screenToWorld(at);
    const wheel = wheelEvent({ deltaY: -100, clientX: at.x, clientY: at.y });
    root.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(instance.value!.camera.k).toBeGreaterThan(1);
    const worldAfter = instance.value!.screenToWorld(at);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
  });

  it("centres content whose bounds do not start at the origin", async () => {
    // Every bounds fixture with x = y = 0 lets a fit that forgets the
    // `- bounds.x * k` term pass unnoticed; this one does not.
    const offset = { x: 1000, y: 500, width: 400, height: 200 };
    const { instance } = mount({ contentBounds: offset, fitOnLoad: true });
    await nextTick();
    const cam = instance.value!.camera;
    const topLeft = instance.value!.worldToScreen({ x: offset.x, y: offset.y });
    const bottomRight = instance.value!.worldToScreen({
      x: offset.x + offset.width,
      y: offset.y + offset.height,
    });
    expect(topLeft.x).toBeCloseTo(VIEWPORT.width - bottomRight.x, 6);
    expect(topLeft.y).toBeCloseTo(VIEWPORT.height - bottomRight.y, 6);
    expect(topLeft.x).toBeCloseTo((VIEWPORT.width - offset.width * cam.k) / 2, 6);
    expect(topLeft.y).toBeCloseTo((VIEWPORT.height - offset.height * cam.k) / 2, 6);
  });

  it("fits off-grid bounds inside the padding budget", async () => {
    // 520 / 1571 is 0.331, six and a bit grid steps. Rounding that to seven
    // renders at 0.35 and pushes the content past the edge, so the fit has to
    // snap DOWN — and derive the translation from the scale it actually
    // renders. The floor also leaves binary dust (6 * 0.05), which a camera
    // shared with the host must not carry.
    const tall = { x: 0, y: 0, width: 100, height: 1571 };
    const { instance } = mount({ contentBounds: tall, fitOnLoad: true });
    await nextTick();
    expect(instance.value!.camera.k).toBe(0.3);

    const topLeft = instance.value!.worldToScreen({ x: 0, y: 0 });
    const bottomRight = instance.value!.worldToScreen({ x: tall.width, y: tall.height });
    const pad = NODE_CANVAS_DEFAULTS.fitPadding - 1e-6;
    expect(topLeft.x).toBeGreaterThanOrEqual(pad);
    expect(topLeft.y).toBeGreaterThanOrEqual(pad);
    expect(VIEWPORT.width - bottomRight.x).toBeGreaterThanOrEqual(pad);
    expect(VIEWPORT.height - bottomRight.y).toBeGreaterThanOrEqual(pad);
  });

  it("moves the zoom on every wheel tick, including where a grid step is coarser than the factor", async () => {
    // 0.25 * 1.05 = 0.2625 is less than half a grid step away from where it
    // started, so multiplying and snapping rounds straight back and the wheel
    // dies in the whole band below k = 0.5 — which is exactly where a large
    // graph lands when it is fitted.
    const large = { x: 0, y: 0, width: 2880, height: 2080 };
    const { instance } = mount({ contentBounds: large, fitOnLoad: true });
    await nextTick();
    expect(instance.value!.camera.k).toBe(0.25);

    let previous = instance.value!.camera.k;
    for (let tick = 0; tick < 8; tick++) {
      instance.value?.zoomBy(1);
      const next = instance.value!.camera.k;
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }

    instance.value?.fit();
    let ticks = 0;
    while (instance.value!.camera.k > NODE_CANVAS_DEFAULTS.minZoom) {
      const before = instance.value!.camera.k;
      instance.value?.zoomBy(-1);
      const after = instance.value!.camera.k;
      expect(after).toBeLessThan(before);
      previous = after;
      if (++ticks > 60) break;
    }
    expect(previous).toBe(NODE_CANVAS_DEFAULTS.minZoom);
  });

  it("captures the pointer only once a drag is real, so card clicks survive", async () => {
    // Capturing on pointerdown retargets the gesture's click to the capturing
    // element, and clicks on node cards stop reaching their handlers.
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    const capture = vi.fn();
    root.setPointerCapture = capture;
    root.releasePointerCapture = vi.fn();

    root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 7, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 7, clientX: 103, clientY: 102 }));
    root.dispatchEvent(pointerEvent("pointerup", { pointerId: 7, clientX: 103, clientY: 102 }));
    expect(capture).not.toHaveBeenCalled();
    expect(instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });

    root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 8, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 8, clientX: 110, clientY: 100 }));
    expect(capture).toHaveBeenCalledWith(8);
    root.dispatchEvent(pointerEvent("pointerup", { pointerId: 8, clientX: 110, clientY: 100 }));
    expect(instance.value!.camera.x).toBeCloseTo(10, 6);
  });

  it("does not throw away a camera the user already moved when the graph arrives late", async () => {
    const bounds = ref<Bounds | undefined>(undefined);
    const { instance } = mount({ contentBounds: bounds, fitOnLoad: true });
    await nextTick();
    instance.value?.panBy(30, 20);
    const moved = { ...instance.value!.camera };
    expect(moved.x).toBe(30);

    bounds.value = BOUNDS;
    await nextTick();
    expect(instance.value!.camera).toEqual(moved);
  });

  it("still frames a late graph when nobody has touched the camera", async () => {
    const bounds = ref<Bounds | undefined>(undefined);
    const { instance } = mount({ contentBounds: bounds, fitOnLoad: true });
    await nextTick();
    expect(instance.value!.camera.k).toBe(1);

    bounds.value = BOUNDS;
    await nextTick();
    expect(instance.value!.camera.k).toBe(NODE_CANVAS_DEFAULTS.fitCap);

    // A graph that keeps growing is still followed: framing the content is not
    // the user taking over, so it must not switch the automatic fit off.
    bounds.value = { x: 0, y: 0, width: 2880, height: 2080 };
    await nextTick();
    expect(instance.value!.camera.k).toBe(0.25);
  });

  it("frames the graph once a canvas mounted inside a hidden tab becomes measurable", async () => {
    viewportRect = { width: 0, height: 0 };
    const { instance } = mount({ contentBounds: BOUNDS, fitOnLoad: true });
    await nextTick();
    expect(instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });

    viewportRect = { ...VIEWPORT };
    triggerResize();
    await nextTick();
    expect(instance.value!.camera.k).toBe(NODE_CANVAS_DEFAULTS.fitCap);
  });

  it("does not re-frame on reveal if the user moved the camera while it was hidden", async () => {
    viewportRect = { width: 0, height: 0 };
    const { instance } = mount({ contentBounds: BOUNDS, fitOnLoad: true });
    await nextTick();
    instance.value?.panBy(25, 5);

    viewportRect = { ...VIEWPORT };
    triggerResize();
    await nextTick();
    expect(instance.value!.camera).toEqual({ k: 1, x: 25, y: 5 });
  });

  it("leaves a controlled camera alone when the bounds cannot describe a fit", async () => {
    const onUpdate = vi.fn();
    const { instance } = mount({
      contentBounds: { x: 0, y: 0, width: 0, height: 0 },
      camera: { k: 0.123456, x: 5, y: 6 },
      fitOnLoad: true,
      "onUpdate:camera": onUpdate,
    });
    await nextTick();
    instance.value?.fit();
    expect(onUpdate).not.toHaveBeenCalled();
    expect(instance.value!.camera).toEqual({ k: 0.123456, x: 5, y: 6 });
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

  it("frames a graph too large for one grid step at the un-quantised ideal", async () => {
    // A fit that floors to zero is not a scale anything can be drawn at, and
    // refusing to frame would leave the graph at 1:1. Raising it to a whole
    // step instead would over-zoom — by an order of magnitude here.
    const huge = { x: 0, y: 0, width: 100000, height: 80000 };
    const { instance } = mount({ contentBounds: huge, minZoom: 0, fitOnLoad: true });
    await nextTick();
    expect(instance.value!.camera.k).toBe(0.0065);

    // ... and it stays inside the cap the host configured.
    const capped = mount({
      contentBounds: { x: 0, y: 0, width: 100000, height: 100000 },
      minZoom: 0.01,
      fitCap: 0.02,
      fitOnLoad: true,
    });
    await nextTick();
    expect(capped.instance.value!.camera.k).toBe(0.01);
  });

  it("answers an explicit fit after the host moved the camera itself", async () => {
    // A restored viewport or a minimap jump moves the controlled camera with no
    // gesture; a later fit() is the host asking to be framed and has to work.
    const camera = ref({ k: 1, x: 0, y: 0 });
    const { instance } = mount({
      contentBounds: BOUNDS,
      camera,
      "onUpdate:camera": (next: { k: number; x: number; y: number }) => {
        camera.value = next;
      },
    });
    await nextTick();
    expect(instance.value!.fit()).toBe(true);
    await nextTick();
    expect(camera.value.x).toBe(150);

    camera.value = { k: 1.25, x: 250, y: 175 };
    await nextTick();
    expect(instance.value!.fit()).toBe(true);
    await nextTick();
    expect(camera.value.x).toBe(150);
  });

  it("leaves the camera alone for bounds it cannot frame", async () => {
    const { instance } = mount({
      contentBounds: { x: Number.NaN, y: 0, width: 400, height: 200 },
      fitOnLoad: true,
    });
    await nextTick();
    expect(instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });

    const infinite = mount({
      contentBounds: { x: 0, y: 0, width: 400, height: Number.POSITIVE_INFINITY },
      fitOnLoad: true,
    });
    await nextTick();
    expect(infinite.instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });
  });

  it("keeps the view when the host hands control back", async () => {
    const camera = ref<{ k: number; x: number; y: number } | undefined>({ k: 1.5, x: 40, y: 25 });
    const { instance } = mount({ contentBounds: BOUNDS, camera, fitOnLoad: false });
    await nextTick();
    expect(instance.value!.camera).toEqual({ k: 1.5, x: 40, y: 25 });

    camera.value = undefined;
    await nextTick();
    expect(instance.value!.camera).toEqual({ k: 1.5, x: 40, y: 25 });
  });

  it("ends a pan when the window loses focus", async () => {
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    root.setPointerCapture = vi.fn();
    root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 31, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 31, clientX: 160, clientY: 100 }));
    const dragged = instance.value!.camera.x;
    window.dispatchEvent(new Event("blur"));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 31, clientX: 300, clientY: 100 }));
    expect(instance.value!.camera.x).toBe(dragged);
  });

  it("lets a host subtree inside its own chrome keep panning", async () => {
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false }, {
      overlay: () => h("div", { class: "hud" }, [h("div", { class: "card", "data-hk-canvas-pan": "" }, "hud card")]),
    });
    await nextTick();
    root.setPointerCapture = vi.fn();
    const card = root.querySelector<HTMLElement>(".hud .card")!;
    card.dispatchEvent(pointerEvent("pointerdown", { pointerId: 32, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 32, clientX: 160, clientY: 100 }));
    expect(instance.value!.camera.x).toBeCloseTo(60, 6);
  });

  it("keeps a captured drag alive across a button-less move", async () => {
    // Browsers can deliver a move whose `buttons` reads 0 in the middle of a
    // gesture; once the gesture is captured it is real, so it must not be
    // cancelled by one odd event.
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    root.setPointerCapture = vi.fn();
    root.releasePointerCapture = vi.fn();
    root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 21, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 21, clientX: 120, clientY: 100 }));
    root.dispatchEvent(
      pointerEvent("pointermove", { pointerId: 21, clientX: 140, clientY: 100, buttons: 0 }),
    );
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 21, clientX: 160, clientY: 100 }));
    expect(instance.value!.camera.x).toBeCloseTo(60, 6);
  });

  it("ends a pan when the button comes up anywhere on the page", async () => {
    // The release may land on a neighbouring pane; without a window-level
    // listener the next press-and-drag would resume the old gesture and jump.
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    root.setPointerCapture = vi.fn();
    root.dispatchEvent(pointerEvent("pointerdown", { pointerId: 22, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 22, clientX: 130, clientY: 100 }));
    const afterDrag = instance.value!.camera.x;
    document.body.dispatchEvent(
      pointerEvent("pointerup", { pointerId: 22, clientX: 130, clientY: 100, buttons: 0 }),
    );
    // A fresh, button-less drag from elsewhere must not move the camera.
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 22, clientX: 300, clientY: 280 }));
    expect(instance.value!.camera.x).toBe(afterDrag);
  });

  it("leaves the presses that belong to its own chrome alone", async () => {
    // Inspectors, rails and sliders live in the overlay; a press there is not a
    // pan. Hosts mark their own interactive nodes with the data attribute.
    const overlay = document.createElement("div");
    overlay.className = "hk-node-canvas-overlay";
    const slider = document.createElement("input");
    overlay.appendChild(slider);
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false }, {
      overlay: () => h("div", { class: "chrome" }, [h("input", { class: "slider" })]),
    });
    await nextTick();
    root.setPointerCapture = vi.fn();
    const chrome = root.querySelector<HTMLElement>(".hk-node-canvas-overlay")!;
    chrome.dispatchEvent(pointerEvent("pointerdown", { pointerId: 23, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 23, clientX: 200, clientY: 100 }));
    expect(instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });

    const marked = document.createElement("div");
    marked.setAttribute("data-hk-canvas-no-pan", "");
    root.appendChild(marked);
    marked.dispatchEvent(pointerEvent("pointerdown", { pointerId: 24, clientX: 100, clientY: 100 }));
    root.dispatchEvent(pointerEvent("pointermove", { pointerId: 24, clientX: 240, clientY: 100 }));
    expect(instance.value!.camera).toEqual({ k: 1, x: 0, y: 0 });
  });

  it("frames a host-supplied camera only when the host opts in", async () => {
    const camera = ref({ k: 1, x: 0, y: 0 });
    const onUpdate = (next: { k: number; x: number; y: number }) => {
      camera.value = next;
    };
    const optIn = mount(
      { contentBounds: BOUNDS, camera, fitOnLoad: true, fitControlled: true, "onUpdate:camera": onUpdate },
    );
    await nextTick();
    expect(camera.value.k).toBe(NODE_CANVAS_DEFAULTS.fitCap);
    optIn.instance.value?.fit();
    expect(camera.value.k).toBe(NODE_CANVAS_DEFAULTS.fitCap);
  });

  it("converges when the host frames on every render and rounds what it stores", async () => {
    // The real store rounds and clamps what it is given, so its value never
    // equals the request; a host that frames in its own update hook would then
    // ask for ever. One request has to stand until the host moves.
    const camera = ref({ k: 1, x: 0, y: 0 });
    let renders = 0;
    const instance = ref<Instance | null>(null);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const Root = defineComponent({
      setup() {
        onUpdated(() => {
          instance.value?.fit();
        });
        return () => {
          renders++;
          return h(HkNodeCanvas, {
            ref: instance as never,
            contentBounds: { x: 0, y: 0, width: 100, height: 1571 },
            camera: camera.value,
            fitControlled: true,
            "onUpdate:camera": (next: { k: number; x: number; y: number }) => {
              camera.value = { k: next.k, x: Math.round(next.x), y: Math.round(next.y) };
            },
          });
        };
      },
    });
    const app = createApp(Root);
    app.mount(container);
    apps.push(app);

    for (let frame = 0; frame < 6; frame++) await nextTick();
    expect(renders).toBeLessThan(12);
    expect(camera.value.k).toBe(0.3);
  });

  it("re-frames when the host mutates its bounds in place", async () => {
    const bounds = ref<Bounds | null>({ x: 0, y: 0, width: 400, height: 200 });
    const { instance } = mount({ contentBounds: bounds, fitOnLoad: true });
    await nextTick();
    expect(instance.value!.camera.k).toBe(NODE_CANVAS_DEFAULTS.fitCap);

    bounds.value!.width = 2880;
    bounds.value!.height = 2080;
    await nextTick();
    expect(instance.value!.camera.k).toBe(0.25);
  });

  it("reports whether fit actually changed anything", async () => {
    const { instance } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    expect(instance.value!.fit()).toBe(true);
    expect(instance.value!.fit()).toBe(false);
  });

  it("measures the wheel's focal point against the canvas, not the page", async () => {
    viewportOffset = { left: 120, top: 40 };
    const { instance, root } = mount({ contentBounds: BOUNDS, fitOnLoad: false });
    await nextTick();
    const local = { x: 600, y: 150 };
    const worldBefore = instance.value!.screenToWorld(local);
    const page = { x: local.x + viewportOffset.left, y: local.y + viewportOffset.top };
    root.dispatchEvent(wheelEvent({ deltaY: -100, clientX: page.x, clientY: page.y }));
    const worldAfter = instance.value!.screenToWorld(local);
    expect(instance.value!.camera.k).toBeGreaterThan(1);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 6);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 6);
    // A wheel read against the page point would settle somewhere else.
    expect(worldAfter.x).not.toBeCloseTo(instance.value!.screenToWorld(page).x, 3);
  });

  it("stops zooming at the configured range", async () => {
    const { instance } = mount({
      contentBounds: BOUNDS,
      minZoom: 0.5,
      maxZoom: 1,
      fitOnLoad: false,
    });
    await nextTick();
    for (let tick = 0; tick < 40; tick++) instance.value?.zoomBy(1);
    expect(instance.value!.camera.k).toBe(1);
    for (let tick = 0; tick < 40; tick++) instance.value?.zoomBy(-1);
    expect(instance.value!.camera.k).toBe(0.5);
  });

  it("derives the fit translation from the scale it renders, off the origin", async () => {
    const offset = { x: 300, y: 700, width: 100, height: 1571 };
    const { instance } = mount({ contentBounds: offset, fitOnLoad: true });
    await nextTick();
    const topLeft = instance.value!.worldToScreen({ x: offset.x, y: offset.y });
    expect(topLeft.x).toBeCloseTo((VIEWPORT.width - offset.width * instance.value!.camera.k) / 2, 6);
    expect(topLeft.y).toBeCloseTo((VIEWPORT.height - offset.height * instance.value!.camera.k) / 2, 6);
  });

  it("does not re-frame a visible canvas just because it was resized", async () => {
    const { instance } = mount({ contentBounds: BOUNDS, fitOnLoad: true });
    await nextTick();
    expect(instance.value!.camera.k).toBe(NODE_CANVAS_DEFAULTS.fitCap);
    viewportRect = { width: 400, height: 300 };
    triggerResize();
    await nextTick();
    expect(instance.value!.camera.k).toBe(NODE_CANVAS_DEFAULTS.fitCap);
  });

  it("fits the viewport it measured, not a truncated one", async () => {
    // 801.7 rounds to 802: with the rounded width a 2888-unit graph fits at
    // exactly 0.25, while a truncated 801 would land a step lower.
    viewportRect = { width: 801.7, height: 600 };
    const { instance } = mount({
      contentBounds: { x: 0, y: 0, width: 2888, height: 100 },
      fitOnLoad: true,
    });
    await nextTick();
    expect(instance.value!.camera.k).toBe(0.25);
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
