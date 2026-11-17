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
import type { ThemeTokenRGB } from "./presets";

const WHITE = "255 255 255";
const BLACK = "0 0 0";
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "..", "components", "HkToast.scss"), "utf-8");

/**
 * The shipped fills and the ink the rule picks for each, asserted explicitly:
 * a rule that silently flipped its judgement is exactly what this guards.
 * Since the canonical-family move the shipped fills are identical in both
 * schemes and dark enough to take white everywhere — the table asserts that
 * uniformity.
 */
// The shipped semantic quartet is the SHARED canonical family (solid fills
// ignore the mode, user direction) — dark enough (gamma-lum 0.27-0.32) that
// every slot takes the house WHITE ink in BOTH schemes.
const EXPECTED_INK: Array<{ mode: "light" | "dark"; tone: "danger" | "success" | "warning" | "info"; ink: string }> = [
  { mode: "light", tone: "danger", ink: WHITE },
  { mode: "light", tone: "success", ink: WHITE },
  { mode: "light", tone: "warning", ink: WHITE },
  { mode: "light", tone: "info", ink: WHITE },
  { mode: "dark", tone: "danger", ink: WHITE },
  { mode: "dark", tone: "success", ink: WHITE },
  { mode: "dark", tone: "warning", ink: WHITE },
  { mode: "dark", tone: "info", ink: WHITE },
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
  ["light", "warning"],
  ["dark", "danger"],
  ["dark", "success"],
  ["dark", "warning"],
  ["dark", "info"],
];

describe("solid-fill ink rule", () => {
  it("uses the house 0.65 threshold (not the legacy 0.55)", () => {
    // #A3A3A3 γlum = 0.6400: the 0.65 house rule says WHITE (≤0.65), while
    // the rejected 0.55 rule would say BLACK (>0.55).
    const fill: ThemeTokenRGB = { r: 0xa3, g: 0xa3, b: 0xa3 };
    const ink = solidInk(fill);
    expect(ink).toEqual({ r: 255, g: 255, b: 255 });
    // #A6A6A6 γlum = 0.6587 > 0.65 → black.
    const above: ThemeTokenRGB = { r: 0xa6, g: 0xa6, b: 0xa6 };
    expect(solidInk(above)).toEqual({ r: 0, g: 0, b: 0 });
  });

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

  // The tag/link components paint the semantic slots as TEXT on a 10% tint
  // of the fill over the page — NOT on the solid fill. The runtime must
  // therefore expose a page/tint-readable fg variant per tone, and the tag
  // sheet must use it (never the raw fill: a fill used as text on a dark
  // page measures ~1.1:1). Computed here against the actual composite so the
  // pin is a readability guarantee, not an existence check.
  it("tag text reads on its 10% tint (the fg variant is real)", () => {
    // The canonical family is now the shipped default (light mode; the dark
    // preset carries the same solid fills per the mode-independence rule).
    const tokens = tokensToCSSVars(themePresets.default.light);
    const parse = (name: string): [number, number, number] => {
      const m = tokens[name]?.match(/(\d+) (\d+) (\d+)/);
      expect(m, `${name} emitted`).not.toBeNull();
      return [Number(m![1]), Number(m![2]), Number(m![3])];
    };
    const ratio = (a: [number, number, number], b: [number, number, number]) => {
      const lum = (c: [number, number, number]) => {
        const f = (v: number) => {
          const x = v / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
      };
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const bg = parse("--color-background");
    for (const tone of ["success", "danger", "warning", "info"] as const) {
      const fill = parse(`--color-${TONE_FILL[tone]}`);
      const fg = parse(`--hi-color-${tone}-fg`);
      // The chip background is a 10% tint of the fill over the page.
      const tint = fill.map((v, i) => Math.round(v * 0.1 + bg[i] * 0.9)) as [number, number, number];
      expect(
        ratio(fg, tint),
        `--hi-color-${tone}-fg must read on the ${tone} tint`,
      ).toBeGreaterThanOrEqual(4.5);
    }
    // And the sheet must use the fg var, not the raw fill as text.
    const hkTag = readFileSync(join(here, "..", "components", "HkTag.scss"), "utf-8");
    for (const tone of ["success", "danger", "warning"] as const) {
      expect(
        hkTag.includes(`--hi-color-${tone}-fg`),
        `HkTag.scss .hk-tag-${tone} paints --hi-color-${tone}-fg`,
      ).toBe(true);
      // The negative pin needs a runtime RegExp: a template literal inside
      // regex delimiters compiles the un-interpolated "+ tone +" text.
      const rawFill = new RegExp(
        `\\.hk-tag-${tone}\\s*\\{[^}]*color:\\s*var\\(--hi-color-${tone}[,)]`,
      );
      expect(rawFill.test(hkTag), `.hk-tag-${tone} must not paint the raw fill`).toBe(false);
    }
  });

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
