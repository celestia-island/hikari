import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type ComponentPublicInstance } from "vue";

import HkMenu, { type HkMenuItem } from "./HkMenu";

const mounts: ReturnType<typeof createApp>[] = [];
const containers: HTMLElement[] = [];

const items: HkMenuItem[] = [
  {
    key: "lang",
    label: "Language",
    children: [
      { key: "en", label: "English", flag: "🇬🇧" },
      { key: "zh", label: "中文", flag: "🇨🇳", checked: true },
    ],
  },
  { key: "logout", label: "Log out", danger: true },
];

const siblingItems: HkMenuItem[] = [
  {
    key: "one",
    label: "Branch One",
    children: [
      { key: "one-a", label: "One A" },
      { key: "one-b", label: "One B" },
    ],
  },
  {
    key: "two",
    label: "Branch Two",
    children: [
      { key: "two-a", label: "Two A" },
      { key: "two-b", label: "Two B" },
    ],
  },
];

interface MountedMenu {
  container: HTMLElement;
  anchor: HTMLButtonElement;
  unmount: () => void;
}

interface MountOptions {
  props?: Record<string, unknown>;
  /** Slots beyond the default HkMenu props — e.g. header/footer/default. */
  slots?: Record<string, () => unknown>;
}

/**
 * Menus render through HkSelectPanel's own Teleports to body, so queries
 * go to the document. Keep at most one OPEN menu mounted at a time
 * (unmount via the returned handle) — body queries cannot tell instances
 * apart.
 */
function mountMenu(
  openRef = ref(true),
  menuItems: HkMenuItem[] = items,
  handlers: {
    onSelect?: (key: string) => void;
    onUpdateOpen?: (v: boolean) => void;
  } = {},
  options: MountOptions = {},
): MountedMenu {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const anchorEl = ref<HTMLElement | null>(null);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h("div", [
          h(
            "button",
            {
              ref: (el: Element | ComponentPublicInstance | null) => {
                anchorEl.value = el as HTMLElement | null;
              },
              type: "button",
            },
            "trigger",
          ),
          h(
            HkMenu,
            {
              open: openRef.value,
              title: "Menu",
              items: menuItems,
              anchorRef: anchorEl.value,
              onSelect: handlers.onSelect,
              "onUpdate:open": (v: boolean) => {
                handlers.onUpdateOpen?.(v);
                openRef.value = v;
              },
              ...options.props,
            },
            options.slots as MountOptions["slots"],
          ),
        ]);
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return {
    container,
    anchor: container.querySelector("button")!,
    unmount: () => {
      const i = mounts.indexOf(app);
      if (i >= 0) mounts.splice(i, 1);
      app.unmount();
    },
  };
}

function popouts(): HTMLElement[] {
  return Array.from(document.querySelectorAll(".hk-select-popout")) as HTMLElement[];
}

/** Fixed positioning wrappers around the popouts — the element that
 *  carries the inline coords + z-index (and hosts the overlay scrollbar
 *  tracks) since the popout teleports to body. */
function popoutHosts(): HTMLElement[] {
  return Array.from(document.querySelectorAll(".hk-select-popout-host")) as HTMLElement[];
}

function sheets(): HTMLElement[] {
  return Array.from(document.querySelectorAll(".hk-select-sheet-panel")) as HTMLElement[];
}

function scrims(): HTMLElement[] {
  return Array.from(document.querySelectorAll(".hk-select-sheet-scrim")) as HTMLElement[];
}

function rows(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll(".hk-menu-row")) as HTMLButtonElement[];
}

function rowByLabel(label: string): HTMLButtonElement | undefined {
  return rows().find((r) => r.textContent?.includes(label));
}

