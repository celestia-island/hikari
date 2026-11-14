import { afterEach, describe, expect, it } from "vitest";

import { resetNotifications, useNotificationCenter } from "./notificationCenter";
import {
  clearEmergencyAlert,
  raiseEmergencyAlert,
  resetEmergencyAlerts,
  snoozeEmergencyAlert,
  unsnoozeEmergencyAlert,
  useEmergencyAlert,
} from "./useEmergencyAlert";import { clearBlockingToasts, showBlockingToast } from "./useBlockingToast";

/**
 * Emergency/blocking → journal integration (user ruling 2026-11-15):
 * - an emergency episode mirrors into ONE journal entry (raise → active,
 *   snooze → snoozed, unsnooze → active, clear → cleared and KEPT)
 * - the snoozed entry carries the real resummon path: calling it lands
 *   in unsnoozeEmergencyAlert (band returns), like the tray's button
 * - a re-raise after clear starts a fresh episode on the same entry
 * - a settled blocking gate journals as "dismissed" (default, no opt-in)
 */

afterEach(() => {
  resetEmergencyAlerts();
  resetNotifications();
});

describe("emergency episode mirror", () => {
  it("raise journals an active entry; danger reads as the error tone", () => {
    raiseEmergencyAlert({
      id: "quota",
      severity: "warning",
      title: "可用额度已用完",
      description: "充值后立即可用",
      code: "QUOTA_EXHAUSTED",
    });
    raiseEmergencyAlert({ id: "link", severity: "danger", title: "所有平台连接断开" });
    const { entries } = useNotificationCenter();
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.id === "emergency:quota")).toMatchObject({
      kind: "emergency",
      tone: "warning",
      title: "可用额度已用完",
      detail: "充值后立即可用",
      code: "QUOTA_EXHAUSTED",
      state: "active",
    });
    expect(entries.find((e) => e.id === "emergency:link")?.tone).toBe("error");
  });

  it("an ACTIVE episode carries NO resummon — the band is already on screen", () => {
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "额度" });
    const { entries } = useNotificationCenter();
    const entry = entries.find((e) => e.id === "emergency:quota");
    expect(entry?.state).toBe("active");
    // R2 finding (PR #1322): a restore button on an on-screen band is
    // a dead control — unsnooze would early-return.
    expect(entry?.onResummon).toBeUndefined();
  });

  it("snooze → snoozed; the entry's resummon lands in unsnooze", () => {
    const { alerts } = useEmergencyAlert();
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "额度" });
    snoozeEmergencyAlert("quota");
    const { entries } = useNotificationCenter();
    const entry = entries.find((e) => e.id === "emergency:quota");
    expect(entry?.state).toBe("snoozed");
    expect(alerts[0].snoozed).toBe(true);

    entry?.onResummon?.();
    expect(alerts[0].snoozed).toBe(false);
    expect(entries.find((e) => e.id === "emergency:quota")?.state).toBe("active");
  });

  it("clear ends the episode but KEEPS the record as cleared", () => {
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "额度" });
    clearEmergencyAlert("quota");
    const { alerts } = useEmergencyAlert();
    const { entries } = useNotificationCenter();
    expect(alerts).toHaveLength(0);
    const entry = entries.find((e) => e.id === "emergency:quota");
    expect(entry?.state).toBe("cleared");
    expect(entry?.onResummon).toBeUndefined();
  });

  it("resetEmergencyAlerts marks removed episodes' journal entries cleared", () => {
    // R4 note (PR #1322): the teardown helper must not leave a snoozed
    // journal entry armed with a resummon no alert can answer.
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "额度" });
    snoozeEmergencyAlert("quota");
    resetEmergencyAlerts();
    const { alerts } = useEmergencyAlert();
    const { entries } = useNotificationCenter();
    expect(alerts).toHaveLength(0);
    const entry = entries.find((e) => e.id === "emergency:quota");
    expect(entry?.state).toBe("cleared");
    expect(entry?.onResummon).toBeUndefined();
  });

  it("a re-raise after clear starts a fresh episode on the same entry", () => {
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "v1" });
    clearEmergencyAlert("quota");
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "v2" });
    const { entries } = useNotificationCenter();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ title: "v2", state: "active" });
  });

  it("a re-raise of a SNOOZED episode keeps it snoozed", () => {
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "v1" });
    snoozeEmergencyAlert("quota");
    // A poller re-raises every cycle — it must not unsnooze the record.
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "v1" });
    const { entries } = useNotificationCenter();
    expect(entries[0].state).toBe("snoozed");
  });
});

describe("blocking gate journal", () => {
  it("a settled gate journals as dismissed and born-READ (the user answered it)", async () => {
    const promise = showBlockingToast("加入群组？", { title: "确认", variant: "warning" });
    clearBlockingToasts();
    await promise;
    const { entries } = useNotificationCenter();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "blocking",
      tone: "warning",
      title: "确认",
      detail: "加入群组？",
      state: "dismissed",
      read: true,
    });
  });

  it("danger gates read as the error tone; plain gates use their message as title", async () => {
    const promise = showBlockingToast("确定要重置吗？", { variant: "danger" });
    clearBlockingToasts();
    await promise;
    const { entries } = useNotificationCenter();
    expect(entries[0]).toMatchObject({ tone: "error", title: "确定要重置吗？" });
  });
});
