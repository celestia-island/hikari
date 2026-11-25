import { readStorageItem } from "./safeStorage";
import {
  DEFAULT_GEO_LOCATION,
  isKnownTimeZone,
  manualLocationOf,
  solarAltitude,
  sunEquatorialCoordinates,
  greenwichSiderealTime,
  toJulianDate,
  zoneOffsetMinutes,
  SOLAR_LOCATION_STRATEGY_STORAGE_KEY,
  SOLAR_MANUAL_LOCATION_STORAGE_KEY,
  type SolarLocationStrategy,
  type SolarManualLocation,
} from "./useSolarTime";

/**
 * The PRE-PAINT theme resolver and its shipped boot asset (hikari#1546
 * Phase 1.5, user direction 2026-11-25: 一整套统一 — one resolution
 * executed on BOTH sides of hydration).
 *
 * `resolveSystemModeAt` runs the solar chain's SYNC path exactly as the
 * reactive runtime resolves mode "system": manual config (when the stored
 * strategy selects it and the payload validates) → the timezone estimate
 * (stock default latitude + UTC-offset longitude) → solar altitude →
 * day → light, else dark. Dependency-free by design (safeStorage only —
 * no vue, no cronBus) so it can ride the pre-paint asset.
 *
 * Two documented divergences from the reactive runtime, both narrow:
 * - strategy "ip": the runtime may improve the coords via a
 *   granted-browser-geolocation / IP cascade (async, networked). The boot
 *   asset cannot — it uses the timezone estimate. The runtime's answer
 *   lands with the bundle and self-heals.
 * - stale stored values: the runtime's readers also REMOVE bad payloads;
 *   the boot asset is read-only (pre-paint storage writes would be a
 *   surprise) and falls back instead. Removal happens at initTheme.
 *
 * `buildThemeBootJs()` ships the chain as a dependency-free IIFE for
 * consumers to inline in `<head>` (lagrange interpolates it with a `?raw`
 * import). The math is serialized via `Function.prototype.toString` from
 * useSolarTime's OWN definitions — the asset cannot drift from the
 * runtime's solar chain by construction; `themeBoot.contract.test.ts`
 * executes the emitted asset against `resolveSystemModeAt` across a date
 * grid to pin the wrapper (storage reads + attribute writes) instead.
 */

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** A read-only storage surface — the seam that lets the contract test feed
 *  the resolver the SAME values the emitted asset reads (a test runner may
 *  have no `localStorage` at all, and comparing against the environment's
 *  storage made the parity assertion machine-dependent: review round 2). */
export interface BootStorage {
  getItem(key: string): string | null;
}

/** One strategy branch only: manual config or the offline estimate. The
 *  "ip" cascade is async and networked — never a pre-paint concern. */
function bootGeoLocation(strategy: SolarLocationStrategy, storage: BootStorage): {
  lat: number;
  lng: number;
} {
  if (strategy === "manual") {
    const raw = storage.getItem(SOLAR_MANUAL_LOCATION_STORAGE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "timeZone" in parsed &&
          "hemisphere" in parsed &&
          typeof (parsed as SolarManualLocation).timeZone === "string" &&
          ((parsed as SolarManualLocation).hemisphere === "north" ||
            (parsed as SolarManualLocation).hemisphere === "south") &&
          isKnownTimeZone((parsed as SolarManualLocation).timeZone)
        ) {
          return manualLocationOf(parsed as SolarManualLocation);
        }
      } catch {
        // Corrupt payload — the estimate below is the offline answer.
      }
    }
  }
  // "timezone" (the default), manual-with-invalid-config, and "ip"-offline
  // all land here: lat = the stock default, lng = the zone's center meridian
  // derived from the CURRENT UTC offset (identical to timezoneFallback()).
  const offsetMin = -new Date().getTimezoneOffset();
  return { lat: DEFAULT_GEO_LOCATION.lat, lng: offsetMin / 4 };
}

/** The runtime contract, sync path: mode "system" is light only while the
 *  sun is genuinely up (altitude > 6°); dusk and night are dark. */
