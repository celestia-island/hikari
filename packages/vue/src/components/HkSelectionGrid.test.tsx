import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";
import { compile } from "sass";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
 * - `minItemWidth` flips the grid into adaptive floor mode: `data-fluid` +
 *   the floor as a CSS var, and NO `data-cols` hook (the narrow-viewport
 *   overrides key off data-cols and must not fight the fluid template)
 * - without `minItemWidth` the fixed `columns` contract is unchanged
 * - `selectedEdge`'s accent tab stays DETACHED from the selected frame
 *   (stylesheet contract below): flush against border + inset ring it
 *   merged into one fattened leading edge (fleet admission card, user
 *   report 2026-11-17)
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

describe("HkSelectionGrid adaptive floor mode (minItemWidth)", () => {
  function gridEl(container: HTMLElement) {
    return container.querySelector<HTMLElement>(".hk-selection-grid-grid")!;
  }

  it("switches the grid to fluid mode and publishes the floor as a CSS var", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS, minItemWidth: 240 }));
    const grid = gridEl(container);
    expect(grid.hasAttribute("data-fluid")).toBe(true);
    expect(grid.style.getPropertyValue("--hk-selection-grid-item-min")).toBe("240px");
  });

  it("owns the track template: no data-cols hook the narrow overrides could flip", () => {
    const container = mount(
      h(HkSelectionGrid, { items: ITEMS, minItemWidth: 240, columns: 4 }),
    );
    const grid = gridEl(container);
    expect(grid.hasAttribute("data-cols")).toBe(false);
  });

  it("stays in fixed-columns mode when minItemWidth is unset", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS, columns: 3 }));
    const grid = gridEl(container);
    expect(grid.hasAttribute("data-fluid")).toBe(false);
    expect(grid.getAttribute("data-cols")).toBe("3");
    expect(grid.style.getPropertyValue("--hk-selection-grid-item-min")).toBe("");
  });

  it("renders every item in fluid mode like in fixed mode", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS, minItemWidth: 240 }));
    expect(cards(container).length).toBe(ITEMS.length);
  });

  it("ignores floors that cannot form a track minimum (0 / negative / NaN)", () => {
    for (const bad of [0, -240, Number.NaN]) {
      const container = mount(
        h(HkSelectionGrid, { items: ITEMS, minItemWidth: bad, columns: 3 }),
      );
      const grid = gridEl(container);
      expect(grid.hasAttribute("data-fluid")).toBe(false);
      expect(grid.getAttribute("data-cols")).toBe("3");
    }
  });

describe("HkSelectionGrid list layout, actions and edge", () => {
  it("marks the root with the layout and edge hooks", () => {
    const container = mount(
      h(HkSelectionGrid, { items: ITEMS, layout: "list", selectedEdge: true }),
    );
    const root = container.querySelector(".hk-selection-grid")!;
    expect(root.getAttribute("data-layout")).toBe("list");
    expect(root.hasAttribute("data-edge")).toBe(true);
  });

  it("defaults to the grid layout with no edge", () => {
    const container = mount(h(HkSelectionGrid, { items: ITEMS }));
    const root = container.querySelector(".hk-selection-grid")!;
    expect(root.getAttribute("data-layout")).toBe("grid");
    expect(root.hasAttribute("data-edge")).toBe(false);
  });

  it("renders per-item trailing actions as labelled icon buttons", () => {
    const items: SelectionGridItem[] = [
      { id: "a", title: "A", actions: [{ id: "rm", label: "Remove" }] },
      { id: "b", title: "B" },
    ];
    const container = mount(h(HkSelectionGrid, { items }));
    const buttons = container.querySelectorAll(".hk-selection-grid-action");
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute("title")).toBe("Remove");
    expect(buttons[0].getAttribute("aria-label")).toBe("Remove");
    // Only the item that declared actions renders the actions cell.
    const rows = cards(container);
    expect(rows[0].querySelector(".hk-selection-grid-actions")).not.toBeNull();
    expect(rows[1].querySelector(".hk-selection-grid-actions")).toBeNull();
  });

  it("emits action without selecting the item (propagation stopped)", () => {
    const seen: Array<[string, string]> = [];
    const items: SelectionGridItem[] = [
      { id: "a", title: "A", actions: [{ id: "rm", label: "Remove" }] },
    ];
    const container = mount(
      h(HkSelectionGrid, {
        items,
        onSelect: (item: SelectionGridItem) => seen.push(["select", item.id]),
        onAction: (item: SelectionGridItem, action: { id: string }) =>
          seen.push(["action", `${item.id}:${action.id}`]),
      }),
    );
    (container.querySelector(".hk-selection-grid-action") as HTMLElement).click();
    expect(seen).toEqual([["action", "a:rm"]]);
  });

  it("suppresses the action emit when the action is disabled", () => {
    const seen: string[] = [];
    const items: SelectionGridItem[] = [
      { id: "a", title: "A", actions: [{ id: "rm", label: "Remove", disabled: true }] },
    ];
    const container = mount(
      h(HkSelectionGrid, {
        items,
        onAction: () => seen.push("action"),
      }),
    );
    const btn = container.querySelector(".hk-selection-grid-action") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(seen).toEqual([]);
  });
});
});

describe("HkSelectionGrid selected-edge stylesheet contract", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const css = compile(resolve(here, "HkSelectionGrid.scss"), { style: "expanded" }).css;
  const tab = /\.hk-selection-grid\[data-edge\] \.hk-selection-grid-item\[data-selected\]::before\s*\{/;

  it("detaches the accent tab from the selected frame", () => {
    // The tab must NOT sit flush at the leading edge: flush, it merged with
    // the border + inset ring into one ~5px slab (the fattened frame).
    expect(css.match(tab)?.[0]).toBeTruthy();
    expect(css.match(/::before\s*\{[^}]*\}/)?.[0]).toMatch(
      /inset-inline-start:\s*var\(--space-4/,
    );
  });

  it("insets the tab vertically so it reads as a tab, not a frame side", () => {
    const rule = css.match(/::before\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/top:\s*var\(--space-4/);
    expect(rule).toMatch(/bottom:\s*var\(--space-4/);
    expect(rule).toMatch(/border-radius:\s*var\(--radius-full/);
  });

  it("keeps the selected emphasis a uniform inset ring on every side", () => {
    // The ring is the frame; the tab is the accent. Neither may thicken a
    // single side of the frame (that asymmetry was the reported defect).
    expect(css).toMatch(
      /\.hk-selection-grid-item\[data-selected\]\s*\{[^}]*box-shadow:\s*inset 0 0 0 1px/,
    );
  });
});
