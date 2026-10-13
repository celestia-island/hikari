import { describe, expect, it } from "vitest";
import { isSafeHref, safeHref } from "./safeHref";

describe("isSafeHref (audit hikari-R1-4)", () => {
  it("accepts the allowlisted schemes and relative forms", () => {
    for (const href of [
      "https://example.com/x",
      "http://example.com/",
      "mailto:ops@example.com",
      "tel:+810000000000",
      "/dashboard",
      "#section",
      "./relative",
      "../parent",
    ]) {
      expect(isSafeHref(href)).toBe(true);
    }
  });

  it("rejects executable and exotic schemes", () => {
    for (const href of [
      "javascript:alert(1)",
      " jAvAsCrIpT:alert(1)", // case + leading whitespace
      "vbscript:msgbox",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
    ]) {
      expect(isSafeHref(href)).toBe(false);
    }
  });

  it("rejects empty input", () => {
    expect(isSafeHref("")).toBe(false);
  });
});

describe("safeHref (audit hikari-R1-4)", () => {
  it("passes safe values through unchanged", () => {
    expect(safeHref("https://example.com/x")).toBe("https://example.com/x");
    expect(safeHref("/dashboard")).toBe("/dashboard");
  });

  it("neutralizes dangerous schemes to an inert anchor", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(safeHref(undefined)).toBe("#");
    expect(safeHref(null)).toBe("#");
  });
});
