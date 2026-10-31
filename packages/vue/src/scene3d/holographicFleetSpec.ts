/**
 * holographicFleetSpec — the pure spec behind HkStarSystem.
 *
 * Turns renderer-agnostic body inputs into a deterministic solar system:
 * stars, planets and their passive-endpoint satellites. Host products map
 * their own domain (registry tiers, devices, services) into that small
 * input contract; no RPC or product permission semantics live here.
 *
 * Everything here is a pure function of the roster — the same fleet
 * always produces the same sky (palette slide, orbit radii, phases all
 * key off the node id hash), so tests can pin geometry without a GL
 * context and the scene never reshuffles between refreshes.
 *
 * Layout grammar:
 *  - ONE hub → it sits at the origin as the system sun; several hubs → a
 *    golden-angle ring so no two stars stack;
 *  - planets are assigned to a star by stable hash of their node id
 *    (the roster carries no hub↔node binding — the assignment is layout
 *    only, never topology); with no hubs they circle the registry core
 *    marker at the origin instead;
 *  - a planet's orbit radius comes from its order within its own star's
 *    brood (sorted by id), so radii never collide within a system;
 *  - periods are Kepler-flavoured (T ∝ r^1.5) and spins scale by tier.
 */

import { hashIdToUnit, lerpPalette, type Vec3 } from "../utils/scene3d";

/** Public, renderer-agnostic node input for HkStarSystem. Every HUD
 * field is caller-owned data: the component never invents traffic, alerts
 * or liveness that the host did not supply. */
export interface StarSystemBodyInput {
  id: string;
  label: string;
  role: "star" | "planet";
  /** Localized current state, for example "Online" / "Offline". */
  status: string;
  online: boolean;
  /** Real passive-endpoint count; rendered as the body's moon system. */
  endpointCount?: number;
  /** Optional real, already-formatted summary (for example "3 endpoints"). */
  detail?: string;
}

/** Internal row shape kept compatible with the original fleet layout. */
export interface FleetRowLike {
  node_id: string;
  tier: number;
  station_count: number;
  label?: string;
  status?: string;
  online?: boolean;
  detail?: string;
}

/**
 * Star spectral stops, hot → cool: blue, blue-white, white, then the
 * yellows and oranges. There is deliberately NO purple and NO green in
 * here — the user's palette constraint; `holographicFleetSpec.test.ts` pins the
 * hue window of every stop.
 */
export const STAR_PALETTE = [
  "#9bb0ff",
  "#aabfff",
  "#c9d6ff",
  "#f8f9ff",
  "#fff2df",
  "#ffd9a0",
  "#ffb46c",
  "#ff9a55",
];

/** Planet stops: icy blues through sand and rust — likewise free of
 *  green and purple (pinned by the same hue-window test). */
export const PLANET_PALETTE = [
  "#7fb8dd",
  "#a8c6e0",
  "#d9c49a",
  "#c98a5a",
  "#b06a4f",
  "#8d9db6",
  "#e0d3b8",
  "#c1573b",
];

/** Satellites stay neutral hardware-grey (low saturation, hue-exempt). */
export const SATELLITE_PALETTE = ["#b9c2cc", "#98a2ad"];

/** Visual moon cap per body — a hub with 60 stations must not bury the
 *  scene in pebbles; the label chip still reports the true count. */
export const SATELLITE_VISUAL_CAP = 8;

export interface FleetBodySpec {
  id: string;
  /** Real display data carried onto the HUD band and HTML chip. */
  label: string;
  status: string;
  online: boolean;
  detail: string;
  role: "star" | "planet";
  color: Vec3;
  /** Body radius in scene units. */
  radius: number;
  /** The point this body orbits (its own position for a star). */
  orbitCenter: Vec3;
  /** 0 for a star (it holds its place), > 0 for a planet. */
  orbitRadius: number;
  orbitPeriodSec: number;
  orbitPhase: number;
  /** Orbit-plane tilt (radians) — keeps stacked systems readable. */
  orbitTilt: number;
  spinPeriodSec: number;
  satellites: number;
  satelliteTotal: number;
}

export interface FleetSceneSpec {
  stars: FleetBodySpec[];
  planets: FleetBodySpec[];
  /** True when no hub exists and planets circle the origin marker. */
  hasRegistryCore: boolean;
}

