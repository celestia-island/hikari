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
 * - the drag LIFTS: a detached ghost (a snapshot of the pressed row on
 *   <body>) follows the pointer, the pressed row stays behind as the
 *   equal-size placeholder (dimmed), and the slot the pointer resolves to
 *   is painted by shifting the arrangement — the placeholder translates
 *   onto the target row's spot, the rows in between glide one across
 * - a real drop FREEZES the arrangement until the consumer's `rows`
 *   carries it; a cancelled gesture glides everything home and never
 *   emits
 * - the emit is INERT while a column sort is active (a derived arrangement
 *   cannot be reproduced by a two-index move) and the grips announce it
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
  // A ghost fading at release is removed by a bus timer — a test that
  // ends inside that window must not leak it into the next one.
  document.body.querySelectorAll(".hk-table-drag-ghost").forEach((n) => n.remove());
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

  it("shifts the arrangement onto the slot the pointer resolves to", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 70));
    await nextTick();
    // Pointer between rows 1 (mid 60) and 2 (mid 100): the walk stops at
    // display row 2 (main=70 < mid 100) → slot 2, from=0 → insert-at-target
    // = 1. The placeholder (row 0) rides DOWN onto row 1's spot and row 1
    // glides UP into the vacated slot — the swap the user watches, not a
    // line on an edge. Row 2 is untouched.
    const trs = t.container.querySelectorAll("tbody .hk-table-row");
    // The row NAMES the shift (custom property + data-shift); the
    // stylesheet moves its cells — happy-dom computes no CSS, so the
    // paint wiring is pinned by the source contract below.
    expect((trs[0]?.getAttribute("style") ?? "").replace(/\s+/g, "")).toContain("--hk-drag-shift:40px");
    expect(trs[0]?.hasAttribute("data-shift")).toBe(true);
    expect((trs[1]?.getAttribute("style") ?? "").replace(/\s+/g, "")).toContain("--hk-drag-shift:-40px");
    expect(trs[1]?.hasAttribute("data-shift")).toBe(true);
    expect(trs[2]?.getAttribute("style")).toBeNull();
    expect(trs[2]?.hasAttribute("data-shift")).toBe(false);
    window.dispatchEvent(pointer("pointerup", 18, 70));
    await nextTick();
  });

  it("paints no shift while the pointer still resolves to the dragged row", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    // Past the threshold but still inside row 0's own band (mid 20): the
    // resolved slot is the row's own — an arrangement equal to the strip
    // as laid out must not paint transforms.
    window.dispatchEvent(pointer("pointermove", 18, 26));
    await nextTick();
    for (const tr of t.container.querySelectorAll("tbody .hk-table-row")) {
      expect(tr.getAttribute("style")).toBeNull();
    }
    window.dispatchEvent(pointer("pointerup", 18, 26));
    await nextTick();
    expect(t.emitted).toEqual([]);
  });

  /** One animation-bus frame: the ghost attaches on `onceFrame`, so a lift
   *  is only observable after the bus drains a frame. */
  async function busFrame(): Promise<void> {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    await nextTick();
  }

  function ghost(): HTMLElement | null {
    // The LIVE ghost only — a previous gesture's node fading out is no
    // longer the lift.
    return document.body.querySelector<HTMLElement>(".hk-table-drag-ghost:not([data-fading])");
  }

  it("lifts the pressed row as a detached ghost over an equal-size placeholder", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 26));
    await nextTick();
    await busFrame();
    // The ghost is a snapshot of the pressed row, mounted on <body> — NOT
    // the strip — and carries no placeholder paint of its own.
    const g = ghost();
    expect(g, "the drag ghost on body").toBeTruthy();
    expect(g!.textContent).toContain("Row-0");
    expect(g!.querySelector("[data-dragging]")).toBeNull();
    // The strip row it left is the placeholder: dimmed in place, same
    // element (so exactly the size the strip laid out).
    const trs = t.container.querySelectorAll("tbody .hk-table-row");
    expect(trs[0]?.hasAttribute("data-dragging")).toBe(true);
    expect(trs[0]?.getAttribute("style")).toBeNull();
    window.dispatchEvent(pointer("pointerup", 18, 26));
    await nextTick();
  });

  it("the ghost follows the pointer vertically and stays anchored to the row's left edge", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 26));
    await nextTick();
    await busFrame();
    const g = ghost();
    expect(g?.style.transform).toContain("translate3d(0px, 0px");
    // Straight down from the press (86 - 20: the grab point stays under
    // the pointer), and a horizontal jitter must NOT slide the ghost
    // sideways. The move rides its own task, as a real gesture's does.
    window.dispatchEvent(pointer("pointermove", 90, 86));
    expect(g?.style.transform).toContain("translate3d(0px, 66px");
    window.dispatchEvent(pointer("pointerup", 90, 86));
    await nextTick();
  });

  it("a real drop freezes the arrangement until the consumer's rows carry it", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 70));
    await nextTick();
    await busFrame();
    window.dispatchEvent(pointer("pointerup", 18, 70));
    await nextTick();
    // Dropped 0 → 1: the emit flew, but the consumer has not applied the
    // move yet — the dropped arrangement must STAY painted (no snap back
    // to the pre-drop order while the commit is in the air), the
    // placeholder is un-dimmed, and the ghost is fading at the slot.
    expect(t.emitted).toEqual([[0, 1]]);
    const trs = t.container.querySelectorAll("tbody .hk-table-row");
    expect((trs[0]?.getAttribute("style") ?? "").replace(/\s+/g, "")).toContain("--hk-drag-shift:40px");
    expect(trs[0]?.hasAttribute("data-dragging")).toBe(false);
    expect(document.body.querySelector(".hk-table-drag-ghost[data-fading]")).toBeTruthy();
    expect(t.container.querySelector("table")?.hasAttribute("data-shift-held")).toBe(true);
    // The consumer applies the emitted move: the hold lifts in the same
    // paint that carries the new order (which is where the shift already
    // put the rows — no jump).
    await t.apply(0, 1);
    const settled = t.container.querySelectorAll("tbody .hk-table-row");
    for (const tr of settled) expect(tr.getAttribute("style")).toBeNull();
    expect(t.container.querySelector("table")?.hasAttribute("data-shift-held")).toBe(false);
  });

  it("a cancelled gesture glides the arrangement home and never emits", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 70));
    await nextTick();
    expect(
      (t.container.querySelector("tbody .hk-table-row")?.getAttribute("style") ?? "").replace(/\s+/g, ""),
    ).toContain("--hk-drag-shift:40px");
    window.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 7 }));
    await nextTick();
    // No emit, transforms off. The release beat keeps the transitions
    // ARMED (data-releasing) for exactly one shift window — a CSS
    // transition reads the after-change style, so without it the glide
    // home would snap.
    expect(t.emitted).toEqual([]);
    expect(t.container.querySelector("table")?.hasAttribute("data-releasing")).toBe(true);
    for (const tr of t.container.querySelectorAll("tbody .hk-table-row")) {
      expect(tr.getAttribute("style")).toBeNull();
    }
    // The beat lapses: the strip is idle again, no arming left behind.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(t.container.querySelector("table")?.hasAttribute("data-releasing")).toBe(false);
  });

  it("a new drag while a held arrangement is painted measures the clean strip", async () => {
    const t = mountTable(3);
    // First drag: drop 0 → 1 and leave the arrangement held (the consumer
    // has not applied it).
    const grip0 = handles(t.container)[0]!;
    grip0.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 70));
    window.dispatchEvent(pointer("pointerup", 18, 70));
    await nextTick();
    expect(t.container.querySelector("table")?.hasAttribute("data-shift-held")).toBe(true);
    // Second drag starts immediately: the stale shifts must not pollute
    // the measurement — the new gesture resolves against the strip the
    // data describes (row 0 at top 0), not against the shifted paint.
    const grip1 = handles(t.container)[1]!;
    grip1.dispatchEvent(pointer("pointerdown", 18, 60));
    window.dispatchEvent(pointer("pointermove", 18, 66));
    await nextTick();
    // Dragging the (display) row 1 in its own band: no arrangement shift.
    for (const tr of t.container.querySelectorAll("tbody .hk-table-row")) {
      const style = tr.getAttribute("style") ?? "";
      // Row 0 still carries the HELD first-drop shift only if the second
      // gesture resolved nothing — but the hold was released by the new
      // drag, so nothing may be painted.
      expect(style).not.toContain("--hk-drag-shift");
    }
    window.dispatchEvent(pointer("pointerup", 18, 66));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1]]);
  });

  it("shifts pixel-exact across UNEVEN rows", async () => {
    // happy-dom pins the geometry by hand, so uneven heights are one
    // defineProperty away: a 40/100/20 strip exercises the anchored-delta
    // math the uniform grid cannot distinguish from a height product.
    const t = mountTable(3);
    const heights = [40, 100, 20];
    const tops: number[] = [];
    let acc = 0;
    t.container.querySelectorAll("tbody .hk-table-row").forEach((tr, i) => {
      tops.push(acc);
      const box = { left: 0, right: 300, top: acc, bottom: acc + heights[i]!, width: 300, height: heights[i]!, x: 0, y: acc };
      Object.defineProperty(tr, "getBoundingClientRect", { configurable: true, value: () => box as DOMRect });
      acc += heights[i]!;
    });
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    // Past row 1's midpoint (top 40 + 50 = 90) but inside row 2 (140..160):
    // slot 2, from 0 → insert-at-target 1: the placeholder takes row 1's
    // spot (top 40), row 1 takes the placeholder's (top 0).
    window.dispatchEvent(pointer("pointermove", 18, 145));
    await nextTick();
    const trs = t.container.querySelectorAll("tbody .hk-table-row");
    expect((trs[0]?.getAttribute("style") ?? "").replace(/\s+/g, "")).toContain(`--hk-drag-shift:${tops[1]! - tops[0]!}px`);
    expect((trs[1]?.getAttribute("style") ?? "").replace(/\s+/g, "")).toContain(`--hk-drag-shift:${tops[0]! - tops[1]!}px`);
    expect(trs[2]?.getAttribute("style")).toBeNull();
    window.dispatchEvent(pointer("pointerup", 18, 145));
    await nextTick();
  });

  it("re-measures when the consumer replaces rows UNDER a live drag", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 70));
    await nextTick();
    expect(
      (t.container.querySelector("tbody .hk-table-row")?.getAttribute("style") ?? "").replace(/\s+/g, ""),
    ).toContain("--hk-drag-shift");
    // The refresh lands mid-drag (a websocket push, a concurrent editor):
    // two rows now, different order. The stale measurement must not paint
    // shifts for rows that no longer exist / no longer sit where they did.
    await t.setOrder([t.rows.value![2]!, t.rows.value![0]!, t.rows.value![1]!]);
    // The gesture is over from the engine's point of view once the pressed
    // element is gone from the strip? No — Row-0 is still IN the strip, so
    // the gesture survives; the paint must be CLEAN until the next move
    // re-resolves against the fresh measurement.
    const styles = [...t.container.querySelectorAll("tbody .hk-table-row")].map(
      (tr) => tr.getAttribute("style"),
    );
    // No shift may name a displacement measured against the OLD strip.
    for (const style of styles) {
      if (style?.includes("--hk-drag-shift")) {
        expect(style).not.toContain("-40px");
      }
    }
    window.dispatchEvent(pointer("pointerup", 18, 70));
    await nextTick();
  });

  it("the ghost is hidden from the accessibility tree and carries no focusable chrome", async () => {
    const t = mountTable(3);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 26));
    await nextTick();
    await busFrame();
    const g = ghost();
    expect(g?.getAttribute("aria-hidden")).toBe("true");
    // The snapshot stripped the grip's tabindex/role: no second tab stop.
    expect(g?.querySelector("[tabindex]")).toBeNull();
    expect(g?.querySelector('[role="button"]')).toBeNull();
    window.dispatchEvent(pointer("pointerup", 18, 26));
    await nextTick();
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

  /** A pointer gesture against an inert table: press + travel + release. */
  function gripDragAttempt(t: RowsRef & { container: HTMLElement }): void {
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 101));
    window.dispatchEvent(pointer("pointerup", 18, 101));
  }

  it("still emits after a MIDDLE row is removed (stale registry tail)", async () => {
    const t = mountTable(3);
    // Vue calls the removed row's function ref with null, and the index that
    // callback captured is the one the row held in the PREVIOUS render — the
    // slot the survivor just slid into. A ref registry therefore ends up
    // with a live row missing (or a stale duplicate), the drop resolves past
    // the end and the bounds check swallows the emit — silently, for every
    // later drag. The strip is read from the DOM, so it cannot drift.
    const original = t.rows.value ?? [];
    await t.setOrder([original[0]!, original[2]!]);

    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 70));
    window.dispatchEvent(pointer("pointerup", 18, 70));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1]]);
    // The drop lands: Row-2 takes Row-0's place.
    await t.apply(0, 1);
    expect((t.rows.value ?? []).map((r) => r.name)).toEqual(["Row-2", "Row-0"]);
  });

  it("re-resolves the strip after a deletion that follows a completed drag", async () => {
    const t = mountTable(3);
    // Read the strip once (a real drag), then remove a middle row and drag
    // again: a strip cached at first read would silently stop emitting, and
    // only this ORDERING catches it — the plain removal case reads the
    // strip for the first time after the deletion.
    const grip0 = handles(t.container)[0]!;
    grip0.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 60));
    window.dispatchEvent(pointer("pointerup", 18, 60));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1]]);
    await t.apply(0, 1);

    const original = t.rows.value ?? [];
    await t.setOrder([original[0]!, original[2]!]);
    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 70));
    window.dispatchEvent(pointer("pointerup", 18, 70));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1], [0, 1]]);
  });

  it("ignores a nested table's rows when resolving the outer strip", async () => {
    // A cell slot may render another HkTable; its rows are descendants of
    // this host, so a bare descendant query would let an outer drag resolve
    // onto them (R3 N1).
    const t = mountTable(3);
    const cell = t.container.querySelector("tbody .hk-table-row td:not(.hk-table-drag-cell)")!;
    const nested = document.createElement("div");
    cell.appendChild(nested);
    const nestedApp = createApp({
      render: () =>
        h(HTable, {
          columns: [{ key: "name", title: "Name" }],
          rows: [{ name: "Inner-0" }, { name: "Inner-1" }],
          rowKey: "name",
        }),
    });
    mounts.push({ app: nestedApp, container: nested });
    nestedApp.mount(nested);

    const grip = handles(t.container)[0]!;
    grip.dispatchEvent(pointer("pointerdown", 18, 20));
    window.dispatchEvent(pointer("pointermove", 18, 101));
    window.dispatchEvent(pointer("pointerup", 18, 101));
    await nextTick();
    // The strip is the OUTER table's three rows: dropping row 0 at the end
    // is (0, 2) — not a slot among the five rows a descendant query sees.
    expect(t.emitted).toEqual([[0, 2]]);
  });

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

  it("paints the placeholder on the CELLS and rounds the end cells", () => {
    // The regression this pins (R1 P1): <tr>-level decoration is the
    // engine-unreliable class the predecessor's own warning ruled out —
    // the placeholder tint and its rounding must live on the cells, whose
    // boxes transform and round identically everywhere.
    expect(scss).toMatch(/\.hk-table-draggable \.hk-table-row\[data-dragging\] > \.hk-table-cell \{/);
    expect(scss).toMatch(/\[data-dragging\] > \.hk-table-cell:first-child \{[\s\S]*?border-top-left-radius: var\(--radius-md/);
    expect(scss).toMatch(/\[data-dragging\] > \.hk-table-cell:last-child \{[\s\S]*?border-bottom-right-radius: var\(--radius-md/);
    // The shift likewise rides the cells (named by the row's custom
    // property), never a row transform.
    expect(scss).toMatch(/\[data-shift\] > \.hk-table-cell \{[\s\S]*?transform: translateY\(var\(--hk-drag-shift/);
    expect(scss).not.toMatch(/^\s*clip-path:/m);
    // And the line-cue era is gone: no data-drop edge shadows survive.
    expect(scss).not.toMatch(/data-drop/);
  });

  it("the shift glides ride only a live, held, or releasing strip", () => {
    // Transitions armed by `data-dragging` / `data-shift-held` /
    // `data-releasing` on the TABLE: idle cells carry no transform
    // transition, so the forced stale-transform clear at a new drag's
    // measure never glides — and `data-releasing` is what keeps the
    // cancelled return a glide (the after-change style governs).
    expect(scss).toMatch(/\.hk-table-draggable\[data-dragging\] \.hk-table-row > \.hk-table-cell,/);
    expect(scss).toMatch(/\.hk-table-draggable\[data-shift-held\] \.hk-table-row > \.hk-table-cell,/);
    expect(scss).toMatch(/\.hk-table-draggable\[data-releasing\] \.hk-table-row > \.hk-table-cell \{/);
  });

  it("the ghost is a detached, semi-transparent, rounded lift below the popup bands", () => {
    expect(scss).toMatch(/\.hk-table-drag-ghost\s*\{/);
    expect(scss).toMatch(/position: fixed;/);
    expect(scss).toMatch(/border-radius: var\(--radius-md/);
    expect(scss).toMatch(/z-index: var\(--hk-z-drag, 950\)/);
    // The settle is a fade, driven by data-fading.
    expect(scss).toMatch(/&\[data-fading]\s*\{/);
  });

  it("reduced motion snaps the arrangement glides and the ghost fade", () => {
    const guard = scss.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(guard).toBeGreaterThan(-1);
    const block = scss.slice(guard);
    expect(block).toContain(".hk-table-drag-ghost");
    expect(block).toContain("transition: opacity 150ms ease");
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
