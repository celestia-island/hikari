import { describe, expect, it } from "vitest";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * The public barrel guard (HkAdaptiveTabs.barrel.test.ts shape): the
 * component's own tests reach it through "./HkRemoteInputDock" — only
 * an external consumer would notice a dropped export line.
 */
describe("the public barrel", () => {
  it("exports the remote-input components under both family names", () => {
    const dock = asIndexable(barrel.HkRemoteInputDock);
    expect(dock, "HkRemoteInputDock must be re-exported").toBeTruthy();
    expect(dock.name).toBe("HkRemoteInputDock");
    expect(barrel.HRemoteInputDock).toBe(barrel.HkRemoteInputDock);

    const cursor = asIndexable(barrel.HkVirtualCursor);
    expect(cursor, "HkVirtualCursor must be re-exported").toBeTruthy();
    expect(cursor.name).toBe("HkVirtualCursor");
    expect(barrel.HVirtualCursor).toBe(barrel.HkVirtualCursor);
  });

  it("exports the composables and the mask vocabulary", () => {
    expect(typeof barrel.useVirtualPointer).toBe("function");
    expect(typeof barrel.useRemoteTouchGestures).toBe("function");
    expect(typeof barrel.useOrientationLock).toBe("function");
    expect([barrel.MASK_LEFT, barrel.MASK_MIDDLE, barrel.MASK_RIGHT]).toEqual([1, 2, 4]);
  });
});
