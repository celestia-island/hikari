import { afterEach, describe, expect, it, vi } from "vitest";
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
 * - error/warning rows carry the toast-family copy button (user
 *   direction 2026-11-19) and copy the FULL record to the clipboard;
 *   the other tones stay non-copyable like their surfaces
 * - a snoozed emergency entry shows the Hidden state chip and its
 *   restore button unsnoozes through the journal's resummon path
 * - Clear all (icon + label) empties the journal
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

/** The toast family's clipboard write, stubbed at navigator level
 *  (same shape HkTable/HkErrorLanding tests use) — jsdom has no
 *  clipboard, and the fallback execCommand path would not tell us
 *  WHAT text was copied. */
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
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

  it("error AND warning rows carry the toast's copy button; the payload is the FULL record", async () => {
    // User direction 2026-11-19: beside dismiss, error/warning rows get
    // the toast family's own copy affordance (same button shape, same
    // `hikari::toast.copy` label, same clipboard write). The row clips
    // its text, so the copied payload must be the complete record —
    // title / code / detail, whatever fields exist, one per line.
    // BOTH tones are pinned positively (round-2 review): dropping the
    // warning arm of rowCopyable must go red here, not just the error
    // arm.
    await setLocale("en");
    const writeText = stubClipboard();
    recordNotification({
      id: "toast:e:1:1",
      kind: "toast",
      tone: "error",
      title: "billing.quota.snapshot: billing.quota.bad_gate",
      detail: "The gate returned an unrecoverable verdict",
      code: "billing.quota.bad_gate",
    });
    recordNotification({ id: "toast:w:1:2", kind: "toast", tone: "warning", title: "disk almost full" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const byLabel = (row: HTMLElement, label: string) =>
      row.querySelector<HTMLButtonElement>(
        `.hk-notification-row__actions .hk-icon-button[aria-label="${label}"]`,
      );
    const errorRow = rows().find((r) => r.textContent?.includes("billing.quota"))!;
    const copy = byLabel(errorRow, "Copy");
    expect(copy, "copy button renders on an error row").toBeTruthy();
    // LEFT of dismiss: the copy button is the actions lane's first child.
    expect(copy!.parentElement!.firstElementChild).toBe(copy);
    copy!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(
      "billing.quota.snapshot: billing.quota.bad_gate\nbilling.quota.bad_gate\nThe gate returned an unrecoverable verdict",
    );

    // The warning arm: same button, and the title-only payload proves
    // the optional code/detail guards skip MISSING fields instead of
    // joining empty lines.
    const warningRow = rows().find((r) => r.textContent?.includes("disk almost full"))!;
    const warningCopy = byLabel(warningRow, "Copy");
    expect(warningCopy, "copy button renders on a warning row").toBeTruthy();
    warningCopy!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenLastCalledWith("disk almost full");
    // The toast seat's hover hint rides along (claim pin — round-3
    // mutant M3 deleted it green): aria-label AND title, same key.
    expect(copy!.getAttribute("title")).toBe("Copy");
  });

  it("tones the toast family treats as non-copyable get NO copy button", async () => {
    await setLocale("en");
    stubClipboard();
    recordNotification({ id: "s1", kind: "toast", tone: "success", title: "saved" });
    recordNotification({ id: "i1", kind: "toast", tone: "info", title: "heads up" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows()).toHaveLength(2);
    expect(
      document.querySelector('.hk-notification-row__actions .hk-icon-button[aria-label="Copy"]'),
      "success/info records stay non-copyable, like their surfaces",
    ).toBeNull();
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
    expect(row.querySelector(".hk-notification-row__title-state")?.textContent).toBe("· Hidden");
    expect(row.querySelector(".hk-notification-row__title .hk-notification-row__title-state")).toBeNull();
    // The standalone chip is gone (folded into the title, user ruling).
    expect(row.querySelector(".hk-notification-row__state")).toBeFalsy();
    const restoreBtns = row.querySelectorAll<HTMLButtonElement>(".hk-notification-row__actions .hk-icon-button");
    const restore = restoreBtns[restoreBtns.length - 1];
    expect(restore, "restore button renders").toBeTruthy();
    expect(restore!.getAttribute("aria-label")).toContain("Show again");
    restore!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    // The band is live again and the record follows — and the restore
    // button is GONE (R2 finding: no dead control on an active band).
    expect(row.classList.contains("is-active")).toBe(true);
    expect(row.querySelector('.hk-notification-row__actions .hk-icon-button[aria-label="Show again"]')).toBeFalsy();
  });

  it("an ACTIVE emergency row (band on screen) shows no restore button", async () => {
    await setLocale("en");
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "quota out" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const row = rows()[0];
    expect(row.classList.contains("is-active")).toBe(true);
    expect(row.querySelector('.hk-notification-row__actions .hk-icon-button[aria-label="Show again"]')).toBeFalsy();
    expect(row.querySelector(".hk-notification-row__state")).toBeFalsy();
    // Emergency records inherit the copy affordance through their tone
    // (round-3 intent-drift pin): a warning-severity emergency IS a
    // copyable diagnostic record — its whole action lane is exactly
    // [Copy] (live episodes carry no dismiss, and an active band has
    // no restore).
    expect(row.querySelector('.hk-notification-row__actions .hk-icon-button[aria-label="Copy"]')).toBeTruthy();
    expect(row.querySelectorAll(".hk-notification-row__actions .hk-icon-button")).toHaveLength(1);
  });

  it("an emergency row carries NO dismiss button (live episode is not user-dismissable)", async () => {
    await setLocale("en");
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "quota out", dismissible: true });
    snoozeEmergencyAlert("quota");
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows()).toHaveLength(1);
    expect(
      rows()[0].querySelector('.hk-notification-row__actions .hk-icon-button[aria-label="Dismiss"]'),
      "the emergency row must not carry the dismiss control",
    ).toBeNull();
  });

  it("a same-millisecond tie renders the LATER push above (append order)", async () => {
    // R8/R9 pin (PR #1322): with updatedAt equal the journal's own
    // append order judges — the later push must sit above the earlier
    // one (string ids carry no numeric order, so an id tiebreak would
    // flip across digit widths).
    await setLocale("en");
    recordNotification({ id: "toast:e:1:9", kind: "toast", tone: "error", title: "earlier" });
    recordNotification({ id: "toast:e:1:10", kind: "toast", tone: "warning", title: "later" });
    const { entries } = useNotificationCenter();
    entries.forEach((e) => { e.updatedAt = 1_000; });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const titles = rows().map((r) => r.querySelector(".hk-notification-row__title")?.textContent);
    expect(titles).toEqual(["later", "earlier"]);
  });

  it("the restore button is STATE-gated even when a callback lingers", async () => {
    // R2 finding, PR #1322 (mutation-e pin): the S1 gate is redundant
    // in-tree (active emergencies never carry a callback), so this test
    // builds the one shape that would otherwise render a dead control —
    // a host-recorded entry holding a callback in a non-snoozed state.
    await setLocale("en");
    recordNotification({
      id: "emergency:done",
      kind: "emergency",
      tone: "warning",
      title: "resolved but armed",
      state: "cleared",
      onResummon: () => {},
    });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const row = rows()[0];
    expect(row.querySelector(".hk-notification-row__title-state")?.textContent).toBe("· Resolved");
    expect(row.querySelector('.hk-notification-row__actions .hk-icon-button[aria-label="Show again"]')).toBeFalsy();
    // R10 (PR #1333): the state-scoped gate means a CLEARED emergency
    // row IS dismissable — this is the pin that was lost in eb492e44's
    // wrong-sibling deletion. Pinned by LABEL (round-2 review): the row
    // now also carries a copy button, and a bare `.hk-icon-button`
    // first-match resolves to THAT, so dropping the dismiss gate would
    // have stayed green.
    expect(
      row.querySelector('.hk-notification-row__actions .hk-icon-button[aria-label="Dismiss"]'),
      "a resolved record is dismissable",
    ).not.toBeNull();
  });

  it("the row dismiss button forgets that entry only", async () => {
    // The unified per-row affordance (user ruling 2026-11-15): every row
    // carries a trailing dismiss control — remove THIS record, leave the
    // rest of the journal alone.
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "keep me" });
    recordNotification({ id: "b", kind: "toast", tone: "warning", title: "drop me" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows()).toHaveLength(2);
    const dropRow = rows().find((r) => r.textContent?.includes("drop me"))!;
    const dismiss = dropRow.querySelector<HTMLButtonElement>(
      '.hk-notification-row__actions .hk-icon-button[aria-label="Dismiss"]',
    )!;
    expect(dismiss.getAttribute("aria-label")).toBe("Dismiss");
    dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("keep me");
  });

  it("a consolidated record renders ONE row with a corner tally badge", async () => {
    // User direction 2026-11-19: identical messages fold into one row;
    // the tone glyph's bottom-end corner carries the count.
    await setLocale("en");
    for (const id of ["t:1", "t:2", "t:3"]) {
      recordNotification({ id, kind: "toast", tone: "error", title: "boom" });
    }
    recordNotification({ id: "s:1", kind: "toast", tone: "warning", title: "other" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows()).toHaveLength(2);
    const boomRow = rows().find((r) => r.textContent?.includes("boom"))!;
    const badge = boomRow.querySelector<HTMLElement>(".hk-notification-row__icon-count");
    expect(badge, "the tally badge renders").toBeTruthy();
    expect(badge!.textContent).toBe("3");
    expect(badge!.getAttribute("title")).toContain("msgs");
    // A single-occurrence record carries NO badge.
    const otherRow = rows().find((r) => r.textContent?.includes("other"))!;
    expect(otherRow.querySelector(".hk-notification-row__icon-count")).toBeNull();
  });

  it("the open panel carries the overlay scrollbar tracks; closing detaches them", async () => {
    // The list keeps native overflow MECHANICS with the suppression pair,
    // so the overlay engine is the only chrome it can ever show (user
    // report 2026-11-19: the list scrolled invisibly). HkPopover attaches
    // its engine in sheet mode only — the bell owns the desktop one.
    await setLocale("en");
    for (let i = 0; i < 30; i++) {
      recordNotification({ id: `t:${i}`, kind: "toast", tone: "error", title: `row ${i}` });
    }
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const wrap = document.querySelector(".hk-notification-center__list-wrap");
    expect(wrap, "the dedicated track host exists").toBeTruthy();
    expect(wrap!.querySelectorAll(".hk-scrollbar-track").length).toBeGreaterThan(0);
    // Closing the panel must not leak the engine (document listeners /
    // cron timers ride the handle).
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(document.querySelector(".hk-notification-center__list-wrap")).toBeNull();
  });

  it("rows sort newest-first and Clear all empties the journal", async () => {
    await setLocale("en");
    const { entries } = useNotificationCenter();
    recordNotification({ id: "old", kind: "toast", tone: "error", title: "older" });
    recordNotification({ id: "new", kind: "toast", tone: "warning", title: "newer" });
    // Same-millisecond pushes would tie on updatedAt — make the recency
    // explicit for this assertion (the pure-tie case is pinned below).
    entries.find((e) => e.id === "new")!.updatedAt = Date.now() + 5_000;
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const titles = rows().map((r) => r.querySelector(".hk-notification-row__title")?.textContent);
    expect(titles).toEqual(["newer", "older"]);

    // The clear-all affordance announces itself by its glyph (user
    // direction 2026-11-19): a leading icon inside the label button.
    // Resolved by its LABEL, not by first-match in the foot (2026-11-19
    // sweep): a sibling inserted before Clear all would otherwise
    // satisfy the glyph pin while the trash glyph was deleted.
    const clearBtn = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".hk-notification-center__foot .hk-btn"),
    ).find((b) => b.textContent?.includes("Clear all"))!;
    expect(clearBtn, "the clear-all button is in the foot").toBeTruthy();
    expect(clearBtn.querySelector(".hk-btn-icon")).toBeTruthy();
    clearBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(document.querySelector(".hk-notification-center__empty")).toBeTruthy();
    expect(rows()).toHaveLength(0);
  });
});
