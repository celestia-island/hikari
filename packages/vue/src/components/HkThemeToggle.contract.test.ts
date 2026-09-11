/**
 * Source contract for the theme-row leading cell sizing (2026-09-11
 * field report: chest's 28px three-dot palette swatch overflowed its
 * 16px generic icon cell and bled into the row gap — at fractional zoom
 * rounding the dots visually overlapped the row name). happy-dom has no
 * layout engine, so the geometry contract is pinned as an scss-text
 * assertion: the theme-row lead cell must carry an explicit size that
 * fits the widest host lead mark, not just the mixin's generic box.
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
      /\.s-theme-item-btn \.hk-menu-item-icon\s*\{[^}]*\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("width: 28px");
    expect(block![0]).toContain("height: 28px");
  });
});
