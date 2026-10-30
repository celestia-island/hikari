import { ref } from "vue";

import { scheduleCronAfter } from "../runtime/cronBus";
import { readStorageItem, removeStorageItem, writeStorageItem } from "./safeStorage";

export type TimePeriod = "day" | "dusk" | "night";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function toJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

function greenwichSiderealTime(jd: number): number {
  const T = (jd - 2451545.0) / 36525;
  let theta = (280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - T * T * T / 38710000) % 360;
  if (theta < 0) theta += 360;
  return theta;
}

interface SunEquatorial {
  decl: number;
  ra: number;
}

function sunEquatorialCoordinates(jd: number): SunEquatorial {
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + 36000.76983 * T) % 360;
  const M = ((357.52911 + 35999.05029 * T) % 360) * DEG;
  const C = (1.9146 - 0.004817 * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M);
  let sunLon = (L0 + C) % 360;
  if (sunLon < 0) sunLon += 360;
  const omega = (125.04 - 1934.136 * T) * DEG;
  const lambda = sunLon * DEG - 0.00569 * DEG - 0.00478 * DEG * Math.sin(omega);
  const epsilon = (23.439291 - 0.013004 * T) * DEG;
  const decl = Math.asin(Math.sin(epsilon) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
  return { decl, ra };
}

export function solarAltitude(
  latDeg: number,
  lngDeg: number,
  date: Date,
): number {
  const jd = toJulianDate(date);
  const { decl, ra } = sunEquatorialCoordinates(jd);
  let haDeg = greenwichSiderealTime(jd) + lngDeg - ra * RAD;
  haDeg = (((haDeg + 180) % 360) + 360) % 360 - 180;
  const ha = haDeg * DEG;
  const lat = latDeg * DEG;
  const alt = Math.asin(
    Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha),
  );
  return alt * RAD;
}

export function getTimePeriod(
  latDeg: number,
  lngDeg: number,
  date: Date = new Date(),
): TimePeriod {
  const alt = solarAltitude(latDeg, lngDeg, date);
  if (alt > 6) return "day";
  if (alt > -6) return "dusk";
  return "night";
}

export const DEFAULT_GEO_LOCATION = { lat: 31.23, lng: 121.47 };

/** Resolved geographic coordinates in degrees. */
export interface GeoLocation {
  lat: number;
  lng: number;
}

/**
 * Host-supplied geolocation source. Native shells (Tauri 2's geolocation
 * plugin, Electron IPC, a saved user preference, …) register one with
 * `setGeolocationProvider` so the theme clock uses the device's real fix
 * instead of hikari's own resolution. Return the coordinates, or return
 * null / throw to fall through to the strategy resolution (manual config
 * → timezone estimate →, under the "ip" strategy only, the web cascade of
 * already-granted browser geolocation → IP lookup → timezone estimate).
 */
export type GeoLocationProvider = () => Promise<GeoLocation | null>;

let geoProvider: GeoLocationProvider | null = null;

/** One successful resolution per page is shared by every consumer (theme
 *  clock, theme toggle readout, wallpaper clock). Reset by
 *  `setGeolocationProvider` (a late registration is honored on the next
 *  call) and by both solar-strategy setters. The timezone estimate is
 *  never memoized, so a transient offline boot can heal on the next
 *  `getGeolocation` / `refreshThemeClock`. */
let geoMemo: Promise<GeoLocation> | null = null;

export function setGeolocationProvider(provider: GeoLocationProvider | null): void {
  geoProvider = provider;
  geoMemo = null;
}

