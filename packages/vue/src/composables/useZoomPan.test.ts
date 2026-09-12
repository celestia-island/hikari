import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

import { useZoomPan } from "./useZoomPan";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const m of mounts.splice(0)) {
    m.app.unmount();
    m.container.remove();
  }
});

/** Mount a host that binds the composable's container ref to a real element. */
async function mountHost() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const el = ref<HTMLElement | null>(null);
  const content = ref<HTMLElement | null>(null);
  let api!: ReturnType<typeof useZoomPan>;
  const Host = defineComponent({
    setup() {
      api = useZoomPan({ containerRef: el, contentRef: content });
      return () =>
        h("div", { ref: (r: unknown) => (el.value = r as HTMLElement) }, [
          h("div", { ref: (r: unknown) => (content.value = r as HTMLElement) }),
        ]);
    },
  });
  const app = createApp(Host);
  app.mount(container);
  mounts.push({ app, container });
  await nextTick();
  return { container, viewport: () => el.value as HTMLElement, api: () => api };
}

function pointer(type: string, id: number, x: number, y: number): PointerEvent {
  return new PointerEvent(type, { bubbles: true, pointerId: id, pointerType: "touch", clientX: x, clientY: y });
}

describe("useZoomPan", () => {
  /** The composable only pans once the view is zoomed in (`zoom < 1`), and it
   *  clamps the pan to the overflow it can measure — which a layout-less
   *  environment has none of. Both are stated here: this file is about the pan
   *  maths, not about the zoom state machine. */
  async function zoomIn(api: () => ReturnType<typeof useZoomPan>, el: HTMLElement) {
    Object.defineProperty(el, "clientWidth", { configurable: true, get: () => 400 });
    Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 300 });
    Object.defineProperty(el.firstElementChild!, "scrollWidth", { configurable: true, get: () => 2000 });
    Object.defineProperty(el.firstElementChild!, "scrollHeight", { configurable: true, get: () => 1500 });
    api().zoom.value = 0.5;
    await nextTick();
    expect(api().isZoomed.value, "the view has something to pan").toBe(true);
  }

  it("wires its gestures once the host has mounted", async () => {
    const { viewport, api } = await mountHost();
    const el = viewport();
    await zoomIn(api, el);
    // The drag has to reach the composable at all: wiring it inline in
    // `setup` left the ref empty and every gesture unattached.
    el.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    el.dispatchEvent(pointer("pointermove", 1, 140, 160));
    await nextTick();
    expect(api().panX.value, "40 drawn px in an unscaled space").toBeCloseTo(40, 5);
    expect(api().panY.value).toBeCloseTo(60, 5);
    el.dispatchEvent(pointer("pointerup", 1, 140, 160));
  });

  it("pans by the pointer's own distance inside a scaled root", async () => {
    const { viewport, api } = await mountHost();
    const el = viewport();
    await zoomIn(api, el);
    // The container is drawn twice the size it is laid out at.
    Object.defineProperty(el, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0 }) as DOMRect,
    });
    Object.defineProperty(el, "offsetWidth", { configurable: true, get: () => 400 });
    Object.defineProperty(el, "offsetHeight", { configurable: true, get: () => 300 });

    el.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    el.dispatchEvent(pointer("pointermove", 1, 140, 160));
    await nextTick();
    expect(api().panX.value, "40 drawn px are 20 of the container's own").toBeCloseTo(20, 5);
    expect(api().panY.value, "60 drawn px are 30 of the container's own").toBeCloseTo(30, 5);
    el.dispatchEvent(pointer("pointerup", 1, 140, 160));
  });
});