function checkCells(): Element[] {
  return Array.from(document.querySelectorAll(".hk-menu-check"));
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** Wait until pred() holds (history navigation settles asynchronously). */
async function until(pred: () => boolean, ms = 500): Promise<void> {
  const deadline = Date.now() + ms;
  while (!pred() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
}

afterEach(async () => {
  while (mounts.length) mounts.pop()?.unmount();
  // Unmounting restores history asynchronously; wait for it to land so a
  // pending traversal cannot pop the NEXT test's freshly pushed entries.
  // Leaf-select tests ABANDON their rewind on purpose, so the marker
  // entry stays current as an inert dead marker — de-mark it in place
  // (the same way a landing popstate would) or the until() below would
  // spin to its timeout on an intentionally kept marker.
  window.history.replaceState(null, "");
  await until(() => window.history.state?.__hkBack === undefined);
  // happy-dom never fires transitionend, so leave transitions never
  // finish and teleported panels linger on <body> — strip them or the
  // next test's querySelector sees this test's panels.
  document.body
    .querySelectorAll(".hk-select-popout, .hk-select-sheet-panel, .hk-select-sheet-scrim")
    .forEach((el) => el.remove());
  while (containers.length) containers.pop()?.remove();
  window.innerWidth = 1024;
});

describe("HkMenu on the HkSelectPanel surface", () => {
  it("renders root rows in an anchored popout when open and nothing when closed", () => {
    mountMenu(ref(false));
    expect(popouts()).toHaveLength(0);
    expect(sheets()).toHaveLength(0);
    mountMenu(ref(true));
    expect(popouts()).toHaveLength(1);
    expect(document.body.textContent ?? "").toContain("Language");
    expect(document.body.textContent ?? "").toContain("Log out");
  });

  it("cascades into a nested popout on the desktop path and emits select on leaves", async () => {
    const selected: string[] = [];
    const closes: boolean[] = [];
    const openRef = ref(true);
    mountMenu(openRef, items, {
      onSelect: (key) => selected.push(key),
      onUpdateOpen: (v) => closes.push(v),
    });
    await settle();

    rowByLabel("Language")!.click();
    await settle();
    expect(popouts().length).toBe(2);
    expect(popouts()[1].textContent).toContain("中文");

    const leaf = Array.from(popouts()[1].querySelectorAll(".hk-menu-row")).find((r) =>
      r.textContent?.includes("中文"),
    ) as HTMLButtonElement;
    leaf.click();
    await settle();
    expect(selected).toEqual(["zh"]);
    expect(closes.at(-1)).toBe(false);
    await until(() => popouts().length === 0);
  });

  it("switches the cascade when a sibling branch is clicked", async () => {
    mountMenu(ref(true), siblingItems);
    await settle();

    rowByLabel("Branch One")!.click();
    await settle();
    expect(popouts().length).toBe(2);
    expect(popouts()[1].textContent).toContain("One A");

    // Clicking the sibling in the ROOT panel must replace the open submenu,
    // not nest under it.
    rowByLabel("Branch Two")!.click();
    await settle();
    expect(popouts().length).toBe(2);
    expect(popouts()[1].textContent).toContain("Two A");
    expect(popouts()[1].textContent).not.toContain("One A");
    const active = Array.from(document.querySelectorAll(".hk-menu-row[data-active]"));
    expect(active.length).toBe(1);
    expect(active[0].textContent).toContain("Branch Two");
  });

  it("switches submenu on sibling hover and collapses on leaf hover", async () => {
    const first = mountMenu(ref(true), siblingItems);
    await settle();

    rowByLabel("Branch One")!.click();
    await settle();
    expect(popouts().length).toBe(2);

    rowByLabel("Branch Two")!.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    await settle();
    expect(popouts().length).toBe(2);
    expect(popouts()[1].textContent).toContain("Two A");

    // Hovering a plain leaf row in the root panel collapses deeper levels.
    first.unmount();
    await settle();
    mountMenu(ref(true), [...siblingItems, { key: "plain", label: "Plain Leaf" }]);
    await settle();
    rowByLabel("Branch One")!.click();
    await settle();
    expect(popouts().length).toBe(2);
    rowByLabel("Plain Leaf")!.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    await settle();
    expect(popouts().length).toBe(1);
  });

  it("clicks inside a submenu popout do not tear down the shallower panels", async () => {
    const openRef = ref(true);
    mountMenu(openRef, siblingItems);
    await settle();
    rowByLabel("Branch One")!.click();
    await settle();
    expect(popouts().length).toBe(2);

    // Click a non-interactive spot of the submenu popout (its padding) —
    // the root panel's outside-click must not fire.
    popouts()[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(openRef.value).toBe(true);
    expect(popouts().length).toBe(2);

    // A click genuinely outside every surface closes the menu.
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.click();
    await settle();
    expect(openRef.value).toBe(false);
    outside.remove();
  });

  it("names the desktop popout with the title prop (a11y label)", () => {
    mountMenu(ref(true));
    expect(popouts()[0].getAttribute("aria-label")).toBe("Menu");
  });

  it("cascades through the synthetic anchor for right-start/left-start placements", async () => {
    // right-start/left-start have no native HkSelectPanel placement —
    // they route through the synthetic root cascade anchor (the shape
    // HkLocalePickerPopup uses).
    mountMenu(ref(true), siblingItems, {}, { props: { placement: "right-start" } });
    await settle();
    expect(popouts().length).toBe(1);

    rowByLabel("Branch One")!.click();
    await settle();
    expect(popouts().length).toBe(2);
    expect(popouts()[1].textContent).toContain("One A");

    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.click();
    await settle();
    expect(popouts().length).toBe(0);
    outside.remove();

    mountMenu(ref(true), siblingItems, {}, { props: { placement: "left-start" } });
    await settle();
    expect(popouts().length).toBe(1);
    expect(document.body.textContent ?? "").toContain("Branch One");
  });

  it("matches the anchor width only when matchAnchorWidth is set", async () => {
    const first = mountMenu(ref(true), items, {}, { props: { matchAnchorWidth: true } });
    await settle();
    first.anchor.getBoundingClientRect = () =>
      ({ top: 10, bottom: 30, left: 40, right: 140, width: 100, height: 20 }) as DOMRect;
    window.dispatchEvent(new Event("resize"));
    await settle();
    expect(popoutHosts()[0].style.minWidth).toBe("100px");
    first.unmount();
    await settle();

    // Default: shrink-to-fit, no anchor width forced.
    mountMenu(ref(true), items);
    await settle();
    expect(popoutHosts()[0].style.minWidth).toBe("");
  });
});

describe("HkMenu check column (selectMode)", () => {
  const checkedItems: HkMenuItem[] = [
    { key: "a", label: "Alpha", checked: true },
    { key: "b", label: "Beta", checked: false },
    { key: "c", label: "Gamma" },
  ];
  const plainItems: HkMenuItem[] = [
    { key: "a", label: "Alpha" },
    { key: "b", label: "Beta" },
  ];

  it("auto reserves the column per level when any item carries checked", () => {
    mountMenu(ref(true), checkedItems);
    const cells = checkCells();
    expect(cells).toHaveLength(3);
    expect(cells[0].textContent).toBe("✓");
    expect(cells[1].textContent).toBe("");
    expect(cells[2].textContent).toBe("");
  });

  it("auto shows no column for plain action menus", () => {
    mountMenu(ref(true), plainItems);
    expect(checkCells()).toHaveLength(0);
  });

  it("selectMode false suppresses the column even with checked items", () => {
    mountMenu(ref(true), checkedItems, {}, { props: { selectMode: false } });
    expect(checkCells()).toHaveLength(0);
  });

  it("selectMode true reserves the column even without checked items", () => {
    mountMenu(ref(true), plainItems, {}, { props: { selectMode: true } });
    expect(checkCells()).toHaveLength(2);
    checkCells().forEach((cell) => expect(cell.textContent).toBe(""));
  });
});

describe("HkMenu slots", () => {
  const slots = {
    header: () => h("div", { class: "menu-header" }, "Identity Block"),
    footer: () => h("div", { class: "menu-footer" }, "Footer Note"),
  };

  it("renders header/footer inside the desktop popout, around the item rows", () => {
    mountMenu(ref(true), items, {}, { slots });
    const level = popouts()[0].querySelector(".hk-menu-level")!;
    expect(level).toBeTruthy();
    expect(level.querySelector(".menu-header")!.textContent).toBe("Identity Block");
    expect(level.querySelector(".menu-footer")!.textContent).toBe("Footer Note");
    // Ordering: header → rows → footer.
    const children = Array.from(level.children).map((el) => el.className);
    expect(children[0]).toContain("menu-header");
    expect(children[1]).toContain("hk-menu-row");
    expect(children[children.length - 1]).toContain("menu-footer");
  });

  it("renders header/footer inside the mobile sheet too", async () => {
    window.innerWidth = 390;
    mountMenu(ref(true), items, {}, { slots });
    await settle();
    const level = sheets()[0].querySelector(".hk-menu-level")!;
    expect(level.querySelector(".menu-header")!.textContent).toBe("Identity Block");
    expect(level.querySelector(".menu-footer")!.textContent).toBe("Footer Note");
  });

  it("composition mode: a default slot replaces the items model entirely", () => {
    mountMenu(ref(true), items, {}, {
      slots: {
        default: () => h("div", { class: "custom-row" }, "Custom Row"),
      },
    });
    const level = popouts()[0].querySelector(".hk-menu-level")!;
    expect(level.querySelector(".custom-row")!.textContent).toBe("Custom Row");
    expect(level.querySelectorAll(".hk-menu-row")).toHaveLength(0);
    expect(level.textContent).not.toContain("Language");
  });
});

describe("HkMenu mobile sheets", () => {
  it("opens one sheet layer per level and back closes exactly one level", async () => {
    window.innerWidth = 390;
    const openRef = ref(true);
    mountMenu(openRef, siblingItems);
    await settle();

    // Root sheet only, owning one back-guard entry.
    expect(sheets().length).toBe(1);
    expect(window.history.state?.__hkBack).toEqual(expect.any(String));

    // Enter the first branch → two stacked sheet layers.
    rowByLabel("Branch One")!.click();
    await settle();
    expect(sheets().length).toBe(2);

    // Browser/system back closes ONE level: back to the root sheet.
    window.history.back();
    await settle();
    expect(sheets().length).toBe(1);
    expect(openRef.value).toBe(true);
    expect(window.history.state?.__hkBack).toEqual(expect.any(String));

    // Back from the root closes the menu entirely.
    window.history.back();
    await until(() => openRef.value === false);
    await until(() => window.history.state?.__hkBack === undefined);
    expect(document.querySelector(".hk-select-sheet-panel")).toBeNull();
  });

  it("titles the root sheet from the prop and sub-sheets from the parent label", async () => {
    window.innerWidth = 390;
    mountMenu(ref(true), siblingItems);
    await settle();
    expect(sheets()[0].querySelector(".hk-select-sheet-title")!.textContent).toBe("Menu");
    expect(sheets()[0].querySelector(".hk-select-sheet-grabber")).toBeTruthy();

    rowByLabel("Branch One")!.click();
    await settle();
    expect(sheets().length).toBe(2);
    expect(sheets()[1].querySelector(".hk-select-sheet-title")!.textContent).toBe("Branch One");
    expect(sheets()[1].querySelector(".hk-select-sheet-grabber")).toBeTruthy();
  });

  it("keeps the root sheet when the top layer is dismissed via its scrim", async () => {
    window.innerWidth = 390;
    const openRef = ref(true);
    mountMenu(openRef, siblingItems);
    await settle();

    rowByLabel("Branch One")!.click();
    await settle();
    expect(sheets().length).toBe(2);
    expect(scrims().length).toBe(2);

    // The topmost scrim belongs to the pushed layer; tapping it pops one
    // level and keeps the root sheet open.
    scrims()[scrims().length - 1].click();
    await settle();
    expect(sheets().length).toBe(1);
    expect(openRef.value).toBe(true);
  });

  it("selecting a leaf on mobile closes every sheet and abandons the rewind so a later async navigation survives", async () => {
    window.innerWidth = 390;
    const selected: string[] = [];
    const openRef = ref(true);
    mountMenu(openRef, siblingItems, {
      onSelect: (key) => selected.push(key),
    });
    await settle();

    rowByLabel("Branch Two")!.click();
    await settle();
    rowByLabel("Two B")!.click();
    await settle();

    expect(selected).toEqual(["two-b"]);
    expect(openRef.value).toBe(false);
    await until(() => document.querySelector(".hk-select-sheet-panel") === null);
    // The leaf's back-guard rewinds are abandoned (a leaf select IS an
    // action — typically a modal or an async router navigation), so no
    // suppressed traversal fires and the marker entry stays current
    // until the action's own navigation commits on top of it.
    await settle();
    expect(window.history.state?.__hkBack).toBeDefined();
    const len = window.history.length;
    // Simulate the async router navigation committing after the flush.
    window.history.pushState({ router: true }, "");
    await settle();
    expect(window.history.length).toBe(len + 1);
    expect(window.history.state?.router).toBe(true);
  });

  it("a desktop leaf select driving an async navigation is not bounced by the rewind", async () => {
    const selected: string[] = [];
    const openRef = ref(true);
    mountMenu(openRef, items, {
      onSelect: (key) => selected.push(key),
    });
    await settle();

    rowByLabel("Log out")!.click();
    await settle();

    expect(selected).toEqual(["logout"]);
    expect(openRef.value).toBe(false);
    await settle();
    // The rewind claim was abandoned: history was NOT rewound (no
    // suppressed go(-n) racing the consumer's router.push), and the
    // marker entry is still current when the async navigation finally
    // commits on top of it.
    expect(window.history.state?.__hkBack).toBeDefined();
    const len = window.history.length;
    window.history.pushState({ router: true }, "");
    await settle();
    expect(window.history.length).toBe(len + 1);
    expect(window.history.state?.router).toBe(true);
  });

  it("closes when the viewport crosses the breakpoint while open", async () => {
    window.innerWidth = 390;
    const openRef = ref(true);
    mountMenu(openRef, siblingItems);
    await settle();
    expect(sheets().length).toBe(1);

    // The shared dropdown surface's contract: crossing the breakpoint
    // closes instead of re-docking mid-flight (HkSelect behavior).
    window.innerWidth = 1280;
    window.dispatchEvent(new Event("resize"));
    await settle();
    expect(openRef.value).toBe(false);
    await until(() => window.history.state?.__hkBack === undefined);

    // Reopening on the desktop side docks as a popout.
    openRef.value = true;
    await settle();
    expect(popouts().length).toBe(1);
    expect(sheets().length).toBe(0);
  });
});

describe("HkMenu sidebar variant", () => {
  const navItems: HkMenuItem[] = [
    { key: "dashboard", label: "Dashboard" },
    {
      key: "shop",
      label: "Shop",
      children: [
        { key: "products", label: "Products" },
        { key: "listings", label: "Listings", badge: "3" },
      ],
    },
    { key: "logout", label: "Log out", danger: true },
  ];

  it("renders an inline nav list with active row, badge and groups", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({
      render: () =>
        h(HkMenu, {
          variant: "sidebar",
          open: true,
          title: "Navigation",
          items: navItems,
          activeKey: "listings",
        }),
    });
    mounts.push(app);
    app.mount(container);

    // Inline render: no teleport, no panels, no history ownership.
    expect(document.querySelector(".hk-select-popout")).toBeNull();
    expect(document.querySelector(".hk-select-sheet-panel")).toBeNull();
    expect(window.history.state?.__hkBack).toBeUndefined();

    const nav = container.querySelector(".hk-menu-sidebar");
    expect(nav).not.toBeNull();
    expect(nav!.getAttribute("aria-label")).toBe("Navigation");

    // Group containing the active row starts expanded.
    expect(container.textContent).toContain("Products");
    expect(container.textContent).toContain("Listings");

    const active = container.querySelector(".hk-menu-sidebar-row[data-active]");
    expect(active?.textContent).toContain("Listings");

    const badge = container.querySelector(".hk-menu-sidebar-badge");
    expect(badge?.textContent).toBe("3");
  });

  it("emits select on leaf rows and toggles groups without selecting", async () => {
    const selected: string[] = [];
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({
      render: () =>
        h(HkMenu, {
          variant: "sidebar",
          open: true,
          items: navItems,
          onSelect: (key: string) => selected.push(key),
        }),
    });
    mounts.push(app);
    app.mount(container);
    await settle();

    // Groups default collapsed when nothing active inside them.
    expect(container.textContent).not.toContain("Products");

    const toggle = container.querySelector(
      ".hk-menu-sidebar-group-toggle",
    ) as HTMLButtonElement;
    toggle.click();
    await settle();
    expect(container.textContent).toContain("Products");
    expect(selected).toEqual([]); // toggling is navigation, not selection

    const leaf = [...container.querySelectorAll(".hk-menu-sidebar-row")].find(
      (r) => r.textContent?.includes("Products"),
    ) as HTMLButtonElement;
    leaf.click();
    await settle();
    expect(selected).toEqual(["products"]);

    // Collapse again — children disappear.
    toggle.click();
    await settle();
    expect(container.textContent).not.toContain("Products");
  });

  it("lets the user collapse the active group and keeps siblings independent", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    containers.push(container);
    const app = createApp({
      render: () =>
        h(HkMenu, {
          variant: "sidebar",
          open: true,
          items: [
            ...navItems,
            {
              key: "system",
              label: "System",
              children: [{ key: "general", label: "General" }],
            },
          ],
          activeKey: "listings",
        }),
    });
    mounts.push(app);
    app.mount(container);
    await settle();

    const toggleOf = (label: string) =>
      Array.from(container.querySelectorAll(".hk-menu-sidebar-group-toggle")).find(
        (r) => r.textContent?.includes(label),
      ) as HTMLButtonElement;

    // Active group auto-expanded at mount.
    expect(container.textContent).toContain("Products");

    // First toggle COLLAPSES it (regression: it used to be a no-op).
    toggleOf("Shop").click();
    await settle();
    expect(container.textContent).not.toContain("Products");

    // Re-expand; expanding a sibling must not collapse the active group.
    toggleOf("Shop").click();
    await settle();
    expect(container.textContent).toContain("Products");
    toggleOf("System").click();
    await settle();
    expect(container.textContent).toContain("Products");
    expect(container.textContent).toContain("General");

    // Collapsing the sibling keeps the active group open.
    toggleOf("System").click();
    await settle();
    expect(container.textContent).toContain("Products");
    expect(container.textContent).not.toContain("General");
  });
});
