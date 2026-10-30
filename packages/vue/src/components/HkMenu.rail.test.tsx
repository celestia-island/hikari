import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { Home, Settings } from "lucide-vue-next";

import HkMenu, { type HkMenuItem } from "./HkMenu";

/**
 * HkMenu sidebar-variant ICON-RAIL mode (collapsed prop, 2026-10-30):
 * icon-only centered rows whose label travels in an HkTooltip, badges
 * degrading to a corner dot (count into the accessible name), groups
 * flattening to separators with children unreachable, state attributes
 * (active/checked/danger/disabled) carrying over, and icon-less rows
 * falling back to the label initial.
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountMenu(items: HkMenuItem[], props: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkMenu, {
        variant: "sidebar",
        items,
        open: false,
        ...props,
      }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container;
}

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
  document.querySelectorAll("#hk-overlay-root, .hk-tooltip-popup").forEach((n) => n.remove());
  vi.useRealTimers();
});

const ITEMS: HkMenuItem[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "inbox", label: "Inbox", icon: Settings, badge: "3" },
  { key: "plain", label: "Docs" },
  {
    key: "admin",
    label: "Administration",
    children: [
      { key: "users", label: "Users", icon: Home },
      { key: "audit", label: "Audit log", icon: Settings },
    ],
  },
];

describe("HkMenu sidebar icon rail", () => {
  it("renders icon-only rows — no labels, no pill badges — wrapped in tooltips", () => {
    const c = mountMenu(ITEMS, { collapsed: true, activeKey: "inbox" });

    expect(c.querySelector(".hk-menu-sidebar")!.hasAttribute("data-collapsed")).toBe(true);

    const rows = [...c.querySelectorAll("button.hk-menu-sidebar-row")];
    // Two icon leaves + the icon-less leaf; the GROUP row is gone.
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.hasAttribute("data-rail"), "rail rows carry data-rail").toBe(true);
      expect(row.querySelector(".hk-menu-label"), "labels hide in the rail").toBeNull();
      expect(row.querySelector(".hk-menu-sidebar-badge:not(.hk-menu-sidebar-badge--dot)")).toBeNull();
    }
    // Every rail row rides the tooltip infra.
    expect(c.querySelectorAll(".hk-tooltip-wrapper").length).toBe(rows.length);
  });

  it("keeps the row states: active, checked, danger, disabled", () => {
    const c = mountMenu(
      [
        { key: "a", label: "A", icon: Home },
        { key: "b", label: "B", icon: Home, checked: true },
        { key: "c", label: "C", icon: Home, danger: true },
        { key: "d", label: "D", icon: Home, disabled: true },
      ],
      { collapsed: true, activeKey: "a" },
    );
    const rows = [...c.querySelectorAll("button.hk-menu-sidebar-row")];
    expect(rows[0]!.hasAttribute("data-active")).toBe(true);
    expect(rows[0]!.getAttribute("aria-current")).toBe("page");
    expect(rows[1]!.hasAttribute("data-checked")).toBe(true);
    expect(rows[2]!.hasAttribute("data-danger")).toBe(true);
    expect(rows[3]!.hasAttribute("data-disabled")).toBe(true);
  });

  it("degrades the badge to a corner dot and keeps the count in the name", () => {
    const c = mountMenu(ITEMS, { collapsed: true });
    const inbox = [...c.querySelectorAll("button.hk-menu-sidebar-row")][1]!;
    const dot = inbox.querySelector(".hk-menu-sidebar-badge--dot");
    expect(dot, "the badge becomes a dot").toBeTruthy();
    expect(dot!.getAttribute("aria-hidden")).toBe("true");
    expect(inbox.getAttribute("aria-label")).toBe("Inbox (3)");
    // The plain row carries no count.
    expect([...c.querySelectorAll("button.hk-menu-sidebar-row")][0]!.getAttribute("aria-label")).toBe("Home");
  });

  it("flattens groups to separators — children unreachable in the rail", () => {
    const c = mountMenu(ITEMS, { collapsed: true });
    const divider = c.querySelector(".hk-menu-sidebar-divider");
    expect(divider, "the group becomes a separator").toBeTruthy();
    expect(divider!.getAttribute("role")).toBe("separator");
    expect(c.textContent, "no child labels leak into the rail").not.toContain("Users");
    expect(c.textContent).not.toContain("Audit log");
  });

  it("falls back to the label initial for icon-less rows", () => {
    const c = mountMenu(ITEMS, { collapsed: true });
    const plain = [...c.querySelectorAll("button.hk-menu-sidebar-row")][2]!;
    const glyph = plain.querySelector(".hk-menu-item-icon")!;
    expect(glyph.hasAttribute("data-fallback")).toBe(true);
    expect(glyph.textContent).toBe("D");
  });

  it("still selects from the rail (and stays disabled-aware)", () => {
    const selected: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    const app = createApp({
      render: () =>
        h(HkMenu, {
          variant: "sidebar",
          items: [
            { key: "go", label: "Go", icon: Home },
            { key: "no", label: "Nope", icon: Home, disabled: true },
          ],
          open: false,
          collapsed: true,
          onSelect: (key: string) => selected.push(key),
        }),
    });
    app.mount(container);
    mounts.push({ app, container });

    const rows = [...container.querySelectorAll("button.hk-menu-sidebar-row")] as HTMLButtonElement[];
    rows[0]!.click();
    rows[1]!.click();
    expect(selected, "the disabled row never selects").toEqual(["go"]);
  });

  it("shows the label through the tooltip on hover (the existing infra)", async () => {
    vi.useFakeTimers();
    const c = mountMenu(ITEMS, { collapsed: true });
    const wrap = c.querySelector(".hk-tooltip-wrapper")!;
    // HkTooltip delay 0: the popup mounts on the next task.
    wrap.dispatchEvent(new Event("mouseenter"));
    await vi.advanceTimersByTimeAsync(10);

    const popup = document.querySelector(".hk-tooltip-content");
    expect(popup, "the teleported tooltip popup renders").toBeTruthy();
    expect(popup!.textContent).toBe("Home");
  });

  it("renders the FULL list when not collapsed (the rail is opt-in)", () => {
    const c = mountMenu(ITEMS, { activeKey: "home" });
    expect(c.querySelector(".hk-menu-sidebar")!.hasAttribute("data-collapsed")).toBe(false);
    // 3 leaves + the group toggle row (accordion mode keeps the group
    // closed, so its 2 children stay hidden — the rail changes nothing
    // about the expanded rendering).
    expect(c.querySelectorAll("button.hk-menu-sidebar-row")).toHaveLength(4);
    expect(c.querySelector(".hk-menu-sidebar-divider")).toBeNull();
    expect(c.querySelector(".hk-menu-label"), "labels render outside the rail").toBeTruthy();
  });
});
