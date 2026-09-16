import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App, type Ref } from "vue";

import HkWaterfall from "./HkWaterfall";

/**
 * HkWaterfall tests — the MECHANISM the chat waterfalls share:
 * bucketing, column distribution (including the "older items never change
 * column" invariant), the empty state, and the exposed scroll API.
 */

interface WaterfallInstance {
  getScrollElement: () => HTMLElement | undefined;
  jumpToBucket: (key: string) => void;
  backToTop: () => void;
  /** Exposed refs are unwrapped by Vue, so this is the array itself. */
  buckets: { key: string; items: readonly unknown[] }[];
}

interface Mounted {
  app: App;
  root: HTMLElement;
  instance: Ref<WaterfallInstance | null>;
}

const apps: App[] = [];
const containers: HTMLElement[] = [];
let originalRect: typeof HTMLElement.prototype.getBoundingClientRect;

beforeEach(() => {
  originalRect = HTMLElement.prototype.getBoundingClientRect;
  (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class {
    observe(): void {}
    disconnect(): void {}
    unobserve(): void {}
  };
});

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  HTMLElement.prototype.getBoundingClientRect = originalRect;
});

function rectOf(top: number, left = 0, width = 10, height = 100): DOMRect {
  return {
    x: left,
    y: top,
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function mount(props: Record<string, unknown>, withEmpty = false): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);

  const instance = ref<WaterfallInstance | null>(null);
  const cardSlot = ({ item }: { item: unknown }) => h("div", { class: "card" }, String(item));
  const slots = withEmpty
    ? { card: cardSlot, empty: () => h("p", { class: "none" }, "none") }
    : { card: cardSlot };
  const Root = defineComponent({
    setup() {
      return () =>
        h(
          HkWaterfall,
          // `items` is spelled out (not only spread) so the required prop is
          // visible to the overload: a spread of Record<string, unknown>
          // collapses to `{ ref }` in the literal type.
          { ref: instance as never, items: (props.items ?? []) as never, ...props },
          slots,
        );
    },
  });
  const app = createApp(Root);
  app.mount(container);
  apps.push(app);
  return { app, root: container, instance };
}

/** Text of every card inside one column, in render order. */
function columnTexts(root: HTMLElement, columnIndex: number): string[] {
  const columns = root.querySelectorAll<HTMLElement>(".hk-waterfall-column");
  const column = columns[columnIndex];
  if (!column) return [];
  return [...column.querySelectorAll<HTMLElement>(".card")].map((el) => el.textContent ?? "");
}

