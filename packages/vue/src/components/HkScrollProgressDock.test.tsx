// Scroll-progress dock: registration contract, sensing behavior, the
// HkAdminTablePage page dock, the lazy levers and the pill composition.
// Geometry is stubbed the same way the overlay-scrollbar tests do it
// (happy-dom performs no layout) — Object.defineProperties for the
// viewport's scroll numbers, spyOn for the getBoundingClientRect boxes
// the band reads. Sensing is rAF-coalesced (the dock owns its scroll
// listener), so a pass is driven by dispatching a scroll event and
// waiting one frame (flushSense) instead of the container's old
// synchronous refresh().
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, inject, nextTick, onMounted, onUnmounted, provide, ref } from "vue";

import HkScrollContainer from "./HkScrollContainer";
import { HkAdminTablePage } from "./HkAdminTablePage";
import HTable from "./HkTable";
import { HkCardList, HkListRow } from "./HkCardList";
import HkScrollProgressDock, {
  HK_SCROLL_PROGRESS_ALLOWED,
  HK_SCROLL_PROGRESS_DOCK_ACTIVE,
  HK_SCROLL_PROGRESS_REGISTRAR,
  type HkScrollProgressHandle,
  type HkScrollProgressRegistrar,
} from "./HkScrollProgressDock";
import { setLocale } from "../i18n/context";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];
const rects: Array<ReturnType<typeof vi.spyOn>> = [];
let localeTouched = false;

/** Injectable ResizeObserver: records every instance so the unmount
 *  cleanup test can pin that the dock DISCONNECTED its observers (the
 *  house FakeResizeObserver harness, HkAuthCard precedent). */
class FakeResizeObserver implements ResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;

  constructor(_callback: (...args: never[]) => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element): void {
    this.observed.push(el);
  }
  unobserve(): void {}
  disconnect(): void {
    this.disconnected = true;
  }
}

const originalRO = globalThis.ResizeObserver;

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.ResizeObserver = originalRO;
  if (localeTouched) {
    localeTouched = false;
    await setLocale("en");
  }
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  for (const spy of rects.splice(0)) spy.mockRestore();
});

function mountTree(root: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => root });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

/** One rAF-coalesced sensing pass with real timers: dispatch the scroll
 *  the dock listens for, then let the animation bus drain a frame. */
async function flushSense() {
  await new Promise((resolve) => setTimeout(resolve, 60));
  await nextTick();
}

interface Scroller {
  container: HTMLElement;
  viewport: HTMLElement;
  host: HTMLElement;
  pill: () => HTMLElement | null;
  pills: () => NodeListOf<HTMLElement>;
  scopes: () => NodeListOf<HTMLElement>;
  setScrollTop: (top: number) => void;
  scrollPass: () => Promise<void>;
}

/** Mount a HkScrollContainer with an HkScrollProgressDock in its slot
 *  (the container publishes the viewport + host the dock injects).
 *  scrollTop rides a mutable cell so successive passes can move it. */
function mountScroller(
  slot: () => ReturnType<typeof h>,
  dockProps: Record<string, unknown> = {},
  scrollerProps: Record<string, unknown> = {},
): Scroller {
  let scrollTop = 0;
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkScrollContainer, scrollerProps, {
          default: () => h(HkScrollProgressDock, dockProps, { default: slot }),
        });
    },
  });
  const container = mountTree(h(Wrapper));
  const viewport = container.querySelector<HTMLElement>(".hk-scroll-container-viewport");
  if (!viewport) throw new Error("container did not render its viewport");
  Object.defineProperties(viewport, {
    scrollHeight: { configurable: true, get: () => 2000 },
    clientHeight: { configurable: true, get: () => 400 },
    scrollWidth: { configurable: true, get: () => 300 },
    clientWidth: { configurable: true, get: () => 300 },
    scrollLeft: { configurable: true, get: () => 0 },
    scrollTop: { configurable: true, get: () => scrollTop },
  });
  rects.push(vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400, x: 0, y: 0,
  } as DOMRect));
  const host = container.querySelector<HTMLElement>(".hk-scroll-container");
  if (!host) throw new Error("container did not render its host");
  return {
    container,
    viewport,
    host,
    pill: () => container.querySelector<HTMLElement>(".hk-scroll-progress-dock"),
    pills: () => container.querySelectorAll<HTMLElement>(".hk-scroll-progress-dock"),
    scopes: () => container.querySelectorAll<HTMLElement>(".hk-scroll-progress-dock-scope"),
    setScrollTop: (top: number) => {
      scrollTop = top;
    },
    scrollPass: async () => {
      viewport.dispatchEvent(new Event("scroll"));
      await flushSense();
    },
  };
}

/** The two localized halves of the range sentence, in DOM order. */
function pillParts(pill: HTMLElement): string[] {
  return Array.from(pill.querySelectorAll<HTMLElement>(".hk-scroll-progress-dock-text"))
    .map((el) => el.textContent ?? "");
}

/** A minimal registered list: `rows` tr elements inside a table (the
 *  default `tbody tr` row grammar), the registrar contacted on mounted. */
function makeList(options: { rows: number; total?: number }) {
  return defineComponent({
    setup() {
      const rootRef = ref<HTMLElement | null>(null);
      const registrar = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
      onMounted(() => {
        registrar?.register({ getRoot: () => rootRef.value, getTotal: () => options.total });
      });
      return () =>
        h("div", { ref: rootRef }, [
          h("table", { class: "probe-table" }, [
            h("tbody", {}, Array.from({ length: options.rows }, (_, i) =>
              h("tr", { "data-row": String(i), key: i }, `row ${i}`),
            )),
          ]),
        ]);
    },
  });
}

