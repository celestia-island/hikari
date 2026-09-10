import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";

import HkSelectionGrid, { type SelectionGridItem } from "./HkSelectionGrid";

/**
 * HkSelectionGrid contract tests:
 * - single mode keys the lit state off `selectedId` and lights exactly one card
 * - multi mode keys it off `selectedIds` membership and lights every listed id
 * - multi mode never lets `selectedId` leak through (the two selectors stay
 *   independent, so a stale single id cannot double-light a card)
 * - `select` fires for already-selected cards too — the consumer owns the
 *   toggle, the grid only reports the click
 * - the optional `hint` renders under the grid and is absent when unset
 *
 * House style: raw createApp mounts on a shared container list torn down
 * after each case; DOM assertions via document queries.
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
});

const ITEMS: SelectionGridItem[] = [
  { id: "text", title: "Text" },
  { id: "vision", title: "Vision" },
  { id: "gen", title: "Generation" },
];

function cards(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(".hk-selection-grid-item"));
}

function litIds(container: HTMLElement) {
  return cards(container)
    .filter((el) => el.hasAttribute("data-selected"))
    .map((el) => el.querySelector(".hk-selection-grid-name")?.textContent);
}

describe("HkSelectionGrid single mode", () => {
  it("lights only the card matching selectedId", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS, selectedId: "vision" }));
    expect(litIds(container)).toEqual(["Vision"]);
  });

  it("lights nothing when selectedId is undefined", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS }));
    expect(litIds(container)).toEqual([]);
  });

  it("ignores selectedIds unless multi is on", () => {
    const container = mount(
      h(HkSelectionGrid, { items: ITEMS, selectedIds: ["text", "gen"], selectedId: "vision" }),
    );
    expect(litIds(container)).toEqual(["Vision"]);
  });
});

describe("HkSelectionGrid multi mode", () => {
  it("lights every id listed in selectedIds", () => {
    const container = mount(
      h(HkSelectionGrid, { items: ITEMS, multi: true, selectedIds: ["text", "gen"] }),
    );
    expect(litIds(container)).toEqual(["Text", "Generation"]);
  });

  it("lights nothing when selectedIds is empty", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS, multi: true }));
    expect(litIds(container)).toEqual([]);
  });

  it("does not read selectedId while multi is on", () => {
    const container = mount(
      h(HkSelectionGrid, { items: ITEMS, multi: true, selectedIds: ["gen"], selectedId: "text" }),
    );
    expect(litIds(container)).toEqual(["Generation"]);
  });

  it("emits select for an already-selected card so the consumer can toggle it off", () => {
    const seen: string[] = [];
    const container = mount(
      h(HkSelectionGrid, {
        items: ITEMS,
        multi: true,
        selectedIds: ["vision"],
        onSelect: (item: SelectionGridItem) => seen.push(item.id),
      }),
    );
    cards(container)[1]!.click();
    expect(seen).toEqual(["vision"]);
  });
});

describe("HkSelectionGrid hint", () => {
  it("renders the hint line under the grid when provided", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS, hint: "Pick one or more" }));
    const hint = container.querySelector(".hk-selection-grid-hint");
    expect(hint?.textContent).toBe("Pick one or more");
  });

  it("renders no hint node when the prop is unset", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS }));
    expect(container.querySelector(".hk-selection-grid-hint")).toBeNull();
  });
});
