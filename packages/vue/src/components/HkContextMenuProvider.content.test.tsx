import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, nextTick, ref } from "vue";

import HkContextMenuProvider from "./HkContextMenuProvider";
import HkTagDotRow from "./HkTagDotRow";
import {
  useContextMenu,
  type ContextMenuApi,
} from "../composables/useContextMenu";

/** Mount into a detached div appended to the body (the menu panels
 *  teleport; assertions see them through document.querySelectorAll). */
function mountToDom(component: ReturnType<typeof defineComponent>): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  createApp(component).mount(el);
  return el;
}

const popouts = () =>
  Array.from(document.querySelectorAll(".hk-select-popout")) as HTMLElement[];

const menuRows = () =>
  Array.from(document.querySelectorAll(".hk-menu-row")) as HTMLButtonElement[];

const headSlot = () => document.querySelector(".hk-menu-slot--head");
const footSlot = () => document.querySelector(".hk-menu-slot--foot");

/** The provider host, exposing the injected API to the test. */
function makeHost(): { Component: ReturnType<typeof defineComponent>; api: () => ContextMenuApi } {
  let held: ContextMenuApi | null = null;
  const Inner = defineComponent({
    name: "ContentInner",
    setup() {
      held = useContextMenu();
      return () => <button class="open-btn">open</button>;
    },
  });
  const Component = defineComponent({
    name: "ContentHost",
    setup() {
      return () => (
        <HkContextMenuProvider>
          <Inner />
        </HkContextMenuProvider>
      );
    },
  });
  return { Component, api: () => held! };
}

afterEach(() => {
  document
    .querySelectorAll(
      ".hk-select-popout, .hk-select-sheet-panel, .hk-select-sheet-scrim, .open-btn",
    )
    .forEach((el) => el.remove());
  window.history.replaceState(null, "");
});

/** nextTick + a macrotask + nextTick — panels mount/unmount through
 *  transitions and history, so a single nextTick races them. */
async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/** Wait until pred() holds (panel teardown settles asynchronously). */
async function until(pred: () => boolean, ms = 500): Promise<void> {
  const deadline = Date.now() + ms;
  while (!pred() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
}

describe("HkContextMenuProvider — custom content regions", () => {
  it("renders header and footer regions around the item rows", async () => {
    const { Component, api } = makeHost();
    mountToDom(Component);
    api().open({
      x: 100,
      y: 80,
      title: "Menu",
      items: [{ key: "copy", label: "Copy" }],
      header: () => (
        <HkTagDotRow
          tags={[{ key: "red", color: "#e5484d", label: "Red", active: true }]}
          label="tags"
          onToggle={() => {}}
        />
      ),
      footer: () => <div class="content-foot">F</div>,
      onSelect: () => {},
      onClose: () => {},
    });
    await settle();
    expect(popouts()).toHaveLength(1);

    // The header hosts the tag strip; the footer its own node.
    expect(headSlot()?.querySelector(".hk-tag-dot")).toBeTruthy();
    expect(footSlot()?.querySelector(".content-foot")).toBeTruthy();

    // Band order: header region → item rows → footer region.
    const level = document.querySelector(".hk-menu-level")!;
    const kinds = Array.from(level.children).map((el) =>
      el.classList.contains("hk-menu-slot") && el.classList.contains("hk-menu-slot--head")
        ? "head"
        : el.classList.contains("hk-menu-slot") && el.classList.contains("hk-menu-slot--foot")
          ? "foot"
          : "row",
    );
    expect(kinds).toEqual(["head", "row", "foot"]);
  });

  it("keeps the menu open across clicks inside the header region", async () => {
    const picked: string[] = [];
    const closed = vi.fn();
    const { Component, api } = makeHost();
    mountToDom(Component);
    api().open({
      x: 100,
      y: 80,
      title: "Menu",
      items: [{ key: "copy", label: "Copy" }],
      header: () => (
        <HkTagDotRow
          tags={[
            { key: "red", color: "#e5484d", label: "Red" },
            { key: "yellow", color: "#ffd400", label: "Yellow" },
          ]}
          label="tags"
          onToggle={() => {}}
        />
      ),
      onSelect: (key) => picked.push(key),
      onClose: closed,
    });
    await settle();
    const dot = document.querySelector(".hk-tag-dot") as HTMLButtonElement;
    dot.click();
    await settle();
    // An inside-region click toggles, it never dismisses…
    expect(popouts()).toHaveLength(1);
    expect(picked).toEqual([]);
    expect(closed).not.toHaveBeenCalled();
    // …and an item pick after it still resolves normally.
    menuRows()[0].click();
    await settle();
    expect(picked).toEqual(["copy"]);
    await until(() => popouts().length === 0);
  });

  it("keeps the header region live while the menu is open", async () => {
    const { Component, api } = makeHost();
    mountToDom(Component);
    const count = ref(0);
    api().open({
      x: 100,
      y: 80,
      items: [{ key: "copy", label: "Copy" }],
      header: () => <div class="content-hdr">n{count.value}</div>,
      onSelect: () => {},
      onClose: () => {},
    });
    await settle();
    expect(headSlot()?.textContent).toContain("n0");
    count.value = 3;
    await settle();
    expect(headSlot()?.textContent).toContain("n3");
  });

  it("renders no region wrappers when the request carries none", async () => {
    const { Component, api } = makeHost();
    mountToDom(Component);
    api().open({
      x: 100,
      y: 80,
      items: [{ key: "copy", label: "Copy" }],
      onSelect: () => {},
      onClose: () => {},
    });
    await settle();
    expect(popouts()).toHaveLength(1);
    expect(headSlot()).toBeNull();
    expect(footSlot()).toBeNull();
    expect(menuRows()).toHaveLength(1);
    api().close();
    await until(() => popouts().length === 0);
  });

  it("swaps the regions when a second open replaces the menu", async () => {
    const { Component, api } = makeHost();
    mountToDom(Component);
    api().open({
      x: 100,
      y: 80,
      items: [{ key: "a", label: "A" }],
      header: () => <div class="content-a">A</div>,
      onSelect: () => {},
      onClose: () => {},
    });
    await settle();
    expect(headSlot()?.querySelector(".content-a")).toBeTruthy();
    api().open({
      x: 120,
      y: 90,
      items: [{ key: "b", label: "B" }],
      header: () => <div class="content-b">B</div>,
      onSelect: () => {},
      onClose: () => {},
    });
    await settle();
    // The epoch remount drops the stale region and its rows wholesale.
    expect(headSlot()?.querySelector(".content-a")).toBeNull();
    expect(headSlot()?.querySelector(".content-b")).toBeTruthy();
    expect(menuRows().map((r) => r.textContent)).toEqual(["B"]);
    api().close();
    await until(() => popouts().length === 0);
  });
});