describe("HkWaterfall", () => {
  it("lays a bucket out newest-first across columns, walking oldest first", async () => {
    // Three columns on purpose: with two, the mirrored greedy walk lands on
    // the same layout, so the case could not tell the two directions apart
    // (found by mutation — the newest-first variant survived the 2-column
    // fixture).
    const mounted = mount({ items: ["a", "b", "c", "d", "e"], columns: 3 });
    await nextTick();
    // Walk oldest -> newest into the shortest column, then keep newest-first:
    //   e -> col0; d -> col1; c -> col2; b -> col0; a -> col1
    expect(columnTexts(mounted.root, 0)).toEqual(["b", "e"]);
    expect(columnTexts(mounted.root, 1)).toEqual(["a", "d"]);
    expect(columnTexts(mounted.root, 2)).toEqual(["c"]);
  });

  it("keeps older items in their column when a newer item is prepended", async () => {
    const before = mount({ items: ["a", "b", "c"], columns: 2 });
    await nextTick();
    expect(columnTexts(before.root, 0)).toEqual(["a", "c"]);
    expect(columnTexts(before.root, 1)).toEqual(["b"]);
    before.app.unmount();

    const after = mount({ items: ["z", "a", "b", "c"], columns: 2 });
    await nextTick();
    // Only the receiving column changes; the other keeps its exact contents.
    expect(columnTexts(after.root, 0)).toEqual(["a", "c"]);
    expect(columnTexts(after.root, 1)).toEqual(["z", "b"]);
  });

  it("renders one unnamed bucket for an ungrouped list", async () => {
    const mounted = mount({ items: ["a", "b"], columns: 1 });
    await nextTick();
    const sections = mounted.root.querySelectorAll("[data-waterfall-bucket]");
    expect(sections).toHaveLength(1);
    expect(sections[0].getAttribute("data-waterfall-bucket")).toBe("");
    expect(columnTexts(mounted.root, 0)).toEqual(["a", "b"]);
  });

  it("groups into buckets in first-seen order and keeps the sections addressable", async () => {
    const mounted = mount({
      items: ["a1", "a2", "b1"],
      bucketOf: (item: unknown) => String(item)[0],
      columns: 1,
    });
    await nextTick();
    const sections = [...mounted.root.querySelectorAll<HTMLElement>("[data-waterfall-bucket]")];
    expect(sections.map((s) => s.dataset.waterfallBucket)).toEqual(["a", "b"]);
    expect(columnTexts(mounted.root, 0)).toEqual(["a1", "a2"]);
  });

  it("reports its buckets through the exposed instance", async () => {
    const mounted = mount({
      items: ["a1", "a2", "b1"],
      bucketOf: (item: unknown) => String(item)[0],
    });
    await nextTick();
    expect(mounted.instance.value?.buckets.map((b) => b.key)).toEqual(["a", "b"]);
    expect(mounted.instance.value?.buckets[0].items).toEqual(["a1", "a2"]);
  });

  it("scrolls to a bucket section and back to the top", async () => {
    const mounted = mount({
      items: ["a1", "b1"],
      bucketOf: (item: unknown) => String(item)[0],
    });
    await nextTick();
    await nextTick();
    const scroller = mounted.instance.value?.getScrollElement();
    expect(scroller).toBeTruthy();
    const scrollTo = vi.fn();
    (scroller as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo;

    mounted.instance.value?.jumpToBucket("b");
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo.mock.calls[0][0]).toMatchObject({ behavior: "smooth" });

    mounted.instance.value?.backToTop();
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo.mock.calls[1][0]).toMatchObject({ top: 0, behavior: "smooth" });

    // An unknown bucket key is a no-op, not a throw: the jump is driven by
    // data the host may have replaced mid-render.
    mounted.instance.value?.jumpToBucket("nope");
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it("renders the empty slot when there is nothing to show", async () => {
    const mounted = mount({ items: [] }, true);
    await nextTick();
    expect(mounted.root.querySelector(".none")?.textContent).toBe("none");
    expect(mounted.root.querySelectorAll("[data-waterfall-bucket]")).toHaveLength(0);
  });

  it("holds the back-to-top signal through the hysteresis band", async () => {
    const backTop: boolean[] = [];

    const mounted = mount({
      items: ["a1"],
      backTopShow: 10,
      backTopHide: 4,
      "onUpdate:backTopVisible": (v: boolean) => backTop.push(v),
    });
    await nextTick();
    await nextTick();

    const scroller = mounted.instance.value?.getScrollElement();
    expect(scroller).toBeTruthy();

    const scrollTo = async (top: number) => {
      Object.defineProperty(scroller, "scrollTop", { value: top, configurable: true });
      scroller?.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await nextTick();
    };

    await scrollTo(50);
    expect(backTop).toEqual([true]);

    // Inside the band (hide < top < show) the signal holds and emits
    // nothing — the hysteresis a plain `top > show` test would lose.
    await scrollTo(6);
    expect(backTop).toEqual([true]);

    await scrollTo(2);
    expect(backTop).toEqual([true, false]);
  });

  it("publishes the active bucket and the back-to-top signal from one scroll pass", async () => {
    const items = ["a1", "b1"];
    const active: string[] = [];
    const backTop: boolean[] = [];

    // Scripted geometry: the scroller's own box sits at top 0 and the day
    // sections at 0 / 10 — the second section has passed the 24px threshold,
    // so it is the active one once the viewport has scrolled.
    HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
      if (this.getAttribute?.("data-waterfall-bucket") === "b") return rectOf(10);
      return rectOf(0, 0, 10, 300);
    };

    const mounted = mount({
      items,
      bucketOf: (item: unknown) => String(item)[0],
      backTopShow: 10,
      "onUpdate:activeBucket": (v: string) => active.push(v),
      "onUpdate:backTopVisible": (v: boolean) => backTop.push(v),
    });
    await nextTick();
    await nextTick();

    const scroller = mounted.instance.value?.getScrollElement();
    expect(scroller).toBeTruthy();
    Object.defineProperty(scroller, "scrollTop", { value: 50, configurable: true });
    scroller?.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await nextTick();
    await nextTick();

    expect(active.at(-1)).toBe("b");
    expect(backTop.at(-1)).toBe(true);
  });
});
