/**
 * Source contract: ONE SCROLLBAR PER WINDOW (the HkAffixPicker contract,
 * 2026-09-08 user report — the language sheet showed two nested
 * scrollbars). HkTagInput's panel lists EVERY option with an always-open
 * toggling list, so it is exactly the shape that invites a second
 * `max-height: 17rem; overflow: auto` row region. It has none: the
 * HkSelectPanel window surface (desktop popout / mobile sheet) owns THE
 * single scrollbar and scrolls the search field with the rows as one.
 *
 * The 2026-09-11 geometry wave leans on the same contract from the other
 * side: the field used to hand the panel its own width (`matchAnchorWidth`,
 * a full-width settings column) while the catalog caps at 19rem, leaving an
 * empty band and a scrollbar parked far from the rows. The panel now hugs
 * its own measure, and the catalog scrolls because the SURFACE is capped
 * (`maxHeight` → the --hk-select-panel-max-height hook) — never because the
 * row list grew a scroll region of its own.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkTagInput.scss"), "utf-8");
const tsx = readFileSync(join(here, "HkTagInput.tsx"), "utf-8");

/** Extract ONE balanced `{...}` declaration block following the given
 *  selector — a naive `[^}]*` would stop at the first nested `}` and let
 *  properties appended after a future nested block evade the pin. */
function cssBlock(src: string, selector: string): string {
  const at = src.indexOf(selector);
  expect(at, `${selector} block exists`).toBeGreaterThanOrEqual(0);
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

/** The JSX opening tag that carries `marker` (attributes only, no
 *  children) — the pin below is about what ONE element declares. */
function jsxOpeningTag(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect(at, `${marker} is rendered`).toBeGreaterThanOrEqual(0);
  return src.slice(src.lastIndexOf("<", at), src.indexOf(">", at) + 1);
}

function expectNoScroll(block: string, what: string): void {
  expect(block, `${what} block exists`).toBeTruthy();
  expect(block).not.toMatch(/max-height/);
  expect(block).not.toMatch(/overflow/);
  expect(block).not.toMatch(/scrollbar-width/);
}

describe("HkTagInput single-scrollbar-per-window contract", () => {
  it("the row list carries no max-height and no overflow of its own", () => {
    expectNoScroll(cssBlock(scss, ".hk-tag-input-list"), ".hk-tag-input-list");
  });

  it("the panel is a width container, not a scroll region", () => {
    const block = cssBlock(scss, ".hk-tag-input-panel");
    expectNoScroll(block, ".hk-tag-input-panel");
    expect(block).not.toMatch(/position\s*:/);
  });

  it("the mobile sheet centers the designed measure instead of gluing it left", () => {
    const block =
      scss.match(/\.hk-select-sheet-panel \.hk-tag-input-panel\s*{[^}]*}/)?.[0] ?? "";
    expect(block, "sheet descendant block exists").toBeTruthy();
    expect(block).toContain("max-width: min(19rem, 100%)");
    expect(block).toContain("margin-inline: auto");
    expectNoScroll(block, ".hk-select-sheet-panel .hk-tag-input-panel");
  });

  it("the component mounts no overlay scrollbar machinery and clamps no row region", () => {
    expect(tsx).not.toContain("attachOverlayScrollbars");
    expect(tsx).not.toContain("OverlayScrollbarHandle");
    expect(tsx).not.toContain("overflowY");
    // The ONLY max-height in the file belongs to the panel SURFACE prop
    // (the very next test): the listbox element itself stays unpinned, so
    // the window keeps the one scroll region.
    const listEl = jsxOpeningTag(tsx, 'class="hk-tag-input-list"');
    expect(listEl.startsWith("<div")).toBe(true);
    expect(listEl).not.toMatch(/style=/);
    expect(listEl).not.toMatch(/maxHeight|max-height|overflow/);
  });

  it("hugs its own measure, and scrolls by capping the SURFACE (an additive prop)", () => {
    const panel = jsxOpeningTag(tsx, "<HkSelectPanel");
    // The field's width is not the panel's width any more…
    expect(panel).toContain("matchAnchorWidth={false}");
    // …and the catalog scrolls inside a capped surface instead of growing
    // to the stylesheet ceiling.
    expect(panel).toContain('maxHeight="min(18rem, 45dvh)"');
    // The cap is the shared panel's own hook, and it is ADDITIVE: the
    // historic ceiling stays the fallback, so every other consumer of
    // HkSelectPanel renders exactly as before.
    const panelScss = readFileSync(join(here, "HkSelect.scss"), "utf-8");
    // The hook rides the dvh-capable branch: on an engine without dvh the
    // plain-vh ceiling above it stays the cap — a var()-substituted dvh
    // value would be invalid at computed-value time and mean "no cap".
    const popout = panelScss.slice(
      panelScss.indexOf(".hk-select-popout {"),
      panelScss.indexOf(".hk-select-option"),
    );
    // …and the block's POSITION is load-bearing: the hook must come after
    // both literal ceilings, or the dvh-capable branch would override them
    // with its own fallback and the consumer cap would never apply.
    expect(popout).toContain("@supports (height: 1dvh)");
    expect(popout.indexOf("@supports")).toBeGreaterThan(
      popout.indexOf("max-height: max(240px, min(36rem, calc(100vh - 32px)));"),
    );
    expect(popout.indexOf("@supports")).toBeGreaterThan(
      popout.lastIndexOf("max-height: max(240px, min(36rem, calc(100dvh - 32px)));"),
    );
    expect(popout).toMatch(
      /max-height:\s*var\(\s*--hk-select-panel-max-height,\s*max\(240px, min\(36rem, calc\(100dvh - 32px\)\)\)\s*\)/,
    );
    expect(popout).toContain("max-height: max(240px, min(36rem, calc(100vh - 32px)));");
    // The sheet band the same prop caps falls back to being uncapped — the
    // property's own initial value, i.e. today's behaviour.
    expect(panelScss).toMatch(
      /max-height:\s*var\(--hk-select-panel-max-height,\s*none\)/,
    );
    const panelTsx = readFileSync(join(here, "HkSelectPanel.tsx"), "utf-8");
    expect(panelTsx).toContain("maxHeight: { type: String, default: undefined }");
  });

  it("animates both lists through the shared list transition (FLIP move)", () => {
    const groups = [...tsx.matchAll(/<HkListTransition\b[^>]*>/g)].map((m) => m[0]);
    expect(groups, "the chips and the rows are both transition groups").toHaveLength(2);
    for (const group of groups) {
      expect(group).toContain('variant="reveal"');
      expect(group).toMatch(/\bmove\b/);
      // A fragment tag: the group adds no wrapper element, so the chips
      // stay the field's own flex items and the rows stay the listbox's
      // own children.
      expect(group).toContain('tag=""');
    }
  });
});
