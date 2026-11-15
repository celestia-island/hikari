import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createApp, h, nextTick } from "vue";

import HkEmergencySnoozeTray from "./HkEmergencySnoozeTray";
import {
  raiseEmergencyAlert,
  resetEmergencyAlerts,
  snoozeEmergencyAlert,
  useEmergencyAlert,
} from "../runtime/useEmergencyAlert";

/**
 * HEmergencySnoozeTray contract:
 * - no snoozed alerts → renders nothing
 * - snoozed alerts render HkPersistentToast chips (severity tone,
 *   label = title), iconOnly collapses to the icon (label span gone,
 *   aria-label kept)
 * - the detail card mirrors the original toast text (icon + title +
 *   description) with NO restore button — restore lives in the
 *   notification-center bell panel (2026-11-15 user ruling)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountHost(props: { iconOnly?: boolean; maxVisible?: number } = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({
    render: () =>
      h(HkEmergencySnoozeTray, {
        iconOnly: props.iconOnly ?? false,
        maxVisible: props.maxVisible ?? 0,
      }),
  });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 30));
  await nextTick();
}

function tray(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-emergency-snooze-tray");
}

function chips(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".hk-persistent-toast"));
}

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
  resetEmergencyAlerts();
});

describe("HEmergencySnoozeTray", () => {
  it("renders nothing while nothing is snoozed", async () => {
    raiseEmergencyAlert({ id: "a", severity: "warning", title: "a", dismissible: true });
    mountHost();
    await settle();
    expect(tray()).toBeNull();
  });

  it("snoozed alerts render as severity-toned chips with the title label", async () => {
    mountHost();
    raiseEmergencyAlert({ id: "q", severity: "warning", title: "可用额度已用完", dismissible: true });
    snoozeEmergencyAlert("q");
    await settle();
    const { alerts } = useEmergencyAlert();
    expect(tray()).not.toBeNull();
    expect(chips()).toHaveLength(1);
    expect(chips()[0].classList.contains("hk-persistent-toast--warning")).toBe(true);
    expect(chips()[0].textContent).toContain("可用额度已用完");
    expect(alerts).toHaveLength(1); // snoozed, not cleared
  });

  it("danger alerts map to the error tone chip (R3 M3b)", async () => {
    mountHost();
    raiseEmergencyAlert({ id: "d", severity: "danger", title: "t", dismissible: true });
    snoozeEmergencyAlert("d");
    await settle();
    expect(chips()[0].classList.contains("hk-persistent-toast--error")).toBe(true);
    resetEmergencyAlerts();
  });

  it("iconOnly collapses chips to the icon (label span dropped, aria-label kept)", async () => {
    mountHost({ iconOnly: true });
    raiseEmergencyAlert({ id: "q", severity: "warning", title: "可用额度已用完", dismissible: true });
    snoozeEmergencyAlert("q");
    await settle();
    const chip = chips()[0];
    expect(chip.classList.contains("hk-persistent-toast--icon-only")).toBe(true);
    expect(chip.querySelector(".hk-persistent-toast__label")).toBeNull();
    expect(chip.getAttribute("aria-label")).toBe("可用额度已用完");
  });

  it("the hover card mirrors the toast text with NO restore button", async () => {
    // 2026-11-15 user ruling: the bell panel owns restore; the tray's
    // hover card is a text mirror only (no second restore home beside
    // the bell's).
    mountHost();
    raiseEmergencyAlert({ id: "q", severity: "warning", title: "t", dismissible: true });
    snoozeEmergencyAlert("q");
    await settle();
    chips()[0].click();
    await settle();
    expect(
      document.querySelector(".hk-emergency-snooze-card button"),
      "the tray must not grow a second restore affordance",
    ).toBeNull();
    // The title text still mirrors the original toast.
    expect(document.querySelector(".hk-emergency-snooze-card__title")?.textContent).toBe("t");
  });
});