export function resolveSystemModeAt(
  date: Date = new Date(),
  storage: BootStorage = { getItem: (k) => readStorageItem(k) },
): "dark" | "light" {
  let strategy: SolarLocationStrategy = "timezone";
  const stored = storage.getItem(SOLAR_LOCATION_STRATEGY_STORAGE_KEY);
  if (stored === "timezone" || stored === "ip" || stored === "manual") {
    strategy = stored;
  }
  const geo = bootGeoLocation(strategy, storage);
  const alt = solarAltitude(geo.lat, geo.lng, date);
  return alt > 6 ? "light" : "dark";
}

/** Serialize the boot IIFE. The math is emitted from useSolarTime's own
 *  function sources (toString) plus the two constants they close over —
 *  emitted BEFORE the functions, so the copy executes exactly what the
 *  runtime executes. */
export function buildThemeBootJs(): string {
  const constBlock = [
    `var DEG = ${DEG};`,
    `var RAD = ${RAD};`,
    `var DEFAULT_GEO_LOCATION = ${JSON.stringify(DEFAULT_GEO_LOCATION)};`,
  ].join("\n");
  const serialized = [
    toJulianDate,
    greenwichSiderealTime,
    sunEquatorialCoordinates,
    solarAltitude,
    zoneOffsetMinutes,
    manualLocationOf,
  ]
    .map((fn) => `var ${fn.name} = ${fn.toString()};`)
    .join("\n");
  const wrapper = `try {
  var d = document.documentElement;
  var read = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var t = read("hikari-theme");
  var m = read("hikari-theme-mode");
  var strategy = read("${SOLAR_LOCATION_STRATEGY_STORAGE_KEY}");
  if (strategy !== "timezone" && strategy !== "ip" && strategy !== "manual") strategy = "timezone";
  var NOW = (typeof __hikariBootNow !== "undefined" && __hikariBootNow) ? new Date(__hikariBootNow) : new Date();
  var geo = { lat: DEFAULT_GEO_LOCATION.lat, lng: -NOW.getTimezoneOffset() / 4 };
  if (strategy === "manual") {
    try {
      var raw = read("${SOLAR_MANUAL_LOCATION_STORAGE_KEY}");
      if (raw) {
        var cfg = JSON.parse(raw);
        var ok = cfg && typeof cfg === "object" && typeof cfg.timeZone === "string" &&
          (cfg.hemisphere === "north" || cfg.hemisphere === "south");
        if (ok) {
          try { new Intl.DateTimeFormat("en-US", { timeZone: cfg.timeZone }); }
          catch (e) { ok = false; }
        }
        if (ok) geo = manualLocationOf(cfg);
      }
    } catch (e) {}
  }
  var alt = solarAltitude(geo.lat, geo.lng, NOW);
  if (!(m === "light" || m === "dark")) {
    m = alt > 6 ? "light" : "dark";
  }
  d.setAttribute("data-theme", t || (typeof window !== "undefined" && window.__celestiaDefaultTheme) || "default");
  d.setAttribute("data-mode", m);
} catch (e) {}`;
  return `/* GENERATED by packages/vue/src/theme/themeBoot.ts (buildThemeBootJs) —
 * do not edit by hand. The math functions are serialized from useSolarTime's
 * own definitions via toString(), so this asset cannot drift from the
 * runtime's solar chain by construction; the wrapper (storage reads +
 * attribute writes) is pinned by themeBoot.contract.test.ts. Inline in
 * <head> BEFORE the theme-vars sheet's first paint.
 *
 * SYNTAX FLOOR: ES2020 (const/let, arrow functions, optional chaining).
 * The asset is inlined RAW — no consumer build step transpiles it — so it
 * targets the same floor the family's bundles do (vite target es2020).
 * A browser older than that cannot run the app it belongs to either; it
 * simply keeps its unthemed first paint. Keep this file free of syntax
 * NEWER than ES2020: a parse error would void the whole inline script and
 * the surrounding try/catch cannot recover from a parse failure. */
(function () {
${constBlock}
${serialized}
${wrapper}
})();
`;
}
