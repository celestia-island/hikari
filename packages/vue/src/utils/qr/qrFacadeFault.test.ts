// Fault-injection pins for the QR facade: a broken wrapper must degrade the
// component, not abort the module graph that hosts it (#1498).
//
// MUT:static-import — before the fix, ``qrEncoder`` used `import * as qrWrapper`
// statically, so a wrapper that threw while being evaluated took the whole page
// down before any `try` in this file could run: the facade module itself could
// not be imported, which in a real app is a blank `#app` and one uncaught error.
//
// MUT:pin-relocated — the `vi.mock` specifier must resolve to the SAME module
// the facade's dynamic `import()` loads. Sitting beside the facade is the easy
// way to get that (the two relative paths coincide); it is convention, not a
// requirement: a pin one directory away with a corrected specifier is still
// applied and still bites. What matters is the module id, not the depth.
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
    // A failed load keeps refusing until something retries it; the facade
    // exposes a lazy `when*Ready` for that (see the `*Retry.test.ts` file), but
    // a plain call never silently returns a value.
    // MUT:entry-guard — deleting the `if (!surface) throw` at the top of this
    // entry point lets a raw `TypeError: Cannot read properties of undefined`
    // escape instead, which no caller recognises by type.
    expect(() => mod.qrMatrix("hello")).toThrow(mod.QrNotReadyError);
  });

  it("rejects the ready promise so a waiting host can surface the failure", async () => {
    // The interface the QR card relies on: `qrReady.then(draw).catch(console.error)`.
    //
    // MUT:ready-both-layers — rejection has two layers: the `throw` in the load's
    // catch, and the `if (!surface) throw` inside this promise. Removing the
    // inner guard alone leaves this case green (measured); removing the
    // re-throw alone also leaves it green; only removing both reds it. So this
    // pins "the ready promise rejects when the load failed", not one line.
    // Note it asserts the `*Ready` snapshot — the lazy `when*Ready` is covered
    // by the retry pins, not here.
    await expect(mod.qrReady).rejects.toBeInstanceOf(mod.QrNotReadyError);
  });

  it("leaves no unhandled rejection when a retry is triggered", async () => {
    // MUT:retry-rejection-owner — the entry point fires a load on its way to
    // throwing, and `whenQrReady()` derives its own promise. Without an owner on
    // those, this file exits 1 with an `Errors` count while every case passes;
    // the hooks below observe the same rejections the runner would.
    const seen: unknown[] = [];
    const onRejection = (reason: unknown) => seen.push(reason);
    process.on("unhandledRejection", onRejection);
    try {
      // Trigger retries: a plain call, and a fresh ready derivation.
      expect(() => mod.qrMatrix("hello")).toThrow(mod.QrNotReadyError);
      await mod.whenQrReady().catch(() => undefined);
      // Let any unowned rejection surface.
      await new Promise((resolve) => setTimeout(resolve, 50));
    } finally {
      process.off("unhandledRejection", onRejection);
    }
    expect(seen).toHaveLength(0);
  });
});
