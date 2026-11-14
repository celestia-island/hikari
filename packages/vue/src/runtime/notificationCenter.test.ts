import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MAX_NOTIFICATION_ENTRIES,
  forgetNotification,
  markAllNotificationsRead,
  recordNotification,
  resetNotifications,
  setNotificationState,
  useNotificationCenter,
} from "./notificationCenter";
import { readHkRuntime } from "./registry";

/**
 * useNotificationCenter contract tests (the journal's own semantics,
 * independent of its sources):
 * - record creates an unread "active" entry; re-recording an id updates
 *   in place WITHOUT resetting raisedAt or the read flag (a poller
 *   re-recording must not unread the list)
 * - setState transitions; "cleared" drops a live resummon path
 * - markAllRead is the open-the-panel receipt; a NEW entry is unread
 *   again afterwards
 * - the 100-entry ring drops the oldest by updatedAt
 * - sessionStorage persistence: survives a fresh module instance
 *   (onResummon deliberately does not — callbacks cannot cross reload)
 * - runtime-registry introspection (readHkRuntime("notificationCenter"))
 */

afterEach(() => {
  resetNotifications();
  vi.restoreAllMocks();
});

describe("record / update", () => {
  it("records an unread active entry", () => {
    const { entries } = useNotificationCenter();
    recordNotification({ id: "toast:1:1", kind: "toast", tone: "error", title: "boom" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: "toast:1:1",
      kind: "toast",
      tone: "error",
      title: "boom",
      state: "active",
      read: false,
    });
  });

  it("re-recording an id updates in place and keeps raisedAt/read", () => {
    const { entries } = useNotificationCenter();
    recordNotification({ id: "emergency:quota", kind: "emergency", tone: "warning", title: "v1" });
    const first = entries[0];
    markAllNotificationsRead();
    recordNotification({ id: "emergency:quota", kind: "emergency", tone: "warning", title: "v2" });
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("v2");
    expect(entries[0].raisedAt).toBe(first.raisedAt);
    expect(entries[0].read).toBe(true);
  });

  it("an explicit state override rides a re-record", () => {
    const { entries } = useNotificationCenter();
    recordNotification({ id: "e", kind: "emergency", tone: "error", title: "t", state: "snoozed" });
    expect(entries[0].state).toBe("snoozed");
  });

  it("a create-time read:true makes the entry born-read (blocking semantics)", () => {
    const { entries } = useNotificationCenter();
    recordNotification({
      id: "blocking:x",
      kind: "blocking",
      tone: "warning",
      title: "answered gate",
      state: "dismissed",
      read: true,
    });
    expect(entries[0].read).toBe(true);
  });

  it("callbacks are owned by the LATEST record call — an input without one clears", () => {
    const { entries } = useNotificationCenter();
    recordNotification({
      id: "emergency:q",
      kind: "emergency",
      tone: "warning",
      title: "t",
      state: "snoozed",
      onResummon: () => {},
    });
    expect(entries[0].onResummon).toBeTypeOf("function");
    // A later re-record with no callback (an active re-raise) must not
    // keep a restore button that unsnoozes nothing (R2 finding).
    recordNotification({ id: "emergency:q", kind: "emergency", tone: "warning", title: "t" });
    expect(entries[0].onResummon).toBeUndefined();
  });

  it("a CLEARED episode re-raising as active wakes up UNREAD (fresh episode)", () => {
    const { entries } = useNotificationCenter();
    recordNotification({ id: "emergency:q", kind: "emergency", tone: "warning", title: "seen" });
    markAllNotificationsRead();
    setNotificationState("emergency:q", "cleared");
    expect(entries[0].read).toBe(true);
    // The condition recurs: new information, the dot must light again.
    recordNotification({
      id: "emergency:q",
      kind: "emergency",
      tone: "warning",
      title: "seen",
      state: "active",
    });
    expect(entries[0].read).toBe(false);
    // Unsnooze (setNotificationState active from snoozed) does NOT unread.
    recordNotification({ id: "emergency:u", kind: "emergency", tone: "warning", title: "u", state: "snoozed", read: true });
    setNotificationState("emergency:u", "active");
    expect(entries.find((e) => e.id === "emergency:u")?.read).toBe(true);
  });
});

