// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { describe, expect, it } from "vitest";

import {
  SECTOR_SPAN_DEG,
  SOLAR_TIME_ZONE_SECTORS,
  azimuthToTextureLngDeg,
  isRotationalSettle,
  offsetLabel,
  sectorCenterLngDeg,
  sectorIndexForLngDeg,
  sectorIndexForZone,
  sectorLngSpanDeg,
  standardOffsetHours,
  textureLngToAzimuthDeg,
  wedgePhiStartDeg,
} from "./solarTimeZones";

/** The wheel geometry: 24 unique whole-hour bands, west to east. */
describe("SOLAR_TIME_ZONE_SECTORS", () => {
  it("has exactly 24 sectors covering offsets -11 through +12", () => {
    expect(SOLAR_TIME_ZONE_SECTORS).toHaveLength(24);
    expect(SOLAR_TIME_ZONE_SECTORS.map((s) => s.offset)).toEqual(
      Array.from({ length: 24 }, (_, i) => i - 11),
    );
  });

  it("gives every sector a valid IANA representative zone and cities", () => {
    for (const sector of SOLAR_TIME_ZONE_SECTORS) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: sector.zone })).not.toThrow();
      expect(sector.cities.length).toBeGreaterThan(0);
      for (const city of sector.cities) {
        expect(city).toMatch(/^[a-z][A-Za-z]+$/);
      }
    }
  });

  it("matches the user-facing example: +8 lists Shanghai, Taipei, Hong Kong", () => {
    const p8 = SOLAR_TIME_ZONE_SECTORS.find((s) => s.offset === 8)!;
    expect(p8.zone).toBe("Asia/Shanghai");
    expect(p8.cities).toEqual(["shanghai", "taipei", "hongKong", "singapore"]);
  });
});

describe("sector geometry", () => {
  it("centers sectors at offset x 15 deg longitude", () => {
    expect(sectorCenterLngDeg(-11)).toBe(-165);
    expect(sectorCenterLngDeg(0)).toBe(0);
    expect(sectorCenterLngDeg(8)).toBe(120);
    expect(sectorCenterLngDeg(12)).toBe(180);
  });

  it("spans 15 deg around the center (the +12 wedge straddles the antimeridian)", () => {
    expect(SECTOR_SPAN_DEG).toBe(15);
    expect(sectorLngSpanDeg(0)).toEqual([-7.5, 7.5]);
    expect(sectorLngSpanDeg(12)).toEqual([172.5, 187.5]);
  });

  it("maps longitudes onto sector indexes, wrapping at the antimeridian", () => {
    expect(sectorIndexForLngDeg(0)).toBe(11); // offset 0
    expect(sectorIndexForLngDeg(120)).toBe(19); // offset +8
    expect(sectorIndexForLngDeg(-165)).toBe(0); // offset -11
    expect(sectorIndexForLngDeg(180)).toBe(23); // +12 wedge
    expect(sectorIndexForLngDeg(-180)).toBe(23); // same wedge from the west
    expect(sectorIndexForLngDeg(7.4)).toBe(11);
    expect(sectorIndexForLngDeg(7.6)).toBe(12);
  });
});

describe("standardOffsetHours", () => {
  it("probes whole-hour standard offsets", () => {
    expect(standardOffsetHours("Asia/Shanghai")).toBe(8);
    expect(standardOffsetHours("Europe/London")).toBe(0);
    expect(standardOffsetHours("America/Los_Angeles")).toBe(-8);
  });

  it("keeps fractional offsets and strips DST (Jan/Jul minimum)", () => {
    expect(standardOffsetHours("Asia/Kolkata")).toBe(5.5);
    expect(standardOffsetHours("Asia/Kathmandu")).toBe(5.75);
    expect(standardOffsetHours("America/New_York")).toBe(-5); // EST, not EDT
  });

  it("probes unknown ids as UTC instead of throwing", () => {
    expect(standardOffsetHours("Mars/Olympus_Mons")).toBe(0);
  });
});

describe("sectorIndexForZone", () => {
  it("orients a stored zone onto its whole-hour band", () => {
    expect(sectorIndexForZone("Asia/Shanghai")).toBe(19);
    expect(sectorIndexForZone("America/Los_Angeles")).toBe(3);
    expect(sectorIndexForZone("Pacific/Auckland")).toBe(23);
  });

  it("rounds half-hour zones onto the nearest band", () => {
    expect(sectorIndexForZone("Asia/Kolkata")).toBe(17); // +5.5 -> +6 band
  });

  it("degrades unknown or non-string ids to the UTC band", () => {
    expect(sectorIndexForZone("Mars/Olympus_Mons")).toBe(11);
    expect(sectorIndexForZone("")).toBe(11);
    // @ts-expect-error defensive runtime contract
    expect(sectorIndexForZone(null)).toBe(11);
  });
});

describe("offsetLabel", () => {
  it("renders locale-neutral UTC labels", () => {
    expect(offsetLabel(0)).toBe("UTC");
    expect(offsetLabel(8)).toBe("UTC+8");
    expect(offsetLabel(-11)).toBe("UTC-11");
    expect(offsetLabel(12)).toBe("UTC+12");
  });
});

describe("globe angle conventions", () => {
  it("round-trips texture longitude through the sphere azimuth", () => {
    for (const lng of [-180, -135, -90, -45, 0, 45, 90, 135, 179.9]) {
      expect(azimuthToTextureLngDeg(textureLngToAzimuthDeg(lng))).toBeCloseTo(lng, 6);
    }
  });

  it("places each wedge's phi window exactly over its texture-longitude span", () => {
    for (const sector of SOLAR_TIME_ZONE_SECTORS) {
      const center = sectorCenterLngDeg(sector.offset);
      expect(wedgePhiStartDeg(center) - 180).toBeCloseTo(center - SECTOR_SPAN_DEG / 2, 6);
    }
  });

  it("counts only real rotations as settles (clicks and wheel zooms are not)", () => {
    expect(isRotationalSettle(30, 30)).toBe(false);
    expect(isRotationalSettle(30, 31.9)).toBe(false);
    expect(isRotationalSettle(30, 32)).toBe(true);
    expect(isRotationalSettle(30, 200)).toBe(true);
    // wrap-aware: a small drag across the ±180 seam is still small
    expect(isRotationalSettle(179, -179.5)).toBe(false);
    expect(isRotationalSettle(179, -170)).toBe(true);
  });
});
