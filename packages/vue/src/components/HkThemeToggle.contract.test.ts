/**
 * Source contract for the theme-row leading cell sizing (2026-09-11
 * field report: chest's 28px three-dot palette swatch overflowed its
 * 16px generic icon cell and bled into the row gap — at fractional zoom
 * rounding the dots visually overlapped the row name). happy-dom has no
 * layout engine, so the geometry contract is pinned as an scss-text
 * assertion: the theme-row lead cell must carry an explicit size that
 * fits the widest host lead mark, not just the mixin's generic box.
 *
 * The widened cell must stay scoped (2026-09-12 field report): shipped
 * first as a bare `.s-theme-item-btn .hk-menu-item-icon` rule, it also
 * matched the 自定义 row and every host row reusing s-theme-item-btn —
 * and mi.icon normalizes those cells' svg to the cell, so their 14px
 * glyphs rendered 28px wide. The widening therefore targets named scopes
 * (lead slot, customize row) plus the toggle-owned mode-extra strip, the
 * last one widening the CELL while pinning the glyph back to the
 * standard box so host strip rows (chest's DPI entry) align their labels
 * with the theme rows' names without rescaling their icons.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string): string => readFileSync(join(here, f), "utf-8");

describe("HkThemeToggle theme-row pill contract", () => {
  // 2026-10-01 user report: with the item-trailing slot reserving a real
  // column, the row button's hover wash stopped short of the row edge —
  // theme rows and the standalone 自定义 row hovered at different widths.
  // The pill therefore lives on `.s-theme-item-row` (full row width no
  // matter how wide the trailing column is) and the row's button is
  // chromeless. happy-dom has no layout engine, so the geometry is pinned
  // as scss-text assertions.
  it("puts the unified menu-item pill on the row, not the row button", () => {
    const css = read("HkThemeToggle.scss");
    const rowBlock = css.match(/\.s-theme-item-row\s*\{[^}]*\}/);
    expect(rowBlock).not.toBeNull();
    expect(rowBlock![0]).toContain("@include mi.item;");
    // The overlaid delete affordance pins to the row (positioning context).
    expect(rowBlock![0]).toContain("position: relative");
  });

  it("strips the row button's own chrome so the wash is not doubled", () => {
    const css = read("HkThemeToggle.scss");
    const block = css.match(/\.s-theme-item-row \.s-theme-item-btn\s*\{[^}]*\}/);
    expect(block).not.toBeNull();
    expect(block![0]).toContain("padding: 0");
    expect(block![0]).toContain("background: transparent");
    expect(block![0]).toContain("min-height: 0");
    // The 1px border BOX stays (border-color only goes transparent) so the
    // content x matches the standalone pills exactly.
    expect(block![0]).toContain("border-color: transparent");
    expect(block![0]).not.toContain("border: none");
  });

  it("suppresses the row button's own hover and active state chrome", () => {
    const css = read("HkThemeToggle.scss");
    // The hover override must repeat mi.item's guard chain to out-specify
    // the mixin's hover rule; the active/checked suppression targets the
    // state attributes directly.
    expect(css).toContain(
      ".s-theme-item-row .s-theme-item-btn:hover:not(:disabled):not([data-disabled]):not([data-active]):not([data-checked])",
    );
    expect(css).toMatch(
      /\.s-theme-item-row \.s-theme-item-btn\[data-active\][^{]*\{[^}]*background: transparent/,
    );
  });

  it("registers the theme row family for the mobile sheet token swap", () => {
    const mi = read("_menu-item.scss");
    // The row carries the pill, so the sheet-context token binding must
    // target it too — otherwise sheets keep the desktop 34px metrics.
    const sheetList = mi.match(
      /\.hk-popover-panel\.hk-is-sheet[^{]*\{[^{]*\{[^}]*\}/,
    );
    expect(sheetList).not.toBeNull();
    expect(sheetList![0]).toContain(".s-theme-item-row");
    const modalList = mi.match(/\.hk-modal-content\s*\{[^{]*\{[^}]*\}/);
    expect(modalList).not.toBeNull();
    expect(modalList![0]).toContain(".s-theme-item-row");
  });
});

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

  it("does not widen icon cells with a bare unscoped theme-row rule", () => {
    const css = read("HkThemeToggle.scss");
    // A bare `.s-theme-item-btn .hk-menu-item-icon {` rule also hits the
    // customize row and host mode-extra rows; the widened cell may only
    // target named scopes (lead slot, customize row, mode-extra strip).
    expect(css).not.toMatch(/^\.s-theme-item-btn \.hk-menu-item-icon\s*\{/m);
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

  it("aligns mode-extra host rows to the lead column without rescaling their glyph", () => {
    const css = read("HkThemeToggle.scss");
    // Host strip rows (chest's DPI entry) join the 28px lead column so
    // their label starts at the same x as the theme rows' names
    // (2026-09-12 field report), but the glyph keeps the standard box.
    const block = css.match(
      /\.s-theme-mode-extra \.s-theme-item-btn \.hk-menu-item-icon\s*\{[^}]*\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("width: 28px");
    expect(block![0]).toContain("height: 28px");

    const svgBlock = css.match(
      /\.s-theme-mode-extra \.s-theme-item-btn \.hk-menu-item-icon > svg\s*\{[^}]*\}/,
    );
    expect(svgBlock).not.toBeNull();
    expect(svgBlock![0]).toContain("var(--hk-menu-item-icon-box)");
  });

  it("pins the name-suffix mark against the name instead of the trailing edge", () => {
    const css = read("HkThemeToggle.scss");
    // happy-dom has no layout engine, so the "reads as part of the name"
    // claim is pinned as the two declarations that produce it: the name
    // stops stretching (the shared mixin's `flex: 1` would push the mark
    // to the row's far end, next to the trailing affordances) and the
    // suffix eats the leftover width on its leading side. Losing either
    // one silently turns the marker into a trailing icon.
    const nameBlock = css.match(
      /\.s-theme-item-row\[data-name-suffix="slot"\] \.s-theme-item-name\s*\{[^}]*\}/,
    );
    expect(nameBlock).not.toBeNull();
    expect(nameBlock![0]).toContain("flex: 0 1 auto");
    // Long names must WRAP, not push the mark out of the row: the mixin's
    // nowrap is exactly what would clip the marker away at narrow widths.
    expect(nameBlock![0]).toContain("white-space: normal");

    const suffixBlock = css.match(/\.s-theme-item-name-suffix\s*\{[^}]*\}/);
    expect(suffixBlock).not.toBeNull();
    expect(suffixBlock![0]).toContain("margin-inline-end: auto");
    expect(suffixBlock![0]).toContain("flex-shrink: 0");
  });
});
