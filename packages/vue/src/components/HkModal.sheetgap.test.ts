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
import { beforeAll, describe, expect, it } from "vitest";
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
    // (2026-08-29 user request: the docked sheet sat too far off the
    // bottom — default tightened from 0.5rem to 0.375rem.)
    expect(block).toMatch(/--hk-sheet-bottom-gap,\s*0\.375rem/);
  });

  it("keeps the footer gap host-tunable and stacks the safe-area inset", () => {
    const footer = src.match(/\.hk-modal-footer\s*{[^}]*}/g)?.join("\n") ?? "";
    expect(footer).toContain("--hk-sheet-footer-gap");
    expect(footer).toContain("env(safe-area-inset-bottom");
  });

  // 2026-08-30 user report: the docked sheet stretched from the top inset
  // down to the bottom gap regardless of content, and the desktop 70vh body
  // cap stranded the height it refused INSIDE the stretched sheet — a
  // phantom empty band below the footer (report reply bar) or below the log
  // tail (footer-less log modal), and a full screen of dead body under a
  // three-row node-detail sheet. The sheet now hugs its content: docked at
  // the bottom edge, growing upward, bounded only by the top band.
  describe("mobile sheet hug-content contract", () => {
    let block = "";
    let content = "";
    let body = "";
    let footer = "";
    beforeAll(() => {
      block = src.slice(src.indexOf("@media (max-width: 767px)"));
      content = block.match(/\.hk-modal-content\s*{[^}]*}/)?.[0] ?? "";
      body = block.match(/\.hk-modal-body\s*{[^}]*}/)?.[0] ?? "";
      footer = block.match(/\.hk-modal-footer\s*{[\s\S]*?^  }/m)?.[0] ?? "";
    });

    it("docks the sheet at the bottom edge instead of stretching from the top", () => {
      expect(content).toContain("top: auto");
      expect(content).toContain("bottom: var(--hk-sheet-bottom-gap");
    });

    it("caps the sheet with the top band + bottom gap instead of unbounding it", () => {
      expect(content).toContain("max-height: calc(");
      expect(content).toContain("100dvh - var(--hk-sheet-top-inset");
      // dvh-less engines (older Android WebView / Tauri) drop the whole
      // dvh calc — the plain-vh fallback must stay ahead of it.
      expect(content).toContain("100vh - var(--hk-sheet-top-inset");
      expect(content.indexOf("100vh - var(")).toBeLessThan(content.indexOf("100dvh - var("));
      expect(content).not.toMatch(/max-height:\s*none/);
    });

    it("lifts the 70vh body cap on phones so the footer sits on the bottom edge", () => {
      expect(body).toContain("max-height: none");
    });

    it("lifts sm/md footer buttons to the 44px touch-target class", () => {
      expect(footer).toMatch(/\.hk-btn-sm,\s*\n\s*\.hk-btn-md/);
      expect(footer).toContain("min-height: 2.75rem");
    });
  });
});
