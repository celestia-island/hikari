import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { listCssAnimations } from "../animation/registerAnimations";

/**
 * Source contract for the identify card's load-bearing look (the chest
 * v4 wave pinned the same rules before the card was upstreamed): a
 * LARGE SQUARE, fixed-light surface with a BLACK theme-independent
 * number, corner badges, one viewport-clamped room-readable numeral and
 * hikari tokens everywhere else. vitest cannot see stylesheets, so a
 * deleted rule would leave every DOM guard green.
 */
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkScreenIdentifyCard.scss"), "utf8");

/** The DECLARATIONS of a top-level class rule, comments stripped (a
 *  comment that names a property must not satisfy a guard about it). */
function ruleBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(scss);
  if (!match) throw new Error(`no rule for ${selector}`);
  return match[1]
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("/*"))
    .join("\n");
}

describe("HkScreenIdentifyCard layout contract", () => {
  it("is a large square card with a viewport-clamped width", () => {
    const card = ruleBlock(".hk-screen-identify");
    expect(card).toMatch(/aspect-ratio:\s*1/);
    expect(card).toMatch(/width:\s*clamp\(96px,\s*18vw,\s*160px\)/);
    // A HUD never intercepts the window it annotates.
    expect(card).toMatch(/pointer-events:\s*none/);
  });

  it("keeps the fixed light surface and the black number", () => {
    const card = ruleBlock(".hk-screen-identify");
    // A themed surface would swallow the black number in dark mode.
    expect(card).toMatch(/background:\s*rgb\(255 255 255/);
    const num = ruleBlock(".hk-screen-identify-num");
    expect(num).toMatch(/color:\s*#000/);
    expect(num).not.toMatch(/--color-/);
  });

  it("keeps the name and countdown as corner badges on the card", () => {
    for (const badge of [".hk-screen-identify-count", ".hk-screen-identify-name"]) {
      expect(ruleBlock(badge)).toMatch(/position:\s*absolute/);
    }
  });

  it("parks the card in every corner through placement attributes", () => {
    for (const placement of ["bottom-right", "top-left", "top-right"]) {
      expect(scss).toContain(`&[data-placement="${placement}"]`);
    }
    // Left/right use logical properties so RTL mirrors the pair while
    // the card stays at the same corner of the glass.
    expect(ruleBlock(".hk-screen-identify")).toMatch(/inset-inline-start:/);
  });

  it("rides hikari text tokens for every font size except the numeral", () => {
    const raw = [...scss.matchAll(/font-size:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(raw.length).toBeGreaterThan(1);
    const nonToken = raw.filter((value) => !/^var\(--text-/.test(value));
    // The room-readable numeral is the ONE intentional clamp() beyond
    // the token scale (which stops at heading sizes).
    expect(nonToken).toHaveLength(1);
    expect(nonToken[0]).toMatch(/^clamp\(/);
    expect(ruleBlock(".hk-screen-identify-num")).toContain(nonToken[0]);
  });

  it("sits on the HUD ordinal band and honours reduced motion", () => {
    expect(ruleBlock(".hk-screen-identify")).toMatch(
      /z-index:\s*var\(--hk-overlay-z-hud/,
    );
    expect(scss).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(scss).toContain("animation: none;");
  });

  it("registers its entrance animation in the CSS animation registrar", () => {
    const names = listCssAnimations().map((entry) => entry.name);
    expect(names).toContain("hk-screen-identify-in");
    expect(scss).toContain("@keyframes hk-screen-identify-in");
  });
});
