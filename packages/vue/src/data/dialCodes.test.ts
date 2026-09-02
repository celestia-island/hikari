import { describe, expect, it } from "vitest";

import {
  DIAL_CODES,
  entryByDialCode,
  entryByIso,
  flagEmoji,
  formatE164,
  normalizeDial,
  parseE164,
} from "./dialCodes";

describe("dialCodes catalog", () => {
  it("starts with China and contains the expected shape", () => {
    expect(DIAL_CODES[0]).toMatchObject({ iso: "cn", dial: "86", en: "China", zh: "中国" });
    for (const entry of DIAL_CODES) {
      expect(entry.iso).toMatch(/^[a-z]{2}$/);
      expect(entry.dial).toMatch(/^\d+$/);
      expect(entry.en.length).toBeGreaterThan(0);
      expect(entry.zh.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ISO codes and no dangling dial codes", () => {
    const isos = new Set(DIAL_CODES.map((c) => c.iso));
    expect(isos.size).toBe(DIAL_CODES.length);
  });

  it("derives flag emoji from ISO codes", () => {
    expect(flagEmoji("cn")).toBe("🇨🇳");
    expect(flagEmoji("us")).toBe("🇺🇸");
    expect(flagEmoji("zz")).toBe("🇿🇿"); // any two letters map
    expect(flagEmoji("")).toBe("");
  });
});

describe("formatE164 / parseE164", () => {
  it("composes E.164 from dial code and national number", () => {
    expect(formatE164("+86", "13812345678")).toBe("+8613812345678");
    expect(formatE164("86", "138 1234-5678")).toBe("+8613812345678");
    expect(formatE164("0086", "13812345678")).toBe("+8613812345678");
  });

  it("returns empty for missing parts", () => {
    expect(formatE164("", "138")).toBe("");
    expect(formatE164("+86", "")).toBe("");
    expect(formatE164("+86", "  ")).toBe("");
  });

  it("round-trips a parsed E.164", () => {
    const parsed = parseE164("+8613812345678");
    expect(parsed).toEqual({ dial: "86", national: "13812345678", iso: "cn" });
    expect(formatE164(`+${parsed.dial}`, parsed.national)).toBe("+8613812345678");
  });

  it("resolves shared prefixes to the longest dial match", () => {
    // +1 → United States (first catalog entry for dial 1).
    const us = parseE164("+12125551234");
    expect(us.dial).toBe("1");
    expect(us.iso).toBe("us");
    expect(us.national).toBe("2125551234");
  });

  it("splits +852 Hong Kong without confusing +85 prefixes", () => {
    const hk = parseE164("+85291234567");
    expect(hk).toEqual({ dial: "852", national: "91234567", iso: "hk" });
  });

  it("handles a bare number without a country match", () => {
    const parsed = parseE164("99999999");
    // "99" matches no catalog dial prefix (no entry starts 99), so the
    // whole string stays national.
    expect(parsed.national).toBe("99999999");
    expect(parsed.dial).toBe("");
    expect(parsed.iso).toBeUndefined();
  });
});

describe("lookups", () => {
  it("finds entries by iso and by dial", () => {
    expect(entryByIso("JP")?.dial).toBe("81");
    expect(entryByDialCode("+81")?.iso).toBe("jp");
    expect(entryByDialCode("81")?.iso).toBe("jp");
    expect(entryByDialCode("jp")?.dial).toBe("81");
    expect(entryByDialCode("+999")).toBeUndefined();
  });

  it("normalizes dial shapes", () => {
    expect(normalizeDial("+86")).toBe("86");
    expect(normalizeDial("0086")).toBe("86");
    expect(normalizeDial("+1 234")).toBe("1234");
  });
});
