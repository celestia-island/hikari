import { afterEach, describe, expect, it } from "vitest";
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
  } | null;
}

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
function stubGeometry(el: HTMLElement, geom: { scrollWidth?: number; clientWidth?: number; scrollLeft?: number }) {
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
