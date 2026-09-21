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
  it("sizes the docked sheet from --hk-sheet-bottom-gap (host-tunable hook)", () => {
    const block = src.slice(src.indexOf("@media (max-width: 767px)"));
    expect(block).toContain("bottom: var(--hk-sheet-bottom-gap");
    // Family default sits flush on the bottom edge; hosts may re-add a
    // gap via the same custom property. (History: 2026-08-29 tightened
    // 0.5rem → 0.375rem; 2026-09-04 user report — the remaining sliver
    // still read as a visible seam, so the default settled on 0.)
    expect(block).toMatch(/--hk-sheet-bottom-gap,\s*0px/);
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
      // 2026-09-14: the sheet block carries more than one .hk-modal-body
      // rule (the scroll-pin gutter-var override + the body-cap lift) —
      // assertions below must see both, so concatenate them all.
      body = (block.match(/\.hk-modal-body\s*{[^}]*}/g) ?? []).join("\n");
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

    // 2026-09-21 phone-sheet transition contract (two Xiaomi WebView
    // chest reports the same day): the mobile list carries ONLY the
    // clip-path reveal.
    // ① IME cap-chase: the keyboard animation steps the 100dvh cap every
    //   frame; max-height in the transition list made cap-bound sheets
    //   chase their own viewport. The cap follows the viewport instantly.
    // ② Step-change shrink flicker: useSizeMorph routes clip-mode
    //   SHRINKS through the height transition — 150ms of per-frame
    //   layout on a fixed layer re-rastering the moving edge (wizard
    //   Prev/Next between different-height steps showed black blocks).
    //   With height out of the list, shrinks snap (one layout, one
    //   paint — native-sheet behavior); growth keeps its animated
    //   reveal through the clip-path sweep.
    it("narrows the phone sheet transition to clip-path only (IME + shrink guards)", () => {
      // Extraction self-check: the mobile rule must exist and MUST carry
      // a transition declaration at all (its absence is the regression,
      // not a vacuous pass).
      expect(content.length, "mobile .hk-modal-content rule extracted").toBeGreaterThan(0);
      const tr = content.match(/transition:\s*([^;]+);/)?.[1] ?? "";
      expect(tr.length, "mobile sheet transition declaration present").toBeGreaterThan(0);
      expect(tr).toMatch(/\bclip-path\b/);
      expect(tr).not.toMatch(/\bheight\b/);
      expect(tr).not.toMatch(/\bmax-height\b/);
    });

    it("keeps the desktop frame transition list intact (base rule)", () => {
      // The guard is phone-only by design: the base rule outside the
      // media block keeps height+max-height+clip-path animated.
      const base = src.match(/\.hk-modal-content\s*{[^}]*}/)?.[0] ?? "";
      expect(base.length, "base .hk-modal-content rule extracted").toBeGreaterThan(0);
      const tr = base.match(/transition:\s*([^;]+);/)?.[1] ?? "";
      expect(tr.length, "base transition declaration present").toBeGreaterThan(0);
      expect(tr).toMatch(/\bheight\b/);
      expect(tr).toMatch(/\bmax-height\b/);
      expect(tr).toMatch(/\bclip-path\b/);
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
