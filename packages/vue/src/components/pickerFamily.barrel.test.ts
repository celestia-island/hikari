import { describe, expect, it } from "vitest";

import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * Public barrel guard for the peak-rule picker family. Each component's
 * own test reaches it through `./Hk…`, so a missing index.ts export would
 * leave the whole suite green while every external consumer (chest's
 * ModelPricingView is the first one) fails at import time. Same shape as
 * HkAddTile.barrel.test.ts.
 *
 * No vi.mock of "@celestia-island/hikari" here: the package self-reference
 * resolves to this same src/index.ts module, so a mock would replace the
 * barrel under test with the mock's own namespace.
 */
describe("the picker family in the public barrel", () => {
  it("exports HkTimePicker with a component name", () => {
    const hk = asIndexable(barrel.HkTimePicker);
    expect(hk, "HkTimePicker must be re-exported").toBeTruthy();
    expect(hk.name).toBe("HkTimePicker");
  });

  it("exports HkWeekdayPicker with a component name", () => {
    const hk = asIndexable(barrel.HkWeekdayPicker);
    expect(hk, "HkWeekdayPicker must be re-exported").toBeTruthy();
    expect(hk.name).toBe("HkWeekdayPicker");
  });

  it("exports HkTimeZonePicker with a component name", () => {
    const hk = asIndexable(barrel.HkTimeZonePicker);
    expect(hk, "HkTimeZonePicker must be re-exported").toBeTruthy();
    expect(hk.name).toBe("HkTimeZonePicker");
  });
});
