#!/usr/bin/env node
/**
 * Generate the localized date vocabulary (month / weekday names + first weekday)
 * for hikari's 11 languages, from CLDR via the platform `Intl` of this Node.
 *
 * Why a generator: `chrono`'s `unstable-locales` shipped glibc `LC_TIME` data,
 * which disagrees with the CLDR data every browser's `Intl` uses (154 differing
 * cells across the 11 languages, measured). hikari's Vue components derive all
 * date names from `Intl` at runtime, so the Rust side must be fed CLDR data —
 * otherwise the same locale renders differently depending on which half of the
 * design system drew it.
 *
 * Outputs (both committed; the Rust one is a build product that a test pins
 * against the golden, so a hand edit goes red):
 *
 *   1. packages/i18n/src/dates/names.golden.toml   — the frozen CLDR snapshot
 *   2. packages/i18n/src/dates/names.rs            — the `const` table the crate uses
 *
 * Re-run after a Node/ICU bump:  node scripts/gen-date-names.ts
 * and review the diff — a golden change is never noise, it is a UI text change.
 *
 * Contexts: CLDR has two shapes per name. "Standalone" is the bare name (a list
 * or a month header: `октябрь`); "format" is the name as it appears inside a
 * full date (`6 октября`). glibc only had the latter, which is why the Rust
 * month header used to read "октября 2024". This generator records both.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Language code → the locale tag handed to `Intl`.
 *
 * These MUST be the tags the Vue side passes at runtime: `activeLocale()`
 * returns the i18n directory code (`en`, `zh-Hans`, …, `ar`), and `Intl`
 * resolves a region-less tag to CLDR's default region — which is not always the
 * one a region-tagged locale would pick (`ar` → Saturday-first, `ar-SA` →
 * Sunday-first). A region tag here would make the Rust grid open one day apart
 * from the Vue grid in that language.
 *
 * Order = hikari_i18n::Language::ALL.
 */
const LOCALES: Record<string, string> = {
  en: "en",
  "zh-Hans": "zh-hans",
  "zh-Hant": "zh-hant",
  ja: "ja",
  ko: "ko",
  fr: "fr",
  de: "de",
  es: "es",
  pt: "pt",
  ru: "ru",
  ar: "ar",
};

/** One locale's frozen vocabulary: the row `DateVocabulary` consumes on the Rust side. */
interface Vocabulary {
  first_weekday: number;
  month_short: string[];
  month_long: string[];
  month_short_fmt: string[];
  month_long_fmt: string[];
  weekday_short: string[];
  weekday_long: string[];
  weekday_narrow: string[];
}

/** A date inside each month / on each weekday; UTC keeps the host tz out. */
const monthDate = (monthIndex: number): Date => new Date(Date.UTC(2024, monthIndex, 15));
// 2024-01-07 is a Sunday, so index 0 = Sunday … 6 = Saturday.
const weekdayDate = (weekdayIndex: number): Date => new Date(Date.UTC(2024, 0, 7 + weekdayIndex));

function monthStandalone(locale: string, style: "short" | "long"): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" }).format(monthDate(i)),
  );
}

/**
 * Month name in CLDR FORMAT context: format `{day, month}` and pull the month
 * part out, trimming the separators other languages put around it
 * ("15 de jan." → "jan.").
 */
function monthFormat(locale: string, style: "short" | "long"): string[] {
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: style,
    timeZone: "UTC",
  });
  return Array.from({ length: 12 }, (_, i) => {
    const part = formatter.formatToParts(monthDate(i)).find((p) => p.type === "month");
    if (!part) throw new Error(`${locale}: no month part in format context`);
    return part.value;
  });
}

function weekdays(locale: string, style: "short" | "long" | "narrow"): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(weekdayDate(i)),
  );
}

function vocabulary(locale: string): Vocabulary {
  // `weekInfo` is the ES2024 accessor; `getWeekInfo()` is the proposal-era
  // spelling still present in some runtimes. Both are optional in TS's DOM/ES
  // lib for the same reason, hence the local shape.
  const localeInfo = new Intl.Locale(locale) as Intl.Locale & {
    weekInfo?: { firstDay: number };
    getWeekInfo?: () => { firstDay: number };
  };
  const info = localeInfo.weekInfo ?? localeInfo.getWeekInfo?.();
  if (!info) throw new Error(`${locale}: no weekInfo`);
  return {
    // Intl speaks ISO (1 = Monday … 7 = Sunday); the components speak
    // 0 = Sunday … 6 = Saturday (what a JS `Date#getDay` answers).
    first_weekday: info.firstDay % 7,
    month_short: monthStandalone(locale, "short"),
    month_long: monthStandalone(locale, "long"),
    month_short_fmt: monthFormat(locale, "short"),
    month_long_fmt: monthFormat(locale, "long"),
    weekday_short: weekdays(locale, "short"),
    weekday_long: weekdays(locale, "long"),
    weekday_narrow: weekdays(locale, "narrow"),
  };
}

