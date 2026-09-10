import { describe, expect, it } from "vitest";

/**
 * Flat-key parity guard (2026-09-10, follow-up to the flat-loader fix):
 * buildLocaleMessages now serves top-level flat keys ("hikari::x.y": "…")
 * beside the legacy nested sections — but a key missing from a locale's
 * components.json still silently falls back to English for that locale.
 * Every flat key in the en bundle must therefore exist in ALL 11 locale
 * bundles. (This is the guard that would have caught the affixPicker/
 * messageBox flat family missing from 8 locales for months.)
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/components.json",
  { eager: true },
);

const EXPECTED_LOCALES = [
  "ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant",
];

describe("components.json flat-key parity", () => {
  const bundles = Object.entries(modules).map(([path, mod]) => ({
    locale: path.match(/locales\/([^/]+)\/components\.json/)?.[1] ?? "",
    flat: Object.fromEntries(
      Object.entries(mod.default).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>,
  }));

  it("covers all 11 locales", () => {
    expect(bundles.map((b) => b.locale).sort()).toEqual(EXPECTED_LOCALES);
  });

  it("defines every en flat key in every locale, non-empty", () => {
    const en = bundles.find((b) => b.locale === "en");
    expect(en, "en bundle renders").toBeTruthy();
    const keys = Object.keys(en!.flat);
    expect(keys.length, "en has flat keys").toBeGreaterThan(0);
    for (const { locale, flat } of bundles) {
      for (const key of keys) {
        expect(typeof flat[key], `${locale} must define ${key}`).toBe("string");
        expect((flat[key] ?? "").length, `${locale} ${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });
});