const GOLDEN_ANGLE = 2.399963229728653;

/** Star self-rotation is stately; planets spin briskly. */
const STAR_SPIN_SEC = 80;
const PLANET_SPIN_MIN_SEC = 16;
const PLANET_SPIN_SPREAD_SEC = 20;

/** First planet orbit radius and the per-brood spacing beyond it. */
const ORBIT_BASE = 9;
/** Sized so a gateway's WHOLE moon system plus the next planet's sphere
 *  still fits between two consecutive brood orbits (see MOON_* below). */
const ORBIT_STEP = 6;

/** Bounds the layouts below rely on (mirror the radius formulas).
 *  Exported: the renderer builds the moon spheres, the enclosure has to
 *  measure the same size, and two literals would drift. */
export const MOON_RADIUS = 0.2;
const MOON_START_GAP = 1.3;
/** Cap on a planet's own radius: `0.85 + h * 0.45`. */
const MAX_BODY_RADIUS = 1.3;
/** Cap on a star's radius: `2.4 + h * 0.8`. */
const MAX_STAR_RADIUS = 3.2;

/** Holographic ring radii as multiples of the body's layout radius. Hubs
 * carry three restrained rings, standard nodes two. The maxima stay inside
 * the first moon orbit for every legal body radius. */
export const HOLOGRAM_RING_SCALES = {
  star: [1.14, 1.28, 1.4],
  planet: [1.22, 1.48],
} as const;

/** Outer decorative extent used by labels and fleet framing. */
export function hologramOuterRadius(
  body: Pick<FleetBodySpec, "radius" | "role">,
): number {
  const scales = HOLOGRAM_RING_SCALES[body.role];
  return body.radius * scales[scales.length - 1]!;
}

/** Slack kept between a moon system and the next brood's orbit. */
const MOON_BAND = (() => {
  // reach(planet centre) + next planet's radius <= ORBIT_STEP, where
  // reach = MAX_BODY_RADIUS + MOON_START_GAP + (CAP-1)*step + MOON_RADIUS.
  const budget =
    ORBIT_STEP - MOON_START_GAP - MOON_RADIUS - 2 * MAX_BODY_RADIUS;
  return Math.max(0.04, budget / (SATELLITE_VISUAL_CAP - 1));
})();

/**
 * Ring radius for the star carousel.
 *
 * The base ring keeps the suns comfortably apart, but a star's brood can
 * outgrow it: planets march outward by ORBIT_STEP, so with enough nodes
 * hashing onto one star an outer orbit would cut straight through a
 * neighbouring sun. The ring therefore also has to satisfy the clearance
 * the widest brood needs — two adjacent stars must be further apart than
 * both broods' reach plus both spheres.
 */
function starRingRadius(count: number, widestBroodOuter: number): number {
  const base = 14 + count * 4;
  if (count < 2) return 0;
  const minSeparation = 2 * (widestBroodOuter + MAX_BODY_RADIUS) + 2 * MAX_STAR_RADIUS + 2;
  const needed = minSeparation / (2 * Math.sin(Math.PI / count));
  return Math.max(base, needed);
}

