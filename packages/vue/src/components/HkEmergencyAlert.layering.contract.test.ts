/**
 * Source contract: the emergency takeover is a document-space top
 * owner with TWO legs (the same contract HkModal rides, pinned by
 * chromeBand.contract tests on the chest side):
 *
 *  1. z leg — `var(--hk-z-emergency, 96000)` sits above the error
 *     landing (95000) and strictly below the window titlebar
 *     (100001): the band demands attention but must NEVER cover the
 *     titlebar (user direction 2026-11-13).
 *  2. geometry leg — the layer insets below the host chrome band via
 *     `var(--hk-chrome-band-inset, 0px)` so a native shell's titlebar
 *     strip stays visible, draggable and clickable.
 *
 * Plus the width and blocking doctrines: the band spans edge to edge
 * (no viewport gutter — user direction 2026-11-13) and the layer
 * itself is pointer-transparent (only the band intercepts), so the
 * emergency never blocks work happening underneath.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function sheet(): string {
  const raw = readFileSync(join(here, "HkEmergencyAlert.scss"), "utf-8");
  // Full-line `//` comments are stripped before ANY assertion (the
  // registerAnimations parity convention): a commented-out declaration
  // is not a declaration — R5 B1 deleted the root pointer-events line
  // and left `// pointer-events: none;` behind, and every contains()
  // here happily read the comment as the declaration.
  return raw.replace(/^[ \t]*\/\/.*$/gm, "");
}

/** The `.hk-emergency { … }` root rule, brace-balanced (it nests the
 *  webkit scrollbar rule). Assertions about the LAYER must bind here,
 *  not to the whole sheet: the band's pseudo-elements carry their own
 *  `pointer-events: none` lines, which a whole-file contains() would
 *  happily satisfy even with the root declaration deleted (R3 M6).
 *  Comment-blindness is handled upstream in sheet() — stripping here
 *  as well would double-handle; braces inside comments were the other
 *  R5 hazard, and they are gone before the walk runs. */
function rootBlock(css: string): string {
  const start = css.indexOf(".hk-emergency {");
  if (start < 0) throw new Error("root rule .hk-emergency { not found");
  let depth = 0;
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error("unbalanced braces in .hk-emergency root rule");
}

describe("emergency alert layering contract", () => {
  it("pins the document-space z band between error landing and titlebar", () => {
    const css = sheet();
    expect(css).toContain("z-index: var(--hk-z-emergency, 96000);");
  });

  it("pins the chrome-band geometry leg on the top edge", () => {
    const css = sheet();
    expect(css).toContain("inset: var(--hk-chrome-band-inset, 0px) 0 0 0;");
  });

  it("the band spans the full width — no viewport gutter on it", () => {
    const css = sheet();
    // The band (not the reading column) is width:100%…
    expect(css).toContain("width: 100%;");
    // …and the sheet never insets the band from the screen edges.
    expect(css).not.toMatch(/inset-inline-(start|end):\s*var\(--viewport-gutter/);
  });

  it("the layer is pointer-transparent; only the band is interactive", () => {
    const css = sheet();
    // Root rule: transparent (the scrim never blocks work) — bound to
    // the ROOT block because the band pseudo-elements also carry
    // pointer-events:none lines that would mask its deletion (M6).
    expect(rootBlock(css)).toContain("pointer-events: none;");
    expect(rootBlock(css)).not.toContain("pointer-events: auto;");
    // …and exactly ONE rule in the whole sheet opts back in — the band.
    expect(css.match(/pointer-events:\s*auto;/g)?.length).toBe(1);
  });

  it("long content stays reachable: the layer scrolls and the band safe-centers", () => {
    // A fixed full-height layer never grows the document, so clipped
    // content would strand the actions forever (R2 finding 5). The
    // layer must scroll, and the band must center via margin-block
    // (align-items:center on the LAYER clips both ends with no way
    // back; the icon/actions rows may still center their own content).
    const css = sheet();
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("margin-block: auto;");
    expect(css).not.toMatch(/\.hk-emergency\s*\{[^}]*align-items\s*:/s);
  });
});