describe("setState / forget / read", () => {
  it("setState transitions and 'cleared' drops the resummon path", () => {
    const { entries } = useNotificationCenter();
    const resummon = () => {};
    recordNotification({
      id: "emergency:q",
      kind: "emergency",
      tone: "warning",
      title: "t",
      state: "snoozed",
      onResummon: resummon,
    });
    expect(entries[0].onResummon).toBe(resummon);
    setNotificationState("emergency:q", "active");
    expect(entries[0].state).toBe("active");
    setNotificationState("emergency:q", "cleared");
    expect(entries[0].state).toBe("cleared");
    expect(entries[0].onResummon).toBeUndefined();
  });

  it("setState on an unknown id is a no-op", () => {
    expect(() => setNotificationState("ghost", "dismissed")).not.toThrow();
  });

  it("forget removes one entry", () => {
    const { entries } = useNotificationCenter();
    recordNotification({ id: "a", kind: "toast", tone: "info", title: "a" });
    recordNotification({ id: "b", kind: "toast", tone: "info", title: "b" });
    forgetNotification("a");
    expect(entries.map((e) => e.id)).toEqual(["b"]);
  });

  it("open = read receipt, but a NEW entry is unread again", () => {
    const { entries } = useNotificationCenter();
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "a" });
    markAllNotificationsRead();
    expect(entries.every((e) => e.read)).toBe(true);
    recordNotification({ id: "b", kind: "toast", tone: "warning", title: "b" });
    expect(entries.find((e) => e.id === "b")?.read).toBe(false);
  });
});

describe("ring buffer", () => {
  it("caps at 100 entries, dropping the oldest by updatedAt", () => {
    const { entries } = useNotificationCenter();
    for (let i = 0; i < MAX_NOTIFICATION_ENTRIES + 5; i++) {
      recordNotification({ id: `t${i}`, kind: "toast", tone: "info", title: String(i) });
    }
    expect(entries).toHaveLength(MAX_NOTIFICATION_ENTRIES);
    // Deterministic recency: age a MIDDLE entry (R4 note — aging index
    // 0 cannot distinguish "drop min(updatedAt)" from "drop index 0"),
    // refresh the last, and require exactly the aged one to go.
    entries[50].updatedAt = 1;
    entries[entries.length - 1].updatedAt = Date.now() + 10_000;
    recordNotification({ id: "fresh", kind: "toast", tone: "info", title: "fresh" });
    expect(entries).toHaveLength(MAX_NOTIFICATION_ENTRIES);
    expect(entries.some((e) => e.id === "fresh")).toBe(true);
    expect(entries.some((e) => e.id === "t55")).toBe(false);
    expect(entries.some((e) => e.id === "t5")).toBe(true);
  });
});

describe("sessionStorage persistence", () => {
  it("writes through and restores in a fresh module instance", async () => {
    const resummon = () => {};
    recordNotification({
      id: "emergency:quota",
      kind: "emergency",
      tone: "warning",
      title: "额度耗尽",
      state: "snoozed",
      onResummon: resummon,
    });
    expect(sessionStorage.getItem("hk-notification-journal")).toContain("额度耗尽");

    vi.resetModules();
    const fresh = await import("./notificationCenter");
    const { entries } = fresh.useNotificationCenter();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: "emergency:quota", state: "snoozed", read: false });
    // The resummon callback is in-memory only by design.
    expect(entries[0].onResummon).toBeUndefined();
    fresh.resetNotifications();
  });

  it("a corrupt record does not take the journal down", async () => {
    sessionStorage.setItem("hk-notification-journal", "{not json");
    vi.resetModules();
    const fresh = await import("./notificationCenter");
    const { entries } = fresh.useNotificationCenter();
    expect(entries).toHaveLength(0);
    expect(() =>
      fresh.recordNotification({ id: "x", kind: "toast", tone: "info", title: "x" }),
    ).not.toThrow();
    fresh.resetNotifications();
  });
});

describe("runtime introspection", () => {
  it("reports entries/unread/byKind via readHkRuntime", () => {
    useNotificationCenter();
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "a" });
    recordNotification({ id: "b", kind: "emergency", tone: "warning", title: "b" });
    markAllNotificationsRead();
    recordNotification({ id: "c", kind: "toast", tone: "warning", title: "c" });
    const report = readHkRuntime("notificationCenter") as Record<string, unknown>;
    expect(report.entries).toBe(3);
    expect(report.unread).toBe(1);
    expect(report.byKind).toMatchObject({ toast: 2, emergency: 1 });
  });
});
