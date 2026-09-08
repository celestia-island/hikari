/**
 * Source contract for the mobile lightbox horizontal sizing (2026-09-08
 * scan wave 2, finding F3 + round-3 fix).
 *
 * The fullscreen mobile block used to declare `width: 100vw`, but 100vw
 * measures the ICB including classic scrollbar gutters — combined with the
 * inherited `left: 0; right: 0` docking it over-constrained the box (LTR
 * dropped `right`) and clipped the right edge under a classic scrollbar.
 * Deleting the width alone was NOT enough (round-3 adversarial catch):
 * the unconditional desktop rule `width: min(96vw, 80rem)` (same selector,
 * same specificity) then persisted into mobile and, over-constrained
 * against left/right, dropped `right` — a persistent ~4vw dead strip on
 * the right edge. The mobile block must declare its OWN width: 100% so
 * the containing block (not the viewport unit, not the desktop measure)
 * owns the full-bleed. Pinned here so neither regression can return.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkImageLightbox.scss"), "utf-8");

describe("HkImageLightbox mobile width contract", () => {
  let mobile = "";
  it("declares its own full-bleed width in the mobile block", () => {
    mobile = src.slice(src.indexOf("@media (max-width: 767px)"));
    const panel = mobile.match(/\.hk-modal-content\.hk-image-lightbox\s*{[^}]*}/)?.[0] ?? "";
    expect(panel).toContain("left: 0;");
    expect(panel).toContain("width: 100%;");
  });

  it("keeps 100vw sizing out (scrollbar-gutter divergence)", () => {
    expect(mobile).not.toContain("width: 100vw");
  });

  it("keeps the desktop 96vw measure out of the mobile block", () => {
    // The unconditional desktop rule keeps min(96vw, 80rem) — only the
    // mobile panel block's own width: 100% stops it from leaking in.
    // Comments are stripped first: the rationale text legitimately quotes
    // the desktop measure, and only live declarations are under contract.
    const panel = (mobile.match(/\.hk-modal-content\.hk-image-lightbox\s*{[^}]*}/)?.[0] ?? "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(panel).not.toContain("96vw");
  });
});
