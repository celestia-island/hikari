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
    // The only action a row may fire is the journal-carried callback.
    expect(src).toContain("onResummon?.()");
    // No direct emergency/toast import here — resummon must ride the
    // journal entry, or replay semantics would fork.
    expect(src).not.toContain("useEmergencyAlert");
    expect(src).not.toContain("unsnoozeEmergencyAlert");
    expect(src).not.toContain("useToast");
  });

  it("the journal is the ONLY data source", () => {
    const src = body();
    expect(src).toContain("useNotificationCenter");
    // No private storage reading — persistence belongs to the context.
    expect(src).not.toContain("sessionStorage");
    expect(src).not.toContain("localStorage");
  });
});
