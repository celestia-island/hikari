import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

// The mobile half of the HkFilterTrigger contract (the main test file
// runs the desktop shape; useBreakpoint cannot be re-mocked per-test).
vi.mock("../runtime/useBreakpoint", () => ({
  useBreakpoint: () => ({ isMobile: { value: true } }),
}));

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

const FIELDS = [{ key: "tool", label: "Tool", kind: "text" as const }];

describe("HkFilterTrigger (mobile sheet)", () => {
  it("shows exactly ONE confirm button (no cancel) and closes on it", async () => {
    const c = mount(h(HkFilterTrigger, { fields: FIELDS, modelValue: {} }));
    const btn = c.querySelector<HTMLButtonElement>(".hk-filter-trigger .hk-icon-button")!;
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const footers = document.body.querySelectorAll(".hk-filter-trigger-footer");
    expect(footers.length, "the mobile confirm footer renders").toBe(1);
    const confirms = footers[0]!.querySelectorAll("button");
    // ONE button: the confirm-closes affordance. No cancel row — clearing
    // a condition is re-opening the panel and emptying the value.
    expect(confirms).toHaveLength(1);
    // The panel is up; pressing confirm closes the sheet (the popover
    // surfaces close through their transition — the TRIGGER's expanded
    // state is the contract, same assertion grammar as HkFilterBar's).
    expect(document.body.querySelector(".hk-filter-panel")).toBeTruthy();
    confirms[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});
