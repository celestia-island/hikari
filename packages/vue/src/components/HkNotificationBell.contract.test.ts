import { describe, expect, it } from "vitest";

import componentSource from "./HkNotificationBell.tsx?raw";

/**
 * Composition contract for the notification bell (the
 * HEmergencySnoozeTray.contract.test.ts shape): read the component's
 * own source and pin the structural decisions that make the bell ONE
 * grammar with the rest of the chrome — deviations here are exactly
 * how a second notification UI grows next to the first one.
 */
function body(): string {
  // Strip comments so prose can never satisfy a contract.
  return componentSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("HkNotificationBell composition contract", () => {
  it("the surface IS HkPopover with sheetOnMobile — no bespoke popup markup", () => {
    const src = body();
    expect(src).toContain("HkPopover");
    expect(src).toContain("sheetOnMobile");
    // No hand-rolled overlay/teleport/scrim in this component.
    expect(src).not.toContain("Teleport");
    expect(src).not.toContain("ensureOverlayRoot");
    expect(src).not.toContain("scrim");
  });

  it("the trigger IS HkIconButton on the chrome ladder", () => {
    const src = body();
    expect(src).toContain("HkIconButton");
    expect(src).toContain("useChromeActionSize");
    // The unread mark is the button's OWN dot (2026-10-28 ruling), not
    // a wrapper badge around the trigger.
    expect(src).toContain("dot=");
    expect(src).toContain("dotLabel");
    expect(src).not.toContain("HkCornerBadge");
  });

  it("open IS the read receipt — markAllRead rides the open flag", () => {
    const src = body();
    expect(src).toContain("markAllRead");
    expect(src).toContain("watch(open");
  });

  it("restore is REPLAY-FREE except the entry's own resummon path", () => {
    const src = body();
    // The only action a row may fire is the journal-carried callback,
    // gated on the SNOOZED state (an on-screen band has nothing to
    // restore — R2 finding, PR #1322).
    expect(src).toContain("onResummon?.()");
    expect(src).toContain('entry.state === "snoozed"');
    // No direct emergency/toast import here — resummon must ride the
    // journal entry, or replay semantics would fork.
    expect(src).not.toContain("useEmergencyAlert");
    expect(src).not.toContain("unsnoozeEmergencyAlert");
    expect(src).not.toContain("useToast");
  });

  it("the hold timer is released when the bell goes away", () => {
    const src = body();
    // Round-5 finding, M10: dropping the unmount cleanup stayed green
    // repo-wide. A source pin (the same convention the rest of this file
    // uses): the timer-queue cannot isolate OUR timer from the primitive's
    // transition report, so the structural fact is pinned here, and the
    // behaviour it protects is "no write into a dead instance".
    const unmountPath = src.slice(src.indexOf("onUnmounted("));
    expect(unmountPath, "an unmount hook exists").not.toBe("");
    expect(unmountPath).toContain("clearTimeout(holdTimer)");
  });

  it("the journal is the ONLY data source", () => {
    const src = body();
    expect(src).toContain("useNotificationCenter");
    // No private storage reading — persistence belongs to the context.
    expect(src).not.toContain("sessionStorage");
    expect(src).not.toContain("localStorage");
  });

  it("row add/remove animates through HkListTransition on the animation context", () => {
    const src = body();
    // The rows ride the library's own list choreography primitive — the
    // `pop` variant with FLIP moves — which reports every enter/leave
    // batch to the runtime animation bus itself. No second transition
    // implementation may grow beside it (the same rule that keeps a
    // second notification UI from growing beside the bell).
    //
    // The props are pinned ON THE PRIMITIVE'S OWN OPENING TAG, not as bare
    // substrings: a `toMatch(/\bmove\b/)` over the whole file is satisfied
    // by any unrelated token, and a file-level `not.toContain("appear")`
    // would fail a legitimate `appear={false}` (2026-11-20 review).
    const usage = src.match(/<HkListTransition[\s\S]*?>/);
    expect(usage, "the primitive is used here").toBeTruthy();
    const tag = usage![0];
    expect(tag).toContain('tag="ul"');
    expect(tag).toContain('variant="pop"');
    expect(tag, "FLIP moves for the surviving rows").toMatch(/\bmove\b/);
    // `appear` would replay the whole list's entrance on every open.
    // (jsdom applies no stylesheets, so FLIP/appear have no behavioural
    // observable — this is a deliberate source-level pin, backed by the
    // behaviour test "opening the panel does NOT replay the list's
    // entrance".)
    expect(tag).not.toMatch(/\bappear\b/);
    expect(src).not.toContain("TransitionGroup");
    expect(src).not.toContain("useSurfaceTransition");
    // The list wrap outlives the empty swap — a torn-down group cancels
    // its ghosts mid-flight, so the empty caption must live INSIDE the
    // wrap (after the group), not in a branch that replaces it.
    expect(src.indexOf("hk-notification-center__list-wrap")).toBeLessThan(
      src.indexOf("hk-notification-center__empty"),
    );
  });
});
