;(function () {
  function storagePrefix() {
    try {
      if (typeof localStorage !== "undefined") {
        if (localStorage.getItem("shittim-locale") !== null) return "shittim-";
        if (localStorage.getItem("arona-locale") !== null) return "arona-";
      }
    } catch (_) {}
    return "celestia-";
  }
  // Per-theme colors (kept in sync with src/theme/presets.ts).
  // Each entry exposes the primary accent and the background for dark/light,
  // so the pre-paint loading screen matches the theme the main app will apply.
  var THEMES = {
    synthwave84: {
      dark:  { primary: [255, 107, 157], bg: [14, 14, 30],   surface: [24, 24, 42] },
      light: { primary: [214, 51, 132],  bg: [245, 245, 240], surface: [255, 255, 255] }
    },
    nord: {
      dark:  { primary: [136, 192, 208], bg: [22, 27, 38],   surface: [34, 40, 54] },
      light: { primary: [94, 129, 172],  bg: [236, 239, 244], surface: [229, 233, 240] }
    },
    gruvbox: {
      dark:  { primary: [251, 189, 84],  bg: [20, 20, 20],   surface: [34, 32, 30] },
      light: { primary: [204, 128, 49],  bg: [251, 241, 199], surface: [242, 229, 188] }
    },
    tokyonight: {
      dark:  { primary: [122, 162, 247], bg: [14, 15, 24],   surface: [22, 24, 36] },
      light: { primary: [52, 96, 189],   bg: [231, 233, 241], surface: [221, 223, 231] }
    }
  };
  var FALLBACK_THEME = THEMES.synthwave84;
  // Page-declared brand themes (optional): a site may declare
  // window.__celestiaThemes (extra presets keyed by theme id) and
  // window.__celestiaDefaultTheme in its index.html before this script runs.
  // Merge the presets so the loading screen knows them, and let the declared
  // default stand in for the hard-coded fallback. Both are no-ops when the
  // globals are absent, so every site keeps its current behavior.
  if (window.__celestiaThemes) {
    for (var _k in window.__celestiaThemes) THEMES[_k] = window.__celestiaThemes[_k];
  }
  if (window.__celestiaDefaultTheme && THEMES[window.__celestiaDefaultTheme]) {
    FALLBACK_THEME = THEMES[window.__celestiaDefaultTheme];
  }
  var GEO_KEY = storagePrefix() + "geolocation";

  // --- Solar position (vanilla port of composables/useSolarTime.ts) ---
  var DEG = Math.PI / 180;
  var RAD = 180 / Math.PI;

  function toJulianDate(date) {
    return date.getTime() / 86400000 + 2440587.5;
  }
  function greenwichSiderealTime(jd) {
    var T = (jd - 2451545.0) / 36525;
    var theta = (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000) % 360;
    if (theta < 0) theta += 360;
    return theta;
  }
  function sunEquatorialCoordinates(jd) {
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
  function solarAltitude(latDeg, lngDeg, date) {
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
  function isDaytimeBySolar(lat, lng) {
    return solarAltitude(lat, lng, new Date()) > 6;
  }

  // Coarse fallback when no geo is cached: derive longitude from the timezone
  // offset and assume a typical mid-latitude; degrade to a local-hour heuristic
  // if even that is unavailable. The browser clock is normally NTP-synced, so
  // the local hour is a reliable day/night signal on its own.
  function isDaytimeFallback() {
    var now = new Date();
    var offsetMin = -now.getTimezoneOffset();
    if (isFinite(offsetMin) && Math.abs(offsetMin) <= 840) {
      var lng = offsetMin / 4;
      return isDaytimeBySolar(31.23, lng);
    }
    var h = now.getHours();
    return h >= 7 && h < 18;
  }

  function resolveMode(mode) {
    if (mode === "light" || mode === "dark") return mode;
    var geo = null;
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

  var tid = localStorage.getItem(storagePrefix() + "theme") || window.__celestiaDefaultTheme || "synthwave84";
  var mode = resolveMode(localStorage.getItem(storagePrefix() + "theme-mode") || "system");
  var theme = THEMES[tid] || FALLBACK_THEME;
  var scheme = theme[mode] || theme.dark;

  var primary = scheme.primary;
  var bg = scheme.bg;
  var surface = scheme.surface;
  var isDark = mode === "dark";

  function rgb(arr) { return "rgb(" + arr[0] + "," + arr[1] + "," + arr[2] + ")"; }

  document.documentElement.style.setProperty("--loader-r", primary[0]);
  document.documentElement.style.setProperty("--loader-g", primary[1]);
  document.documentElement.style.setProperty("--loader-b", primary[2]);
  document.documentElement.style.setProperty("--loader-bg", rgb(bg));
  document.documentElement.style.setProperty("--loader-fg", isDark ? "#e0e0e0" : "#1a1a1a");
  document.documentElement.style.setProperty("--loader-fg-muted", isDark ? "#999" : "#666");
  document.documentElement.style.setProperty("--loader-card-bg", rgb(surface));
  document.documentElement.style.setProperty("--loader-card-border", isDark ? "#333" : "#ddd");
  document.documentElement.style.setProperty("--loader-overlay-bg", "rgba(" + bg[0] + "," + bg[1] + "," + bg[2] + ",0.93)");
})();
