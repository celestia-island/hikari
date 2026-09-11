/**
 * Source contract: ONE SCROLLBAR PER WINDOW (the HkAffixPicker contract,
 * 2026-09-08 user report — the language sheet showed two nested
 * scrollbars). HkTagInput's panel lists EVERY option with an always-open
 * toggling list, so it is exactly the shape that invites a second
 * `max-height: 17rem; overflow: auto` row region. It has none: the
 * HkSelectPanel window surface (desktop popout / mobile sheet) owns THE
 * single scrollbar and scrolls the search field with the rows as one.
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

  it("the component mounts no overlay scrollbar machinery", () => {
    expect(tsx).not.toContain("attachOverlayScrollbars");
    expect(tsx).not.toContain("OverlayScrollbarHandle");
    // No inline clamp on the row list either (the prose in the file
    // mentions `max-height` in the contract comment, so this pins the
    // style property spelling instead of the words).
    expect(tsx).not.toContain("maxHeight");
    expect(tsx).not.toContain("overflowY");
  });
});
