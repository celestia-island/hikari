import { describe, expect, it } from "vitest";

/**
 * The `hikari::modal.*` family is the window chrome's own vocabulary
 * (stack label, unnamed-window/sheet fallbacks, the hidden-layers menu),
 * referenced from source by literal key with an English fallback.
 *
 * flatKeyParity.test.ts proves the locales AGREE with en — but it takes
 * `Object.keys(en)` as its reference set, so a key deleted FROM en shrinks
 * the checked set and the family silently drops to the hard-coded literal
 * in every language. These keys are therefore pinned by name.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/components.json",
  { eager: true },
);

const EXPECTED_LOCALES = [
  "ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant",
];

const REQUIRED_KEYS = [
  "hikari::modal.stackLabel",
  "hikari::modal.unnamedSheet",
  "hikari::modal.unnamedWindow",
  "hikari::modal.hiddenLayers",
];

describe("hikari::modal locale keys", () => {
  it("covers all 11 components.json locale files", () => {
    const paths = Object.keys(modules)
      .map((path) => path.match(/locales\/([^/]+)\/components\.json/)?.[1])
      .filter((locale): locale is string => Boolean(locale))
      .sort();
    expect(paths).toEqual(EXPECTED_LOCALES);
  });

  /** The loader's own merge (i18n/context.ts buildLocaleMessages): flat
   *  leaves plus one level of legacy nested sections. */
  function flatten(bundle: Record<string, unknown>): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(bundle)) {
      if (typeof value === "string") merged[key] = value;
      else if (value !== null && typeof value === "object") Object.assign(merged, value);
    }
    return merged;
  }

  it("defines every hikari::modal.* key in every locale", () => {
    for (const [path, mod] of Object.entries(modules)) {
      const bundle = flatten(mod.default);
      for (const key of REQUIRED_KEYS) {
        const value = bundle[key];
        expect(typeof value, `${path} must define ${key}`).toBe("string");
        expect(String(value ?? "").length, `${path} ${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });
});
