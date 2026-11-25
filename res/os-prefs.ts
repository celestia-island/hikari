"use strict";
/*
 * os-prefs — seed the host's stored locale / colour scheme from the OS.
 *
 * This file is the SOURCE. `res/os-prefs.js` beside it is the build output
 * (`pnpm run gen:res-scripts`); the `.js` is what a host page loads with a
 * bare `<script src>` before any framework exists, so this stays a classic
 * script: no imports, no exports, one IIFE.
 *
 * The pre-paint chrome family shares the storage-prefix walk (`shittim-` /
 * `arona-` / `celestia-`): whichever app already stored a locale names the
 * namespace, so the values this file writes land where that app reads them.
 *
 * Only a Tauri shell publishes OS preferences (`window.__CELESTIA_OS_PREFS__`);
 * in a plain browser this is a no-op on purpose, because the browser's own
 * `prefers-color-scheme` is already what the stylesheets consult.
 */
(() => {
  /** The OS preferences the shell injects before this script runs. */
  interface OsPrefs {
    locale?: string;
    color_scheme?: string;
  }

  function storagePrefix(): string {
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("shittim-locale") !== null) return "shittim-";
        if (localStorage.getItem("arona-locale") !== null) return "arona-";
      }
    } catch (_) {}
    return "celestia-";
  }

  // src/scripts/os-prefs.ts
  /** True inside the Tauri webview (the only place OS prefs exist). */
  function isNative(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  }

  function getOsPrefs(): OsPrefs | null {
    const prefs = (window as Window & { __CELESTIA_OS_PREFS__?: OsPrefs })
      .__CELESTIA_OS_PREFS__;
    if (!prefs) return null;
    return prefs;
  }

  (function applyOsPrefs(): void {
    if (!isNative()) return;
    const prefs = getOsPrefs();
    if (!prefs) return;
    if (prefs.locale) {
      const existing = localStorage.getItem(storagePrefix() + "locale");
      if (!existing) {
        const mapped = mapLocale(prefs.locale);
        if (mapped) {
          localStorage.setItem(storagePrefix() + "locale", mapped);
        }
      }
    }
    if (prefs.color_scheme === "dark" || prefs.color_scheme === "light") {
      const existing = localStorage.getItem(storagePrefix() + "theme-mode");
      if (!existing || existing === "system") {
        localStorage.setItem(storagePrefix() + "theme-mode", prefs.color_scheme);
      }
    }
  })();

  /** BCP-47 tag from the OS -> hikari's i18n directory code, or null. */
  function mapLocale(bcp47: string): string | null {
    const lower = bcp47.toLowerCase();
    const lang = lower.split("-")[0];
    const region = lower.split("-")[1];
    if (lang === "zh") {
      if (region === "tw" || region === "hk" || region === "mo") return "zh-Hant";
      return "zh-Hans";
    }
    const direct: Record<string, string> = {
      en: "en",
      ja: "ja",
      ko: "ko",
      de: "de",
      fr: "fr",
      es: "es",
      pt: "pt",
      ar: "ar",
      ru: "ru"
    };
    return direct[lang] ?? null;
  }
})();