/** TOML basic-string escaping is enough here: keys are ASCII, values are names. */
function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlArray(values: string[]): string {
  return `[${values.map(tomlString).join(", ")}]`;
}

function renderGolden(snapshot: Record<string, Vocabulary>): string {
  const header = [
    "# GENERATED by scripts/gen-date-names.ts — do not edit by hand.",
    `# Source: CLDR via Node ${process.versions.node} (ICU ${process.versions.icu}).`,
    "# Regenerate: node scripts/gen-date-names.ts   (then review the diff:",
    "# a change here is a user-visible date text change, not noise.)",
    "",
  ].join("\n");
  const rows = Object.entries(snapshot).map(([code, v]) => {
    const lines = [
      `[${code}]`,
      `first_weekday = ${v.first_weekday}`,
      `month_short = ${tomlArray(v.month_short)}`,
      `month_long = ${tomlArray(v.month_long)}`,
      `month_short_fmt = ${tomlArray(v.month_short_fmt)}`,
      `month_long_fmt = ${tomlArray(v.month_long_fmt)}`,
      `weekday_short = ${tomlArray(v.weekday_short)}`,
      `weekday_long = ${tomlArray(v.weekday_long)}`,
      `weekday_narrow = ${tomlArray(v.weekday_narrow)}`,
    ];
    return lines.join("\n");
  });
  return `${header}\n${rows.join("\n\n")}\n`;
}

function rustStringArray(values: string[]): string {
  return `&[${values.map(tomlString).join(", ")}]`;
}

function renderRust(snapshot: Record<string, Vocabulary>): string {
  const entries = Object.entries(snapshot).map(([code, v]) =>
    [
      "    DateVocabulary {",
      `        language: Language::${languageVariant(code)},`,
      `        first_weekday: ${v.first_weekday},`,
      `        month_short: ${rustStringArray(v.month_short)},`,
      `        month_long: ${rustStringArray(v.month_long)},`,
      `        month_short_fmt: ${rustStringArray(v.month_short_fmt)},`,
      `        month_long_fmt: ${rustStringArray(v.month_long_fmt)},`,
      `        weekday_short: ${rustStringArray(v.weekday_short)},`,
      `        weekday_long: ${rustStringArray(v.weekday_long)},`,
      `        weekday_narrow: ${rustStringArray(v.weekday_narrow)},`,
      "    },",
    ].join("\n"),
  );
  return [
    "// GENERATED by scripts/gen-date-names.ts — do not edit by hand.",
    `// Source: CLDR via Node ${process.versions.node} (ICU ${process.versions.icu});`,
    "// the frozen snapshot lives beside this file as `names.golden.toml`, and",
    "// `tests/date_vocabulary_tests.rs` fails if the two drift apart.",
    "",
    "use super::DateVocabulary;",
    "use crate::Language;",
    "",
    "#[rustfmt::skip]",
    "pub(super) static VOCABULARIES: &[DateVocabulary] = &[",
    entries.join("\n"),
    "];",
    "",
  ].join("\n");
}

/** Rust enum variant for each generator key (must match `Language`). */
function languageVariant(code: string): string {
  const map: Record<string, string> = {
    en: "English",
    "zh-Hans": "ChineseSimplified",
    "zh-Hant": "ChineseTraditional",
    ja: "Japanese",
    ko: "Korean",
    fr: "French",
    de: "German",
    es: "Spanish",
    pt: "Portuguese",
    ru: "Russian",
    ar: "Arabic",
  };
  const variant = map[code];
  if (!variant) throw new Error(`no Language variant for ${code}`);
  return variant;
}

const snapshot: Record<string, Vocabulary> = {};
for (const [code, locale] of Object.entries(LOCALES)) snapshot[code] = vocabulary(locale);

const here = dirname(fileURLToPath(import.meta.url));
const dateDir = resolve(here, "../packages/i18n/src/dates");
writeFileSync(resolve(dateDir, "names.golden.toml"), renderGolden(snapshot), "utf8");
writeFileSync(resolve(dateDir, "names.rs"), renderRust(snapshot), "utf8");
process.stdout.write(
  `gen-date-names: ${Object.keys(snapshot).length} languages ` +
    `(Node ${process.versions.node}, ICU ${process.versions.icu})\n`,
);