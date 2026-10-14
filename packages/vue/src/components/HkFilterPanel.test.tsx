import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkFilterPanel, {
  hkFieldMatches,
  sanitizeNumberInput,
  type HkFilterState,
} from "./HkFilterPanel";

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
  // The field chooser (and any popout it opened) teleports to <body>
  // (HkPopover) — sweep the leftovers so the next test starts clean.
  document.body
    .querySelectorAll(".hk-filter-add-item, .hk-popover-panel, .hk-select-popout-host")
    .forEach((el) => el.remove());
});

const FIELDS = [
  { key: "tool", label: "Tool", kind: "text" as const, placeholder: "web_automation" },
  { key: "count", label: "Calls", kind: "number" as const },
  { key: "agent", label: "Agent", kind: "select" as const, options: [{ value: "a1", label: "Agent One" }] },
  { key: "since", label: "Since", kind: "date" as const },
];

describe("HkFilterPanel (array state, 2026-10-15)", () => {
  it("renders one row per condition, in order — empty state is just the add verb", () => {
    const c = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: [] }));
    // The default list is ALWAYS empty (user direction 2026-10-15): no
    // rows, no placeholder text — only the add button.
    expect(c.querySelectorAll(".hk-filter-panel-row")).toHaveLength(0);
    expect(c.querySelector(".hk-filter-panel-add")).toBeTruthy();
    expect(c.querySelectorAll(".hk-filter-panel-field")).toHaveLength(0);

    const state: HkFilterState = [
      { key: "tool", op: "approx", value: "web" },
      { key: "count", op: "lt", value: "3" },
    ];
    const c2 = mount(h(HkFilterPanel, { fields: FIELDS, modelValue: state }));
    const labels = [...c2.querySelectorAll(".hk-filter-panel-field")].map((el) => el.textContent);
    expect(labels).toEqual(["Tool", "Calls"]);
  });

  it("the chooser offers EVERY declared field — the same field may join repeatedly", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [{ key: "tool", op: "approx", value: "web" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    c.querySelector(".hk-filter-panel-add")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    // The already-added Tool is still offered (multi-condition per
    // column, user direction 2026-10-15) — all four fields listed.
    const items = [...document.body.querySelectorAll(".hk-filter-add-item")].map(
      (el) => el.textContent,
    );
    expect(items).toEqual(["Tool", "Calls", "Agent", "Since"]);
    // Picking Tool AGAIN appends a second Tool condition.
    [...document.body.querySelectorAll<HTMLElement>(".hk-filter-add-item")]
      .find((el) => el.textContent === "Tool")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(seen).toEqual([
      { key: "tool", op: "approx", value: "web" },
      { key: "tool", op: "approx", value: "" },
    ]);
  });

  it("materializes the picked field with its kind's default operator and closes the chooser", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [{ key: "tool", op: "approx", value: "web" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    c.querySelector(".hk-filter-panel-add")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const item = [...document.body.querySelectorAll(".hk-filter-add-item")].find(
      (el) => el.textContent === "Agent",
    )!;
    expect(item, "chooser lists the Agent field").toBeTruthy();
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(seen).toEqual([
      { key: "tool", op: "approx", value: "web" },
      { key: "agent", op: "eq", value: "" },
    ]);
    await new Promise((r) => setTimeout(r, 60));
    expect(document.body.querySelector(".hk-filter-add-item")).toBeNull();
  });

  it("does not append a duplicate EMPTY condition for the same field+operator", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [{ key: "tool", op: "approx", value: "" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    c.querySelector(".hk-filter-panel-add")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    [...document.body.querySelectorAll<HTMLElement>(".hk-filter-add-item")]
      .find((el) => el.textContent === "Tool")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    // An identical empty row already sits there — no second one.
    expect(seen).toBeNull();
  });

  it("still appends when the existing empty row of that field carries a different operator", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [{ key: "tool", op: "napprox", value: "" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    c.querySelector(".hk-filter-panel-add")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    [...document.body.querySelectorAll<HTMLElement>(".hk-filter-add-item")]
      .find((el) => el.textContent === "Tool")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    // The sitting row is ≉ (toggled away from the default) — the fresh
    // ≈ row is NOT its duplicate and must land.
    expect(seen).toEqual([
      { key: "tool", op: "napprox", value: "" },
      { key: "tool", op: "approx", value: "" },
    ]);
  });

  it("renders an undeclared key as an inert, removable row", () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [
          { key: "tool", op: "approx", value: "web" },
          { key: "tool", op: "approx", value: "shell" },
        ],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    const rows = [...c.querySelectorAll(".hk-filter-panel-row")];
    expect(rows).toHaveLength(2);
    rows[0]!.querySelector(".hk-filter-panel-remove")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(seen).toEqual([{ key: "tool", op: "approx", value: "shell" }]);
  });

  it("gives text fields the fuzzy pair ≈/≉ and the other kinds their ordered sets", () => {
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [
          { key: "tool", op: "approx", value: "" },
          { key: "count", op: "lt", value: "" },
          { key: "agent", op: "eq", value: "" },
          { key: "since", op: "gte", value: "" },
        ],
      }),
    );
    const rows = [...c.querySelectorAll(".hk-filter-panel-row")];
    const opsOf = (row: Element) =>
      [...row.querySelectorAll(".hk-filter-panel-op")].map((b) => b.textContent);
    // Text speaks ONLY the fuzzy pair (2026-10-15: 等于其实是模糊匹配 —
    // label it ≈, and the exclusion ≉).
    expect(opsOf(rows[0]!)).toEqual(["≈", "≉"]);
    expect(opsOf(rows[1]!)).toEqual(["<", "≤", "=", "≥", ">"]);
    expect(opsOf(rows[2]!)).toEqual(["=", "≠"]);
    expect(opsOf(rows[3]!)).toEqual(["≥", "≤"]);
  });

  it("emits a new state when an operator is picked (live, no confirm)", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [{ key: "tool", op: "approx", value: "web" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    const notMatch = [...c.querySelectorAll(".hk-filter-panel-row")[0]!.querySelectorAll(".hk-filter-panel-op")]
      .find((b) => b.textContent === "≉")!;
    notMatch.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    expect(seen).toEqual([{ key: "tool", op: "napprox", value: "web" }]);
  });

  it("edits target the row's own condition only", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [
          { key: "count", op: "lt", value: "" },
          { key: "count", op: "lt", value: "9" },
        ],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    const input = c.querySelectorAll<HTMLInputElement>(".hk-filter-panel-row input")[0]!;
    input.value = "42.5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    expect(seen).toEqual([
      { key: "count", op: "lt", value: "42.5" },
      { key: "count", op: "lt", value: "9" },
    ]);
  });

  it("drives the chooser from the add button — arrows highlight, Enter picks", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    const add = c.querySelector<HTMLButtonElement>(".hk-filter-panel-add")!;
    add.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const items = [...document.body.querySelectorAll(".hk-filter-add-item")];
    expect(items).toHaveLength(4);
    expect(items[0]!.getAttribute("data-highlighted")).toBe("true");
    add.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await Promise.resolve();
    expect(items[1]!.getAttribute("data-highlighted")).toBe("true");
    add.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await Promise.resolve();
    expect(seen).toEqual([{ key: "count", op: "lt", value: "" }]);
  });

  it("marks the panel active only while a condition carries a value", () => {
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [{ key: "count", op: "gt", value: "3" }],
      }),
    );
    expect(c.querySelector(".hk-filter-panel")!.getAttribute("data-active")).toBe("true");
    const c2 = mount(
      h(HkFilterPanel, { fields: FIELDS, modelValue: [{ key: "count", op: "gt", value: "" }] }),
    );
    expect(c2.querySelector(".hk-filter-panel")!.getAttribute("data-active")).toBeNull();
  });

  it("renders an undeclared key as an inert, removable row", () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterPanel, {
        fields: FIELDS,
        modelValue: [{ key: "ghost", op: "approx", value: "x" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    const row = c.querySelector(".hk-filter-panel-row")!;
    expect(row.querySelector(".hk-filter-panel-field")!.textContent).toBe("ghost");
    // The ghost row cannot be edited: its operator toggles are disabled…
    expect(row.querySelector<HTMLButtonElement>(".hk-filter-panel-op")!.disabled).toBe(true);
    // …but it CAN be dropped.
    row.querySelector(".hk-filter-panel-remove")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(seen).toEqual([]);
  });

  it("sanitizes number shapes: sign leading-only, one dot, junk stripped", () => {
    expect(sanitizeNumberInput("12a.5b9")).toBe("12.59");
    expect(sanitizeNumberInput("-3-x.1.2")).toBe("-3.12");
    expect(sanitizeNumberInput("abc")).toBe("");
    expect(sanitizeNumberInput("1-2")).toBe("12");
  });
});

