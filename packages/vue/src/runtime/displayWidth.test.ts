import { describe, expect, it } from "vitest";

import {
  clampToDisplayWidth,
  displayWidthUnits,
  ELLIPSIS,
  glyphWidthUnits,
} from "./displayWidth";

describe("displayWidthUnits", () => {
  it("measures one ideograph as one unit and one Latin glyph as half", () => {
    expect(displayWidthUnits("中文")).toBe(2);
    expect(displayWidthUnits("ab")).toBe(1);
    expect(displayWidthUnits("测试 ab")).toBe(3.5);
  });

  it("covers kana, hangul, CJK punctuation and full-width forms", () => {
    expect(displayWidthUnits("テスト")).toBe(3);
    expect(displayWidthUnits("한글")).toBe(2);
    expect(displayWidthUnits("：、【】")).toBe(4);
    expect(displayWidthUnits("ＡＢ")).toBe(2);
  });

  it("counts an astral ideograph once, not once per surrogate", () => {
    // U+20000 (CJK ext B) is a surrogate pair in UTF-16.
    expect(displayWidthUnits("\u{20000}")).toBe(1);
    expect(displayWidthUnits("\u{1F600}")).toBe(1);
  });

  it("counts a non-wide astral glyph as ONE half-width glyph", () => {
    // U+10400 (Deseret) is astral but outside the wide ranges: half a unit.
    // A UTF-16 code-unit walk would read the lone surrogate halves (both
    // 0.5) and charge a full unit — every such label would then be cut one
    // glyph early.
    expect(displayWidthUnits("\u{10400}")).toBe(0.5);
    expect(displayWidthUnits("\u{10400}\u{10401}")).toBe(1);
    expect(clampToDisplayWidth("\u{10400}\u{10401}\u{10402}", 1.5)).toBe(
      `\u{10400}\u{10401}\u{10402}`,
    );
    // Four such glyphs are 2 units; a 1.5-unit budget keeps half a unit of
    // them (the ellipsis takes the other) — a code-unit walk would have
    // charged the first glyph a full unit and kept NONE of it.
    expect(clampToDisplayWidth("\u{10400}\u{10401}\u{10402}\u{10403}", 1.5)).toBe(
      `\u{10400}${ELLIPSIS}`,
    );
  });

  it("gives combining marks and joiners no width of their own", () => {
    expect(displayWidthUnits("e\u0301")).toBe(0.5);
    expect(displayWidthUnits("\u200B")).toBe(0);
    expect(displayWidthUnits("中\uFE0F")).toBe(1);
  });

  it("measures empty and missing text as zero", () => {
    expect(displayWidthUnits("")).toBe(0);
    expect(glyphWidthUnits("")).toBe(0);
  });
});

describe("clampToDisplayWidth", () => {
  it("returns text that already fits byte-for-byte", () => {
    // Exactly at the budget is a fit — the cap is a maximum.
    expect(clampToDisplayWidth("自动化测试流水线冒烟", 10)).toBe("自动化测试流水线冒烟");
    expect(clampToDisplayWidth("abcdefghijklmnopqrst", 10)).toBe("abcdefghijklmnopqrst");
    expect(clampToDisplayWidth("", 10)).toBe("");
  });

  it("keeps the ellipsis inside the budget", () => {
    const cut = clampToDisplayWidth("自动化测试流水线冒烟请", 10);
    expect(cut).toBe(`自动化测试流水线冒${ELLIPSIS}`);
    expect(displayWidthUnits(cut)).toBeLessThanOrEqual(10);
  });

  it("cuts on whole code points, never inside one", () => {
    // 9 units of budget = exactly 18 half-width glyphs.
    const cut = clampToDisplayWidth("abcdefghijklmnopqrstu", 10);
    expect(cut).toBe(`abcdefghijklmnopqr${ELLIPSIS}`);
    const mixed = clampToDisplayWidth("【e2e-w0-002310】自动化测试流水线冒烟", 10);
    expect(mixed).toBe(`【e2e-w0-002310】${ELLIPSIS}`);
    expect(mixed).not.toContain("\uFFFD");
  });

  it("pulls trailing whitespace back under the cut", () => {
    // A 6-unit budget keeps ten half-width glyphs — "hello wor " here — and
    // the ellipsis must not float away from the word it closes.
    expect(clampToDisplayWidth("hello wor ld again", 6)).toBe(`hello wor${ELLIPSIS}`);
  });

  it("degrades predictably for degenerate budgets", () => {
    expect(clampToDisplayWidth("中文", 0)).toBe("");
    expect(clampToDisplayWidth("中文", -3)).toBe("");
    // A budget the ellipsis alone fills keeps the ellipsis, nothing else.
    expect(clampToDisplayWidth("中文", 1)).toBe(ELLIPSIS);
  });

  it("honours a custom ellipsis", () => {
    expect(clampToDisplayWidth("自动化测试流水线冒烟", 10, "...")).toBe("自动化测试流水线冒烟");
    // "..." costs three half-width glyphs, so the cut lands two ideographs
    // earlier than the single-glyph ellipsis' would.
    expect(clampToDisplayWidth("自动化测试流水线冒烟请", 10, "...")).toBe("自动化测试流水线...");
  });
});
