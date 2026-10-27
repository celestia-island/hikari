import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkFilterTrigger from "./HkFilterTrigger";
import type { HkFilterState } from "./HkFilterPanel";

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
  document.body.querySelectorAll(".hk-popover-scrim, .hk-popover-panel").forEach((el) => el.remove());
});

const FIELDS = [
  { key: "tool", label: "Tool", kind: "text" as const },
  { key: "count", label: "Calls", kind: "number" as const },
];

const triggerButton = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!;

describe("HkFilterTrigger", () => {
  it("renders the filter affordance on the chrome action ladder (ghost class, ladder step)", () => {
    const c = mount(h(HkFilterTrigger, { fields: FIELDS, modelValue: [] }));
    const btn = triggerButton(c);
    expect(btn).toBeTruthy();
    // The ladder rung is viewport-driven (useChromeActionSize): the test
    // environment's width lands on one of the two rungs — the contract
    // is "the ladder's class", never a hard-coded step.
    expect(
      btn.className.includes("hk-icon-button-28") || btn.className.includes("hk-icon-button-32"),
    ).toBe(true);
    expect(btn.className).toContain("hk-icon-button-ghost");
    expect(btn.getAttribute("aria-haspopup")).toBe("dialog");
    // No active dot on an untouched state.
    expect(c.querySelector(".hk-corner-badge--dot")).toBeNull();
  });

  it("opens the panel in a popover below the button and edits emit live", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterTrigger, {
        fields: FIELDS,
        // Seed one condition so the panel opens with its row (an empty
        // state renders only the add row — conditions are added, not
        // all rendered at once).
        modelValue: [{ key: "tool", op: "approx", value: "" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    expect(document.body.querySelector(".hk-filter-panel")).toBeNull();
    triggerButton(c).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    // HkPopover teleports the surface to the body.
    const panel = document.body.querySelector(".hk-filter-panel");
    expect(panel, "panel mounted after the trigger click").toBeTruthy();
    // Desktop: NO confirm footer (edits are live; dismissal is click-out).
    expect(document.body.querySelector(".hk-filter-trigger-footer")).toBeNull();
    // An edit inside the panel reaches the model live.
    const input = panel!.querySelector<HTMLInputElement>(".hk-filter-panel-row input")!;
    input.value = "web";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    expect(seen).not.toBeNull();
    expect((seen! as Array<{ key: string; value: string }>)[0]).toMatchObject({ key: "tool", value: "web" });
  });

  it("shows the active dot only while a condition carries a value", () => {
    const c = mount(
      h(HkFilterTrigger, { fields: FIELDS, modelValue: [{ key: "count", op: "gte", value: "3" }] }),
    );
    expect(c.querySelector(".hk-corner-badge--dot")).toBeTruthy();
    const empty = mount(h(HkFilterTrigger, { fields: FIELDS, modelValue: [] }));
    expect(empty.querySelector(".hk-corner-badge--dot")).toBeNull();
  });

  // ── Nested-popout regression (2026-10-14) ──────────────────────────
  // A popout opened from INSIDE the panel teleports to <body>, so the
  // panel popover's outside-click shield cannot see the nesting by DOM
  // containment — until the shield learned data-hk-popout-layer, picking
  // from the add-condition chooser (or a select row's popup) slammed the
  // whole panel shut and swallowed the pick. Both paths pinned here.

  it("keeps the panel open when a field is picked from the add-condition chooser", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterTrigger, {
        fields: FIELDS,
        modelValue: [],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    document.body
      .querySelector<HTMLButtonElement>(".hk-filter-panel .hk-filter-panel-add")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const item = document.body.querySelector<HTMLElement>(".hk-filter-add-item")!;
    expect(item, "chooser mounted").toBeTruthy();
    item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 60));
    // The pick landed…
    expect(seen).not.toBeNull();
    expect((seen! as Array<{ key: string }>)[0]?.key).toBe("tool");
    // …and the PANEL is still open — the chooser's click is not a
    // backdrop dismissal for it.
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
  });

  it("keeps the panel open when an option is picked from a select condition row", async () => {
    const selectFields = [
      { key: "tool", label: "Tool", kind: "text" as const },
      { key: "agent", label: "Agent", kind: "select" as const, options: [{ value: "a1", label: "Agent One" }] },
    ];
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterTrigger, {
        fields: selectFields,
        modelValue: [{ key: "agent", op: "eq", value: "" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    document.body
      .querySelector<HTMLButtonElement>(".hk-filter-panel .hk-popup-select-trigger")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    // The popout's FIRST item is the prepended "All" clear row — pick
    // the real option by its label.
    const option = [...document.body.querySelectorAll<HTMLElement>(".hk-popup-select-item")].find(
      (el) => el.textContent?.trim() === "Agent One",
    )!;
    expect(option, "select popout mounted").toBeTruthy();
    option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 60));
    // The option landed on the condition…
    expect((seen! as Array<{ key: string; value: string }>)[0]).toMatchObject({ key: "agent", value: "a1" });
    // …and the panel survived the nested pick.
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
    document.body.querySelectorAll(".hk-popup-select-item, .hk-popover-panel").forEach((el) => el.remove());
  });

  // ── Escape closes ONE layer (2026-10-14) ──────────────────────────
  // An open nested popout absorbs the Escape itself (stopPropagation
  // before the host popover's panel keydown); a closed one lets it
  // bubble so the host panel closes. Both nested popout kinds pinned —
  // HkPopupSelect used to close BOTH layers on one Escape.

  it("Escape with the chooser open closes the chooser but keeps the panel", async () => {
    const c = mount(h(HkFilterTrigger, { fields: FIELDS, modelValue: [] }));
    c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    const add = document.body.querySelector<HTMLButtonElement>(
      ".hk-filter-panel .hk-filter-panel-add",
    )!;
    add.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.body.querySelector(".hk-filter-add-item")).toBeTruthy();
    add.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    // The chooser left…
    expect(document.body.querySelector(".hk-filter-add-item")).toBeNull();
    // …the panel stayed.
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
    // A second Escape (nothing nested open) bubbles on to close the panel.
    add.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    expect(document.body.querySelector(".hk-filter-panel")).toBeNull();
  });

  it("Escape with a select popout open closes the popout but keeps the panel", async () => {
    const selectFields = [
      { key: "tool", label: "Tool", kind: "text" as const },
      { key: "agent", label: "Agent", kind: "select" as const, options: [{ value: "a1", label: "Agent One" }] },
    ];
    const c = mount(
      h(HkFilterTrigger, { fields: selectFields, modelValue: [{ key: "agent", op: "eq", value: "" }] }),
    );
    c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    const selectTrigger = document.body.querySelector<HTMLButtonElement>(
      ".hk-filter-panel .hk-popup-select-trigger",
    )!;
    selectTrigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.body.querySelector(".hk-popup-select-item")).toBeTruthy();
    selectTrigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 60));
    // The popout left…
    expect(document.body.querySelector(".hk-popup-select-item")).toBeNull();
    // …the panel stayed.
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
    document.body.querySelectorAll(".hk-popover-panel").forEach((el) => el.remove());
  });

  // ── One popout at a time (R2 2026-10-14 finding) ──────────────────
  // The chooser and a select popout are SIBLINGS riding the same host
  // panel. The shield must not treat the shared HOST layer as "above":
  // opening one closes the other, in both directions — never both at
  // once, and an open chooser must not swallow in-panel clicks.

  it("opening a select popout closes an open chooser (never both at once)", async () => {
    const selectFields = [
      { key: "tool", label: "Tool", kind: "text" as const },
      { key: "agent", label: "Agent", kind: "select" as const, options: [{ value: "a1", label: "Agent One" }] },
    ];
    const c = mount(
      h(HkFilterTrigger, { fields: selectFields, modelValue: [{ key: "agent", op: "eq", value: "" }] }),
    );
    c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    document.body
      .querySelector<HTMLButtonElement>(".hk-filter-panel .hk-filter-panel-add")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.body.querySelector(".hk-filter-add-item")).toBeTruthy();
    // Now open a select row's popout from inside the host panel…
    document.body
      .querySelector<HTMLButtonElement>(".hk-filter-panel .hk-popup-select-trigger")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 60));
    // …the chooser left…
    expect(document.body.querySelector(".hk-filter-add-item")).toBeNull();
    // …the select popout is the one live surface…
    expect(document.body.querySelector(".hk-popup-select-item")).toBeTruthy();
    // …and the panel stayed open through the swap.
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
    document.body.querySelectorAll(".hk-popover-panel").forEach((el) => el.remove());
  });

  it("opening the chooser closes an open select popout (the reverse swap)", async () => {
    const selectFields = [
      { key: "tool", label: "Tool", kind: "text" as const },
      { key: "agent", label: "Agent", kind: "select" as const, options: [{ value: "a1", label: "Agent One" }] },
    ];
    const c = mount(
      h(HkFilterTrigger, { fields: selectFields, modelValue: [{ key: "agent", op: "eq", value: "" }] }),
    );
    c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    document.body
      .querySelector<HTMLButtonElement>(".hk-filter-panel .hk-popup-select-trigger")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.body.querySelector(".hk-popup-select-item")).toBeTruthy();
    // Now click the add verb from inside the host panel…
    document.body
      .querySelector<HTMLButtonElement>(".hk-filter-panel .hk-filter-panel-add")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 60));
    // …the select popout left…
    expect(document.body.querySelector(".hk-popup-select-item")).toBeNull();
    // …the chooser is the one live surface…
    expect(document.body.querySelector(".hk-filter-add-item")).toBeTruthy();
    // …and the panel stayed open through the swap.
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
    document.body.querySelectorAll(".hk-popover-panel").forEach((el) => el.remove());
  });

  it("an in-panel click while the chooser is open dismisses the chooser", async () => {
    let seen: HkFilterState | null = null;
    const c = mount(
      h(HkFilterTrigger, {
        fields: FIELDS,
        modelValue: [{ key: "tool", op: "approx", value: "" }],
        "onUpdate:modelValue": (s: HkFilterState) => (seen = s),
      }),
    );
    c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await Promise.resolve();
    await Promise.resolve();
    document.body
      .querySelector<HTMLButtonElement>(".hk-filter-panel .hk-filter-panel-add")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.body.querySelector(".hk-filter-add-item")).toBeTruthy();
    // A row's operator toggle is an in-panel click — the chooser must
    // stand down for it, not swallow it. (Pick the ≈ toggle; the first
    // op button is the already-pressed =.)
    const op = [...document.body.querySelectorAll<HTMLButtonElement>(".hk-filter-panel .hk-filter-panel-op")].find(
      (b) => b.getAttribute("title") === "fuzzy match",
    )!;
    op.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 60));
    expect(document.body.querySelector(".hk-filter-add-item")).toBeNull();
    expect((seen! as Array<{ key: string; op: string }>)[0]).toMatchObject({ key: "tool", op: "approx" });
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
    document.body.querySelectorAll(".hk-popover-panel").forEach((el) => el.remove());
  });
});
