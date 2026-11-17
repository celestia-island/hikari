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

  // ── A dependency-free CSS reader ──────────────────────────────────────
  // Text scraping cannot answer the questions these contracts ask (which
  // RULE wins the cascade, whether a SHORTHAND set a width, whether a
  // later rule overrides the base one), so the compiled sheet is walked
  // into rules + declarations in DOCUMENT order. Quotes, comments and
  // parentheses are tracked while scanning, so a comma inside `var(...)`
  // or `color-mix(...)` never splits a value.

  interface CssRule {
    selector: string;
    declarations: Array<[string, string]>;
  }

  /** Split a declaration list on `;` outside quotes/parentheses. */
  function splitDeclarations(body: string): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    let current = "";
    let quote = "";
    let depth = 0;
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i];
      if (ch === "/" && body[i + 1] === "*") {
        const end = body.indexOf("*/", i + 2);
        i = end < 0 ? body.length : end + 2;
        continue;
      }
      if (quote) {
        current += ch;
        if (ch === "\\") {
          current += body[i + 1] ?? "";
          i += 1;
        } else if (ch === quote) {
          quote = "";
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        current += ch;
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === ";" && depth === 0) {
        const at = current.indexOf(":");
        if (at > 0) {
          out.push([
            current.slice(0, at).trim().toLowerCase(),
            current.slice(at + 1).trim(),
          ]);
        }
        current = "";
        continue;
      }
      current += ch;
    }
    const at = current.indexOf(":");
    if (at > 0) {
      out.push([current.slice(0, at).trim().toLowerCase(), current.slice(at + 1).trim()]);
    }
    return out;
  }

  /** Every style rule in the sheet, in document order (at-rule bodies are
   *  walked too, so a media override is graded like any other rule). */
  function parseRules(source: string): CssRule[] {
    const rules: CssRule[] = [];
    let i = 0;
    while (i < source.length) {
      if (/\s/.test(source[i])) {
        i += 1;
        continue;
      }
      if (source[i] === "/" && source[i + 1] === "*") {
        const end = source.indexOf("*/", i + 2);
        i = end < 0 ? source.length : end + 2;
        continue;
      }
      // Prelude: up to the `{` that opens this block — or up to a `;`, which
      // means this is a statement at-rule (`@charset "UTF-8";` opens the
      // sheet) and has no body to read.
      let j = i;
      let quote = "";
      let paren = 0;
      let statement = false;
      while (j < source.length) {
        const ch = source[j];
        if (quote) {
          if (ch === "\\") j += 1;
          else if (ch === quote) quote = "";
          j += 1;
          continue;
        }
        // Comments are skipped HERE too: prose like "the item's leading
        // side" is an apostrophe to a naive scanner, which then swallows the
        // rest of the sheet as a string.
        if (ch === "/" && source[j + 1] === "*") {
          const end = source.indexOf("*/", j + 2);
          j = end < 0 ? source.length : end + 2;
          continue;
        }
        if (ch === '"' || ch === "'") {
          quote = ch;
          j += 1;
          continue;
        }
        if (ch === "(") paren += 1;
        else if (ch === ")") paren -= 1;
        else if (ch === "{" && paren === 0) break;
        else if (ch === ";" && paren === 0) {
          statement = true;
          break;
        } else if (ch === "}" && paren === 0) {
          j += 1;
          statement = true;
          break;
        }
        j += 1;
      }
      if (j >= source.length) break;
      if (statement) {
        i = j + 1;
        continue;
      }
      const prelude = source.slice(i, j).trim();
      // Body: balanced braces.
      let k = j + 1;
      let depth = 1;
      let bodyQuote = "";
      let bodyParen = 0;
      while (k < source.length && depth > 0) {
        const ch = source[k];
        if (ch === "/" && source[k + 1] === "*") {
          const end = source.indexOf("*/", k + 2);
          k = end < 0 ? source.length : end + 2;
          continue;
        }
        if (bodyQuote) {
          if (ch === "\\") k += 1;
          else if (ch === bodyQuote) bodyQuote = "";
          k += 1;
          continue;
        }
        if (ch === '"' || ch === "'") {
          bodyQuote = ch;
          k += 1;
          continue;
        }
        if (ch === "(") bodyParen += 1;
        else if (ch === ")") bodyParen -= 1;
        else if (ch === "{" && bodyParen === 0) depth += 1;
        else if (ch === "}" && bodyParen === 0) depth -= 1;
        if (depth === 0) break;
        k += 1;
      }
      const body = source.slice(j + 1, k);
      if (prelude.startsWith("@")) {
        rules.push(...parseRules(body));
      } else if (prelude) {
        rules.push({ selector: prelude, declarations: splitDeclarations(body) });
      }
      i = k + 1;
    }
    return rules;
  }

  const rules = parseRules(css);

  /** The declarations that apply to an exact selector, in cascade order. */
  function declarationsFor(selector: string): Array<[string, string]> {
    return rules
      .filter((r) => r.selector.split(",").some((one) => one.trim() === selector))
      .flatMap((r) => r.declarations);
  }

  /** Property → the LAST value declared for it (what the cascade uses). */
  function computedFor(selector: string): Map<string, string> {
    const map = new Map<string, string>();
    for (const [prop, value] of declarationsFor(selector)) map.set(prop, value);
    return map;
  }

  const TAB = ".hk-selection-grid[data-edge] .hk-selection-grid-item[data-selected]::before";
  const ITEM = ".hk-selection-grid-item";
  const SELECTED = ".hk-selection-grid-item[data-selected]";

  it("detaches the accent tab from the selected frame", () => {
    // Flush (`0`), the bar merged with the 1px border and the 1px inset ring
    // into one unbroken primary slab on the leading edge — the reported
    // defect. Exact values, so a zeroed FALLBACK cannot pass either.
    const tab = computedFor(TAB);
    expect(tab.get("position")).toBe("absolute");
    expect(tab.get("inset-inline-start")).toBe("var(--space-4, 0.25rem)");
    expect(tab.get("top")).toBe("var(--space-4, 0.25rem)");
    expect(tab.get("bottom")).toBe("var(--space-4, 0.25rem)");
  });

  it("draws the tab 3px wide with pill ends", () => {
    // The width IS the clearance budget: the leading padding is 12px (10px
    // dense), so a wider bar eats into the label and a zero width renders
    // the feature away. `width` is read as a PROPERTY, so `max-width: 3px`
    // (which computes to nothing) cannot satisfy it.
    const tab = computedFor(TAB);
    expect(tab.get("width")).toBe("3px");
    expect(tab.get("border-radius")).toBe("var(--radius-full, 9999px)");
  });

  it("keeps the selected frame a uniform ring, never thicker on one side", () => {
    // The ring is the frame's ONLY emphasis; the tab is the accent. The
    // reported lopsidedness came from a SINGLE side getting thicker, so it
    // is pinned from three directions:
    //  (a) no declaration anywhere in the sheet targets one border side —
    //      shorthand or `-width`, logical or physical, all of them;
    const sideTargeted = rules
      .flatMap((r) => r.declarations)
      .map(([prop]) => prop)
      .filter((prop) => /^border(-(inline|block))?-(start|end|left|right|top|bottom)(-|$)/.test(prop));
    expect(sideTargeted).toEqual([]);
    //  (b) the frame's thickness is the one shorthand, and any explicit
    //      `border-width` (item or state) is UNIFORM across the four sides;
    expect(computedFor(ITEM).get("border")).toMatch(/^1px solid /);
    for (const rule of rules) {
      for (const [prop, value] of rule.declarations) {
        if (prop !== "border-width") continue;
        const sides = value.split(/\s+/);
        expect(new Set(sides).size, `uniform border-width in ${rule.selector}: ${value}`).toBe(1);
      }
    }
    //  (c) the selected state's emphasis is ONE inset ring, never a layer
    //      list that could add a second shadow on one side.
    const shadow = computedFor(SELECTED).get("box-shadow") ?? "";
    const layers: string[] = [];
    let current = "";
    let depth = 0;
    for (const ch of shadow) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (ch === "," && depth === 0) {
        layers.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) layers.push(current.trim());
    expect(layers).toHaveLength(1);
    expect(layers[0]).toMatch(/^inset 0 0 0 1px/);
  });
});
