import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

// The sheet-title pin needs the mobile breakpoint (HkPopover's sheet
// branch); the rest of the file is desktop-neutral. Same file-level mock
// split as HkFilterTrigger.mobile.
vi.mock("../runtime/useBreakpoint", () => ({
  useBreakpoint: () => ({ isMobile: { value: true } }),
}));

import HkPopupSelect from "./HkPopupSelect";

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
  document.body.querySelectorAll(".hk-popover-scrim, .hk-popover-panel, .hk-select-popout-host").forEach((el) => el.remove());
});

const OPTIONS = [{ value: "a1", label: "Agent One" }];

describe("HkPopupSelect (mobile sheet)", () => {
  it("hideLabel keeps the sheet's breadcrumb title on the field's name", async () => {
    // hideLabel only suppresses the INLINE caption; the sheet header
    // must still carry the field's i18n label — it names the blocking
    // window layer for the popup-manager breadcrumb.
    const c = mount(
      h(HkPopupSelect, { modelValue: "", label: "Agent", hideLabel: true, options: OPTIONS }),
    );
    const trigger = c.querySelector<HTMLButtonElement>(".hk-popup-select-trigger")!;
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    const title = document.body.querySelector(".hk-popover-sheet-title");
    expect(title, "the sheet renders a title band").toBeTruthy();
    expect(title!.textContent).toBe("Agent");
  });
});
