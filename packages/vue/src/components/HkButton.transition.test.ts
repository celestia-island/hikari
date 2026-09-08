/**
 * Source contract for the HkButton transition declaration (2026-09-08 scan
 * wave 2, finding F5).
 *
 * The former comma-separated shorthand
 * `transition: background-color, ..., filter var(--duration-normal) ...`
 * declared one transition PER property where only the LAST carried the
 * duration/easing — every property but `filter` animated at 0s and hover
 * color/border/background snapped instead of fading (hosts kept patching
 * over it; chest's deleted .hk-btn-ghost override was one). Pinned here so
 * the malformed shorthand cannot silently return.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "HkButton.scss"), "utf-8");
// Comments stripped before the negative assertion: the explanatory comment
// intentionally QUOTES the old malformed shorthand, and this contract is
// about live CSS, not prose.
const css = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

describe("HkButton transition contract", () => {
  it("declares the transition in longhand with one shared duration/easing", () => {
    expect(src).toContain(
      "transition-property: background-color, border-color, color, box-shadow, opacity, transform, filter;"
    );
    expect(src).toContain("transition-duration: var(--duration-normal);");
    expect(src).toContain("transition-timing-function: var(--ease-standard);");
  });

  it("does not regress to the malformed comma-separated shorthand", () => {
    expect(css).not.toMatch(/transition:\s*background-color,/);
  });
});
