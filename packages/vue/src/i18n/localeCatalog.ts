// The hikari locale catalog — the ONE list of languages hikari ships
// (codes + endonyms), mirrored from the `hikari-i18n` crate's
// `Language::ALL` / `native_name()` (packages/i18n/src/lib.rs). Consumers
// feed it to per-language editors (HkLocalizedInput's `localeOptions`
// default) and to any surface that needs "every language hikari speaks"
// without owning an app-level i18n config — a static docs site has no
// such config, and hand-copying the list per host is how catalogs drift.
//
// The order and endonyms MUST stay byte-identical with the Rust enum:
// `localeCatalog.parity.test.ts` pins both directions (every catalog
// entry has a locale bundle, every locale bundle has a catalog entry),
// and the Rust-side snapshot pins the enum itself.

/** One catalog entry: the locale code (`setLocale` accepts it verbatim)
 *  and the language's endonym — its own name for itself, the SAME text a
 *  language switcher row shows. */
export interface HkLocaleCatalogEntry {
  code: string;
  label: string;
}

export const HK_LOCALE_CATALOG: readonly HkLocaleCatalogEntry[] = [
  { code: "en", label: "English" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "zh-Hant", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
];
