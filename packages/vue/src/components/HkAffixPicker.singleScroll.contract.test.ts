/**
 * Source contract: ONE SCROLLBAR PER WINDOW (2026-09-08 user report —
 * the localized input's language sheet showed two nested scrollbars:
 * the HkSelectPanel sheet's own AND the affix picker's 17rem-capped row
 * list scrolling inside it). Principle: every window has exactly ONE
 * scrollbar serving the window's own content; a second scroll level
 * belongs in a sub-window, never an inline embed. HkAffixPicker's popup
 * therefore mounts no scroll region of its own — the window surface
 * (desktop popout / mobile sheet) scrolls tags + search + rows as one.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkAffixPicker.scss"), "utf-8");
const tsx = readFileSync(join(here, "HkAffixPicker.tsx"), "utf-8");

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

function expectNoScroll(block: string, what: string): void {
  expect(block, `${what} block exists`).toBeTruthy();
  expect(block).not.toMatch(/max-height/);
  expect(block).not.toMatch(/overflow/);
  expect(block).not.toMatch(/scrollbar-width/);
}

describe("HkAffixPicker single-scrollbar-per-window contract", () => {
  it("the row list carries no max-height and no overflow of its own", () => {
    expectNoScroll(cssBlock(scss, ".hk-affix-list"), ".hk-affix-list");
  });

  it("the width container is neither a scroll region nor a track host", () => {
    const block = cssBlock(scss, ".hk-affix-scroll");
    expectNoScroll(block, ".hk-affix-scroll");
    // The old overlay-rail host role is gone — nothing needs a
    // positioning context anymore.
    expect(block).not.toMatch(/position\s*:/);
    // Defense in depth: the mobile-sheet descendant override (width/
    // centering only) must never grow a scroll region either.
    const sheetBlock = cssBlock(
      scss.slice(scss.indexOf(".hk-select-sheet-panel .hk-affix-scroll")),
      ".hk-affix-scroll",
    );
    expect(sheetBlock, "sheet descendant block exists").toBeTruthy();
    expectNoScroll(sheetBlock, ".hk-select-sheet-panel .hk-affix-scroll");
  });

  it("the popup mounts no overlay scrollbar machinery", () => {
    expect(tsx).not.toContain("attachOverlayScrollbars");
    expect(tsx).not.toContain("OverlayScrollbarHandle");
  });
});
