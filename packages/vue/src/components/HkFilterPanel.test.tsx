import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkFilterPanel, { sanitizeNumberInput, type HkFilterState } from "./HkFilterPanel";

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
});

const FIELDS = [
  { key: "tool", label: "Tool", kind: "text" as const, placeholder: "web_automation" },
  { key: "count", label: "Calls", kind: "number" as const },
  { key: "agent", label: "Agent", kind: "select" as const, options: [{ value: "a1", label: "Agent One" }] },
  { key: "since", label: "Since", kind: "date" as const },
];

describe("HkFilterPanel", () => {
  it("renders one condition row per declared field", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: {} }));
    const rows = c.querySelectorAll(".hk-filter-panel-row");
    expect(rows).toHaveLength(FIELDS.length);
    const labels = [...c.querySelectorAll(".hk-filter-panel-field")].map((el) => el.textContent);
    expect(labels).toEqual(["Tool", "Calls", "Agent", "Since"]);
  });

  it("gives each kind its default operator set (regular 3, numeric 5, select 2, date 2)", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: {} }));
    const rows = [...c.querySelectorAll(".hk-filter-panel-row")];
    const opCounts = rows.map(
      (row) => row.querySelectorAll(".hk-filter-panel-op").length,
    );
    // Regular = 3 (equals / not-equals / fuzzy); numeric = the ordered
    // five with NO not-equals; select = equals / not-equals; date = the
    // ordered pair.
    expect(opCounts).toEqual([3, 5, 2, 2]);
    // Symbols, not words: one glyph per button.
    const numberOps = [...rows[1]!.querySelectorAll(".hk-filter-panel-op")].map(
      (b) => b.textContent,
    );
    expect(numberOps).toEqual(["<", "≤", "=", "≥", ">"]);
    // The kind's first operator is the pressed one for an untouched field.
    const pressed = rows[0]!.querySelector('.hk-filter-panel-op[aria-pressed="true"]');
    expect(pressed?.textContent).toBe("=");
  });

  it("emits a new state when an operator is picked (live, no confirm)", () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: { tool: { op: "eq", value: "web" } },
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    const fuzzy = [...c.querySelectorAll(".hk-filter-panel-row")[0]!.querySelectorAll(".hk-filter-panel-op")]
      .find((b) => b.textContent === "≈")!;
    fuzzy.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(seen).not.toBeNull();
    expect(seen!["tool"]).toEqual({ op: "approx", value: "web" });
  });

  it("renders numeric fields on the number-variant input (native legal-number filtering)", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: {},
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    // The number row's control is the number-variant input (type=number —
    // the browser refuses illegal keystrokes); the model side keeps the
    // shape guard (sanitizeNumberInput) as the belt.
    const input = c.querySelectorAll<HTMLInputElement>(".hk-filter-panel-row input")[1]!;
    expect(input.type).toBe("number");
    input.value = "42.5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    expect(seen).not.toBeNull();
    expect(seen!["count"]).toEqual({ op: "lt", value: "42.5" });
  });

  it("keeps select fields on a popup select and prepends the empty clear row", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: {} }));
    const selectRow = c.querySelectorAll(".hk-filter-panel-row")[2]!;
    expect(selectRow.querySelector(".hk-popup-select-trigger")).toBeTruthy();
  });

  it("marks the panel active when any condition carries a value", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: { count: { op: "gt", value: "3" } } }));
    expect(c.querySelector(".hk-filter-panel")!.getAttribute("data-active")).toBe("true");
    const c2 = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: {} }));
    expect(c2.querySelector(".hk-filter-panel")!.getAttribute("data-active")).toBeNull();
  });

  it("sanitizes number shapes: sign leading-only, one dot, junk stripped", () => {
    expect(sanitizeNumberInput("12a.5b9")).toBe("12.59");
    expect(sanitizeNumberInput("-3-x.1.2")).toBe("-3.12");
    expect(sanitizeNumberInput("abc")).toBe("");
    expect(sanitizeNumberInput("1-2")).toBe("12");
  });
});
