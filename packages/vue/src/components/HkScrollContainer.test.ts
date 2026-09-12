import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, reactive, ref } from "vue";

import HkScrollContainer from "./HkScrollContainer";

interface Mounted {
  app: ReturnType<typeof createApp>;
  container: HTMLElement;
  root: HTMLElement;
  viewport: HTMLElement;
  instance: {
    refresh: () => void;
    getOverflow: () => { horizontal: string; vertical: string };
    isNearEnd?: () => boolean;
    recheck?: () => void;
  } | null;
}

const scrolled: number[] = [];
const mounts: Mounted["app"][] = [];
const containers: HTMLElement[] = [];

/** Mount a HkScrollContainer with a default slot and capture its
 *  exposed instance (refresh / getOverflow) through a wrapper ref. */
function mountScroller(props: Record<string, unknown> = {}, slotText = "content"): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const instance = ref<Mounted["instance"] | null>(null);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkScrollContainer, { ref: instance as never, ...props }, {
          default: () => h("span", { class: "slot-marker" }, slotText),
        });
    },
  });

  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);

  const root = container.querySelector<HTMLElement>(".hk-scroll-container");
  const viewport = container.querySelector<HTMLElement>(".hk-scroll-container-viewport");
  if (!root || !viewport) throw new Error("HkScrollContainer did not render its shell");
  return { app, container, root, viewport, instance: instance.value };
}

/** happy-dom performs no layout, so scroll geometry is stubbed on the
 *  viewport instance (shadowing the prototype getters) before a
 *  refresh() pass re-senses the overflow. */
function stubGeometry(el: HTMLElement, geom: { scrollWidth?: number; clientHeight?: number; clientWidth?: number; scrollLeft?: number; scrollHeight?: number; scrollTop?: number }) {
  const desc: PropertyDescriptorMap = {};
  for (const [key, value] of Object.entries(geom)) {
    desc[key] = { configurable: true, get: () => value };
  }
  Object.defineProperties(el, desc);
}

afterEach(() => {
  for (const app of mounts.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
});

describe("HkScrollContainer alignment", () => {
  it("scrolls to an element by its laid-out distance, inside a scaled root", () => {
    // The target is compared against `scrollTop`, a layout number: measured
    // from drawn boxes it overshoots by (scale - 1) of the element's distance
    // from the visible top, and in a zoomed root that walks the element right
    // out of view.
    const m = mountScroller();
    stubGeometry(m.viewport, {
      scrollHeight: 2000, clientHeight: 400, scrollTop: 100,
      scrollWidth: 300, clientWidth: 300, scrollLeft: 0,
    });
    Object.defineProperty(m.viewport, "scrollTo", {
      configurable: true,
      value: (opts: { top: number }) => {
        scrolled.push(opts.top);
      },
    });
    // The viewport is drawn twice the size it is laid out at.
    const drawn = vi.spyOn(m.viewport, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 800, bottom: 800, width: 800, height: 800, x: 0, y: 0,
    } as DOMRect);
    Object.defineProperty(m.viewport, "offsetWidth", { configurable: true, get: () => 400 });
    Object.defineProperty(m.viewport, "offsetHeight", { configurable: true, get: () => 400 });
    void drawn;

    // The element sits 150 of the viewport's own pixels below its top edge.
    const target = document.createElement("div");
    m.viewport.appendChild(target);
    Object.defineProperty(target, "offsetParent", { configurable: true, get: () => m.viewport });
    Object.defineProperty(target, "offsetLeft", { configurable: true, get: () => 0 });
    Object.defineProperty(target, "offsetTop", { configurable: true, get: () => 150 });
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 600, right: 100, bottom: 700, width: 100, height: 100, x: 0, y: 600,
    } as DOMRect);

    (m.instance as unknown as { scrollToElement: (el: HTMLElement) => void }).scrollToElement(target);
    expect(scrolled.at(-1), "150 of the viewport's own pixels, not the drawn 300").toBe(150);
  });
  it("renders the slot bare without an align prop", () => {
    const m = mountScroller();
    expect(m.root.hasAttribute("data-align")).toBe(false);
    expect(m.root.querySelector(".hk-scroll-container-aligner")).toBeNull();
    expect(m.viewport.querySelector(".slot-marker")).not.toBeNull();
  });

  it("wraps the slot in an auto-margin aligner with align=center", () => {
    const m = mountScroller({ axis: "horizontal", align: "center" });
    expect(m.root.getAttribute("data-align")).toBe("center");
    const aligner = m.root.querySelector<HTMLElement>(".hk-scroll-container-aligner");
    expect(aligner).not.toBeNull();
    expect(aligner?.querySelector(".slot-marker")).not.toBeNull();
  });

  it("ignores align=center on non-horizontal containers", () => {
    const vertical = mountScroller({ axis: "vertical", align: "center" });
    expect(vertical.root.hasAttribute("data-align")).toBe(false);
    expect(vertical.root.querySelector(".hk-scroll-container-aligner")).toBeNull();
    const both = mountScroller({ axis: "both", align: "center" });
    expect(both.root.hasAttribute("data-align")).toBe(false);
    expect(both.root.querySelector(".hk-scroll-container-aligner")).toBeNull();
  });

  it("mirrors the fade prop as data-fade", () => {
    const plain = mountScroller({ axis: "horizontal" });
    expect(plain.root.hasAttribute("data-fade")).toBe(false);
    const faded = mountScroller({ axis: "horizontal", fade: true });
    expect(faded.root.getAttribute("data-fade")).toBe("true");
  });
});