export function buildFleetSceneSpec(rows: FleetRowLike[]): FleetSceneSpec {
  const hubs = rows
    .filter((r) => r.tier === 3)
    .slice()
    .sort((a, b) => (a.node_id < b.node_id ? -1 : a.node_id > b.node_id ? 1 : 0));
  const nodes = rows
    .filter((r) => r.tier === 2)
    .slice()
    .sort((a, b) => (a.node_id < b.node_id ? -1 : a.node_id > b.node_id ? 1 : 0));

  // ── Brood sizes (needed before the ring: the ring must clear the
  // widest brood's outer orbit) ────────────────────────────────────────
  const starIndexOf = (nodeId: string): number =>
    hubs.length === 0 ? -1 : Math.floor(hashIdToUnit(nodeId) * hubs.length) % hubs.length;
  const broodSizes = new Array<number>(hubs.length).fill(0);
  for (const node of nodes) {
    const i = starIndexOf(node.node_id);
    if (i >= 0) broodSizes[i] += 1;
  }
  const widestBroodOuter =
    broodSizes.length === 0
      ? 0
      : ORBIT_BASE + Math.max(0, Math.max(...broodSizes) - 1) * ORBIT_STEP;

  // ── Stars ────────────────────────────────────────────────────────────
  const stars: FleetBodySpec[] = hubs.map((row, i) => {
    const h = hashIdToUnit(row.node_id);
    let center: Vec3;
    if (hubs.length === 1) {
      // A single hub IS the system sun — dead centre.
      center = [0, 0, 0];
    } else {
      // NO per-star jitter on the angle: the golden angle's whole point is
      // a gap wide enough to keep every pair apart, and a hash offset of
      // even ±0.6 rad exceeds that gap from n = 6 upward (measured
      // penetrations at n = 6..12), stacking two suns on top of each
      // other. The hash still drives altitude and colour.
      const angle = i * GOLDEN_ANGLE;
      const ring = starRingRadius(hubs.length, widestBroodOuter);
      // A slight per-star altitude jitter (±2) un-stacks the ring.
      center = [
        Math.cos(angle) * ring,
        (h - 0.5) * 4,
        Math.sin(angle) * ring,
      ];
    }
    return {
      id: row.node_id,
      label: row.label ?? row.node_id,
      status: row.status ?? "",
      online: row.online ?? true,
      detail: row.detail ?? "",
      role: "star",
      color: lerpPalette(STAR_PALETTE, h),
      radius: 2.4 + h * 0.8,
      orbitCenter: center,
      orbitRadius: 0,
      orbitPeriodSec: 0,
      orbitPhase: 0,
      orbitTilt: 0,
      spinPeriodSec: STAR_SPIN_SEC,
      satellites: Math.min(row.station_count, SATELLITE_VISUAL_CAP),
      satelliteTotal: row.station_count,
    };
  });

  // ── Planets ──────────────────────────────────────────────────────────
  // Stable star assignment: hash(node_id) mod star count. With no stars
  // every planet circles the registry core at the origin.
  const starOf = (nodeId: string): FleetBodySpec | null =>
    stars.length === 0 ? null : stars[Math.floor(hashIdToUnit(nodeId) * stars.length) % stars.length];

  const broodIndex = new Map<string, number>();
  const planets: FleetBodySpec[] = nodes.map((row) => {
    const h = hashIdToUnit(row.node_id);
    const star = starOf(row.node_id);
    const center: Vec3 = star ? star.orbitCenter : [0, 0, 0];
    const broodKey = star ? star.id : "core";
    const k = broodIndex.get(broodKey) ?? 0;
    broodIndex.set(broodKey, k + 1);
    const orbitRadius = ORBIT_BASE + k * ORBIT_STEP;
    return {
      id: row.node_id,
      label: row.label ?? row.node_id,
      status: row.status ?? "",
      online: row.online ?? true,
      detail: row.detail ?? "",
      role: "planet",
      color: lerpPalette(PLANET_PALETTE, h),
      radius: 0.85 + h * 0.45,
      orbitCenter: center,
      orbitRadius,
      // Kepler-flavoured: outer rings sweep slower (T ∝ r^1.5).
      orbitPeriodSec: 22 * Math.pow(orbitRadius / ORBIT_BASE, 1.5),
      orbitPhase: h * Math.PI * 2,
      orbitTilt: (h - 0.5) * 0.24,
      spinPeriodSec: PLANET_SPIN_MIN_SEC + h * PLANET_SPIN_SPREAD_SEC,
      satellites: Math.min(row.station_count, SATELLITE_VISUAL_CAP),
      satelliteTotal: row.station_count,
    };
  });

  return {
    stars,
    planets,
    hasRegistryCore: stars.length === 0 && planets.length > 0,
  };
}

/** Adapt the public business-component input to the deterministic layout. */
export function buildHolographicFleetSpec(
  nodes: readonly StarSystemBodyInput[],
): FleetSceneSpec {
  return buildFleetSceneSpec(nodes.map((node) => ({
    node_id: node.id,
    tier: node.role === "star" ? 3 : 2,
    station_count: Number.isFinite(node.endpointCount)
      ? Math.max(0, Math.floor(node.endpointCount ?? 0))
      : 0,
    label: node.label,
    status: node.status,
    online: node.online,
    detail: node.detail,
  })));
}

