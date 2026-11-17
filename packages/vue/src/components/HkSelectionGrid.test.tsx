import { afterEach, describe, expect, it } from "vitest";
import { createApp, h } from "vue";
import { readFileSync } from "node:fs";
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

  /** Split a comma-separated CSS value into layers, ignoring commas nested
   *  inside a function (`color-mix(in srgb, …)`, `var(--x, …)`). */
  function splitLayers(value: string): string[] {
    const layers: string[] = [];
    let current = "";
    let depth = 0;
    for (const ch of value) {
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
    return layers;
  }

  // FALSE REDS ARE THE INTENDED FAILURE MODE. These pins are source-level
  // allowlists, so a legitimate edit can trip one — tinting a border
  // (`border-inline-color`), adding a corner radius longhand, a gradient
  // icon inside the item, moving the inset to a wider token, a second
  // pseudo-element; removing the selected ring outright
  // (`box-shadow: none`). Each fails LOUDLY and names the property/rule; the
  // fix is to update this contract in the same commit as the design change,
  // not to loosen the pin. A silent green is the failure this file exists to
  // prevent. The one deliberate ACCEPT: a shadow layer whose blur could come
  // from a `var()` is not judged — static analysis cannot prove it a hard
  // edge, and a false green there is cheaper than policing every elevation.
  const TAB = ".hk-selection-grid[data-edge] .hk-selection-grid-item[data-selected]::before";
  const ITEM = ".hk-selection-grid-item";
  const SELECTED = ".hk-selection-grid-item[data-selected]";

  /** Rules whose selector list can match an element carrying `token`
   *  (`data-selected` here), in document order.
   *
   *  A source-level pin has to look at EVERY rule that can match the element,
   *  not just the one canonical spelling — otherwise a higher-specificity
   *  descendant selector or a `::after` clone overrides the canonical rule in
   *  the browser while this file stays green. Matching is therefore on the
   *  ATTRIBUTE TOKEN, not the whole compound: `:is([data-selected])`,
   *  `[data-selected="true"]`, `[data-selected] .child` and the plain form
   *  all carry it, and all of them can restyle a selected item. */
  function rulesTouching(token: string): CssRule[] {
    // `i` + a lowercased subject: HTML attribute NAMES are ASCII
    // case-insensitive, so `[Data-Selected]` styles the same element.
    const needle = new RegExp(`\\[${token}(?![a-z-])`, "i");
    return rules.filter((r) =>
      r.selector.split(",").some((one) => needle.test(one.toLowerCase())),
    );
  }

  /** Rules that name the component's item at all (any state). */
  function rulesNaming(needle: string): CssRule[] {
    return rules.filter((r) =>
      r.selector.split(",").some((one) => one.includes(needle)),
    );
  }

  /** Normalized form of one compound selector: `:before` and `::before` are
   *  the same pseudo-element in CSS, so they are compared as one. */
  function normalized(selector: string): string {
    return selector.replace(/\s+/g, " ").trim().replace(/(^|[^:]):(before|after)\b/g, "$1::$2");
  }

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

  it("draws exactly one 3px pill, and it is the only tab on the item", () => {
    // The width IS the clearance budget: the leading padding is 12px (10px
    // dense), so a wider bar eats into the label and a zero width renders
    // the feature away. `width` is read as a PROPERTY, so `max-width: 3px`
    // (which computes to nothing) cannot satisfy it.
    const tab = computedFor(TAB);
    expect(tab.get("width")).toBe("3px");
    expect(tab.get("border-radius")).toBe("var(--radius-full, 9999px)");
    // …and it has to be DRAWN: a transparent or display-less tab renders
    // nothing while every geometry value above still reads correctly.
    expect(tab.get("content")).toBe('""');
    expect(tab.get("display")).toBeUndefined();
    expect(tab.get("background")).toBe("var(--hi-color-primary, #7aa2f7)");
    // Exactly ONE pseudo-element draws on a selected item. A second tab
    // (a `::after` clone, or the single-colon spelling, or a `:hover`
    // variant) would paint a competing bar the geometry pins never see.
    const tabs = rulesTouching("data-selected")
      .filter((r) => /::?(before|after)\b/.test(r.selector))
      .map((r) => normalized(r.selector));
    expect(tabs).toEqual([normalized(TAB)]);
    // The tab's declaration set is closed: no extra `inset`/`margin`/
    // `translate`/`rotate` may move or resize it behind the pins' back.
    expect(new Set(Object.keys(Object.fromEntries(declarationsFor(TAB))))).toEqual(
      new Set([
        "content",
        "position",
        "inset-inline-start",
        "top",
        "bottom",
        "width",
        "border-radius",
        "background",
      ]),
    );
  });

  it("declares no per-side border geometry anywhere in the sheet", () => {
    // THIS IS A SOURCE-LEVEL PIN, not a rendering proof, and its scope is
    // "no single SIDE may get thicker". It keeps the frame's thickness coming
    // from ONE uniform `border` shorthand plus the selected ring and rejects
    // every per-side border property by NAME — a whitelist, because
    // enumerating the shapes a side could be thickened through (`-width`, the
    // axis shorthands, `border-left`, …) misses one every round.
    //
    // Out of scope on purpose: a UNIFORM thickening of the whole frame
    // (`outline: 2px solid` with a negative offset, or a 3px `border` on the
    // selected state) is a design change, not this defect — the other pins
    // still hold the ring and the tab. Which four sides the browser really
    // paints was verified by pixel measurement during review (see the PR).
    const borderProps = new Set(
      rules
        .flatMap((r) => r.declarations)
        .map(([prop]) => prop)
        .filter((prop) => /^border(-|$)/.test(prop)),
    );
    expect([...borderProps].sort()).toEqual([
      "border",
      "border-color",
      "border-radius",
      "border-start-start-radius",
      "border-end-start-radius",
    ].filter((prop) => borderProps.has(prop)).sort());
    // The one width-bearing declaration is the item's shorthand, and the
    // selected state colours the border instead of resizing it.
    expect(computedFor(ITEM).get("border")).toMatch(/^1px solid /);
    expect(computedFor(SELECTED).get("border")).toBeUndefined();
    expect(computedFor(SELECTED).get("border-color")).toBe(
      "var(--hi-color-primary, #7aa2f7)",
    );
  });

  it("paints no image, no halo, and shadows no layout token, anywhere", () => {
    // SHEET-WIDE VALUE SCAN (case-insensitive — CSS function names are
    // ASCII case-insensitive, so `linear-Gradient(` is the same call). A
    // leading slab can be rebuilt through channels a border/box-shadow
    // whitelist never reads: a gradient via `background-image` OR via the
    // `background` SHORTHAND, OR parked in a custom property and consumed
    // through `var()`; a halo through `filter`/`backdrop-filter`
    // `drop-shadow`. None of those may appear anywhere in this sheet.
    const offenders: string[] = [];
    for (const rule of rules) {
      for (const [prop, value] of rule.declarations) {
        if (/(gradient|url|image-set)\(/i.test(value)) {
          offenders.push(`${rule.selector} → ${prop}: ${value}`);
        } else if (/drop-shadow\(/i.test(value)) {
          offenders.push(`${rule.selector} → ${prop}: ${value}`);
        } else if (/^--(space|radius)-/.test(prop)) {
          offenders.push(`${rule.selector} declares ${prop} (tokens live in scale.scss)`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the upstream spacing token wide enough for a visible gap", () => {
    // SCOPE, stated so it is not read as more than it is: this pins the
    // CANONICAL UPSTREAM token, not the rendered gap. The sheet may not
    // shadow the token (pinned above), so for a host that resolves the
    // sheet's own scale the two are the same fact; a consumer that
    // redefines `--space-4` on an ANCESTOR at runtime is outside this
    // file's reach and was measured in the review instead (the tab sits 5px
    // from the border box at the shipped 0.25rem).
    //
    // EVERY declaration of the token must clear the bar — a media-scoped
    // retune to 2px is as much a hairline gap as a base one, so "last one
    // wins" would be exactly the cascade-blindness this file exists to
    // prevent. The gap is `token − 1px` (the tab starts inside the 1px
    // border), so 2px leaves a 1px hairline: require 3px.
    const scale = readFileSync(resolve(here, "../scale.scss"), "utf8");
    // Strip block comments AND line comments; a commented mention must not
    // be what this reads.
    const source = scale
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/[^\n]*/g, "$1");
    const declared = [...source.matchAll(/--space-4:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(declared.length, "--space-4 must be declared upstream").toBeGreaterThan(0);
    for (const raw of declared) {
      const rem = raw.match(/^(-?[\d.]+)rem$/);
      const px = raw.match(/^(-?[\d.]+)px$/);
      expect(
        rem !== null || px !== null,
        `--space-4 must be a plain rem/px length to be checkable, got "${raw}"`,
      ).toBe(true);
      const resolved = rem ? Number.parseFloat(rem[1]) * 16 : Number.parseFloat(px![1]);
      expect(
        resolved,
        `--space-4 resolves to ${resolved}px (gap ${resolved - 1}px)`,
      ).toBeGreaterThanOrEqual(3);
    }
    // The pill's radius token must exist as well (the tab falls back to a
    // square cap without it, which reads as a different shape).
    expect(source).toMatch(/--radius-full:\s*[^;]+;/);
  });

  it("keeps the selected emphasis a single inset ring, and only there", () => {
    // One inset ring, split with a depth-aware scanner so a legitimate single
    // layer carrying `color-mix(...)` is not mistaken for two.
    const insetLayers = splitLayers(computedFor(SELECTED).get("box-shadow") ?? "").filter(
      (l) => /^inset\b/.test(l),
    );
    expect(insetLayers).toHaveLength(1);
    expect(insetLayers[0]).toMatch(/^inset 0 0 0 1px/);
    // EVERY shadow layer of EVERY rule that names the item is inspected, not
    // just the base selected rule: the reported state is a HOVERED selected
    // row, so a one-sided `inset 3px 0 0 3px` in `[data-selected]:hover`
    // reproduces the lopsidedness with the base rule untouched. Allowed
    // layers are exactly the two shapes the sheet really uses: the even 1px
    // inset ring, and non-inset elevation shadows.
    const offenders: string[] = [];
    for (const rule of rulesNaming(".hk-selection-grid-item")) {
      for (const [prop, value] of rule.declarations) {
        if (prop !== "box-shadow") continue;
        for (const layer of splitLayers(value)) {
          const inset = /^inset\b/.test(layer);
          if (inset) {
            if (!/^inset 0 0 0 1px /.test(layer)) {
              offenders.push(`${rule.selector} → ${layer}`);
            }
            continue;
          }
          // A NON-inset layer is elevation, and elevation has to be BLURRED
          // (or a uniform spread ring). A hard-edged one (`-3px 0 0 0 …`)
          // is a painted bar, and it can also displace the ring above:
          // `box-shadow` is one property, so a later rule wins outright even
          // though the canonical rule still reads correct on its own.
          // Analysis runs on the layer with every function group collapsed
          // (colors and var() contents gone), so a number inside `rgb(122
          // 162 247 …)` cannot pose as the blur length; a layer whose blur
          // could come from a `var()` is ACCEPTED — static analysis cannot
          // prove it a hard edge, and the loud side stays with provable
          // cases. `box-shadow: none` paints nothing.
          if (/^none$/i.test(layer.trim())) continue;
          // Collapse every function group to a marker, so a number inside
          // `rgb(122 162 247 …)` or a `var()` fallback cannot pose as a
          // length. `var()` keeps a marker (its CONTENT may be the blur),
          // any other function is simply gone.
          let stripped = layer;
          for (let prev = ""; prev !== stripped; ) {
            prev = stripped;
            stripped = stripped.replace(/\([^()]*\)/g, "()").replace(/\bvar\(\)/gi, "VAR");
          }
          const tokens = stripped
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t !== "" && t !== "()");
          const varAt = tokens.findIndex((t) => t.includes("VAR"));
          const numeric = (t: string) => /^-?[\d.]+(?:px|rem|em)?$/.test(t);
          // Judge only from the lengths BEFORE the first `var()` — past it,
          // a var may be the blur itself and static analysis cannot prove a
          // hard edge (that layer is then accepted, loudly documented here).
          const provable = varAt >= 0 ? tokens.slice(0, varAt) : tokens;
          const lengths = provable.filter(numeric);
          // Without a var() in play, two lengths are ALREADY a proof: CSS
          // defaults the blur to 0, so `2px 2px …` is a hard edge. A var()
          // in the blur slot is the only genuinely unjudgeable shape.
          if (varAt < 0 && lengths.length < 3) {
            offenders.push(`${rule.selector} → ${layer}`);
            continue;
          }
          if (lengths.length < 3) continue;
          const num = (t: string) => Number.parseFloat(t);
          const [x, y, blur, spread = 0] = lengths.slice(0, 4).map(num);
          const uniformSpreadRing = x === 0 && y === 0 && blur === 0 && spread > 0;
          if (!(blur > 0) && !uniformSpreadRing) {
            offenders.push(`${rule.selector} → ${layer}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
    // The selected state and its `:hover` sibling are the only two rules that
    // may carry an inset ring at all.
    const ringed = rulesNaming(".hk-selection-grid-item")
      .filter((r) =>
        r.declarations.some(
          ([prop, value]) => prop === "box-shadow" && /inset\b/.test(value),
        ),
      )
      .map((r) => normalized(r.selector))
      .sort();
    expect(ringed).toEqual(
      [normalized(SELECTED), normalized(`${SELECTED}:hover`)].sort(),
    );
  });
});
