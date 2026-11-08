import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, provide } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import HTable, { type HkTableSection } from "./HkTable";
import {
  HK_SCROLL_PROGRESS_REGISTRAR,
  type HkScrollProgressHandle,
  type HkScrollProgressRegistrar,
} from "./HkScrollProgressDock";
import { useToast } from "../runtime/useToast";

/**
 * HkTable grouped/sectioned mode contract:
 * - ONE column header at the top (`<thead>` appears exactly once), then one
 *   `<tbody class="hk-table-section-body">` per section: a band row
 *   (`<th scope="rowgroup" colspan=totalCols>`) followed by that section's
 *   data rows
 * - the band is NOT a data row: no `.hk-table-row`, no copy target / hint,
 *   no grip, no checkbox, no ⋯ column — so copy, hover, selection, the drag
 *   strip and row actions all ignore it by construction
 * - sorting runs WITHIN each section and keeps the section order; selection
 *   spans every section and emits display order; a zero-row section keeps
 *   its band, and an all-empty sectioned table still renders one empty row
 * - drag-to-reorder is CLAMPED to the section that owns the pressed row and
 *   emits FLAT indices (section offset + section-local index); the FLIP
 *   shift only ever moves rows of the measured section
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils; happy-dom ships no layout engine, so row geometry is
 * pinned by hand.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => node });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  useToast().toasts.splice(0);
  // A ghost fading at release is removed by a bus timer — a test that ends
  // inside that window must not leak it into the next one.
  document.body.querySelectorAll(".hk-table-drag-ghost").forEach((n) => n.remove());
});

// `navigator.clipboard` does not exist under happy-dom — install a
// controllable stub (house pattern: HkCopyBadge.test.tsx).
let writeText: ReturnType<typeof vi.fn>;
const originalClipboard = navigator.clipboard;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: originalClipboard,
    configurable: true,
  });
});

const COLS = [
  { key: "name", title: "Name" },
  { key: "region", title: "Region" },
];

const SECTIONS: HkTableSection[] = [
  {
    key: "panel-a",
    label: "Panel A",
    rows: [
      { name: "alpha", region: "eu" },
      { name: "beta", region: "us" },
    ],
  },
  {
    key: "panel-b",
    label: "Panel B",
    rows: [
      { name: "gamma", region: "ap" },
      { name: "delta", region: "sa" },
    ],
  },
];

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

function sectionBodies(c: HTMLElement): HTMLElement[] {
  return Array.from(c.querySelectorAll<HTMLElement>("tbody.hk-table-section-body"));
}

describe("HkTable sections", () => {
  it("renders exactly one thead / one header row, then one body per section in order", () => {
    const c = mount(h(HTable, { columns: COLS, sections: SECTIONS }));

    expect(c.querySelectorAll("thead")).toHaveLength(1);
    expect(c.querySelectorAll("thead tr")).toHaveLength(1);
    expect(c.querySelectorAll("thead th")).toHaveLength(COLS.length);

    const bodies = sectionBodies(c);
    expect(bodies).toHaveLength(2);
    expect(bodies.map((body) => body.dataset.sectionKey)).toEqual(["panel-a", "panel-b"]);
    expect(
      bodies.map((body) => body.querySelector(".hk-table-section-cell")?.textContent),
    ).toEqual(["Panel A", "Panel B"]);
    expect(
      bodies.map((body) => body.querySelector(".hk-table-section-label")?.textContent),
    ).toEqual(["Panel A", "Panel B"]);
    expect(bodies.map((body) => body.querySelectorAll(".hk-table-row").length)).toEqual([2, 2]);
    expect(
      Array.from(bodies[0]!.querySelectorAll<HTMLElement>(".hk-table-row")).map(
        (row) => row.querySelector(".hk-table-cell")?.textContent,
      ),
    ).toEqual(["alpha", "beta"]);
  });

  it("lets the section slot override the band and receives the section + index", () => {
    const seen: Array<[string, number]> = [];
    const c = mount(
      h(HTable, { columns: COLS, sections: SECTIONS }, {
        section: ({ section, index }: { section: HkTableSection; index: number }) => {
          seen.push([section.key, index]);
          return h("span", { class: "probe-band" }, `${index}:${section.label}`);
        },
      }),
    );
    const bands = Array.from(
      c.querySelectorAll<HTMLElement>(".hk-table-section-cell .probe-band"),
    );
    expect(bands.map((band) => band.textContent)).toEqual(["0:Panel A", "1:Panel B"]);
    expect(seen.slice(0, 2)).toEqual([
      ["panel-a", 0],
      ["panel-b", 1],
    ]);
  });

  it("keeps today's single-body markup when sections is absent", () => {
    const c = mount(
      h(HTable, {
        columns: COLS,
        rows: [{ name: "alpha", region: "eu" }],
      }),
    );
    expect(c.querySelectorAll("tbody")).toHaveLength(1);
    expect(c.querySelectorAll(".hk-table-section-row")).toHaveLength(0);
    expect(c.querySelectorAll("thead")).toHaveLength(1);
  });

  it("renders the band as a rowgroup header spanning every column and never a data row", () => {
    const c = mount(
      h(HTable, {
        columns: COLS,
        sections: SECTIONS,
        selectable: true,
        draggable: true,
        manageable: true,
      }),
    );
    const totalCols = COLS.length + 3;
    const bandRows = Array.from(c.querySelectorAll<HTMLElement>("tr.hk-table-section-row"));
    expect(bandRows).toHaveLength(2);

    for (const row of bandRows) {
      expect(row.classList.contains("hk-table-row")).toBe(false);
      expect(row.querySelectorAll("th")).toHaveLength(1);
      const cell = row.querySelector("th")!;
      expect(cell.classList.contains("hk-table-section-cell")).toBe(true);
      expect(cell.getAttribute("scope")).toBe("rowgroup");
      expect(cell.getAttribute("colspan")).toBe(String(totalCols));
      expect(row.querySelector(".hk-table-drag-handle")).toBeNull();
      expect(row.querySelector(".hk-table-checkbox-input")).toBeNull();
      expect(row.querySelector(".hk-table-manage-cell")).toBeNull();
    }

    // The data rows still carry every extra track the band skipped.
    expect(c.querySelectorAll(".hk-table-row .hk-table-drag-handle")).toHaveLength(4);
    expect(c.querySelectorAll(".hk-table-row .hk-table-checkbox-input")).toHaveLength(4);
    expect(c.querySelectorAll(".hk-table-row .hk-table-manage-cell")).toHaveLength(4);
  });

  it("never treats a band cell as a copy target", async () => {
    const c = mount(
      h(HTable, {
        columns: COLS,
        sections: SECTIONS,
        selectable: true,
        draggable: true,
        manageable: true,
      }),
    );
    const bands = Array.from(c.querySelectorAll<HTMLElement>(".hk-table-section-cell"));
    expect(bands).toHaveLength(2);
    for (const band of bands) {
      expect(band.hasAttribute("data-copy-cell")).toBe(false);
      expect(band.getAttribute("title")).toBeNull();
      expect(band.querySelector("[data-copy-cell]")).toBeNull();
      band.click();
    }
    await settle();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("does not hook the copy layer into slot-rendered band content", async () => {
    const c = mount(
      h(HTable, { columns: COLS, sections: SECTIONS }, {
        section: ({ section }: { section: HkTableSection }) =>
          h("span", { class: "probe-band" }, section.label ?? section.key),
      }),
    );
    const bands = Array.from(c.querySelectorAll<HTMLElement>(".probe-band"));
    expect(bands).toHaveLength(2);
    for (const band of bands) {
      expect(band.closest("[data-copy-cell]")).toBeNull();
      expect(band.closest("th")?.getAttribute("data-copy-cell")).toBeNull();
      expect(band.getAttribute("title")).toBeNull();
      band.click();
    }
    await settle();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("keeps a zero-row section's band and renders no data row for it", () => {
    const sections: HkTableSection[] = [
      { key: "panel-a", label: "Panel A", rows: [{ name: "alpha", region: "eu" }] },
      { key: "panel-b", label: "Panel B", rows: [] },
    ];
    const c = mount(h(HTable, { columns: COLS, sections }));
    const bodies = sectionBodies(c);
    expect(bodies).toHaveLength(2);
    expect(bodies[1]!.querySelector(".hk-table-section-cell")?.textContent).toBe("Panel B");
    expect(bodies[1]!.querySelectorAll(".hk-table-row")).toHaveLength(0);
    expect(c.querySelector(".hk-table-empty")).toBeNull();
  });

  it("renders today's empty row when every section is empty", () => {
    const c = mount(
      h(HTable, {
        columns: COLS,
        sections: [
          { key: "panel-a", label: "Panel A", rows: [] },
          { key: "panel-b", label: "Panel B", rows: [] },
        ],
        emptyText: "nothing here",
      }),
    );
    expect(c.querySelectorAll("tr.hk-table-section-row")).toHaveLength(2);
    expect(c.querySelectorAll(".hk-table-row")).toHaveLength(0);
    const empty = c.querySelector<HTMLElement>(".hk-table-empty");
    expect(empty).not.toBeNull();
    expect(empty!.textContent).toBe("nothing here");
    expect(empty!.getAttribute("colspan")).toBe(String(COLS.length));
  });

  it("sorts inside each section and keeps the section order", async () => {
    const columns = [{ key: "name", title: "Name", sortable: true }];
    const sections: HkTableSection[] = [
      { key: "panel-a", label: "Panel A", rows: [{ name: "b" }, { name: "a" }] },
      { key: "panel-b", label: "Panel B", rows: [{ name: "d" }, { name: "c" }] },
    ];
    const c = mount(h(HTable, { columns, sections }));

    (c.querySelector("thead th") as HTMLElement).click();
    await nextTick();

    const bodies = sectionBodies(c);
    expect(bodies.map((body) => body.dataset.sectionKey)).toEqual(["panel-a", "panel-b"]);
    expect(
      bodies.map((body) =>
        Array.from(body.querySelectorAll(".hk-table-row .hk-table-cell")).map(
          (cell) => cell.textContent,
        ),
      ),
    ).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("emits manage only from data rows", async () => {
    const emitted: string[] = [];
    const c = mount(
      h(HTable, {
        columns: COLS,
        sections: SECTIONS,
        rowKey: "name",
        manageable: true,
        onManage: (row: Record<string, unknown>) => emitted.push(String(row.name)),
      }),
    );
    const triggers = Array.from(
      c.querySelectorAll<HTMLElement>(".hk-table-manage-cell button"),
    );
    expect(triggers).toHaveLength(4);
    expect(c.querySelectorAll("tr.hk-table-section-row .hk-table-manage-cell")).toHaveLength(0);

    triggers[0]!.click();
    triggers[3]!.click();
    await settle();
    expect(emitted).toEqual(["alpha", "delta"]);
  });

  it("selects every row across sections once and emits display order", async () => {
    let selected: Record<string, unknown>[] = [];
    const c = mount(
      h(HTable, {
        columns: COLS,
        sections: SECTIONS,
        rowKey: "name",
        selectable: true,
        "onUpdate:selectedRows": (rows: Record<string, unknown>[]) => {
          selected = rows;
        },
      }),
    );

    const header = c.querySelector<HTMLInputElement>("thead .hk-table-checkbox-input")!;
    header.checked = true;
    header.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(selected.map((row) => row.name)).toEqual(["alpha", "beta", "gamma", "delta"]);
    expect(selected).toHaveLength(4);

    // Toggling one row off keeps the remaining rows in display order.
    const firstRowInput = c.querySelector<HTMLInputElement>(
      "tbody.hk-table-section-body .hk-table-checkbox-input",
    )!;
    firstRowInput.checked = false;
    firstRowInput.dispatchEvent(new Event("change", { bubbles: true }));
    await settle();
    expect(selected.map((row) => row.name)).toEqual(["beta", "gamma", "delta"]);
  });
});

interface SectionsTable {
  container: HTMLElement;
  emitted: Array<[number, number]>;
  bodies: HTMLElement[];
  handles: HTMLElement[];
}

function pinRect(el: HTMLElement, top: number): void {
  const box = {
    left: 0,
    right: 300,
    top,
    bottom: top + 40,
    width: 300,
    height: 40,
    x: 0,
    y: top,
  };
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () => box as DOMRect,
  });
}

/** Two sections of two rows. Geometry is pinned by hand (happy-dom has no
 *  layout): panel A rows at y 0/40, panel B rows at y 200/240 — far enough
 *  apart that a pointer over B is unambiguously outside A's strip. */
