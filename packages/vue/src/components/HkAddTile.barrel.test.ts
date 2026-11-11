import { describe, expect, it } from "vitest";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * The public barrel guard for the dashed add/empty affordance tile
 * (HkEdgeGlow.barrel.test.ts shape): deleting the export lines from
 * index.ts kept the ENTIRE suite green while the component's own tests
 * reach the module through "./HkAddTile" — only an external consumer
 * would have noticed. Recorded as a residual in #1222's R4/R5; this
 * file closes it.
 *
 * This file deliberately does NOT mock "@celestia-island/hikari": the
 * package's self-reference resolves to the very same src/index.ts module
 * as "../index", so a vi.mock here would replace the barrel under test
 * with the mock's own namespace.
 */
describe("the public barrel", () => {
  it("exports the add tile under both family names", () => {
    const hk = asIndexable(barrel.HkAddTile);
    expect(hk, "HkAddTile must be re-exported").toBeTruthy();
    expect(hk.name).toBe("HkAddTile");
    // The H- alias rides the HCard/HkCard family convention: consumers
    // import either name, one component underneath.
    expect(barrel.HAddTile).toBe(barrel.HkAddTile);
  });
});