describe("HkScrollContainer overflow sensing", () => {
  it("reports none while the content fits", () => {
    const m = mountScroller({ axis: "horizontal" });
    expect(m.root.getAttribute("data-h-overflow")).toBe("none");
    expect(m.instance?.getOverflow()).toEqual({ horizontal: "none", vertical: "none" });
  });

  it("senses hidden content towards the end at the start edge", () => {
    const m = mountScroller({ axis: "horizontal" });
    stubGeometry(m.viewport, { scrollWidth: 300, clientWidth: 100, scrollLeft: 0 });
    m.instance?.refresh();
    expect(m.root.getAttribute("data-h-overflow")).toBe("end");
  });

  it("senses hidden content towards the start at the end edge", () => {
    const m = mountScroller({ axis: "horizontal" });
    stubGeometry(m.viewport, { scrollWidth: 300, clientWidth: 100, scrollLeft: 200 });
    m.instance?.refresh();
    expect(m.root.getAttribute("data-h-overflow")).toBe("start");
  });

  it("senses both edges mid-scroll", () => {
    const m = mountScroller({ axis: "horizontal" });
    stubGeometry(m.viewport, { scrollWidth: 300, clientWidth: 100, scrollLeft: 100 });
    m.instance?.refresh();
    expect(m.root.getAttribute("data-h-overflow")).toBe("both");
  });

  it("keeps the horizontal axis at none for vertical-only containers", () => {
    const m = mountScroller({ axis: "vertical" });
    stubGeometry(m.viewport, { scrollWidth: 300, clientWidth: 100, scrollLeft: 0 });
    m.instance?.refresh();
    expect(m.root.getAttribute("data-h-overflow")).toBe("none");
  });
});

describe("HkScrollContainer scrollbar reactivity", () => {
  it("builds and tears down the overlay tracks when the scrollbar prop flips", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);

    const props = reactive<Record<string, unknown>>({ scrollbar: false });
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkScrollContainer, { ...props }, { default: () => h("span", "content") });
      },
    });
    const app = createApp(Wrapper);
    mounts.push(app);
    app.mount(container);

    const root = container.querySelector<HTMLElement>(".hk-scroll-container")!;
    expect(root.querySelectorAll(".hk-scrollbar-track").length).toBe(0);

    props.scrollbar = true;
    await nextTick();
    expect(root.querySelectorAll(".hk-scrollbar-track").length).toBeGreaterThan(0);

    props.scrollbar = false;
    await nextTick();
    expect(root.querySelectorAll(".hk-scrollbar-track").length).toBe(0);
  });
});

describe("HkScrollContainer approachEnd", () => {
  /** Two awaited frames: scheduleFrame's scheduling rAF + the composable's
   *  onceFrame initial sensing pass. */
  async function flushFrames(): Promise<void> {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  it("emits approachEnd for under-filled content and exposes isNearEnd", async () => {
    const emissions: number[] = [];
    const m = mountScroller({ approachEnd: true, onApproachEnd: () => emissions.push(1) });
    // happy-dom has no layout; a real under-filled DOM reports the
    // CSSOM clamp (scrollHeight == clientHeight), so stub THAT.
    stubGeometry(m.viewport, { scrollHeight: 300, clientHeight: 300, scrollTop: 0 });
    await flushFrames();
    expect(emissions.length).toBe(1);
    expect(m.instance?.isNearEnd?.()).toBe(true);
  });

  it("does not emit when the prop is off", async () => {
    const emissions: number[] = [];
    mountScroller({ onApproachEnd: () => emissions.push(1) });
    await flushFrames();
    expect(emissions.length).toBe(0);
  });

  it("exposes recheck and honours it at the container level", async () => {
    const emissions: number[] = [];
    const m = mountScroller({ approachEnd: true, onApproachEnd: () => emissions.push(1) });
    stubGeometry(m.viewport, { scrollHeight: 300, clientHeight: 300, scrollTop: 0 });
    await flushFrames();
    expect(emissions.length).toBe(1);
    // Pin recheck on the exposed surface: dropping it from expose() must
    // fail here, not just at the composable level.
    expect(typeof m.instance?.recheck).toBe("function");
    m.instance?.recheck?.();
    await flushFrames();
    expect(emissions.length).toBe(2);
  });
});
