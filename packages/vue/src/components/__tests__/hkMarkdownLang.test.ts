import { describe, expect, it } from "vitest";

// Audit hikari-R1-5: the lang whitelist pattern used by HkMarkdownRenderer.
const LANG_OK = /^[a-zA-Z0-9+#._-]{1,32}$/;

describe("markdown lang whitelist", () => {
  it("accepts common language tags", () => {
    for (const lang of ["rust", "ts", "c++", "c#", "objective-c", "json5", "node.v2"]) {
      expect(LANG_OK.test(lang)).toBe(true);
    }
  });

  it("rejects injection-shaped tags", () => {
    for (const lang of [
      "<script>alert(1)</script>",
      '" onload="alert(1)',
      "<img src=x onerror=alert(1)>",
      "a b",
      "a=b",
    ]) {
      expect(LANG_OK.test(lang)).toBe(false);
    }
  });

  it("caps length", () => {
    expect(LANG_OK.test("a".repeat(33))).toBe(false);
    expect(LANG_OK.test("a".repeat(32))).toBe(true);
  });
});
