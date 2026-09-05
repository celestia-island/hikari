/**
 * Source contract for the theme-context-driven functional icon rendering
 * (user direction 2026-09-05: the close/back functional controls are drawn
 * BY THE THEME CONTEXT — Blue Archive themes keep the bold small default,
 * thin-stroke themes like Endfield publish their own weight/size/motion).
 *
 * The mechanism is a pure custom-property family: a theme layer publishes
 * --hk-func-icon-* on any root and every HkIconButton glyph + window-close
 * hover picks it up. No JS plumbing, no per-theme component forks.
 *
 * Pinned here so the consumption points cannot silently disappear (the
 * same "looks themed but never shipped" failure class as the sheet-dock
 * contracts).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(here, f), "utf-8");

describe("functional icon theme-context contract", () => {
  it("draws icon-button glyphs with the theme stroke width", () => {
    const css = read("HkIcon.scss");
    // Scoped to the functional family: plain HkIcons elsewhere must keep
    // the lucide default weight.
    expect(css).toContain(".hk-icon-button .hk-icon svg");
    expect(css).toContain("var(--hk-func-icon-stroke-width, 2)");
  });

  it("scales icon-button glyphs with the theme size factor", () => {
    const css = read("HkIconButton.scss");
    expect(css).toContain("var(--hk-func-icon-scale, 1)");
  });

  it("expresses the window-close hover motion through the var family", () => {
    const css = read("window-close.scss");
    expect(css).toContain("var(--hk-func-icon-hover-duration, 0.15s)");
    expect(css).toContain("var(--hk-func-icon-hover-ease, ease)");
    expect(css).toContain("--hk-func-icon-hover-bg,");
    expect(css).toContain("--hk-func-icon-hover-color,");
  });
});
