/**
 * Source contract: the trigger presentation's panel geometry (2026-11-18
 * third pass).
 *
 * The trigger form anchors the panel to a one-glyph icon button, so it
 * cannot inherit the anchor's width (matchAnchorWidth off) and carries a
 * catalog measure instead. That measure must NOT leak into the phone
 * sheet: inside the viewport-wide sheet band it becomes a centered cap,
 * not a left-glued clamp — the #424 pattern the HkTagInput / HkAffixPicker
 * sheets spell out. jsdom cannot see layout, so this contract pins the
 * stylesheet source: both branches of the geometry exist, with the sheet
 * override keyed on the SAME `.is-trigger-anchor` marker the popout rule
 * uses (a rename of one branch orphans the other — this pin fails).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkUserPicker.scss"), "utf-8");

/** The balanced `{...}` block that FOLLOWS `at` (the singleScroll
 *  contract's reader — a naive `[^}]*` would stop at the first nested
 *  `}` and let properties appended after a future nested block evade the
 *  pin). */
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

describe("HkUserPicker trigger panel geometry (source contract)", () => {
  it("carries the popout measure and the sheet override on the same marker", () => {
    const popoutAt = scss.indexOf(".hk-user-picker-panel.is-trigger-anchor");
    expect(popoutAt, "the popout width rule exists").toBeGreaterThanOrEqual(0);
    const popout = blockAt(scss, popoutAt);
    expect(popout).toContain("width: min(24rem, 80vw);");

    // The sheet override is keyed on the SAME marker, scoped under the
    // sheet panel: width hands over to the band, the measure becomes a
    // centered cap (#424 — never a left-glued clamp).
    const sheetAt = scss.indexOf(
      ".hk-select-sheet-panel .hk-user-picker-panel.is-trigger-anchor",
    );
    expect(sheetAt, "the sheet override exists").toBeGreaterThanOrEqual(0);
    expect(sheetAt, "the override follows the popout rule").toBeGreaterThan(popoutAt);
    const sheet = blockAt(scss, sheetAt);
    expect(sheet).toContain("width: 100%;");
    expect(sheet).toContain("max-width: min(24rem, 100%);");
    expect(sheet).toContain("margin-inline: auto;");
  });
});
