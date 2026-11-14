import { describe, expect, it } from "vitest";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * The public barrel guard (HkAddTile.barrel.test.ts shape): the
 * component's own tests reach it through "./HkAdaptiveTabs" — only an
 * external consumer would notice a dropped export line.
 */
describe("the public barrel", () => {
  it("exports the adaptive tabs under both family names", () => {
    const hk = asIndexable(barrel.HkAdaptiveTabs);
    expect(hk, "HkAdaptiveTabs must be re-exported").toBeTruthy();
    expect(hk.name).toBe("HkAdaptiveTabs");
    expect(barrel.HAdaptiveTabs).toBe(barrel.HkAdaptiveTabs);
  });
});
