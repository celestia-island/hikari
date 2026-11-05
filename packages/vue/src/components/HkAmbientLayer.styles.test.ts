import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * HkAmbientLayer layout contract (R2 S2): the layer spans the viewport so
 * slot children can position themselves against the screen edges, which
 * means the WRAPPER must never take pointer input — enabling it there
 * would make a transparent full-screen div swallow every click on the
 * page. The `pointerEvents="auto"` opt-in therefore targets the slot
 * children only.
 */
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkAmbientLayer.scss"), "utf8");

/** Comments stripped: a comment naming a property must not satisfy a
 *  guard about it. */
const declarations = scss.replace(/\/\/[^\n]*/g, "");

describe("HkAmbientLayer pointer contract", () => {
  it("spans the viewport but stays a pointer ghost", () => {
    expect(declarations).toMatch(/position:\s*fixed;/);
    expect(declarations).toMatch(/inset:\s*0;/);
    expect(declarations).toMatch(/pointer-events:\s*none;/);
  });

  it("opt-in pointer events target the slot children, not the wrapper", () => {
    // The auto declaration must live inside the CHILD-scoped block. This
    // is the S2 footgun: a transparent full-viewport wrapper with
    // pointer-events:auto swallows every page click.
    const autoAt = declarations.indexOf("pointer-events: auto");
    expect(autoAt).toBeGreaterThan(-1);
    const blockStart = declarations.lastIndexOf('[data-pointer-events="auto"]', autoAt);
    expect(blockStart).toBeGreaterThan(-1);
    expect(declarations.slice(blockStart, autoAt)).toContain("> *");
    // EVERY auto occurrence must live in that child-scoped block — an
    // earlier round flagged a guard that only pinned the FIRST one, so a
    // second stray auto elsewhere slipped through.
    for (const match of declarations.matchAll(/pointer-events:\s*auto/g)) {
      const at = match.index ?? -1;
      const scopeStart = declarations.lastIndexOf('[data-pointer-events="auto"]', at);
      expect(scopeStart).toBeGreaterThan(-1);
      expect(declarations.slice(scopeStart, at)).toContain("> *");
    }
    // The wrapper's own block states the ghost rule exactly once.
    expect(declarations.match(/pointer-events:\s*none/g)).toHaveLength(1);
  });

  it("sits on the HUD ordinal band, below its root's document elevation", () => {
    expect(declarations).toMatch(/z-index:\s*var\(--hk-overlay-z-hud/);
  });
});
