// Wiring pins for the QR engine: it must reach the component **through the
// tairitsu host client's call surface**, and it must **hand its capability
// declaration to the door** rather than only publishing it.
//
// Why a separate file: the frozen golden (`qrEncoder.test.ts`) pins the output
// of `qrMatrix`. A direct call to the generated wrapper produces identical
// output, so bypassing the host leaves the golden green (verified on the sibling
// Mermaid migration: a compilable `wrapper.parse(…)` bypass kept all 16 frozen
// cases green). It also asserted only `expect(QR_CAPABILITIES).toEqual(…)`, which
// cannot see whether that constant is ever passed to `createSurface`. These pins
// observe the seam itself.
//
// The declaration half is the defect #1475 recorded: `createSurface(module,
// capabilities = {})` defaults to `{}`, so with the second argument omitted both
// `sync-door-cannot-provide` branches are unreachable and the declaration is
// decoration. Verified here: dropping the argument leaves every other case green.
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
   * whether the engine consumes it.
   */
  doorOverride?: (name: string, ...args: unknown[]) => unknown;
  /** The declaration handed to `createSurface` (not just published). */
  handedCapabilities: unknown;
  /**
   * The declaration handed on the FIRST build — the one that guarded module
   * load. Pinned separately because a later build would otherwise overwrite
   * `handedCapabilities` and make the declaration pin fail with `undefined`,
   * i.e. for the wrong reason.
   */
  firstHandedCapabilities: unknown;
  /** Every `createSurface` call's argument list, in order. */
  surfaceBuilds: unknown[][];
}