describe("hkFieldMatches — the canonical combination semantics (2026-10-15)", () => {
  it("OR-combines the fuzzy matches on one field — the user's banana/apple case", () => {
    // ≈香蕉 OR ≈苹果: 香蕉牛奶、苹果牛奶、苹果醋 all match; a row with
    // NEITHER is filtered out; the second condition is never shadowed.
    const conds = [
      { key: "tool", op: "approx" as const, value: "香蕉" },
      { key: "tool", op: "approx" as const, value: "苹果" },
    ];
    expect(hkFieldMatches("text", conds, "香蕉牛奶")).toBe(true);
    expect(hkFieldMatches("text", conds, "苹果牛奶")).toBe(true);
    expect(hkFieldMatches("text", conds, "苹果醋")).toBe(true);
    expect(hkFieldMatches("text", conds, "草莓酸奶")).toBe(false);
  });

  it("AND-combines the ordered comparisons — a numeric band", () => {
    const band = [
      { key: "count", op: "gte" as const, value: "10" },
      { key: "count", op: "lte" as const, value: "50" },
    ];
    expect(hkFieldMatches("number", band, 25)).toBe(true);
    expect(hkFieldMatches("number", band, 10)).toBe(true);
    expect(hkFieldMatches("number", band, 50)).toBe(true);
    expect(hkFieldMatches("number", band, 9)).toBe(false);
    expect(hkFieldMatches("number", band, 51)).toBe(false);
    expect(hkFieldMatches("number", band, "not-a-number")).toBe(false);
  });

  it("every exclusion must hold — ≉/≠ rows may match NONE of them", () => {
    const conds = [
      { key: "tool", op: "napprox" as const, value: "香蕉" },
      { key: "tool", op: "napprox" as const, value: "苹果" },
    ];
    expect(hkFieldMatches("text", conds, "草莓酸奶")).toBe(true);
    expect(hkFieldMatches("text", conds, "香蕉牛奶")).toBe(false);
    expect(hkFieldMatches("text", conds, "苹果醋")).toBe(false);
  });

  it("mixes the classes: satisfy the OR group AND every exclusion/band", () => {
    const conds = [
      { key: "tool", op: "approx" as const, value: "奶" },
      { key: "tool", op: "napprox" as const, value: "草莓" },
    ];
    expect(hkFieldMatches("text", conds, "香蕉牛奶")).toBe(true);
    expect(hkFieldMatches("text", conds, "草莓酸奶")).toBe(false); // fails the OR group too
    expect(hkFieldMatches("text", conds, "草莓牛奶")).toBe(false); // hits the OR group, fails the exclusion
  });

  it("select equals OR-combines; select not-equals AND-combines", () => {
    const either = [
      { key: "agent", op: "eq" as const, value: "a1" },
      { key: "agent", op: "eq" as const, value: "a2" },
    ];
    expect(hkFieldMatches("select", either, "a1")).toBe(true);
    expect(hkFieldMatches("select", either, "a2")).toBe(true);
    expect(hkFieldMatches("select", either, "a3")).toBe(false);
    const neither = [
      { key: "agent", op: "ne" as const, value: "a1" },
      { key: "agent", op: "ne" as const, value: "a2" },
    ];
    expect(hkFieldMatches("select", neither, "a3")).toBe(true);
    expect(hkFieldMatches("select", neither, "a1")).toBe(false);
  });

  it("empty-valued conditions filter nothing; an empty list matches everything", () => {
    expect(hkFieldMatches("text", [{ key: "x", op: "approx" as const, value: "" }], "anything")).toBe(true);
    expect(hkFieldMatches("text", [], "anything")).toBe(true);
  });

  it("compares the fuzzy pair case-insensitively", () => {
    expect(hkFieldMatches("text", [{ key: "x", op: "approx" as const, value: "WEB" }], "my-web-tool")).toBe(true);
  });
});
