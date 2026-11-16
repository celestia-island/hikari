/**
 * Pin for HkInput's narrow-box auto-degrade predicate (2026-11-17
 * chest report: a near-full-width phone bottom drawer with a ~120px
 * platform chip in the #prefix slot left the right third of the
 * repository-URL line permanently empty under the centered default).
 *
 * The threshold has an exact reading, pinned here so a refactor cannot
 * quietly move it: the symmetric centered reservation leaves a usable
 * line of `boxW − 2·base − 2·widest`, which is strictly narrower than
 * the widest affix itself exactly when `boxW < 3·widest + 2·base`.
 * Below that line the optical-centering trade stops paying and the
 * box degrades to the per-side reservation.
 *
 * Mutation note: flipping the comparison, the 3× factor, the base
 * constant, or deleting a non-case guard must red these tests.
 */
import { describe, expect, it } from "vitest";

import { AFFIX_BASE_PAD_PX, isAffixLineCramped } from "./inputAffixGeometry";

describe("isAffixLineCramped", () => {
  it("fires on the reported mobile geometry (330px box, 120px chip)", () => {
    expect(isAffixLineCramped(120, 0, 330)).toBe(true);
    // The dead side follows the widest affix — a suffix-carried chip
    // starves the line identically.
    expect(isAffixLineCramped(0, 120, 330)).toBe(true);
    // Both sides affixed: only the widest feeds the judgment.
    expect(isAffixLineCramped(110, 120, 330)).toBe(true);
    expect(isAffixLineCramped(120, 110, 330)).toBe(true);
  });

  it("keeps desktop geometry centered (36rem window, 110–130px chip)", () => {
    expect(isAffixLineCramped(110, 0, 528)).toBe(false);
    expect(isAffixLineCramped(110, 0, 576)).toBe(false);
    expect(isAffixLineCramped(130, 0, 576)).toBe(false);
  });

  it("fires exactly when the usable line drops below one widest affix", () => {
    const widest = 120;
    // Boundary: symmetric reservation leaves EXACTLY one affix width of
    // line — tight, but the centered default still owns the geometry.
    const boundary = 3 * widest + 2 * AFFIX_BASE_PAD_PX; // 384
    expect(boundary).toBe(384);
    expect(isAffixLineCramped(widest, 0, boundary)).toBe(false);
    expect(isAffixLineCramped(widest, 0, boundary - 1)).toBe(true);
    expect(isAffixLineCramped(widest, 0, boundary + 1)).toBe(false);
    // Same boundary from the end side and from a both-side pair.
    expect(isAffixLineCramped(0, widest, boundary)).toBe(false);
    expect(isAffixLineCramped(0, widest, boundary - 1)).toBe(true);
    expect(isAffixLineCramped(widest, widest, boundary - 1)).toBe(true);
    // A 1px-wider chip moves the boundary by exactly 3px — the 3×
    // factor is load-bearing.
    expect(isAffixLineCramped(widest + 1, 0, boundary - 1)).toBe(true);
    expect(isAffixLineCramped(widest + 1, 0, boundary + 2)).toBe(true);
    expect(isAffixLineCramped(widest + 1, 0, boundary + 3)).toBe(false);
  });

  it("never fires without affixes, even on a degenerate box", () => {
    expect(isAffixLineCramped(0, 0, 330)).toBe(false);
    expect(isAffixLineCramped(0, 0, 24)).toBe(false);
    expect(isAffixLineCramped(0, 0, 0)).toBe(false);
  });

  it("never fires before a real box width is measured", () => {
    // SSR, the pre-mount ref window and display:none all report zero;
    // speculative geometry must not beat the published default.
    expect(isAffixLineCramped(120, 0, 0)).toBe(false);
    expect(isAffixLineCramped(0, 120, 0)).toBe(false);
    expect(isAffixLineCramped(120, 0, -5)).toBe(false);
    expect(isAffixLineCramped(Number.NaN, 0, 330)).toBe(false);
    expect(isAffixLineCramped(0, Number.NaN, 330)).toBe(false);
    expect(isAffixLineCramped(120, 0, Number.NaN)).toBe(false);
  });

  it("keeps the base constant mirroring the sheet's --space-12", () => {
    // 0.75rem at the default 16px root. The predicate's doc and the
    // SCSS both read "base padding = 12px"; drift here shifts every
    // boundary by 2px per drifted pixel.
    expect(AFFIX_BASE_PAD_PX).toBe(12);
  });
});
