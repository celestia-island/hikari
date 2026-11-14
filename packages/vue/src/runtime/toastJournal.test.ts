import { afterEach, describe, expect, it, vi } from "vitest";

import { resetNotifications, useNotificationCenter } from "./notificationCenter";
import { useToast, MAX_TOASTS_PER_SLOT } from "./useToast";

/**
 * Toast → journal integration (user ruling 2026-11-15):
 * - error/warning slots journal by DEFAULT, state "active" while shown
 * - success/info/loading stay out unless a push opts in (`journal: true`)
 * - the opt-in is monotonic per slot (later push upgrades, never down)
 * - slot removal (manual remove / auto-dismiss) records "dismissed"
 * - per-slot cap eviction records the evicted message "dismissed" too
 *
 * Dismissal is driven through toast.remove(...) — deterministic; the
 * auto-dismiss timer path shares removeSlot with it.
 */

afterEach(() => {
  resetNotifications();
});

describe("default journaling", () => {
  it("an error toast journals and removal records the dismissal", () => {
    const toast = useToast();
    const { entries } = useNotificationCenter();
    const msgId = toast.error("额度已用完");
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "toast",
      tone: "error",
      title: "额度已用完",
      state: "active",
    });

    toast.remove(msgId);
    expect(entries).toHaveLength(1);
    expect(entries[0].state).toBe("dismissed");
  });

  it("a success toast does NOT journal by default", () => {
    const toast = useToast();
    const { entries } = useNotificationCenter();
    toast.success("已保存");
    expect(entries).toHaveLength(0);
  });

  it("warning journals, loading does not", () => {
    const toast = useToast();
    const { entries } = useNotificationCenter();
    toast.warning("磁盘快满");
    toast.loading("加载中");
    expect(entries).toHaveLength(1);
    expect(entries[0].tone).toBe("warning");
  });
});

describe("opt-in", () => {
  it("a success slot journals only when opted in", () => {
    const toast = useToast();
    const { entries } = useNotificationCenter();
    toast.show("已保存", { type: "success", journal: true });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ tone: "success", state: "active" });
  });

  it("the opt-in is monotonic and only covers pushes from then on", () => {
    const toast = useToast();
    const { entries } = useNotificationCenter();
    toast.info("first (not journaled)");
    toast.show("second", { type: "info", journal: true });
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("second");
    // The slot is now upgraded: a plain third push journals too.
    toast.info("third");
    expect(entries).toHaveLength(2);
  });
});

describe("dismissal bookkeeping", () => {
  it("every message of a removed slot lands as dismissed", () => {
    const toast = useToast();
    const { entries } = useNotificationCenter();
    const a = toast.error("one");
    toast.error("two");
    toast.remove(a); // remove-by-message removes the whole slot
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.state === "dismissed")).toBe(true);
  });

  it("cap eviction records the evicted message as dismissed", () => {
    const toast = useToast();
    const { entries } = useNotificationCenter();
    for (let i = 0; i <= MAX_TOASTS_PER_SLOT; i++) {
      toast.error(`m${i}`, false);
    }
    // Six pushes into a five-message slot: the oldest was evicted.
    expect(entries).toHaveLength(MAX_TOASTS_PER_SLOT + 1);
    const evicted = entries.find((e) => e.title === "m0");
    expect(evicted?.state).toBe("dismissed");
    expect(entries.filter((e) => e.state === "active")).toHaveLength(MAX_TOASTS_PER_SLOT);
  });

  it("a deduped identical push updates the record instead of stacking", () => {
    const toast = useToast();
    const { entries } = useNotificationCenter();
    toast.error("same");
    toast.error("same");
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe("same");
  });

  it("a reload's first toast does not collide with the previous session's record", async () => {
    // R2 finding (PR #1322): the journal persists across reloads while
    // the toast counters restart at zero. Pre-persist a record shaped
    // exactly like what a PRE-epoch module would have written for the
    // first error toast (`toast:1:1`) — the fresh module must join it
    // as a NEW entry, not overwrite it in place (which would keep the
    // old raisedAt/read and never light the dot).
    sessionStorage.setItem(
      "hk-notification-journal",
      JSON.stringify([
        {
          id: "toast:1:1",
          kind: "toast",
          tone: "error",
          title: "old session",
          raisedAt: 1,
          updatedAt: 1,
          state: "dismissed",
          read: true,
        },
      ]),
    );
    vi.resetModules();
    const freshToast = (await import("./useToast")).useToast();
    const freshJournal = await import("./notificationCenter");
    freshToast.error("new session");
    const { entries } = freshJournal.useNotificationCenter();
    expect(entries).toHaveLength(2);
    const freshEntry = entries.find((e) => e.title === "new session");
    expect(freshEntry).toMatchObject({ state: "active", read: false });
    expect(entries.find((e) => e.title === "old session")?.title).toBe("old session");
    freshJournal.resetNotifications();
  });
});
