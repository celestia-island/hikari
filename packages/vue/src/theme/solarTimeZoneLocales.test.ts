// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { describe, expect, it } from "vitest";

import { SOLAR_TIME_ZONE_SECTORS } from "./solarTimeZones";

/**
 * The globe picker embeds its translations in the hikari language packs
 * (2026-10-31 product direction) — sector band names, representative
 * city names and the picker chrome must resolve in ALL 11 locales, in
 * every language the family ships. Dynamic t() keys escape both
 * flatKeyParity (components/errors only) and usageSurface (literal
 * keys only), so this suite IS the guard for the globe's namespace.
 */

const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "../i18n/locales/*/platform.json",
  { eager: true },
);

const EXPECTED_LOCALES = [
  "ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant",
];

const UI_KEYS = [
  "hikari::theme.solar.globeLabel",
  "hikari::theme.solar.globeHint",
  "hikari::theme.solar.globeListLabel",
  "hikari::theme.solar.citySeparator",
];

function sectorKey(offset: number): string {
  const k = offset === 0 ? "z0" : offset < 0 ? "m" + String(-offset) : "p" + String(offset);
  return "hikari::theme.solar.sector." + k;
}

function cityKey(slug: string): string {
  return "hikari::theme.solar.city." + slug;
}

function localeOf(path: string): string {
  return /locales\/([^/]+)\/platform\.json$/.exec(path)?.[1] ?? path;
}

describe("solar globe picker locale coverage", () => {
  // platform.json nests legacy domain sections ("platform", "auth") —
  // flatten string-leaf sections the same way buildLocaleMessages does.
  const bundles = new Map(
    Object.entries(modules).map(([path, mod]) => {
      const merged: Record<string, string> = {};
      for (const section of Object.values(mod.default ?? {})) {
        if (section !== null && typeof section === "object") {
          Object.assign(merged, section as Record<string, string>);
        }
      }
      return [localeOf(path), merged] as const;
    }),
  );

  it("finds all 11 locale bundles", () => {
    expect([...bundles.keys()].sort()).toEqual([...EXPECTED_LOCALES].sort());
  });

  for (const locale of EXPECTED_LOCALES) {
    it(locale + " translates every sector name, city and chrome key", () => {
      const bundle = bundles.get(locale);
      expect(bundle, "platform.json bundle").toBeTruthy();
      for (const key of UI_KEYS) {
        expect(typeof bundle![key]).toBe("string");
        expect((bundle![key] ?? "").length).toBeGreaterThan(0);
      }
      for (const sector of SOLAR_TIME_ZONE_SECTORS) {
        const name = bundle![sectorKey(sector.offset)];
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
        for (const slug of sector.cities) {
          const city = bundle![cityKey(slug)];
          expect(typeof city).toBe("string");
          expect(city.length).toBeGreaterThan(0);
        }
      }
    });
  }

  it("keeps zh-Hans on the customary east/west band names", () => {
    const zh = bundles.get("zh-Hans")!;
    expect(zh[sectorKey(8)]).toBe("东八区");
    expect(zh[sectorKey(0)]).toBe("零时区");
    expect(zh[sectorKey(-11)]).toBe("西十一区");
    expect(zh["hikari::theme.solar.city.shanghai"]).toBe("上海");
    expect(zh["hikari::theme.solar.citySeparator"]).toBe("、");
  });
});
