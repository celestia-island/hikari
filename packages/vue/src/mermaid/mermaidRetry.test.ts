// Retry semantics for the Mermaid facade: a failed load must not degrade the
// component for the whole session. `useHighlight` already clears its cached
// attempt on failure and lets the next call try again; these three facades now
// do the same.
//
// MUT:load-retry — without clearing the cached promise on failure the second
// build never happens and the facade stays unusable until a page reload
// (measured: builds stays at 1 and `qrMatrix` keeps throwing).
//
// (Run from `packages/vue` — that is where vite.config.ts registers the plugins.)
import { describe, expect, it, vi } from "vitest";

let builds = 0;

vi.mock("@celestia-island/tairitsu-host-client", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@celestia-island/tairitsu-host-client")
  >();
  return {
    ...actual,
    // Fail the first build only, standing in for a transient 404 / dropped
    // connection.
    createSurface: (...args: Parameters<typeof actual.createSurface>) => {
      builds += 1;
      if (builds === 1) throw new Error("simulated transient build failure");
      return actual.createSurface(...args);
    },
  };
});

const mod = await import("./wasmEngine");

describe("Mermaid facade retries a failed load", () => {
  it("rejects the first ready attempt", async () => {
    await expect(mod.whenMermaidReady()).rejects.toBeInstanceOf(mod.MermaidNotReadyError);
    expect(builds).toBe(1);
  });

  it("tries again on the next call, and the retry succeeds", async () => {
    // A call while unusable both refuses and starts the next attempt.
    expect(() => mod.wasmMermaidEngine.parse("graph TD\n  A --> B")).toThrow(mod.MermaidNotReadyError);
    await mod.whenMermaidReady();

    // MUT:load-retry — builds stays 1 without the retry, and this stays unready.
    expect(builds).toBe(2);
    expect(mod.wasmMermaidEngine.parse("graph TD\n  A --> B")).not.toBeNull();
  });
});
