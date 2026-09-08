/**
 * Source contract for the mobile bottom-drawer sheet family membership
 * (2026-09-08 scan wave 2, finding F1).
 *
 * HkAdaptiveDialog renders its mobile form as a bottom drawer, which made
 * it the ONLY bottom-docked window outside the HkModal / HkPopover /
 * HkSelectPanel sheet family contract. Pinned here so a refactor cannot
 * silently regress to the pre-family geometry:
 *   - docks on the shared --hk-sheet-bottom-gap hook (was hard `bottom: 0`)
 *   - capped by the family formula (top inset + bottom gap), NOT the inline
 *     `size` 70vh — the inline maxHeight must lose via !important (same
 *     inline-beating pattern as HkModal's mobile `max-width: 100%
 *     !important`), with the plain-vh fallback ahead of the dvh twin
 *   - 12px family corners (was 8px)
 *   - footer stacks the home-bar safe area on the BOTTOM axis (3-value
 *     padding: hook top / 1rem sides / safe-area bottom — a 2-value form
 *     would put the safe-area calc on the horizontal axis and strip the
 *     bottom protection for hosts that zero the hook) and is scoped to
 *     BOTTOM drawers only (side drawers keep their desktop footer
 *     contract on phones); sm/md buttons lift to the 44px class, like
 *     HkModal's mobile footer
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkDrawer.scss"), "utf-8");

describe("HkDrawer mobile bottom sheet-family contract", () => {
  let media = "";
  let drawer = "";
  let footer = "";
  beforeAll(() => {
    media = src.slice(src.indexOf("@media (max-width: 767px)"));
    drawer = media.match(/\.hk-drawer-bottom\s*{[^}]*}/)?.[0] ?? "";
    footer = media.match(/\.hk-drawer-bottom \.hk-drawer-footer\s*{[\s\S]*?^  }/m)?.[0] ?? "";
  });

  it("docks the bottom drawer on the shared --hk-sheet-bottom-gap hook", () => {
    expect(drawer).toContain("bottom: var(--hk-sheet-bottom-gap");
  });

  it("caps the sheet with the family top-inset formula in both vh and dvh", () => {
    expect(drawer).toContain("100vh - var(--hk-sheet-top-inset");
    expect(drawer).toContain("100dvh - var(--hk-sheet-top-inset");
    // dvh-less engines (older Android WebView / Tauri) drop the whole dvh
    // calc — the plain-vh fallback must stay ahead of it.
    expect(drawer.indexOf("100vh - var(")).toBeLessThan(
      drawer.indexOf("100dvh - var(")
    );
  });

  it("beats the inline `size` maxHeight with !important on both caps", () => {
    // HkDrawer applies `maxHeight: props.size` (default 70vh) inline for
    // horizontal drawers — inline beats stylesheet, so the family cap must
    // carry !important on the vh fallback AND the dvh twin.
    expect(drawer.match(/\) !important;/g)).toHaveLength(2);
  });

  it("adopts the 12px family corner radius", () => {
    expect(drawer).toContain("border-radius: var(--hk-modal-radius, var(--hi-radius-lg, 12px))");
  });

  it("stacks the home-bar safe area on the mobile footer's BOTTOM axis", () => {
    expect(footer).toContain("env(safe-area-inset-bottom");
    expect(footer).toContain("--hk-sheet-footer-gap");
    // 3-value padding: hook top / 1rem sides / safe-area calc bottom. The
    // safe-area calc must be the THIRD value, not the second (2-value form
    // puts it on the horizontal axis and zeroes the bottom for hook=0 hosts).
    expect(footer).toMatch(
      /padding: var\(--hk-drawer-footer-padding,[^)]*\) 1rem\s*\n?\s*calc\(0\.375rem \+ var\(--hk-sheet-footer-gap/
    );
  });

  it("scopes the mobile footer rules to bottom drawers only", () => {
    // Side drawers (admin panels) keep the desktop footer contract on
    // phones — the media block must not carry an unscoped .hk-drawer-footer.
    expect(media).not.toMatch(/@media[\s\S]*?\n  \.hk-drawer-footer\s*{/);
  });

  it("lifts sm/md footer buttons to the 44px touch-target class", () => {
    expect(footer).toMatch(/\.hk-btn-sm,\s*\n\s*\.hk-btn-md/);
    expect(footer).toContain("min-height: 2.75rem");
  });
});
