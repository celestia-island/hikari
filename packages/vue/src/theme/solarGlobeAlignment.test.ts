// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { describe, expect, it } from "vitest";

import * as THREE from "three";

import {
  SECTOR_SPAN_DEG,
  SOLAR_TIME_ZONE_SECTORS,
  sectorCenterLngDeg,
  textureLngToAzimuthDeg,
  wedgePhiStartDeg,
} from "./solarTimeZones";

const DEG = Math.PI / 180;

/**
 * The picker's TEXTURE <-> WEDGE alignment, measured against the
 * INSTALLED three (no WebGL needed: geometry generation is CPU-side).
 * This is the guard for the defect class "the +8 wedge hovers over
 * Egypt": an equirectangular texture maps longitude L to uv.x =
 * (L + 180) / 360, and three's SphereGeometry puts uv.x = 0.5 at sphere
 * azimuth atan2(x, z) = +90 deg — so azimuth = L + 90, and a wedge built
 * at phiStart = west edge + 180 deg must cover exactly its sector's
 * texture-longitude span.
 */

function azimuthOf(x: number, z: number): number {
  return (((Math.atan2(x, z) / DEG) % 360) + 360) % 360;
}

function normDiff(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

describe("three sphere texture alignment (measured, installed three)", () => {
  it("puts the texture's central meridian (uv.x = 0.5, lng 0) at azimuth +90", () => {
    const geo = new THREE.SphereGeometry(1, 64, 32);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    let seen = 0;
    for (let i = 0; i < uv.count; i++) {
      if (uv.getX(i) !== 0.5) continue;
      const az = azimuthOf(pos.getX(i), pos.getZ(i));
      // The equator row is the cleanest sample; any row must agree.
      expect(normDiff(az, textureLngToAzimuthDeg(0))).toBeLessThan(0.5);
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
    geo.dispose();
  });

  it("covers each sector's texture-longitude span with its wedge (all 24)", () => {
    for (const sector of SOLAR_TIME_ZONE_SECTORS) {
      const center = sectorCenterLngDeg(sector.offset);
      const geo = new THREE.SphereGeometry(
        1,
        8,
        12,
        wedgePhiStartDeg(center) * DEG,
        SECTOR_SPAN_DEG * DEG,
      );
      const pos = geo.attributes.position;
      let seen = 0;
      for (let i = 0; i < pos.count; i++) {
        // Exclude the degenerate pole rows (phi collapses there).
        if (Math.abs(pos.getY(i)) > 0.99) continue;
        // Invert three's vertex formula: (x, z) = (-cos phi, sin phi) sin theta,
        // then phi = texture longitude - 180.
        const phiDeg = Math.atan2(pos.getZ(i), -pos.getX(i)) / DEG;
        const textureLng = phiDeg - 180;
        const wrapped = ((((textureLng - center) % 360) + 540) % 360) - 180;
        expect(Math.abs(wrapped)).toBeLessThanOrEqual(SECTOR_SPAN_DEG / 2 + 0.6);
        seen++;
      }
      expect(seen).toBeGreaterThan(0);
      geo.dispose();
    }
  });

  it("aims the wedge's mid-phi at the sector center's facing azimuth", () => {
    for (const sector of SOLAR_TIME_ZONE_SECTORS) {
      const center = sectorCenterLngDeg(sector.offset);
      const midPhi = (wedgePhiStartDeg(center) + SECTOR_SPAN_DEG / 2) * DEG;
      const az = azimuthOf(-Math.cos(midPhi), Math.sin(midPhi));
      expect(normDiff(az, textureLngToAzimuthDeg(center))).toBeLessThan(0.001);
    }
  });
});
