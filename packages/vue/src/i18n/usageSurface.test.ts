import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * t() usage-surface audit (2026-09-19, follow-up to the #599 incident):
 * flatKeyParity.test.ts proves the locale bundles AGREE with en, but both
 * sides of that check live in the JSON — nothing pinned the source side.
 * Renaming a key in the bundles (or deleting it from en only) left every
 * test green while the components fell back to their hard-coded English
 * literals in every language (exactly how the theme.modeTabHint gap sat
 * unnoticed until #599, alongside two older strays this suite landed:
 * emptyState.loading and filePicker.currentPath).
 *
 * This file closes that loop: it statically scans every consumer source
 * file under packages/vue/src for `t("hikari::…")` literals — in ALL
 * THREE quote forms (double, single, backtick) and across line breaks
 * after the opening paren (HkPhoneInput.tsx:194 already uses that split
 * form) — and asserts each referenced key exists, non-empty, in the
 * loader-merged bundle of EVERY locale.
 *
 * The `hikari::` prefix is exactly hikari's own component vocabulary.
 * Unprefixed literals ("common.time.*", "${i18nKey}.*", "locale.title")
 * belong to the HOST-app namespace (registered at runtime via
 * mergeMessages, or passed in as props.t) and are pinned by their own
 * suites (timeKeys.test.ts & co.) — out of scope here by construction.
 */
const modules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/*.json",
  { eager: true },
);

const EXPECTED_LOCALES = [
  "ar", "de", "en", "es", "fr", "ja", "ko", "pt", "ru", "zh-Hans", "zh-Hant",
];

/** The loader's own merge (i18n/context.ts buildLocaleMessages): per locale
 *  directory, the union over every *.json of top-level flat string keys plus
 *  one level of legacy nested sections. */
function buildLocaleUniverse(locale: string): Map<string, string> {
  const merged = new Map<string, string>();
  for (const [path, mod] of Object.entries(modules)) {
    if (!path.includes(`/locales/${locale}/`)) continue;
    for (const [key, value] of Object.entries(mod.default)) {
      if (typeof value === "string") merged.set(key, value);
      else if (value !== null && typeof value === "object") {
        for (const [leaf, text] of Object.entries(value as Record<string, unknown>)) {
          if (typeof text === "string") merged.set(leaf, text);
        }
      }
    }
  }
  return merged;
}

const SRC_ROOT = join(import.meta.dirname, "..");

/** Consumer sources: everything under src/ EXCEPT the i18n suite itself
 *  (its tests exercise the loader with their own literals — bundle-side
 *  guards already cover those keys; scanning them here would just couple
 *  this audit to test churn, not to the real usage surface). */
function walkSources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) {
      if (dir === SRC_ROOT && name === "i18n") continue;
      walkSources(path, acc);
    } else if (/\.(ts|tsx|vue)$/.test(name)) acc.push(path);
  }
  return acc;
}

/** Static literal call sites. The `\s*` tolerates a line break between
 *  `t(` and the key; the character class covers ", ', and ` so a template
 *  literal WITHOUT interpolation is still a pinned literal. */