/** Stub every row's rect: 40px tall, stacked from the content top, so a
 *  given scrollTop produces a deterministic first-visible row. */
function stubRows(container: HTMLElement, rows: number, scrollTop = 0) {
  container.querySelectorAll<HTMLElement>("tr").forEach((row, i) => {
    const top = i * 40 - scrollTop;
    rects.push(vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
      left: 0, top, right: 100, bottom: top + 40, width: 100, height: 40, x: 0, y: top,
    } as DOMRect));
  });
}

function stubRootRect(container: HTMLElement, selector: string, top: number, bottom: number, wrapper = false) {
  // `wrapper`: stub the registered ROOT (the list's wrapper div) instead
  // of the table inside it — pickActiveProgressRoot reads the root.
  const anchor = container.querySelector<HTMLElement>(selector);
  if (!anchor) throw new Error("list root missing");
  const root = wrapper ? anchor.parentElement! : anchor;
  rects.push(vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
    left: 0, top, right: 100, bottom, width: 100, height: bottom - top, x: 0, y: top,
  } as DOMRect));
}

const ROWS = 40;

describe("HkScrollProgressDock", () => {
  it("renders nothing at all when disabled (fragment passthrough)", async () => {
    const scroller = mountScroller(() => h(makeList({ rows: ROWS, total: 500 })), { disabled: true });
    await flushSense();
    expect(scroller.pill()).toBeNull();
    expect(scroller.scopes().length).toBe(0);
    // The slot content still renders (the fragment keeps no wrapper).
    expect(scroller.container.querySelector(".probe-table")).not.toBeNull();
  });

  it("answers hidden while nothing is registered", async () => {
    const scroller = mountScroller(() => h("div", { class: "bare-content" }, "content"));
    await scroller.scrollPass();
    const pill = scroller.pill();
    expect(pill).not.toBeNull();
    expect(pill!.dataset.state).toBe("hidden");
  });

  it("provides NO registrar when disabled", () => {
    // A list inside a disabled dock must resolve null (so it falls
    // through to an OUTER enabled dock, or registers nowhere). Pins the
    // gate: deleting the `if (!enabled)` early return turns this red.
    let saw: unknown = "unset";
    const Probe = defineComponent({
      setup() {
        saw = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        return () => h("div", "probe");
      },
    });
    mountScroller(() => h(Probe), { disabled: true });
    expect(saw).toBeNull();
  });

  it("teleports the pill onto the container host", async () => {
    const scroller = mountScroller(() => h("div", "content"));
    await scroller.scrollPass();
    const pill = scroller.pill()!;
    expect(pill.parentElement).toBe(scroller.host);
  });

  it("shows the active count over the registered total on scroll", async () => {
    const List = makeList({ rows: ROWS, total: 340 });
    const scroller = mountScroller(() => h(List));
    // Baseline pass: preconditions hold, no offset change yet.
    stubRows(scroller.container, ROWS, 0);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    await scroller.scrollPass();
    expect(scroller.pill()!.dataset.state).toBe("idle");

    // A real offset change lights the pill: row 9's bottom edge lands at
    // the viewport top, so the first VISIBLE row is #11; total 340.
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    await scroller.scrollPass();
    const pill = scroller.pill()!;
    expect(pill.dataset.state).toBe("active");
    expect(pillParts(pill)).toEqual(["Rows 11", "20 of 340"]);
  });

  it("renders head + arrow + tail, in that DOM order", async () => {
    const List = makeList({ rows: ROWS, total: 340 });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    await scroller.scrollPass();
    const pill = scroller.pill()!;
    const kids = Array.from(pill.children);
    expect(kids).toHaveLength(3);
    expect(kids[0]!.classList.contains("hk-scroll-progress-dock-text")).toBe(true);
    expect(kids[0]!.textContent).toBe("Rows 11");
    // The lucide glyph sits BETWEEN the two text halves (the arrow
    // replaced the range punctuation — user direction 2026-11-09).
    expect(kids[1]!.tagName.toLowerCase()).toBe("svg");
    expect(kids[1]!.classList.contains("hk-scroll-progress-dock-arrow")).toBe(true);
    expect(kids[2]!.classList.contains("hk-scroll-progress-dock-text")).toBe(true);
    expect(kids[2]!.textContent).toBe("20 of 340");
  });

  it("renders the single-row sentence whole, with NO icon", async () => {
    // Tracked in the intersecting-lists test below after list B
    // unregisters — the from===to form collapses to one text half and
    // the arrow disappears with it.
    const List = makeList({ rows: 10, total: 10 });
    const scroller = mountScroller(() => h(List));
    // Exactly ONE row inside the 0..400 band: row #4 visible at top 100,
    // rows 0-3 parked above (bottoms past the band top), rows 5-9 parked
    // below (tops past the band bottom) — the band collapses to 5..5.
    scroller.container.querySelectorAll<HTMLElement>("tr").forEach((row, i) => {
      const top = i === 4 ? 100 : i < 4 ? -1000 + i * 40 : 1000 + i * 40;
      rects.push(vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        left: 0, top, right: 100, bottom: top + 40, width: 100, height: 40, x: 0, y: top,
      } as DOMRect));
    });
    stubRootRect(scroller.container, ".probe-table", -1000, 2000);
    scroller.setScrollTop(50);
    await scroller.scrollPass();
    const pill = scroller.pill()!;
    expect(pillParts(pill)).toEqual(["Row 5 of 10"]);
    expect(pill.querySelector("svg")).toBeNull();
    expect(pill.querySelectorAll(".hk-scroll-progress-dock-text")).toHaveLength(1);
  });

  it("reads the fully-scrolled band as an end, not a mid-list numerator", async () => {
    // User report 2026-11-08: the old pill keyed on the FIRST visible
    // row, so a fully-scrolled 30-row list read "16 / 30" — never 30.
    const List = makeList({ rows: 30, total: 30 });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(800);
    stubRows(scroller.container, 30, 800);
    stubRootRect(scroller.container, ".probe-table", -800, 400);
    await scroller.scrollPass();
    expect(pillParts(scroller.pill()!)).toEqual(["Rows 21", "30 of 30"]);
  });

  it("keeps each locale's word order across the split (ja names the total in the head)", async () => {
    // The rangeHead/rangeTail split (2026-11-09) must not flatten word
    // order: ja carries the total in the HEAD half, ko's tail is bare,
    // zh keeps 第 {from} … {to} 条，共 {total} 条 around the arrow.
    const List = makeList({ rows: ROWS, total: 340 });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    await scroller.scrollPass();
    expect(pillParts(scroller.pill()!)).toEqual(["Rows 11", "20 of 340"]);

    localeTouched = true;
    await setLocale("ja");
    await nextTick();
    expect(pillParts(scroller.pill()!)).toEqual(["340 件中 11", "20 件目"]);

    await setLocale("zh-Hans");
    await nextTick();
    expect(pillParts(scroller.pill()!)).toEqual(["第 11", "20 条，共 340 条"]);

    await setLocale("ko");
    await nextTick();
    expect(pillParts(scroller.pill()!)).toEqual(["총 340개 중 11", "20"]);
  });

  it("counts only a sectioned HkTable's data rows, not its bands", async () => {
    // The band is a `<tr>` in the section body but not a row. The
    // table's handle `getRows` wins over the dock's `tbody tr` selector,
    // so the pill reports 2 sections x 2 rows = 4, not 6.
    const sections = [
      { key: "panel-a", label: "Panel A", rows: [{ name: "a0" }, { name: "a1" }] },
      { key: "panel-b", label: "Panel B", rows: [{ name: "b0" }, { name: "b1" }] },
    ];
    const scroller = mountScroller(() =>
      h(HTable, { columns: [{ key: "name", title: "Name" }], sections }),
    );
    stubRootRect(scroller.container, ".hk-table-host", -100, 1900);
    stubRows(scroller.container, 6, 0);
    await scroller.scrollPass();
    expect(pillParts(scroller.pill()!)).toEqual(["Rows 1", "4 of 4"]);
  });

  it("falls back to the DOM row count when the total is absent", async () => {
    const List = makeList({ rows: ROWS });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    await scroller.scrollPass();
    expect(pillParts(scroller.pill()!)).toEqual(["Rows 11", "20 of 40"]);
  });

  it("falls back to the DOM row count when the declared total went stale", async () => {
    // A total smaller than the delivered rows (a page loaded more than it
    // declared) must never let the numerator exceed the denominator.
    const List = makeList({ rows: ROWS, total: 5 });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    await scroller.scrollPass();
    expect(pillParts(scroller.pill()!)).toEqual(["Rows 11", "20 of 40"]);
  });

  it("answers hidden when the content fits without overflow", async () => {
    const List = makeList({ rows: ROWS, total: 340 });
    const scroller = mountScroller(() => h(List));
    Object.defineProperties(scroller.viewport, {
      scrollHeight: { configurable: true, get: () => 400 },
      clientHeight: { configurable: true, get: () => 400 },
    });
    stubRows(scroller.container, ROWS, 0);
    stubRootRect(scroller.container, ".probe-table", 0, 400);
    await scroller.scrollPass();
    expect(scroller.pill()!.dataset.state).toBe("hidden");
  });

  it("fades to idle after the idle window and re-arms on the next move", async () => {
    // The idle timer is the dock's own setTimeout — fake it together
    // with rAF so the coalesced pass still runs (the animation bus
    // drains one-shot frames through requestAnimationFrame).
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame"] });
    const List = makeList({ rows: ROWS, total: 340 });
    const scroller = mountScroller(() => h(List));
    stubRows(scroller.container, ROWS, 0);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    scroller.viewport.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("idle");

    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    scroller.viewport.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("active");
    // Idle window (default 900ms): opacity fades via data-state="idle".
    vi.advanceTimersByTime(900);
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("idle");
    // The next offset change re-arms the active state.
    scroller.setScrollTop(500);
    stubRows(scroller.container, ROWS, 500);
    scroller.viewport.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(20);
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("active");
  });

  it("tracks the intersecting list among several registrations", async () => {
    // List A sits fully above the viewport; list B intersects. The pill
    // describes B; once B unregisters, the nearest-above tier takes A.
    const bHandle: { fn?: () => void } = {};
    const listA = defineComponent({
      setup() {
        const registrar = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        const rootRef = ref<HTMLElement | null>(null);
        onMounted(() => registrar?.register({ getRoot: () => rootRef.value, getTotal: () => 10 }));
        return () =>
          h("div", { ref: rootRef }, [
            h("table", { class: "probe-table-a" }, [h("tbody", {}, Array.from({ length: 10 }, (_, i) => h("tr", { "data-list": "a", key: i }, `a${i}`)))]),
          ]);
      },
    });
    const listB = defineComponent({
      setup() {
        const registrar = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        const rootRef = ref<HTMLElement | null>(null);
        onMounted(() => {
          const handle = { getRoot: () => rootRef.value, getTotal: () => 20 };
          registrar?.register(handle);
          bHandle.fn = () => registrar?.unregister(handle);
        });
        return () =>
          h("div", { ref: rootRef }, [
            h("table", { class: "probe-table-b" }, [h("tbody", {}, Array.from({ length: 20 }, (_, i) => h("tr", { "data-list": "b", key: i }, `b${i}`)))]),
          ]);
      },
    });
    const scroller = mountScroller(() => h("div", [h(listA), h(listB)]));
    // A's rows live above the band; B's rows intersect it.
    scroller.container.querySelectorAll<HTMLTableRowElement>("tr").forEach((row) => {
      const above = row.dataset.list === "a";
      const top = above ? -2000 : 100;
      rects.push(vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        left: 0, top, right: 100, bottom: top + 40, width: 100, height: 40, x: 0, y: top,
      } as DOMRect));
    });
    // Roots: A above (bottom above the band's top), B intersecting.
    stubRootRect(scroller.container, ".probe-table-a", -2000, -1600, true);
    stubRootRect(scroller.container, ".probe-table-b", 100, 900, true);
    scroller.setScrollTop(100);
    await scroller.scrollPass();
    // B's rows all intersect the band, so the first visible row is #1.
    expect(pillParts(scroller.pill()!)).toEqual(["Rows 1", "20 of 20"]);

    // B leaves the registry: the nearest-above tier describes A — every
    // A row sits above the band, so the band collapses to the single
    // form (10 of 10), one text half, no arrow.
    bHandle.fn?.();
    await nextTick();
    expect(pillParts(scroller.pill()!)).toEqual(["Row 10 of 10"]);
    expect(scroller.pill()!.querySelector("svg")).toBeNull();
  });

  it("hides once the registration goes away", async () => {
    const handleBox: { fn?: () => void } = {};
    const List = defineComponent({
      setup() {
        const registrar = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        const rootRef = ref<HTMLElement | null>(null);
        onMounted(() => {
          const handle = { getRoot: () => rootRef.value, getTotal: () => 10 };
          registrar?.register(handle);
          handleBox.fn = () => registrar?.unregister(handle);
        });
        return () =>
          h("div", { ref: rootRef }, [
            h("table", {}, [h("tbody", {}, Array.from({ length: 10 }, (_, i) => h("tr", { key: i }, `r${i}`)))]),
          ]);
      },
    });
    const scroller = mountScroller(() => h(List));
    stubRows(scroller.container, 10, 0);
    stubRootRect(scroller.container, "table", -100, 1900);
    // First pass baselines the offset (no active yet); the second move
    // lights the pill.
    scroller.setScrollTop(100);
    await scroller.scrollPass();
    scroller.setScrollTop(200);
    await scroller.scrollPass();
    expect(scroller.pill()!.dataset.state).toBe("active");
    handleBox.fn?.();
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("hidden");
  });

  it("disconnects every sensor on unmount (listeners, ROs, idle timer)", async () => {
    // The unmount-cleanup pin: the dock owns its sensors now, so it must
    // return the viewport to bare — scroll listener removed, every RO it
    // created disconnected, the pending idle timer cleared.
    FakeResizeObserver.instances = [];
    globalThis.ResizeObserver = FakeResizeObserver;

    // Capture scroll listeners on the ELEMENT prototype from the start
    // (the dock attaches during mount's post flush, before any handle
    // to the viewport element exists for method spies).
    const addedScroll: Array<[EventTarget, EventListener]> = [];
    const removedScroll: Array<[EventTarget, EventListener]> = [];
    const protoAdd = HTMLElement.prototype.addEventListener;
    const protoRemove = HTMLElement.prototype.removeEventListener;
    HTMLElement.prototype.addEventListener = function (this: HTMLElement, type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) {
      if (type === "scroll") addedScroll.push([this, fn as EventListener]);
      return protoAdd.call(this, type, fn, opts);
    };
    HTMLElement.prototype.removeEventListener = function (this: HTMLElement, type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | EventListenerOptions) {
      if (type === "scroll") removedScroll.push([this, fn as EventListener]);
      return protoRemove.call(this, type, fn, opts);
    };

    try {
      const List = makeList({ rows: ROWS, total: 340 });
      const scroller = mountScroller(() => h(List), { idle: 300 });
      stubRows(scroller.container, ROWS, 0);
      stubRootRect(scroller.container, ".probe-table", -100, 1900);
      await scroller.scrollPass();
      scroller.setScrollTop(400);
      stubRows(scroller.container, ROWS, 400);
      await scroller.scrollPass();
      expect(scroller.pill()!.dataset.state).toBe("active");

      // Capture the idle timer the dock armed (spies pass through — the
      // recorded results are the real timer ids).
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      scroller.setScrollTop(500);
      stubRows(scroller.container, ROWS, 500);
      await scroller.scrollPass();
      const idleArms = setTimeoutSpy.mock.calls
        .map((call, i) => ({ call, result: setTimeoutSpy.mock.results[i] }))
        .filter(({ call }) => call[1] === 300)
        .map(({ result }) => result.value);
      expect(idleArms.length).toBeGreaterThan(0);
      const idleId = idleArms[idleArms.length - 1]!;
      setTimeoutSpy.mockRestore();

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      mounts[0].app.unmount();

      // EVERY scroll listener the stack added on this viewport came off
      // with the same function reference — the container's own sensor,
      // the overlay scrollbar's and the dock's alike.
      const onViewport = addedScroll.filter(([target]) => target === scroller.viewport);
      expect(onViewport.length).toBeGreaterThan(0);
      const removedOnViewport = new Set(
        removedScroll.filter(([target]) => target === scroller.viewport).map(([, fn]) => fn),
      );
      for (const [, fn] of onViewport) {
        expect(removedOnViewport.has(fn)).toBe(true);
      }
      // Every RO in this test (the dock's and the container's) disconnected.
      expect(FakeResizeObserver.instances.length).toBeGreaterThan(0);
      expect(FakeResizeObserver.instances.every((ro) => ro.disconnected)).toBe(true);
      // The pending idle timer was cleared — not left to fire post-unmount.
      expect(clearTimeoutSpy.mock.calls.some(([id]) => id === idleId)).toBe(true);
      clearTimeoutSpy.mockRestore();
    } finally {
      HTMLElement.prototype.addEventListener = protoAdd;
      HTMLElement.prototype.removeEventListener = protoRemove;
    }
  });
});

