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

/** State seeding all four fields — every declared row visible. */
const ALL_SEEDED: HkFilterState = {
  tool: { op: "eq", value: "" },
  count: { op: "lt", value: "" },
  agent: { op: "eq", value: "" },
  since: { op: "gte", value: "" },
};

describe("HkFilterPanel", () => {
  it("renders rows ONLY for fields present in the state — the rest stay latent", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: {} }));
    // Empty state: no condition rows at all, just the add row.
    expect(c.querySelectorAll(".hk-filter-panel-row")).toHaveLength(0);
    expect(c.querySelector(".hk-filter-panel-add")).toBeTruthy();
    // Seeded subset: rows in declaration order, only for seeded keys.
    const c2 = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: { agent: { op: "eq", value: "" }, tool: { op: "eq", value: "" } },
      }),
    );
    const labels = [...c2.querySelectorAll(".hk-filter-panel-field")].map((el) => el.textContent);
    expect(labels).toEqual(["Tool", "Agent"]);
  });

  it("hides the add row once every declared field is in the state", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: ALL_SEEDED }));
    expect(c.querySelector(".hk-filter-panel-add")).toBeNull();
    expect(c.querySelectorAll(".hk-filter-panel-row")).toHaveLength(FIELDS.length);
  });

  it("adds the next latent field with its kind's default operator and an empty value", () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: { tool: { op: "eq", value: "web" } },
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    c.querySelector(".hk-filter-panel-add")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(seen).not.toBeNull();
    // "count" is the next unused field in declaration order; its kind's
    // first operator (lt) and an empty value.
    expect(seen!["count"]).toEqual({ op: "lt", value: "" });
  });

  it("removes a condition entirely — the key leaves the state", () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: { tool: { op: "eq", value: "web" }, count: { op: "lt", value: "3" } },
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    const rows = [...c.querySelectorAll(".hk-filter-panel-row")];
    expect(rows).toHaveLength(2);
    rows[0]!.querySelector(".hk-filter-panel-remove")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(seen).not.toBeNull();
    expect(seen!["tool"]).toBeUndefined();
    expect(seen!["count"]).toEqual({ op: "lt", value: "3" });
  });

  it("gives each kind its default operator set (regular 3, numeric 5, select 2, date 2)", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: ALL_SEEDED }));
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
        modelValue: { count: { op: "lt", value: "" } },
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    // The number row's control is the number-variant input (type=number —
    // the browser refuses illegal keystrokes); the model side keeps the
    // shape guard (sanitizeNumberInput) as the belt.
    const input = c.querySelectorAll<HTMLInputElement>(".hk-filter-panel-row input")[0]!;
    expect(input.type).toBe("number");
    input.value = "42.5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    expect(seen).not.toBeNull();
    expect(seen!["count"]).toEqual({ op: "lt", value: "42.5" });
  });

  it("keeps select fields on a popup select and prepends the empty clear row", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: { agent: { op: "eq", value: "" } } }));
    const selectRow = c.querySelectorAll(".hk-filter-panel-row")[0]!;
    expect(selectRow.querySelector(".hk-popup-select-trigger")).toBeTruthy();
  });

  it("prepends a localized empty All row to select fields without one (the clear affordance)", async () => {
    // The select field's ONLY clear affordance is the empty value row —
    // removal drops the whole condition, but an EMPTY value still means
    // "filters nothing" on the wire. A page without its own "all" entry
    // must therefore always find the prepended {value:"", label:All} row;
    // a page that ships one keeps its own label. (R1 mutation f2 removed
    // the prepend and NOTHING went red — this test is that missing pin.)
    const withOwnEmpty = [
      { key: "level", label: "Level", kind: "select" as const, options: [{ value: "", label: "Everything" }, { value: "high", label: "High" }] },
    ];
    const seeded = { level: { op: "eq" as const, value: "" } };
    const c = mount(h(HkFilterPanel, { fields: withOwnEmpty, modelValue: seeded }));
    // A page shipping its own empty row keeps it as-is (no duplicate):
    // the panel prepends only when NO option carries the empty value.
    const ownTrigger = c.querySelector(".hk-filter-panel-row .hk-popup-select-trigger");
    expect(ownTrigger).toBeTruthy();
    // Drive the popup open to count rows: the real HkPopupSelect renders
    // exactly the options it was given.
    ownTrigger!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    const items = [...document.body.querySelectorAll(".hk-popup-select-item")].map((el) => el.textContent?.trim());
    expect(items).toEqual(["Everything", "High"]);
    document.body.querySelectorAll(".hk-popup-select-item, .hk-select-popout-host").forEach((el) => el.remove());

    const withoutAll = [
      { key: "level", label: "Level", kind: "select" as const, options: [{ value: "high", label: "High" }] },
    ];
    const c2 = mount(h(HkFilterPanel, { fields: withoutAll, modelValue: { level: { op: "eq", value: "" } } }));
    const trigger2 = c2.querySelector(".hk-filter-panel-row .hk-popup-select-trigger")!;
    trigger2.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    const items2 = [...document.body.querySelectorAll(".hk-popup-select-item")].map((el) => el.textContent?.trim());
    expect(items2[0], "the localized All row is prepended").toBe("All");
    expect(items2).toEqual(["All", "High"]);
    document.body.querySelectorAll(".hk-popup-select-item, .hk-select-popout-host").forEach((el) => el.remove());
  });

  it("marks the panel active when any condition carries a value", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: { count: { op: "gt", value: "3" } } }));
    expect(c.querySelector(".hk-filter-panel")!.getAttribute("data-active")).toBe("true");
    const c2 = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: {} }));
    expect(c2.querySelector(".hk-filter-panel")!.getAttribute("data-active")).toBeNull();
  });

  it("suppresses the control captions (the row label is the one label) but keeps them semantic", () => {
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: { agent: { op: "eq", value: "" }, tool: { op: "eq", value: "" } },
      }),
    );
    // No floating caption above either control.
    expect(c.querySelector(".hk-popup-select-label")).toBeNull();
    expect(c.querySelector(".hk-input-label")).toBeNull();
    // …but the field element still carries the name for AT and the
    // mobile select sheet's breadcrumb title.
    const selectTrigger = c.querySelector(".hk-popup-select-trigger")!;
    expect(selectTrigger.getAttribute("aria-label")).toBe("Agent");
    const input = c.querySelector(".hk-input-element")!;
    expect(input.getAttribute("aria-label")).toBe("Tool");
  });

  it("rides the compact control stock (sm variants) in the dense rows", () => {
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: ALL_SEEDED,
      }),
    );
    expect(c.querySelector(".hk-popup-select-trigger-sm")).toBeTruthy();
    expect(c.querySelector(".hk-input-box-sm")).toBeTruthy();
    expect(c.querySelector(".hk-dp-trigger-sm")).toBeTruthy();
  });

  it("sanitizes number shapes: sign leading-only, one dot, junk stripped", () => {
    expect(sanitizeNumberInput("12a.5b9")).toBe("12.59");
    expect(sanitizeNumberInput("-3-x.1.2")).toBe("-3.12");
    expect(sanitizeNumberInput("abc")).toBe("");
    expect(sanitizeNumberInput("1-2")).toBe("12");
  });
});
