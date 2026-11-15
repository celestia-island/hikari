/**
 * Source contract: the theme panel rows use a PERSISTENT action lane.
 * The default "overlay" mode parks the edit/delete actions out of flow
 * and covers the row's right content on hover — which swallowed the
 * plugin badge on plugin-sourced themes (2026-11-14 user screenshot:
 * the SquarePen edit button covering the badge on Arcaea). Persistent
 * keeps the lane in the flow: badge and actions coexist, nothing gets
 * covered.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkThemePanelContent.tsx"), "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

describe("HkThemePanelContent action lane contract", () => {
  it("pins persistent action lane on the theme rows", () => {
    expect(src).toContain('actionsMode="persistent"');
  });
});
