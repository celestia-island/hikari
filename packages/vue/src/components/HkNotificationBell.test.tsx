import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkNotificationBell from "./HkNotificationBell";
import { recordNotification, resetNotifications, useNotificationCenter } from "../runtime/notificationCenter";
import { raiseEmergencyAlert, resetEmergencyAlerts, snoozeEmergencyAlert } from "../runtime/useEmergencyAlert";
import { setLocale } from "../i18n/context";

/**
 * HkNotificationBell behavior tests:
 * - the bell renders an icon button with the notification aria label
 * - an unread journal lights the button's own dot (with its label)
 * - clicking the bell opens the panel (HkPopover panel mounts) and
 *   opening IS the read receipt (dot goes dark)
 * - rows render title / time / detail / code chip
 * - a snoozed emergency entry shows the Hidden state chip and its
 *   restore button unsnoozes through the journal's resummon path
 * - Clear all empties the journal
 *
 * (Repo test convention: raw createApp + document queries, no
 * @vue/test-utils dependency.)
 */

const mounts: Array<{ app: ReturnType<typeof createApp>; container: HTMLElement }> = [];

function mountBell() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const app = createApp({ render: () => h(HkNotificationBell) });
  mounts.push({ app, container });
  app.mount(container);
  return container;
}

async function settle() {
  await nextTick();
  await new Promise((r) => setTimeout(r, 30));
  await nextTick();
}

function bellButton(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(".hk-notification-bell .hk-icon-button")!;
}

function panel(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".hk-notification-center");
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".hk-notification-row"));
}

afterEach(() => {
  for (const { app, container } of mounts) {
    app.unmount();
    container.remove();
  }
  mounts.length = 0;
  document.body
    .querySelectorAll(".hk-popover-scrim, .hk-popover-panel")
    .forEach((el) => el.remove());
  resetNotifications();
  resetEmergencyAlerts();
});

describe("bell trigger", () => {
  it("renders the bell with the notification label", async () => {
    await setLocale("zh-Hans");
    mountBell();
    await settle();
    expect(bellButton().getAttribute("aria-label")).toBe("通知中心");
  });

  it("an unread journal lights the button's own dot; open clears it", async () => {
    await setLocale("en");
    recordNotification({ id: "t1", kind: "toast", tone: "error", title: "boom" });
    mountBell();
    await settle();
    const btn = bellButton();
    expect(btn.querySelector(".hk-icon-button-dot")).toBeTruthy();

    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(panel()).toBeTruthy();
    await settle();
    // Opening IS the read receipt — the dot is gone while the panel is open.
    expect(btn.querySelector(".hk-icon-button-dot")).toBeFalsy();
  });

  it("an empty journal shows the empty state", async () => {
    await setLocale("en");
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(document.querySelector(".hk-notification-center__empty")?.textContent).toBe(
      "No notifications yet",
    );
  });
});

describe("panel rows", () => {
  it("renders title, time, detail and code chip", async () => {
    await setLocale("en");
    recordNotification({
      id: "emergency:quota",
      kind: "emergency",
      tone: "warning",
      title: "可用额度已用完",
      detail: "充值后立即可用",
      code: "QUOTA_EXHAUSTED",
    });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows()).toHaveLength(1);
    const row = rows()[0];
    expect(row.querySelector(".hk-notification-row__title")?.textContent).toBe("可用额度已用完");
    expect(row.querySelector(".hk-notification-row__detail-text")?.textContent).toBe("充值后立即可用");
    expect(row.querySelector(".hk-notification-row__code")?.textContent).toBe("QUOTA_EXHAUSTED");
    expect(row.querySelector(".hk-notification-row__time")).toBeTruthy();
  });

  it("a snoozed emergency shows Hidden + a working restore button", async () => {
    await setLocale("en");
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "quota out" });
    snoozeEmergencyAlert("quota");
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const row = rows()[0];
    expect(row.classList.contains("is-snoozed")).toBe(true);
    expect(row.querySelector(".hk-notification-row__state")?.textContent).toBe("Hidden");
    const restore = row.querySelector<HTMLButtonElement>(".hk-notification-row__restore");
    expect(restore?.textContent).toBe("Show again");
    restore!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    // The band is live again and the record follows.
    expect(row.classList.contains("is-active")).toBe(true);
  });

  it("a cleared emergency shows Resolved without a restore button", async () => {
    await setLocale("en");
    recordNotification({
      id: "emergency:done",
      kind: "emergency",
      tone: "warning",
      title: "resolved",
      state: "cleared",
    });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const row = rows()[0];
    expect(row.querySelector(".hk-notification-row__state")?.textContent).toBe("Resolved");
    expect(row.querySelector(".hk-notification-row__restore")).toBeFalsy();
  });

  it("rows sort newest-first and Clear all empties the journal", async () => {
    await setLocale("en");
    const { entries } = useNotificationCenter();
    recordNotification({ id: "old", kind: "toast", tone: "error", title: "older" });
    recordNotification({ id: "new", kind: "toast", tone: "warning", title: "newer" });
    // Same-millisecond pushes would tie on updatedAt (stable sort keeps
    // insertion order) — make the recency explicit for this assertion.
    entries.find((e) => e.id === "new")!.updatedAt = Date.now() + 5_000;
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const titles = rows().map((r) => r.querySelector(".hk-notification-row__title")?.textContent);
    expect(titles).toEqual(["newer", "older"]);

    (document.querySelector<HTMLButtonElement>(".hk-notification-center__clear")!).dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    await settle();
    expect(document.querySelector(".hk-notification-center__empty")).toBeTruthy();
    expect(rows()).toHaveLength(0);
  });
});
