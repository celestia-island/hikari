// Fault-injection pins for the Mermaid facade: a broken wrapper must degrade the
// component, not abort the module graph that hosts it (#1498).
//
// Why this file exists: `wasmEngine` used to `import * as mermaidWrapper` statically,
// so a wrapper that threw while being evaluated took the whole page down before
// any `try` in this file could run — measured with the stub below: the facade
// module itself could not be imported, which in a real app is a blank `#app`
// and one uncaught error.
//
// This file MUST stay in the facade's own directory: `vi.mock` resolves its
// specifier against the test file, and the facade's dynamic `import()` uses its
// own relative one — from a different depth the two never refer to the same
// module and the stub is silently ignored (measured).
//
// MUT:* anchors each behavioural claim to the mutation that shows it; do not
// restate a claim here without re-running its probe.
import { describe, expect, it, vi } from "vitest";

// The specifier the facade itself uses. A factory that throws stands in for a
// wrapper that fails to load (404, syntax error, transient network) — the exact
// shape #1498 was filed for.
vi.mock("../wasm/mermaid/hikari_wasm_mermaid.js", () => {
  throw new SyntaxError("simulated wrapper evaluation failure");
});

const mod = await import("./wasmEngine");

describe("Mermaid facade survives a broken wrapper", () => {
  it("stays importable when the wrapper cannot be evaluated", () => {
    // MUT:static-import — restoring the static `import * as mermaidWrapper` makes this
    // module fail to load at all (in a browser: an uncaught error and a blank
    // page), so this case is the regression pin for #1498.
    expect(typeof mod.wasmMermaidEngine.parse).toBe("function");
    expect(mod.MermaidNotReadyError).toBeTypeOf("function");
  });

  it("throws a recognisable not-ready error instead of returning silence", () => {
    // MUT:silent-empty — returning `null` here would be the "blank canvas"
    // degradation the issue calls out; the contract is a throw callers can
    // catch by type.
    expect(() => mod.wasmMermaidEngine.parse("graph TD\n  A --> B")).toThrow(mod.MermaidNotReadyError);
  });

  it("keeps throwing on later calls rather than going quiet", () => {
    // MUT:ready-resolves-on-failure — when the failure path resolved instead of
    // rejecting, the host saw a settled ready promise, stopped retrying, and
    // later calls returned nothing (measured). A failed load must stay failed.
    expect(() => mod.wasmMermaidEngine.parse("graph TD\n  A --> B")).toThrow(mod.MermaidNotReadyError);
  });

  it("rejects the ready promise so a waiting host can surface the failure", async () => {
    // The interface `HkMermaidDiagram` relies on: the epoch bump once the engine lands.
    // MUT:ready-resolves-on-failure — a resolving promise here makes the host's
    // `.catch` unreachable and the failure unlogged.
    await expect(mod.mermaidReady).rejects.toBeInstanceOf(mod.MermaidNotReadyError);
  });
});
