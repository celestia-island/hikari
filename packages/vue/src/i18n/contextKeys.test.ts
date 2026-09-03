import { describe, expect, it } from "vitest";

/**
 * Lightweight i18n completeness guard for the hikari::context.* key family
 * (added for the HkContextRing popover). Every key must exist in ALL 11
 * locale chat.json files at the same flat level as the hikari::model.*
 * keys — a key landing in the wrong file/level silently falls back to
 * English for every non-en locale (hikari review lessons #373/#374).
 */
const modules = import.meta.glob<{ default: Record<string, Record<string, string>> }>(
  "./locales/*/chat.json",
  { eager: true },
);

const EXPECTED_LOCALES = [
  "ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant",
];

const REQUIRED_KEYS = [
  "hikari::context.title",
  "hikari::context.estimated",
  "hikari::context.used",
  "hikari::context.of",
  "hikari::context.window",
  "hikari::context.prompt",
  "hikari::context.user",
  "hikari::context.thinking",
  "hikari::context.tool",
  "hikari::context.output",
  "hikari::context.free",
];

describe("hikari::context locale keys", () => {
  it("covers all 11 chat.json locale files", () => {
    const paths = Object.keys(modules)
      .map((p) => p.match(/locales\/([^/]+)\/chat\.json/)?.[1])
      .filter((l): l is string => Boolean(l))
      .sort();
    expect(paths).toEqual(EXPECTED_LOCALES);
  });

  it("defines every hikari::context.* key in every locale", () => {
    for (const [path, mod] of Object.entries(modules)) {
      const chat = mod.default.chat ?? {};
      for (const key of REQUIRED_KEYS) {
        const value = chat[key];
        expect(typeof value, `${path} must define ${key}`).toBe("string");
        expect((value ?? "").length, `${path} ${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });
});
