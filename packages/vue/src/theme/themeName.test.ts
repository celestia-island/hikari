// Theme display-name resolution (2026-11-25 user direction): the
// three-answer grammar — per-locale map, message-key convention, raw
// name — with the zh family mutual fallback. The negative directions are
// pinned because each one is a silent English leak on a translated face:
// a map must win over the key answer, an empty map must NOT shadow the
// keyed stock name, and a literal name must pass through unchanged.
import { describe, expect, it } from "vitest";

import { resolveThemeDisplayName } from "./themeName";
import { setLocale, useI18n } from "../i18n/context";

const literalT = (key: string): string => {
  // Stand-in translator: catalog keys resolve to a marker, everything
  // else passes through — the same shape hikari's real t() has.
  return key === "hikari::theme.defaultThemeName" ? "默认" : key;
};

describe("resolveThemeDisplayName", () => {
  it("prefers the theme's own per-locale map for the active locale", () => {
    const name = resolveThemeDisplayName(
      "Midnight",
      { en: "Midnight", "zh-Hans": "午夜", ja: "真夜中" },
      "ja",
      literalT,
    );
    expect(name).toBe("真夜中");
  });

  it("falls back across the zh family before leaving the language", () => {
    // zh-Hant face, map only covers zh-Hans: the shared vocabulary wins
    // over en.
    expect(
      resolveThemeDisplayName("M", { "zh-Hans": "午夜", en: "Midnight" }, "zh-Hant", literalT),
    ).toBe("午夜");
    expect(
      resolveThemeDisplayName("M", { "zh-Hant": "午夜", en: "Midnight" }, "zh-Hans", literalT),
    ).toBe("午夜");
    // No zh entry at all → en, then first non-empty.
    expect(resolveThemeDisplayName("M", { en: "Midnight", de: "Mitternacht" }, "zh-Hans", literalT)).toBe("Midnight");
    expect(resolveThemeDisplayName("M", { de: "Mitternacht" }, "zh-Hans", literalT)).toBe("Mitternacht");
  });

  it("resolves the message-key convention through the translator", () => {
    expect(
      resolveThemeDisplayName("hikari::theme.defaultThemeName", undefined, "en", literalT),
    ).toBe("默认");
  });

  it("degrades to the base answer when the map is empty or absent", () => {
    // Empty map: the KEYED name still resolves through t() — an empty
    // translations map must not shadow the stock theme's localization.
    expect(resolveThemeDisplayName("hikari::theme.defaultThemeName", {}, "en", literalT)).toBe("默认");
    expect(resolveThemeDisplayName("hikari::theme.defaultThemeName", null, "en", literalT)).toBe("默认");
    // Literal name: passes through unchanged.
    expect(resolveThemeDisplayName("My Theme", { en: "  " }, "en", literalT)).toBe("My Theme");
  });
});

describe("resolveThemeDisplayName with hikari's live catalog", () => {
  it("follows the active locale for the keyed stock name", async () => {
    await setLocale("zh-Hans");
    const { t } = useI18n();
    expect(t("hikari::theme.defaultThemeName")).toBe("默认");
    expect(
      resolveThemeDisplayName("hikari::theme.defaultThemeName", undefined, "zh-Hans", t),
    ).toBe("默认");
    await setLocale("en");
  });
});
