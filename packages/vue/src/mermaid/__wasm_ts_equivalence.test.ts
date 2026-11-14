// @vitest-environment node
// wasm↔TS equivalence tests: the wasm component and the TS reference
// implementation must produce the same output for the same inputs.
// These tests are the drift detector between the two implementations —
// the Rust side is the production path, the TS side is the oracle.

import { describe, expect, it } from "vitest";

import { parseMermaid } from "./parse";
import { wasmMermaidEngine } from "./wasmEngine";
import { buildFleetSceneSpec } from "../scene3d/holographicFleetSpec";
import { buildFleetSceneSpecWasm } from "../scene3d/wasmFleetSpec";
import type { FleetRowLike } from "../scene3d/holographicFleetSpec";

const GRAPH_CASES = [
  "graph TD\n  A --> B\n  B --> C",
  "flowchart LR\n  Start[Start] --> Mid{Check} --> End",
  "graph TD\n  A[Label] -->|edge label| B(Label2)",
  "graph TD\n  X --> Y --> Z --> X",
];

const SEQUENCE_CASES = [
  "sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi",
  "sequenceDiagram\n  A->B: sync\n  B-->C: async\n  C->>A: reply",
];

const PIE_CASES = [
  'pie\n  title Sales\n  "Alpha" : 40\n  "Beta" : 60',
  'pie\n  "X" : 1\n  "Y" : 2',
];

describe("wasm↔TS equivalence: mermaid", () => {
  for (const src of GRAPH_CASES) {
    it(`graph: ${src.split("\n")[0]}`, () => {
      const ts = parseMermaid(src);
      const wasm = wasmMermaidEngine.parse(src);
      expect(wasm).toEqual(ts);
    });
  }

  for (const src of SEQUENCE_CASES) {
    it(`sequence: ${src.split("\n")[0]}`, () => {
      const ts = parseMermaid(src);
      const wasm = wasmMermaidEngine.parse(src);
      expect(wasm).toEqual(ts);
    });
  }

  for (const src of PIE_CASES) {
    it(`pie: ${src.split("\n")[0]}`, () => {
      const ts = parseMermaid(src);
      const wasm = wasmMermaidEngine.parse(src);
      expect(wasm).toEqual(ts);
    });
  }
});

const FLEET_ROWS: FleetRowLike[] = [
  { node_id: "hub-a", tier: 3, station_count: 2, label: "Hub A" },
  { node_id: "hub-b", tier: 3, station_count: 1, label: "Hub B" },
  { node_id: "node-1", tier: 2, station_count: 5, label: "Node 1" },
  { node_id: "node-2", tier: 2, station_count: 0, label: "Node 2" },
  { node_id: "node-3", tier: 2, station_count: 8, label: "Node 3" },
];

describe("wasm↔TS equivalence: scene3d", () => {
  it("fleet scene spec produces identical stars and planets", () => {
    const ts = buildFleetSceneSpec(FLEET_ROWS);
    const wasm = buildFleetSceneSpecWasm(FLEET_ROWS);
    expect(wasm.stars.length).toBe(ts.stars.length);
    expect(wasm.planets.length).toBe(ts.planets.length);
    expect(wasm.hasRegistryCore).toBe(ts.hasRegistryCore);
    // Field-level drift detection on each star.
    for (let i = 0; i < ts.stars.length; i++) {
      expect(wasm.stars[i]!.id).toBe(ts.stars[i]!.id);
      expect(wasm.stars[i]!.label).toBe(ts.stars[i]!.label);
      expect(wasm.stars[i]!.radius).toBeCloseTo(ts.stars[i]!.radius, 4);
      expect(wasm.stars[i]!.orbitRadius).toBeCloseTo(ts.stars[i]!.orbitRadius, 4);
    }
    // Field-level on each planet.
    for (let i = 0; i < ts.planets.length; i++) {
      expect(wasm.planets[i]!.id).toBe(ts.planets[i]!.id);
      expect(wasm.planets[i]!.orbitRadius).toBeCloseTo(ts.planets[i]!.orbitRadius, 4);
      expect(wasm.planets[i]!.orbitPeriodSec).toBeCloseTo(ts.planets[i]!.orbitPeriodSec, 3);
    }
  });
});
