import { afterEach, describe, expect, it } from "vitest";

import { setLocale } from "../i18n/context";
import {
  getHkRuntimeEntry,
  hkRuntimeSnapshot,
  readHkRuntime,
  writeHkRuntime,
} from "./registry";
import { installHkImageFallback } from "./imageFallback";
import { onFrame, setReducedMotion } from "./animationBus";
import { scheduleInterval } from "./intervalBus";
import { installHkTooltipBridge } from "./tooltipBridge";
import { installHistorySafetyNet } from "./historySafetyNet";
import { installNavigationSafetyNet } from "./navigationGuard";
import { usePopupManager } from "./usePopupManager";
import { useOverlay } from "./useOverlay";
import { useToast } from "./useToast";
import { clearErrorReportingState, reportError } from "../errorReporting/state";
import { clearBlockingToasts, showBlockingToast } from "./useBlockingToast";
import { onPageLifecycle, pageLifecycleState } from "./pageLifecycle";
import { showProgressDialog } from "../composables/useProgressDialog";

/**
 * Integration contract: every hikari global context / hook / bus reports
 * itself to the runtime registry (the "context of contexts") WITHOUT its
 * registration API changing, pulses on activity, and exposes its global
 * state for cross-context read/write through the registry.
 */

const uninstalls: Array<() => void> = [];

afterEach(() => {
  for (const u of uninstalls.splice(0)) u();
  setReducedMotion(false);
  clearErrorReportingState();
});

describe("i18n context auto-report", () => {
  it("registers at module init as a live context", () => {
    const entry = getHkRuntimeEntry("i18n");
    expect(entry).toBeDefined();
    expect(entry!.status).toBe("active");
    expect(entry!.kind).toBe("context");
    const state = readHkRuntime("i18n");
    expect(typeof state!.locale).toBe("string");
    expect(typeof state!.keys).toBe("number");
  });

  it("pulses and updates the read facet on locale switches", async () => {
    const before = getHkRuntimeEntry("i18n")!.pulses;
    await setLocale("zh-CN");
    const after = getHkRuntimeEntry("i18n")!;
    expect(after.pulses).toBeGreaterThan(before);
    expect(readHkRuntime("i18n")!.locale).toBe("zh-CN");
    await setLocale("en");
  });

  it("supports plugin-style steering through the write facet", async () => {
    expect(writeHkRuntime("i18n", { type: "setLocale", locale: "ja" })).toBe(true);
    expect(readHkRuntime("i18n")!.locale).toBe("ja");
    expect(writeHkRuntime("i18n", { type: "nonsense" })).toBe(false);
    await setLocale("en");
  });
});

describe("popup manager (modal context) auto-report", () => {
  it("reports lazily on first use and counts live popups per kind", () => {
    const manager = usePopupManager();
    expect(getHkRuntimeEntry("popupManager")).toBeDefined();
    const handleA = manager.register("modal", true, "Settings");
    const handleB = manager.register("dropdown");
    const state = readHkRuntime("popupManager")!;
    expect(state.open).toBe(2);
    expect((state.byKind as Record<string, number>).modal).toBe(1);
    expect((state.byKind as Record<string, number>).dropdown).toBe(1);
    expect(state.scrollLocks).toBe(1);
    manager.unregister(handleA.id);
    manager.unregister(handleB.id);
    expect(readHkRuntime("popupManager")!.open).toBe(0);
  });

  it("pulses on register/unregister", () => {
    const manager = usePopupManager();
    const before = getHkRuntimeEntry("popupManager")!.pulses;
    const handle = manager.register("tooltip");
    manager.unregister(handle.id);
    expect(getHkRuntimeEntry("popupManager")!.pulses).toBeGreaterThanOrEqual(before + 2);
  });
});

describe("overlay context auto-report", () => {
  it("reports lazily on first use and lists open overlay names", () => {
    const overlay = useOverlay({ name: "hk-test-select" });
    overlay.open();
    const state = readHkRuntime("overlay")!;
    expect(state.open).toBe(1);
    expect(state.names).toContain("hk-test-select");
    overlay.close();
    expect(readHkRuntime("overlay")!.open).toBe(0);
  });
});