describe("HkScrollProgressDock laziness levers", () => {
  /** Standalone harness: no container anywhere, so the dock must be
   *  handed a viewport to sense anything at all. */
  function mountStandalone(slot: () => ReturnType<typeof h>, dockProps: Record<string, unknown> = {}, provideAllowed?: boolean) {
    const Wrapper = defineComponent({
      setup() {
        if (provideAllowed !== undefined) provide(HK_SCROLL_PROGRESS_ALLOWED, provideAllowed);
        return () => h(HkScrollProgressDock, dockProps, { default: slot });
      },
    });
    return mountTree(h(Wrapper));
  }

  it("is lazy with no viewport anywhere (no provide, no pill, slot intact)", () => {
    let saw: unknown = "unset";
    let dockActive: unknown = "unset";
    const Probe = defineComponent({
      setup() {
        saw = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        dockActive = inject(HK_SCROLL_PROGRESS_DOCK_ACTIVE, false);
        return () => h("div", { class: "probe-standalone" }, "probe");
      },
    });
    const c = mountStandalone(() => h(Probe));
    expect(saw).toBeNull();
    // No dock activity marker over the subtree — an outer dock (if a
    // host ever adds one above) must not stand down for this lazy dock.
    expect(dockActive).toBe(false);
    expect(c.querySelector(".hk-scroll-progress-dock-scope")).toBeNull();
    expect(c.querySelector(".hk-scroll-progress-dock")).toBeNull();
    expect(c.querySelector(".probe-standalone")!.textContent).toBe("probe");
  });

  it("senses an explicitly handed viewport when standalone", async () => {
    let scrollTop = 0;
    const vp = document.createElement("div");
    document.body.appendChild(vp);
    Object.defineProperties(vp, {
      scrollHeight: { configurable: true, get: () => 2000 },
      clientHeight: { configurable: true, get: () => 400 },
      scrollTop: { configurable: true, get: () => scrollTop },
    });
    rects.push(vi.spyOn(vp, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400, x: 0, y: 0,
    } as DOMRect));
    const List = makeList({ rows: ROWS, total: 340 });
    const c = mountStandalone(() => h(List), { viewport: vp });
    stubRows(c, ROWS, 0);
    stubRootRect(c, ".probe-table", -100, 1900);
    vp.dispatchEvent(new Event("scroll"));
    await flushSense();
    const pill = c.querySelector<HTMLElement>(".hk-scroll-progress-dock");
    expect(pill).not.toBeNull();
    // No host to teleport to: the pill renders IN PLACE inside the dock
    // scope (the consumer positions the scope).
    expect(pill!.closest(".hk-scroll-progress-dock-scope")).not.toBeNull();
    scrollTop = 400;
    stubRows(c, ROWS, 400);
    vp.dispatchEvent(new Event("scroll"));
    await flushSense();
    expect(pill!.dataset.state).toBe("active");
    expect(pillParts(pill!)).toEqual(["Rows 11", "20 of 340"]);
    vp.remove();
  });

  it("goes lazy when the shell master switch says not allowed", () => {
    let saw: unknown = "unset";
    const Probe = defineComponent({
      setup() {
        saw = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        return () => h("div", "probe");
      },
    });
    const c = mountStandalone(() => h(Probe), {}, false);
    expect(saw).toBeNull();
    expect(c.querySelector(".hk-scroll-progress-dock-scope")).toBeNull();
    expect(c.querySelector(".hk-scroll-progress-dock")).toBeNull();
  });

  it("stands a nested dock down: the outer dock serves, one pill total", async () => {
    // The static anti-double-pill rule: the enabled outer dock provides
    // DOCK_ACTIVE over its subtree; the inner dock injects it at setup
    // and goes inert (no provide, no pill). Lists under the inner dock
    // fall through to the outer registrar — one serving dock, one pill.
    const seen: unknown[] = [];
    const Probe = defineComponent({
      setup() {
        const registrar = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        const nested = inject(HK_SCROLL_PROGRESS_DOCK_ACTIVE, false);
        onMounted(() => {
          registrar?.register({ getRoot: () => null, getTotal: () => 7 });
          seen.push({ registrar, nested });
        });
        return () => h("div", "probe");
      },
    });
    const scroller = mountScroller(() =>
      h("div", [
        h(Probe),
        h(HkScrollProgressDock, { disabled: true }, { default: () => h(Probe) }),
        h(HkScrollProgressDock, {}, { default: () => h(Probe) }),
      ]),
    );
    await scroller.scrollPass();
    expect(seen.length).toBe(3);
    // (a) directly under the outer dock, (b) under an inner DISABLED
    // dock, (c) under an inner ENABLED dock — ALL resolve to the outer
    // dock's registrar identity: the disabled inner provides nothing and
    // the nested enabled inner stood down (its DOCK_ACTIVE marker true).
    for (const entry of seen) {
      expect((entry as { registrar: unknown }).registrar).not.toBeNull();
      expect((entry as { registrar: unknown }).registrar).toBe((seen[0] as { registrar: unknown }).registrar);
    }
    expect((seen[2] as { nested: unknown }).nested).toBe(true);
    // Exactly ONE pill element exists (the inner dock rendered none).
    expect(scroller.pills().length).toBe(1);
    // And exactly one scope (the inner dock left no wrapper behind).
    expect(scroller.scopes().length).toBe(1);
  });
});

