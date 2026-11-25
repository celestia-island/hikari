/*
 * theme-loader — paint the loading screen in the theme the app is about to use.
 *
 * This file is the SOURCE. `res/theme-loader.js` beside it is the build output
 * (`pnpm run gen:res-scripts`); the `.js` is the asset hosts load with a bare
 * `<script src>` before any framework, bundle or module graph exists. It is
 * therefore a classic script — no imports, no exports, one IIFE — and it must
 * NEVER throw: there is no error boundary above it, so a TypeError here leaves
 * the loading screen unpainted for every consumer.
 *
 * WHAT IT DOES: resolves the stored theme id + scheme (light / dark / system),
 * publishes the resolved palette as `--loader-*` custom properties on `:root`,
 * and publishes the caption-band height contract that `res/boot-chrome.js`
 * reads. The main app then finds the tokens already in place and only has to
 * swap the sheet.
 *
 * CONSUMERS: `packages/vue/src/plugins/bootScriptsPlugin.ts` copies this file
 * into the build output; plana keeps `res/` copies; shittim-chest vendors its
 * own diverged copy (`packages/webui/src/res/theme-loader.js`). The
 * cross-language pin is `packages/vue/src/theme/themeLoaderContract.test.ts`,
 * which reads the EMITTED `.js` and fails when its palette table stops
 * matching `src/theme/presets.ts`.
 */
