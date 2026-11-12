/**
 * Solid-fill ink rule — source contract (2026-11-12 user direction).
 *
 * House rule, perception-first:
 *   solid fill   → WHITE by default; BLACK only when the fill is light
 *                  (perceptual luminance above 0.65);
 *   translucent  → ride the theme text channel (never computed here).
 *
 * Why not "whichever side wins the WCAG ratio": across a 32-colour sweep of
 * shipped brand/semantic solids the ratio winner was BLACK on 84% of them,
 * while Radix, Bootstrap and Material all ship WHITE on saturated fills.
 * Maximising the ratio would therefore turn most tinted bands into black
 * ink — the opposite of the design intent and of the product-owner rule.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { solidInk, themePresets, tokensToCSSVars } from "./presets";

const WHITE = "255 255 255";
const BLACK = "0 0 0";
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "..", "components", "HkToast.scss"), "utf-8");

/**
 * The shipped fills and the ink the rule picks for each, asserted explicitly:
 * a rule that silently flipped its judgement is exactly what this guards.
 * The dark scheme is the Nord pair — its pale success/info fills are the
 * "designed for dark foreground" case (Radix's Mint/Lime/Sky, same idea),
 * so black there is correct, not a regression.
 */
const EXPECTED_INK: Array<{ mode: "light" | "dark"; tone: "danger" | "success" | "warning" | "info"; ink: string }> = [
  { mode: "light", tone: "danger", ink: WHITE },
  { mode: "light", tone: "success", ink: WHITE },
  { mode: "light", tone: "warning", ink: BLACK },
  { mode: "light", tone: "info", ink: WHITE },
  { mode: "dark", tone: "danger", ink: WHITE },
  { mode: "dark", tone: "success", ink: BLACK },
  { mode: "dark", tone: "warning", ink: WHITE },
  { mode: "dark", tone: "info", ink: BLACK },
];

/**
 * Ordinary semantic fills must read as white content — this is the "solid is
 * mostly white" half of the rule, and the one the product owner called out.
 * At the 0.65 cut these all fall on the white side; a future band edit that
 * flips one of them to black ink fails here.
 */
const MUST_STAY_WHITE: Array<["light" | "dark", "danger" | "success" | "warning" | "info"]> = [
  ["light", "danger"],
  ["light", "success"],
  ["light", "info"],
  ["dark", "danger"],
  ["dark", "warning"],
];

describe("solid-fill ink rule", () => {
  it("inks each shipped fill by its own lightness", () => {
    const light = tokensToCSSVars(themePresets.default.light);
    const dark = tokensToCSSVars(themePresets.default.dark);
    for (const { mode, tone, ink } of EXPECTED_INK) {
      const vars = mode === "light" ? light : dark;
      expect(vars[`--color-on-${tone}`], `${mode} ${tone} fill ink`).toBe(ink);
    }
  });

  it("uses white ink on every ordinary semantic fill in both schemes", () => {
    const light = tokensToCSSVars(themePresets.default.light);
    const dark = tokensToCSSVars(themePresets.default.dark);
    for (const [mode, tone] of MUST_STAY_WHITE) {
      const vars = mode === "light" ? light : dark;
      expect(vars[`--color-on-${tone}`], `${mode} ${tone} must stay white`).toBe(WHITE);
    }
  });

  it("derives each tone independently instead of from one global slot", () => {
    const vars = tokensToCSSVars({
      ...themePresets.default.light,
      // A deliberately pale fill beside a saturated one: one global slot
      // could not serve both.
      warning: { r: 250, g: 235, b: 150 },
      error: { r: 180, g: 30, b: 40 },
    });
    expect(vars["--color-on-warning"]).toBe(BLACK);
    expect(vars["--color-on-danger"]).toBe(WHITE);
  });

  it("lets a theme override any single tone ink", () => {
    const vars = tokensToCSSVars({
      ...themePresets.default.light,
      onInfo: { r: 0, g: 0, b: 0 },
    });
    expect(vars["--color-on-info"]).toBe(BLACK);
    // The override is per tone: its neighbours keep their own judgement.
    expect(vars["--color-on-danger"]).toBe(WHITE);
  });

  it("exposes the per-tone ink to the semantic aliases components read", () => {
    const vars = tokensToCSSVars(themePresets.default.light);
    for (const tone of ["danger", "success", "warning", "info"] as const) {
      expect(vars[`--hi-color-text-on-${tone}`]).toBe(`rgb(var(--color-on-${tone}))`);
    }
  });

  it("honours tone ink slots carried by a saved theme", () => {
    // The scheme editor writes the optional slots into the saved theme, so a
    // reload must keep them; a slot an old prefill omits keeps deriving from
    // the fill instead of freezing whatever white the picker happened to show.
    const reloaded = tokensToCSSVars({
      ...themePresets.default.light,
      onWarning: { r: 12, g: 34, b: 56 },
    });
    expect(reloaded["--color-on-warning"]).toBe("12 34 56");
    const derived = solidInk(themePresets.default.light.error);
    expect(reloaded["--color-on-danger"]).toBe(derived.r + " " + derived.g + " " + derived.b);
  });
});

