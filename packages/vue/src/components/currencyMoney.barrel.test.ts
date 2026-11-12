// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { describe, expect, it } from "vitest";

import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * The public barrel guard for the money/currency family (the
 * HkAddTile.barrel.test.ts shape): deleting the export lines from index.ts
 * kept the ENTIRE suite green while every component test still reached the
 * module through its direct "./Hk…" path — only an external consumer would
 * have noticed. This file pins BOTH names each component ships under (the
 * `Hk` family and the `H` alias) plus the shared money primitives, so a host
 * can rely on one import path for the whole pricing surface.
 *
 * This file deliberately does NOT mock "@celestia-island/hikari": the
 * package's self-reference resolves to the very same src/index.ts module as
 * "../index", so a vi.mock here would replace the barrel under test with the
 * mock's own namespace.
 */
describe("the public barrel", () => {
  it("exports every money/currency component under both family names", () => {
    for (const name of ["CurrencySelect", "MoneyInput", "Price", "EditableTable"] as const) {
      const hk = asIndexable(barrel[`Hk${name}`]);
      expect(hk, `Hk${name} must be re-exported`).toBeTruthy();
      expect(hk.name).toBe(`Hk${name}`);
      expect(barrel[`H${name}`], `H${name} must alias Hk${name}`).toBe(barrel[`Hk${name}`]);
    }
  });

  it("exports the shared money primitives", () => {
    for (const name of [
      "canonicalMoneyText",
      "currencyDisplayName",
      "currencySymbol",
      "formatMoney",
      "isValidCurrency",
      "normalizeCurrency",
      "parseMoney",
    ] as const) {
      expect(typeof barrel[name], `${name} must be re-exported`).toBe("function");
    }
  });

  it("re-exports a working money pipeline (not a hollow re-export)", () => {
    const usd = { code: "usd", symbol: "$", decimals: 2 };
    expect(barrel.formatMoney(1234.5, usd)).toBe("1,234.50");
    expect(barrel.parseMoney("1,234.50", 2)).toBe(1234.5);
    expect(barrel.canonicalMoneyText(1234.5)).toBe("1234.5");
    expect(barrel.normalizeCurrency(usd).code).toBe("USD");
    expect(barrel.currencySymbol(barrel.normalizeCurrency(usd))).toBe("$");
    expect(barrel.isValidCurrency(usd)).toBe(true);
    expect(typeof barrel.currencyDisplayName("USD", "en")).toBe("string");
  });
});
