import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";

import HkNotificationBell from "./HkNotificationBell";
import { recordNotification, resetNotifications, useNotificationCenter } from "../runtime/notificationCenter";
import { raiseEmergencyAlert, resetEmergencyAlerts, snoozeEmergencyAlert } from "../runtime/useEmergencyAlert";
import { setLocale } from "../i18n/context";
import { setReducedMotion } from "../runtime/animationBus";
import { setCssAnimationsEnabled } from "../animation/registerAnimations";

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
 * - row add/remove animates through HkListTransition (user direction
 *   2026-11-20): a dismissed row lingers as a pinned pop ghost and then
 *   resolves; clear-all fades every row while the empty caption coexists;
 *   a record landing on the open panel pops in; the foot keeps its
 *   empty-hides rule
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
  // 80ms: list rows now resolve their enter/leave through HkListTransition,
  // which removes a leaving element only after Vue's double-rAF class swap
  // plus the (zero-duration in jsdom) finish — 30ms raced that window.
  await new Promise((r) => setTimeout(r, 80));
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
    // The empty caption is gated on a row-less journal — with rows on
    // screen it must not render beside them (the persistent wrap makes
    // "always render it" a one-character mutation away).
    expect(document.querySelector(".hk-notification-center__empty")).toBeNull();
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

  it("identical messages render ONE row with a corner tally badge", async () => {
    // User direction 2026-11-19: identical messages consolidate into one
    // row; the tone glyph's corner carries the count. The JOURNAL stays
    // 1:1 with its sources (ids are lifecycle keys) — the grouping is a
    // view concern (the record-time merge design was rejected in review:
    // folding discards the incoming id and breaks every id-keyed op).
    await setLocale("en");
    for (const id of ["t:1", "t:2", "t:3"]) {
      recordNotification({ id, kind: "toast", tone: "error", title: "boom" });
    }
    recordNotification({ id: "s:1", kind: "toast", tone: "warning", title: "other" });
    const { entries } = useNotificationCenter();
    // The journal keeps full fidelity — three separate records.
    expect(entries).toHaveLength(4);
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    // …but the reader sees ONE row per distinct message.
    expect(rows()).toHaveLength(2);
    const boomRow = rows().find((r) => r.textContent?.includes("boom"))!;
    const badge = boomRow.querySelector<HTMLElement>(".hk-notification-row__icon-count");
    expect(badge, "the tally badge renders").toBeTruthy();
    // The visible glyph is the cap ("99+" above 99); the SR twin carries
    // the pair (see the a11y case below).
    expect(badge!.querySelector('[aria-hidden="true"]')!.textContent).toBe("3");
    expect(badge!.getAttribute("title")).toContain("msgs");
    // A single-occurrence record carries NO badge.
    const otherRow = rows().find((r) => r.textContent?.includes("other"))!;
    expect(otherRow.querySelector(".hk-notification-row__icon-count")).toBeNull();
  });

  it("dismiss on a consolidated row forgets EVERY member of the group", async () => {
    await setLocale("en");
    for (const id of ["t:1", "t:2", "t:3"]) {
      recordNotification({ id, kind: "toast", tone: "error", title: "boom" });
    }
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows()).toHaveLength(1);
    const boomRow = rows()[0]!;
    const dismiss = boomRow.querySelector<HTMLButtonElement>(
      '.hk-notification-row__actions .hk-icon-button[aria-label="Dismiss"]',
    )!;
    dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    // The whole line goes — not just the newest member.
    expect(useNotificationCenter().entries).toHaveLength(0);
    expect(rows()).toHaveLength(0);
  });

  it("the tally's accessible name is real text with its unit (not a bare number)", async () => {
    // Final-residual fix: `aria-label` on a role-less span is not a
    // reliable accessible name (generic role cannot be named from author),
    // so the badge ships a visually-hidden twin with the full pair while
    // the visible glyph stays the sighted shorthand.
    await setLocale("en");
    for (const id of ["t:1", "t:2", "t:3", "t:4"]) {
      recordNotification({ id, kind: "toast", tone: "error", title: "boom" });
    }
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const badge = rows()[0]!.querySelector<HTMLElement>(".hk-notification-row__icon-count")!;
    const sr = badge.querySelector<HTMLElement>(".hk-notification-row__sr-only");
    expect(sr, "the visually-hidden twin renders").toBeTruthy();
    expect(sr!.textContent).toBe("4 msgs");
    // The hiding recipe itself is pinned in the scss contract (happy-dom
    // applies no stylesheets, so a computed-style probe here would test
    // the environment, not the code).
  });

  it("a toast joining a snoozed emergency's group does NOT dissolve the Restore", async () => {
    // Round-3 S2, proven by probe: the group's FACE is its newest member
    // (the toast), so head-only action gating hid the emergency's only
    // restore affordance while the journal still held the callback — the
    // same loss the record-time merge was rejected for, at the view
    // layer. The actions lane scans members instead.
    await setLocale("en");
    raiseEmergencyAlert({ id: "quota", severity: "warning", title: "quota out" });
    snoozeEmergencyAlert("quota");
    recordNotification({
      id: "toast:same",
      kind: "toast",
      tone: "warning",
      title: "quota out",
      state: "active",
    });
    const { entries } = useNotificationCenter();
    expect(entries).toHaveLength(2);
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows()).toHaveLength(1);
    const row = rows()[0]!;
    // Restore is STILL offered (member scan), and the Hidden chip shows.
    const restore = row.querySelector<HTMLButtonElement>(
      '.hk-notification-row__actions .hk-icon-button[aria-label="Show again"]',
    );
    expect(restore, "the emergency's restore survives the grouping").toBeTruthy();
    expect(row.querySelector(".hk-notification-row__title-state")?.textContent).toContain(
      "Hidden",
    );
    // The tally counts both members.
    expect(
      row.querySelector('.hk-notification-row__icon-count [aria-hidden="true"]')?.textContent,
    ).toBe("2");
    // And the restore still works through the journal's resummon path.
    restore!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(
      row.querySelector('.hk-notification-row__actions .hk-icon-button[aria-label="Show again"]'),
    ).toBeFalsy();
    expect(row.classList.contains("is-active")).toBe(true);
  });

  it("two identical-content snoozed episodes each keep their own Restore", async () => {
    // Final-residual fix: `restorable` used to be a single `find`, so a
    // group holding two episodes surfaced ONE handle and stranded the
    // other's callback (journal intact, band hidden = unreachable).
    await setLocale("en");
    raiseEmergencyAlert({ id: "a", severity: "warning", title: "dup" });
    snoozeEmergencyAlert("a");
    raiseEmergencyAlert({ id: "b", severity: "warning", title: "dup" });
    snoozeEmergencyAlert("b");
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(rows(), "both episodes share one content group").toHaveLength(1);
    const restores = rows()[0]!.querySelectorAll<HTMLButtonElement>(
      '.hk-notification-row__actions .hk-icon-button[aria-label="Show again"]',
    );
    expect(restores, "one Restore per restorable episode").toHaveLength(2);
    // Each button drives its OWN episode: unsnoozing one leaves the other.
    restores[0]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const after = rows()[0]!.querySelectorAll<HTMLButtonElement>(
      '.hk-notification-row__actions .hk-icon-button[aria-label="Show again"]',
    );
    expect(after, "the other episode keeps its handle").toHaveLength(1);
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

    // Reopening on a row-less journal (the list stays mounted now — see
    // the motion section): the engine must (re)attach to the CURRENT
    // viewport. An update() on the stale handle would leave the list
    // scrolling invisibly again. (The attach TARGET itself is pinned in
    // HkNotificationBell.scrollTarget.test.tsx.)
    resetNotifications();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(document.querySelector(".hk-notification-center__empty")).toBeTruthy();
    recordNotification({ id: "late", kind: "toast", tone: "error", title: "late arrival" });
    await settle();
    const wrap2 = document.querySelector(".hk-notification-center__list-wrap");
    expect(wrap2, "the list is mounted under the open panel").toBeTruthy();
    expect(wrap2!.querySelectorAll(".hk-scrollbar-track").length).toBeGreaterThan(0);
    // The semantics the persistent wrap must never cost us (2026-11-20
    // review M7): `list-style: none` strips list semantics in
    // Safari/VoiceOver, so the explicit role is load-bearing.
    expect(
      document.querySelector(".hk-notification-center__list")!.getAttribute("role"),
    ).toBe("list");
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

  // ── row motion (user direction 2026-11-20) ──────────────────────────
  // Rows ride HkListTransition: add pops in, remove fades out as a pinned
  // ghost while siblings FLIP-glide. jsdom applies no stylesheets, so the
  // classes + the primitive's own inline pins ARE the observable contract.

  it("a dismissed row fades out through the list transition, then resolves", async () => {
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "keep me" });
    recordNotification({ id: "b", kind: "toast", tone: "warning", title: "drop me" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const dismiss = rows()
      .find((r) => r.textContent?.includes("drop me"))!
      .querySelector<HTMLButtonElement>(
        '.hk-notification-row__actions .hk-icon-button[aria-label="Dismiss"]',
      )!;
    dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    // The leaving row rides HkListTransition's pop leave (the ghost
    // pin/absolute-lift branch is geometry-gated and covered by the
    // primitive's own stubbed-layout suite; jsdom has no layout, so the
    // observable contract here is the leave machinery itself).
    const ghost = rows().find((r) => r.textContent?.includes("drop me"));
    expect(ghost, "the ghost lingers for the fade").toBeTruthy();
    expect(ghost!.className).toContain("hk-list-pop-leave-active");
    await settle();
    expect(rows(), "the ghost resolved, one row remains").toHaveLength(1);
    expect(rows()[0].textContent).toContain("keep me");
  });

  it("motion-collapsed hosts skip the hold and get the caption at once", async () => {
    // Round-5/round-6 findings: deleting the skip stayed green repo-wide.
    // All three arms must be exercised INDEPENDENTLY — `setReducedMotion`
    // also flips the CSS attribute (animationBus.ts), so a "bus parked"
    // case alone never reaches `isAnimationParked()`, and the media query
    // arm is a separate host class (a host that never wired
    // useReducedMotion at boot).
    await setLocale("en");
    const originalMatchMedia = window.matchMedia;
    let mmMatches = false;
    window.matchMedia = ((query: string) => ({
      matches: mmMatches && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    const cases: Array<[string, () => void, () => void]> = [
      ["bus parked", () => setReducedMotion(true), () => setReducedMotion(false)],
      [
        "global CSS switch off",
        () => setCssAnimationsEnabled(false),
        () => setCssAnimationsEnabled(true),
      ],
      // The two flags can diverge: a host re-enabling the attribute while
      // the bus stays parked reaches the park read on its own.
      [
        "bus parked with the attribute re-enabled",
        () => {
          setReducedMotion(true);
          setCssAnimationsEnabled(true);
        },
        () => setReducedMotion(false),
      ],
      [
        "OS reduced-motion query",
        () => {
          mmMatches = true;
        },
        () => {
          mmMatches = false;
        },
      ],
    ];
    try {
      for (const [label, collapse, restore] of cases) {
        recordNotification({
          id: `${label}:a`,
          kind: "toast",
          tone: "error",
          title: `row ${label}`,
        });
        mountBell();
        await settle();
        bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await settle();
        Object.defineProperty(
          document.querySelector(".hk-notification-center__list")!,
          "offsetHeight",
          { value: 96, configurable: true },
        );
        collapse();
        resetNotifications();
        await nextTick();
        // No hold (the CSS has already collapsed the transition) …
        expect(
          document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
          `${label}: the hold is skipped`,
        ).toBe("");
        // … and the caption is handed over in the SAME tick.
        expect(
          document.querySelector(".hk-notification-center__empty"),
          `${label}: caption available immediately`,
        ).toBeTruthy();
        restore();
        setReducedMotion(false);
        setCssAnimationsEnabled(true);
        for (const m of mounts.splice(0)) {
          m.app.unmount();
          m.container.remove();
        }
        document.body
          .querySelectorAll(".hk-popover-scrim, .hk-popover-panel")
          .forEach((el) => el.remove());
      }
    } finally {
      // A failing assertion must not leave the global switches flipped for
      // the rest of the file (the cascade would mask the real signal).
      setReducedMotion(false);
      setCssAnimationsEnabled(true);
      window.matchMedia = originalMatchMedia;
    }
  });

  it("a same-id re-record that replaces the row still holds the height", async () => {
    // Closing review F3: the journal upserts BY ID, so a poller rewriting an
    // entry's content changes the row's identity in place — one key out,
    // one key in, the COUNT unchanged. A count-keyed hold would skip it and
    // crop the bottom ghost exactly then.
    await setLocale("en");
    recordNotification({ id: "poll", kind: "toast", tone: "error", title: "before" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    Object.defineProperty(document.querySelector(".hk-notification-center__list")!, "offsetHeight", {
      value: 88,
      configurable: true,
    });
    recordNotification({ id: "poll", kind: "toast", tone: "error", title: "after" });
    await nextTick();
    expect(
      document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
      "a content-key replacement holds too",
    ).toBe("88px");
    expect(document.querySelector(".hk-notification-center__empty")).toBeNull();
  });

  it("an arrival during the hold does not crop the ghosts still fading", async () => {
    // Closing review M7: the arrival path must not release a hold while an
    // earlier batch is still leaving — the release is what crops the ghost.
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "one" });
    recordNotification({ id: "b", kind: "toast", tone: "warning", title: "two" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    Object.defineProperty(document.querySelector(".hk-notification-center__list")!, "offsetHeight", {
      value: 48,
      configurable: true,
    });
    rows()
      .find((r) => r.textContent?.includes("one"))!
      .querySelector<HTMLButtonElement>(
        '.hk-notification-row__actions .hk-icon-button[aria-label="Dismiss"]',
      )!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(
      document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
    ).toBe("48px");
    // A new record lands INSIDE the window, while the ghost is still fading.
    expect(document.querySelector('[class*="-leave-active"]'), "a ghost is in flight").toBeTruthy();
    recordNotification({ id: "c", kind: "toast", tone: "error", title: "three" });
    await nextTick();
    expect(
      document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
      "the in-flight ghost keeps its window",
    ).toBe("48px");
  });

  it("the row-less list is hidden from AT only while the caption carries the message", async () => {
    // Closing review M13: `aria-hidden` on the empty list is what stops AT
    // announcing "list, 0 items" beside "No notifications yet" — and it
    // must never be set while rows are on screen.
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "one" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const list = () => document.querySelector(".hk-notification-center__list")!;
    expect(list().getAttribute("aria-hidden"), "rows on screen: not hidden").toBeNull();
    resetNotifications();
    await new Promise((r) => setTimeout(r, 400));
    await nextTick();
    expect(document.querySelector(".hk-notification-center__empty")).toBeTruthy();
    expect(list().getAttribute("aria-hidden"), "caption showing: hidden").toBe("true");
  });

  it("closing mid-hold leaves no stale height behind for the next open", async () => {
    // Closing review F5: closing unmounts the panel body, so a surviving
    // hold would greet the next open as a blank panel at the old height
    // with the caption still suppressed.
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "one" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    Object.defineProperty(document.querySelector(".hk-notification-center__list")!, "offsetHeight", {
      value: 64,
      configurable: true,
    });
    resetNotifications();
    await nextTick();
    expect(
      document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
    ).toBe("64px");
    // Close (inside the window) and reopen at once.
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const list = document.querySelector<HTMLElement>(".hk-notification-center__list")!;
    expect(list, "the list is back").toBeTruthy();
    expect(list.style.minHeight, "no stale hold").toBe("");
    expect(document.querySelector(".hk-notification-center__empty")).toBeTruthy();
  });

  it("a PARTIAL dismiss holds the list height too (the bottom ghost is not cropped)", async () => {
    // Round-4 finding, S1: the hold is not an empty-state nicety. A pinned
    // ghost sits at its pre-patch offset inside the scroller, so ANY shrink
    // crops the bottom-most one — dismiss the last row of three and the
    // fade was invisible. (happy-dom has no layout, so the pre-patch height
    // read is stubbed; the real-browser behaviour is recorded in the PR.)
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "one" });
    recordNotification({ id: "b", kind: "toast", tone: "warning", title: "two" });
    recordNotification({ id: "c", kind: "toast", tone: "error", title: "three" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    Object.defineProperty(document.querySelector(".hk-notification-center__list")!, "offsetHeight", {
      value: 72,
      configurable: true,
    });
    // Rows sort newest-first, so the BOTTOM row is the oldest record —
    // that is the one the hold exists for (its ghost sits at the old
    // content bottom and would be cropped the moment the box shrinks).
    const last = rows().find((r) => r.textContent?.includes("one"))!;
    last.querySelector<HTMLButtonElement>(
      '.hk-notification-row__actions .hk-icon-button[aria-label="Dismiss"]',
    )!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    // Rows remain (partial) — the ghost of the dismissed row still carries
    // the row class during its leave, so count the LIVE ones.
    const live = rows().filter((r) => !r.className.includes("-leave-active"));
    expect(live).toHaveLength(2);
    expect(
      document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
    ).toBe("72px");
    // No caption during the window: the journal is not empty.
    expect(document.querySelector(".hk-notification-center__empty")).toBeNull();
    await new Promise((r) => setTimeout(r, 400));
    await nextTick();
    expect(
      document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
    ).toBe("");
    expect(document.querySelector(".hk-notification-center__empty")).toBeNull();
  });

  it("clear-all fades every row, then the empty caption takes over", async () => {
    // The whole list leaving at once is the case the persistent wrap and
    // the hold window exist for: a branch swap would unmount the
    // TransitionGroup and cancel every ghost mid-flight (a snap instead
    // of a fade). The caption must NOT mount beside the ghosts — it would
    // paint under the first departing row and read "No notifications yet"
    // through a fading notification (2026-11-20 review, S2).
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "one" });
    recordNotification({ id: "b", kind: "toast", tone: "warning", title: "two" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    const clearBtn = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".hk-notification-center__foot .hk-btn"),
    ).find((b) => b.textContent?.includes("Clear all"))!;
    // happy-dom has no layout, so the hold's pre-patch height read needs a
    // stub — otherwise lastListHeight stays 0 and the window below is
    // unobservable here (the real-browser behaviour is measured in the
    // PR record; jsdom can only pin the resulting style/caption gates).
    Object.defineProperty(document.querySelector(".hk-notification-center__list")!, "offsetHeight", {
      value: 120,
      configurable: true,
    });
    clearBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    expect(document.querySelectorAll(".hk-list-pop-leave-active")).toHaveLength(2);
    // During the fade: ghosts only — no caption, and the list holds its
    // last height so the ghosts are not clipped by a collapsed scroller.
    expect(document.querySelector(".hk-notification-center__empty")).toBeNull();
    expect(
      document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
      "the EXACT pre-patch height is held (a wrong-measurement mutation must red)",
    ).toBe("120px");
    // The foot keeps its empty-hides rule (unchanged semantics).
    expect(document.querySelector(".hk-notification-center__foot")).toBeNull();
    await settle();
    expect(rows()).toHaveLength(0);
    // After the leave window (LEAVE_MS = 320, slower than settle()'s 80ms)
    // the caption takes over and the hold releases.
    await new Promise((r) => setTimeout(r, 400));
    await nextTick();
    expect(document.querySelector(".hk-notification-center__empty")).toBeTruthy();
    expect(
      document.querySelector<HTMLElement>(".hk-notification-center__list")!.style.minHeight,
    ).toBe("");
  });

  it("a record landing on the open panel pops in through the list transition", async () => {
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "first" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    recordNotification({ id: "b", kind: "toast", tone: "warning", title: "second" });
    await nextTick();
    const fresh = rows().find((r) => r.textContent?.includes("second"));
    expect(fresh, "the new row rendered").toBeTruthy();
    expect(fresh!.className).toContain("hk-list-pop-enter-active");
    await settle();
    // Settled: the entrance classes resolved and the row stays.
    const settledRow = rows().find((r) => r.textContent?.includes("second"));
    expect(settledRow).toBeTruthy();
    expect(settledRow!.className).not.toContain("hk-list-pop-enter");
  });

  it("the first row into an empty open panel enters (0→1 through the primitive)", async () => {
    // The mirror of the leave pins: with the caption gone the very first
    // record must still ARRIVE through the choreography rather than
    // appearing already-settled.
    await setLocale("en");
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle();
    expect(document.querySelector(".hk-notification-center__empty")).toBeTruthy();
    recordNotification({ id: "first", kind: "toast", tone: "error", title: "the first one" });
    await nextTick();
    expect(document.querySelector(".hk-notification-center__empty")).toBeNull();
    const row = rows()[0];
    expect(row, "the row rendered").toBeTruthy();
    expect(row.className).toContain("hk-list-pop-enter-active");
    await settle();
    expect(rows()).toHaveLength(1);
  });

  it("opening the panel does NOT replay the list's entrance (appear stays off)", async () => {
    // `appear` would re-animate every row on every open — the panel is
    // opened constantly, so that would be noise, not feedback. Pinned
    // behaviourally (2026-11-20 review M6): the initial rows must mount
    // already settled.
    await setLocale("en");
    recordNotification({ id: "a", kind: "toast", tone: "error", title: "one" });
    recordNotification({ id: "b", kind: "toast", tone: "warning", title: "two" });
    mountBell();
    await settle();
    bellButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await nextTick();
    for (const row of rows()) {
      expect(row.className).not.toContain("hk-list-pop-enter");
    }
  });
});
