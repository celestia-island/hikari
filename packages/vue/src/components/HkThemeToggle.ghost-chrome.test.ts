/**
 * Source contract for the theme-toggle trigger chrome (2026-09-08 user
 * report: the bordered surface box read as a mystery outline in the
 * header and fought the host themes — the faint border, the host
 * override layer and the `--hk-theme-toggle-btn-border` var never
 * agreed). The trigger is now the STANDARD ghost icon-button chrome
 * (same as `.hk-btn-ghost` / the HkIconButton ghost variant beside it):
 * transparent at rest, primary wash on hover, no border, no surface,
 * no shadow. Pinned here so the bordered-box chrome cannot silently
 * return.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkThemeToggle.scss"), "utf-8");

describe("HkThemeToggle ghost trigger chrome contract", () => {
  let block = "";
  beforeAll(() => {
    block = src.match(/\.s-theme-toggle-btn\s*{[^}]*}/)?.[0] ?? "";
  });

  it("paints no border on the trigger (border: none)", () => {
    expect(block).toContain("border: none;");
  });

  it("keeps the rest state transparent (no surface box)", () => {
    expect(block).toContain("background: transparent;");
  });

  it("removes the per-theme border var entirely", () => {
    expect(src).not.toContain("--hk-theme-toggle-btn-border");
  });

  it("retains a visible focus ring via :focus-visible", () => {
    expect(src).toMatch(/\.s-theme-toggle-btn:focus-visible\s*{[^}]*}/);
  });
});
