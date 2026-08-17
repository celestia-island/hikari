import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick, ref } from "vue";

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

function mountMenu(
  openRef = ref(true),
  menuItems: HkMenuItem[] = items,
  handlers: {
    onSelect?: (key: string) => void;
    onUpdateOpen?: (v: boolean) => void;
  } = {},
): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  containers.push(container);
  const Wrapper = defineComponent({
    setup() {
      return () =>
        h(HkMenu, {
          open: openRef.value,
          title: "Menu",
          items: menuItems,
          onSelect: handlers.onSelect,
          "onUpdate:open": (v: boolean) => {
            handlers.onUpdateOpen?.(v);
            openRef.value = v;
          },
        });
    },
  });
  const app = createApp(Wrapper);
  mounts.push(app);
  app.mount(container);
  return container;
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
  await until(() => window.history.state?.__hkMenuId === undefined);
  while (containers.length) containers.pop()?.remove();
  window.innerWidth = 1024;
});

describe("HkMenu", () => {
  it("renders the root rows when open and nothing when closed", () => {
    const c = mountMenu(ref(false));
    expect(c.textContent ?? "").toBe("");
    const c2 = mountMenu(ref(true));
    expect(c2.textContent ?? "").toContain("Language");
    expect(c2.textContent ?? "").toContain("Log out");
  });

  it("cascades into children on the desktop path and emits select on leaves", async () => {
    const selected: string[] = [];
    const closes: boolean[] = [];
    const openRef = ref(true);
    const container = mountMenu(openRef, items, {
      onSelect: (key) => selected.push(key),
      onUpdateOpen: (v) => closes.push(v),
    });
    await settle();

    const rows = Array.from(container.querySelectorAll(".hk-menu-row")) as HTMLButtonElement[];
    rows.find((r) => r.textContent?.includes("Language"))!.click();
    await settle();
    const panels = Array.from(container.querySelectorAll(".hk-menu-panel"));
    expect(panels.length).toBe(2);
    expect(panels[1].textContent).toContain("中文");

    const leaf = Array.from(panels[1].querySelectorAll(".hk-menu-row")).find(
      (r) => r.textContent?.includes("中文"),
    ) as HTMLButtonElement;
    leaf.click();
    await settle();
    expect(selected).toEqual(["zh"]);
    expect(closes.at(-1)).toBe(false);
  });

  it("switches the cascade when a sibling branch is clicked", async () => {
    const container = mountMenu(ref(true), siblingItems);
    await settle();

    const rowByLabel = (label: string) =>
      Array.from(container.querySelectorAll(".hk-menu-row")).find((r) =>
        r.textContent?.includes(label),
      ) as HTMLButtonElement;

    rowByLabel("Branch One").click();
    await settle();
    let panels = Array.from(container.querySelectorAll(".hk-menu-panel"));
    expect(panels.length).toBe(2);
    expect(panels[1].textContent).toContain("One A");

    // Clicking the sibling in the ROOT panel must replace the open submenu,
    // not nest under it.
    rowByLabel("Branch Two").click();
    await settle();
    panels = Array.from(container.querySelectorAll(".hk-menu-panel"));
    expect(panels.length).toBe(2);
    expect(panels[1].textContent).toContain("Two A");
    expect(panels[1].textContent).not.toContain("One A");
    const active = Array.from(container.querySelectorAll(".hk-menu-row[data-active]"));
    expect(active.length).toBe(1);
    expect(active[0].textContent).toContain("Branch Two");
  });

  it("switches submenu on sibling hover and collapses on leaf hover", async () => {
    const container = mountMenu(ref(true), siblingItems);
    await settle();

    const rootPanel = () => Array.from(container.querySelectorAll(".hk-menu-panel"))[0];
    const rowByLabel = (label: string) =>
      Array.from(rootPanel().querySelectorAll(".hk-menu-row")).find((r) =>
        r.textContent?.includes(label),
      ) as HTMLButtonElement;

    rowByLabel("Branch One").click();
    await settle();
    expect(Array.from(container.querySelectorAll(".hk-menu-panel")).length).toBe(2);

    rowByLabel("Branch Two").dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    await settle();
    const panels = Array.from(container.querySelectorAll(".hk-menu-panel"));
    expect(panels.length).toBe(2);
    expect(panels[1].textContent).toContain("Two A");

    // Hovering a plain leaf row in the root panel collapses deeper levels.
    const leafOnly = mountMenu(ref(true), [
      ...siblingItems,
      { key: "plain", label: "Plain Leaf" },
    ]);
    await settle();
    const rootRows2 = Array.from(
      Array.from(leafOnly.querySelectorAll(".hk-menu-panel"))[0].querySelectorAll(
        ".hk-menu-row",
      ),
    ) as HTMLButtonElement[];
    rootRows2.find((r) => r.textContent?.includes("Branch One"))!.click();
    await settle();
    expect(Array.from(leafOnly.querySelectorAll(".hk-menu-panel")).length).toBe(2);
    rootRows2
      .find((r) => r.textContent?.includes("Plain Leaf"))!
      .dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
    await settle();
    expect(Array.from(leafOnly.querySelectorAll(".hk-menu-panel")).length).toBe(1);
  });
});

