// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
/**
 * Unit contract for the shared money/currency primitives.
 *
 * The family's whole promise is that ONE text form survives the round trip
 * model → display → model, so the tests concentrate on:
 *  1. `formatMoney` renders the currency's minor-unit digits (or an explicit
 *     precision) with optional deterministic grouping, never a symbol.
 *  2. `parseMoney` accepts everything a real field receives (grouping,
 *     `,` decimal marks, currency decoration, signs, Arabic-Indic digits)
 *     and rejects everything else with `null` — never a silent 0.
 *  3. Fraction digits beyond the budget round half-up on the DIGIT STRING,
 *     so binary float dust cannot decide a money boundary
 *     (`parseMoney("1.005", 2)` is 1.01, not 1.00).
 *  4. `canonicalMoneyText` is the exact inverse for the editable surface:
 *     grouped display text and canonical text parse to the same number.
 *  5. `currencyDisplayName` degrades Intl.DisplayNames → fallback → code
 *     without throwing (this is the path a host without ICU takes).
 *  6. `normalizeCurrency` / `isValidCurrency` never mutate and never let a
 *     blank symbol/name render as a blank glyph.
 */
import { describe, expect, it } from "vitest";

import {
  canonicalMoneyText,
  currencyDisplayName,
  currencySymbol,
  formatMoney,
  isValidCurrency,
  normalizeCurrency,
  parseMoney,
  type HkCurrency,
} from "./currency";

const USD: HkCurrency = { code: "usd", symbol: "$", name: "US Dollar", decimals: 2 };
const JPY: HkCurrency = { code: "JPY", symbol: "¥", decimals: 0 };
const KWD: HkCurrency = { code: "KWD", symbol: "KD", decimals: 3 };

describe("formatMoney", () => {
  it("renders the currency's minor-unit digits and groups thousands", () => {
    expect(formatMoney(1234.5, USD)).toBe("1,234.50");
    expect(formatMoney(1234.5, JPY)).toBe("1,235");
    expect(formatMoney(1234.5, KWD)).toBe("1,234.500");
    expect(formatMoney(0, USD)).toBe("0.00");
  });

  it("honors a precision override (per-million rates) and grouping opt-out", () => {
    expect(formatMoney(0.000123, USD, { precision: 6 })).toBe("0.000123");
    expect(formatMoney(1234.5, USD, { precision: 0 })).toBe("1,235");
    expect(formatMoney(1234567.891, USD, { grouping: false })).toBe("1234567.89");
  });

  it("keeps the sign off a value that rounds to zero", () => {
    expect(formatMoney(-0.001, USD)).toBe("0.00");
    expect(formatMoney(-1234.5, USD)).toBe("-1,234.50");
    expect(formatMoney(-0, USD)).toBe("0.00");
  });

  it("renders empty for non-finite input instead of NaN", () => {
    expect(formatMoney(NaN, USD)).toBe("");
    expect(formatMoney(Infinity, USD)).toBe("");
    expect(formatMoney(-Infinity, USD)).toBe("");
  });

  it("normalizes the currency it formats (case, blank hints, short decimals)", () => {
    // `code: "usd"` — USD above — still formats; a blank symbol never leaks.
    const bare = normalizeCurrency({ code: "eur", decimals: 2, symbol: "   " });
    expect(bare).toEqual({ code: "EUR", decimals: 2 });
    expect(formatMoney(5, { code: "EUR", decimals: 2, symbol: "" })).toBe("5.00");
  });

  it("clamps absurd decimal budgets instead of throwing", () => {
    expect(formatMoney(1, USD, { precision: -3 })).toBe("1");
    expect(formatMoney(1, USD, { precision: 99 })).toBe("1.00000000");
  });
});

