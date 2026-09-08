/**
 * Source contract for the affix picker's measure inside the mobile select
 * sheet (2026-09-08 scan wave 2, finding F2 — #424 pattern).
 *
 * The picker renders on phones inside the full-width `.hk-select-sheet-panel`;
 * the base 19rem (304px) cap left-glued with ~92px dead space right. Pinned
 * here so the sheet-context centering rule cannot be dropped in a refactor:
 * the designed measure stays as a cap but the list reads as one centered
 * block inside the viewport-wide sheet.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkAffixPicker.scss"), "utf-8");

describe("HkAffixPicker mobile sheet measure contract", () => {
  it("caps and centers the list inside the full-width select sheet", () => {
    const block =
      src.match(/\.hk-select-sheet-panel \.hk-affix-scroll\s*{[^}]*}/)?.[0] ??
      "";
    expect(block).toContain("max-width: min(19rem, 100%)");
    expect(block).toContain("margin-inline: auto");
  });
});
