import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HTable from "./HkTable";

/**
 * HkTable drag-to-reorder contract:
 * - no grip column unless `draggable`
 * - a focused handle's ArrowUp/Down nudges the row one slot and emits
 *   `reorder(from, to)` as indices into `rows` (the consumer applies
 *   moveTo(rows, from, to) — insert-at-target)
 * - a pointer drag past the neighbours' midpoints emits the same pair
 * - the emit is INERT while a column sort is active (a derived arrangement
 *   cannot be reproduced by a two-index move) and the grips announce it
 * - a cancelled gesture never emits
 * - HkAdminTablePage forwards `draggable` + `reorder` (source contract)
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils; happy-dom ships no layout engine, so row geometry is
 * pinned by hand — 40px rows stacked along y.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  while (mounts.length) {
    const { app, container } = mounts.pop()!;
    app.unmount();
    container.remove();
  }
});

interface RowsRef {
  rows: ReturnType<typeof ref<Record<string, unknown>[]>>;
  emitted: Array<[number, number]>;
}

/** Mount a draggable table of `count` rows `{ name, n }`, pinning each
 *  body row to a 40px band (y = i*40) the way a real layout engine would.
 *  `sortable` mounts with sortable columns for the inert-while-sorted
 *  case. Returns the reactive rows, the emitted reorder pairs and the
 *  contract's moveTo applier. */
function mountTable(
  count: number,
  opts: { sortable?: boolean } = {},
): RowsRef & {
  container: HTMLElement;
  apply(from: number, to: number): Promise<void>;
  setOrder(next: Record<string, unknown>[]): Promise<void>;
} {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const rows = ref<Record<string, unknown>[]>(
    Array.from({ length: count }, (_, i) => ({ name: `Row-${i}`, n: count - i })),
  );
  const emitted: Array<[number, number]> = [];
  const app = createApp({
    render: () =>
      h(HTable, {
        columns: [
          { key: "name", title: "Name" },
          { key: "n", title: "N", sortable: opts.sortable === true },
        ],
        rows: rows.value,
        rowKey: "name",
        draggable: true,
        onReorder: (from: number, to: number) => emitted.push([from, to]),
      }),
  });
  mounts.push({ app, container });
  app.mount(container);
  const host = container;
  // Pin geometry: the row `tr`s in display order.
  const trs = host.querySelectorAll("tbody .hk-table-row");
  trs.forEach((tr, i) => {
    const start = i * 40;
    const box = { left: 0, right: 300, top: start, bottom: start + 40, width: 300, height: 40, x: 0, y: start };
    Object.defineProperty(tr, "getBoundingClientRect", { configurable: true, value: () => box as DOMRect });
  });
  return {
    rows,
    emitted,
    container: host,
    /** Apply the contract's moveTo to the array and flush. */
    async apply(from: number, to: number): Promise<void> {
      const next = rows.value.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved!);
      rows.value = next;
      await nextTick();
    },
    /** Replace the consumer's array outright (any reorder, including ones a
     *  single moveTo cannot express) and flush. */
    async setOrder(next: Record<string, unknown>[]): Promise<void> {
      rows.value = next;
      await nextTick();
      // Re-pin geometry: the keyed `tr`s move with the data, so display
      // order changed under the same elements.
      host.querySelectorAll("tbody .hk-table-row").forEach((tr, i) => {
        const start = i * 40;
        const box = { left: 0, right: 300, top: start, bottom: start + 40, width: 300, height: 40, x: 0, y: start };
        Object.defineProperty(tr, "getBoundingClientRect", { configurable: true, value: () => box as DOMRect });
      });
    },
  };
}

function handles(host: HTMLElement): NodeListOf<HTMLButtonElement> {
  return host.querySelectorAll<HTMLButtonElement>(".hk-table-drag-handle");
}

async function pressKey(handle: HTMLButtonElement, key: string): Promise<void> {
  handle.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
  );
  await nextTick();
}

