import { scheduleCronAfter } from "../runtime/cronBus";

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
 * instead of hikari's web cascade. Return the coordinates, or return
 * null / throw to fall through to the standard cascade (already-granted
 * browser geolocation → IP lookup → timezone estimate).
 */
export type GeoLocationProvider = () => Promise<GeoLocation | null>;

let geoProvider: GeoLocationProvider | null = null;

/** One successful resolution per page is shared by every consumer (theme
 *  clock, theme toggle readout, wallpaper clock). Reset by
 *  `setGeolocationProvider` so a late registration is honored on the next
 *  call; the timezone estimate is never memoized, so a transient offline
 *  boot can heal on the next `getGeolocation` / `refreshThemeClock`. */
let geoMemo: Promise<GeoLocation> | null = null;

export function setGeolocationProvider(provider: GeoLocationProvider | null): void {
  geoProvider = provider;
  geoMemo = null;
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

export function getGeolocation(): Promise<GeoLocation> {
  geoMemo ??= (async () => {
    if (geoProvider) {
      try {
        const provided = await geoProvider();
        if (provided && Number.isFinite(provided.lat) && Number.isFinite(provided.lng)) {
          return { lat: provided.lat, lng: provided.lng };
        }
      } catch {
        // Provider failed — fall through to the standard cascade.
      }
    }
    try {
      return await browserGeolocation();
    } catch {
      // No API / not granted / denied — never prompt for a theme.
    }
    try {
      return await ipGeolocation();
    } catch {
      // Offline or the lookup service is down.
    }
    // Don't pin the estimate for the whole session — drop the memo so the
    // next call retries the cascade.
    geoMemo = null;
    return timezoneFallback();
  })();
  return geoMemo;
}
