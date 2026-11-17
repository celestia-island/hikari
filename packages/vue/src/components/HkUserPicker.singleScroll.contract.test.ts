/**
 * Source contract: ONE SCROLLBAR PER WINDOW for the user picker's panel.
 *
 * The picker moved off HkModal onto the anchored HkSelectPanel surface
 * (2026-11 user direction). That surface owns the window and THE one
 * scrollbar (desktop popout / phone sheet's list band); the content column
 * this component renders inside it must therefore mount no scroll region
 * of its own — a second nested scrollbar inside the same window is the
 * contract violation the affix picker was reported for in 2026-09.
 *
 * The cap travels through HkSelectPanel's `maxHeight` prop (the surface
 * publishes it as `--hk-select-panel-max-height`), never as a local
 * max-height on our own band.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkUserPicker.scss"), "utf-8");
const tsx = readFileSync(join(here, "HkUserPicker.tsx"), "utf-8");

/** The balanced `{...}` block that FOLLOWS `at` — a naive `[^}]*` would
 *  stop at the first nested `}` and let properties appended after a future
 *  nested block evade the pin. */
function blockAt(src: string, at: number): string {
  const open = src.indexOf("{", at);
  expect(open, "selector block exists").toBeGreaterThanOrEqual(0);
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

/** EVERY rule whose selector text contains `selector` — a family that
 *  splits its declarations over several blocks (the shared content-column
 *  pair plus the panel-specific cap) must be clean in all of them. */
function blocksOf(src: string, selector: string): string[] {
  const out: string[] = [];
  let at = src.indexOf(selector);
  while (at >= 0) {
    out.push(blockAt(src, at));
    at = src.indexOf(selector, at + 1);
  }
  expect(out.length, `${selector} rule exists`).toBeGreaterThan(0);
  return out;
}

function expectNoScroll(src: string, selector: string): void {
  for (const block of blocksOf(src, selector)) {
    expect(block, `${selector} mounts no local cap`).not.toMatch(/max-height/);
    expect(block, `${selector} mounts no scroll region`).not.toMatch(/overflow/);
    expect(block, `${selector} mounts no scrollbar styling`).not.toMatch(/scrollbar-width/);
  }
}

describe("HkUserPicker single-scrollbar-per-window contract", () => {
  it("the content column and the row band mount no scroll region of their own", () => {
    expectNoScroll(scss, ".hk-user-picker-panel");
    expectNoScroll(scss, ".hk-user-picker-rows");
    expectNoScroll(scss, ".hk-user-picker-search");
  });

  it("the cap rides the surface's maxHeight prop, and the picker owns no scrollbar machinery", () => {
    expect(tsx, "the anchored surface renders").toContain("<HkSelectPanel");
    expect(tsx, "the cap is published to the surface").toMatch(/maxHeight="[^"]+"/);
    expect(tsx).not.toContain("attachOverlayScrollbars");
    expect(tsx).not.toContain("OverlayScrollbarHandle");
  });

  it("no modal: the anchored panel is the ONE window this component opens", () => {
    expect(tsx).not.toContain('from "./HkModal"');
    expect(tsx).not.toContain("<HkModal");
  });
});