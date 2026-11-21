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
}

const seam: Seam = { calls: [], handed: undefined };

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
      // `rest` is passed through untouched; the engine calls the one-argument
      // form, so the remaining parameters are never supplied here.
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
    // Exported and read by the engine — the read the package's `sideEffects`
    // whitelist entry keeps alive.
    expect(mermaidCapabilities).toBe(MERMAID_CAPABILITIES);
  });
});