describe("HkAdminTablePage scroll-progress dock", () => {
  it("demotes to the outer registrar with progressDock:false", async () => {
    // The page's own dock is default-on and would shadow an outer
    // registrar (it IS the nearest provider) — the manual-registrar
    // harness below therefore runs the page DEMOTED (`progressDock:
    // false`), which is also the escape hatch a host uses to fall
    // through to its own dock. The default-on path is pinned by the
    // "mounts its own dock" test.
    const registered: Array<{ getRoot: () => HTMLElement | null; getTotal: () => number | undefined }> = [];
    const unregistered: unknown[] = [];
    const registrar: HkScrollProgressRegistrar = {
      register: (handle) => registered.push(handle),
      unregister: (handle) => unregistered.push(handle),
    };
    const Provider = defineComponent({
      setup() {
        provide(HK_SCROLL_PROGRESS_REGISTRAR, registrar);
        return () =>
          h(HkAdminTablePage, {
            title: "T",
            rows: [{ name: "a" }, { name: "b" }],
            columns: [{ key: "name", title: "Name" }],
            total: 99,
            progressDock: false,
          });
      },
    });
    const container = mountTree(h(Provider));
    expect(registered.length).toBe(1);
    expect(registered[0].getTotal()).toBe(99);
    // The table card is the row root — the element containing the rows.
    expect(registered[0].getRoot()).not.toBeNull();
    expect(registered[0].getRoot()!.contains(container.querySelector("table"))).toBe(true);

    // Unmount unregisters the SAME handle.
    mounts[0].app.unmount();
    expect(unregistered.length).toBe(1);
    expect(unregistered[0]).toBe(registered[0]);
  });

  it("mounts its own dock by default: the table registers with IT", () => {
    // The list large-component uses the dock directly (user direction
    // 2026-11-09): a probe INSIDE the page body must reach the page
    // dock's registrar. The page rides a container (the real admin
    // grammar) — the dock needs a viewport to sense, and it must be the
    // page's own dock that serves (the container publishes no registrar).
    let saw: unknown = "unset";
    const Probe = defineComponent({
      setup() {
        saw = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        return () => h("div", "probe");
      },
    });
    const container = mountTree(h(HkScrollContainer, {}, {
      default: () => h(HkAdminTablePage, {
        title: "T",
        rows: [{ name: "a" }],
        columns: [{ key: "name", title: "Name" }],
      }, {
        body: () => h("div", [h(Probe)]),
      }),
    }));
    expect(saw).not.toBeNull();
    // Exactly ONE dock scope: the page's own (the container adds none).
    expect(container.querySelectorAll(".hk-scroll-progress-dock-scope").length).toBe(1);

    // progressDock:false demotes the dock — the probe injects nothing.
    let sawOff: unknown = "unset";
    const ProbeOff = defineComponent({
      setup() {
        sawOff = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        return () => h("div", "probe");
      },
    });
    const off = mountTree(h(HkScrollContainer, {}, {
      default: () => h(HkAdminTablePage, {
        title: "T",
        rows: [{ name: "a" }],
        columns: [{ key: "name", title: "Name" }],
        progressDock: false,
      }, {
        body: () => h("div", [h(ProbeOff)]),
      }),
    }));
    expect(sawOff).toBeNull();
    expect(off.querySelector(".hk-scroll-progress-dock-scope")).toBeNull();
  });

  it("renders its rows into the container viewport's pill end-to-end", async () => {
    // The real provide/inject path: the page's dock injects the
    // container's viewport + host, the table registers with the page
    // dock, and the pill's denominator is the page's declared total
    // (not the delivered rows).
    const instance = ref<{ refresh: () => void } | null>(null);
    let scrollTop = 0;
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkScrollContainer, { ref: instance as never }, {
            default: () =>
              h(HkAdminTablePage, {
                title: "T",
                rows: Array.from({ length: 30 }, (_, i) => ({ name: `r${i}` })),
                columns: [{ key: "name", title: "Name" }],
                total: 500,
              }),
          });
      },
    });
    const container = mountTree(h(Wrapper));
    const viewport = container.querySelector<HTMLElement>(".hk-scroll-container-viewport")!;
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, get: () => 4000 },
      clientHeight: { configurable: true, get: () => 400 },
      scrollWidth: { configurable: true, get: () => 300 },
      clientWidth: { configurable: true, get: () => 300 },
      scrollLeft: { configurable: true, get: () => 0 },
      scrollTop: { configurable: true, get: () => scrollTop },
    });
    rects.push(vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400, x: 0, y: 0,
    } as DOMRect));
    // The list root is HkTable's own host element — the table
    // self-registers (the page only forwards the total).
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    const cardHost = container.querySelector<HTMLElement>(".hk-table-host")!;
    expect(cardHost.contains(table!)).toBe(true);
    rects.push(vi.spyOn(cardHost, "getBoundingClientRect").mockReturnValue({
      left: 0, top: -200, right: 300, bottom: 3800, width: 300, height: 4000, x: 0, y: -200,
    } as DOMRect));
    container.querySelectorAll<HTMLElement>("tbody tr").forEach((row, i) => {
      const top = i * 40 - 200;
      rects.push(vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        left: 0, top, right: 300, bottom: top + 40, width: 300, height: 40, x: 0, y: top,
      } as DOMRect));
    });
    scrollTop = 200;
    viewport.dispatchEvent(new Event("scroll"));
    await flushSense();
    const pill = container.querySelector<HTMLElement>(".hk-scroll-progress-dock");
    expect(pill).not.toBeNull();
    // First visible row #6 over the DECLARED total — the delivered rows
    // (30) never override the page's server count.
    expect(pillParts(pill!)).toEqual(["Rows 6", "15 of 500"]);
  });
});