const STATIC_USE_RE = /\bt\(\s*(["'`])hikari::[A-Za-z0-9_.]+\1/g;
/** Dynamic families: a template key with `${…}` interpolation can never be
 *  resolved statically — they are enumerated in DYNAMIC_KEY_FAMILIES. */
const DYNAMIC_USE_RE = /\bt\(\s*`hikari::[A-Za-z0-9_.]*\$\{/g;

interface Site {
  key: string;
  where: string;
}

function scanSources(): { statics: Site[]; dynamics: string[] } {
  const statics: Site[] = [];
  const dynamics: string[] = [];
  for (const path of walkSources(SRC_ROOT)) {
    const text = readFileSync(path, "utf8");
    const rel = path.slice(SRC_ROOT.length + 1);
    for (const match of text.matchAll(STATIC_USE_RE)) {
      const key = match[0].slice(match[0].indexOf("hikari::"), -1);
      statics.push({ key, where: `${rel}:${text.slice(0, match.index).split("\n").length}` });
    }
    for (const match of text.matchAll(DYNAMIC_USE_RE)) {
      // The literal portion before "${" — e.g. "hikari::context." — which
      // is the family prefix the whitelist is keyed by.
      dynamics.push(match[0].slice(match[0].indexOf("hikari::"), -2));
    }
  }
  return { statics, dynamics };
}

/** Interpolated key families that intentionally escape the static scan,
 *  each with the reason it cannot be pinned by literal. Both directions
 *  are enforced below: every family found in source must be listed, and
 *  every listed family must still exist in source, so this whitelist
 *  cannot rot into silence. */
const DYNAMIC_KEY_FAMILIES: Record<string, string> = {
  "hikari::context.": "HkContextRing section keys — closed enum, pinned by name in contextKeys.test.ts.",
  "hikari::statusBar.backend.": "HkConnectionStatus — enumerated connection-state suffixes.",
  "hikari::statusBar.region.": "HkStatusBar region names — OPTIONAL per-locale overrides over Intl.DisplayNames (see LOCALE_SPECIFIC_NESTED in flatKeyParity.test.ts).",
  "hikari::theme.groups.": "Registry type: group/slot ids are registered by downstream apps; t() resolves via a resolveLocalizedText fallback, never a hikari bundle.",
  "hikari::theme.tokens.": "HkColorSchemeEditor token enum — closed set defined in platform.json locales.",
};

describe("t() usage surface vs locale bundles", () => {
  const universes = new Map(EXPECTED_LOCALES.map((l) => [l, buildLocaleUniverse(l)]));
  const { statics, dynamics } = scanSources();

  it("covers all 11 locales in the merged bundle universe", () => {
    const found = new Set(
      Object.keys(modules)
        .map((p) => p.match(/locales\/([^/]+)\//)?.[1])
        .filter((l): l is string => Boolean(l)),
    );
    expect([...found].sort()).toEqual(EXPECTED_LOCALES);
  });

  it("scanner self-proof: the extraction actually extracts (no vacuous pass)", () => {
    // Zero-hit discipline: a broken regex/walk yields zeros that LOOK green.
    // Pin the floor near today's real volume (446 files, 325 sites, 270
    // distinct keys) so a hollowed scanner goes loudly red, and pin known
    // positives — including one multi-line call form — by name and file.
    expect(walkSources(SRC_ROOT).length).toBeGreaterThan(400);
    expect(statics.length).toBeGreaterThan(320);
    expect(new Set(statics.map((s) => s.key)).size).toBeGreaterThan(260);
    const firstSiteOf = (key: string) =>
      statics.find((s) => s.key === key)?.where ?? "NOT FOUND";
    expect(firstSiteOf("hikari::theme.modeTabHint")).toMatch(/HkColorSchemeEditor\.tsx/);
    expect(firstSiteOf("hikari::emptyState.loading")).toMatch(/HkEmptyState\.tsx/);
    expect(firstSiteOf("hikari::filePicker.currentPath")).toMatch(/HkFileBrowserDialog\.tsx/);
    // Split-across-lines call form (t( and the key on different lines):
    expect(firstSiteOf("hikari::phoneInput.searchCountries")).toMatch(/HkPhoneInput\.tsx/);
  });

  it("resolves every statically referenced hikari:: key in every locale, non-empty", () => {
    expect(statics.length, "source scan found call sites").toBeGreaterThan(0);
    const violations: string[] = [];
    const reported = new Set<string>();
    for (const { key, where } of statics) {
      for (const locale of EXPECTED_LOCALES) {
        const value = universes.get(locale)!.get(key);
        if (typeof value !== "string" || value.length === 0) {
          if (reported.has(key)) continue;
          reported.add(key);
          violations.push(
            `${key} (first referenced at ${where}) is missing or empty in ${locale}`,
          );
        }
      }
    }
    expect(violations, "every referenced key must resolve in all 11 locales").toEqual([]);
  });

  it("enumerates exactly the whitelisted dynamic key families, both directions", () => {
    const found = [...new Set(dynamics)].sort();
    expect(found, "families found in source but missing from the whitelist").toEqual(
      Object.keys(DYNAMIC_KEY_FAMILIES).sort(),
    );
    for (const family of Object.keys(DYNAMIC_KEY_FAMILIES)) {
      expect(found, `${family} is whitelisted but no longer used — prune it`).toContain(family);
    }
  });
});
