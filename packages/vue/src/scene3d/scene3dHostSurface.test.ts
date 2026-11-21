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
    seam.doorOverride = (name, ...args) => {
      if (name !== EXPORT) return rawBuild(...(args as [never]));
      const value = rawBuild(...(args as [never]));
      // Same shape, every observable field marked: a consumer that used the
      // door's value must see these.
      return {
        stars: value.stars.map((b, i) => ({ ...b, label: `MARKED-star-${i}` })),
        planets: value.planets.map((b, i) => ({ ...b, label: `MARKED-planet-${i}` })),
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

    // EVERY body must carry the door's marked label — not just the first one. A
    // builder that takes the door's first body and the raw namespace's
    // remainder satisfies a single-item check, so the comparison has to cover
    // the whole result. (Both lists are checked; the flag too.)
    expect(marked.stars).toHaveLength(plain.stars.length);
    marked.stars.forEach((b, i) => {
      expect(b.label).toBe(`MARKED-star-${i}`);
    });
    expect(marked.planets).toHaveLength(plain.planets.length);
    marked.planets.forEach((b, i) => {
      expect(b.label).toBe(`MARKED-planet-${i}`);
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