/**
 * The toast bands must ink themselves from their own tone — the regression
 * was copy/close glyphs riding the page ink (or a global slot) on a tinted band.
 */
describe("toast band ink wiring contract", () => {
  const WIRING: Array<[string, string]> = [
    ["error", "danger"],
    ["success", "success"],
    ["info", "info"],
    ["loading", "info"],
    ["warning", "warning"],
  ];

  it("inks every band and its controls from the matching per-tone token", () => {
    for (const [variant, tone] of WIRING) {
      expect(scss, `.hk-toast-${variant} band ink`).toMatch(
        new RegExp(`\\.hk-toast-${variant}\\s*\\{[^}]*color: var\\(--hi-color-text-on-${tone}`),
      );
      expect(scss, `.hk-toast-${variant} control ink`).toMatch(
        new RegExp(
          `\\.hk-toast-${variant} \\.hk-toast-copy-btn[^{}]*\\{[^}]*--hi-icon-button-icon-color: var\\(--hi-color-text-on-${tone}`
        ),
      );
    }
  });

  it("never inkes a tinted band control from the page text channel", () => {
    for (const variant of ["error", "success", "info", "loading", "warning"]) {
      const m = scss.match(
        new RegExp(`\\.hk-toast-${variant} \\.hk-toast-copy-btn[^{}]*\\{[^}]*\\}`),
      );
      expect(m, `${variant} control block`).not.toBeNull();
      expect(m![0]).not.toContain("--hi-color-text-secondary");
    }
  });
});

/**
 * The static :root seeds must agree with the rule. A host that loads the
 * stylesheet but never applies a runtime theme renders straight from these
 * values, so a seed contradicting solidInk shows the wrong ink (white
 * glyphs on the pale amber warning band, 2026-11-12). Checked against both
 * copies — the vendored channels.scss is generated from tokens.scss, so
 * drifting seeds mean the sync step was skipped.
 */
describe("static seed matches the solidInk rule", () => {
  const TONE_FILL: Record<"danger" | "success" | "warning" | "info", string> = {
    danger: "error",
    success: "success",
    warning: "warning",
    info: "info",
  };

  const seedRGB = (file: string, name: string): [number, number, number] => {
    const m = file.match(new RegExp(`--color-${name}: (\\d+) (\\d+) (\\d+);`));
    expect(m, `--color-${name} seed`).not.toBeNull();
    return [Number(m![1]), Number(m![2]), Number(m![3])];
  };

  for (const path of ["tokens.scss", join("styles", "theme", "channels.scss")]) {
    it(`seeds each on-tone ink to what solidInk derives from the ${path} fills`, () => {
      const file = readFileSync(join(here, "..", ...path.split("/")), "utf-8");
      for (const tone of ["danger", "success", "warning", "info"] as const) {
        const [r, g, b] = seedRGB(file, TONE_FILL[tone]);
        const ink = solidInk({ r, g, b });
        expect(
          seedRGB(file, `on-${tone}`).join(" "),
          `${path} --color-on-${tone} vs solidInk(${TONE_FILL[tone]} seed)`,
        ).toBe(`${ink.r} ${ink.g} ${ink.b}`);
      }
    });
  }
});
