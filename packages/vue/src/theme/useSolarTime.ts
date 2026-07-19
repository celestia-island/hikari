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

const GEO_API_URL = "https://ipapi.co/json/";
const GEO_API_TIMEOUT_MS = 4000;

function timezoneFallback(): { lat: number; lng: number } {
  const offsetMin = -new Date().getTimezoneOffset();
  const lng = offsetMin / 4;
  return { lat: DEFAULT_GEO_LOCATION.lat, lng };
}

export function getGeolocation(): Promise<{ lat: number; lng: number }> {
  const controller = new AbortController();
  const timer = scheduleCronAfter(() => controller.abort(), GEO_API_TIMEOUT_MS);
  return fetch(GEO_API_URL, { signal: controller.signal, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then(
      (d: { latitude?: number; longitude?: number } | null) => {
        timer.disconnect();
        if (
          d &&
          typeof d.latitude === "number" &&
          typeof d.longitude === "number" &&
          (Math.abs(d.latitude) > 0.01 || Math.abs(d.longitude) > 0.01)
        ) {
          return { lat: d.latitude, lng: d.longitude };
        }
        return timezoneFallback();
      },
      () => {
        timer.disconnect();
        return timezoneFallback();
      },
    );
}
