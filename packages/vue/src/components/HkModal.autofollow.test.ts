/**
 * Regression coverage for the HkModal auto-follow affordances.
 *
 * The 2026-08-27 model-log incident: the "Auto" chip and jump FAB existed
 * but never appeared because hasOverflow is only recomputed in settle
 * frames and scroll events — windowed bodies that grow *late* (async
 * chunks, virtualized mounts) tripped neither. kickSettle() must poll it.
 *
 * These tests exercise the exported hooks rather than a full DOM mount:
 * the component's internal state machine (isFollowing/hasOverflow) is
 * private, so we pin the two observable contracts:
 *   1. kickSettle re-evaluates overflow on its synchronous path — a body
 *      that overflows after mount gets its affordance without any user
 *      scroll.
 *   2. The render gate stays `hasOverflow && isFollowing` for the chip and
 *      `!isFollowing` for the FAB (follow ↔ cancel swap).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkModal.tsx"), "utf-8");

describe("HkModal auto-follow affordances", () => {
  it("recomputes overflow when the settle drain is kicked", () => {
    const fn = src.match(/function kickSettle\(\) \{([\s\S]*?)\n    \}/);
    expect(fn, "kickSettle() not found").toBeTruthy();
    // updateOverflow() must run before scheduling: late-growing windowed
    // bodies depend on this synchronous recheck.
    expect(fn![1]).toMatch(/updateOverflow\(\)/);
  });

  it("gates the Auto chip on real overflow and active follow", () => {
    const chip = src.match(/hasOverflow\.value && isFollowing\.value/);
    expect(chip, "Auto chip gate missing").toBeTruthy();
  });

  it("shows the jump FAB exactly when follow was cancelled", () => {
    const fab = src.match(/!isFollowing\.value && \(\s*\n?\s*<HFab/s);
    expect(fab, "jump FAB gate missing").toBeTruthy();
  });
});
