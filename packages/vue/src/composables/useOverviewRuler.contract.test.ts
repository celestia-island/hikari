/**
 * Source contract for the standalone overview ruler ("竖向瀑布流" minimap,
 * 2026-11-21 user direction): a STANDALONE attachment any scrollable
 * element can host — not a mode of the scrollbar — with customizable
 * direction and cursor behaviour.
 *
 * Pinned here:
 *   - exported from the barrel (usable by npm consumers, same as
 *     attachOverlayScrollbars);
 *   - the two cursor modes exist and the default is "jump" (strip click
 *     jumps then drags — 双向可拖动);
 *   - direction is a first-class option ("vertical" default, "horizontal"
 *     supported) with per-direction strip placement;
 *   - the guard: a viewport with no parent renders a no-op handle (same
 *     contract as attachOverlayScrollbars);
 *   - the SCSS defines the strip/cursor/bands chrome and per-side
 *     placement for both axes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const composable = readFileSync(join(here, "useOverviewRuler.ts"), "utf-8");
const barrel = readFileSync(join(here, "../index.ts"), "utf-8");
const scss = readFileSync(join(here, "../styles/overview-ruler.scss"), "utf-8");

describe("useOverviewRuler contract", () => {
  it("is exported from the barrel for npm consumers", () => {
    expect(barrel).toMatch(/attachOverviewRuler/);
    expect(barrel).toMatch(/OverviewRulerOptions|OverviewRulerHandle/);
  });

  it("cursor modes: jump is the default; thumb restricts dragging to the cursor", () => {
    expect(composable).toMatch(/cursorDrag \?\? "jump"/);
    expect(composable).toMatch(/OverviewRulerCursorMode = "jump" \| "thumb"/);
    expect(composable).toContain('if (!path.includes(cursor)) return;');
  });

  it("direction is a first-class option with per-side placement", () => {
    expect(composable).toMatch(/axis \?\? "vertical"/);
    expect(scss.match(/\[data-axis="vertical"\]/g)?.length).toBeGreaterThanOrEqual(1);
    expect(scss.match(/\[data-axis="horizontal"\]/g)?.length).toBeGreaterThanOrEqual(1);
    expect(scss).toContain('data-side="end"');
    expect(scss).toContain('data-side="start"');
  });

  it("no-host viewport renders a no-op handle", () => {
    expect(composable).toContain(
      "return { update() {}, setBands() {}, detach() {} };",
    );
  });

  it("strip/cursor/bands chrome exists with the placement contract", () => {
    expect(scss).toContain(".hk-overview-ruler {");
    expect(scss).toContain(".hk-overview-ruler-cursor {");
    expect(scss).toContain(".hk-overview-ruler-band {");
    expect(scss).toContain("touch-action: none;");
  });
});
