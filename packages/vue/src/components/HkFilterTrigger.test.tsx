import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkFilterTrigger from "./HkFilterTrigger";

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
  it("renders the filter affordance as a ghost/28 icon button (the theme toggle's step)", () => {
    const c = mount(h(HkFilterTrigger, { fields: FIELDS, modelValue: {} }));
    const btn = triggerButton(c);
    expect(btn).toBeTruthy();
    expect(btn.className).toContain("hk-icon-button-28");
    expect(btn.className).toContain("hk-icon-button-ghost");
    expect(btn.getAttribute("aria-haspopup")).toBe("dialog");
    // No active dot on an untouched state.
    expect(c.querySelector(".hk-filter-trigger-dot")).toBeNull();
  });

  it("opens the panel in a popover below the button and edits emit live", async () => {
    let seen: Record<string, unknown> | null = null;
    const c = mount(
      h(HkFilterTrigger, {
        fields: FIELDS,
        // Seed one condition so the panel opens with its row (an empty
        // state renders only the add row — conditions are added, not
        // all rendered at once).
        modelValue: { tool: { op: "eq", value: "" } },
        "onUpdate:modelValue": (s: Record<string, unknown>) => (seen = s),
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
    expect((seen! as { tool: { value: string } }).tool.value).toBe("web");
  });

  it("shows the active dot only while a condition carries a value", () => {
    const c = mount(
      h(HkFilterTrigger, { fields: FIELDS, modelValue: { count: { op: "gte", value: "3" } } }),
    );
    expect(c.querySelector(".hk-filter-trigger-dot")).toBeTruthy();
    const empty = mount(h(HkFilterTrigger, { fields: FIELDS, modelValue: {} }));
    expect(empty.querySelector(".hk-filter-trigger-dot")).toBeNull();
  });

  // ── Nested-popout regression (2026-10-14) ──────────────────────────
  // A popout opened from INSIDE the panel teleports to <body>, so the
  // panel popover's outside-click shield cannot see the nesting by DOM
  // containment — until the shield learned data-hk-popout-layer, picking
  // from the add-condition chooser (or a select row's popup) slammed the
  // whole panel shut and swallowed the pick. Both paths pinned here.

  it("keeps the panel open when a field is picked from the add-condition chooser", async () => {
    let seen: Record<string, unknown> | null = null;
    const c = mount(
      h(HkFilterTrigger, {
        fields: FIELDS,
        modelValue: {},
        "onUpdate:modelValue": (s: Record<string, unknown>) => (seen = s),
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
    expect(Object.keys(seen!)).toContain("tool");
    // …and the PANEL is still open — the chooser's click is not a
    // backdrop dismissal for it.
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
  });

  it("keeps the panel open when an option is picked from a select condition row", async () => {
    const selectFields = [
      { key: "tool", label: "Tool", kind: "text" as const },
      { key: "agent", label: "Agent", kind: "select" as const, options: [{ value: "a1", label: "Agent One" }] },
    ];
    let seen: Record<string, unknown> | null = null;
    const c = mount(
      h(HkFilterTrigger, {
        fields: selectFields,
        modelValue: { agent: { op: "eq", value: "" } },
        "onUpdate:modelValue": (s: Record<string, unknown>) => (seen = s),
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
    expect((seen! as { agent: { value: string } }).agent.value).toBe("a1");
    // …and the panel survived the nested pick.
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
    document.body.querySelectorAll(".hk-popup-select-item, .hk-popover-panel").forEach((el) => el.remove());
  });
});
