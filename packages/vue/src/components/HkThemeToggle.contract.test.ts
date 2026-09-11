/**
 * Source contract for the theme-row leading cell sizing (2026-09-11
 * field report: chest's 28px three-dot palette swatch overflowed its
 * 16px generic icon cell and bled into the row gap — at fractional zoom
 * rounding the dots visually overlapped the row name). happy-dom has no
 * layout engine, so the geometry contract is pinned as an scss-text
 * assertion: the theme-row lead cell must carry an explicit size that
 * fits the widest host lead mark, not just the mixin's generic box.
 *
 * The widened cell must stay scoped to the lead slot (2026-09-12 field
 * report): shipped first as a bare `.s-theme-item-btn .hk-menu-item-icon`
 * rule, it also matched the 自定义 row and every host row reusing
 * s-theme-item-btn (chest's mode-extra DPI entry) — and mi.icon
 * normalizes those cells' svg to the cell, so their 14px glyphs rendered
 * 28px wide.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(here, f), "utf-8");

describe("HkThemeToggle row lead-cell contract", () => {
  it("sizes the theme-row lead cell to fit a 28px swatch mark", () => {
    const css = read("HkThemeToggle.scss");
    const block = css.match(
      /\.s-theme-item-btn \.hk-menu-item-icon\.s-theme-item-lead\s*\{[^}]*\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("width: 28px");
    expect(block![0]).toContain("height: 28px");
  });

  it("does not widen icon cells outside the leading slot", () => {
    const css = read("HkThemeToggle.scss");
    // A bare `.s-theme-item-btn .hk-menu-item-icon {` rule also hits the
    // customize row and host mode-extra rows; the widened cell may only
    // target the lead slot class.
    expect(css).not.toMatch(/\.s-theme-item-btn \.hk-menu-item-icon\s*\{/);
  });

  it("aligns the customize row to the lead column without rescaling its glyph", () => {
    const css = read("HkThemeToggle.scss");
    // The customize affordance joins the 28px lead column (2026-09-11
    // field report: its palette sat a full cell left of the rows' bitmap
    // marks), but the glyph must keep the standard menu icon size —
    // mi.icon normalizes svg to the cell, so the box is pinned back.
    const block = css.match(
      /\.s-theme-item-customize \.hk-menu-item-icon\s*\{[^}]*\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("width: 28px");
    expect(block![0]).toContain("height: 28px");

    const svgBlock = css.match(
      /\.s-theme-item-customize \.hk-menu-item-icon > svg\s*\{[^}]*\}/,
    );
    expect(svgBlock).not.toBeNull();
    expect(svgBlock![0]).toContain("var(--hk-menu-item-icon-box)");
  });
});
