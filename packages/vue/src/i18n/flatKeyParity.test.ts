import { describe, expect, it } from "vitest";

/**
 * Flat-key parity guard (2026-09-10, follow-up to the flat-loader fix):
 * buildLocaleMessages now serves top-level flat keys ("hikari::x.y": "…")
 * beside the legacy nested sections — but a key missing from a locale's
 * components.json still silently falls back to English for that locale.
 * Every flat key in the en bundle must therefore exist in ALL 11 locale
 * bundles. (This is the guard that would have caught the affixPicker/
 * messageBox flat family missing from 8 locales for months.)
 *
 * Nested-section parity (2026-09-17, follow-up to the password-field
 * unification): the SAME silent-fallback applies to string leaves inside
 * the legacy nested "components" object — the entire
 * hikari::passwordInput.* family lives there with ZERO cross-locale
 * coverage (proven by mutation: deleting strengthLabel from en — or
 * from any single locale — left every test green while that locale
 * silently fell back to English at runtime). The key sets of every
 * nested section must therefore match en's BIDIRECTIONALLY: no locale
 * may lack an en key, and no locale may carry a key en does not know
 * (the reverse direction is what catches the key deleted from en only).
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/components.json",
  { eager: true },
);

const EXPECTED_LOCALES = [
  "ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant",
];

/** String leaves of every nested object section, keyed "section::leaf",
 *  plus the list of NON-STRING leaves (a nested object/number where a
 *  message string belongs is a bundle-shape bug — the old skip-only
 *  behavior let it smuggle past the bidirectional key-set check). */
function nestedStringLeaves(bundle: Record<string, unknown>): {
  leaves: Record<string, string>;
  nonStringLeaves: string[];
} {
  const leaves: Record<string, string> = {};
  const nonStringLeaves: string[] = [];
  for (const [section, value] of Object.entries(bundle)) {
    if (value === null || typeof value !== "object") continue;
    for (const [key, leaf] of Object.entries(value as Record<string, unknown>)) {
      if (typeof leaf === "string") leaves[`${section}::${key}`] = leaf;
      else nonStringLeaves.push(`${section}::${key}`);
    }
  }
  return { leaves, nonStringLeaves };
}

/** Intentional locale-specific keys: HkStatusBar region names are
 * OPTIONAL per-locale overrides (missing key → Intl.DisplayNames → raw
 * region code, see resolveRegionName); the zh families carry them
 * because the Intl names are unusable there, not because en forgot
 * them. Everything else must exist in en. */
const LOCALE_SPECIFIC_NESTED: Record<string, string[]> = {
  "zh-Hans": ["components::hikari::statusBar.region.CN", "components::hikari::statusBar.region.HK", "components::hikari::statusBar.region.MO", "components::hikari::statusBar.region.TW"],
  "zh-Hant": ["components::hikari::statusBar.region.CN", "components::hikari::statusBar.region.HK", "components::hikari::statusBar.region.MO", "components::hikari::statusBar.region.TW"],
};

describe("components.json flat-key parity", () => {
  const bundles = Object.entries(modules).map(([path, mod]) => ({
    locale: path.match(/locales\/([^/]+)\/components\.json/)?.[1] ?? "",
    flat: Object.fromEntries(
      Object.entries(mod.default).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string>,
    flatAll: Object.keys(mod.default).filter(
      (k) => typeof mod.default[k] === "string",
    ),
    nested: nestedStringLeaves(mod.default).leaves,
    nonStringLeaves: nestedStringLeaves(mod.default).nonStringLeaves,
  }));

  it("covers all 11 locales", () => {
    expect(bundles.map((b) => b.locale).sort()).toEqual(EXPECTED_LOCALES);
  });

  it("keeps every nested leaf a string", () => {
    // A nested object/number where a message belongs would silently
    // fall back to English at runtime while the key-set checks stay
    // green (the skip-only leaf collection let exactly that smuggle).
    for (const { locale, nonStringLeaves } of bundles) {
      expect(nonStringLeaves, `${locale} has non-string nested leaves`).toEqual([]);
    }
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

  it("carries no flat key unknown to en", () => {
    // Reverse direction of the flat check: a key deleted from en only
    // (or smuggled into one locale) must not survive either.
    const en = bundles.find((b) => b.locale === "en");
    expect(en, "en bundle renders").toBeTruthy();
    for (const { locale, flatAll } of bundles) {
      expect(
        flatAll.filter((k) => !(k in en!.flat)),
        `${locale} must not carry flat keys unknown to en`,
      ).toEqual([]);
    }
  });

  it("matches the en nested-section key set in every locale, both directions", () => {
    const en = bundles.find((b) => b.locale === "en");
    expect(en, "en bundle renders").toBeTruthy();
    const enKeys = Object.keys(en!.nested).sort();
    expect(enKeys.length, "en has nested-section keys").toBeGreaterThan(0);
    // Self-check against a known member so a loader/shape regression
    // cannot hollow this guard into a vacuous pass (zero keys = zero
    // protection — the 2026-09-17 mutation survived exactly that way
    // for the flat-only variant of this test).
    expect(enKeys, "the passwordInput family is nested").toContain(
      "components::hikari::passwordInput.strengthLabel",
    );
    for (const { locale, nested } of bundles) {
      const allowed = LOCALE_SPECIFIC_NESTED[locale] ?? [];
      const localeKeys = Object.keys(nested).sort();
      expect(
        localeKeys.filter((k) => !enKeys.includes(k) && !allowed.includes(k)),
        `${locale} must not carry keys unknown to en`,
      ).toEqual([]);
      expect(
        enKeys.filter((k) => !localeKeys.includes(k)),
        `${locale} must define every en nested key`,
      ).toEqual([]);
      for (const key of enKeys) {
        expect((nested[key] ?? "").length, `${locale} ${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });
});
