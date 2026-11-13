import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearEmergencyAlert,
  emergencySeverityRank,
  raiseEmergencyAlert,
  resetEmergencyAlerts,
  snoozeEmergencyAlert,
  useEmergencyAlert,
} from "./useEmergencyAlert";
import { listHkRuntime, readHkRuntime } from "./registry";

/**
 * useEmergencyAlert contract tests:
 * - raise registers an alert; clear removes it and ends the episode
 * - re-raising an active id updates in place WITHOUT resetting a
 *   snooze (pollers may re-raise every cycle)
 * - snooze hides until the episode clears: sessionStorage records it,
 *   a cleared id alerts again on its next occurrence
 * - resetEmergencyAlerts is the teardown helper (state + storage)
 */

afterEach(() => {
  resetEmergencyAlerts();
  vi.restoreAllMocks();
});

describe("raise / clear", () => {
  it("raises an alert and clear removes it", () => {
    const { alerts } = useEmergencyAlert();
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "额度耗尽" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: "quota", severity: "warning", title: "额度耗尽" });

    clearEmergencyAlert("quota");
    expect(alerts).toHaveLength(0);
  });

  it("clearing an unknown id is a no-op", () => {
    expect(() => clearEmergencyAlert("never-raised")).not.toThrow();
  });

  it("re-raise updates in place instead of stacking a twin", () => {
    const { alerts } = useEmergencyAlert();
    raiseEmergencyAlert({ id: "link", severity: "warning", title: "first" });
    raiseEmergencyAlert({ id: "link", severity: "danger", title: "second", description: "d" });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: "danger", title: "second", description: "d" });
  });

  it("normalizes optional fields to empty strings", () => {
    const { alerts } = useEmergencyAlert();
    raiseEmergencyAlert({ id: "bare", severity: "danger", title: "t" });
    expect(alerts[0]).toMatchObject({ description: "", code: "", kicker: "", dismissible: true });
  });
});

describe("snooze episode semantics", () => {
  it("snooze hides the item and persists the record", () => {
    const { alerts } = useEmergencyAlert();
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "t" });
    snoozeEmergencyAlert("quota");
    expect(alerts[0].snoozed).toBe(true);
    expect(sessionStorage.getItem("hk-emergency-snooze")).toContain("quota");
  });

  it("re-raise does NOT reset the snooze — only clear ends the episode", () => {
    const { alerts } = useEmergencyAlert();
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "t" });
    snoozeEmergencyAlert("quota");
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "t2" });
    expect(alerts[0].snoozed).toBe(true);
    expect(alerts[0].title).toBe("t2");

    clearEmergencyAlert("quota");
    expect(alerts).toHaveLength(0);
    // The next occurrence of the SAME condition alerts again.
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "t3" });
    expect(alerts[0].snoozed).toBe(false);
  });

  it("a snoozed id stays hidden across a fresh raise (sessionStorage record)", () => {
    const { alerts } = useEmergencyAlert();
    raiseEmergencyAlert({ id: "persisted", severity: "warning", title: "t" });
    snoozeEmergencyAlert("persisted");
    // Simulate the reload path: state gone, storage intact.
    resetEmergencyAlerts();
    sessionStorage.setItem("hk-emergency-snooze", JSON.stringify(["persisted"]));
    raiseEmergencyAlert({ id: "persisted", severity: "warning", title: "t" });
    expect(alerts[0].snoozed).toBe(true);
  });

  it("snoozing an unknown or already-snoozed id is a no-op", () => {
    expect(() => snoozeEmergencyAlert("ghost")).not.toThrow();
    const onSnooze = vi.fn();
    raiseEmergencyAlert({ id: "once", severity: "warning", title: "t", onSnooze });
    snoozeEmergencyAlert("once");
    snoozeEmergencyAlert("once");
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });
});

describe("severity rank", () => {
  it("danger outranks warning", () => {
    expect(emergencySeverityRank("danger")).toBeGreaterThan(emergencySeverityRank("warning"));
  });
});

describe("runtime registry", () => {
  it("the first raise registers the context (readHkRuntime answers)", () => {
    raiseEmergencyAlert({ id: "reg", severity: "warning", title: "t" });
    // readHkRuntime returns the entry's live read() snapshot directly.
    expect(readHkRuntime("emergencyAlert")).toEqual({
      active: [{ id: "reg", severity: "warning" }],
      snoozed: 0,
    });
    // The registered entry itself is a "context".
    const entry = listHkRuntime().find((e) => e.id === "emergencyAlert");
    expect(entry?.kind).toBe("context");
  });
});
