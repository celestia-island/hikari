import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";

import HkBlankCanvas from "./HkBlankCanvas";

/**
 * HkBlankCanvas tests — the size-ready gate, the resize/teardown signals and
 * the overlay layer. The gate is the part worth pinning: initialising a
 * renderer against a 0 × 0 element is what makes a 3D view flash a wrong
 * first frame.
 */

const apps: App[] = [];
let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;
let nextSize = { width: 0, height: 0 };
/** Captured by the ResizeObserver stub so a test can drive a resize. */
let observed: (() => void) | null = null;

beforeEach(() => {
  observed = null;
  originalRect = HTMLElement.prototype.getBoundingClientRect;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    if (this.classList?.contains("hk-blank-canvas-mount")) {
      return {
        width: nextSize.width,
        height: nextSize.height,
        top: 0,
        left: 0,
        right: nextSize.width,
        bottom: nextSize.height,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return originalRect.call(this);
  };
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
    constructor(callback: () => void) {
      observed = callback;
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

/** The component measures inside a rAF, so tests wait one. */
const oneFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

function mount(props: Record<string, unknown>, slots: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const Root = defineComponent({
    setup() {
      return () => h(HkBlankCanvas, props as never, slots);
    },
  });
  const app = createApp(Root);
  app.mount(container);
  apps.push(app);
  return container;
}

describe("HkBlankCanvas", () => {
  it("does not mount while the element measures 0x0", async () => {
    const onMount = vi.fn();
    nextSize = { width: 0, height: 0 };
    const root = mount({ onMount });
    await nextTick();
    await oneFrame();
    expect(onMount).not.toHaveBeenCalled();
    expect(root.querySelector(".hk-blank-canvas")?.hasAttribute("data-ready")).toBe(false);
  });

  it("mounts once the element has a size, and reports it", async () => {
    const onMount = vi.fn();
    nextSize = { width: 800, height: 600 };
    const root = mount({ onMount });
    await nextTick();
    await oneFrame();
    expect(onMount).toHaveBeenCalledTimes(1);
    const [el, size] = onMount.mock.calls[0];
    expect((el as HTMLElement).classList.contains("hk-blank-canvas-mount")).toBe(true);
    expect(size).toEqual({ width: 800, height: 600 });
    await nextTick();
    expect(root.querySelector(".hk-blank-canvas")?.hasAttribute("data-ready")).toBe(true);
  });

  it("reports a later size change as a resize, never as a second mount", async () => {
    const onMount = vi.fn();
    const onResize = vi.fn();
    nextSize = { width: 800, height: 600 };
    mount({ onMount, onResize });
    await nextTick();
    await oneFrame();
    expect(onMount).toHaveBeenCalledTimes(1);

    nextSize = { width: 1024, height: 768 };
    observed?.();
    await nextTick();
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onResize).toHaveBeenCalledWith({ width: 1024, height: 768 });
  });

  it("does not report a resize when the box did not change", async () => {
    const onResize = vi.fn();
    nextSize = { width: 800, height: 600 };
    mount({ onResize });
    await nextTick();
    await oneFrame();
    observed?.();
    await nextTick();
    expect(onResize).not.toHaveBeenCalled();
  });

  it("signals teardown only after a successful mount", async () => {
    const onUnmount = vi.fn();
    nextSize = { width: 0, height: 0 };
    mount({ onUnmount });
    await nextTick();
    await oneFrame();
    for (const app of apps.splice(0)) app.unmount();
    expect(onUnmount).not.toHaveBeenCalled();

    // The same teardown after a real mount does fire.
    nextSize = { width: 640, height: 480 };
    mount({ onUnmount });
    await nextTick();
    await oneFrame();
    for (const app of apps.splice(0)) app.unmount();
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it("renders the overlay above the mount", async () => {
    nextSize = { width: 10, height: 10 };
    const root = mount({}, { overlay: () => h("div", { class: "hud" }, "hud") });
    await nextTick();
    const overlay = root.querySelector(".hk-blank-canvas-overlay");
    expect(overlay?.querySelector(".hud")?.textContent).toBe("hud");
  });
});
