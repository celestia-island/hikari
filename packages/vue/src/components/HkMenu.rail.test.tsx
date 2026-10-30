import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, type Ref } from "vue";
import { Home, Settings } from "lucide-vue-next";

import HkMenu, { type HkMenuItem } from "./HkMenu";

/**
 * HkMenu sidebar-variant ICON-RAIL mode (collapsed prop, 2026-10-30):
 * icon-only centered rows whose label travels in an HkTooltip, badges
 * degrading to a corner dot (count into the accessible name), state
 * attributes (active/checked/danger/disabled) carrying over, and
 * icon-less leaves falling back to the label initial.
 *
 * GROUPS stay navigable in the rail (2026-10-30 follow-up): a group
 * header is a centered chevron row — ChevronDown while the group is
 * open, ChevronRight while closed — bound to the SAME isGroupExpanded/
 * toggleGroup state the expanded sidebar reads, and an open group lists
 * its children recursively as rail rows at every depth. The previous
 * group-to-separator flattening is gone: it stranded every grouped
 * destination behind an empty separator.
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

/** Mount with a LIVE collapsed channel (the shell / peek flip). */
function mountMenuWithCollapsed(items: HkMenuItem[], collapsed: Ref<boolean>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkMenu, {
        variant: "sidebar",
        items,
        open: false,
        collapsed: collapsed.value,
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

/** A group carrying a badge — the rail form must compose label + count. */
const GROUP_WITH_BADGE: HkMenuItem[] = [
  {
    key: "admin",
    label: "Administration",
    badge: "2",
    children: [{ key: "users", label: "Users", icon: Home }],
  },
];

const railOf = (c: HTMLElement): HTMLElement =>
  c.querySelector<HTMLElement>(".hk-menu-sidebar")!;

/** Every rail row (leaves AND group headers — both are real rows). */
const railRows = (root: ParentNode): HTMLButtonElement[] => [
  ...root.querySelectorAll<HTMLButtonElement>("button.hk-menu-sidebar-row"),
];

/** Rail group headers (also present in the expanded sidebar, same class). */
const groupRows = (root: ParentNode): HTMLButtonElement[] => [
  ...root.querySelectorAll<HTMLButtonElement>("button.hk-menu-sidebar-group-toggle"),
];

const rowNamed = (root: ParentNode, name: string): HTMLButtonElement | undefined =>
  railRows(root).find((row) => row.getAttribute("aria-label") === name);

describe("HkMenu sidebar icon rail", () => {
  it("renders icon-only rows — no labels, no pill badges — wrapped in tooltips", () => {
    const c = mountMenu(ITEMS, { collapsed: true, activeKey: "inbox" });

    expect(railOf(c).hasAttribute("data-collapsed")).toBe(true);

    const rows = railRows(c);
    // Three icon leaves plus the GROUP header — the header is a real row
    // now, not a separator, so every top-level entry stays one click away.
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.hasAttribute("data-rail"), "rail rows carry data-rail").toBe(true);
      expect(row.querySelector(".hk-menu-label"), "labels hide in the rail").toBeNull();
      expect(
        row.querySelector(".hk-menu-sidebar-badge:not(.hk-menu-sidebar-badge--dot)"),
      ).toBeNull();
    }
    // Every rail row rides the tooltip infra (group headers included).
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
    const rows = railRows(c);
    expect(rows[0]!.hasAttribute("data-active")).toBe(true);
    expect(rows[0]!.getAttribute("aria-current")).toBe("page");
    expect(rows[1]!.hasAttribute("data-checked")).toBe(true);
    expect(rows[2]!.hasAttribute("data-danger")).toBe(true);
    expect(rows[3]!.hasAttribute("data-disabled")).toBe(true);
  });

  it("degrades the badge to a corner dot and keeps the count in the name", () => {
    const c = mountMenu(ITEMS, { collapsed: true });
    const inbox = rowNamed(c, "Inbox (3)")!;
    const dot = inbox.querySelector(".hk-menu-sidebar-badge--dot");
    expect(dot, "the badge becomes a dot").toBeTruthy();
    expect(dot!.getAttribute("aria-hidden")).toBe("true");
    // The plain row carries no count.
    expect(rowNamed(c, "Home")!.querySelector(".hk-menu-sidebar-badge--dot")).toBeNull();
  });

  it("renders a group as a centered chevron header row — never a divider", () => {
    const c = mountMenu(ITEMS, { collapsed: true });

    expect(c.querySelector(".hk-menu-sidebar-divider"), "the separator fallback is gone").toBeNull();

    const group = groupRows(c)[0]!;
    expect(group.tagName).toBe("BUTTON");
    expect(group.hasAttribute("data-rail"), "the group header is a real rail row").toBe(true);
    expect(group.getAttribute("aria-expanded")).toBe("false");
    expect(group.getAttribute("aria-label")).toBe("Administration");

    // Closed glyph: the placeholder caret is a ChevronRight.
    const caret = group.querySelector(".hk-menu-rail-caret");
    expect(caret, "the group glyph is the rail caret").toBeTruthy();
    expect(caret!.classList.contains("lucide-chevron-right")).toBe(true);
    expect(caret!.classList.contains("lucide-chevron-down")).toBe(false);

    // A closed group mounts no children at all (no dead separator trail).
    expect(c.querySelector(".hk-menu-sidebar-rail-children")).toBeNull();
    expect(c.textContent).not.toContain("Users");
  });

  it("opens a group into its child icon rows and toggles it closed", async () => {
    const selected: string[] = [];
    const c = mountMenu(ITEMS, {
      collapsed: true,
      onSelect: (key: string) => selected.push(key),
    });

    groupRows(c)[0]!.click();
    await nextTick();

    expect(groupRows(c)[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(
      groupRows(c)[0]!.querySelector(".hk-menu-rail-caret")!.classList.contains("lucide-chevron-down"),
      "an open group shows ChevronDown",
    ).toBe(true);
    expect(selected, "toggling a group is navigation, not selection").toEqual([]);

    const children = c.querySelector(".hk-menu-sidebar-rail-children");
    expect(children, "the open group lists its children in the rail").toBeTruthy();
    const childRows = railRows(children!);
    expect(childRows.map((row) => row.getAttribute("aria-label"))).toEqual(["Users", "Audit log"]);
    for (const row of childRows) {
      expect(row.hasAttribute("data-rail"), "children are rail rows too").toBe(true);
      expect(
        row.querySelector(".hk-menu-item-icon svg"),
        "child leaves keep their own icon",
      ).toBeTruthy();
    }

    groupRows(c)[0]!.click();
    await nextTick();
    expect(c.querySelector(".hk-menu-sidebar-rail-children")).toBeNull();
    expect(groupRows(c)[0]!.getAttribute("aria-expanded")).toBe("false");
    expect(
      groupRows(c)[0]!.querySelector(".hk-menu-rail-caret")!.classList.contains("lucide-chevron-right"),
      "closing swaps back to ChevronRight",
    ).toBe(true);
  });

  it("shares the expanded sidebar's group state across the collapsed flip", async () => {
    const collapsed = ref(true);
    const c = mountMenuWithCollapsed(ITEMS, collapsed);

    // Rail first: open the group there.
    groupRows(c)[0]!.click();
    await nextTick();
    expect(c.querySelector(".hk-menu-sidebar-rail-children")).toBeTruthy();

    // Expanding the sidebar renders the SAME group open — the state
    // lives in the shared isGroupExpanded/toggleGroup sets, not in
    // rail-local state.
    collapsed.value = false;
    await nextTick();
    expect(railOf(c).hasAttribute("data-collapsed")).toBe(false);
    expect(c.querySelector(".hk-menu-sidebar-group[data-open]"), "the group is still open").toBeTruthy();
    expect(groupRows(c)[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(c.textContent).toContain("Users");

    // Reverse direction: collapse it from the expanded sidebar, flip
    // back into the rail — it must stay collapsed (no resurrection).
    groupRows(c)[0]!.click();
    await nextTick();
    expect(c.textContent).not.toContain("Users");
    collapsed.value = true;
    await nextTick();
    expect(c.querySelector(".hk-menu-sidebar-rail-children")).toBeNull();
    expect(groupRows(c)[0]!.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the fold INSTANCE-LOCAL when no shell provides one (standalone menus)", async () => {
    // The other half of the #43 contract. HkFaceShell provides the fold
    // store above its rail crossfade so a swap's fresh generations share
    // it; a standalone menu has no shell above it and must keep the
    // instance-local sets it has always had. A module-level singleton
    // store would silently make two menus on one page share fold keys —
    // that regression is what this pin catches.
    const a = mountMenu(ITEMS, { collapsed: true });
    const b = mountMenu(ITEMS, { collapsed: true });
    expect(groupRows(a)[0]!.getAttribute("aria-expanded")).toBe("false");
    expect(groupRows(b)[0]!.getAttribute("aria-expanded")).toBe("false");

    groupRows(a)[0]!.click();
    await nextTick();
    expect(groupRows(a)[0]!.getAttribute("aria-expanded"), "menu A opens its group").toBe("true");
    expect(
      groupRows(b)[0]!.getAttribute("aria-expanded"),
      "menu B keeps its own fold — nothing is shared without a provider",
    ).toBe("false");

    // And the standalone flip-in-place contract still holds: the rail and
    // the expanded sidebar are the SAME instance here, so the fold carries
    // exactly as it did before the shared store existed.
    groupRows(b)[0]!.click();
    await nextTick();
    expect(groupRows(b)[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(groupRows(a)[0]!.getAttribute("aria-expanded"), "A is still open, B now open").toBe("true");
  });

  it("recurses into nested groups — 2nd/3rd-level destinations stay reachable", async () => {
    const nested: HkMenuItem[] = [
      {
        key: "admin",
        label: "Administration",
        icon: Settings,
        children: [
          {
            key: "access",
            label: "Access",
            icon: Settings,
            children: [{ key: "roles", label: "Roles", icon: Home }],
          },
          { key: "audit", label: "Audit log", icon: Home },
        ],
      },
    ];
    const c = mountMenu(nested, { collapsed: true });

    groupRows(c)[0]!.click();
    await nextTick();
    // Level 2: the inner group is itself a rail group row.
    expect(groupRows(c)).toHaveLength(2);
    const inner = groupRows(c)[1]!;
    expect(inner.getAttribute("aria-label")).toBe("Access");
    expect(inner.getAttribute("aria-expanded")).toBe("false");

    // It nests INSIDE the outer group's children wrapper (recursive).
    const outerChildren = () => c.querySelector(".hk-menu-sidebar-rail-children")!;
    expect(outerChildren().contains(inner)).toBe(true);

    // Level 3: expanding the inner group reveals its leaf in the rail.
    inner.click();
    await nextTick();
    const innerChildren = outerChildren().querySelector(".hk-menu-sidebar-rail-children");
    expect(innerChildren, "the inner group recursed its own children wrapper").toBeTruthy();
    const roles = innerChildren!.querySelector<HTMLButtonElement>('button[aria-label="Roles"]');
    expect(roles).toBeTruthy();
    expect(roles!.hasAttribute("data-rail")).toBe(true);
    // Both open groups carry the open marker.
    expect(c.querySelectorAll(".hk-menu-sidebar-rail-group[data-open]")).toHaveLength(2);
  });

  it("announces a group's badge count and shows its label in a tooltip", async () => {
    vi.useFakeTimers();
    const c = mountMenu(GROUP_WITH_BADGE, { collapsed: true });

    const group = groupRows(c)[0]!;
    expect(group.getAttribute("aria-label")).toBe("Administration (2)");
    const dot = group.querySelector(".hk-menu-sidebar-badge--dot");
    expect(dot, "the group badge degrades to the dot").toBeTruthy();
    expect(dot!.getAttribute("aria-hidden")).toBe("true");
    expect(
      group.querySelector(".hk-menu-sidebar-badge:not(.hk-menu-sidebar-badge--dot)"),
    ).toBeNull();

    // The tooltip carries the same composed name (badge count included).
    group.closest(".hk-tooltip-wrapper")!.dispatchEvent(new Event("mouseenter"));
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector(".hk-tooltip-content")!.textContent).toBe("Administration (2)");
  });

  it("respects data-disabled on the group header", async () => {
    const c = mountMenu(
      [
        {
          key: "admin",
          label: "Administration",
          disabled: true,
          children: [{ key: "users", label: "Users", icon: Home }],
        },
      ],
      { collapsed: true },
    );
    const group = groupRows(c)[0]!;
    expect(group.hasAttribute("data-disabled")).toBe(true);
    group.click();
    await nextTick();
    expect(group.getAttribute("aria-expanded")).toBe("false");
    expect(c.querySelector(".hk-menu-sidebar-rail-children")).toBeNull();
  });

  it("uses the group icon as its glyph and parks the state caret in the corner", async () => {
    const c = mountMenu(
      [
        {
          key: "admin",
          label: "Administration",
          icon: Settings,
          children: [{ key: "users", label: "Users", icon: Home }],
        },
      ],
      { collapsed: true },
    );

    // A declared icon owns the glyph cell; the state caret moves out of
    // the column into the corner so the icon stays rail-centered.
    const group = groupRows(c)[0]!;
    const glyph = group.querySelector(".hk-menu-item-icon")!;
    expect(glyph.querySelector("svg"), "the declared icon is the glyph").toBeTruthy();
    expect(
      glyph.querySelector(".hk-menu-rail-caret"),
      "no placeholder caret in the glyph cell",
    ).toBeNull();
    const corner = group.querySelector(".hk-menu-rail-caret-corner .hk-menu-rail-caret");
    expect(corner, "the state caret parks in the corner").toBeTruthy();
    expect(corner!.classList.contains("lucide-chevron-right")).toBe(true);

    // Opening swaps the corner glyph to ChevronDown; the icon stays put.
    group.click();
    await nextTick();
    expect(
      groupRows(c)[0]!
        .querySelector(".hk-menu-rail-caret-corner .hk-menu-rail-caret")!
        .classList.contains("lucide-chevron-down"),
    ).toBe(true);
  });

  it("falls back to the label initial for icon-less LEAF rows", () => {
    const c = mountMenu(ITEMS, { collapsed: true });
    const glyph = rowNamed(c, "Docs")!.querySelector(".hk-menu-item-icon")!;
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

    const rows = railRows(container);
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

  it("opens the rail tooltip toward the CONTENT side in RTL (R2 pin)", async () => {
    vi.useFakeTimers();
    document.documentElement.dir = "rtl";
    try {
      const c = mountMenu(ITEMS, { collapsed: true });
      const wrap = c.querySelector(".hk-tooltip-wrapper")!;
      wrap.dispatchEvent(new Event("mouseenter"));
      await vi.advanceTimersByTimeAsync(10);
      const popup = document.querySelector(".hk-tooltip-popup");
      expect(popup, "the teleported tooltip popup renders").toBeTruthy();
      expect(popup!.className, "RTL opens LEFT, toward the content").toContain("hk-tooltip-left");
    } finally {
      document.documentElement.dir = "";
    }
  });

  it("renders the FULL list when not collapsed (the rail is opt-in)", () => {
    const c = mountMenu(ITEMS, { activeKey: "home" });
    expect(railOf(c).hasAttribute("data-collapsed")).toBe(false);
    // 3 leaves + the group toggle row (accordion mode keeps the group
    // closed, so its 2 children stay hidden — the rail changes nothing
    // about the expanded rendering).
    expect(railRows(c)).toHaveLength(4);
    expect(c.querySelector(".hk-menu-sidebar-divider")).toBeNull();
    expect(c.querySelector(".hk-menu-label"), "labels render outside the rail").toBeTruthy();
    // The rail-only caret never leaks into the expanded sidebar (its
    // group toggle keeps the .hk-menu-more chevron).
    expect(c.querySelector(".hk-menu-rail-caret")).toBeNull();
  });
});

describe("HkMenu rail styles (compiled sheet contracts)", () => {
  const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));
  const css = compile(resolve(componentDir, "HkMenu.scss"), {
    style: "expanded",
    loadPaths: [componentDir],
  }).css.replace(/\/\*[\s\S]*?\*\//g, "");

  /** Body of the first rule whose selector matches exactly. A selector
   *  that continues a comma-separated list is skipped: its line follows a
   *  trailing comma, so a sibling selector can never answer for it. */
  const ruleBody = (selector: string): string | null => {
    const lines = css.split("\n");
    const startLine = lines.findIndex(
      (line, i) => line === selector + " {" && !(lines[i - 1] ?? "").trim().endsWith(","),
    );
    if (startLine < 0) return null;
    const rest = lines.slice(startLine + 1).join("\n");
    return rest.slice(0, rest.indexOf("}"));
  };

  it("compiles", () => {
    expect(css.length).toBeGreaterThan(0);
    expect(css).toContain(".hk-menu-sidebar");
    expect(css).toContain(".hk-menu-rail-caret");
  });

  it("centers every rail row on the one column", () => {
    // Uniform centering is the rail alignment contract: the group header
    // and every recursive child row inherit this same rule.
    const row = ruleBody(".hk-menu-sidebar[data-collapsed] .hk-menu-sidebar-row");
    expect(row, "the rail row rule exists").not.toBeNull();
    expect(row).toContain("justify-content: center");
  });

  it("keeps open group children in the same one-column rhythm (no indent step)", () => {
    const children = ruleBody(".hk-menu-sidebar[data-collapsed] .hk-menu-sidebar-rail-children");
    expect(children, "the rail children rule exists").not.toBeNull();
    expect(children).toContain("margin-top: 0");
  });

  it("mirrors the rail caret in RTL with the scaleX convention, never a rotate", () => {
    const rtl = css.match(/\[dir\s*=\s*"?rtl"?\]\s+\.hk-menu-rail-caret\s*\{([^}]*)\}/);
    expect(rtl, "the RTL mirror rule exists").not.toBeNull();
    expect(rtl![1]).toContain("transform: scaleX(-1)");
    // The expanded sidebar rotates ONE chevron via [data-open]; the rail
    // swaps glyphs instead, so no rotate rule may target the caret.
    expect(css).not.toMatch(/\.hk-menu-rail-caret[^{]*\{[^}]*rotate/);
  });

  it("no longer ships the group-as-separator rule (dead code removed)", () => {
    expect(css).not.toContain(".hk-menu-sidebar-divider");
  });
});
