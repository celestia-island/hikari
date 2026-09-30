/**
 * Source contract for the theme-toggle trigger chrome (2026-09-08 user
 * report: the bordered surface box read as a mystery outline in the
 * header and fought the host themes). That round standardized the trigger
 * onto ghost chrome via a bespoke scss block; 2026-09-30 (user direction)
 * went one step further: the trigger IS an HkIconButton (ghost/28 — the
 * header chrome step, user report 2026-09-28) now — the retired
 * main/arrow button pair, whose primary hover wash disagreed with the
 * ghost gray of the buttons beside it, is merged into ONE palette-glyph
 * trigger, and every byte of trigger chrome comes from the shared
 * HkIconButtonVars contract. Pinned here so neither the bespoke block
 * nor the two-button pair can silently return.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkThemeToggle.scss"), "utf-8");
const tsx = readFileSync(join(here, "HkThemeToggle.tsx"), "utf-8");

describe("HkThemeToggle trigger chrome contract", () => {
  let block = "";
  beforeAll(() => {
    // Line-anchored: prose comments may NAME the hook class — only a real
    // top-level rule block for it counts as chrome coming back.
    block = scss.match(/^\.s-theme-toggle-btn[^{]*\{[^}]*\}/m)?.[0] ?? "";
  });

  it("carries no bespoke chrome block for the trigger", () => {
    // The class survives ONLY as a stable hook on the HkIconButton —
    // any rule painting it would fork the chrome away from the shared
    // ghost contract again.
    expect(block).toBe("");
  });

  it("removes the per-theme border var entirely", () => {
    expect(scss).not.toContain("--hk-theme-toggle-btn-border");
  });

  it("renders the trigger through the standard HkIconButton", () => {
    expect(tsx).toContain("HkIconButton");
    expect(tsx).toMatch(/variant="ghost"/);
  });

  it("merges the retired main/arrow pair into one trigger", () => {
    // One s-theme-toggle-btn element, and the retired data hooks are gone.
    const triggers = tsx.match(/class="s-theme-toggle-btn"/g) ?? [];
    expect(triggers).toHaveLength(1);
    expect(tsx).not.toContain('data-variant="arrow"');
    expect(tsx).not.toContain('data-variant="main"');
    expect(tsx).not.toContain("toggleMode");
  });
});
