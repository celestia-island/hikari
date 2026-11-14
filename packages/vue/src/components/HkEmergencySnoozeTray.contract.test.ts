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

  it("restore goes through the context, not ad-hoc state", () => {
    expect(tsx).toMatch(/unsnoozeEmergencyAlert\(item\.id\)/);
  });
});
