// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
/**
 * solarTimeZones — the 24-sector wheel behind the manual zone picker's
 * globe (2026-10-31 product direction: pick a zone by GEOGRAPHY, not by
 * scrolling a 400-entry IANA dropdown).
 *
 * The picker's sphere is cut into 24 equal orange-slice wedges of 15°
 * longitude each — one per whole-hour standard offset. Rotating the globe
 * to face a wedge IS the selection; the wedge writes its REPRESENTATIVE
 * IANA zone id into the same manual config the old dropdown wrote, so
 * the engine (theme/useSolarTime.ts) is untouched:
 *
 *  - sector centers sit at offset × 15° of longitude, which is exactly
 *    the longitude `manualLocationOf` derives from a zone's standard
 *    offset (offset hours / 4 degrees... equivalently hours × 15°) — the
 *    picked wedge and the engine's derived fix AGREE by construction;
 *  - representative zones are the canonical IANA ids for each band;
 *  - representative CITIES are display-only examples (the tooltip lists
 *    them translated; deliberately never the countries — city names
 *    carry no border disputes);
 *  - half-hour zones (Asia/Kolkata, Asia/Yangon, …) still SELECT fine:
 *    `sectorIndexForZone` rounds the zone's standard offset to the
 *    nearest whole-hour band, and the stored zone id keeps the exact
 *    fractional offset the engine needs.
 *
 * Pure data + pure math: no vue, no three, no Intl calls at import time
 * (the offset probe constructs Intl.DateTimeFormat lazily and only for
 * real zone ids), so the module is trivially unit-testable in happy-dom
 * and safe to import from the theme's SSR-frozen graph.
 */

/** One 15°-wide sector of the picker's globe. */
export interface SolarTimeZoneSector {
  /** Standard-offset whole hours this band represents (-11 … +12). The
   *  +12 wedge is the antimeridian band — it covers the -12 islands too
   *  (24 wedges × 15° = 360°: there is no separate -12 wedge). */
  offset: number;
  /** Representative IANA zone id — what selecting the wedge stores. */
  zone: string;
  /** Representative city slugs for the hover tooltip (locale keys live
   *  under `hikari::theme.solar.city.<slug>`, translated per language;
   *  cities only, never countries). */
  cities: readonly string[];
}

/** The 24 sectors, sorted west → east (offset -11 … +12). */
export const SOLAR_TIME_ZONE_SECTORS: readonly SolarTimeZoneSector[] = [
  { offset: -11, zone: "Pacific/Pago_Pago", cities: ["pagoPago"] },
  { offset: -10, zone: "Pacific/Honolulu", cities: ["honolulu", "papeete"] },
  { offset: -9, zone: "America/Anchorage", cities: ["anchorage"] },
  { offset: -8, zone: "America/Los_Angeles", cities: ["losAngeles", "vancouver", "tijuana"] },
  { offset: -7, zone: "America/Denver", cities: ["denver", "edmonton", "phoenix"] },
  { offset: -6, zone: "America/Chicago", cities: ["chicago", "mexicoCity", "winnipeg"] },
  { offset: -5, zone: "America/New_York", cities: ["newYork", "toronto", "lima"] },
  { offset: -4, zone: "America/Halifax", cities: ["halifax", "santiago", "laPaz"] },
  { offset: -3, zone: "America/Sao_Paulo", cities: ["saoPaulo", "buenosAires", "montevideo"] },
  { offset: -2, zone: "America/Noronha", cities: ["noronha"] },
  { offset: -1, zone: "Atlantic/Azores", cities: ["pontaDelgada"] },
  { offset: 0, zone: "Europe/London", cities: ["london", "dublin", "accra"] },
  { offset: 1, zone: "Europe/Berlin", cities: ["berlin", "paris", "rome"] },
  { offset: 2, zone: "Africa/Cairo", cities: ["cairo", "athens", "kyiv", "johannesburg"] },
  { offset: 3, zone: "Europe/Moscow", cities: ["moscow", "istanbul", "riyadh", "nairobi"] },
  { offset: 4, zone: "Asia/Dubai", cities: ["dubai", "baku"] },
  { offset: 5, zone: "Asia/Karachi", cities: ["karachi", "mumbai", "tashkent"] },
  { offset: 6, zone: "Asia/Dhaka", cities: ["dhaka", "almaty", "yangon"] },
  { offset: 7, zone: "Asia/Bangkok", cities: ["bangkok", "jakarta", "hanoi"] },
  { offset: 8, zone: "Asia/Shanghai", cities: ["shanghai", "taipei", "hongKong", "singapore"] },
  { offset: 9, zone: "Asia/Tokyo", cities: ["tokyo", "seoul"] },
  { offset: 10, zone: "Australia/Sydney", cities: ["sydney", "vladivostok"] },
  { offset: 11, zone: "Pacific/Guadalcanal", cities: ["noumea", "honiara"] },
  { offset: 12, zone: "Pacific/Auckland", cities: ["auckland", "suva"] },
];

/** Degrees of longitude per sector (360° / 24). */
export const SECTOR_SPAN_DEG = 15;

/** Center longitude of a sector (deg, east positive): offset × 15°. */
export function sectorCenterLngDeg(offset: number): number {
  return offset * SECTOR_SPAN_DEG;
}

