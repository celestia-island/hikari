import { describe, expect, it } from "vitest";

import { passwordLevel, validatePassword } from "./password";

describe("validatePassword", () => {
  it("returns valid for matching passwords >= 8 chars with letters and digits", () => {
    const result = validatePassword("password123", "password123");
    expect(result.valid).toBe(true);
    expect(result.errorKey).toBeNull();
  });

  it("returns mismatch when passwords differ", () => {
    const result = validatePassword("password1", "password2");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("common.validation.passwordMismatch");
  });

  it("returns minLength when password < 8 chars", () => {
    const result = validatePassword("short", "short");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("common.validation.minLength");
  });

  it("prioritises mismatch over minLength", () => {
    const result = validatePassword("abc", "xyz");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("common.validation.passwordMismatch");
  });

  it("accepts an exactly 8-char password with letters and digits", () => {
    const result = validatePassword("pass1234", "pass1234");
    expect(result.valid).toBe(true);
  });

  it("rejects digits-only password as needing variety", () => {
    const result = validatePassword("12345678", "12345678");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("common.validation.passwordNeedsVariety");
  });

  it("rejects letters-only password as needing variety", () => {
    const result = validatePassword("password", "password");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("common.validation.passwordNeedsVariety");
  });

  it("rejects empty passwords with minLength", () => {
    const result = validatePassword("", "");
    expect(result.valid).toBe(false);
    expect(result.errorKey).toBe("common.validation.minLength");
  });
});

describe("passwordLevel", () => {
  it("returns null for empty password", () => {
    expect(passwordLevel("")).toBeNull();
  });

  it("returns weak when below 8 chars", () => {
    expect(passwordLevel("Ab1")).toBe("weak");
  });

  it("returns weak for 8 chars without digits", () => {
    expect(passwordLevel("password")).toBe("weak");
  });

  it("returns fair for 8 chars with letters and digits", () => {
    expect(passwordLevel("pass1234")).toBe("fair");
  });

  it("returns strong for 10+ chars with upper, lower, and special", () => {
    expect(passwordLevel("Pass1234!x")).toBe("strong");
  });

  it("returns fair (not strong) when missing special char", () => {
    expect(passwordLevel("Password1234")).toBe("fair");
  });
});
