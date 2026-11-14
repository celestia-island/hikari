// @vitest-environment node
// Golden snapshot for the fleet scene spec: the wasm component's output
// is the reference (the TS implementation was the original oracle,
// retired when the Rust side proved stable).

import { describe, expect, it } from "vitest";

import { buildFleetSceneSpecWasm } from "./wasmFleetSpec";
import type { FleetRowLike } from "./holographicFleetSpec";

const ROWS: FleetRowLike[] = [
  { node_id: "hub-a", tier: 3, station_count: 2, label: "Hub A" },
  { node_id: "hub-b", tier: 3, station_count: 1, label: "Hub B" },
  { node_id: "node-1", tier: 2, station_count: 5, label: "Node 1" },
  { node_id: "node-2", tier: 2, station_count: 0, label: "Node 2" },
  { node_id: "node-3", tier: 2, station_count: 8, label: "Node 3" },
];

describe("scene3d golden snapshot (wasm is the reference)", () => {
  it("fleet scene spec golden", () => {
    const spec = buildFleetSceneSpecWasm(ROWS);
    expect(spec.stars.length).toBeGreaterThan(0);
    expect(spec.planets.length).toBeGreaterThan(0);
    // Pin key layout values — any semantic change is a snapshot diff.
    expect({
      starCount: spec.stars.length,
      planetCount: spec.planets.length,
      hasRegistryCore: spec.hasRegistryCore,
      star0Radius: spec.stars[0]!.radius,
      planet0OrbitRadius: spec.planets[0]!.orbitRadius,
      planet0Period: spec.planets[0]!.orbitPeriodSec,
    }).toMatchSnapshot();
  });
});
