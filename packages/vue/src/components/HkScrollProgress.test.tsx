// Scroll-progress pill: registration contract, sensing behavior, and the
// HkAdminTablePage auto-registration. Geometry is stubbed the same way
// the overlay-scrollbar tests do it (happy-dom performs no layout) —
// Object.defineProperties for the viewport's scroll numbers, spyOn for
// the getBoundingClientRect boxes the numerator reads.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, inject, nextTick, onMounted, onUnmounted, provide, ref } from "vue";

import HkScrollContainer from "./HkScrollContainer";
import { HkAdminTablePage } from "./HkAdminTablePage";
import { HK_SCROLL_PROGRESS_REGISTRAR, type HkScrollProgressRegistrar } from "./HkScrollProgress";

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];
const rects: Array<ReturnType<typeof vi.spyOn>> = [];

afterEach(() => {
  vi.useRealTimers();
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

interface Scroller {
  container: HTMLElement;
  viewport: HTMLElement;
  pill: () => HTMLElement | null;
  refresh: () => void;
  setScrollTop: (top: number) => void;
}

/** Mount a HkScrollContainer with `scrollProgress` on and the given slot
 *  content. scrollTop rides a mutable cell so successive refresh() passes
 *  can move it (the sensing pass reads the live getter). */
function mountScroller(slot: () => ReturnType<typeof h>, props: Record<string, unknown> = {}): Scroller {
  let scrollTop = 0;
  const instance = ref<{ refresh: () => void } | null>(null);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkScrollContainer, {
          ref: instance as never,
          scrollProgress: true,
          ...props,
        }, { default: slot });
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
  return {
    container,
    viewport,
    pill: () => container.querySelector<HTMLElement>(".hk-scroll-progress-pill"),
    refresh: () => instance.value?.refresh(),
    setScrollTop: (top: number) => {
      scrollTop = top;
    },
  };
}

/** A minimal registered list: `rows` tr elements inside a table (the
 *  default `tr` row grammar), the registrar contacted on mounted. */
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

describe("HkScrollProgress", () => {
  it("renders no pill element when scrollProgress is off", async () => {
    const scroller = mountScroller(() => h(makeList({ rows: ROWS, total: 500 })), { scrollProgress: false });
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()).toBeNull();
  });

  it("answers hidden while nothing is registered", async () => {
    const scroller = mountScroller(() => h("div", { class: "bare-content" }, "content"));
    scroller.refresh();
    await nextTick();
    const pill = scroller.pill();
    expect(pill).not.toBeNull();
    expect(pill!.dataset.state).toBe("hidden");
  });

  it("shows the active count over the registered total on scroll", async () => {
    const List = makeList({ rows: ROWS, total: 340 });
    const scroller = mountScroller(() => h(List));
    // Baseline pass: preconditions hold, no offset change yet.
    stubRows(scroller.container, ROWS, 0);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("idle");

    // A real offset change lights the pill: row 9's bottom edge lands at
    // the viewport top, so the first VISIBLE row is #11; total 340.
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    scroller.refresh();
    await nextTick();
    const pill = scroller.pill()!;
    expect(pill.dataset.state).toBe("active");
    expect(pill.textContent).toBe("11 / 340");
  });

  it("falls back to the DOM row count when the total is absent", async () => {
    const List = makeList({ rows: ROWS });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.textContent).toBe("11 / 40");
  });

  it("falls back to the DOM row count when the declared total went stale", async () => {
    // A total smaller than the delivered rows (a page loaded more than it
    // declared) must never let the numerator exceed the denominator.
    const List = makeList({ rows: ROWS, total: 5 });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.textContent).toBe("11 / 40");
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
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("hidden");
  });

  it("fades to idle after the idle window and re-arms on the next move", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const List = makeList({ rows: ROWS, total: 340 });
    const scroller = mountScroller(() => h(List));
    stubRows(scroller.container, ROWS, 0);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    scroller.refresh();
    await nextTick();
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("active");
    // Idle window (default 900ms): opacity fades via data-state="idle".
    vi.advanceTimersByTime(900);
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("idle");
    // The next offset change re-arms the active state.
    scroller.setScrollTop(500);
    stubRows(scroller.container, ROWS, 500);
    scroller.refresh();
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
    scroller.refresh();
    await nextTick();
    // B's rows all intersect the band, so the first visible row is #1.
    expect(scroller.pill()!.textContent).toBe("1 / 20");

    // B leaves the registry: the nearest-above tier describes A — every
    // A row sits above the band, so the numerator reads as "past the
    // end" (rows.length) over A's total.
    bHandle.fn?.();
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.textContent).toBe("10 / 10");
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
    scroller.refresh();
    await nextTick();
    scroller.setScrollTop(200);
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("active");
    handleBox.fn?.();
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.dataset.state).toBe("hidden");
  });
});

describe("HkAdminTablePage scroll-progress registration", () => {
  it("registers its table root and total with the provided registrar", async () => {
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

  it("renders its rows into the shell viewport's pill denominator end-to-end", async () => {
    // The real provide/inject path: AdminTablePage inside a
    // scrollProgress-on container registers itself, and the pill's
    // denominator is the page's declared total (not the delivered rows).
    const page = h(HkAdminTablePage, {
      title: "T",
      rows: Array.from({ length: 30 }, (_, i) => ({ name: `r${i}` })),
      columns: [{ key: "name", title: "Name" }],
      total: 500,
    });
    const instance = ref<{ refresh: () => void } | null>(null);
    let scrollTop = 0;
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkScrollContainer, { ref: instance as never, scrollProgress: true }, { default: () => page });
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
    // The list root is AdminTablePage's table-card wrapper (the anchor
    // class the page ships for exactly this geometry contract).
    const card = container.querySelector("table");
    expect(card).not.toBeNull();
    const cardHost = container.querySelector<HTMLElement>(".hk-admin-table-page-tablecard")!;
    expect(cardHost.contains(card!)).toBe(true);
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
    instance.value!.refresh();
    await nextTick();
    const pill = container.querySelector<HTMLElement>(".hk-scroll-progress-pill");
    expect(pill).not.toBeNull();
    // First visible row #6 over the DECLARED total — the delivered rows
    // (30) never override the page's server count.
    expect(pill!.textContent).toBe("6 / 500");
  });
});
