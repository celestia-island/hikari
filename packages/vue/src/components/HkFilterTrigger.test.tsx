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
        modelValue: {},
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
});
