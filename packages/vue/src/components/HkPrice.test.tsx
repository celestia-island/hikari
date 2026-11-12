// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
/**
 * HkPrice — display contract.
 *
 * Pinned guarantees:
 *  1. The primary amount uses the currency's minor-unit digits, or an
 *     explicit `precision` (rates, fractional cents), and carries a `unit`
 *     suffix (`/1M`) when given.
 *  2. `null` / `undefined` / non-finite amounts render a calm em dash with a
 *     "Not set" accessible name — never `0`, never `NaN`; an amount of `0`
 *     still renders `0.00` (unset ≠ zero).
 *  3. A reference conversion renders ONLY for a finite, strictly positive
 *     rate — a missing, zero, negative or NaN rate renders the primary
 *     amount alone, so an amount is never converted by a fabricated rate.
 *  4. The approximate value is auditable: its tooltip (`title` fallback and
 *     the HkTooltip surface) names the rate and the `asOf` stamp.
 *  5. Figures are tabular (root class + sheet contract) and both variants
 *     (text / chip) and sizes (sm / md) are class-switched.
 *  6. a11y: the currency CODE travels with the digits (a bare `$` is
 *     ambiguous), decorative glyphs are hidden.
 */
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, h } from "vue";

import HkPrice from "./HkPrice";
import type { HkCurrency } from "../utils/currency";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkPrice.scss"), "utf-8");
const source = readFileSync(join(here, "HkPrice.tsx"), "utf-8");

const USD: HkCurrency = { code: "USD", symbol: "$", decimals: 2 };
const CNY: HkCurrency = { code: "CNY", symbol: "¥", decimals: 2 };
const JPY: HkCurrency = { code: "JPY", symbol: "¥", decimals: 0 };

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

afterEach(() => {
  for (const { app, container } of mounts.splice(0)) {
    app.unmount();
    container.remove();
  }
});

function mount(props: Record<string, unknown>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () => h(HkPrice, { currency: USD, ...props }),
  });
  app.mount(container);
  mounts.push({ app, container });
  return container.firstElementChild as HTMLElement;
}

function text(root: HTMLElement, selector: string): string {
  return root.querySelector(selector)?.textContent?.trim() ?? "";
}

