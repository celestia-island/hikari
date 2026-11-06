/**
 * Source contract for the range-ribbon reset affordance (user direction
 * 2026-11-06: the waterfall minimap's reset control must be the STANDARD
 * icon button, not a per-component hand-rolled `<button>` chip).
 *
 * HkRangeRibbon renders its reset through HkIconButton (the shared icon
 * button: one box ladder, one glyph channel, one hover/press/focus chrome)
 * carrying the a directly-imported `RotateCcw` glyph in the icon slot — the same "named-icon contract" the unified window-close wave
 * pinned (window-close.contract.test.ts). The positioning class
 * `hk-range-ribbon-reset` survives ONLY as the seat hook the component
 * sheet pins (it must keep clearing the edge handle).
 *
 * Pinned here so a refactor cannot silently re-sprout a bespoke chip —
 * the same "looks unified but drifted" failure class the window-close
 * contract guards against.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ribbon = readFileSync(join(here, "HkRangeRibbon.tsx"), "utf-8");

describe("range-ribbon reset control contract", () => {
  it("renders the reset affordance through the standard HkIconButton", () => {
    expect(ribbon, "the reset must ride HkIconButton chrome").toContain("HIconButton");
    expect(ribbon, "the seat class survives as the positioning hook").toContain(
      'class="hk-range-ribbon-reset"',
    );
    expect(
      ribbon,
      "the glyph rides the house-normal lucide slot (every in-tree HkIconButton slots its glyph)",
    ).toContain("<RotateCcw");
    expect(ribbon, "no hand-rolled <button> may carry the reset class").not.toMatch(
      /<button[^>]*hk-range-ribbon-reset/,
    );
    // The three things a partial revert silently drops while still passing
    // the substring checks above.
    expect(ribbon, "the reset keeps its touch-floor size").toMatch(
      /<HIconButton[\s\S]{0,200}?size=\{24\}/,
    );
    // The non-submit guarantee moved upstream into HkIconButton (one
    // implementation, not a per-call-site spread); it is pinned in
    // HkIconButton.test.tsx and asserted on the rendered DOM in
    // HkRangeRibbon.test.tsx.
    expect(ribbon, "the reset passes the standard variant explicitly").toContain('variant="ghost"');
    expect(ribbon, "the glyph rides the slot form, not the icon prop").toMatch(
      /\{\{\s*icon:\s*\(\)\s*=>\s*<RotateCcw/,
    );
  });
});