// ── Solar location strategy ────────────────────────────────────────────────
//
// Where the sun is for the theme clock is a POLICY, not a hardcoded
// cascade (2026-10 standardization). Hosts across the family
// (shittim-chest, the ERPs, wowsp) put one edit affordance at the bottom
// of their settings page that opens a secondary window over exactly these
// knobs, so the engine lives here in shared hikari next to the component.
//
// Strategies, in priority order:
//   1. "timezone" (DEFAULT) — fully offline: the timezone-offset estimate.
//      A fresh environment must not issue a network request, nor even
//      touch the geolocation permission, just to tint a theme. This is
//      the core semantic of the strategy engine.
//   2. "ip" — the legacy cascade, now opt-in for hosts that want a real
//      fix and accept the traffic: already-granted browser geolocation →
//      IP lookup → timezone estimate.
//   3. "manual" — an explicitly chosen IANA timezone id plus a hemisphere;
//      coordinates come from `manualLocationOf`, still fully offline.
// A host-registered provider (`setGeolocationProvider` above) keeps
// overriding every strategy — a native shell that knows the real fix
// always wins.

/** How the solar clock decides where the sun is. */
export type SolarLocationStrategy = "timezone" | "ip" | "manual";

/** Which half of the globe the observer stands on — a timezone pins only
 *  the longitude, so the hemisphere decides the latitude's sign. */
export type SolarHemisphere = "north" | "south";

/** Manual solar location: an IANA timezone id plus a hemisphere. */
export interface SolarManualLocation {
  timeZone: string;
  hemisphere: SolarHemisphere;
}

export const SOLAR_LOCATION_STRATEGY_STORAGE_KEY = "hikari-solar-strategy";
export const SOLAR_MANUAL_LOCATION_STORAGE_KEY = "hikari-solar-manual";

function isSolarHemisphere(v: unknown): v is SolarHemisphere {
  return v === "north" || v === "south";
}

/** Intl constructs a formatter only for ids it knows — the constructor
 *  throws RangeError otherwise, which is the whole validation story for
 *  manually chosen zones. */
function isKnownTimeZone(timeZone: string): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function readStoredStrategy(): SolarLocationStrategy {
  const stored = readStorageItem(SOLAR_LOCATION_STRATEGY_STORAGE_KEY);
  if (stored === "timezone" || stored === "ip" || stored === "manual") {
    return stored;
  }
  // Stale/unknown value (older build, hand-edited storage): drop it and
  // heal to the offline default — the same policy as storedThemeId().
  if (stored !== null) removeStorageItem(SOLAR_LOCATION_STRATEGY_STORAGE_KEY);
  return "timezone";
}

function readStoredManualLocation(): SolarManualLocation | null {
  const raw = readStorageItem(SOLAR_MANUAL_LOCATION_STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt payload — healed away below.
  }
  const cfg = parsed as { timeZone?: unknown; hemisphere?: unknown } | null;
  if (
    cfg &&
    typeof cfg.timeZone === "string" &&
    isSolarHemisphere(cfg.hemisphere) &&
    isKnownTimeZone(cfg.timeZone)
  ) {
    return { timeZone: cfg.timeZone, hemisphere: cfg.hemisphere };
  }
  removeStorageItem(SOLAR_MANUAL_LOCATION_STORAGE_KEY);
  return null;
}

export const solarLocationStrategy = ref<SolarLocationStrategy>(readStoredStrategy());
export const solarManualLocation = ref<SolarManualLocation | null>(readStoredManualLocation());

export function setSolarLocationStrategy(s: SolarLocationStrategy): void {
  if (s !== "timezone" && s !== "ip" && s !== "manual") {
    // Untyped callers never sneak an unknown id into the ref or storage.
    return;
  }
  solarLocationStrategy.value = s;
  writeStorageItem(SOLAR_LOCATION_STRATEGY_STORAGE_KEY, s);
  geoMemo = null;
}

