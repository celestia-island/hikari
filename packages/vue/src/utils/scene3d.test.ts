import { describe, expect, it } from "vitest";

import {
  clampMinimapZoom,
  fitDistance,
  HOVER_BOX_ARM_RATIO,
  hoverBoxSegments,
  hashIdToUnit,
  lerpPalette,
  MINIMAP_MAX_POLAR,
  MINIMAP_MAX_ZOOM_PERCENT,
  MINIMAP_MIN_POLAR,
  MINIMAP_MIN_ZOOM_PERCENT,
  orbitDelta,
  paletteColorForId,
  planeCorners,
  sphericalPosition,
  viewPlaneHalfExtents,
} from "./scene3d";

describe("hashIdToUnit", () => {
  it("is stable for the same id", () => {
    expect(hashIdToUnit("node-31590ce571d9")).toBe(hashIdToUnit("node-31590ce571d9"));
  });

  it("returns values inside [0, 1)", () => {
    for (const id of ["", "a", "host-node-2", "evernight-gateway", "节点-1", "🛰️-x"]) {
      const v = hashIdToUnit(id);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("spreads similar ids across the range (no low-bit clustering)", () => {
    const values = new Set<number>();
    for (let i = 0; i < 200; i++) values.add(Math.floor(hashIdToUnit(`node-${i}`) * 10));
    // 200 ids over 10 buckets: a degenerate hash would collapse into 1-2.
    expect(values.size).toBeGreaterThanOrEqual(8);
  });
});

describe("lerpPalette", () => {
  const palette = ["#000000", "#ff0000", "#ffffff"];

  it("hits the exact stops at 0 / 0.5 / 1", () => {
    expect(lerpPalette(palette, 0)).toEqual([0, 0, 0]);
    expect(lerpPalette(palette, 0.5)).toEqual([1, 0, 0]);
    expect(lerpPalette(palette, 1)).toEqual([1, 1, 1]);
  });

  it("interpolates between stops", () => {
    const [r, g, b] = lerpPalette(palette, 0.25);
    expect(r).toBeCloseTo(0.5, 5);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });

  it("clamps out-of-range t", () => {
    expect(lerpPalette(palette, -1)).toEqual([0, 0, 0]);
    expect(lerpPalette(palette, 2)).toEqual([1, 1, 1]);
  });

  it("tolerates degenerate palettes", () => {
    expect(lerpPalette([], 0.3)).toEqual([1, 1, 1]);
    expect(lerpPalette(["#102030"], 0.9)).toEqual([
      0x10 / 255,
      0x20 / 255,
      0x30 / 255,
    ]);
  });
});

describe("paletteColorForId", () => {
  it("is deterministic per id and lands on the palette", () => {
    const palette = ["#9bb0ff", "#ffd9a0"];
    const a = paletteColorForId("host-node-2", palette);
    expect(paletteColorForId("host-node-2", palette)).toEqual(a);
    for (const c of a) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });
});

describe("orbitDelta", () => {
  it("horizontal drag sweeps azimuth, vertical drag sweeps polar", () => {
    const next = orbitDelta(1.0, 1.2, 40, -30);
    expect(next.theta).toBeGreaterThan(1.0);
    expect(next.phi).toBeLessThan(1.2);
  });

  it("clamps the polar angle off the poles", () => {
    expect(orbitDelta(0, 0.01, 0, -10000).phi).toBeCloseTo(MINIMAP_MIN_POLAR, 6);
    expect(orbitDelta(0, Math.PI - 0.01, 0, 10000).phi).toBeCloseTo(MINIMAP_MAX_POLAR, 6);
  });

  it("never returns NaN for extreme deltas", () => {
    const next = orbitDelta(0, 1, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
    expect(Number.isFinite(next.theta)).toBe(true);
    expect(Number.isFinite(next.phi)).toBe(true);
  });
});

describe("sphericalPosition", () => {
  it("orbits on the sphere centred on the given point", () => {
    const center: [number, number, number] = [3, 4, 5];
    const radius = 10;
    for (const [theta, phi] of [[0, 1], [1.2, 0.4], [-2.2, 2.6]] as const) {
      const p = sphericalPosition(center, theta, phi, radius);
      const d = Math.hypot(p[0] - 3, p[1] - 4, p[2] - 5);
      expect(d).toBeCloseTo(radius, 5);
    }
  });

  it("phi=0 sits straight above the center", () => {
    const p = sphericalPosition([1, 2, 3], 0.7, 0, 5);
    expect(p[0]).toBeCloseTo(1, 5);
    expect(p[1]).toBeCloseTo(7, 5);
    expect(p[2]).toBeCloseTo(3, 5);
  });
});

describe("fitDistance", () => {
  it("a sphere at the fit distance exactly fills the vertical fov", () => {
    // fov 90°, aspect wide → dist = r / sin(45°).
    expect(fitDistance(10, 90, 2)).toBeCloseTo(10 / Math.sin(Math.PI / 4), 4);
  });

  it("narrow aspect tightens the usable fov (needs more distance)", () => {
    expect(fitDistance(10, 90, 0.5)).toBeGreaterThan(fitDistance(10, 90, 2));
  });

  it("degenerate input falls back to a safe unit distance", () => {
    expect(fitDistance(0, 45, 1)).toBe(1);
    expect(fitDistance(10, 0, 1)).toBe(1);
    expect(fitDistance(10, 45, 0)).toBe(1);
    expect(fitDistance(Number.NaN, 45, 1)).toBe(1);
  });
});

describe("viewPlaneHalfExtents + planeCorners", () => {
  it("half extents follow tan(fov/2) * dist and aspect", () => {
    const { halfW, halfH } = viewPlaneHalfExtents(60, 2, 10);
    expect(halfH).toBeCloseTo(Math.tan(Math.PI / 6) * 10, 6);
    expect(halfW).toBeCloseTo(halfH * 2, 6);
  });

  it("corners straddle the center along right/up", () => {
    const corners = planeCorners([0, 0, -10], [1, 0, 0], [0, 1, 0], 4, 2);
    expect(corners).toHaveLength(4);
    expect(corners[0]).toEqual([-4, 2, -10]); // top-left
    expect(corners[1]).toEqual([4, 2, -10]); // top-right
    expect(corners[2]).toEqual([4, -2, -10]); // bottom-right
    expect(corners[3]).toEqual([-4, -2, -10]); // bottom-left
  });
});

describe("clampMinimapZoom", () => {
  it("clamps into [min, max] and tames non-finite input", () => {
    expect(clampMinimapZoom(0)).toBe(MINIMAP_MIN_ZOOM_PERCENT);
    expect(clampMinimapZoom(9999)).toBe(MINIMAP_MAX_ZOOM_PERCENT);
    expect(clampMinimapZoom(120)).toBe(120);
    expect(clampMinimapZoom(Number.NaN)).toBe(100);
  });
});

describe("hoverBoxSegments", () => {
  it("emits eight corners with three inward arms each", () => {
    const size: [number, number, number] = [2, 4, 6];
    const positions = hoverBoxSegments(size);
    // 8 corners × 3 arms × 2 vertices.
    expect(positions).toHaveLength(8 * 3 * 2 * 3);

    const cornerSet = new Set<string>();
    const armLengths: number[] = [];
    const arm = HOVER_BOX_ARM_RATIO * 2; // smallest side wins
    for (let i = 0; i < positions.length; i += 6) {
      const a: [number, number, number] = [positions[i], positions[i + 1], positions[i + 2]];
      const b: [number, number, number] = [positions[i + 3], positions[i + 4], positions[i + 5]];
      cornerSet.add(a.join(","));
      // Every arm runs along exactly one axis…
      const deltas = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      expect(deltas.filter((d) => d !== 0)).toHaveLength(1);
      const len = Math.abs(deltas.find((d) => d !== 0) ?? 0);
      expect(len).toBeCloseTo(arm, 6);
      armLengths.push(len);
      // …and points INWARD: the arm may never leave the box.
      for (let axis = 0; axis < 3; axis += 1) {
        const limit = size[axis] / 2;
        expect(Math.abs(a[axis])).toBeLessThanOrEqual(limit + 1e-9);
        expect(Math.abs(b[axis])).toBeLessThanOrEqual(limit + 1e-9);
      }
    }
    // Every corner of the box is present exactly once.
    expect(cornerSet.size).toBe(8);
    for (const x of [-1, 1]) {
      for (const y of [-2, 2]) {
        for (const z of [-3, 3]) {
          expect(cornerSet.has([x, y, z].join(",")), `${x},${y},${z}`).toBe(true);
        }
      }
    }
    expect(armLengths).toHaveLength(24);
  });

  it("scales the arm with the smallest side and survives junk sizes", () => {
    const flat = hoverBoxSegments([10, 0, 10]);
    // Zero on one axis ⇒ zero-length arms rather than a thrown error.
    expect(flat.every((v) => Number.isFinite(v))).toBe(true);
    expect(flat.every((v) => !Number.isNaN(v))).toBe(true);

    const cubic = hoverBoxSegments([4, 4, 4]);
    const arm = HOVER_BOX_ARM_RATIO * 4;
    const firstLen = Math.abs(cubic[3] - cubic[0]) + Math.abs(cubic[4] - cubic[1]) + Math.abs(cubic[5] - cubic[2]);
    expect(firstLen).toBeCloseTo(arm, 6);

    const junk = hoverBoxSegments([Number.NaN, -3, 0] as [number, number, number]);
    expect(junk.every((v) => Number.isFinite(v))).toBe(true);
  });
});
