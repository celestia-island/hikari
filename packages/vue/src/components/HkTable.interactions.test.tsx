import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as sass from "sass";

import HTable from "./HkTable";
import { useToast } from "../runtime/useToast";

/**
 * HkTable interaction contract (2026-10-18 user direction, on top of the
 * 2026-10-05 tag contract and the 2026-10-12 row-manage ruling):
 * - plain text in a cell copies on click through the shared
 *   clipboard-with-toast path (same runtime as HkCopyBadge) — no bare
 *   selection, no drag mass-select (user-select: none, scoped by
 *   `data-copy-cells`)
 * - interactive descendants (controls, button-role elements, popup
 *   owners, `[data-no-copy]`) own their clicks; the copy layer never
 *   swallows them
 * - only TEXT LEAVES copy — layout wrappers and cell padding never
 *   sweep up descendant text, and per the 2026-10-18 ruling a cell
 *   body click does NOT open row actions (the ⋯ trigger stays the only
 *   row-action affordance)
 * - `Column.copyable: false` and the table-wide `copy-cells=false` opt
 *   out wholesale
 * - the click cursor (`pointer`; the copy SEMANTICS live in the `title`
 *   hint) and the hover hint ride `[data-copy-cell]` — the default text
 *   cells, in a copyable column, whose value still renders text — never
 *   every cell, so the cursor describes what a background click really
 *   does. Slot cells' inner leaves still copy, so their
 *   plain arrow is a deliberate under-promise (2026-11-07 user
 *   direction)
 * - `manageable` renders the trailing ⋯ column (HkRowActions) and
 *   emits `manage(row, opener)`; the trigger click never copies
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mount(node: ReturnType<typeof h>) {
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
  { key: "endpoint", title: "Endpoint" },
];

// The compiled sheet, injected into the document so `getComputedStyle` sees
// the REAL cascade. Selector-text assertions cannot catch a rule that reaches
// an unmarked cell through inheritance, an element selector (`td`) or a media
// block — the cascade can.
//
// `style: "expanded"` is load-bearing: the compressed writer emits
// `@media(min-width:600px)` (no space after `@media`) and happy-dom then
// DROPS the whole block (cssRules stays empty), which would make a
// media-wrapped widening rule invisible to this suite.
const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, "..");
const SHEET_CSS = sass.compile(resolve(HERE, "HkTable.scss"), {
  loadPaths: [SRC, join(SRC, "components"), join(SRC, "styles"), join(SRC, "styles", "theme")],
  style: "expanded",
  silenceDeprecations: ["import", "global-builtin", "legacy-js-api"],
}).css;
// happy-dom reports an unset cursor as "" (a browser reports "auto").
const isAuto = (value: string): boolean => value === "" || value === "auto";

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

function bodyCells(c: HTMLElement): HTMLElement[] {
  return Array.from(c.querySelectorAll<HTMLElement>("tbody .hk-table-cell"));
}

describe("HkTable cell copy layer", () => {
  it("clicking a default text cell copies its text and toasts success", async () => {
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "https://x.example" }] }),
    );
    bodyCells(c)[0]!.click();
    await settle();
    expect(writeText).toHaveBeenCalledWith("alpha");
    const success = useToast().toasts.find((t) => t.type === "success");
    expect(success?.messages.some((m) => m.text === "Copied")).toBe(true);
  });

  it("a slot cell's plain text leaf copies that leaf, not the whole cell", async () => {
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "" }] }, {
        "cell-endpoint": () =>
          h("div", { class: "probe-endpoint" }, [
            h("span", { class: "probe-url" }, "https://a.example"),
            h("span", { class: "probe-via" }, "via gw-1"),
          ]),
      }),
    );
    (c.querySelector(".probe-url") as HTMLElement).click();
    await settle();
    expect(writeText).toHaveBeenCalledWith("https://a.example");
    expect(writeText).not.toHaveBeenCalledWith("https://a.examplevia gw-1");
  });

  it("interactive descendants own their clicks — no copy, no toast", async () => {
    const onToggle = vi.fn();
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "" }] }, {
        "cell-endpoint": () =>
          h("div", null, [
            h("span", { role: "button", onClick: onToggle }, "toggle-me"),
            h("span", { class: "probe-rest" }, "plain"),
          ]),
      }),
    );
    const toggle = Array.from(c.querySelectorAll<HTMLElement>('[role="button"]'))[0]!;
    toggle.click();
    await settle();
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("a data-no-copy marker opts its subtree out of the copy layer", async () => {
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "" }] }, {
        "cell-endpoint": () =>
          h("div", { "data-no-copy": "" }, h("span", { class: "probe-nope" }, "do-not-copy")),
      }),
    );
    (c.querySelector(".probe-nope") as HTMLElement).click();
    await settle();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("clicking a layout wrapper (gaps between chips) copies nothing", async () => {
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "" }] }, {
        "cell-endpoint": () =>
          h("div", { class: "probe-composite" }, [
            h("span", null, "one"),
            h("span", null, "two"),
          ]),
      }),
    );
    (c.querySelector(".probe-composite") as HTMLElement).click();
    await settle();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("cell padding around slot content does nothing (body clicks never open row actions)", async () => {
    const onManage = vi.fn();
    const c = mount(
      h(HTable, {
        columns: COLS,
        rows: [{ name: "alpha", endpoint: "" }],
        manageable: true,
        onManage,
      }, {
        "cell-endpoint": () => h("div", { class: "probe-slot" }, "slot-text"),
      }),
    );
    const endpointTd = Array.from(c.querySelectorAll<HTMLElement>("tbody td")).find(
      (td) => td.querySelector(".probe-slot"),
    )!;
    endpointTd.click();
    await settle();
    expect(writeText).not.toHaveBeenCalled();
    expect(onManage).not.toHaveBeenCalled();
  });

  it("column copyable:false opts that column out", async () => {
    const c = mount(
      h(HTable, {
        columns: [...COLS, { key: "secret", title: "Secret", copyable: false }],
        rows: [{ name: "alpha", endpoint: "", secret: "nope-token" }],
      }),
    );
    const tds = bodyCells(c);
    tds[0]!.click();
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
    tds[2]!.click();
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalledWith("nope-token");
  });

  it("copy-cells=false disables the layer and the scoping attribute", async () => {
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "" }], copyCells: false }),
    );
    expect(c.querySelector("table.hk-table")!.hasAttribute("data-copy-cells")).toBe(false);
    bodyCells(c)[0]!.click();
    await settle();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("default-rendered copyable cells advertise the click-to-copy hint", () => {
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "https://x.example" }] }),
    );
    const td = bodyCells(c)[0]!;
    expect(td.getAttribute("title")).toBe("Click to copy");
  });
});

describe("HkTable copy affordance marker", () => {
  it("marks text cells in copyable columns only — slot and opt-out cells stay plain", () => {
    // The slot cell's VALUE is non-empty (and the slot renders plain
    // text), so `!isSlotCell` is the only reason it can fail here — a
    // fixture with an empty value would hide that clause behind the
    // emptiness gate.
    const c = mount(
      h(
        HTable,
        {
          columns: [...COLS, { key: "secret", title: "Secret", copyable: false }],
          rows: [
            { name: "alpha", endpoint: "https://x.example", secret: "nope-token" },
          ],
        },
        {
          "cell-endpoint": () => "pure-text-slot",
        },
      ),
    );
    const tds = bodyCells(c);
    // Default text cell: the marker and the hint are ONE predicate.
    expect(tds[0]!.hasAttribute("data-copy-cell")).toBe(true);
    expect(tds[0]!.getAttribute("title")).toBe("Click to copy");
    // Slot cell: the td surface does NOT advertise. (A bare-text slot's
    // surface click does copy the text — the marker still stays off: the
    // slot owns its hints, so the arrow under-promises on purpose.)
    expect(tds[1]!.textContent).toBe("pure-text-slot");
    expect(tds[1]!.hasAttribute("data-copy-cell")).toBe(false);
    expect(tds[1]!.getAttribute("title")).toBeNull();
    // `copyable: false` column: same.
    expect(tds[2]!.textContent).toBe("nope-token");
    expect(tds[2]!.hasAttribute("data-copy-cell")).toBe(false);
    expect(tds[2]!.getAttribute("title")).toBeNull();
  });

  it("an empty text cell copies nothing, so it advertises nothing", () => {
    const c = mount(h(HTable, { columns: COLS, rows: [{ name: "   ", endpoint: "" }] }));
    const tds = bodyCells(c);
    expect(tds[0]!.hasAttribute("data-copy-cell")).toBe(false);
    expect(tds[0]!.getAttribute("title")).toBeNull();
  });

  it("a value that renders no text (boolean / null) advertises nothing", async () => {
    // Vue normalizes booleans and null into comment placeholders, so the
    // cell renders nothing and a click cannot copy anything — a
    // `String(value)`-based predicate would have lied here.
    const c = mount(
      h(HTable, {
        columns: COLS,
        rows: [{ name: false, endpoint: null }],
      }),
    );
    const tds = bodyCells(c);
    for (const td of tds) {
      expect(td.textContent).toBe("");
      expect(td.hasAttribute("data-copy-cell")).toBe(false);
    }
    // This pins the HANDLER's own emptiness gate (depth in front of the
    // marker predicate), not the marker: the two must not drift apart.
    tds[0]!.click();
    await settle();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("the drag, selection and row-action tracks are never copy surfaces", () => {
    const c = mount(
      h(HTable, {
        columns: COLS,
        rows: [{ name: "alpha", endpoint: "https://x.example" }],
        draggable: true,
        selectable: true,
        manageable: true,
      }),
    );
    // drag grip, selection, name, endpoint, row actions.
    const tds = Array.from(c.querySelectorAll<HTMLElement>("tbody td"));
    expect(tds).toHaveLength(5);
    expect(tds[0]!.classList.contains("hk-table-drag-cell")).toBe(true);
    expect(tds[1]!.querySelector(".hk-table-checkbox-input")).not.toBeNull();
    expect(tds[4]!.classList.contains("hk-table-manage-cell")).toBe(true);
    for (const td of [tds[0]!, tds[1]!, tds[4]!]) {
      expect(td.hasAttribute("data-copy-cell")).toBe(false);
    }
    // Both data cells still advertise.
    expect(tds[2]!.hasAttribute("data-copy-cell")).toBe(true);
    expect(tds[3]!.hasAttribute("data-copy-cell")).toBe(true);
  });

  it("copy-cells=false drops the marker together with the layer", () => {
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "x" }], copyCells: false }),
    );
    for (const td of bodyCells(c)) {
      expect(td.hasAttribute("data-copy-cell")).toBe(false);
    }
  });
});

describe("HkTable manageable column", () => {
  it("renders the trailing ⋯ column and emits manage(row, opener)", async () => {
    const rows = [
      { name: "alpha", endpoint: "" },
      { name: "beta", endpoint: "" },
    ];
    const emitted: Array<[Record<string, unknown>, HTMLElement]> = [];
    const c = mount(
      h(HTable, {
        columns: COLS,
        rows,
        rowKey: "name",
        manageable: true,
        onManage: (row: Record<string, unknown>, opener: HTMLElement) =>
          emitted.push([row, opener]),
      }),
    );
    // Header gained one trailing column; every row carries the trigger.
    expect(c.querySelectorAll("thead th")).toHaveLength(COLS.length + 1);
    const triggers = Array.from(
      c.querySelectorAll<HTMLElement>(".hk-table-manage-cell button"),
    );
    expect(triggers).toHaveLength(2);
    expect(triggers[0]!.getAttribute("aria-label")).toBe("Row actions");
    triggers[0]!.click();
    await settle();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]![0]).toBe(rows[0]);
    expect(emitted[0]![1]).toBe(triggers[0]);
    // The trigger press never leaks into the copy layer.
    expect(writeText).not.toHaveBeenCalled();
  });

  it("manageable=false (default) renders no actions column", () => {
    const c = mount(h(HTable, { columns: COLS, rows: [{ name: "a", endpoint: "" }] }));
    expect(c.querySelector(".hk-table-manage-cell")).toBeNull();
    expect(c.querySelectorAll("thead th")).toHaveLength(COLS.length);
  });

  it("manage gate: rows hide the trigger or render it disabled", async () => {
    const rows = [
      { name: "alpha", endpoint: "", state: "on" },
      { name: "beta", endpoint: "", state: "no-perm" },
      { name: "gamma", endpoint: "", state: "readonly" },
    ];
    const emitted: Array<[Record<string, unknown>, HTMLElement]> = [];
    const c = mount(
      h(HTable, {
        columns: COLS,
        rows,
        rowKey: "name",
        manageable: (row: Record<string, unknown>) =>
          row.state === "readonly" ? "disabled" : row.state === "on",
        onManage: (row: Record<string, unknown>, opener: HTMLElement) =>
          emitted.push([row, opener]),
      }),
    );
    const cells = Array.from(c.querySelectorAll<HTMLElement>(".hk-table-manage-cell"));
    expect(cells).toHaveLength(3);
    // A gated-off row renders an EMPTY cell — no ⋯ at all, not a dead
    // button (roster convention: permission gates hide the affordance).
    expect(cells[1]!.querySelector("button")).toBeNull();
    // A read-only row keeps the affordance but refuses activation.
    const readonlyBtn = cells[2]!.querySelector("button") as HTMLButtonElement;
    expect(readonlyBtn.disabled).toBe(true);
    readonlyBtn.click();
    await settle();
    expect(emitted).toHaveLength(0);
    // The on row runs the normal path.
    const onBtn = cells[0]!.querySelector("button") as HTMLButtonElement;
    onBtn.click();
    await settle();
    expect(emitted).toHaveLength(1);
    expect(emitted[0]![0]).toBe(rows[0]);
  });
});

describe("HkTable interaction stylesheet", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const scss = readFileSync(join(here, "HkTable.scss"), "utf-8");

  it("scopes the selection kill under data-copy-cells", () => {
    expect(scss).toContain(".hk-table[data-copy-cells]");
    const block = scss.slice(scss.indexOf(".hk-table[data-copy-cells]"));
    expect(block).toContain("@include user-select(none)");
    // The -webkit-/standard pair comes from styles/polyfill.scss (guarded
    // by its contract test) — a hand-written pair here would be drift.
    expect(block).not.toMatch(/(?:^|\n)\s*-webkit-user-select:/);
  });

  // The cursor half of the contract is pinned on the COMPILED sheet in
  // styles/selectionSheet.test.ts: raw-text matching here cannot tell a
  // live rule from a commented-out one, nor catch a selector list that
  // re-widens the rule.

  it("the manage cell is a control track, not a copy surface", () => {
    const block = scss.slice(scss.indexOf(".hk-table[data-copy-cells]"));
    expect(block).toContain(".hk-table-manage-cell");
    expect(block.indexOf("cursor: default")).toBeGreaterThan(-1);
  });
});

describe("HkTable click-cursor cascade", () => {
  let sheet: HTMLStyleElement;
  beforeEach(() => {
    sheet = document.createElement("style");
    sheet.textContent = SHEET_CSS;
    document.head.appendChild(sheet);
  });
  afterEach(() => {
    sheet.remove();
  });

  it("parses the injected sheet (a blind sheet would make this suite vacuous)", () => {
    const rules = sheet.sheet?.cssRules;
    expect(rules?.length ?? 0).toBeGreaterThan(0);
    // The sheet carries at least one media block; if the parser dropped it,
    // a media-wrapped widening rule would be invisible to the next test.
    expect([...(rules ?? [])].some((rule) => rule.constructor.name === "CSSMediaRule")).toBe(true);
  });

  it("reaches the marked cell only — computed cascade, not selector text", () => {
    const c = mount(
      h(
        HTable,
        {
          columns: [...COLS, { key: "secret", title: "Secret", copyable: false }],
          rows: [{ name: "alpha", endpoint: "https://x.example", secret: "nope-token" }],
          draggable: true,
          selectable: true,
          manageable: true,
        },
        { "cell-endpoint": () => "pure-text-slot" },
      ),
    );
    // drag grip, selection, name, endpoint (slot), secret (opted out), row actions
    const tds = Array.from(c.querySelectorAll<HTMLElement>("tbody td"));
    expect(tds).toHaveLength(6);
    const cursor = (index: number): string => getComputedStyle(tds[index]!).cursor;
    expect(cursor(2)).toBe("pointer");
    for (const index of [0, 1, 3, 4]) {
      expect(isAuto(cursor(index))).toBe(true);
    }
    expect(cursor(5)).toBe("default");
  });

  it("an opted-out table hands every cell the ordinary cursor back", () => {
    const c = mount(
      h(HTable, { columns: COLS, rows: [{ name: "alpha", endpoint: "x" }], copyCells: false }),
    );
    for (const td of Array.from(c.querySelectorAll<HTMLElement>("tbody td"))) {
      expect(isAuto(getComputedStyle(td).cursor)).toBe(true);
    }
  });
});
