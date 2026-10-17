import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";

import HkRowActions from "./HkRowActions";
import type { HkMenuItem } from "./HkMenu";

/**
 * HkRowActions contract (2026-10-18 row-actions standard):
 * - trigger mode: one ghost kebab button, localized default label, and
 *   a click emits `open` with the trigger itself as the opener element
 *   (the focus-restore anchor a row manage window reuses)
 * - menu mode (`items`): the trigger hosts an HkMenu popup —
 *   aria-haspopup/expanded flip, `open` never fires, `select` fires
 * - the click never reaches clickable ancestors
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
  document.body.querySelectorAll(".hk-select-panel").forEach((n) => n.remove());
});

describe("HkRowActions", () => {
  it("trigger mode: click emits open with the trigger button as opener", async () => {
    const opened: HTMLElement[] = [];
    const c = mount(h(HkRowActions, { onOpen: (el: HTMLElement) => opened.push(el) }));
    const btn = c.querySelector("button.hk-icon-button") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.getAttribute("aria-label")).toBe("Row actions");
    btn.click();
    await Promise.resolve();
    expect(opened).toHaveLength(1);
    expect(opened[0]).toBe(btn);
  });

  it("menu mode: aria announces the popup, open never fires", async () => {
    const onOpen = vi.fn();
    const items: HkMenuItem[] = [
      { key: "edit", label: "Edit" },
      { key: "delete", label: "Delete", danger: true },
    ];
    const c = mount(h(HkRowActions, { items, onOpen }));
    const btn = c.querySelector("button.hk-icon-button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-haspopup")).toBe("menu");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onOpen).not.toHaveBeenCalled();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    // A second press toggles the menu shut (the hand-rolled kebab+menu
    // pairs this component replaces closed on re-click).
    btn.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("stops the click from reaching clickable ancestors", () => {
    const outer = vi.fn();
    const c = mount(
      h("div", { onClick: outer }, h(HkRowActions)),
    );
    (c.querySelector("button.hk-icon-button") as HTMLButtonElement).click();
    expect(outer).not.toHaveBeenCalled();
  });

  it("custom label overrides the localized default", () => {
    const c = mount(h(HkRowActions, { label: "Manage row" }));
    const btn = c.querySelector("button.hk-icon-button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("Manage row");
  });
});