function pointer(type: string, x: number, y: number): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    button: 0,
    // A move with no button held is a released pointer the page never saw
    // the release of — the engine ignores it (its doc'd contract), so the
    // gesture here must carry the pressed button until the final up.
    buttons: type === "pointerup" ? 0 : 1,
    clientX: x,
    clientY: y,
  });
}

describe("HkTable drag-to-reorder", () => {
  it("renders no grip column unless draggable", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HTable, {
          columns: [{ key: "name", title: "Name" }],
          rows: [{ name: "a" }],
        }),
    });
    mounts.push({ app, container });
    app.mount(container);
    expect(container.querySelectorAll(".hk-table-drag-handle").length).toBe(0);
    expect(container.querySelectorAll("thead th").length).toBe(1);
  });

  it("renders one grip per row with an accessible name from the first column", async () => {
    const t = mountTable(3);
    const grips = handles(t.container);
    expect(grips.length).toBe(3);
    expect(grips[0]?.getAttribute("aria-label")).toBe("Reorder Row-0");
    expect(grips[0]?.getAttribute("aria-keyshortcuts")).toBe("ArrowUp ArrowDown");
  });

  it("interpolates the row label literally (a $& label is not a replacement pattern)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HTable, {
          columns: [{ key: "name", title: "Name" }],
          rows: [{ name: "Cash $& more" }],
          rowKey: "name",
          draggable: true,
        }),
    });
    mounts.push({ app, container });
    app.mount(container);
    // String.replace would expand `$&` into the matched text; the
    // split/join interpolation must keep the label verbatim.
    expect(handles(container)[0]?.getAttribute("aria-label")).toBe("Reorder Cash $& more");
  });

  it("ArrowDown on a focused handle emits (from, from+1) into rows and the move lands", async () => {
    const t = mountTable(3);
    await pressKey(handles(t.container)[0]!, "ArrowDown");
    expect(t.emitted).toEqual([[0, 1]]);
    await t.apply(0, 1);
    // The leading data cell (the grip cell carries .hk-table-cell too).
    expect(
      t.container.querySelector("tbody .hk-table-row td:not(.hk-table-drag-cell)")?.textContent,
    ).toBe("Row-1");
  });

  it("ArrowUp on the first row consumes the key but emits nothing", async () => {
    const t = mountTable(3);
    await pressKey(handles(t.container)[0]!, "ArrowUp");
    expect(t.emitted).toEqual([]);
  });

  it("ArrowDown on the last row consumes the key but emits nothing", async () => {
    const t = mountTable(3);
    await pressKey(handles(t.container)[2]!, "ArrowDown");
    expect(t.emitted).toEqual([]);
  });

  it("a pointer drag past the neighbours' midpoints emits the drop pair", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    // Past the threshold (6px) and past rows 1–2 midpoints (60/100): the
    // drop slot resolves to the END of the strip → insert-at-target = 2.
    window.dispatchEvent(pointer("pointermove", 18, 101));
    window.dispatchEvent(pointer("pointerup", 18, 101));
    await nextTick();
    expect(t.emitted).toEqual([[0, 2]]);
    // The gesture is over: no row keeps its lift.
    expect(t.container.querySelectorAll('tbody [data-dragging]').length).toBe(0);
  });

  it("a short press stays a click (no drag, no emit)", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 23));
    window.dispatchEvent(pointer("pointerup", 18, 23));
    await nextTick();
    expect(t.emitted).toEqual([]);
  });

  it("a cancelled gesture never emits", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 101));
    window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 7 }));
    await nextTick();
    expect(t.emitted).toEqual([]);
    expect(t.container.querySelectorAll('tbody [data-dragging]').length).toBe(0);
  });

  it("paints the insertion cue on the row the pointer resolves to", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 70));
    await nextTick();
    // Pointer between rows 1 (mid 60) and 2 (mid 100): the walk stops at
    // display row 2 (main=70 < mid 100) → slot 2, from=0 → insert-at-target
    // = 1 (drop row 0 ON row 1); the cue rides display row 1's top edge.
    const trs = t.container.querySelectorAll("tbody .hk-table-row");
    expect(trs[1]?.getAttribute("data-drop")).toBe("before");
    window.dispatchEvent(pointer("pointerup", 18, 70));
    await nextTick();
    expect(trs[1]?.getAttribute("data-drop")).toBeNull();
  });

  it("is inert while a column sort is active — grips announce disabled and emits never fire", async () => {
    const t = mountTable(3, { sortable: true });
    // Activate the sort the way a user does: click the column header.
    const header = t.container.querySelectorAll<HTMLElement>("thead th")[2]!;
    header.click();
    await nextTick();
    const grips = handles(t.container);
    // Sorted desc on n (rows were built n = count-i): display order is
    // Row-0 first still — but the SORT state is what matters here.
    expect(header.classList.contains("hk-table-header-sorted")).toBe(true);
    for (const grip of grips) {
      expect(grip.getAttribute("aria-disabled")).toBe("true");
    }
    await pressKey(grips[0]!, "ArrowDown");
    expect(t.emitted).toEqual([]);
    gripDragAttempt(t);
    expect(t.emitted).toEqual([]);
  });

  it("clears the sort on a third header click, re-enabling the grips", async () => {
    const t = mountTable(3, { sortable: true });
    const header = t.container.querySelectorAll<HTMLElement>("thead th")[2]!;
    header.click();
    await nextTick();
    expect(header.classList.contains("hk-table-header-sorted")).toBe(true);
    header.click();
    await nextTick();
    // Still sorted (descending) — the grips stay inert.
    expect(header.classList.contains("hk-table-header-sorted")).toBe(true);
    expect(handles(t.container)[0]!.getAttribute("aria-disabled")).toBe("true");

    header.click();
    await nextTick();
    // Third click: the consumer's own order is back, so the grips are live
    // again and a nudge emits.
    expect(header.classList.contains("hk-table-header-sorted")).toBe(false);
    expect(handles(t.container)[0]!.getAttribute("aria-disabled")).toBeNull();
    await pressKey(handles(t.container)[0]!, "ArrowDown");
    expect(t.emitted).toEqual([[0, 1]]);
  });

  it("paints no insertion cue while the pointer still resolves to the dragged row", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    // Past the threshold but still inside row 0's own band (mid 20): the
    // resolved slot is the row's own — a cue there would read as a no-op
    // target.
    window.dispatchEvent(pointer("pointermove", 18, 26));
    await nextTick();
    expect(t.container.querySelectorAll("tbody [data-drop]").length).toBe(0);
    window.dispatchEvent(pointer("pointerup", 18, 26));
    await nextTick();
    expect(t.emitted).toEqual([]);
  });

  /** A pointer gesture against an inert table: press + travel + release. */
  function gripDragAttempt(t: RowsRef & { container: HTMLElement }): void {
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 101));
    window.dispatchEvent(pointer("pointerup", 18, 101));
  }

  it("maps the drop onto the NEW array after a consumer reorder (reverse case)", async () => {
    const t = mountTable(3);
    // The consumer replaces the order outright — [Row-0, Row-1, Row-2] →
    // [Row-2, Row-1, Row-0]. A row-element registry that kept birth indices
    // would resolve the drag below against the OLD positions and emit
    // nothing; the contract is indices into the array as it is NOW.
    const reversed = [...(t.rows.value ?? [])].reverse();
    await t.setOrder(reversed);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    // Past row 1's midpoint (60) but not row 2's (100) → insert-at-target 1.
    window.dispatchEvent(pointer("pointermove", 18, 70));
    window.dispatchEvent(pointer("pointerup", 18, 70));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1]]);
    // And the prescribed move lands the reversal the user saw.
    const [first] = reversed.splice(0, 1);
    reversed.splice(1, 0, first!);
    expect(reversed.map((r) => r.name)).toEqual(["Row-1", "Row-2", "Row-0"]);
  });

  it("pulls the nearest vertically scrollable ancestor while the pointer rests near its edge", async () => {
    const scroller = document.createElement("div");
    document.body.appendChild(scroller);
    // happy-dom has no layout: the ancestor must LOOK like a scroller
    // (overflow style + metrics) for the resolver to pick it.
    Object.defineProperty(scroller, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(scroller, "clientHeight", { configurable: true, value: 100 });
    const scrollerBox = { left: 0, right: 300, top: 0, bottom: 100, width: 300, height: 100, x: 0, y: 0 };
    Object.defineProperty(scroller, "getBoundingClientRect", {
      configurable: true,
      value: () => scrollerBox as DOMRect,
    });
    const realGCS = window.getComputedStyle.bind(window);
    const spy = vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
      if (el === scroller) return { overflowY: "auto" } as CSSStyleDeclaration;
      return realGCS(el as Element);
    });

    const container = document.createElement("div");
    scroller.appendChild(container);
    const rows = ref<Record<string, unknown>[]>([
      { name: "Row-0" },
      { name: "Row-1" },
      { name: "Row-2" },
    ]);
    const emitted: Array<[number, number]> = [];
    const app = createApp({
      render: () =>
        h(HTable, {
          columns: [{ key: "name", title: "Name" }],
          rows: rows.value,
          rowKey: "name",
          draggable: true,
          onReorder: (from: number, to: number) => emitted.push([from, to]),
        }),
    });
    mounts.push({ app, container });
    app.mount(container);
    container.querySelectorAll("tbody .hk-table-row").forEach((tr, i) => {
      const start = i * 40;
      const box = { left: 0, right: 300, top: start, bottom: start + 40, width: 300, height: 40, x: 0, y: start };
      Object.defineProperty(tr, "getBoundingClientRect", { configurable: true, value: () => box as DOMRect });
    });

    const grip = handles(container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    // Inside the scroller's bottom edge zone (rect 0..100, zone 24) → the
    // engine starts pulling one frame at a time.
    window.dispatchEvent(pointer("pointermove", 18, 95));
    await nextTick();
    for (let i = 0; i < 4; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
    expect(scroller.scrollTop).toBeGreaterThan(0);
    window.dispatchEvent(pointer("pointerup", 18, 95));
    await nextTick();
    spy.mockRestore();
    scroller.remove();
  });
});

describe("HkTable grip CSS (source contract)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const scss = readFileSync(join(here, "HkTable.scss"), "utf-8");

  it("keeps the grip cells' padding rule at size-variant specificity", () => {
    // The regression this pins: a bare `.hk-table-drag-cell` selector is
    // 0,1,0 and silently loses to `.hk-table-sm .hk-table-cell` (0,2,0), so
    // the grip cell grows a full cell's right padding at sm/lg.
    expect(scss).toMatch(/\.hk-table \.hk-table-drag-cell\s*\{/);
    expect(scss).toMatch(/\.hk-table \.hk-table-drag-col\s*\{/);
  });
});

describe("HkAdminTablePage drag passthrough (source contract)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const pageTsx = readFileSync(join(here, "HkAdminTablePage.tsx"), "utf-8");

  it("forwards draggable and the reorder event to HTable verbatim", () => {
    expect(pageTsx).toContain("draggable: { type: Boolean, default: false }");
    expect(pageTsx).toMatch(/emits:\s*\{\s*reorder:/);
    expect(pageTsx).toMatch(/draggable=\{props\.draggable\}/);
    expect(pageTsx).toMatch(/onReorder=\{\(from: number, to: number\) => emit\("reorder", from, to\)\}/);
  });
});