;(function (): void {
  /**
   * The storage namespace: whichever app already stored a locale named it.
   * Kept in step with the rest of the pre-paint family (os-prefs, the titlebar).
   */
  function storagePrefix(): string {
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("shittim-locale") !== null) return "shittim-";
        if (localStorage.getItem("arona-locale") !== null) return "arona-";
      }
    } catch {}
    return "celestia-";
  }

  /** An `[r, g, b]` triplet, as `presets.ts` stores it. */
  type Rgb = [number, number, number];

  /** The per-scheme colours the loader paints: primary accent, background, card. */
  interface LoaderScheme {
    primary: Rgb;
    bg: Rgb;
    surface: Rgb;
  }

  /** Brand themes a page may declare before this script runs. */
  interface PageThemeGlobals {
    __celestiaThemes?: Record<string, LoaderTheme>;
    __celestiaDefaultTheme?: string;
  }

  /** One theme's two schemes. `dark` is also the fallback inside a theme. */
  interface LoaderTheme {
    dark: LoaderScheme;
    light: LoaderScheme;
  }

  // Per-theme colors (kept in sync with src/theme/presets.ts).
  // Each entry exposes the primary accent and the background for dark/light,
  // so the pre-paint loading screen matches the theme the main app will apply.
  // The stock table is ONE theme: the four editor-derived presets collapsed
  // into `default`, whose dark scheme is the black-blue pair and whose light
  // scheme is the pink/paper pair.
  //
  // THE LINE LAYOUT BELOW IS CONTRACT. `themeLoaderContract.test.ts` reads this
  // table out of the EMITTED `.js` (not this file) and asserts its exact line
  // layout, not just its values: the emitter's output for this block is pinned
  // line-for-line, so a whitespace-only reflow goes red even though the program
  // is unchanged. The generator's 2-space re-indent is what produces that
  // layout (`scripts/emit-res-scripts.mjs`), and the table is deliberately
  // written in the style the emitted file is expected to keep.
  var THEMES: Record<string, LoaderTheme> = {
    default: {
      dark:  { primary: [136, 192, 208], bg: [22, 27, 38],   surface: [34, 40, 54] },
      light: { primary: [214, 51, 132],  bg: [245, 245, 240], surface: [255, 255, 255] }
    }
  };
  var FALLBACK_THEME: LoaderTheme = THEMES.default;

  // Page-declared brand themes (optional): a site may declare
  // window.__celestiaThemes (extra presets keyed by theme id) and
  // window.__celestiaDefaultTheme in its index.html before this script runs.
  // Merge the presets so the loading screen knows them, and let the declared
  // default stand in for the hard-coded fallback. Both are no-ops when the
  // globals are absent, so every site keeps its current behavior.
  // The cast stays inline (rather than into a `pageGlobals` alias) so the
  // emitted text keeps the literal `window.__celestia*` reads that the
  // contract test and every vendoring sibling repo grep for.
  if ((window as Window & PageThemeGlobals).__celestiaThemes) {
    for (var _k in (window as Window & PageThemeGlobals).__celestiaThemes) THEMES[_k] = (window as Window & PageThemeGlobals).__celestiaThemes![_k];
  }
  if ((window as Window & PageThemeGlobals).__celestiaDefaultTheme && THEMES[(window as Window & PageThemeGlobals).__celestiaDefaultTheme!]) {
    FALLBACK_THEME = THEMES[(window as Window & PageThemeGlobals).__celestiaDefaultTheme!];
  }
  var GEO_KEY = storagePrefix() + "geolocation";

  // --- Solar position (vanilla port of composables/useSolarTime.ts) ---
  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;

  function toJulianDate(date: Date): number {
    return date.getTime() / 86400000 + 2440587.5;
  }
  function greenwichSiderealTime(jd: number): number {
    var T = (jd - 2451545.0) / 36525;
    var theta = (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000) % 360;
    if (theta < 0) theta += 360;
    return theta;
  }
  function sunEquatorialCoordinates(jd: number): { decl: number; ra: number } {
    var T = (jd - 2451545.0) / 36525;
    var L0 = (280.46646 + 36000.76983 * T) % 360;
    var M = ((357.52911 + 35999.05029 * T) % 360) * DEG;
    var C = (1.9146 - 0.004817 * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M);
    var sunLon = (L0 + C) % 360;
    if (sunLon < 0) sunLon += 360;
    var omega = (125.04 - 1934.136 * T) * DEG;
    var lambda = sunLon * DEG - 0.00569 * DEG - 0.00478 * DEG * Math.sin(omega);
    var epsilon = (23.439291 - 0.013004 * T) * DEG;
    var decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
    var ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
    return { decl: decl, ra: ra };
  }
  function solarAltitude(latDeg: number, lngDeg: number, date: Date): number {
    var jd = toJulianDate(date);
    var eq = sunEquatorialCoordinates(jd);
    var haDeg = greenwichSiderealTime(jd) + lngDeg - eq.ra * RAD;
    haDeg = (((haDeg + 180) % 360) + 360) % 360 - 180;
    var ha = haDeg * DEG;
    var lat = latDeg * DEG;
    var alt = Math.asin(Math.sin(lat) * Math.sin(eq.decl) + Math.cos(lat) * Math.cos(eq.decl) * Math.cos(ha));
    return alt * RAD;
  }

  // Main app treats "system" as light only when the solar period is "day"
  // (altitude > 6); dusk/night resolve to dark. Mirror that exactly here.
  function isDaytimeBySolar(lat: number, lng: number): boolean {
    return solarAltitude(lat, lng, new Date()) > 6;
  }

  // Coarse fallback when no geo is cached: derive longitude from the timezone
  // offset and assume a typical mid-latitude; degrade to a local-hour heuristic
  // if even that is unavailable. The browser clock is normally NTP-synced, so
  // the local hour is a reliable day/night signal on its own.
  function isDaytimeFallback(): boolean {
    var now = new Date();
    var offsetMin = -now.getTimezoneOffset();
    if (isFinite(offsetMin) && Math.abs(offsetMin) <= 840) {
      var lng = offsetMin / 4;
      return isDaytimeBySolar(31.23, lng);
    }
    var h = now.getHours();
    return h >= 7 && h < 18;
  }

  /** `"light"` / `"dark"` / anything else, which resolves by solar clock. */
  function resolveMode(mode: string): string {
    if (mode === "light" || mode === "dark") return mode;
    var geo: { lat?: unknown; lng?: unknown } | null;
    try {
      geo = JSON.parse(localStorage.getItem(GEO_KEY) || "null");
    } catch {
      geo = null;
    }
    if (geo && typeof geo.lat === "number" && typeof geo.lng === "number" && isFinite(geo.lat) && isFinite(geo.lng)) {
      return isDaytimeBySolar(geo.lat, geo.lng) ? "light" : "dark";
    }
    return isDaytimeFallback() ? "light" : "dark";
  }

  // Stored id/mode, three sources in priority order:
  //   1. the per-app prefixed keys (storagePrefix() + "theme[-mode]") — the
  //      legacy locations pre-hikari apps wrote, kept first for back-compat;
  //   2. the hikari engine keys ("hikari-theme"/"hikari-theme-mode") — what
  //      every app on this library actually persists (see useTheme.ts); without
  //      them the loading screen repaints the default brand while the app
  //      restores another theme;
  //   3. the page-declared default, then the stock table's own default.
  var tid: string | null =
    localStorage.getItem(storagePrefix() + "theme") ||
    localStorage.getItem("hikari-theme") ||
    (window as Window & PageThemeGlobals).__celestiaDefaultTheme ||
    "default";
  var mode = resolveMode(
    localStorage.getItem(storagePrefix() + "theme-mode") ||
    localStorage.getItem("hikari-theme-mode") ||
    "system",
  );
  var theme = THEMES[tid] || FALLBACK_THEME;
  var scheme = theme[mode] || theme.dark;

  var primary = scheme.primary;
  var bg = scheme.bg;
  var surface = scheme.surface;
  var isDark = mode === "dark";

  function rgb(arr: Rgb): string { return "rgb(" + arr[0] + "," + arr[1] + "," + arr[2] + ")"; }

  document.documentElement.style.setProperty("--loader-r", primary[0]);
  document.documentElement.style.setProperty("--loader-g", primary[1]);
  document.documentElement.style.setProperty("--loader-b", primary[2]);
  document.documentElement.style.setProperty("--loader-bg", rgb(bg));
  document.documentElement.style.setProperty("--loader-fg", isDark ? "#e0e0e0" : "#1a1a1a");
  document.documentElement.style.setProperty("--loader-fg-muted", isDark ? "#999" : "#666");
  document.documentElement.style.setProperty("--loader-card-bg", rgb(surface));
  document.documentElement.style.setProperty("--loader-card-border", isDark ? "#333" : "#ddd");
  document.documentElement.style.setProperty("--loader-overlay-bg", "rgba(" + bg[0] + "," + bg[1] + "," + bg[2] + ",0.93)");

  // Caption band height contract (hikari runtime/windowChrome.ts,
  // CHROME_BAND_HEIGHT_VAR): publish the desktop window's caption band height
  // BEFORE the app bundle exists, so hikari's pre-boot window bar
  // (res/boot-chrome.js) draws the SAME wide band the app's chrome will wear
  // instead of a thin 32px strip it then replaces (2026-11-12 user report).
  // The expression is deliberately the one theme.scss's --hk-chrome-band-inset
  // resolves (var(--s-header-height, 3rem)): hikari's own token carries the
  // fallback, so this file never restates a px number and the two cannot drift.
  document.documentElement.style.setProperty(
    "--hk-chrome-band-h",
    "var(--s-header-height, 3rem)",
  );
})();