export function setSolarManualLocation(cfg: SolarManualLocation | null): void {
  if (cfg === null) {
    solarManualLocation.value = null;
    removeStorageItem(SOLAR_MANUAL_LOCATION_STORAGE_KEY);
    geoMemo = null;
    return;
  }
  if (
    typeof cfg.timeZone !== "string" ||
    !isSolarHemisphere(cfg.hemisphere) ||
    !isKnownTimeZone(cfg.timeZone)
  ) {
    // Invalid config is rejected wholesale: neither the ref nor storage
    // may ever hold a zone Intl cannot construct.
    return;
  }
  solarManualLocation.value = { timeZone: cfg.timeZone, hemisphere: cfg.hemisphere };
  writeStorageItem(SOLAR_MANUAL_LOCATION_STORAGE_KEY, JSON.stringify(cfg));
  geoMemo = null;
}

/** The zone's UTC offset in minutes at the given instant, parsed from the
 *  `longOffset` name ("GMT+08:00", "GMT-03:30"; plain "GMT" for UTC). */
function zoneOffsetMinutes(timeZone: string, date: Date): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = name ? /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(name) : null;
  if (!m) return 0;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -minutes : minutes;
}

/** Coordinates for a manual config: the hemisphere flips the default
 *  latitude's sign, and the longitude is the zone's STANDARD (non-DST) UTC
 *  offset divided by 4 — 15° per hour, the zone's center meridian. DST is
 *  excluded by sampling the offset in January AND July and keeping the
 *  numerically smaller sample: daylight saving always ADDS time to the
 *  local summer, whichever hemisphere that falls in (Europe/Berlin → +1h
 *  → 15°, Australia/Sydney → +10h → 150°, Asia/Shanghai → +8h → 120°). */
export function manualLocationOf(cfg: SolarManualLocation): GeoLocation {
  const lat = cfg.hemisphere === "south" ? -DEFAULT_GEO_LOCATION.lat : DEFAULT_GEO_LOCATION.lat;
  const year = new Date().getFullYear();
  const standardOffset = Math.min(
    zoneOffsetMinutes(cfg.timeZone, new Date(year, 0, 15)),
    zoneOffsetMinutes(cfg.timeZone, new Date(year, 6, 15)),
  );
  return { lat, lng: standardOffset / 4 };
}

/** Compact common-zone list for engines without
 *  `Intl.supportedValuesOf("timeZone")` (older embedded webviews): one or
 *  two usable ids per offset band, both hemispheres included, so manual
 *  selection still works everywhere. */
const FALLBACK_TIME_ZONES: readonly string[] = [
  "UTC",
  "Pacific/Honolulu", "America/Anchorage", "America/Los_Angeles",
  "America/Denver", "America/Mexico_City", "America/Chicago",
  "America/New_York", "America/Toronto", "America/Bogota", "America/Lima",
  "America/Caracas", "America/Santiago", "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires", "Atlantic/South_Georgia",
  "Atlantic/Azores", "Europe/London", "Europe/Dublin", "Europe/Lisbon",
  "Europe/Madrid", "Europe/Paris", "Europe/Berlin", "Europe/Rome",
  "Europe/Warsaw", "Europe/Athens", "Europe/Helsinki", "Europe/Istanbul",
  "Europe/Moscow", "Africa/Casablanca", "Africa/Lagos", "Africa/Cairo",
  "Africa/Johannesburg", "Africa/Nairobi", "Asia/Jerusalem", "Asia/Riyadh",
  "Asia/Tehran", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Kathmandu", "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai",
  "Asia/Hong_Kong", "Asia/Singapore", "Asia/Taipei", "Asia/Tokyo",
  "Asia/Seoul", "Australia/Perth", "Australia/Adelaide",
  "Australia/Sydney", "Australia/Brisbane", "Pacific/Auckland",
  "Pacific/Fiji", "Pacific/Tongatapu", "Pacific/Kiritimati",
];

/** Selectable IANA timezone ids for the manual strategy. */
export function listTimeZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf("timeZone");
    if (zones.length > 0) return zones;
  } catch {
    // Pre-ES2022 engine — fall through to the compact list.
  }
  return [...FALLBACK_TIME_ZONES];
}

