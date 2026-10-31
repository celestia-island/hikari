import { describe, expect, it } from "vitest";

import { lerpPalette } from "../utils/scene3d";

import {
  bodyPositionAt,
  bodyReach,
  buildFleetSceneSpec,
  buildHolographicFleetSpec,
  fleetEnclosure,
  hologramOuterRadius,
  PLANET_PALETTE,
  SATELLITE_PALETTE,
  SATELLITE_VISUAL_CAP,
  satelliteOrbit,
  STAR_PALETTE,
} from "./holographicFleetSpec";

function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Hue in degrees [0, 360) and saturation [0, 1] of a hex colour. */
function hueSat(hex: string): { hue: number; sat: number } {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const sat = max === 0 ? 0 : d / max;
  if (d === 0) return { hue: 0, sat };
  let hue: number;
  if (max === r) hue = 60 * (((g - b) / d) % 6);
  else if (max === g) hue = 60 * ((b - r) / d + 2);
  else hue = 60 * ((r - g) / d + 4);
  return { hue: (hue + 360) % 360, sat };
}

/** A palette-lerped rgb triple back to hex (for the hue sampler). */
function rgbToHex(rgb: [number, number, number] | number[]): string {
  return (
    "#" +
    rgb
      .slice(0, 3)
      .map((c) => Math.max(0, Math.min(255, Math.round(c * 255))).toString(16).padStart(2, "0"))
      .join("")
  );
}

describe("palettes (user constraint: stars slide blue→orange, NO purple/green)", () => {
  const GREEN: [number, number] = [75, 165];
  const PURPLE: [number, number] = [250, 310];

  /** A hue outside both forbidden windows. */
  function expectCleanHue(hex: string): void {
    const { hue, sat } = hueSat(hex);
    if (sat < 0.12) return; // near-whites carry no hue
    expect(
      (hue < GREEN[0] || hue > GREEN[1]) && (hue < PURPLE[0] || hue > PURPLE[1]),
      `${hex} hue ${hue.toFixed(1)}° must avoid green ${GREEN} and purple ${PURPLE}`,
    ).toBe(true);
  }

  it("every star stop avoids the green and purple hue windows", () => {
    for (const stop of STAR_PALETTE) expectCleanHue(stop);
  });

  it("star stops actually span the blue→orange arc", () => {
    const hues = STAR_PALETTE.map((s) => hueSat(s)).filter((h) => h.sat >= 0.12).map((h) => h.hue);
    expect(Math.min(...hues)).toBeLessThan(45); // reaches orange
    expect(Math.max(...hues)).toBeGreaterThan(200); // reaches blue
  });

  it("keeps the whole interpolated range clean, not just the stops", () => {
    // A stop-only guard cannot see a mid-segment excursion; sample every
    // palette across the full t range.
    const sample = (palette: string[]) => {
      const hues: number[] = [];
      for (let i = 0; i <= 100; i++) {
        const { hue, sat } = hueSat(rgbToHex(lerpPalette(palette, i / 100)));
        if (sat >= 0.12) hues.push(hue);
      }
      return hues;
    };
    for (const palette of [STAR_PALETTE, PLANET_PALETTE, SATELLITE_PALETTE]) {
      for (const hue of sample(palette)) {
        expect(
          (hue < GREEN[0] || hue > GREEN[1]) && (hue < PURPLE[0] || hue > PURPLE[1]),
          `interpolated hue ${hue.toFixed(1)}° must avoid green ${GREEN} and purple ${PURPLE}`,
        ).toBe(true);
      }
    }
  });

  it("planet and satellite stops avoid green and purple too", () => {
    for (const stop of [...PLANET_PALETTE, ...SATELLITE_PALETTE]) expectCleanHue(stop);
  });
});

const ROSTER = [
  { node_id: "host-node-2", tier: 3, station_count: 2 },
  { node_id: "node-31590ce571d9", tier: 2, station_count: 0 },
  { node_id: "node-310aaea1576a", tier: 2, station_count: 3 },
  { node_id: "evernight-gateway", tier: 2, station_count: 20 },
  { node_id: "host-node-3", tier: 2, station_count: 0 },
];