describe("formatMoney / canonicalMoneyText magnitude limits (S2-1)", () => {
  // The toFixed cliff: past 1e21 `Number#toFixed` returns EXPONENTIAL
  // notation ("1e+21"), which is not a money text at all — it broke the
  // canonical contract and left a controlled money field unable to parse
  // its own display. Formatting now runs on the digit string.
  it("never emits exponential notation, however large or small the amount", () => {
    const amounts = [1e21, -1e21, 1.5e21, 1.234567890123456789e21, 1e-7, 1e-21, Number.MAX_VALUE];
    for (const amount of amounts) {
      expect(formatMoney(amount, USD), `formatMoney(${amount})`).not.toMatch(/[eE]/);
      expect(formatMoney(amount, KWD, { precision: 3 })).not.toMatch(/[eE]/);
      expect(canonicalMoneyText(amount, 8)).not.toMatch(/[eE]/);
    }
  });

  it("formats 1e21 as digits and round-trips through parseMoney", () => {
    expect(formatMoney(1e21, USD)).toBe("1,000,000,000,000,000,000,000.00");
    expect(formatMoney(-1e21, USD)).toBe("-1,000,000,000,000,000,000,000.00");
    expect(formatMoney(1e21, USD, { grouping: false })).toBe("1000000000000000000000.00");
    expect(canonicalMoneyText(1e21)).toBe("1000000000000000000000");
    expect(parseMoney(formatMoney(1e21, USD), 2)).toBe(1e21);
    expect(parseMoney(canonicalMoneyText(1e21), 2)).toBe(1e21);
  });

  it("formats a 22-digit integer without losing it to an exponent", () => {
    const amount = 1234567890123456789012;
    const text = canonicalMoneyText(amount);
    expect(text).not.toMatch(/[eE]/);
    expect(text).toHaveLength(22);
    expect(parseMoney(text, 2)).toBe(amount);
    // 1.2345678901234568e+21 expands to the same 22 digits.
    expect(text).toBe("1234567890123456800000");
    expect(formatMoney(amount, USD, { grouping: false })).toBe("1234567890123456800000.00");
    expect(formatMoney(amount, USD)).toBe("1,234,567,890,123,456,800,000.00");
  });

  it("keeps the format → parse round trip stable at 18 significant digits", () => {
    const amount = 123456789012345678;
    const formatted = formatMoney(amount, USD);
    // The double's own value — the shortest round-tripping decimal — not a
    // re-rounded approximation.
    expect(formatted).toBe("123,456,789,012,345,680.00");
    expect(parseMoney(formatted, 2)).toBe(amount);
    expect(formatMoney(parseMoney(formatted, 2)!, USD), "format∘parse is idempotent").toBe(formatted);
    expect(canonicalMoneyText(amount)).toBe("123456789012345680");
    expect(parseMoney(canonicalMoneyText(amount), 2)).toBe(amount);
  });

  it("rounds sub-precision magnitudes to zero instead of spelling them exponentially", () => {
    expect(formatMoney(1e-21, USD)).toBe("0.00");
    expect(formatMoney(-1e-21, USD), "no -0.00 either").toBe("0.00");
    expect(canonicalMoneyText(1e-21, 8)).toBe("0");
    // The digit budget caps at 8 (MAX_DECIMALS): a requested precision of 9
    // renders 8 digits rather than dropping the value.
    expect(formatMoney(1e-7, USD, { precision: 9 })).toBe("0.00000010");
    expect(parseMoney(formatMoney(1e-7, USD, { precision: 9 }), 8)).toBe(1e-7);
  });

  it("stays inside the digit-string rounding rule at the extremes", () => {
    // 9.995 rounds up to 10.00 through the carry, on every path.
    expect(formatMoney(9.995, USD)).toBe("10.00");
    expect(canonicalMoneyText(9.995)).toBe("10");
    expect(parseMoney("9.995", 2)).toBe(10);
    // Number.MAX_VALUE survives the trip as the same double.
    const formatted = formatMoney(Number.MAX_VALUE, USD, { grouping: false, precision: 2 });
    expect(formatted).not.toMatch(/[eE]/);
    expect(parseMoney(formatted, 2)).toBe(Number.MAX_VALUE);
  });
});

describe("parseMoney", () => {
  it("parses the canonical text form", () => {
    expect(parseMoney("1.5", 2)).toBe(1.5);
    expect(parseMoney("1234", 2)).toBe(1234);
    expect(parseMoney("-0.25", 2)).toBe(-0.25);
    expect(parseMoney("+3", 2)).toBe(3);
    expect(parseMoney(".5", 2)).toBe(0.5);
    expect(parseMoney("0", 2)).toBe(0);
  });

  it("parses a grouped display string back to the same number", () => {
    expect(parseMoney("1,234.50", 2)).toBe(1234.5);
    expect(parseMoney("$1,234.50", 2)).toBe(1234.5);
    expect(parseMoney("USD 1,234.50", 2)).toBe(1234.5);
    expect(parseMoney("  1 234.50  ", 2)).toBe(1234.5);
    // The rightmost separator decides the decimal mark.
    expect(parseMoney("1.234,50", 2)).toBe(1234.5);
    expect(parseMoney("1.234.567", 2)).toBe(1234567);
  });

  it("reads a 3-digit tail as grouping only when the budget cannot hold it", () => {
    // 2-digit currency: `1,234` is twelve hundred.
    expect(parseMoney("1,234", 2)).toBe(1234);
    // A 3-digit currency can hold the same string as 1.234.
    expect(parseMoney("1.234", 3)).toBe(1.234);
    // A leading zero is never a grouping group.
    expect(parseMoney("0.123", 2)).toBe(0.12);
  });

  it("rounds fraction digits beyond the budget half-up on the digit string", () => {
    expect(parseMoney("1.005", 2)).toBe(1.01);
    expect(parseMoney("1.004", 2)).toBe(1);
    expect(parseMoney("1.999", 2)).toBe(2);
    expect(parseMoney("9.995", 2)).toBe(10);
    expect(parseMoney("0.5", 0)).toBe(1);
    expect(parseMoney("0.4", 0)).toBe(0);
    expect(parseMoney("-1.005", 2)).toBe(-1.01);
  });

  it("accepts Arabic-Indic digit runs and their separators", () => {
    expect(parseMoney("١٢٣٤٫٥٦", 2)).toBe(1234.56);
    expect(parseMoney("۱٬۲۳۴٫۵", 2)).toBe(1234.5);
  });

  it("returns null for anything that is not a money number", () => {
    for (const raw of [
      "",
      "   ",
      "-",
      ".",
      ",",
      "abc",
      "1.2.3",
      "1,23,456",
      "12e3",
      "--5",
      "1..2",
      null as unknown as string,
    ]) {
      expect(parseMoney(raw, 2), `${JSON.stringify(raw)} must not parse`).toBeNull();
    }
  });

  it("keeps an unset draft distinguishable from an invalid one", () => {
    // "" is the caller's "unset / follow" marker — parseMoney owns only
    // numbers, so the caller checks the raw text before calling it.
    expect(parseMoney("", 2)).toBeNull();
    expect(parseMoney("0", 2)).toBe(0);
  });
});

