// Wiring pins for the scene3d spec builder: it must reach the component
// **through the tairitsu host client's call surface**, and it must **hand its
// capability declaration to the door** rather than only publishing it.
//
// Why a separate file: the frozen golden (`__golden.test.ts`) pins the output of
// `buildFleetSceneSpecWasm`, and nothing more. A direct call to the generated
// wrapper produces identical output, so bypassing the host leaves the golden
// green. The golden also says nothing about the declaration: whether that
// constant is ever *passed* to `createSurface` is invisible to an output-only
// test. These pins observe the seam itself.
//
// The declaration half is the defect #1475 recorded (QR) and #1476 fixed:
// `createSurface(module, capabilities = {})` defaults to `{}`, so with the second
// argument omitted both `sync-door-cannot-provide` branches are unreachable and
// the declaration is decoration.
//
// The four pins below are the shape #1476 converged on after seven review
// rounds (#1474's older shape was missing three of them):
//   ① build count, asserted AFTER the call — the factory is callable repeatedly,
//     so a lazy second door is otherwise invisible;
//   ② the declaration pin reads the FIRST build — a later door must not make it
//     fail with `undefined`, i.e. for the wrong reason;
//   ③ the data path: substitute the door's return and require the caller's
//     value to be that substitution, across the WHOLE result — a discarded
//     decoy call or a partially-used door otherwise stays green;
//   ④ every assertion named in a comment here must exist in this file.
//
// (Run from `packages/vue` — that is where vite.config.ts registers the plugins.)
import { describe, expect, it, vi } from "vitest";

interface Seam {
  /** Argument list of every `surface.call(name, …)`. */
  calls: Array<{ name: string; args: unknown[] }>;
  /** What each observed `surface.call` returned, in order. */
  results: unknown[];
  /** The namespace handed to `createSurface`. */
  handed: Record<string, unknown> | undefined;
  /**
   * Test seam: when set, the wrapped door delegates to this instead of the
   * real export. Lets a probe substitute the door's return value and see
   * whether the builder consumes it.
   */
  doorOverride?: (name: string, ...args: unknown[]) => unknown;
  /**
   * The declaration handed on the FIRST build — the one that guarded module
   * load, and the one the declaration pin asserts. Captured separately (not
   * "latest build wins") because a later build would otherwise overwrite it
   * and make that pin fail with `undefined`: the wrong reason, while the
   * build-count pin names the actual fault.
   */
  firstHandedCapabilities: unknown;
  /** Every `createSurface` call's argument list, in order. */
  surfaceBuilds: unknown[][];
}

const seam: Seam = {
  calls: [],
  results: [],
  handed: undefined,
  firstHandedCapabilities: undefined,
  surfaceBuilds: [],
};

vi.mock("@celestia-island/tairitsu-host-client", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@celestia-island/tairitsu-host-client")
  >();
  return {
    ...actual,
    createSurface: (
      module: Record<string, unknown>,
      ...rest: unknown[]
    ): ReturnType<typeof actual.createSurface> => {
      seam.handed = module;
      if (seam.surfaceBuilds.length === 0) seam.firstHandedCapabilities = rest[0];
      // Every build is recorded, not just the first: the factory is callable
      // more than once, so a builder (or a copier's builder) could build a
      // SECOND unwrapped surface and route calls through it while a
      // first-call-only pin stayed green.
      seam.surfaceBuilds.push([module, ...rest]);
      // `rest` is passed through untouched, so the door's real refusal logic
      // runs against whatever the builder declared.
      const live = (
        actual.createSurface as (
          m: Record<string, unknown>,
          ...r: unknown[]
        ) => ReturnType<typeof actual.createSurface>
      )(module, ...rest);
      const realCall = live.call.bind(live);
      // Wrap the surface's call door: this is where the builder must arrive.
      live.call = ((name: string, ...args: unknown[]) => {
        seam.calls.push({ name, args });
        const value =
          seam.doorOverride !== undefined
            ? seam.doorOverride(name, ...args)
            : realCall(name, ...args);
        seam.results.push(value);
        return value;
      }) as typeof live.call;
      return live;
    },
  };
});

