// AI-generated: developed with a DeepSeek Harness agent (model GLM-5.3-flash); human-directed.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";

import HkMasonry from "./HkMasonry";

/**
 * HkMasonry tests — the packing MECHANISM: reading-order greedy fill while
 * heights are unknown, the measured-height re-pack (including the wowsp
 * spec-panel regression: a card GROWS in place and the cards below it must
 * re-pack, not stay clipped under a stale column height), the width-derived
 * column count, and the empty-column collapse.
 */

interface ROEntry {
  target: HTMLElement;
  contentRect: { width: number; height: number };
}

/** Minimal ResizeObserver fake the suite drives by hand. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: (entries: ROEntry[]) => void;
  observed = new Set<HTMLElement>();

  constructor(callback: (entries: ROEntry[]) => void) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }
  observe(el: HTMLElement): void {
    this.observed.add(el);
  }
  unobserve(el: HTMLElement): void {
    this.observed.delete(el);
  }
  disconnect(): void {
    this.observed.clear();
  }
  fire(entries: ROEntry[]): void {
    this.callback(entries);
  }
  /** The spec's initial observation: observe() reports the current size. */
  fireInitial(width: number, heightOf: (el: HTMLElement) => number): void {
    this.fire([...this.observed].map((el) => ({ target: el, contentRect: { width, height: heightOf(el) } })));
  }
}

const apps: App[] = [];
const containers: HTMLElement[] = [];

beforeEach(() => {
  FakeResizeObserver.instances = [];
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
});

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const el of containers.splice(0)) el.remove();
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
});

interface Mounted {
  app: App;
  root: HTMLElement;
  /** Every ResizeObserver the component created: [cards, root]. */
  observers: FakeResizeObserver[];
}

function mount(props: Record<string, unknown>): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const cardSlot = ({ item }: { item: unknown }) => h("div", { class: "card" }, String(item));
  // Item-name keys by default: the RO height tables below are keyed "a".."e",
  // so the wrappers' data-masonry-key must match (the positional fallback
  // would key them "0".."n" and every fired report would miss).
  const keyed = { itemKeyOf: (item: unknown) => String(item), ...props };
  const Root = defineComponent({
    setup() {
      return () => h(HkMasonry, { items: (props.items ?? []) as never, ...keyed }, { card: cardSlot });
    },
  });
  const app = createApp(Root);
  app.mount(container);
  apps.push(app);
  return {
    app,
    root: container,
    observers: FakeResizeObserver.instances.filter((ro) => ro.observed.size > 0 || FakeResizeObserver.instances.length > 0),
  };
}

/** The card observer: the one watching card wrappers (it has the most). */
function cardObserver(mounted: Mounted): FakeResizeObserver {
  return mounted.observers.reduce((a, b) => (b.observed.size > a.observed.size ? b : a));
}

/** Per-column card TEXT (the slot renders String(item)) — the packing
 *  assertion reads placement, not identity; dataset keys are positional
 *  unless itemKeyOf is set, and one test pins those separately. */
function columnKeys(root: HTMLElement): string[][] {
  return [...root.querySelectorAll<HTMLElement>(".hk-masonry-col")].map((col) =>
    [...col.querySelectorAll<HTMLElement>(".card")].map((el) => el.textContent ?? ""),
  );
}

function cardEls(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(".hk-masonry-card")];
}

