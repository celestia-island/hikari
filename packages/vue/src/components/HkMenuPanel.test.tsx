import { describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import { HMenuActionItem, HMenuIdentityItem, HMenuPanel } from "../index";

/**
 * HkMenuPanel facility contract:
 * 1. The panel is a detachable container (no drawer/popover dependency)
 *    whose padding constraint matches the nav rows (--hk-menu-panel-inset
 *    default 12px).
 * 2. HkMenuActionItem renders a plain button (attrs/ref fall through)
 *    with the nav row grammar; danger/disabled variants are expressed via
 *    data attributes.
 * 3. HkMenuIdentityItem renders avatar (image or initial fallback) plus
 *    name/subtitle and an optional badges slot.
 */
describe("HkMenuPanel facility", () => {
  it("renders a detachable menu container with children", async () => {
    const app = createApp({
      render: () =>
        h(HMenuPanel, { label: "Account" }, () => [
          h(HMenuActionItem, { label: "One" }),
          h(HMenuActionItem, { label: "Two" }),
        ]),
    });
    const el = document.createElement("div");
    app.mount(el);
    await nextTick();

    const panel = el.querySelector(".hk-menu-list") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.getAttribute("role")).toBe("menu");
    expect(panel.getAttribute("aria-label")).toBe("Account");
    expect(panel.querySelectorAll(".hk-menu-action-item").length).toBe(2);
    expect(panel.classList.contains("hk-menu-list")).toBe(true);

    app.unmount();
  });

  it("action item renders a button and emits click", async () => {
    const onClick = vi.fn();
    const app = createApp({
      render: () => h(HMenuActionItem, { label: "Logout", danger: true, onClick }),
    });
    const el = document.createElement("div");
    app.mount(el);
    await nextTick();

    const btn = el.querySelector("button.hk-menu-action-item") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain("Logout");
    expect(btn.classList.contains("hk-menu-action-item--danger")).toBe(true);
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);

    app.unmount();
  });

  it("action item forwards attrs and disabled state", async () => {
    const app = createApp({
      render: () => h(HMenuActionItem, { label: "Save", disabled: true, id: "save-btn" }),
    });
    const el = document.createElement("div");
    app.mount(el);
    await nextTick();

    const btn = el.querySelector("button.hk-menu-action-item") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.id).toBe("save-btn");

    app.unmount();
  });

  it("identity item shows image avatar or initial fallback plus subtitle and badges", async () => {
    const app = createApp({
      render: () =>
        h(HMenuIdentityItem, {
          avatarUrl: "",
          name: "langyo",
          subtitle: "langyo@example.com",
        }),
    });
    const el = document.createElement("div");
    app.mount(el);
    await nextTick();

    const item = el.querySelector(".hk-menu-identity-item") as HTMLElement;
    expect(item).not.toBeNull();
    expect(item.querySelector(".hk-menu-identity-item__fallback")?.textContent).toBe("L");
    expect(item.querySelector(".hk-menu-identity-item__name")?.textContent).toBe("langyo");
    expect(item.querySelector(".hk-menu-identity-item__subtitle")?.textContent).toBe(
      "langyo@example.com",
    );

    app.unmount();
  });

  it("identity item renders an image when avatarUrl is set", async () => {
    const app = createApp({
      render: () =>
        h(HMenuIdentityItem, {
          avatarUrl: "/static/avatars/x.png",
          name: "langyo",
          subtitle: "",
        }),
    });
    const el = document.createElement("div");
    app.mount(el);
    await nextTick();

    const img = el.querySelector(".hk-menu-identity-item__img") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain("/static/avatars/x.png");
    expect(el.querySelector(".hk-menu-identity-item__fallback")).toBeNull();

    app.unmount();
  });
});