const { buildFleetSceneSpecWasm, scene3dCapabilities } = await import(
  "./wasmFleetSpec"
);
// The artifact itself, for the door-substitution probe.
const realWrapper = await import("../wasm/scene3d/hikari_wasm_scene3d.js");
const { SCENE3D_CAPABILITIES } = await import("./declare-caps");
import type { FleetRowLike } from "./holographicFleetSpec";

const ROWS: FleetRowLike[] = [
  { node_id: "hub-a", tier: 3, station_count: 2, label: "Hub A" },
  { node_id: "hub-b", tier: 3, station_count: 1, label: "Hub B" },
  { node_id: "node-1", tier: 2, station_count: 5, label: "Node 1" },
  { node_id: "node-2", tier: 2, station_count: 0, label: "Node 2" },
  { node_id: "node-3", tier: 2, station_count: 8, label: "Node 3" },
];

/** The JS export name the wrapper actually carries. */
const EXPORT = "buildFleetScene";

describe("scene3d spec builder goes through the host client", () => {
  it("hands the wrapper namespace to createSurface", () => {
    expect(seam.handed).toBeDefined();
    // The very artifact module — it carries the component's own export.
    expect(typeof seam.handed![EXPORT]).toBe("function");
    expect(typeof seam.handed!._util).toBe("object");
  });

  it("calls the component export through the surface, not the wrapper", () => {
    seam.calls.length = 0;
    const spec = buildFleetSceneSpecWasm(ROWS);
    expect(spec.planets.length).toBeGreaterThan(0);

    const buildCalls = seam.calls.filter((c) => c.name === EXPORT);
    // A direct `scene3dWrapper.buildFleetScene(...)` bypasses the surface
    // entirely and leaves this empty — that is the mutation this pin catches.
    expect(buildCalls).toHaveLength(1);

    // ① Exactly one surface was ever built, and it was built BEFORE the call
    // (module load). The factory is callable repeatedly, so a lazy second
    // surface inside the builder would be a fresh, unseen door that every other
    // pin here would still pass.
    expect(seam.surfaceBuilds).toHaveLength(1);

    // ③ The observed door must be the door the *returned value* came through,
    // not merely a door that was called: counting calls alone is satisfiable by
    // a decoy whose result is discarded, with the raw namespace supplying the
    // real spec. The substitution case below is what actually proves the path;
    // this only asserts the call reached the door once.
    expect(seam.results).toHaveLength(1);

    // The rows reach the component shaped as the WIT `fleet-row` expects.
    const first = (buildCalls[0]!.args[0] as Array<Record<string, unknown>>)[0]!;
    expect(first.nodeId).toBe("hub-a");
    expect(first.stationCount).toBe(2);
  });

  it("uses the whole value the observed door returned, not a parallel build", () => {
    // Behavioural discriminator for the decoy shape that every count pin above
    // passes: a discarded `surface.call(…)` for the pins plus a direct
    // `scene3dWrapper.buildFleetScene(…)` that supplies the real spec. Mark
    // EVERY field of the door's return for the duration of one call — if the
    // builder consumes the marked value the door is the data path; if it
    // returns the real spec instead, it went around.
    const original = seam.doorOverride;
    // Mark EVERY carried field, not just `label`. `FleetBodySpec` has ~15
    // renderer-driving fields; marking one lets a builder source the rest from
    // a parallel raw read and still pass (measured: 75/75 with all of
    // orbitPhase/status/color/… taken from the raw namespace).
    seam.doorOverride = (name, ...args) => {
      if (name !== EXPORT) return rawBuild(...(args as [never]));
      const value = rawBuild(...(args as [never]));
      const mark = (b: (typeof value.stars)[number], kind: string, i: number) => ({
        ...b,
        id: `M-${kind}-id-${i}`,
        label: `M-${kind}-label-${i}`,
        status: `M-${kind}-status-${i}`,
        detail: `M-${kind}-detail-${i}`,
        online: !b.online,
        color: [0.111, 0.222, 0.333] as [number, number, number],
        radius: b.radius + 1000,
        orbitCenter: [1.5, 2.5, 3.5] as [number, number, number],
        orbitRadius: b.orbitRadius + 2000,
        orbitPeriodSec: b.orbitPeriodSec + 3000,
        orbitPhase: b.orbitPhase + 0.375,
        orbitTilt: b.orbitTilt + 0.5,
        spinPeriodSec: b.spinPeriodSec + 4000,
        satellites: b.satellites + 7,
        satelliteTotal: b.satelliteTotal + 9,
      });
      return {
        stars: value.stars.map((b, i) => mark(b, "star", i)),
        planets: value.planets.map((b, i) => mark(b, "planet", i)),
        hasRegistryCore: !value.hasRegistryCore,
      };
    };
    let marked: ReturnType<typeof buildFleetSceneSpecWasm>;
    try {
      marked = buildFleetSceneSpecWasm(ROWS);
    } finally {
      seam.doorOverride = original;
    }
    const plain = buildFleetSceneSpecWasm(ROWS);

    // EVERY field of EVERY body must be the door's value. Comparing whole
    // objects (rather than one marked key per body) is what closes the
    // field-level partial door: a builder that takes the door's labels and the
    // raw namespace's numbers passes a label-only check.
    expect(marked.stars).toHaveLength(plain.stars.length);
    marked.stars.forEach((b, i) => {
      expect(b).not.toEqual(plain.stars[i]);
      expect(b.id).toBe(`M-star-id-${i}`);
      expect(b.label).toBe(`M-star-label-${i}`);
      expect(b.status).toBe(`M-star-status-${i}`);
      expect(b.detail).toBe(`M-star-detail-${i}`);
      // The adapter normalises role to "star"/"planet", so it is asserted by
      // value rather than by a mark: a marked non-star would read as "planet".
      expect(b.role).toBe("star");
      expect(b.online).toBe(!plain.stars[i]!.online);
      expect(b.color).toEqual([0.111, 0.222, 0.333]);
      expect(b.radius).toBeCloseTo(plain.stars[i]!.radius + 1000, 5);
      expect(b.orbitCenter).toEqual([1.5, 2.5, 3.5]);
      expect(b.orbitRadius).toBeCloseTo(plain.stars[i]!.orbitRadius + 2000, 5);
      expect(b.orbitPeriodSec).toBeCloseTo(plain.stars[i]!.orbitPeriodSec + 3000, 5);
      expect(b.orbitPhase).toBeCloseTo(plain.stars[i]!.orbitPhase + 0.375, 5);
      expect(b.orbitTilt).toBeCloseTo(plain.stars[i]!.orbitTilt + 0.5, 5);
      expect(b.spinPeriodSec).toBeCloseTo(plain.stars[i]!.spinPeriodSec + 4000, 5);
      expect(b.satellites).toBe(plain.stars[i]!.satellites + 7);
      expect(b.satelliteTotal).toBe(plain.stars[i]!.satelliteTotal + 9);
    });
    expect(marked.planets).toHaveLength(plain.planets.length);
    // The planet block must assert the SAME field set as the star block. An
    // earlier revision checked only nine of the fifteen fields here, so four of
    // them (colour, orbit centre, tilt, spin) leaked from a parallel raw read
    // and the suite stayed green (measured: 75/75).
    marked.planets.forEach((b, i) => {
      expect(b).not.toEqual(plain.planets[i]);
      expect(b.id).toBe(`M-planet-id-${i}`);
      expect(b.label).toBe(`M-planet-label-${i}`);
      expect(b.status).toBe(`M-planet-status-${i}`);
      expect(b.detail).toBe(`M-planet-detail-${i}`);
      // The adapter normalises a planet's role to "planet" whatever the
      // component said, so assert the normalised value rather than a mark.
      expect(b.role).toBe("planet");
      expect(b.online).toBe(!plain.planets[i]!.online);
      expect(b.color).toEqual([0.111, 0.222, 0.333]);
      expect(b.radius).toBeCloseTo(plain.planets[i]!.radius + 1000, 5);
      expect(b.orbitCenter).toEqual([1.5, 2.5, 3.5]);
      expect(b.orbitRadius).toBeCloseTo(plain.planets[i]!.orbitRadius + 2000, 5);
      expect(b.orbitPeriodSec).toBeCloseTo(plain.planets[i]!.orbitPeriodSec + 3000, 5);
      expect(b.orbitPhase).toBeCloseTo(plain.planets[i]!.orbitPhase + 0.375, 5);
      expect(b.orbitTilt).toBeCloseTo(plain.planets[i]!.orbitTilt + 0.5, 5);
      expect(b.spinPeriodSec).toBeCloseTo(plain.planets[i]!.spinPeriodSec + 4000, 5);
      expect(b.satellites).toBe(plain.planets[i]!.satellites + 7);
      expect(b.satelliteTotal).toBe(plain.planets[i]!.satelliteTotal + 9);
    });
    expect(marked.hasRegistryCore).toBe(!plain.hasRegistryCore);
    // Guard against a trivially empty comparison.
    expect(marked.stars.length + marked.planets.length).toBeGreaterThan(0);
  });

  // The raw export, for the substitution case. Named so the override above can
  // delegate to it (the door wraps this same function).
  function rawBuild(rows: Parameters<typeof realWrapper.buildFleetScene>[0]) {
    return realWrapper.buildFleetScene(rows);
  }

  it("publishes the empty declaration the sync door requires", () => {
    // Empty is not cosmetic: `createSurface` refuses any non-empty declaration
    // (it cannot provide capabilities for an already-evaluated wrapper), so a
    // glue-bearing declaration here would make the builder unusable.
    expect(SCENE3D_CAPABILITIES).toEqual({ interfaces: [], wasiModules: [] });

    // …and the builder must hand that declaration to the door, not merely
    // publish it. Omitting the argument lets `createSurface` default to `{}`,
    // so its refusal never fires and the declared value would never be
    // consulted. Asserted against the FIRST build (②) so a later surface cannot
    // turn this into an `undefined` failure for the wrong reason — the
    // build-count pin reports a second door, this one reports the declaration
    // that actually guarded module load.
    // Scope, precisely: this pin catches **the argument being dropped**
    // (verified: it is the only case that fails then). It is not a general "no
    // wrong declaration can ship" guard — it asserts identity with whatever
    // `declare-caps.ts` exports, so changing that file to a non-empty
    // declaration passes here and is refused by the door instead (which is what
    // the next case documents).
    expect(seam.firstHandedCapabilities).toBe(SCENE3D_CAPABILITIES);

    // The declaration must have been *passed* at the call site. The identity
    // assertion above is what catches the omission (verified: dropping the
    // argument reds that line), and the line below pins the passed value on the
    // recorded build.
    //
    // Scope, precisely: `toHaveLength(2)` catches a call site that *explicitly*
    // passes `undefined` or some other non-identical value. It does NOT catch an
    // omission on its own — a seam that filled a default would still make `rest`
    // length 2 — and neither line catches a builder passing a different
    // equal-shaped object (the door only reads `.interfaces`/`.wasiModules`, so
    // the identity check is deliberately stricter than the contract).
    expect(seam.surfaceBuilds[0]).toHaveLength(2);
    expect(seam.surfaceBuilds[0]![1]).toBe(SCENE3D_CAPABILITIES);

    // Exported and read by the builder — the read the package's `sideEffects`
    // whitelist entry keeps alive.
    expect(scene3dCapabilities).toBe(SCENE3D_CAPABILITIES);
  });

  it("refuses a non-empty declaration instead of silently granting it", async () => {
    // Documents the door's contract with the REAL client: a glue- or
    // WASI-bearing declaration is refused. DISCLOSURE: this calls
    // `createSurface` directly, so it passes even if the builder stops handing
    // the declaration over — it is NOT the regression guard for that. The guard
    // is `expect(seam.firstHandedCapabilities).toBe(SCENE3D_CAPABILITIES)` above.
    const { createSurface, HostClientError } = await vi.importActual<
      typeof import("@celestia-island/tairitsu-host-client")
    >("@celestia-island/tairitsu-host-client");
    const namespace = seam.handed!;
    expect(() =>
      createSurface(namespace, { interfaces: ["document"], wasiModules: [] }),
    ).toThrow(HostClientError);
    expect(() =>
      createSurface(namespace, { interfaces: [], wasiModules: ["random"] }),
    ).toThrow(HostClientError);
    // The empty declaration is the one the door accepts.
    expect(() =>
      createSurface(namespace, { interfaces: [], wasiModules: [] }),
    ).not.toThrow();
  });
});
