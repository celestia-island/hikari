// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
/**
 * HkEditableTable — behavior, a11y and composition contract.
 *
 * Pinned guarantees:
 *  1. The grid is COMPOSED on HkTable: host columns render through it, a
 *     column with neither slot keeps HkTable's `row[key]` text default, and
 *     the source contains no table markup of its own.
 *  2. Slot contract: `cell-<key>` (display), `edit-<key>` (host editor, wins
 *     while enabled) and `row-error`; payloads carry `index` / `error` /
 *     `errorId` so a host editor can wire `aria-describedby`.
 *  3. `disabled` degrades every editor to its display slot — no separate
 *     read-only grid is needed.
 *  4. Controlled: no row mutation, no array mutation; `add` and
 *     `remove(row, index)` are intents the host applies.
 *  5. `canRemove` renders the trailing actions cell (and gates it per row);
 *     `canAdd` renders the localized add band.
 *  6. Per-row validation renders one line per invalid row inside the
 *     component (never page chrome), keyed by row identity, announced in a
 *     polite live region, and marked on the row.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, h } from "vue";

import HkEditableTable from "./HkEditableTable";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "HkEditableTable.tsx"), "utf-8");

const COLUMNS = [
  { key: "tier", title: "Tier" },
  { key: "price", title: "Unit price", align: "right" as const },
];

interface Row {
  id: string;
  tier: string;
  price: string;
  [key: string]: unknown;
}

const ROWS: Row[] = [
  { id: "a", tier: "Starter", price: "9.99" },
  { id: "b", tier: "Pro", price: "0" },
];

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) app.unmount();
  document.body.innerHTML = "";
});

function mount(
  props: Record<string, unknown> = {},
  slots: Record<string, (payload: any) => unknown> = {},
): { container: HTMLElement; emitted: Array<{ event: string; args: unknown[] }> } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const emitted: Array<{ event: string; args: unknown[] }> = [];
  const app = createApp({
    render: () =>
      h(
        HkEditableTable,
        {
          columns: COLUMNS,
          rows: ROWS,
          rowKey: "id",
          onAdd: (...args: unknown[]) => emitted.push({ event: "add", args }),
          onRemove: (...args: unknown[]) => emitted.push({ event: "remove", args }),
          ...props,
        },
        slots,
      ),
  });
  app.mount(container);
  mounts.push({ app, container });
  return { container, emitted };
}

function cellTexts(container: HTMLElement): string[][] {
  return [...container.querySelectorAll<HTMLTableRowElement>("tbody tr.hk-table-row")].map((row) =>
    [...row.querySelectorAll<HTMLElement>("td")].map((cell) => cell.textContent!.trim()),
  );
}

describe("HkEditableTable composition", () => {
  it("renders host columns through HkTable with the row[key] default", () => {
    const { container } = mount();
    expect(container.querySelector("table")).not.toBeNull();
    expect([...container.querySelectorAll("thead th")].map((th) => th.textContent!.trim())).toEqual([
      "Tier",
      "Unit price",
    ]);
    expect(cellTexts(container)).toEqual([
      ["Starter", "9.99"],
      ["Pro", "0"],
    ]);
  });

  it("forwards the caption (HkTable's sr-only <caption>)", () => {
    const { container } = mount({ caption: "Tier pricing" });
    expect(container.querySelector("caption")!.textContent).toBe("Tier pricing");
  });

  it("renders the localized empty text", () => {
    const { container } = mount({ rows: [] });
    expect(container.textContent).toContain("No rows yet");
  });

  it("owns no table markup of its own", () => {
    expect(source).toContain('from "./HkTable"');
    expect(source).not.toMatch(/<table|<thead|<tbody|<tr|<td/);
    expect(source).not.toContain("hk-table-cell");
  });
});

describe("HkEditableTable slot contract", () => {
  it("renders an edit slot in place of the display slot", () => {
    const seen: any[] = [];
    const { container } = mount({}, {
      "edit-price": (payload: any) => {
        seen.push(payload);
        return h("input", { class: "host-editor", value: String(payload.value) });
      },
      "cell-price": () => h("span", { class: "host-display" }, "display"),
    });
    expect(container.querySelectorAll(".host-editor")).toHaveLength(2);
    expect(container.querySelector(".host-display")).toBeNull();
    expect(seen[0].index).toBe(0);
    expect(seen[0].value).toBe("9.99");
    expect(seen[0].disabled).toBe(false);
    expect(seen[0].error).toBeNull();
    expect(seen[0].errorId).toBeNull();
  });

  it("uses the display slot for columns without an editor", () => {
    const { container } = mount({}, {
      "cell-tier": (payload: any) => h("strong", { class: "tier-display" }, payload.value),
    });
    expect(container.querySelectorAll(".tier-display")).toHaveLength(2);
    // The other column still falls back to HkTable's text rendering.
    expect(cellTexts(container)[0]).toEqual(["Starter", "9.99"]);
  });

  it("falls back to the display slot when disabled", () => {
    const { container } = mount({ disabled: true }, {
      "edit-price": () => h("input", { class: "host-editor" }),
      "cell-price": (payload: any) => h("span", { class: "host-display" }, payload.value),
    });
    expect(container.querySelector(".host-editor")).toBeNull();
    expect(container.querySelectorAll(".host-display")).toHaveLength(2);
    expect(container.querySelector(".hk-editable-table")!.getAttribute("data-disabled")).toBe("");
  });

  it("hands the row-error slot the invalid row", () => {
    const seen: any[] = [];
    const { container } = mount(
      { validate: (row: Row) => (row.id === "b" ? "Price must be above zero" : null) },
      {
        "row-error": (payload: any) => {
          seen.push(payload);
          return h("span", { class: "custom-error" }, `! ${payload.error}`);
        },
      },
    );
    expect(container.querySelectorAll(".custom-error")).toHaveLength(1);
    expect(seen[0].index).toBe(1);
    expect(seen[0].row.id).toBe("b");
    expect(container.textContent).toContain("! Price must be above zero");
  });
});

describe("HkEditableTable add / remove intents", () => {
  it("renders the add band and emits add", () => {
    const { container, emitted } = mount({ canAdd: true });
    const add = container.querySelector<HTMLButtonElement>(".hk-editable-table-add")!;
    expect(add.textContent).toContain("Add row");
    add.click();
    expect(emitted).toEqual([{ event: "add", args: [] }]);
  });

  it("localizes the add label and honors an override", () => {
    const { container } = mount({ canAdd: true, addLabel: "Add tier" });
    expect(container.querySelector(".hk-editable-table-add")!.textContent).toContain("Add tier");
  });

  it("renders no add affordance unless asked", () => {
    const { container } = mount();
    expect(container.querySelector(".hk-editable-table-add")).toBeNull();
  });

  it("renders the trailing remove column and emits the pressed row", () => {
    const { container, emitted } = mount({ canRemove: () => true });
    const headerCells = [...container.querySelectorAll("thead th")];
    expect(headerCells).toHaveLength(3);
    expect(headerCells[2].getAttribute("aria-label")).toBe("Row actions");

    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".hk-editable-table-actions button")];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].getAttribute("aria-label")).toBe("Remove row 1");

    buttons[1].click();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe("remove");
    expect((emitted[0].args as unknown[])[0]).toBe(ROWS[1]);
    expect((emitted[0].args as unknown[])[1]).toBe(1);
  });

  it("gates removal per row", () => {
    const { container } = mount({ canRemove: (row: Row) => row.id !== "b" });
    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".hk-editable-table-actions button")];
    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(true);
  });

  it("never mutates the host's rows or array", () => {
    const before = ROWS.map((row) => ({ ...row }));
    const { container } = mount({ canRemove: () => true, validate: () => "nope" });
    container.querySelectorAll<HTMLButtonElement>(".hk-editable-table-actions button")[0].click();
    expect(ROWS).toHaveLength(2);
    expect(ROWS).toEqual(before);
  });

  it("disables the affordances in read-only mode", () => {
    const { container, emitted } = mount({ canAdd: true, canRemove: () => true, disabled: true });
    const add = container.querySelector<HTMLButtonElement>(".hk-editable-table-add")!;
    expect(add.disabled).toBe(true);
    add.click();
    expect(emitted).toHaveLength(0);
    const remove = container.querySelector<HTMLButtonElement>(".hk-editable-table-actions button")!;
    expect(remove.disabled).toBe(true);
  });
});

describe("HkEditableTable per-row validation", () => {
  const validate = (row: Row) => (row.price === "0" ? "Price must be above zero" : null);

  it("renders one localized line per invalid row", () => {
    const { container } = mount({ validate });
    const lines = [...container.querySelectorAll<HTMLElement>(".hk-editable-table-error")];
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toBe("Row 2: Price must be above zero");
    expect(lines[0].getAttribute("data-row-index")).toBe("1");
    expect(container.querySelector(".hk-editable-table-errors")!.getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("wires the editor's aria-describedby to the rendered error line", () => {
    const { container } = mount({ validate }, {
      "edit-price": (payload: any) =>
        h("input", {
          class: "host-editor",
          "aria-invalid": payload.error ? "true" : undefined,
          "aria-describedby": payload.errorId ?? undefined,
        }),
    });
    const editors = [...container.querySelectorAll<HTMLInputElement>(".host-editor")];
    expect(editors[0].getAttribute("aria-describedby")).toBeNull();
    const describedBy = editors[1].getAttribute("aria-describedby")!;
    expect(describedBy).not.toBeNull();
    expect(container.querySelector(`#${describedBy}`)!.textContent).toBe(
      "Row 2: Price must be above zero",
    );
    expect(editors[1].getAttribute("aria-invalid")).toBe("true");
  });

  it("marks the row (via the actions cell marker) when an actions column exists", () => {
    const { container } = mount({ validate, canRemove: () => true });
    const actions = [...container.querySelectorAll<HTMLElement>(".hk-editable-table-actions")];
    expect(actions[0].getAttribute("data-row-invalid")).toBeNull();
    expect(actions[1].getAttribute("data-row-invalid")).toBe("");
  });

  it("re-runs validation against the live rows on every render", () => {
    const rows: Row[] = [{ id: "a", tier: "Starter", price: "0" }];
    const container = document.createElement("div");
    document.body.appendChild(container);
    // Typed through the component's loose prop signature (`Record<string,
    // unknown>` rows) — the fixture rows are narrower.
    const props = {
      columns: COLUMNS,
      rows,
      rowKey: "id",
      validate: (row: Record<string, unknown>) => validate(row as Row),
    };
    const app = createApp({ render: () => h(HkEditableTable, props) });
    app.mount(container);
    mounts.push({ app, container });
    expect(container.querySelectorAll(".hk-editable-table-error")).toHaveLength(1);
    // The host fixes the row in place (its v-model contract) and re-renders.
    rows[0].price = "9.99";
    app.unmount();
    mounts.pop();
    const app2 = createApp({ render: () => h(HkEditableTable, { ...props, rows: [...rows] }) });
    app2.mount(container);
    mounts.push({ app: app2, container });
    expect(container.querySelectorAll(".hk-editable-table-error")).toHaveLength(0);
  });

  it("renders no error band for a clean grid", () => {
    const { container } = mount({ validate: () => null });
    expect(container.querySelector(".hk-editable-table-errors")).toBeNull();
    expect(container.querySelector("[data-row-invalid]")).toBeNull();
  });
});

describe("HkEditableTable source contract", () => {
  it("documents the slot contract in the header comment", () => {
    for (const slot of ["cell-<key>", "edit-<key>", "row-error"]) {
      expect(source).toContain(slot);
    }
    expect(source).toContain("never mutates");
  });

  it("keeps the actions affordance inside the component", () => {
    expect(source).toContain("hk-editable-table-add");
    expect(source).not.toMatch(/page-chrome|createAction/i);
  });
});