describe("HkMasonry", () => {
  it("packs count-greedy in reading order while heights are unknown", () => {
    const mounted = mount({ items: ["a", "b", "c", "d", "e"], columns: 3 });
    // forward greedy: a->0, b->1, c->2, d->0, e->1
    expect(columnKeys(mounted.root)).toEqual([["a", "d"], ["b", "e"], ["c"]]);
  });

  it("re-packs by measured heights once the observers report", async () => {
    const mounted = mount({ items: ["a", "b", "c", "d", "e"], columns: 3 });
    const ro = cardObserver(mounted);
    await fireHeights(mounted, ro, { a: 300, b: 10, c: 10, d: 10, e: 10 });
    // totals after each drop: a->0(300), b->1(10), c->2(10), d->1(20), e->2(20)
    expect(columnKeys(mounted.root)).toEqual([["a"], ["b", "d"], ["c", "e"]]);
  });

  it("re-packs when a card grows in place — the stale-balancer regression", async () => {
    const mounted = mount({ items: ["a", "b", "c", "d", "e"], columns: 3 });
    const ro = cardObserver(mounted);
    await fireHeights(mounted, ro, { a: 300, b: 10, c: 10, d: 10, e: 10 });
    expect(columnKeys(mounted.root)).toEqual([["a"], ["b", "d"], ["c", "e"]]);
    // b grows past a: the walk now strands later cards in the tail column
    // instead of freezing the old geometry (multicol kept the pre-change
    // column height and clipped — flex columns re-pack whole cards).
    await fireHeights(mounted, ro, { a: 300, b: 400, c: 10, d: 10, e: 10 });
    expect(columnKeys(mounted.root)).toEqual([["a"], ["b"], ["c", "d", "e"]]);
  });

  it("derives the column count from the measured width under columns=auto", async () => {
    const mounted = mount({ items: ["a", "b", "c"], columns: "auto", columnMinWidth: 220 });
    const rootRo = mounted.observers[mounted.observers.length - 1];
    rootRo.fire([{ target: mounted.root.querySelector(".hk-masonry")!, contentRect: { width: 900, height: 0 } }]);
    await nextTick();
    expect(mounted.root.querySelector(".hk-masonry")?.getAttribute("data-columns")).toBe("4");
    rootRo.fire([{ target: mounted.root.querySelector(".hk-masonry")!, contentRect: { width: 500, height: 0 } }]);
    await nextTick();
    expect(mounted.root.querySelector(".hk-masonry")?.getAttribute("data-columns")).toBe("2");
  });

  it("collapses columns that received no card", () => {
    const mounted = mount({ items: ["a"], columns: 3 });
    const empties = [...mounted.root.querySelectorAll<HTMLElement>(".hk-masonry-col[data-empty]")];
    expect(empties).toHaveLength(2);
    expect(columnKeys(mounted.root)).toEqual([["a"], [], []]);
  });

  it("keys cards through itemKeyOf and falls back to position", () => {
    const keyed = mount({ items: ["a", "b"], columns: 2, itemKeyOf: (item: unknown) => `k-${String(item)}` });
    expect(cardEls(keyed.root).map((el) => el.dataset.masonryKey)).toEqual(["k-a", "k-b"]);
    // explicit undefined overrides the harness default — this IS the
    // positional-fallback case
    const positional = mount({ items: ["a", "b"], columns: 2, itemKeyOf: undefined });
    expect(cardEls(positional.root).map((el) => el.dataset.masonryKey)).toEqual(["0", "1"]);
  });

  it("ignores zero-height reports instead of poisoning the height table", async () => {
    const mounted = mount({ items: ["a", "b", "c", "d"], columns: 2 });
    const ro = cardObserver(mounted);
    await fireHeights(mounted, ro, { a: 100, b: 50, c: 50, d: 50 });
    expect(columnKeys(mounted.root)).toEqual([["a", "d"], ["b", "c"]]);
    // a collapses (display:none) — the stale height must survive the 0.
    await fireHeights(mounted, ro, { a: 0, b: 50, c: 50, d: 50 });
    expect(columnKeys(mounted.root)).toEqual([["a", "d"], ["b", "c"]]);
  });

  it("renders without ResizeObserver (SSR-ish hosts) and still lays out", () => {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    const mounted = mount({ items: ["a", "b", "c"], columns: 2 });
    expect(columnKeys(mounted.root)).toEqual([["a", "c"], ["b"]]);
  });

  it("renders the empty slot for an empty stream", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const Root = defineComponent({
      setup() {
        return () =>
          h(HkMasonry, { items: [] as never, columns: 2 }, { empty: () => h("p", { class: "none" }, "nothing") });
      },
    });
    const app = createApp(Root);
    app.mount(container);
    apps.push(app);
    expect(container.querySelector(".none")?.textContent).toBe("nothing");
    expect(container.querySelectorAll(".hk-masonry-col")).toHaveLength(0);
  });
});

async function fireHeights(
  mounted: Mounted,
  ro: FakeResizeObserver,
  heights: Record<string, number>,
): Promise<void> {
  ro.fire(cardEls(mounted.root).map((el) => ({
    target: el,
    contentRect: { width: 200, height: heights[el.dataset.masonryKey ?? ""] ?? 0 },
  })));
  // the height table lands through Vue's async render effect
  await nextTick();
}
