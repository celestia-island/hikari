import { describe, expect, it } from "vitest";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * The public barrel guard for the edge-glow painter (same shape as
 * HkCalendarHeatmap.barrel.test.ts): deleting the export lines from
 * index.ts kept the ENTIRE suite green while the component's own tests
 * reach the module through "./HkEdgeGlow" — only an external consumer
 * would have noticed. HkScrollContainer imports the module directly too,
 * so this file is the only thing pinning the public names.
 *
 * This file deliberately does NOT mock "@celestia-island/hikari": the
 * package's self-reference resolves to the very same src/index.ts module
 * as "../index", so a vi.mock here would replace the barrel under test
 * with the mock's own namespace.
 */
describe("the public barrel", () => {
  it("exports the edge-glow painter under both family names", () => {
    const hk = asIndexable(barrel.HkEdgeGlow);
    expect(hk, "HkEdgeGlow must be re-exported").toBeTruthy();
    expect(hk.name).toBe("HkEdgeGlow");
    // The H- alias rides the HCard/HkCard family convention: consumers
    // import either name, one component underneath.
    expect(barrel.HEdgeGlow).toBe(barrel.HkEdgeGlow);
  });
});