describe("HkCardList scroll-progress registration", () => {
  it("registers its list root, rows and total with the provided registrar", async () => {
    const registered: Array<{ getRoot: () => HTMLElement | null; getTotal: () => number | undefined; getRows?: () => readonly Element[] | undefined }> = [];
    const unregistered: unknown[] = [];
    const registrar: HkScrollProgressRegistrar = {
      register: (handle) => registered.push(handle),
      unregister: (handle) => unregistered.push(handle),
    };
    const Provider = defineComponent({
      setup() {
        provide(HK_SCROLL_PROGRESS_REGISTRAR, registrar);
        return () =>
          h(HkCardList, { total: 42 }, {
            default: () => [
              h(HkListRow, { key: "a", title: "a" }),
              h(HkListRow, { key: "b", title: "b" }),
              // A non-row child (a bare div a host slipped in) must not
              // count as a data row — getRows filters to .hk-list-row.
              h("div", { key: "spacer", class: "h-2" }),
            ],
          });
      },
    });
    const container = mountTree(h(Provider));
    expect(registered.length).toBe(1);
    expect(registered[0].getTotal()).toBe(42);
    // The list element is the row root — the element containing the rows.
    const root = registered[0].getRoot()!;
    expect(root).not.toBeNull();
    expect(root.classList.contains("hk-card-list")).toBe(true);
    expect(root.querySelectorAll(".hk-list-row")).toHaveLength(2);
    // getRows hands the pill the HkListRow children only (the spacer
    // div is excluded) — the section-band precision HkTable carries,
    // mirrored for card lists.
    const rows = registered[0].getRows!();
    expect(rows).toBeDefined();
    expect(rows!).toHaveLength(2);
    expect(rows!.every((el) => el.classList.contains("hk-list-row"))).toBe(true);

    // Unmount unregisters the SAME handle.
    mounts[0].app.unmount();
    expect(unregistered.length).toBe(1);
    expect(unregistered[0]).toBe(registered[0]);
  });

  it("keeps the handle honest across the empty-slot lifecycle (rows→empty→rows)", async () => {
    // The list element unmounts when the empty slot renders: the handle
    // must read a NULL root (the pill's hidden precondition — never a
    // stale detached element), and a re-render must recover a fresh
    // connected list under the SAME handle.
    const registered: Array<HkScrollProgressHandle> = [];
    const registrar: HkScrollProgressRegistrar = {
      register: (handle) => registered.push(handle),
      unregister: () => {},
    };
    const hasRows = ref(true);
    const Provider = defineComponent({
      setup() {
        provide(HK_SCROLL_PROGRESS_REGISTRAR, registrar);
        return () =>
          h(HkCardList, { total: 9 }, {
            default: () => (hasRows.value ? [h(HkListRow, { key: "a", title: "a" })] : []),
            empty: () => h("div", {}, "empty"),
          });
      },
    });
    mountTree(h(Provider));
    const handle = registered[0]!;
    expect(handle.getRoot()).not.toBeNull();
    expect(handle.getRows!()).toHaveLength(1);

    // Rows → empty: the ref clears with the element (no stale root).
    hasRows.value = false;
    await nextTick();
    expect(handle.getRoot()).toBeNull();
    expect(handle.getRows!()).toHaveLength(0);
    expect(handle.getTotal()).toBe(9); // the prop stays live

    // Empty → rows: the same handle recovers a fresh connected list.
    hasRows.value = true;
    await nextTick();
    const root = handle.getRoot()!;
    expect(root).not.toBeNull();
    expect(root.isConnected).toBe(true);
    expect(root.classList.contains("hk-card-list")).toBe(true);
    expect(handle.getRows!()).toHaveLength(1);
  });

  it("renders its rows into the container viewport's pill end-to-end", async () => {
    // The real provide/inject path: a card list inside a dock-in-
    // container registers itself, and the pill's denominator is the
    // list's declared total (not the delivered rows) — the same
    // end-to-end contract the table page carries.
    const list = h(HkCardList, {
      total: 500,
    }, {
      default: () => Array.from({ length: 30 }, (_, i) =>
        h(HkListRow, { key: i, title: `r${i}` })),
    });
    let scrollTop = 0;
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkScrollContainer, {}, { default: () => h(HkScrollProgressDock, {}, { default: () => list }) });
      },
    });
    const container = mountTree(h(Wrapper));
    const viewport = container.querySelector<HTMLElement>(".hk-scroll-container-viewport")!;
    Object.defineProperties(viewport, {
      scrollHeight: { configurable: true, get: () => 4000 },
      clientHeight: { configurable: true, get: () => 400 },
      scrollWidth: { configurable: true, get: () => 300 },
      clientWidth: { configurable: true, get: () => 300 },
      scrollLeft: { configurable: true, get: () => 0 },
      scrollTop: { configurable: true, get: () => scrollTop },
    });
    rects.push(vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 300, bottom: 400, width: 300, height: 400, x: 0, y: 0,
    } as DOMRect));
    const listRoot = container.querySelector<HTMLElement>(".hk-card-list")!;
    expect(listRoot).not.toBeNull();
    rects.push(vi.spyOn(listRoot, "getBoundingClientRect").mockReturnValue({
      left: 0, top: -200, right: 300, bottom: 3800, width: 300, height: 4000, x: 0, y: -200,
    } as DOMRect));
    container.querySelectorAll<HTMLElement>(".hk-list-row").forEach((row, i) => {
      const top = i * 40 - 200;
      rects.push(vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        left: 0, top, right: 300, bottom: top + 40, width: 300, height: 40, x: 0, y: top,
      } as DOMRect));
    });
    scrollTop = 200;
    viewport.dispatchEvent(new Event("scroll"));
    await flushSense();
    const pill = container.querySelector<HTMLElement>(".hk-scroll-progress-dock");
    expect(pill).not.toBeNull();
    // First visible row #6 over the DECLARED total — the delivered 30
    // rows never override the list's server count.
    expect(pillParts(pill!)).toEqual(["Rows 6", "15 of 500"]);
  });
});