function mountDraggableSections(): SectionsTable {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const emitted: Array<[number, number]> = [];
  const sections: HkTableSection[] = [
    { key: "panel-a", label: "Panel A", rows: [{ name: "a0" }, { name: "a1" }] },
    { key: "panel-b", label: "Panel B", rows: [{ name: "b0" }, { name: "b1" }] },
  ];
  const app = createApp({
    render: () =>
      h(HTable, {
        columns: [{ key: "name", title: "Name" }],
        sections,
        rowKey: "name",
        draggable: true,
        onReorder: (from: number, to: number) => emitted.push([from, to]),
      }),
  });
  mounts.push({ app, container });
  app.mount(container);

  const bodies = sectionBodies(container);
  const tops: Record<string, number[]> = {
    "panel-a": [0, 40],
    "panel-b": [200, 240],
  };
  for (const body of bodies) {
    const sectionTop = tops[body.dataset.sectionKey!]!;
    Array.from(body.querySelectorAll<HTMLElement>(".hk-table-row")).forEach((row, i) => {
      pinRect(row, sectionTop[i]!);
    });
  }
  return {
    container,
    emitted,
    bodies,
    handles: Array.from(container.querySelectorAll<HTMLElement>(".hk-table-drag-handle")),
  };
}

function pointer(type: string, y: number, pointerId = 7): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId,
    button: 0,
    // A move with no button held is a released pointer the page never saw
    // the release of — the engine ignores it, so the gesture carries the
    // pressed button until the final up.
    buttons: type === "pointerup" ? 0 : 1,
    clientX: 18,
    clientY: y,
  });
}

