// Stage-3 wiring pins for the Mermaid engine: the engine must reach the
// component **through the tairitsu host client's call surface**, not by calling
// the generated wrapper directly.
//
// Why a separate file: the frozen golden (`__golden.test.ts`) and
// `wasmEngine.test.ts` pin the *output* of parse, and a direct call to the
// wrapper produces identical output — both stayed green (16/16) when the host
// was bypassed for a mutation. These pins observe the seam itself.
//
// How: `createSurface` is wrapped so the test keeps a handle on the REAL
// surface, then the surface's `call` is wrapped again. The host client builds
// `call` as own data on the surface object (not a frozen method), so wrapping it
// is enough to see every call the engine makes; the engine's code is untouched
// and the real artifact still runs.
//
// (Run from `packages/vue` — that is where vite.config.ts registers the plugins.)
import { describe, expect, it, vi } from "vitest";

interface Seam {
  /** Argument list of every `surface.call(name, …)`. */
  calls: Array<{ name: string; args: unknown[] }>;
  /** The namespace handed to `createSurface`. */
  handed: Record<string, unknown> | undefined;
  /** The declaration handed to `createSurface` (not just published). */
  handedCapabilities: unknown;
}

const seam: Seam = {
  calls: [],
  handed: undefined,
  handedCapabilities: undefined,
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
        return realCall(name, ...args);
      }) as typeof live.call;
      return live;
    },
  };
});

const { wasmMermaidEngine, mermaidCapabilities } = await import("./wasmEngine");
const { MERMAID_CAPABILITIES } = await import("./declare-caps");

describe("Mermaid engine goes through the host client", () => {
  it("hands the wrapper namespace to createSurface", () => {
    expect(seam.handed).toBeDefined();
    // The very artifact module — it carries the component's own export.
    expect(typeof seam.handed!.parse).toBe("function");
    expect(typeof seam.handed!._util).toBe("object");
  });

  it("calls parse through the surface, not the wrapper", () => {
    seam.calls.length = 0;
    const doc = wasmMermaidEngine.parse("graph TD\n  A --> B");
    expect(doc).not.toBeNull();

    const parseCalls = seam.calls.filter((c) => c.name === "parse");
    // A direct `mermaidWrapper.parse(...)` bypasses the surface entirely and
    // leaves this empty — that is the mutation these pins catch.
    expect(parseCalls).toHaveLength(1);
    // The source reaches the component through the surface, unchanged.
    expect(parseCalls[0]!.args[0]).toBe("graph TD\n  A --> B");
  });

  it("sends the state-diagram normalization through the surface too", () => {
    seam.calls.length = 0;
    const doc = wasmMermaidEngine.parse("stateDiagram-v2\n  [*] --> Idle");
    expect(doc).not.toBeNull();
    const parseCalls = seam.calls.filter((c) => c.name === "parse");
    expect(parseCalls).toHaveLength(1);
    // The rewrite happens before the call, so the component sees a graph.
    expect(String(parseCalls[0]!.args[0])).toMatch(/^graph TD/);
  });

  it("does not reach the component at all for a non-diagram source", () => {
    // The dispatch guard answers before the component is consulted — no
    // surface call at all (the behavior before the migration).
    seam.calls.length = 0;
    expect(wasmMermaidEngine.parse("this is not a diagram")).toBeNull();
    expect(seam.calls).toHaveLength(0);
  });

  it("publishes the empty declaration the sync door requires", () => {
    // Empty is not cosmetic: `createSurface` refuses any non-empty declaration
    // (it cannot provide capabilities for an already-evaluated wrapper), so a
    // glue-bearing declaration here would make the engine unusable.
    expect(MERMAID_CAPABILITIES).toEqual({ interfaces: [], wasiModules: [] });

    // …and the engine must hand that declaration to the door, not merely
    // publish it. Omitting the argument lets `createSurface` default to `{}`,
    // so its refusal never fires and a wrong declaration would pass silently —
    // the pin below is what makes a non-empty declaration fail loudly.
    expect(seam.handedCapabilities).toBe(MERMAID_CAPABILITIES);
    // Exported and read by the engine — the read the package's `sideEffects`
    // whitelist entry keeps alive.
    expect(mermaidCapabilities).toBe(MERMAID_CAPABILITIES);
  });

  it("refuses a non-empty declaration instead of silently granting it", async () => {
    // Documents the door's contract with the REAL client: a glue- or
    // WASI-bearing declaration is refused. DISCLOSURE: this calls
    // `createSurface` directly, so it passes even if the engine stops handing
    // the declaration over — it is NOT the regression guard for that. The guard
    // is `expect(seam.handedCapabilities).toBe(MERMAID_CAPABILITIES)` above
    // (verified: dropping the argument leaves this case green and only that one
    // red). Both are kept: one states the contract, the other pins the wiring.
    const { createSurface, HostClientError } = await vi.importActual<
      typeof import("@celestia-island/tairitsu-host-client")
    >("@celestia-island/tairitsu-host-client");
    const namespace = seam.handed!;
    expect(() =>
      createSurface(namespace, { interfaces: ["document"], wasiModules: [] }),
    ).toThrow(HostClientError);
    // Same for a WASI declaration.
    expect(() =>
      createSurface(namespace, { interfaces: [], wasiModules: ["random"] }),
    ).toThrow(HostClientError);
    // The empty declaration is the one the door accepts.
    expect(() => createSurface(namespace, { interfaces: [], wasiModules: [] })).not.toThrow();
  });
});