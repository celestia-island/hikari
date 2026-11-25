import { describe, expect, it } from "vitest";

import { HK_LOCALE_CATALOG } from "./localeCatalog";

/**
 * Catalog↔bundle parity (the TS mirror of the hikari-i18n crate's
 * `Language::ALL`): every language hikari ships message bundles for must
 * appear in the catalog, and every catalog entry must have a bundle —
 * the same two-directional guard flatKeyParity.test.ts runs for keys.
 * A locale added to `locales/` without a catalog entry is uneditable in
 * every HkLocalizedInput that rides the default catalog; a catalog entry
 * without a bundle offers a language the UI cannot translate into.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/*.json",
  { eager: true },
);

const bundledLocales = new Set(
  Object.keys(modules).map((p) => p.match(/\.\/locales\/([^/]+)\//)?.[1] ?? ""),
);
const catalogCodes = new Set(HK_LOCALE_CATALOG.map((e) => e.code));

describe("hikari locale catalog", () => {
  it("covers every shipped locale bundle", () => {
    const missing = [...bundledLocales].filter((c) => !catalogCodes.has(c));
    expect(missing, "locale bundles missing from HK_LOCALE_CATALOG").toEqual([]);
  });

  it("offers no language without a bundle", () => {
    const extra = [...catalogCodes].filter((c) => !bundledLocales.has(c));
    expect(extra, "catalog entries without a message bundle").toEqual([]);
  });

  it("stays in sync with the documented language set", () => {
    // The exact 11-language set the hikari-i18n crate pins (Language::ALL).
    expect([...catalogCodes].sort()).toEqual(
      ["ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant"],
    );
  });
});
