/**
 * Source contract: the snooze tray is COMPOSITION, not a bespoke chip.
 * Its chips are HkPersistentToast (severity tone, label, detail card)
 * inside HkPersistentToastGroup (the "+N" counter) — the same members
 * every chrome bar uses. A hand-rolled chip markup here would fork the
 * chrome-bar chip language (2026-11-14 user direction: upstream
 * components only, glue is the tray's whole job).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const tsx = readFileSync(join(here, "HkEmergencySnoozeTray.tsx"), "utf-8")
  .replace(/^[ \t]*\/\/.*$/gm, "");

describe("emergency snooze tray composition contract", () => {
  it("composes upstream chip members instead of hand-rolling", () => {
    expect(tsx).toMatch(/import HkPersistentToast from ".\/HkPersistentToast";/);
    expect(tsx).toMatch(/import HkPersistentToastGroup from ".\/HkPersistentToastGroup";/);
    expect(tsx).toMatch(/<HkPersistentToastGroup maxVisible={/);
    expect(tsx).toMatch(/<HkPersistentToast\n/);
    // No bespoke chip surface: no element carrying the chip's own class.
    expect(tsx).not.toMatch(/class=["'][^"']*hk-persistent-toast(?!-group)/);
  });

  it("the detail card mirrors the toast text — no restore affordance here", () => {
    // 2026-11-15 user ruling: the bell panel owns restore (each snoozed
    // bell row carries the armed unsnooze button). The tray's hover card
    // must not re-create it — that was the "添油加醋" the ruling retired,
    // and a second restore home beside the bell's would fork the path.
    expect(tsx).not.toMatch(/unsnoozeEmergencyAlert/);
    expect(tsx).not.toMatch(/HkButton/);
    // The card still mirrors the original toast's text surface:
    expect(tsx).toContain("hk-emergency-snooze-card__title");
    expect(tsx).toContain("hk-emergency-snooze-card__desc");
  });
});