describe("HkMenu mobile sheets", () => {
  it("opens one fullscreen sheet per level and back closes exactly one level", async () => {
    window.innerWidth = 390;
    const openRef = ref(true);
    const container = mountMenu(openRef, siblingItems);
    await settle();

    // Root sheet only, with its own history entry.
    let sheets = Array.from(container.querySelectorAll(".hk-menu-sheet"));
    expect(sheets.length).toBe(1);
    expect(window.history.state?.__hkMenuDepth).toBe(0);

    // Enter the first branch → two stacked sheets + a new history entry.
    const branchRow = Array.from(container.querySelectorAll(".hk-menu-row")).find((r) =>
      r.textContent?.includes("Branch One"),
    ) as HTMLButtonElement;
    branchRow.click();
    await settle();
    sheets = Array.from(container.querySelectorAll(".hk-menu-sheet"));
    expect(sheets.length).toBe(2);
    expect(window.history.state?.__hkMenuDepth).toBe(1);

    // Browser/system back closes ONE level: back to the root sheet.
    window.history.back();
    await settle();
    sheets = Array.from(container.querySelectorAll(".hk-menu-sheet"));
    expect(sheets.length).toBe(1);
    expect(openRef.value).toBe(true);
    expect(window.history.state?.__hkMenuDepth).toBe(0);

    // Back from the root closes the menu entirely.
    window.history.back();
    await settle();
    expect(openRef.value).toBe(false);
    expect(container.querySelector(".hk-menu-sheet")).toBeNull();
    expect(window.history.state?.__hkMenuId).toBeUndefined();
  });

  it("keeps the root sheet when a pushed level is dismissed via its back button", async () => {
    window.innerWidth = 390;
    const openRef = ref(true);
    const container = mountMenu(openRef, siblingItems);
    await settle();

    const branchRow = Array.from(container.querySelectorAll(".hk-menu-row")).find((r) =>
      r.textContent?.includes("Branch One"),
    ) as HTMLButtonElement;
    branchRow.click();
    await settle();
    expect(Array.from(container.querySelectorAll(".hk-menu-sheet")).length).toBe(2);

    const backBtn = Array.from(container.querySelectorAll(".hk-menu-sheet-back")).at(
      -1,
    ) as HTMLButtonElement;
    backBtn.click();
    await settle();
    expect(Array.from(container.querySelectorAll(".hk-menu-sheet")).length).toBe(1);
    expect(openRef.value).toBe(true);
    expect(window.history.state?.__hkMenuDepth).toBe(0);
  });

  it("selecting a leaf on mobile closes every sheet and restores history", async () => {
    window.innerWidth = 390;
    const selected: string[] = [];
    const openRef = ref(true);
    const container = mountMenu(openRef, siblingItems, {
      onSelect: (key) => selected.push(key),
    });
    await settle();

    const leafRow = Array.from(container.querySelectorAll(".hk-menu-row")).find((r) =>
      r.textContent?.includes("Branch Two"),
    ) as HTMLButtonElement;
    leafRow.click();
    await settle();
    const leaf = Array.from(container.querySelectorAll(".hk-menu-row")).find((r) =>
      r.textContent?.includes("Two B"),
    ) as HTMLButtonElement;
    leaf.click();
    await settle();

    expect(selected).toEqual(["two-b"]);
    expect(openRef.value).toBe(false);
    expect(container.querySelector(".hk-menu-sheet")).toBeNull();
    await until(() => window.history.state?.__hkMenuId === undefined);
    expect(window.history.state?.__hkMenuId).toBeUndefined();
  });

  it("follows live viewport changes without closing the menu", async () => {
    window.innerWidth = 390;
    const openRef = ref(true);
    const container = mountMenu(openRef, siblingItems);
    await settle();
    expect(container.querySelectorAll(".hk-menu-sheet").length).toBe(1);
    expect(window.history.state?.__hkMenuDepth).toBe(0);

    // Rotate/grow to desktop while open: sheets become desktop panels and
    // the pushed history entry is released — but the menu stays open.
    window.innerWidth = 1280;
    window.dispatchEvent(new Event("resize"));
    await settle();
    expect(openRef.value).toBe(true);
    expect(container.querySelectorAll(".hk-menu-sheet").length).toBe(0);
    expect(container.querySelectorAll(".hk-menu-panel").length).toBe(1);
    await until(() => window.history.state?.__hkMenuId === undefined);
    expect(window.history.state?.__hkMenuId).toBeUndefined();

    // Shrink back: the root sheet returns with a fresh root entry.
    window.innerWidth = 390;
    window.dispatchEvent(new Event("resize"));
    await settle();
    expect(openRef.value).toBe(true);
    expect(container.querySelectorAll(".hk-menu-sheet").length).toBe(1);
    expect(window.history.state?.__hkMenuDepth).toBe(0);
  });
});
