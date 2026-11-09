import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Source contract for the click-trigger confirm surface. vitest cannot see
 * stylesheets, and the load-bearing bit is a NEGATIVE one: the hover bubble
 * must stay pointer-transparent (it can never eat the pointer that summoned
 * it), while the click popup must take events only while visible — the node
 * survives a close, so an armed hidden box would swallow clicks in its last
 * footprint.
 */
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkTooltip.scss"), "utf8");

function ruleBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(scss);
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1]!
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("//");
    })
    .join("\n");
}

describe("HkTooltip click-trigger sheet contract", () => {
  it("keeps the hover bubble pointer-transparent (annotation, not a control)", () => {
    expect(ruleBlock(".hk-tooltip-popup")).toMatch(/pointer-events:\s*none/);
  });

  it("arms pointer events on the click popup only while visible", () => {
    expect(ruleBlock(".hk-tooltip-popup--click")).toMatch(/pointer-events:\s*none/);
    expect(ruleBlock(".hk-tooltip-popup--click.hk-tooltip-visible")).toMatch(
      /pointer-events:\s*auto/,
    );
  });

  it("weights the confirm title and leaves the actions room", () => {
    const rule = ruleBlock(".hk-tooltip-popup--click .hk-tooltip-content");
    expect(rule).toMatch(/font-weight:\s*600/);
    expect(rule).toMatch(/margin-block-end:\s*var\(--space-6\)/);
  });

  it("rings the focused dialog surface", () => {
    const rule = ruleBlock(".hk-tooltip-popup--click:focus-visible");
    expect(rule).toMatch(/outline:\s*2px solid rgb\(var\(--color-primary\)\)/);
  });
});