describe("HkTable section-clamped reorder", () => {
  it("measures the pressed section's rows and keeps the FLIP shift section-local", async () => {
    const t = mountDraggableSections();
    t.handles[0]!.dispatchEvent(pointer("pointerdown", 20));
    window.dispatchEvent(pointer("pointermove", 70));
    await nextTick();

    // 0 → 1: the placeholder rides down one 40px slot, its neighbour glides
    // up — only in section A.
    const aRows = Array.from(t.bodies[0]!.querySelectorAll<HTMLElement>(".hk-table-row"));
    expect((aRows[0]!.getAttribute("style") ?? "").replace(/\s+/g, "")).toContain(
      "--hk-drag-shift:40px",
    );
    expect((aRows[1]!.getAttribute("style") ?? "").replace(/\s+/g, "")).toContain(
      "--hk-drag-shift:-40px",
    );
    for (const row of t.bodies[1]!.querySelectorAll<HTMLElement>(".hk-table-row")) {
      expect(row.getAttribute("style")).toBeNull();
      expect(row.hasAttribute("data-shift")).toBe(false);
    }

    window.dispatchEvent(pointer("pointerup", 70));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1]]);
  });

  it("marks exactly one row as dragging while a section drag is live", async () => {
    const t = mountDraggableSections();
    t.handles[0]!.dispatchEvent(pointer("pointerdown", 20));
    window.dispatchEvent(pointer("pointermove", 26));
    await nextTick();

    // `dragFrom` is strip-local and restarts at 0 in every section: without
    // the pressed-section guard, row 0 of BOTH sections carries the dim /
    // tint paint.
    const dragging = Array.from(
      t.container.querySelectorAll<HTMLElement>(".hk-table-row[data-dragging]"),
    );
    expect(dragging).toHaveLength(1);
    expect(dragging[0]).toBe(t.bodies[0]!.querySelectorAll(".hk-table-row")[0]);

    // Press release (no movement past the origin) clears the lifecycle.
    window.dispatchEvent(pointer("pointerup", 26));
    await nextTick();
    expect(t.container.querySelectorAll(".hk-table-row[data-dragging]")).toHaveLength(0);
  });

  it("ignores a second pointerdown while a press is live", async () => {
    const t = mountDraggableSections();
    // First pointer presses section A's first grip but has not moved yet.
    t.handles[0]!.dispatchEvent(pointer("pointerdown", 20));
    // A second pointer (id 8) lands on section B's grip: it must not re-arm
    // the strip, or the in-flight A drag is abandoned on its next move.
    t.handles[2]!.dispatchEvent(pointer("pointerdown", 220, 8));
    window.dispatchEvent(pointer("pointermove", 70));
    window.dispatchEvent(pointer("pointerup", 70));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1]]);
    expect(t.container.querySelectorAll(".hk-table-row[data-dragging]")).toHaveLength(0);
  });

  it("emits the pressed section's flat offset (section B: 2 → 3)", async () => {
    const t = mountDraggableSections();
    t.handles[2]!.dispatchEvent(pointer("pointerdown", 220));
    window.dispatchEvent(pointer("pointermove", 270));
    window.dispatchEvent(pointer("pointerup", 270));
    await nextTick();
    expect(t.emitted).toEqual([[2, 3]]);
  });

  it("clamps the strip: dragging into another section's band cannot land there", async () => {
    const t = mountDraggableSections();
    // Pointer y=230 is inside panel B. Unclamped, the flat strip would
    // resolve to B's first row (flat index 2); the clamped strip only
    // knows A's two rows, so the drop stays inside A.
    t.handles[0]!.dispatchEvent(pointer("pointerdown", 20));
    window.dispatchEvent(pointer("pointermove", 230));
    window.dispatchEvent(pointer("pointerup", 230));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1]]);
    expect(t.emitted[0]![1]).toBeLessThan(2);
  });

  it("emits nothing when a row is dragged out of its own section", async () => {
    const t = mountDraggableSections();
    // Panel B's first row dragged up onto panel A's first row (y=20): the
    // clamp leaves only B in the drop space, so the pointer above the strip
    // resolves to B's own index — no cross-section move is emitted. An
    // unclamped strip would have resolved to A's row (emit 2 → 0), which is
    // what this asserts against.
    t.handles[2]!.dispatchEvent(pointer("pointerdown", 220));
    window.dispatchEvent(pointer("pointermove", 20));
    window.dispatchEvent(pointer("pointerup", 20));
    await nextTick();
    expect(t.emitted).toEqual([]);
  });

  it("does not smear another section's measured tops into a keyboard commit", async () => {
    const t = mountDraggableSections();
    // A real drop in panel A holds its arrangement (the consumer has not
    // landed the new sections yet) and leaves panel A's strip measured.
    t.handles[0]!.dispatchEvent(pointer("pointerdown", 20));
    window.dispatchEvent(pointer("pointermove", 70));
    // The drag must actually LIVE one frame (that is when the strip is
    // measured) before the release, or there is no measurement to misuse.
    await nextTick();
    window.dispatchEvent(pointer("pointerup", 70));
    await nextTick();
    expect(t.emitted).toEqual([[0, 1]]);
    // Panel A's held drop paints from its own measured strip.
    expect(t.bodies[0]!.querySelector(".hk-table-row")!.getAttribute("style")).toContain(
      "--hk-drag-shift",
    );

    // A keyboard reorder in panel B is a DIFFERENT strip: panel A's measured
    // tops (40px rows at y 0/40) must not paint panel B's rows (60px rows at
    // y 200/240). With a foreign measurement reused, B's rows would carry a
    // 40px shift; the commit must drop it instead.
    t.handles[2]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(t.emitted).toEqual([
      [0, 1],
      [2, 3],
    ]);
    for (const row of Array.from(t.bodies[1]!.querySelectorAll<HTMLElement>(".hk-table-row"))) {
      expect(row.getAttribute("style")).toBeNull();
      expect(row.hasAttribute("data-shift")).toBe(false);
    }
  });

  it("keeps the keyboard twin clamped to the row's section and flat", async () => {
    const t = mountDraggableSections();
    t.handles[2]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(t.emitted).toEqual([[2, 3]]);

    // A's last row has nowhere to go inside A — and must not spill into B.
    t.handles[1]!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }),
    );
    await nextTick();
    expect(t.emitted).toEqual([[2, 3]]);
  });
});

