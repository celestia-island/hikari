import { describe, expect, it } from "vitest";

import { setLocale, useI18n } from "./context";

/**
 * Locale key pack for the formatRelativeTime facility
 * (common.time.justNow/minutesAgo/hoursAgo/daysAgo/weeksAgo, served from
 * the new locales/<lang>/time.json bundles). The JSON keys are the literal
 * unprefixed full names because t() resolves by exact full-name match
 * (context.ts merges string leaves under their literal key) and the
 * facility + its host-t consumers call t("common.time.*") unprefixed —
 * the "hikari::" prefix convention is reserved for
 * hikari-component-owned keys. A key missing from any locale silently
 * falls back to English there, so every locale must define all five keys
 * with matching {n} placeholder presence (hikari review lessons
 * #373/#374, same shape as contextKeys.test.ts).
 */
const modules = import.meta.glob<{ default: Record<string, Record<string, string>> }>(
  "./locales/*/time.json",
  { eager: true },
);

const EXPECTED_LOCALES = [
  "ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant",
];

const REQUIRED_KEYS = [
  "common.time.justNow",
  "common.time.minutesAgo",
  "common.time.hoursAgo",
  "common.time.daysAgo",
  "common.time.weeksAgo",
];

describe("common.time locale keys", () => {
  const bundles = Object.entries(modules).map(([path, mod]) => ({
    locale: path.match(/locales\/([^/]+)\/time\.json/)?.[1] ?? "",
    flat: mod.default.time ?? {},
  }));

  it("covers all 11 time.json locale files", () => {
    expect(bundles.map((b) => b.locale).sort()).toEqual(EXPECTED_LOCALES);
  });

  it("defines all 5 common.time.* keys in every locale, non-empty", () => {
    for (const { locale, flat } of bundles) {
      for (const key of REQUIRED_KEYS) {
        expect(typeof flat[key], `${locale} must define ${key}`).toBe("string");
        expect((flat[key] ?? "").length, `${locale} ${key} must not be empty`).toBeGreaterThan(0);
      }
    }
  });

  it("matches the {n} placeholder pattern of en in every locale", () => {
    const en = bundles.find((b) => b.locale === "en");
    expect(en, "en bundle renders").toBeTruthy();
    for (const { locale, flat } of bundles) {
      for (const key of REQUIRED_KEYS) {
        const wantsN = en!.flat[key].includes("{n}");
        expect(flat[key].includes("{n}"), `${locale} ${key} {n} parity`).toBe(wantsN);
      }
    }
  });

  it("resolves through useI18n at runtime, per locale", async () => {
    await setLocale("zh-Hans");
    const zh = useI18n();
    expect(zh.t("common.time.justNow", "Just now")).toBe("刚刚");
    expect(zh.t("common.time.hoursAgo", "{n} h ago").replace("{n}", "3")).toBe("3 小时前");

    await setLocale("de");
    const de = useI18n();
    expect(de.t("common.time.daysAgo", "{n} d ago").replace("{n}", "2")).toBe("vor 2 Tg.");

    await setLocale("en");
    const en = useI18n();
    expect(en.t("common.time.weeksAgo", "{n} w ago")).toBe("{n} w ago");
  });
});
