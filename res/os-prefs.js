"use strict";
(() => {
  function storagePrefix() {
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("shittim-locale") !== null) return "shittim-";
        if (localStorage.getItem("arona-locale") !== null) return "arona-";
      }
    } catch (_) {}
    return "celestia-";
  }
  // src/scripts/os-prefs.ts
  function isTauri() {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  }
  function getOsPrefs() {
    const prefs = window.__CELESTIA_OS_PREFS__;
    if (!prefs) return null;
    return prefs;
  }
  (function applyOsPrefs() {
    if (!isTauri()) return;
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
  function mapLocale(bcp47) {
    const lower = bcp47.toLowerCase();
    const lang = lower.split("-")[0];
    const region = lower.split("-")[1];
    if (lang === "zh") {
      if (region === "tw" || region === "hk" || region === "mo") return "zh-Hant";
      return "zh-Hans";
    }
    const direct = {
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