describe("toast context auto-report", () => {
  it("reports lazily on first use and counts slots/messages", () => {
    const toast = useToast();
    toast.info("hello");
    toast.error("bad");
    const state = readHkRuntime("toast")!;
    expect(state.slots).toBe(2);
    expect(state.messages).toBe(2);
    expect(getHkRuntimeEntry("toast")!.pulses).toBeGreaterThan(0);
  });

  it("an unknown-id remove is a full no-op — no pulse, no state change", () => {
    const { remove } = useToast();
    const pulsesBefore = getHkRuntimeEntry("toast")!.pulses;
    const slotsBefore = readHkRuntime("toast")!.slots;
    remove(999999);
    expect(getHkRuntimeEntry("toast")!.pulses).toBe(pulsesBefore);
    expect(readHkRuntime("toast")!.slots).toBe(slotsBefore);
  });
});

describe("image fallback hook auto-report", () => {
  it("reports on install, pulses with a running marked count, disposes on uninstall", () => {
    expect(getHkRuntimeEntry("imageFallback")?.status ?? "absent").not.toBe("active");
    const uninstall = installHkImageFallback();
    uninstalls.push(uninstall);

    const entry = getHkRuntimeEntry("imageFallback")!;
    expect(entry.kind).toBe("hook");
    expect(entry.status).toBe("active");
    expect(entry.meta.fallback).toBe("bundled");

    const el = document.createElement("img");
    el.src = "https://example.invalid/pic.png";
    document.body.appendChild(el);
    el.dispatchEvent(new Event("error"));

    expect(entry.meta.marked).toBe(1);
    expect(readHkRuntime("imageFallback")).toEqual({ installed: true, marked: 1 });
    el.remove();

    uninstall();
    expect(getHkRuntimeEntry("imageFallback")!.status).toBe("disposed");
    expect(readHkRuntime("imageFallback")).toBeUndefined();
  });
});

describe("tooltip bridge hook auto-report", () => {
  it("reports on install with options meta and disposes on uninstall", () => {
    const uninstall = installHkTooltipBridge({ delay: 10, placement: "bottom" });
    uninstalls.push(uninstall);
    const entry = getHkRuntimeEntry("tooltipBridge")!;
    expect(entry.kind).toBe("hook");
    expect(entry.status).toBe("active");
    expect(entry.meta.delay).toBe(10);
    expect(entry.meta.placement).toBe("bottom");
    uninstall();
    expect(getHkRuntimeEntry("tooltipBridge")!.status).toBe("disposed");
  });
});

describe("animation bus auto-report", () => {
  it("reports lazily on first schedule and exposes live load", () => {
    const handle = onFrame(() => undefined, "normal");
    const entry = getHkRuntimeEntry("animationBus");
    expect(entry).toBeDefined();
    expect(entry!.kind).toBe("bus");
    expect((readHkRuntime("animationBus")!.normal as number) >= 1).toBe(true);
    handle.disconnect();
  });

  it("supports plugin-style reduced-motion steering through the write facet", () => {
    onFrame(() => undefined); // activate the bus's registry entry
    expect(writeHkRuntime("animationBus", { type: "setReducedMotion", value: true })).toBe(true);
    expect(readHkRuntime("animationBus")!.paused).toBe(true);
    expect(writeHkRuntime("animationBus", { type: "setReducedMotion", value: false })).toBe(true);
    expect(readHkRuntime("animationBus")!.paused).toBe(false);
    expect(writeHkRuntime("animationBus", { type: "warp" })).toBe(false);
  });
});

describe("interval bus auto-report", () => {
  it("reports lazily on first schedule with live slot counts", () => {
    const handle = scheduleInterval(() => undefined, 60_000);
    const entry = getHkRuntimeEntry("intervalBus");
    expect(entry).toBeDefined();
    expect(readHkRuntime("intervalBus")!.slots).toBe(1);
    handle.disconnect();
    expect(readHkRuntime("intervalBus")!.slots).toBe(0);
  });
});

describe("blocking toast context auto-report", () => {
  afterEach(() => clearBlockingToasts());

  it("reports lazily on first prompt and counts pending gates", () => {
    expect(getHkRuntimeEntry("blockingToast")?.status ?? "absent").not.toBe("active");
    void showBlockingToast("join this group?");
    expect(getHkRuntimeEntry("blockingToast")!.kind).toBe("context");
    expect(readHkRuntime("blockingToast")!.pending).toBe(1);
    clearBlockingToasts();
    expect(readHkRuntime("blockingToast")!.pending).toBe(0);
  });
});