/**
 * The fleet's framing sphere — what the camera orbits and how far it sits.
 *
 * User direction 2026-10-01: the camera's movement range is "the whole
 * diagram's centroid as the centre, the minimal enclosing range around it,
 * with the radius extended by 10%". So the CENTRE is the mass centroid of
 * the drawn bodies (volume-weighted: a hub is a sun, not a dot) and the
 * RADIUS is the smallest one that still holds the whole PICTURE around
 * that fixed centre:
 *
 *   - a planet is not a point, it is a body SWEEPING its orbit, so its
 *     term is `|orbitCenter - centre| + orbitRadius + reach` — the drawn
 *     planet (and its orbit ring) is only at `orbitCenter` for one
 *     instant of its period;
 *   - `reach` is the body's own sphere plus the outer moon orbit riding
 *     it.
 *
 *  A fleet with no hub draws the registry-core marker at the origin
 *  instead of a sun; it needs no term of its own, because such a fleet
 *  always has planets, and their sleeves (>= the first orbit radius)
 *  already reach far past that marker.
 *
 * Deliberately NOT in the sphere: the star's additive corona sprite and
 * the CSS2D name chips (plus the board's selection cursor, which hangs
 * off the scene root and was never spec geometry to begin with). Those
 * are decoration meant to bleed past the frame (a soft glow has no edge
 * to frame), and folding them in would push the fleet into a corner of
 * an empty view.
 *
 * Pure, so the framing is testable without a GL context and cannot drift
 * from the layout the spec builds.
 */
export interface FleetEnclosure {
  center: Vec3;
  radius: number;
}

export function fleetEnclosure(spec: FleetSceneSpec): FleetEnclosure | null {
  const bodies = [...spec.stars, ...spec.planets];
  if (bodies.length === 0) return null;

  // Mass centroid: volume is what "centroid" means for spheres, and it is
  // what keeps a single fat hub from being dragged off by its pebbles.
  const volumes = bodies.map((b) => b.radius ** 3);
  const total = volumes.reduce((sum, v) => sum + v, 0);
  const center: Vec3 = [0, 0, 0];
  bodies.forEach((body, i) => {
    const w = volumes[i] / total;
    for (let axis = 0; axis < 3; axis += 1) center[axis] += body.orbitCenter[axis] * w;
  });

  let radius = 0;
  for (const body of bodies) {
    // The swept orbit, not the body's position at t = 0.
    const sweep = distanceTo(center, body.orbitCenter) + body.orbitRadius;
    radius = Math.max(radius, sweep + bodyReach(body));
  }
  return { center, radius };
}

/** How far the polyhedron, holographic rings and moon system reach. */
export function bodyReach(body: FleetBodySpec): number {
  const visualReach = hologramOuterRadius(body);
  if (body.satellites <= 0) return visualReach;
  const outer = satelliteOrbit(body.radius, body.satellites - 1);
  return Math.max(visualReach, outer.radius + MOON_RADIUS);
}

function distanceTo(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Satellite orbit layout around its parent body (index j of n). */
export function satelliteOrbit(parentRadius: number, j: number): {
  radius: number;
  periodSec: number;
  phase: number;
  tilt: number;
} {
  // MOON_BAND is derived from ORBIT_STEP and the largest real body radius:
  // the outermost moon plus the next planet's sphere still fit inside one
  // brood step, so a gateway's moons never sweep through its neighbour.
  return {
    radius: parentRadius + MOON_START_GAP + j * MOON_BAND,
    periodSec: 5 + j * 1.7,
    phase: (j * GOLDEN_ANGLE) % (Math.PI * 2),
    tilt: (j % 3) * 0.35,
  };
}

/** World position of a body at time t (seconds since scene start). */
export function bodyPositionAt(spec: FleetBodySpec, t: number): Vec3 {
  if (spec.orbitRadius <= 0) return spec.orbitCenter;
  const angle = spec.orbitPhase + (t / spec.orbitPeriodSec) * Math.PI * 2;
  const x = Math.cos(angle) * spec.orbitRadius;
  const z = Math.sin(angle) * spec.orbitRadius;
  // Tilt rotates the flat orbit around the X axis.
  const y = -z * Math.sin(spec.orbitTilt);
  const zTilted = z * Math.cos(spec.orbitTilt);
  return [
    spec.orbitCenter[0] + x,
    spec.orbitCenter[1] + y,
    spec.orbitCenter[2] + zTilted,
  ];
}
