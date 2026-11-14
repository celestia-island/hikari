import { describe, expect, it } from "vitest";
import * as barrel from "../index";
import { asIndexable } from "../utils/typing";

/**
 * The public barrel guard (HkAddTile.barrel.test.ts shape): deleting
 * the export lines from index.ts kept the ENTIRE suite green while the
 * component's own tests reach the module through "./HkNotificationBell"
 * — only an external consumer would have noticed.
 */
describe("the public barrel", () => {
  it("exports the bell under both family names", () => {
    const hk = asIndexable(barrel.HkNotificationBell);
    expect(hk, "HkNotificationBell must be re-exported").toBeTruthy();
    expect(hk.name).toBe("HkNotificationBell");
    // The H- alias rides the HCard/HkCard family convention: consumers
    // import either name, one component underneath.
    expect(barrel.HNotificationBell).toBe(barrel.HkNotificationBell);
  });

  it("exports the journal context surface", () => {
    expect(typeof (barrel as Record<string, unknown>).useNotificationCenter).toBe("function");
    expect(typeof (barrel as Record<string, unknown>).recordNotification).toBe("function");
    expect(typeof (barrel as Record<string, unknown>).markAllNotificationsRead).toBe("function");
    expect((barrel as Record<string, unknown>).MAX_NOTIFICATION_ENTRIES).toBe(100);
  });
});
