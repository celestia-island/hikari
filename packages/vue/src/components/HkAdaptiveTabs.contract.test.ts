import { describe, expect, it } from "vitest";

import componentSource from "./HkAdaptiveTabs.tsx?raw";

/**
 * Composition contract for the adaptive tabs (the
 * HkNotificationBell.contract.test.ts shape): the component owns ONLY
 * the breakpoint branch and the option rows — every surface is a
 * shared family member, so a second popup grammar cannot grow here.
 */
function body(): string {
  return componentSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("HkAdaptiveTabs composition contract", () => {
  it("the desktop arm IS HkTabs; the mobile arm IS HkButton + HkSelectPanel", () => {
    const src = body();
    expect(src).toContain("HkTabs");
    expect(src).toContain("HkButton");
    expect(src).toContain("HkSelectPanel");
    expect(src).toContain("sheetOnMobile"); // panel default — sheet on phones
    // No hand-rolled overlay machinery in this component.
    expect(src).not.toContain("Teleport");
    expect(src).not.toContain("ensureOverlayRoot");
    expect(src).not.toContain("scrim");
  });

  it("the branch threshold is the family's isMobile — no private width math", () => {
    const src = body();
    expect(src).toContain("useBreakpoint");
    expect(src).toContain("isMobile");
    expect(src).not.toContain("innerWidth");
    expect(src).not.toContain("matchMedia");
    expect(src).not.toContain("768");
  });

  it("mobile rows reuse the shared option-row grammar — no second family", () => {
    const src = body();
    expect(src).toContain("hk-select-option");
    expect(src).toContain("hk-menu-item-icon");
    expect(src).toContain("hk-menu-label");
  });

  it("the value contract never changes shape across the branch", () => {
    const src = body();
    // Both arms emit the same update; no mobile-only state shadow.
    expect(src).toContain("update:modelValue");
    expect(src).not.toContain("innerModel");
  });

  it("badges anchor labels — never a floating mark", () => {
    const src = body();
    // The HkCornerBadge wraps the label span (HkTabs contract), so the
    // badge JSX must contain the hk-menu-label class in its subtree.
    const badgeIdx = src.indexOf("<HkCornerBadge");
    expect(badgeIdx).toBeGreaterThan(-1);
    const badgeBlock = src.slice(badgeIdx, badgeIdx + 500);
    expect(badgeBlock).toContain("hk-menu-label");
  });
});