// ── SCSS contract (textual pins — happy-dom does not lay out) ────────
// The house style pins sheet claims with readFileSync probes
// (HkButton.test.tsx icon-only precedent): these guard the paint
// decisions the DOM tests cannot see.
const scss = readFileSync(join(__dirname, "HkScrollProgressDock.scss"), "utf-8").replace(/\r\n/g, "\n");

describe("HkScrollProgressDock SCSS contract", () => {
  it("hides by display:none, never just transparency", () => {
    const hidden = scss.match(/&\[data-state="hidden"\]\s*{[^}]*}/)?.[0] ?? "";
    expect(hidden, "hidden-state rule must exist").toBeTruthy();
    expect(hidden).toContain("display: none");
  });

  it("fades via a 200ms opacity transition on the pill itself", () => {
    const rule = scss.match(/\.hk-scroll-progress-dock\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "pill rule must exist").toBeTruthy();
    expect(rule).toContain("transition: opacity 200ms ease");
    expect(rule).toContain("pointer-events: none");
  });

  it("hangs bottom-center with the safe-area inset and the autotag z-tier", () => {
    const rule = scss.match(/\.hk-scroll-progress-dock\s*{[^}]*}/)?.[0] ?? "";
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("left: 50%");
    expect(rule).toContain("max(var(--space-10), env(safe-area-inset-bottom, 0px))");
    expect(rule).toContain("z-index: 6");
  });

  it("steps the ink up one token (2xs -> xs) with matching padding", () => {
    // User direction 2026-11-09: the sentence was too small — one token
    // up, still a small dock (deliberately NOT text-sm).
    const rule = scss.match(/\.hk-scroll-progress-dock\s*{[^}]*}/)?.[0] ?? "";
    expect(rule).toContain("font-size: var(--text-xs, 0.75rem)");
    expect(rule).not.toContain("--text-2xs");
    expect(rule).toContain("padding: var(--space-4) var(--space-10)");
    // The pill is a flex row now: text halves and the arrow on one line.
    expect(rule).toContain("display: inline-flex");
    expect(rule).toContain("align-items: center");
    expect(rule).toContain("gap: var(--space-2)");
    expect(rule).toContain("white-space: nowrap");
  });

  it("keeps letter-spacing on the text halves only (the arrow never tracks)", () => {
    const pillRule = scss.match(/\.hk-scroll-progress-dock\s*{[^}]*}/)?.[0] ?? "";
    expect(pillRule).not.toContain("letter-spacing");
    const textRule = scss.match(/\.hk-scroll-progress-dock-text\s*{[^}]*}/)?.[0] ?? "";
    expect(textRule).toContain("letter-spacing: 0.04em");
  });

  it("sizes the arrow at 1em and flips it under RTL", () => {
    const arrow = scss.match(/\.hk-scroll-progress-dock-arrow\s*{[^}]*}/)?.[0] ?? "";
    expect(arrow).toContain("width: 1em");
    expect(arrow).toContain("height: 1em");
    const rtl = scss.match(/\[dir="rtl"\] \.hk-scroll-progress-dock-arrow\s*{[^}]*}/)?.[0] ?? "";
    expect(rtl, "RTL flip rule must exist").toBeTruthy();
    expect(rtl).toContain("transform: scaleX(-1)");
  });

  it("wraps the slot in a display:contents scope", () => {
    const scope = scss.match(/\.hk-scroll-progress-dock-scope\s*{[^}]*}/)?.[0] ?? "";
    expect(scope, "scope rule must exist").toBeTruthy();
    expect(scope).toContain("display: contents");
  });

  it("drops the fade entirely under prefers-reduced-motion", () => {
    const reduced = scss.match(/@media \(prefers-reduced-motion: reduce\)\s*{[^}@]*{[^}]*}\s*}/)?.[0] ?? "";
    expect(reduced, "reduced-motion block must exist").toBeTruthy();
    expect(reduced).toContain("transition: none");
  });
});