describe("buildFleetSceneSpec", () => {
  it("is fully deterministic for the same roster", () => {
    expect(buildFleetSceneSpec(ROSTER)).toEqual(buildFleetSceneSpec(ROSTER));
  });

  it("maps tiers to roles: hub → star, standard node → planet", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    expect(spec.stars.map((s) => s.id)).toEqual(["host-node-2"]);
    expect(spec.planets.map((p) => p.id).sort()).toEqual([
      "evernight-gateway",
      "host-node-3",
      "node-310aaea1576a",
      "node-31590ce571d9",
    ]);
  });

  it("a single hub sits at the origin as the system sun", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    expect(spec.stars[0].orbitCenter).toEqual([0, 0, 0]);
    expect(spec.hasRegistryCore).toBe(false);
  });

  it("several hubs spread on a ring (none at the exact origin)", () => {
    const spec = buildFleetSceneSpec([
      { node_id: "hub-a", tier: 3, station_count: 0 },
      { node_id: "hub-b", tier: 3, station_count: 0 },
      { node_id: "hub-c", tier: 3, station_count: 0 },
    ]);
    for (const s of spec.stars) {
      const d = Math.hypot(...s.orbitCenter);
      expect(d).toBeGreaterThan(10);
    }
    // And no two stars share a spot.
    const keys = new Set(spec.stars.map((s) => s.orbitCenter.map((v) => v.toFixed(3)).join(",")));
    expect(keys.size).toBe(3);
  });

  it("planets never collide on an orbit radius within one system", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    const bySystem = new Map<string, number[]>();
    for (const p of spec.planets) {
      const key = p.orbitCenter.join(",");
      bySystem.set(key, [...(bySystem.get(key) ?? []), p.orbitRadius]);
    }
    for (const radii of bySystem.values()) {
      expect(new Set(radii.map((r) => r.toFixed(6))).size).toBe(radii.length);
    }
  });

  it("with no hubs, planets circle the registry core marker", () => {
    const spec = buildFleetSceneSpec([
      { node_id: "node-a", tier: 2, station_count: 1 },
      { node_id: "node-b", tier: 2, station_count: 0 },
    ]);
    expect(spec.stars).toHaveLength(0);
    expect(spec.hasRegistryCore).toBe(true);
    for (const p of spec.planets) expect(p.orbitCenter).toEqual([0, 0, 0]);
  });

  it("keeps every pair of stars clear of each other, up to a dozen hubs", () => {
    // The ring used to jitter each star by a hash offset, which exceeds the
    // golden-angle gap from n = 6 upward — two suns could be drawn on top
    // of each other. Pin the clearance instead of merely "distinct centres".
    for (let n = 2; n <= 12; n++) {
      const rows = Array.from({ length: n }, (_, i) => ({
        node_id: `hub-ring-${n}-${i}`,
        tier: 3,
        station_count: 0,
      }));
      const spec = buildFleetSceneSpec(rows);
      expect(spec.stars).toHaveLength(n);
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          const [ax, ay, az] = spec.stars[a].orbitCenter;
          const [bx, by, bz] = spec.stars[b].orbitCenter;
          const dist = Math.hypot(ax - bx, ay - by, az - bz);
          const sum = spec.stars[a].radius + spec.stars[b].radius;
          expect(dist, `n=${n}: ${spec.stars[a].id} vs ${spec.stars[b].id}`).toBeGreaterThan(sum);
        }
      }
    }
  });

  it("fits a gateway's moons and the next planet inside one brood step", () => {
    // The failure this pins: measuring the moon band with parentRadius = 0
    // (the old test) hid that a real planet's own radius plus its moons
    // reached past the next orbit — moons visibly swept through their
    // neighbour. Compare against the spec's OWN spacing so the assertion
    // cannot drift from the layout.
    const rows = [
      { node_id: "hub-moon", tier: 3, station_count: 0 },
      // Two nodes that hash onto the SAME star: the inner one carries a
      // full moon system, the outer one is the neighbour it must not hit.
      ...["node-moon-a", "node-moon-b", "node-moon-c", "node-moon-d"].map((id) => ({
        node_id: id,
        tier: 2,
        station_count: 8,
      })),
    ];
    const spec = buildFleetSceneSpec(rows);
    const byStar = new Map<string, typeof spec.planets>();
    for (const planet of spec.planets) {
      const key = planet.orbitCenter.join(",");
      byStar.set(key, [...(byStar.get(key) ?? []), planet]);
    }
    let checked = 0;
    for (const brood of byStar.values()) {
      const sorted = brood.slice().sort((a, b) => a.orbitRadius - b.orbitRadius);
      for (let i = 0; i + 1 < sorted.length; i++) {
        const inner = sorted[i];
        const outer = sorted[i + 1];
        const gap = outer.orbitRadius - inner.orbitRadius;
        const moonReach =
          inner.radius + satelliteOrbit(0, SATELLITE_VISUAL_CAP - 1).radius + 0.2;
        // Moon system (measured from the planet's centre) plus the next
        // planet's own sphere must stay inside the step between orbits.
        expect(
          moonReach + outer.radius,
          `moons of ${inner.id} reach ${moonReach.toFixed(2)} into ${outer.id}`,
        ).toBeLessThanOrEqual(gap);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("keeps every planet orbit clear of the other stars, however lopsided the broods", () => {
    // A star's brood marches outward by a fixed step; with the base ring
    // alone an outer orbit could cut through a neighbouring sun.
    for (let hubs = 2; hubs <= 12; hubs++) {
      const rows = [
        ...Array.from({ length: hubs }, (_, i) => ({
          node_id: `hub-clear-${hubs}-${i}`,
          tier: 3,
          station_count: 0,
        })),
        // A lopsided fleet: eight nodes that may all land on one star.
        ...Array.from({ length: 8 }, (_, i) => ({
          node_id: `node-clear-${hubs}-${i}`,
          tier: 2,
          station_count: 0,
        })),
      ];
      const spec = buildFleetSceneSpec(rows);
      for (const planet of spec.planets) {
        for (const star of spec.stars) {
          if (planet.orbitCenter.join(",") === star.orbitCenter.join(",")) continue;
          const [cx, cy, cz] = planet.orbitCenter;
          const [sx, sy, sz] = star.orbitCenter;
          const centreDist = Math.hypot(cx - sx, cy - sy, cz - sz);
          expect(
            planet.orbitRadius + planet.radius + star.radius,
            `hubs=${hubs}: ${planet.id} orbit crosses ${star.id}`,
          ).toBeLessThanOrEqual(centreDist);
        }
      }
    }
  });

  it("caps visual moons but keeps the true station count", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    const gw = spec.planets.find((p) => p.id === "evernight-gateway")!;
    expect(gw.satellites).toBe(SATELLITE_VISUAL_CAP);
    expect(gw.satelliteTotal).toBe(20);
  });

  it("caps a hub's visual moons too and keeps its true endpoint count", () => {
    // The cap guards BOTH roles; only the planet side was exercised, so a
    // hub with 20 endpoints could quietly grow twenty moons on screen.
    const spec = buildFleetSceneSpec([{ node_id: "host-node-2", tier: 3, station_count: 20 }]);
    expect(spec.stars[0].satellites).toBe(SATELLITE_VISUAL_CAP);
    expect(spec.stars[0].satelliteTotal).toBe(20);
  });

  it("outer orbits sweep slower than inner ones (Kepler-flavoured)", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    const sorted = spec.planets.slice().sort((a, b) => a.orbitRadius - b.orbitRadius);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].orbitPeriodSec).toBeGreaterThan(sorted[i - 1].orbitPeriodSec);
    }
  });

  it("colours slide on the palette by id and stay inside it", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    for (const s of spec.stars) {
      // Every component inside [0, 1] — a palette-lerped colour.
      for (const c of s.color) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("buildHolographicFleetSpec", () => {
  it("keeps the public body's real display data and role mapping", () => {
    const spec = buildHolographicFleetSpec([
      {
        id: "hub-a", label: "Hub A", role: "star", status: "Online",
        online: true, endpointCount: 2, detail: "2 endpoints",
      },
      {
        id: "edge-a", label: "Edge A", role: "planet", status: "Offline",
        online: false, endpointCount: 0,
      },
    ]);
    expect(spec.stars[0]).toMatchObject({
      id: "hub-a", label: "Hub A", status: "Online", online: true,
      detail: "2 endpoints", satelliteTotal: 2,
    });
    expect(spec.planets[0]).toMatchObject({
      id: "edge-a", label: "Edge A", status: "Offline", online: false,
      detail: "", satelliteTotal: 0,
    });
  });

  it("treats a non-finite endpoint count as absent, never as NaN geometry", () => {
    const spec = buildHolographicFleetSpec([{
      id: "edge-a", label: "Edge A", role: "planet", status: "Online",
      online: true, endpointCount: Number.NaN,
    }]);
    expect(spec.planets[0].satellites).toBe(0);
    expect(spec.planets[0].satelliteTotal).toBe(0);
  });
});

describe("bodyPositionAt", () => {
  it("a star holds its place", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    expect(bodyPositionAt(spec.stars[0], 123.4)).toEqual([0, 0, 0]);
  });

  it("a planet rides its orbit circle around its star", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    const p = spec.planets[0];
    for (const t of [0, 3.7, 41.2]) {
      const [x, , z] = bodyPositionAt(p, t);
      // Untilted orbit: distance in the XZ plane equals the radius.
      const flat = Math.hypot(x - p.orbitCenter[0], z - p.orbitCenter[2]);
      expect(flat).toBeGreaterThan(p.orbitRadius * 0.85); // tilt foreshortens z
      expect(flat).toBeLessThanOrEqual(p.orbitRadius + 1e-6);
    }
  });

  it("returns to the phase point after one full period", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    const p = spec.planets[0];
    const a = bodyPositionAt(p, 10);
    const b = bodyPositionAt(p, 10 + p.orbitPeriodSec);
    expect(a[0]).toBeCloseTo(b[0], 5);
    expect(a[1]).toBeCloseTo(b[1], 5);
    expect(a[2]).toBeCloseTo(b[2], 5);
  });
});