describe("HkTable scroll-progress registration", () => {
  it("hands the pill data rows only in sectioned mode", () => {
    const handles: HkScrollProgressHandle[] = [];
    const registrar: HkScrollProgressRegistrar = {
      register: (handle) => handles.push(handle),
      unregister: () => {},
    };
    const Provider = defineComponent({
      setup() {
        provide(HK_SCROLL_PROGRESS_REGISTRAR, registrar);
        return () => h(HTable, { columns: COLS, sections: SECTIONS });
      },
    });
    mount(h(Provider));
    expect(handles).toHaveLength(1);

    const rows = handles[0]!.getRows?.() ?? [];
    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.classList.contains("hk-table-row"))).toBe(true);
    expect(rows.some((row) => row.classList.contains("hk-table-section-row"))).toBe(false);
  });

  it("counts only its OWN rows when a sectioned table nests inside a cell", () => {
    const handles: HkScrollProgressHandle[] = [];
    const registrar: HkScrollProgressRegistrar = {
      register: (handle) => handles.push(handle),
      unregister: () => {},
    };
    const inner = () =>
      h(HTable, {
        columns: COLS,
        sections: [
          {
            key: "inner",
            rows: [{ name: "i0" }, { name: "i1" }, { name: "i2" }],
          },
        ],
      });
    const Provider = defineComponent({
      setup() {
        provide(HK_SCROLL_PROGRESS_REGISTRAR, registrar);
        return () =>
          h(
            HTable,
            {
              columns: COLS,
              sections: [
                { key: "outer", rows: [{ name: "o0" }, { name: "o1" }] },
              ],
            },
            { "cell-name": () => inner() },
          );
      },
    });
    mount(h(Provider));

    // The outer table registered, and each of its two rows rendered an inner
    // sectioned table (three registrations in total). The outer handle must
    // report its OWN two data rows — the host subtree also contains the
    // nested tables, and a bare descendant query would count 2 + 3 + 3.
    const roots = handles.map((handle) => handle.getRoot());
    const outer = handles.find((_handle, index) => {
      const root = roots[index];
      return (
        root != null &&
        roots.some((other) => other != null && other !== root && root.contains(other))
      );
    });
    expect(outer).toBeDefined();
    const ownRows = outer!.getRows?.() ?? [];
    expect(ownRows).toHaveLength(2);
    // Both reported rows belong to the OUTER table's own body — never to a
    // nested table's body (its rows are descendants of the same host).
    const outerTable = outer!.getRoot()?.querySelector("table.hk-table") ?? null;
    expect(outerTable).not.toBeNull();
    expect(ownRows.every((row) => row.closest("table") === outerTable)).toBe(true);
  });

  it("keeps the container selector path for unsectioned tables", () => {
    const handles: HkScrollProgressHandle[] = [];
    const registrar: HkScrollProgressRegistrar = {
      register: (handle) => handles.push(handle),
      unregister: () => {},
    };
    const Provider = defineComponent({
      setup() {
        provide(HK_SCROLL_PROGRESS_REGISTRAR, registrar);
        return () => h(HTable, { columns: COLS, rows: SECTIONS[0]!.rows });
      },
    });
    mount(h(Provider));
    expect(handles).toHaveLength(1);
    // Undefined = the container keeps its `scrollProgressSelector` path
    // byte-for-byte; a sectioned table hands over its own row elements.
    expect(handles[0]!.getRows?.()).toBeUndefined();
  });
});