describe("page lifecycle context auto-report", () => {
  it("reports (lazily, or via a sibling bus) and exposes visibility/online state", () => {
    // NOTE: no "not active before" precondition here — the interval bus
    // subscribes to the lifecycle internally, so any earlier test that
    // touched it has already activated this entry. That transitive
    // activation is exactly the auto-report behavior under test.
    const unsubscribe = onPageLifecycle(() => undefined);
    const entry = getHkRuntimeEntry("pageLifecycle")!;
    expect(entry.kind).toBe("context");
    expect(entry.status).toBe("active");
    const state = readHkRuntime("pageLifecycle")!;
    expect(typeof state.visible).toBe("boolean");
    expect(typeof state.online).toBe("boolean");
    expect(state.listeners).toBe(1);
    unsubscribe();
    expect(readHkRuntime("pageLifecycle")!.listeners).toBe(0);
    expect(pageLifecycleState().visible).toBe(true);
  });
});

describe("error reporting plugin auto-report", () => {
  it("reports at module init and counts accepted errors in the read facet", () => {
    const entry = getHkRuntimeEntry("errorReporting");
    expect(entry).toBeDefined();
    expect(entry!.kind).toBe("plugin");
    const before = readHkRuntime("errorReporting")!.reports as number;
    reportError(new Error("registry-test"), "manual");
    const state = readHkRuntime("errorReporting")!;
    expect(state.reports).toBe(before + 1);
    expect(state.landingUp).toBe(true);
    expect((state.current as { message: string }).message).toBe("registry-test");
    // First-error-wins: a second error while the landing is up logs but
    // does NOT count as accepted.
    reportError(new Error("registry-test-2"), "manual");
    expect(readHkRuntime("errorReporting")!.reports).toBe(before + 1);
    expect((readHkRuntime("errorReporting")!.current as { message: string }).message).toBe("registry-test");
  });
});

describe("safety-net hooks report on install, not on import", () => {
  // ONE test for the whole safety-net family on purpose: the "not active
  // before install" premise is only sound while no sibling test has
  // installed either net (installNavigationSafetyNet internally installs
  // the history net), so every install in this file lives HERE — split
  // tests were order-dependent under --sequence.shuffle.
  it("nets become active only when installed; meta reports the ACTIVE patch's options", () => {
    // Importing the modules (which this file did transitively) must not
    // claim installed hooks.
    expect(getHkRuntimeEntry("historySafetyNet")?.status ?? "absent").not.toBe("active");
    expect(getHkRuntimeEntry("navigationGuard")?.status ?? "absent").not.toBe("active");

    installHistorySafetyNet();
    const historyEntry = getHkRuntimeEntry("historySafetyNet")!;
    expect(historyEntry.kind).toBe("hook");
    expect(historyEntry.status).toBe("active");
    expect(historyEntry.meta.fallback).toBe("/");
    // The history net alone must not claim the router guard.
    expect(getHkRuntimeEntry("navigationGuard")?.status ?? "absent").not.toBe("active");

    installNavigationSafetyNet();
    const navEntry = getHkRuntimeEntry("navigationGuard")!;
    expect(navEntry.kind).toBe("hook");
    expect(navEntry.status).toBe("active");
    expect(navEntry.meta.routerGuard).toBe(false);

    // A no-op re-install with a DIFFERENT fallback cannot change the
    // live closure (installs are idempotent) — the meta must not claim
    // the new target either.
    installHistorySafetyNet({ fallback: "/no-op-reinstall-target" });
    expect(getHkRuntimeEntry("historySafetyNet")!.meta.fallback).not.toBe("/no-op-reinstall-target");
  });
});

describe("progress dialog context auto-report", () => {
  it("reports lazily on first show and exposes the live dialog state", () => {
    expect(getHkRuntimeEntry("progressDialog")?.status ?? "absent").not.toBe("active");
    const dialog = showProgressDialog({ title: "Deploying" });
    dialog.log("step 1");
    dialog.log("step 2");
    const state = readHkRuntime("progressDialog")!;
    expect(state.open).toBe(true);
    expect(state.title).toBe("Deploying");
    expect(state.logLines).toBe(2);
    dialog.close();
    expect(readHkRuntime("progressDialog")!.open).toBe(false);
  });
});

describe("whole-registry debug snapshot", () => {
  it("captures every reporting subsystem with live state", () => {
    const uninstall = installHkImageFallback();
    uninstalls.push(uninstall);
    usePopupManager();
    const snap = hkRuntimeSnapshot();
    const ids = snap.entries.filter((e) => e.status === "active").map((e) => e.id);
    for (const expected of ["i18n", "popupManager", "imageFallback", "errorReporting"]) {
      expect(ids).toContain(expected);
    }
    expect(() => JSON.stringify(snap)).not.toThrow();
  });
});