describe("satelliteOrbit", () => {
  it("later moons ride wider, slower rings", () => {
    const a = satelliteOrbit(1, 0);
    const b = satelliteOrbit(1, 3);
    expect(b.radius).toBeGreaterThan(a.radius);
    expect(b.periodSec).toBeGreaterThan(a.periodSec);
  });
});

describe("holographic ring clearance", () => {
  it("keeps every legal outer ring inside the first moon orbit", () => {
    for (const [role, radii] of [
      ["star", [2.4, 2.8, 3.2]],
      ["planet", [0.85, 1.05, 1.3]],
    ] as const) {
      for (const radius of radii) {
        expect(hologramOuterRadius({ role, radius }), `${role} radius=${radius}`)
          .toBeLessThan(satelliteOrbit(radius, 0).radius);
      }
    }
  });
});

describe("fleetEnclosure", () => {
  // TWO hubs: their orbit centres differ, so the centroid's weighting is
  // observable (a single-hub roster sits every star at the origin, which
  // makes ANY centre — mean, bounding-box middle, literal zero — pass).
  const ROSTER = [
    { node_id: "hub-a", tier: 3, station_count: 0 },
    { node_id: "hub-b", tier: 3, station_count: 2 },
    { node_id: "edge-1", tier: 2, station_count: 0 },
    { node_id: "edge-2", tier: 2, station_count: 3 },
    { node_id: "edge-3", tier: 2, station_count: 0 },
  ];

  it("centres on the MASS centroid, not on the mean or the box middle", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    const enc = fleetEnclosure(spec)!;
    const bodies = [...spec.stars, ...spec.planets];
    const volumes = bodies.map((b) => b.radius ** 3);
    const total = volumes.reduce((a, b) => a + b, 0);
    let meanDrift = 0;
    let boxDrift = 0;
    for (let axis = 0; axis < 3; axis += 1) {
      const expected = bodies.reduce(
        (sum, b, i) => sum + b.orbitCenter[axis] * (volumes[i] / total),
        0,
      );
      expect(enc.center[axis]).toBeCloseTo(expected, 6);

      // …and it is NOT one of the cheaper answers this could have been:
      // the plain mean of the orbit centres, or the bounding-box middle.
      // (Per axis either may coincide; the weighting shows up in the
      // vector, so the drift is asserted over the strongest axis.)
      const mean =
        bodies.reduce((sum, b) => sum + b.orbitCenter[axis], 0) / bodies.length;
      const lo = Math.min(...bodies.map((b) => b.orbitCenter[axis]));
      const hi = Math.max(...bodies.map((b) => b.orbitCenter[axis]));
      meanDrift = Math.max(meanDrift, Math.abs(enc.center[axis] - mean));
      boxDrift = Math.max(boxDrift, Math.abs(enc.center[axis] - (lo + hi) / 2));
    }
    expect(meanDrift, "mass centroid is not the plain mean").toBeGreaterThan(1e-3);
    expect(boxDrift, "mass centroid is not the box middle").toBeGreaterThan(1e-3);
  });

  it("holds every body over its WHOLE orbit, plus its moon system", () => {
    const spec = buildFleetSceneSpec(ROSTER);
    const enc = fleetEnclosure(spec)!;
    for (const body of [...spec.stars, ...spec.planets]) {
      // The body sweeps its orbit: the drawn position is
      // orbitCenter + orbitRadius at some phase, so the sphere has to
      // cover the swept volume — not the t = 0 parking spot.
      const swept =
        Math.hypot(
          body.orbitCenter[0] - enc.center[0],
          body.orbitCenter[1] - enc.center[1],
          body.orbitCenter[2] - enc.center[2],
        ) + body.orbitRadius;
      expect(swept + bodyReach(body)).toBeLessThanOrEqual(enc.radius + 1e-9);
      expect(bodyReach(body), `${body.id} includes its outer holographic ring`)
        .toBeGreaterThanOrEqual(hologramOuterRadius(body));
      expect(swept).toBeGreaterThan(body.orbitRadius); // the radius is real
      // Sampled phases: every drawn position is inside the sphere.
      for (const t of [0, 3.5, 11, 22, 40]) {
        const at = bodyPositionAt(body, t);
        const d = Math.hypot(
          at[0] - enc.center[0],
          at[1] - enc.center[1],
          at[2] - enc.center[2],
        );
        expect(d + bodyReach(body), `${body.id} @${t}s`).toBeLessThanOrEqual(
          enc.radius + 1e-9,
        );
      }
    }
    // The moon system is part of the picture: a gateway with moons must
    // not report the same reach as one without.
    const withMoons = spec.planets.find((p) => p.satellites > 0)!;
    const without = { ...withMoons, satellites: 0, satelliteTotal: 0 };
    expect(bodyReach(withMoons)).toBeGreaterThan(bodyReach(without));
  });

  it("covers the registry-core marker when a fleet has no hub", () => {
    const core = buildFleetSceneSpec([{ node_id: "edge-1", tier: 2, station_count: 0 }]);
    expect(core.hasRegistryCore).toBe(true);
    const enc = fleetEnclosure(core)!;
    expect(enc.radius).toBeGreaterThanOrEqual(3.5);

    // Nothing to frame at all is null, not a degenerate sphere.
    expect(fleetEnclosure(buildFleetSceneSpec([]))).toBeNull();
  });
});
