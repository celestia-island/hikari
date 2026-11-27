/**
 * The overlay scrollbar ENGINE is public API.
 *
 * Why this is a pin and not documentation: every scroll region in the
 * family must render the SAME bar (the shared
 * `.hk-scrollbar-track`/`-thumb` chrome). A host that owns a plain
 * `overflow:auto` box — a search-results list, a side pane, a log view —
 * has exactly three options when the engine is not exported: a native
 * bar (visibly foreign, and the 2026-11-27 docs-search report), a
 * hand-rolled bar (a second scrollbar system), or a VENDORED COPY.
 *
 * The third is the one that actually happened: shittim-chest carries
 * `components/kit/useOverlayScrollbar.ts`, a 332-line fork of this
 * module, which had already drifted from the 694-line upstream. A fork
 * is not a style problem — it is a copy that silently misses every later
 * fix to the real engine, forever.
 *
 * So the export is load-bearing API surface, and this test fails if it
 * is removed. Mutation that must turn it red: delete the
 * `attachOverlayScrollbars` re-export from index.ts.
 */
import { describe, expect, it } from "vitest";

import * as hikari from "./index";
import {
  attachOverlayScrollbars as direct,
} from "./composables/useOverlayScrollbar";

describe("overlay scrollbar export contract", () => {
  it("re-exports the engine from the package barrel", () => {
    const barrel = hikari as Record<string, unknown>;
    expect(barrel.attachOverlayScrollbars).toBeTypeOf("function");
    // The barrel must hand out THE engine, not a wrapper around it: a
    // consumer attaching through it and HkScrollContainer attaching
    // internally have to produce identical chrome.
    expect(barrel.attachOverlayScrollbars).toBe(direct);
  });

  it("attaching against no host degrades to a no-op handle instead of throwing", () => {
    // The documented contract: a detached element (or a null host) must
    // not explode. Consumers call this in mounted hooks where the ref may
    // legitimately still be null on a first pass.
    const handle = hikari.attachOverlayScrollbars(
      { parentElement: null } as unknown as HTMLElement,
      { axis: "vertical" },
    );
    expect(handle).toBeTypeOf("object");
    for (const method of ["update", "setMapSegments", "setMarkers", "detach"] as const) {
      expect(handle[method]).toBeTypeOf("function");
    }
    // Every no-op must be safe to call blindly.
    expect(() => {
      handle.update();
      handle.setMapSegments([]);
      handle.setMarkers([]);
      handle.detach();
    }).not.toThrow();
  });
});
