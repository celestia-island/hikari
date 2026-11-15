import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The cursor's ink is THEME-INDEPENDENT (2026-11-16 field finding).
 *
 * The glyph rides the remote screen, which is dark in every app theme —
 * the HkTerminal doctrine. The first cut used the page's text token, so
 * in a light theme (--color-text near-black) the pointer rendered
 * near-invisible against the black remote canvas: measured computed
 * fill `rgb(30 30 30)` over `#0b0d12`. Both the arrow and the lobes now
 * speak fixed light ink / dark glass, and this pin keeps a future edit
 * from quietly restoring the theme tokens.
 */
const scss = readFileSync(join(__dirname, "HkVirtualCursor.scss"), "utf8");

describe("HkVirtualCursor ink", () => {
  it("the arrow is fixed light ink with a dark outline", () => {
    // The sheet nests `path { … }` inside the arrow block; take the
    // arrow block and check the nested rule inside it.
    const arrow = /\.hk-virtual-cursor__arrow \{[\s\S]*?\n\}/.exec(scss)?.[0] ?? "";
    expect(arrow, "the arrow block is present").not.toBe("");
    const path = /path \{[\s\S]*?\n  \}/.exec(arrow)?.[0] ?? "";
    expect(path, "the nested path rule is present").not.toBe("");
    expect(path).toMatch(/fill:\s*rgb\(255 255 255/);
    expect(path).toMatch(/stroke:\s*rgb\(0 0 0/);
    // The theme ink must not come back: it is near-black in light themes.
    expect(path).not.toContain("--color-text");
  });

  it("the lobes speak a fixed dark-glass face, not the theme surface", () => {
    const lobe = /\.hk-virtual-cursor__lobe \{[\s\S]*?\n\}/.exec(scss)?.[0] ?? "";
    expect(lobe, "the lobe rule is present").not.toBe("");
    expect(lobe).toMatch(/background:\s*rgb\(0 0 0 \//);
    expect(lobe).toMatch(/color:\s*rgb\(255 255 255/);
    expect(lobe, "no theme surface on the remote face").not.toContain("--color-background");
    expect(lobe, "no theme ink on the remote face").not.toContain("--color-text");
  });
});
