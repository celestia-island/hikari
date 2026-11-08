// Scroll-progress pill: registration contract, sensing behavior, and the
// HkAdminTablePage auto-registration. Geometry is stubbed the same way
// the overlay-scrollbar tests do it (happy-dom performs no layout) —
// Object.defineProperties for the viewport's scroll numbers, spyOn for
// the getBoundingClientRect boxes the numerator reads.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, inject, nextTick, onMounted, onUnmounted, provide, ref } from "vue";

import HkScrollContainer from "./HkScrollContainer";
import { HkAdminTablePage } from "./HkAdminTablePage";
import HTable from "./HkTable";
import { HkCardList, HkListRow } from "./HkCardList";
import {
  HK_SCROLL_PROGRESS_REGISTRAR,
  type HkScrollProgressHandle,
  type HkScrollProgressRegistrar,
} from "./HkScrollProgress";

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

  it("provides NO registrar when scrollProgress is off", () => {
    // The provide is guarded by the prop — a list inside an OFF container
    // must resolve null (so it falls through to an OUTER on-container, or
    // registers nowhere). Pins the guard: deleting the `if (props.scrollProgress)`
    // around the provide turns this red.
    let saw: unknown = "unset";
    const Probe = defineComponent({
      setup() {
        saw = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        return () => h("div", "probe");
      },
    });
    mountScroller(() => h(Probe), { scrollProgress: false });
    expect(saw).toBeNull();
  });

  it("resolves inner-OFF inside outer-ON to the OUTER registrar identity", async () => {
    const seen: unknown[] = [];
    const Probe = defineComponent({
      setup() {
        const registrar = inject(HK_SCROLL_PROGRESS_REGISTRAR, null);
        onMounted(() => {
          registrar?.register({ getRoot: () => null, getTotal: () => 7 });
          seen.push(registrar);
        });
        return () => h("div", "probe");
      },
    });
    // Three probes: (a) directly under the outer ON container, (b) inside
    // an inner OFF container, (c) inside an inner ON container. Registrar
    // IDENTITY pins the scoping matrix: (a)==(b) — the OFF inner provides
    // nothing, so (b) falls through to the OUTER registrar — while (c)
    // receives the INNER container's own registrar (shadowing). Deleting
    // the `if (props.scrollProgress)` provide guard turns (b) into a
    // third distinct registrar and this test red.
    const scroller = mountScroller(() =>
      h("div", [
        h(Probe),
        h(HkScrollContainer, { scrollProgress: false }, { default: () => h(Probe) }),
        h(HkScrollContainer, { scrollProgress: true }, { default: () => h(Probe) }),
      ]),
    );
    scroller.refresh();
    await nextTick();
    expect(seen.length).toBe(3);
    expect(seen[0]).not.toBeNull();
    expect(seen[1]).toBe(seen[0]);
    expect(seen[2]).not.toBe(seen[0]);
    // Two pills exist (outer ON + inner ON; the OFF inner renders none).
    expect(scroller.container.querySelectorAll(".hk-scroll-progress-pill").length).toBe(2);
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
    expect(pill.textContent).toBe("Rows 11–20 of 340");
  });

  it("reads the fully-scrolled band as an end, not a mid-list numerator", async () => {
    // User report 2026-11-08: the old pill keyed on the FIRST visible
    // row, so a fully-scrolled 30-row list read "16 / 30" — never 30.
    // The band's `to` is the LAST visible row: at the bottom it lands on
    // the row count and the sentence closes the list.
    const List = makeList({ rows: 30, total: 30 });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(800);
    stubRows(scroller.container, 30, 800);
    stubRootRect(scroller.container, ".probe-table", -800, 400);
    scroller.refresh();
    await nextTick();
    // Row tops i*40-800 against the 0..400 band: the first row whose
    // bottom clears the band top is #21, and the final row's top is
    // still above the band bottom, so the band closes at #30 = the end.
    expect(scroller.pill()!.textContent).toBe("Rows 21–30 of 30");
  });

  it("counts only a sectioned HkTable's data rows, not its bands", async () => {
    // The band is a `<tr>` in the section body but not a row. The table's
    // handle `getRows` wins over the container's `tbody tr` selector, so
    // the pill reports 2 sections x 2 rows = 4, not 6.
    const sections = [
      { key: "panel-a", label: "Panel A", rows: [{ name: "a0" }, { name: "a1" }] },
      { key: "panel-b", label: "Panel B", rows: [{ name: "b0" }, { name: "b1" }] },
    ];
    const scroller = mountScroller(() =>
      h(HTable, { columns: [{ key: "name", title: "Name" }], sections }),
    );
    stubRootRect(scroller.container, ".hk-table-host", -100, 1900);
    stubRows(scroller.container, 6, 0);
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.textContent).toBe("Rows 1–4 of 4");
  });

  it("falls back to the DOM row count when the total is absent", async () => {
    const List = makeList({ rows: ROWS });
    const scroller = mountScroller(() => h(List));
    scroller.setScrollTop(400);
    stubRows(scroller.container, ROWS, 400);
    stubRootRect(scroller.container, ".probe-table", -100, 1900);
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.textContent).toBe("Rows 11–20 of 40");
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
    expect(scroller.pill()!.textContent).toBe("Rows 11–20 of 40");
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
    expect(scroller.pill()!.textContent).toBe("Rows 1–20 of 20");

    // B leaves the registry: the nearest-above tier describes A — every
    // A row sits above the band, so the numerator reads as "past the
    // end" (rows.length) over A's total.
    bHandle.fn?.();
    scroller.refresh();
    await nextTick();
    expect(scroller.pill()!.textContent).toBe("Row 10 of 10");
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
    // The list root is HkTable's own host element — the table
    // self-registers (the page only forwards the total).
    const card = container.querySelector("table");
    expect(card).not.toBeNull();
    const cardHost = container.querySelector<HTMLElement>(".hk-table-host")!;
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
    expect(pill!.textContent).toBe("Rows 6–15 of 500");
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

  it("renders its rows into the shell viewport's pill denominator end-to-end", async () => {
    // The real provide/inject path: a card list inside a
    // scrollProgress-on container registers itself, and the pill's
    // denominator is the list's declared total (not the delivered rows)
    // — the same end-to-end contract the table page carries.
    const list = h(HkCardList, {
      total: 500,
    }, {
      default: () => Array.from({ length: 30 }, (_, i) =>
        h(HkListRow, { key: i, title: `r${i}` })),
    });
    const instance = ref<{ refresh: () => void } | null>(null);
    let scrollTop = 0;
    const Wrapper = defineComponent({
      setup() {
        return () =>
          h(HkScrollContainer, { ref: instance as never, scrollProgress: true }, { default: () => list });
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
    instance.value!.refresh();
    await nextTick();
    const pill = container.querySelector<HTMLElement>(".hk-scroll-progress-pill");
    expect(pill).not.toBeNull();
    // First visible row #6 over the DECLARED total — the delivered 30
    // rows never override the list's server count.
    expect(pill!.textContent).toBe("Rows 6–15 of 500");
  });
});


// ── SCSS contract (textual pins — happy-dom does not lay out) ────────
// The house style pins sheet claims with readFileSync probes
// (HkButton.test.tsx icon-only precedent): these guard the paint
// decisions the DOM tests cannot see.
const scss = readFileSync(join(__dirname, "HkScrollProgress.scss"), "utf-8").replace(/\r\n/g, "\n");

describe("HkScrollProgress SCSS contract", () => {
  it("hides by display:none, never just transparency", () => {
    const hidden = scss.match(/&\[data-state="hidden"\]\s*{[^}]*}/)?.[0] ?? "";
    expect(hidden, "hidden-state rule must exist").toBeTruthy();
    expect(hidden).toContain("display: none");
  });

  it("fades via a 200ms opacity transition on the pill itself", () => {
    const rule = scss.match(/\.hk-scroll-progress-pill\s*{[^}]*}/)?.[0] ?? "";
    expect(rule, "pill rule must exist").toBeTruthy();
    expect(rule).toContain("transition: opacity 200ms ease");
    expect(rule).toContain("pointer-events: none");
  });

  it("hangs bottom-center with the safe-area inset and the autotag z-tier", () => {
    const rule = scss.match(/\.hk-scroll-progress-pill\s*{[^}]*}/)?.[0] ?? "";
    expect(rule).toContain("position: absolute");
    expect(rule).toContain("left: 50%");
    expect(rule).toContain("max(var(--space-10), env(safe-area-inset-bottom, 0px))");
    expect(rule).toContain("z-index: 6");
  });

  it("drops the fade entirely under prefers-reduced-motion", () => {
    const reduced = scss.match(/@media \(prefers-reduced-motion: reduce\)\s*{[^}@]*{[^}]*}\s*}/)?.[0] ?? "";
    expect(reduced, "reduced-motion block must exist").toBeTruthy();
    expect(reduced).toContain("transition: none");
  });
});
