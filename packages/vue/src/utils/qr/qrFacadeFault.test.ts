// Fault-injection pins for the QR facade: a broken wrapper must degrade the
// component, not abort the module graph that hosts it (#1498).
//
// Why this file exists: `qrEncoder` used to `import * as qrWrapper` statically,
// so a wrapper that threw while being evaluated took the whole page down before
// any `try` in this file could run — measured with the stub below: the facade
// module itself could not be imported, which in a real app is a blank `#app`
// and one uncaught error.
//
// The `vi.mock` specifier must resolve to the SAME module the facade's dynamic
// `import()` loads. Sitting beside the facade is the easy way to get that (the
// two relative paths coincide); it is convention, not a requirement — measured,
// a pin one directory away with a corrected specifier is still applied and
// still bites. What matters is the resolved module id, not the depth.
//
// MUT:* anchors each behavioural claim to the mutation that shows it; do not
// restate a claim here without re-running its probe.
import { describe, expect, it, vi } from "vitest";

// The specifier the facade itself uses. A factory that throws stands in for a
// wrapper that fails to load (404, syntax error, transient network) — the exact
// shape #1498 was filed for.
vi.mock("../../wasm/qr/hikari_wasm_qr.js", () => {
  throw new SyntaxError("simulated wrapper evaluation failure");
});

const mod = await import("./qrEncoder");

describe("QR facade survives a broken wrapper", () => {
  it("stays importable when the wrapper cannot be evaluated", () => {
    // MUT:static-import — restoring the static `import * as qrWrapper` makes this
    // module fail to load at all (in a browser: an uncaught error and a blank
    // page), so this case is the regression pin for #1498.
    expect(typeof mod.qrMatrix).toBe("function");
    expect(mod.QrNotReadyError).toBeTypeOf("function");
  });

  it("throws a recognisable not-ready error instead of returning silence", () => {
    // MUT:silent-empty — returning `[]` here would be the "blank canvas"
    // degradation the issue calls out; the contract is a throw callers can
    // catch by type.
    expect(() => mod.qrMatrix("hello")).toThrow(mod.QrNotReadyError);
  });

  it("keeps throwing on later calls rather than going quiet", () => {
    // The load attempt is cached and never reset on failure, so a failed load
    // stays failed for the session (measured: one import attempt, no retry).
    // MUT:entry-guard — deleting the `if (!surface) throw` at the top of this
    // entry point lets a raw `TypeError: Cannot read properties of undefined`
    // escape instead, which no caller recognises by type.
    expect(() => mod.qrMatrix("hello")).toThrow(mod.QrNotReadyError);
  });

  it("rejects the ready promise so a waiting host can surface the failure", async () => {
    // The interface the QR card relies on: `qrReady.then(draw).catch(console.error)`.
    //
    // Scope, precisely (measured): rejection has TWO layers — the `throw` in the
    // load's catch, and the `if (!surface) throw` inside this promise. Removing
    // either one alone leaves this case green; removing BOTH reds it. So this
    // pins "the ready promise rejects when the load failed", not a single line.
    await expect(mod.qrReady).rejects.toBeInstanceOf(mod.QrNotReadyError);
  });
});