describe("canonicalMoneyText", () => {
  it("renders digits, at most one dot, no grouping, no symbol", () => {
    expect(canonicalMoneyText(1234.5)).toBe("1234.5");
    expect(canonicalMoneyText(12)).toBe("12");
    expect(canonicalMoneyText(0)).toBe("0");
    expect(canonicalMoneyText(-0.25)).toBe("-0.25");
  });

  it("trims trailing zeros inside the budget", () => {
    expect(canonicalMoneyText(1.5, 4)).toBe("1.5");
    expect(canonicalMoneyText(1.23456, 4)).toBe("1.2346");
    expect(canonicalMoneyText(1.23456, 6)).toBe("1.23456");
  });

  it("is the round-trip partner of parseMoney", () => {
    for (const value of [0, 1, 1.5, 1234.5, -0.25, 0.000123]) {
      const text = canonicalMoneyText(value, 6);
      expect(parseMoney(text, 6), `${value} round-trips through ${text}`).toBe(value);
    }
    // Formatted display text round-trips too.
    const display = formatMoney(1234.5, USD);
    expect(parseMoney(display, 2)).toBe(1234.5);
  });

  it("renders empty for non-finite input", () => {
    expect(canonicalMoneyText(NaN)).toBe("");
    expect(canonicalMoneyText(Infinity)).toBe("");
  });
});

describe("currencyDisplayName", () => {
  it("resolves a localized name via Intl.DisplayNames", () => {
    const en = currencyDisplayName("USD", "en");
    expect(en.length).toBeGreaterThan(0);
    expect(en).not.toBe("USD");
    expect(currencyDisplayName("jpy", "en").length).toBeGreaterThan(0);
  });

  it("falls back to the caller's label, then to the code", () => {
    expect(currencyDisplayName("ZZZ", "en", "Zeta")).toBe("Zeta");
    expect(currencyDisplayName("ZZZ", "en")).toBe("ZZZ");
    expect(currencyDisplayName("", "en", "Nameless")).toBe("Nameless");
    expect(currencyDisplayName("", "en")).toBe("");
  });

  it("survives a malformed locale instead of throwing", () => {
    expect(currencyDisplayName("USD", "not a locale!!", "US Dollar")).toBe("US Dollar");
  });
});

describe("normalizeCurrency / isValidCurrency / currencySymbol", () => {
  it("normalizes without mutating the input", () => {
    const input = { code: " usd ", symbol: " $ ", name: " US Dollar ", decimals: 2 };
    const out = normalizeCurrency(input);
    expect(out).toEqual({ code: "USD", symbol: "$", name: "US Dollar", decimals: 2 });
    expect(input.code).toBe(" usd ");
  });

  it("tolerates a missing currency and clamps the digit count", () => {
    expect(normalizeCurrency(undefined)).toEqual({ code: "", decimals: 2 });
    expect(normalizeCurrency({ code: "USD", decimals: 2.7 }).decimals).toBe(2);
    expect(normalizeCurrency({ code: "USD", decimals: -1 }).decimals).toBe(0);
    expect(normalizeCurrency({ code: "USD", decimals: 99 }).decimals).toBe(8);
  });

  it("validates the structural shape a host model row has", () => {
    expect(isValidCurrency({ code: "USD", decimals: 2 })).toBe(true);
    expect(isValidCurrency({ code: "USDT", decimals: 2 })).toBe(true);
    expect(isValidCurrency({ code: "usd", decimals: 2, symbol: "$" })).toBe(true);
    expect(isValidCurrency({ code: "USD", decimals: 2, extra: true })).toBe(true);
    expect(isValidCurrency(null)).toBe(false);
    expect(isValidCurrency("USD")).toBe(false);
    expect(isValidCurrency({ code: "", decimals: 2 })).toBe(false);
    expect(isValidCurrency({ code: "US$", decimals: 2 })).toBe(false);
    expect(isValidCurrency({ code: "USD", decimals: 2.5 })).toBe(false);
    expect(isValidCurrency({ code: "USD" })).toBe(false);
    expect(isValidCurrency({ code: "USD", decimals: 2, symbol: 5 })).toBe(false);
  });

  it("renders a glyph for every currency", () => {
    expect(currencySymbol(USD)).toBe("$");
    expect(currencySymbol({ code: "eur", decimals: 2 })).toBe("EUR");
    expect(currencySymbol({ code: "eur", decimals: 2, symbol: "  " })).toBe("EUR");
  });
});