describe("HkPrice primary amount", () => {
  it("formats with the currency's minor-unit digits", () => {
    const root = mount({ amount: 1234.5 });
    expect(text(root, ".hk-price-symbol")).toBe("$");
    expect(text(root, ".hk-price-amount")).toBe("1,234.50");
    expect(root.classList.contains("hk-price-text")).toBe(true);
    expect(root.classList.contains("hk-price-md")).toBe(true);
  });

  it("honors a precision override", () => {
    expect(text(mount({ amount: 0.0001234, precision: 6 }), ".hk-price-amount")).toBe("0.000123");
    expect(text(mount({ amount: 1234.5, precision: 0 }), ".hk-price-amount")).toBe("1,235");
  });

  it("appends the unit suffix", () => {
    const root = mount({ amount: 12, unit: "/1M" });
    expect(text(root, ".hk-price-unit")).toBe("/1M");
  });

  it("renders zero as an amount, not as unset", () => {
    const root = mount({ amount: 0 });
    expect(text(root, ".hk-price-amount")).toBe("0.00");
    expect(root.querySelector(".hk-price-empty")).toBeNull();
  });

  it("switches the variant and size classes", () => {
    const root = mount({ amount: 1, variant: "chip", size: "sm" });
    expect(root.classList.contains("hk-price-chip")).toBe(true);
    expect(root.classList.contains("hk-price-sm")).toBe(true);
    expect(root.classList.contains("hk-price-text")).toBe(false);
  });

  it("announces the currency code beside the digits", () => {
    const root = mount({ amount: 5 });
    const sr = [...root.querySelectorAll(".hk-price-sr")].map((node) => node.textContent);
    expect(sr).toContain("USD");
    expect(root.querySelector(".hk-price-symbol")!.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("HkPrice unset amounts", () => {
  it("renders a calm em dash for null / undefined / NaN", () => {
    for (const amount of [null, undefined, NaN]) {
      const root = mount({ amount });
      expect(root.querySelector(".hk-price-empty"), `${String(amount)} renders empty`).not.toBeNull();
      expect(text(root, ".hk-price-amount")).toBe("");
      expect(text(root, ".hk-price-empty")).toContain("—");
      expect(text(root, ".hk-price-sr")).toBe("Not set");
      expect(root.textContent).not.toContain("NaN");
      expect(root.querySelector(".hk-price-symbol")).toBeNull();
    }
  });

  it("stays quiet: no error/warn tone class on an unset amount", () => {
    const root = mount({ amount: null });
    expect(root.classList.contains("hk-price-chip")).toBe(false);
    expect(root.innerHTML).not.toMatch(/error|danger/i);
  });
});

describe("HkPrice reference conversion", () => {
  it("renders the approximate value from a positive rate", () => {
    const root = mount({
      amount: 100,
      reference: { currency: CNY, rate: 7.24, asOf: "2026-11-01" },
    });
    expect(text(root, ".hk-price-reference")).toContain("≈");
    expect(text(root, ".hk-price-ref-symbol")).toBe("¥");
    expect(text(root, ".hk-price-ref-amount"), "the reference uses ITS currency's digits").toBe(
      "724.00",
    );
  });

  it("names the rate and the as-of stamp in the hint (title + tooltip)", () => {
    const root = mount({
      amount: 100,
      reference: { currency: CNY, rate: 7.24, asOf: "2026-11-01" },
    });
    const reference = root.querySelector<HTMLElement>(".hk-price-reference")!;
    const title = reference.getAttribute("title")!;
    expect(title).toContain("1 USD = 7.24 CNY");
    expect(title).toContain("2026-11-01");
    // Focusable trigger for the HkTooltip surface (keyboard parity).
    expect(reference.getAttribute("tabindex")).toBe("0");
    expect(root.querySelector(".hk-tooltip-wrapper"), "HkTooltip owns the popup").not.toBeNull();
  });

  it("omits the as-of clause when the host has no stamp", () => {
    const root = mount({ amount: 1, reference: { currency: CNY, rate: 7 } });
    const title = root.querySelector(".hk-price-reference")!.getAttribute("title")!;
    expect(title).toContain("1 USD = 7 CNY");
    expect(title).not.toContain("As of");
  });

  it("renders a currency code glyph when the reference has no symbol", () => {
    const root = mount({
      amount: 1,
      reference: { currency: { code: "USDT", decimals: 2 }, rate: 1 },
    });
    expect(text(root, ".hk-price-ref-symbol")).toBe("USDT");
  });

  it("never fabricates a conversion for a missing / zero / negative / NaN rate", () => {
    for (const rate of [0, -1, NaN, Infinity, null, "7.2"]) {
      const root = mount({ amount: 100, reference: { currency: CNY, rate } });
      expect(
        root.querySelector(".hk-price-reference"),
        `rate ${String(rate)} must not convert`,
      ).toBeNull();
      expect(text(root, ".hk-price-amount")).toBe("100.00");
    }
    // No reference prop at all.
    expect(mount({ amount: 100 }).querySelector(".hk-price-reference")).toBeNull();
  });

  it("renders the primary amount alone when the reference currency has no code", () => {
    const root = mount({ amount: 100, reference: { currency: { code: "", decimals: 2 }, rate: 7 } });
    expect(root.querySelector(".hk-price-reference")).toBeNull();
  });

  it("does not render a conversion for an unset amount", () => {
    const root = mount({ amount: null, reference: { currency: CNY, rate: 7.24 } });
    expect(root.querySelector(".hk-price-reference")).toBeNull();
    expect(text(root, ".hk-price-empty")).toContain("—");
  });

  it("keeps the digits of a zero-rate reference currency out of speech", () => {
    const root = mount({ amount: 1, reference: { currency: CNY, rate: 7 } });
    const codes = [...root.querySelectorAll(".hk-price-sr")].map((node) => node.textContent);
    expect(codes).toEqual(["USD", "Approximate", "CNY"]);
  });
});

describe("HkPrice sheet + source contract", () => {
  it("keeps figures tabular", () => {
    expect(scss).toContain("font-variant-numeric: tabular-nums");
    expect(scss).toContain(".hk-price-chip");
    expect(scss).toContain(".hk-price-sm");
  });

  it("derives the displayed numbers from the shared money helpers", () => {
    expect(source).toContain("formatMoney");
    // The guard has to be in the source, not only in behavior: a rate is
    // evidence, and evidence must be finite and positive.
    expect(source).toContain("rate <= 0");
  });
});