/** The runtime's own IANA timezone id ("UTC" when Intl declines to say). */
export function systemTimeZoneId(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const GEO_API_URL = "https://ipapi.co/json/";
const GEO_API_TIMEOUT_MS = 4000;

/** Synchronous coarse estimate: default latitude + the timezone-offset
 *  longitude. No fetch, no permission — the first-paint guess. */
export function timezoneFallback(): GeoLocation {
  const offsetMin = -new Date().getTimezoneOffset();
  const lng = offsetMin / 4;
  return { lat: DEFAULT_GEO_LOCATION.lat, lng };
}

async function browserGeolocation(): Promise<GeoLocation> {
  // Standard web geolocation — but ONLY when the site already holds the
  // permission: a theme must never be the thing that pops the browser's
  // location prompt. Prompt/denied/unavailable all fall through to the IP
  // lookup.
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("navigator.geolocation unavailable");
  }
  const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
  if (!perm || perm.state !== "granted") {
    throw new Error("geolocation permission not granted");
  }
  return new Promise<GeoLocation>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: GEO_API_TIMEOUT_MS, maximumAge: 6 * 60 * 60 * 1000 },
    );
  });
}

async function ipGeolocation(): Promise<GeoLocation> {
  const controller = new AbortController();
  const timer = scheduleCronAfter(() => controller.abort(), GEO_API_TIMEOUT_MS);
  const d = await fetch(GEO_API_URL, { signal: controller.signal, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .finally(() => timer.disconnect()) as { latitude?: number; longitude?: number } | null;
  if (
    d &&
    typeof d.latitude === "number" &&
    typeof d.longitude === "number" &&
    (Math.abs(d.latitude) > 0.01 || Math.abs(d.longitude) > 0.01)
  ) {
    return { lat: d.latitude, lng: d.longitude };
  }
  throw new Error("ip geolocation unavailable");
}

async function resolveGeoLocation(): Promise<{ geo: GeoLocation; pinned: boolean }> {
  if (geoProvider) {
    try {
      const provided = await geoProvider();
      if (provided && Number.isFinite(provided.lat) && Number.isFinite(provided.lng)) {
        return { geo: { lat: provided.lat, lng: provided.lng }, pinned: true };
      }
    } catch {
      // Provider failed — fall through to the strategy resolution.
    }
  }
  if (solarLocationStrategy.value === "manual" && solarManualLocation.value) {
    try {
      return { geo: manualLocationOf(solarManualLocation.value), pinned: true };
    } catch {
      // The zone vanished from this ICU build — estimate instead.
    }
  }
  if (solarLocationStrategy.value !== "ip") {
    // "timezone" — the DEFAULT — and a "manual" strategy whose config is
    // missing or invalid both land here: the offline estimate. A fresh
    // environment never goes to the network for a theme; this is the
    // core promise of the strategy engine.
    return { geo: timezoneFallback(), pinned: false };
  }
  try {
    return { geo: await browserGeolocation(), pinned: true };
  } catch {
    // No API / not granted / denied — never prompt for a theme.
  }
  try {
    return { geo: await ipGeolocation(), pinned: true };
  } catch {
    // Offline or the lookup service is down.
  }
  return { geo: timezoneFallback(), pinned: false };
}

export function getGeolocation(): Promise<GeoLocation> {
  geoMemo ??= resolveGeoLocation().then(({ geo, pinned }) => {
    if (!pinned) {
      // Don't pin the estimate for the whole session — drop the memo so
      // the next call re-resolves (a transient offline boot, a strategy
      // switch, a DST flip of the local zone all heal on their own). This
      // callback runs in a microtask, strictly AFTER the geoMemo ??=
      // assignment that started the chain, so the drop stays deterministic
      // even when the resolution completes synchronously (no provider,
      // "timezone" strategy).
      geoMemo = null;
    }
    return geo;
  });
  return geoMemo;
}