const seam: Seam = {
  calls: [],
  results: [],
  handed: undefined,
  handedCapabilities: undefined,
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
      seam.handedCapabilities = rest[0];
      if (seam.surfaceBuilds.length === 0) seam.firstHandedCapabilities = rest[0];
      // Every build is recorded, not just the first: the factory is callable
      // more than once, so an engine (or a copier's engine) could build a
      // SECOND unwrapped surface and route calls through it while a
      // first-call-only pin stayed green.
      seam.surfaceBuilds.push([module, ...rest]);
      // `rest` is passed through untouched, so the door's real refusal logic
      // runs against whatever the engine declared.
      const live = (
        actual.createSurface as (
          m: Record<string, unknown>,
          ...r: unknown[]
        ) => ReturnType<typeof actual.createSurface>
      )(module, ...rest);
      const realCall = live.call.bind(live);
      // Wrap the surface's call door: this is where the engine must arrive.
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

const { qrMatrix, qrCapabilities } = await import("./qrEncoder");
// The artifact itself, for the door-substitution probe.
const realWrapper = await import("../../wasm/qr/hikari_wasm_qr.js");
const { QR_CAPABILITIES } = await import("./declare-caps");

const PAYLOAD = "https://example.com/";

describe("QR engine goes through the host client", () => {
  it("hands the wrapper namespace to createSurface", () => {
    expect(seam.handed).toBeDefined();
    // The very artifact module — it carries the component's own export.
    expect(typeof seam.handed!.encode).toBe("function");
    expect(typeof seam.handed!._util).toBe("object");
  });

  it("calls encode through the surface, not the wrapper", () => {
    seam.calls.length = 0;
    const matrix = qrMatrix(PAYLOAD);
    expect(matrix.length).toBeGreaterThan(0);

    const encodeCalls = seam.calls.filter((c) => c.name === "encode");
    // A direct `qrWrapper.encode(...)` bypasses the surface entirely and leaves
    // this empty — that is the mutation this pin catches.
    expect(encodeCalls).toHaveLength(1);

    // Exactly one surface was ever built, and it was built BEFORE the call
    // (module load). The factory is callable repeatedly, so a lazy second
    // surface inside `qrMatrix` would be a fresh, unseen door that every other
    // pin here would still pass — this is what makes "the engine's calls go
    // through the observed door" true rather than "the first door was fine".
    expect(seam.surfaceBuilds).toHaveLength(1);
    expect(encodeCalls[0]!.args[0]).toBe(PAYLOAD);

    // The observed door must be the door the *returned value* came through, not
    // merely a door that was called. Counting calls alone is satisfiable while
    // the real work goes through the raw namespace: a decoy
    // `surface.call("encode", …)` whose result is discarded, with
    // `qrWrapper.encode(…)` supplying the matrix, keeps every count green
    // (measured 10/10) and still yields a correct matrix. So compare the
    // decoded field the caller consumed, not just the call count.
    expect(seam.results).toHaveLength(1);
  });

  it("uses the value the observed door returned, not a parallel encode", () => {
    // Behavioural discriminator for the decoy shape that every count pin above
    // passes: a discarded `surface.call("encode", …)` for the pins plus a
    // direct `qrWrapper.encode(…)` that supplies the real matrix (measured:
    // 10/10 green, correct output). Mark the door's return for the duration of
    // one call — if the engine consumes the marked value the door is the data
    // path; if it returns the real matrix instead, it went around.
    const original = seam.doorOverride;
    seam.doorOverride = (name, ...args) => {
      void original;
      // The artifact's own export — the same function the real door wraps.
      const options = args[1] as
        | Parameters<typeof realWrapper.encode>[1]
        | undefined;
      const value = realWrapper.encode(args[0] as string, options);
      if (name !== "encode") return value;
      // Same shape, but every module flipped: a caller that consumed this
      // would produce an inverted matrix.
      return {
        size: value.size,
        modules: Array.from({ length: value.modules.length }, (_, i) =>
          !value.modules[i],
        ),
      };
    };
    let inverted: boolean[][];
    try {
      inverted = qrMatrix(PAYLOAD);
    } finally {
      seam.doorOverride = original;
    }
    // The matrix really is the door's marked output, so the door is the data path.
    expect(inverted[0]![0]).toBe(false);
    expect(qrMatrix(PAYLOAD)[0]![0]).not.toBe(inverted[0]![0]);
  });

  it("publishes the empty declaration the sync door requires", () => {
    // Empty is not cosmetic: `createSurface` refuses any non-empty declaration
    // (it cannot provide capabilities for an already-evaluated wrapper), so a
    // glue-bearing declaration here would make the engine unusable.
    expect(QR_CAPABILITIES).toEqual({ interfaces: [], wasiModules: [] });

    // …and the engine must hand that declaration to the door, not merely
    // publish it. Omitting the argument lets `createSurface` default to `{}`,
    // so its refusal never fires and the declared value would never be
    // consulted. Asserted against the FIRST build so a later surface cannot
    // turn this into an `undefined` failure for the wrong reason — the
    // build-count pin is what reports a second door, this one reports the
    // declaration that actually guarded module load.
    // Scope, precisely: this pin catches **the argument being
    // dropped** (verified: it is the only case that fails then). It is not a
    // general "no wrong declaration can ship" guard — it asserts identity with
    // whatever `declare-caps.ts` exports, so changing that file to a non-empty
    // declaration passes here and is refused by the door instead (which is what
    // the next case documents).
    expect(seam.firstHandedCapabilities).toBe(QR_CAPABILITIES);

    // Exported and read by the encoder — the read the package's `sideEffects`
    // whitelist entry keeps alive.
    expect(qrCapabilities).toBe(QR_CAPABILITIES);
  });

  it("refuses a non-empty declaration instead of silently granting it", async () => {
    // Documents the door's contract with the REAL client: a glue- or
    // WASI-bearing declaration is refused. DISCLOSURE: this calls
    // `createSurface` directly, so it passes even if the engine stops handing
    // the declaration over — it is NOT the regression guard for that. The guard
    // is `expect(seam.handedCapabilities).toBe(QR_CAPABILITIES)` above.
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
    expect(() => createSurface(namespace, { interfaces: [], wasiModules: [] })).not.toThrow();
  });
});
