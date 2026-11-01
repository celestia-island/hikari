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
    // The rail wrapper wears the SHARED children class too: the expanded
    // sidebar's 2px margin step reaches the rail through it — that class
    // union IS the vertical-invariance carrier (2026-10-31). A rail-only
    // wrapper would re-introduce the per-density step.
    expect(children!.classList.contains("hk-menu-sidebar-children")).toBe(true);
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
    // TWO-SIDED class-union pin: the EXPANDED wrapper must wear the
    // shared class too. Dropping it there removes the 2px step from the
    // expanded sidebar — rows below an open group would move on every
    // flip, the exact drift this contract kills (a rail-only pin let
    // that through).
    expect(
      c.querySelector(".hk-menu-sidebar-group[data-open] > .hk-menu-sidebar-children"),
      "the expanded children wrapper keeps the shared step class",
    ).toBeTruthy();

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

  it("stamps every icon cell with data-flip-icon = the row key, in BOTH densities", () => {
    // The rail flip's icon flight (useRailIconFlight) pairs the leaving
    // and entering copies of ONE destination by this attribute; a cell
    // missing it (or carrying the wrong key) silently drops that row out
    // of the continuity choreography. All four render sites — expanded
    // leaf + group toggle, rail leaf + rail group header — must stamp it.
    const iconKeys = (root: ParentNode): string[] =>
      [...root.querySelectorAll<HTMLElement>(".hk-menu-item-icon[data-flip-icon]")].map((el) =>
        el.getAttribute("data-flip-icon") ?? "",
      );

    // An icon on the group exercises the group-toggle sites; the
    // icon-less leaf exercises the asymmetry the flight tolerates: the
    // rail renders a fallback cell for it (keyed!) while the expanded
    // sidebar renders no cell at all — pairing needs BOTH ends, so that
    // row dissolves instead of flying.
    const FULL: HkMenuItem[] = [
      { key: "home", label: "Home", icon: Home },
      { key: "plain", label: "Docs" },
      {
        key: "admin",
        label: "Administration",
        icon: Settings,
        children: [{ key: "users", label: "Users", icon: Home }],
      },
    ];

    const expanded = mountMenu(FULL, { defaultExpandGroups: true });
    expect(iconKeys(expanded), "expanded leaf + group toggle icons").toEqual([
      "home",
      "admin",
      "users",
    ]);

    const collapsed = mountMenu(FULL, { collapsed: true, defaultExpandGroups: true });
    expect(iconKeys(collapsed), "rail leaves + rail group header icons").toEqual([
      "home",
      "plain",
      "admin",
      "users",
    ]);
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

  it("keeps open group children at the EXPANDED vertical step (no rail re-step)", () => {
    // Vertical rhythm is density-invariant (2026-10-31 user direction:
    // the collapse toggle must not move rows). The rail children wrapper
    // therefore carries NO margin rule of its own — the expanded
    // sidebar's 2px step from the shared .hk-menu-sidebar-children rule
    // applies in the rail too, and the wrapper stays width-only (its
    // selector survives only inside the comma-grouped width rule, which
    // the exact-line ruleBody skips — the null here asserts no
    // STANDALONE rail-children rule came back).
    const children = ruleBody(".hk-menu-sidebar[data-collapsed] .hk-menu-sidebar-rail-children");
    expect(children, "a standalone rail-children rule re-stepped the margin").toBeNull();
    const shared = ruleBody(".hk-menu-sidebar-children");
    expect(shared, "the shared children rule exists").not.toBeNull();
    expect(shared).toContain("margin-top: var(--space-2, 2px)");
    // A rule whose selector is EXACTLY a rail wrapper class — top-level,
    // outside any density dress — would restyle the rail children while
    // evading every dress-keyed scan below (the compiled chunk then
    // carries no carrier text). The wrappers' geometry must come from
    // the shared rules alone.
    expect(css.match(/^\s*\.hk-menu-sidebar-rail-(?:children|group)\s*\{/gm)).toBeNull();
  });

  it("the rail dress authors no vertical rhythm in any spelling", () => {
    // The stronger form of the contract above, so a re-step cannot hide
    // inside a comma-grouped selector the per-selector ruleBody skips
    // AND cannot return through alternate spellings or sister metrics:
    // every rule of the density dress is scanned and banned for ANY
    // margin/padding spelling that reaches a block edge — the shorthand
    // (it sets the block side too: the historical `margin-top: 0`
    // regression spelled `margin: 0` evaded a longhand-only scan) and
    // every vertical longhand, top AND bottom — plus the block-FLOW
    // metrics that move rows just the same (gap/row-gap/height/
    // min-height/max-height: a `gap:` inside the comma-grouped width
    // rule once passed a margin/padding-only scan). Horizontal-only
    // tracks (margin-inline*, padding-inline*) stay legal; absolute
    // INSETS (the caret corner's inset-block-end) are flow-neutral
    // decoration and stay legal. A rail band that truly needs a
    // different block metric must move the BASE rule for BOTH densities.
    // Keyed to BOTH carrier spellings so a future [data-rail]-keyed
    // carrier in this sheet cannot slip the scan.
    const dressRules = css
      .split("}")
      .filter(
        (rule) =>
          rule.includes(".hk-menu-sidebar[data-collapsed]") ||
          rule.includes(".hk-menu-sidebar[data-rail]"),
      );
    expect(dressRules.length, "the rail dress rules exist").toBeGreaterThan(3);
    for (const rule of dressRules) {
      expect(rule, `vertical margin in the rail dress: ${rule}`).not.toMatch(
        /\bmargin(?:-(?:top|bottom|block(?:-(?:start|end))?))?\s*:/,
      );
      expect(rule, `vertical padding in the rail dress: ${rule}`).not.toMatch(
        /\bpadding(?:-(?:top|bottom|block(?:-(?:start|end))?))?\s*:/,
      );
      expect(rule, `block-flow metric in the rail dress: ${rule}`).not.toMatch(
        /\b(?:gap|row-gap|height|min-height|max-height)\s*:/,
      );
    }
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
