/**
 * Source contract for the mobile bottom-sheet spacing hooks (2026-08-27
 * chest request: docked phone popups sat too far off the bottom edge).
 *
 * The sheet and its footer read tunable custom properties with safe
 * defaults:
 *   --hk-sheet-bottom-gap   sheet's distance from the viewport bottom edge
 *                           (was hard `bottom: 0`)
 *   --hk-sheet-footer-gap   extra breathing room above the home-bar inset
 *
 * Pinned here so a refactor cannot silently regress to hard-coded values —
 * the same class of "looks fixed but never shipped" failure as the
 * overflow-poll incident.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkModal.scss"), "utf-8");

describe("HkModal mobile sheet spacing contract", () => {
  it("sizes the docked sheet from --hk-sheet-bottom-gap (not hard 0)", () => {
    const block = src.slice(src.indexOf("@media (max-width: 767px)"));
    expect(block).toContain("bottom: var(--hk-sheet-bottom-gap");
    // Default keeps a small visible gap; hosts may narrow or zero it.
    expect(block).toMatch(/--hk-sheet-bottom-gap,\s*0\.5rem/);
  });

  it("keeps the footer gap host-tunable and stacks the safe-area inset", () => {
    const footer = src.match(/\.hk-modal-footer\s*{[^}]*}/g)?.join("\n") ?? "";
    expect(footer).toContain("--hk-sheet-footer-gap");
    expect(footer).toContain("env(safe-area-inset-bottom");
  });
});