/** [west, east] edges of a sector in longitude degrees (east positive;
 *  the +12 sector legitimately straddles ±180°). */
export function sectorLngSpanDeg(offset: number): [number, number] {
  const center = sectorCenterLngDeg(offset);
  const half = SECTOR_SPAN_DEG / 2;
  return [center - half, center + half];
}

/** Sector index into `SOLAR_TIME_ZONE_SECTORS` for a longitude. Longitudes
 *  wrap: -180° and +180° both land on the +12 antimeridian wedge. */
export function sectorIndexForLngDeg(lngDeg: number): number {
  const normalized = (((lngDeg + 180) % 360) + 360) % 360 - 180; // [-180, 180)
  const rounded = Math.round(normalized / SECTOR_SPAN_DEG); // [-12 … 12]
  if (rounded <= -12) return 23; // the -12 half of the antimeridian band
  return rounded + 11; // offsets -11 … 12 → indexes 0 … 23
}

/** The zone's STANDARD (non-DST) offset in whole-ish hours, probed via
 *  Intl at two mid-season dates so DST never leaks into the estimate —
 *  the same Jan/Jul-minimum trick `manualLocationOf` uses. Half-hour
 *  zones keep their fraction (+5.5, +5.75, …). Unknown ids probe as 0. */
export function standardOffsetHours(zoneId: string): number {
  const probe = (date: Date): number | null => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: zoneId,
        timeZoneName: "longOffset",
      }).formatToParts(date);
      const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
      const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(raw);
      if (!m) return raw === "GMT" ? 0 : null;
      const hours = parseInt(m[2]!, 10);
      const minutes = m[3] ? parseInt(m[3], 10) : 0;
      return ((m[1] === "-" ? -1 : 1) * (hours + minutes / 60));
    } catch {
      return null;
    }
  };
  const year = new Date().getFullYear();
  const jan = probe(new Date(year, 0, 15));
  const jul = probe(new Date(year, 6, 15));
  if (jan === null || jul === null) return 0;
  // The STANDARD offset is the smaller signed one — winter in whichever
  // hemisphere observes DST.
  return Math.min(jan, jul);
}

/** Index of the sector whose whole-hour band is nearest the zone's
 *  standard offset (half-hour zones round half up: +5.5 → +6). This is
 *  the initial orientation of the globe for a stored config — the
 *  selection itself keeps the zone's exact id. */
export function sectorIndexForZone(zoneId: string): number {
  const offset = Math.round(standardOffsetHours(zoneId));
  // -12 (Etc/GMT+12 and friends) shares the antimeridian wedge with +12,
  // mirroring sectorIndexForLngDeg's wrap.
  if (offset <= -12) return 23;
  const clamped = Math.max(-11, Math.min(12, offset));
  return clamped + 11;
}

/** Convenience: the sector a zone id orients to (null when the id is not
 *  a string — defensive only; the engine validates ids upstream). */
export function sectorForZone(zoneId: string): SolarTimeZoneSector | null {
  if (typeof zoneId !== "string" || zoneId.length === 0) return null;
  return SOLAR_TIME_ZONE_SECTORS[sectorIndexForZone(zoneId)] ?? null;
}

/** Locale-neutral offset label ("UTC-11", "UTC", "UTC+8") — numbers are
 *  language-independent, so only the sector NAME key needs translating. */
export function offsetLabel(offset: number): string {
  if (offset === 0) return "UTC";
  return `UTC${offset > 0 ? "+" : "-"}${Math.abs(offset)}`;
}

// ── Globe angle conventions (three.js sphere ↔ texture longitude) ──────────
//
// three's SphereGeometry maps an equirectangular texture with
// uv.x = (L + 180°) / 360° and builds vertices as
// (x, z) = (−cos φ, sin φ)·sinθ with φ = phiStart + u·phiLength — so a
// texture longitude L sits at sphere angle φ = L + 180°, which renders at
// azimuth atan2(x, z) = L + 90°. Everything the picker aligns (wedges,
// camera ring, facing readout) goes through these helpers so the offset
// lives in exactly one place (pinned against the installed three by
// solarGlobeAlignment.test.ts, which measures real geometry vertices).

/** Sphere azimuth that faces texture longitude [lngDeg]. */
export function textureLngToAzimuthDeg(lngDeg: number): number {
  return lngDeg + 90;
}

/** Texture longitude currently faced by a sphere azimuth. */
export function azimuthToTextureLngDeg(azDeg: number): number {
  return azDeg - 90;
}

/** three phiStart (degrees) of the wedge covering the sector centered on
 *  [centerLngDeg]: west edge in texture space plus the φ = L + 180° shift. */
export function wedgePhiStartDeg(centerLngDeg: number): number {
  return centerLngDeg - SECTOR_SPAN_DEG / 2 + 180;
}

/** A controls settle counts only gestures that actually ROTATED the globe:
 *  OrbitControls fires "end" on every pointer-up (even a zero-movement
 *  click) and every wheel zoom, and neither may rewrite the draft (a
 *  stored half-hour id survives until a real re-pick). */
export function isRotationalSettle(startAzDeg: number, endAzDeg: number, thresholdDeg = 2): boolean {
  const delta = Math.abs((((endAzDeg - startAzDeg) % 360) + 540) % 360 - 180);
  return delta >= thresholdDeg;
}
