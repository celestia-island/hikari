// Theme display-name resolution (2026-11-25 user direction: theme names
// are i18n citizens on every host, not opaque strings). The family
// grammar mirrors chest's resolveThemeDisplayName (2026-10-08) so both
// sides resolve a theme's name through the SAME answers, in the SAME
// order:
//
//   1. the theme's own per-locale map (`nameI18n`, authored through the
//      scheme editor's HkLocalizedInput and persisted with the custom
//      theme) — the author's explicit per-language choice wins for the
//      locales it covers, with the shared family fallbacks
//      (zh-Hans ⇄ zh-Hant, then en, then zh-Hans, then first non-empty);
//   2. hikari's message-key convention: a name that IS a catalog key
//      (the shipped stock preset carries `hikari::theme.defaultThemeName`)
//      renders translated — `t()` falls back to the raw string for
//      anything that is not a key, so literal names and user-named
//      customs pass through unchanged;
//   3. the raw base name.
//
// The same helper serves every surface that renders a theme name — the
// theme panel rows today; hosts rendering names off their own storage
// (chest's server registry keeps `name_i18n`) resolve through the same
// function instead of a hand-copy.
import { useI18n } from "../i18n/context";

/** Per-locale name translations, keyed by locale code (the app's locale
 *  codes; hikari's catalog codes when the host has no own list). */
export type ThemeNameI18n = Record<string, string>;

/** zh family mutual fallback: a map covering only one Chinese script
 *  still answers the other (a zh-Hant-only name must not fall through to
 *  English on a zh-Hans face — the scripts share the vocabulary). */
function familyFallbacks(locale: string): string[] {
  const chain: string[] = [locale];
  if (locale === "zh-Hans") chain.push("zh-Hant");
  if (locale === "zh-Hant") chain.push("zh-Hans");
  chain.push("en", "zh-Hans");
  return chain;
}

/** Best entry of a per-locale map for `locale` under the family
 *  fallbacks, or undefined when the map holds no non-empty value. */
function pickLocalized(
  map: ThemeNameI18n,
  locale: string,
): string | undefined {
  for (const code of familyFallbacks(locale)) {
    const value = map[code];
    if (typeof value === "string" && value.trim()) return value;
  }
  return Object.values(map).find((v) => typeof v === "string" && v.trim());
}

/**
 * Resolve a theme's DISPLAY name: per-locale translations first, then
 * the message-key convention through `t()`, then the raw base name.
 * `name` may be a literal or a catalog key; `nameI18n` may be null or
 * empty (stock themes and untranslated customs) — both degrade to the
 * base answer.
 */
export function resolveThemeDisplayName(
  name: string,
  nameI18n: ThemeNameI18n | null | undefined,
  locale: string,
  t: (key: string) => string,
): string {
  const base = t(name);
  if (nameI18n && Object.keys(nameI18n).length > 0) {
    return pickLocalized(nameI18n, locale) ?? base;
  }
  return base;
}

/** The `useI18n`-bound convenience wrapper most components want. */
export function resolveThemeDisplayNameT(
  name: string,
  nameI18n: ThemeNameI18n | null | undefined,
): string {
  const { t, locale } = useI18n();
  return resolveThemeDisplayName(name, nameI18n, locale, t);
}