describe("HkTable section band stylesheet", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const scss = readFileSync(join(here, "HkTable.scss"), "utf-8");
  const bandStart = scss.indexOf("/* ── Section bands");
  const bandEnd = scss.indexOf("/* ── Drag-to-reorder");
  const bandBlock = scss.slice(bandStart, bandEnd);
  // Comments may NAME a property the guard forbids ("no white-space …");
  // only declarations are contract.
  const bandCss = bandBlock.replace(/\/\*[\s\S]*?\*\//g, "");

  function ruleBody(selector: string): string {
    const at = bandCss.indexOf(selector);
    expect(at, `missing rule ${selector}`).toBeGreaterThan(-1);
    return bandCss.slice(bandCss.indexOf("{", at) + 1, bandCss.indexOf("}", at));
  }

  it("styles the band track and leaves consumer slot typography alone", () => {
    expect(bandStart).toBeGreaterThan(-1);
    expect(bandEnd).toBeGreaterThan(bandStart);

    const cell = ruleBody(".hk-table-section-cell");
    expect(cell).toContain("text-align: start");
    expect(cell).toContain("border-bottom");
    expect(cell).toContain("background:");
    // The UA's `th { font-weight: bold }` must not leak into slot content.
    expect(cell).toContain("font-weight: inherit");
    expect(cell).not.toMatch(/font-weight:\s*(?:bold|[1-9]\d{2})/);
    expect(cell).not.toContain("font-size:");
    // A long panel name / chip row may wrap; selectable text keeps its
    // I-beam (the band never carries `data-copy-cell`).
    expect(cell).not.toContain("white-space");
    expect(cell).not.toContain("cursor");
    expect(cell).not.toContain("text-transform");
    expect(cell).not.toContain("letter-spacing");

    // The whole band block must not reintroduce those on any rule (sm/lg,
    // bordered, label), while the default-label span owns its own size.
    expect(bandCss).not.toContain("text-transform");
    expect(bandCss).not.toContain("letter-spacing");
    expect(bandCss).not.toContain("white-space");
    expect(bandCss).not.toContain("cursor");
    const label = ruleBody(".hk-table-section-label");
    expect(label).toContain("font-size: var(--text-sm");
    expect(label).toContain("font-weight: 500");
  });

  it("keeps hover feedback alive on a striped sectioned table", () => {
    // The scoped zebra pair is (0,4,0); the shared hover rule is (0,3,0),
    // so without a sectioned hover re-statement the pointer feedback dies on
    // every row of a striped sectioned table.
    expect(scss).toMatch(
      /\.hk-table-striped\.hk-table-hover \.hk-table-section-body \.hk-table-row:hover \{/,
    );
  });

  it("walks the band padding down the sm/md/lg ladder without scaling type", () => {
    expect(bandCss).toContain(".hk-table-sm .hk-table-section-cell");
    expect(bandCss).toContain(".hk-table-lg .hk-table-section-cell");
    expect(bandCss).toContain("var(--space-16, 16px) var(--space-24, 24px)");
    for (const selector of [
      ".hk-table-sm .hk-table-section-cell",
      ".hk-table-lg .hk-table-section-cell",
    ]) {
      const body = ruleBody(selector);
      expect(body.trim()).toMatch(/^padding:/);
      expect(body).not.toContain("font-size");
      expect(body).not.toContain("font-weight");
    }
  });

  it("restarts the striped phase after each section's band", () => {
    const compact = scss.replace(/\s+/g, " ");
    // The band is child 1, so the base even rule would shade every
    // section's FIRST data row. The scoped pair restores the unsectioned
    // first-row-unshaded phase.
    expect(compact).toContain(
      ".hk-table-striped .hk-table-section-body .hk-table-row:nth-child(even) { background: none; }",
    );
    expect(compact).toContain(
      ".hk-table-striped .hk-table-section-body .hk-table-row:nth-child(odd) { background: var(--hi-color-bg-subtle, rgba(255, 255, 255, 0.03)); }",
    );
  });
});
