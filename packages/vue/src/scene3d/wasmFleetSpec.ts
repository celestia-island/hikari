// wasmFleetSpec.ts — the wasm-backed fleet scene spec builder.
//
// Bridges hikari-wasm-scene3d (the Rust component that computes the
// deterministic solar-system layout) into the TS FleetSceneSpec shape the
// three.js renderer consumes. The TS buildFleetSceneSpec stays as the
// reference implementation and test oracle; this bridge routes production
// traffic through the wasm component.

import { buildFleetScene as wasmBuild } from "../wasm/scene3d/hikari_wasm_scene3d.js";
import type { FleetBodySpec, FleetRowLike, FleetSceneSpec } from "./holographicFleetSpec";
import type { Vec3 } from "../utils/scene3d";

/** WIT tuple → TS Vec3 (both are 3-element arrays at runtime). */
const toVec3 = (t: readonly [number, number, number]): Vec3 => [t[0], t[1], t[2]];

/** Adapt the wasm component's FleetBodySpec to the TS shape. */
function adaptBody(b: {
  id: string; label: string; status: string; online: boolean; detail: string;
  role: string; color: readonly [number, number, number]; radius: number;
  orbitCenter: readonly [number, number, number]; orbitRadius: number;
  orbitPeriodSec: number; orbitPhase: number; orbitTilt: number;
  spinPeriodSec: number; satellites: number; satelliteTotal: number;
}): FleetBodySpec {
  return {
    id: b.id,
    label: b.label,
    status: b.status,
    online: b.online,
    detail: b.detail,
    role: b.role === "star" ? "star" : "planet",
    color: toVec3(b.color),
    radius: b.radius,
    orbitCenter: toVec3(b.orbitCenter),
    orbitRadius: b.orbitRadius,
    orbitPeriodSec: b.orbitPeriodSec,
    orbitPhase: b.orbitPhase,
    orbitTilt: b.orbitTilt,
    spinPeriodSec: b.spinPeriodSec,
    satellites: b.satellites,
    satelliteTotal: b.satelliteTotal,
  };
}

/** Build the fleet scene spec through the wasm component. */
export function buildFleetSceneSpecWasm(rows: readonly FleetRowLike[]): FleetSceneSpec {
  const wasmRows = rows.map((r) => ({
    nodeId: r.node_id,
    tier: r.tier,
    stationCount: r.station_count,
    label: r.label,
    status: r.status,
    online: r.online,
    detail: r.detail,
  }));
  const result = wasmBuild(wasmRows);
  return {
    stars: result.stars.map(adaptBody),
    planets: result.planets.map(adaptBody),
    hasRegistryCore: result.hasRegistryCore,
  };
}
