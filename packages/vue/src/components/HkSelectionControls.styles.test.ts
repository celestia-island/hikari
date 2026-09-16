import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the three selection controls
 * (HkCheckbox / HkRadio / HkSwitch).
 *
 * Vitest stubs CSS, so the behavioral suites can never catch a geometry or
 * alignment fact drifting. This guard compiles the three sheets and pins
 * the facts the 2026-09 alignment/size fix introduced:
 *
 *   1. inline-in-text alignment: every control root declares
 *      `vertical-align: middle` (baseline parked the inline-flex's bottom
 *      edge on the text baseline, riding the box ~4–7px above the text's
 *      visual center — measured in headless Chrome).
 *   2. checkbox box scale: the box follows the sm/md/lg size modifiers
 *      (it previously ignored `size` entirely and rendered an md box in
 *      lg rows), matching HkRadio's box scale.
 *   3. switch geometry: the track/thumb grew (md 44×24 track, 20px thumb)
 *      and the checked travel stays exactly `track − 2×inset − thumb` per
 *      size, so the thumb can never detach from either pill edge.
 *   4. interaction faces: hover/press feedback exists on all three
 *      (checkbox hover was missing entirely; radio hover had no press
 *      twin) and the off track is a filled neutral, not a bare surface.
 *
 * The rules below are parsed out of the COMPILED css (not the .scss
 * source) so a rule that fails to compile can never count as present.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

interface Rule {
  selector: string;
  body: string;
}

/** Flat-rule splitter for the expanded output of these leaf sheets. */
function rules(css: string): Rule[] {
  // Expanded output keeps loud comments, and sheets containing non-ASCII
  // text get a braille-less `@charset "UTF-8";` statement — both would glue
  // onto the next selector and shift every rule pair, so strip them first.
  const bare = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@charset[^;]*;/g, "")
    .trim();
  const out: Rule[] = [];
  for (const match of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1]!.trim();
    // Keep control rules; the rtl mirrors lead with an attribute selector.
    if (!selector.startsWith(".hk-") && !selector.startsWith("[dir=")) continue;
    out.push({ selector, body: match[2]! });
  }
  return out;
}

function find(all: Rule[], selector: string): Rule {
  const hit = all.find((r) => r.selector === selector);
  expect(hit, `compiled rule for \`${selector}\``).toBeDefined();
  return hit!;
}

/** `2.25rem` / `14px` / `-1rem` → signed px number (1rem = 16px; bare numbers = rem). */
function toPx(decl: string): number {
  const m = decl.match(/(-?[\d.]+)(rem|px)?$/);
  expect(m, `length in "${decl}"`).not.toBeNull();
  const value = parseFloat(m![1]!);
  return m![2] === "px" ? value : value * 16;
}

function valueOf(body: string, prop: string): string {
  const m = body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
  expect(m, `declaration \`${prop}\``).not.toBeNull();
  return m![1]!.trim();
}

const checkbox = rules(compile(resolve(componentDir, "HkCheckbox.scss"), { style: "expanded" }).css);
const radio = rules(compile(resolve(componentDir, "HkRadio.scss"), { style: "expanded" }).css);
const sw = rules(compile(resolve(componentDir, "HkSwitch.scss"), { style: "expanded" }).css);

describe("selection controls inline alignment", () => {
  it.each([
    ["HkCheckbox", checkbox, ".hk-checkbox"],
    ["HkRadio", radio, ".hk-radio"],
    ["HkSwitch", sw, ".hk-switch"],
  ])("%s root declares vertical-align: middle", (_name, all, selector) => {
    expect(valueOf(find(all, selector).body, "vertical-align")).toBe("middle");
  });
});

describe("HkCheckbox box scale follows the size modifier", () => {
  const cases: Array<[string, string, number]> = [
    ["base (md)", ".hk-checkbox-box", 18],
    ["sm", ".hk-checkbox-sm .hk-checkbox-box", 14],
    ["lg", ".hk-checkbox-lg .hk-checkbox-box", 22],
  ];
  it.each(cases)("%s box is %ipx", (_name, selector, px) => {
    const body = find(checkbox, selector).body;
    expect(toPx(valueOf(body, "width"))).toBe(px);
    expect(toPx(valueOf(body, "height"))).toBe(px);
  });

  it.each([
    ["sm", ".hk-checkbox-sm .hk-checkbox-icon", 11],
    ["md base", ".hk-checkbox-icon", 14],
    ["lg", ".hk-checkbox-lg .hk-checkbox-icon", 16],
  ])("%s check icon is %ipx", (_name, selector, px) => {
    const body = find(checkbox, selector).body;
    expect(toPx(valueOf(body, "width"))).toBe(px);
  });

  it("hover paints the primary edge on an unchecked box (HkRadio parity)", () => {
    const body = find(
      checkbox,
      ".hk-checkbox:not([data-disabled]):hover .hk-checkbox-box:not([data-checked]):not([data-indeterminate])",
    ).body;
    expect(valueOf(body, "border-color")).toContain("--hi-color-primary");
  });

  it("press squish on the box via the independent scale property", () => {
    const body = find(checkbox, ".hk-checkbox:not([data-disabled]):active .hk-checkbox-box").body;
    expect(valueOf(body, "scale")).toBe("0.9");
    // The squish only composes cleanly if the box transitions `scale`.
    expect(valueOf(find(checkbox, ".hk-checkbox-box").body, "transition")).toContain("scale");
  });
});

describe("HkRadio interaction parity", () => {
  it("press squish on the box via the independent scale property", () => {
    const body = find(radio, ".hk-radio:not([data-disabled]):active .hk-radio-box").body;
    expect(valueOf(body, "scale")).toBe("0.9");
    expect(valueOf(find(radio, ".hk-radio-box").body, "transition")).toContain("scale");
  });
});

describe("HkSwitch geometry", () => {
  const geometry: Array<[string, number, number, number]> = [
    // [size, track width, track height, thumb width]
    ["sm", 36, 20, 16],
    ["md", 44, 24, 20],
    ["lg", 52, 28, 24],
  ];

  it.each(geometry)("%s track is %ipx wide", (size, w, h) => {
    const body = find(sw, `.hk-switch-${size} .hk-switch-track`).body;
    expect(toPx(valueOf(body, "width"))).toBe(w);
    expect(toPx(valueOf(body, "height"))).toBe(h);
  });

  it.each(geometry)("%s thumb is %ipx", (size, _w, _h, thumb) => {
    const body = find(sw, `.hk-switch-${size} .hk-switch-thumb`).body;
    expect(toPx(valueOf(body, "width"))).toBe(thumb);
    expect(toPx(valueOf(body, "height"))).toBe(thumb);
  });

  it.each(geometry)(
    "%s checked travel keeps the thumb inside both pill edges",
    (size, trackW, _trackH, thumb) => {
      const body = find(sw, `.hk-switch-${size}[data-checked] .hk-switch-thumb`).body;
      const inset = toPx(valueOf(find(sw, ".hk-switch-thumb").body, "inset-inline-start"));
      const border = toPx(valueOf(find(sw, ".hk-switch-track").body, "border").split(" ")[0]!);
      const travel = toPx(valueOf(body, "transform").replace("translateX(", "").replace(")", ""));
      // travel = track − 2×(border + inset) − thumb: inset-inline-start
      // resolves against the padding box, so the 1px border counts on BOTH
      // sides — the checked gap then equals the resting gap (3px) exactly.
      expect(travel).toBe(trackW - 2 * (border + inset) - thumb);
    },
  );

  it.each(geometry)(
    "%s off/on content anchors clear of the covering thumb",
    (size, trackW, _trackH, thumb) => {
      // md carries the base declaration; sm/lg get size overrides.
      const scoped = (base: string) =>
        find(sw, `.hk-switch-${size} ${base}`.replace(".hk-switch-md ", "")).body;
      const offBody = scoped(".hk-switch-content-off");
      const onBody = scoped(".hk-switch-content-on");
      // off face: starts after the resting thumb (2px inset + thumb + 2px gap).
      expect(toPx(valueOf(offBody, "inset-inline-start"))).toBe(2 + thumb + 2);
      // on face: ends before the checked thumb — the checked thumb starts
      // `2 + travel` from the padding-box start, i.e. (track−2−travel) from
      // the end, plus the 2px gap.
      const travel = toPx(
        valueOf(find(sw, `.hk-switch-${size}[data-checked] .hk-switch-thumb`).body, "transform")
          .replace("translateX(", "").replace(")", ""),
      );
      expect(toPx(valueOf(onBody, "inset-inline-end"))).toBe(trackW - 2 - travel);
    },
  );

  it("resting off track is a filled neutral, not a bare surface", () => {
    const body = find(sw, ".hk-switch-track").body;
    expect(valueOf(body, "background")).toContain("color-mix");
    expect(valueOf(body, "border")).toContain("color-mix");
  });

  it("hover recolors the off track and brightens the checked track", () => {
    expect(
      valueOf(
        find(sw, ".hk-switch:not([data-disabled]):not([data-checked]):hover .hk-switch-track").body,
        "background",
      ),
    ).toContain("color-mix");
    expect(
      valueOf(find(sw, ".hk-switch:not([data-disabled])[data-checked]:hover .hk-switch-track").body, "filter"),
    ).toContain("brightness");
  });

  it("press squish on the thumb via the independent scale property", () => {
    const body = find(sw, ".hk-switch:not([data-disabled]):active .hk-switch-thumb").body;
    expect(valueOf(body, "scale")).toBe("0.88");
    expect(valueOf(find(sw, ".hk-switch-thumb").body, "transition")).toContain("scale");
  });

  it("rtl mirrors the checked slide for every size", () => {
    for (const size of ["sm", "md", "lg"]) {
      const ltr = toPx(
        valueOf(find(sw, `.hk-switch-${size}[data-checked] .hk-switch-thumb`).body, "transform").replace(
          "translateX(",
          "",
        ).replace(")", ""),
      );
      const rtl = find(sw, `[dir=rtl] .hk-switch-${size}[data-checked] .hk-switch-thumb`).body;
      expect(toPx(valueOf(rtl, "transform").replace("translateX(", "").replace(")", ""))).toBe(-ltr);
    }
  });

  it.each([
    ["HkCheckbox", "HkCheckbox", ".hk-checkbox-box"],
    ["HkRadio", "HkRadio", ".hk-radio-box"],
    ["HkSwitch", "HkSwitch", ".hk-switch-thumb"],
  ])("%s press feedback is disabled under prefers-reduced-motion", (_name, sheet, selector) => {
    // Parse ONLY the reduced-motion block (the flat splitter would read the
    // base rule and make this pass vacuously).
    const css = compile(resolve(componentDir, `${sheet}.scss`), { style: "expanded" }).css;
    const marker = css.match(/@media[^{]*prefers-reduced-motion[^{]*{/);
    expect(marker, `reduced-motion block in ${sheet}.scss`).not.toBeNull();
    const blockRules = rules(css.slice(marker!.index! + marker![0]!.length));
    // The switch block groups `.hk-switch-thumb, .hk-switch-content` in one
    // rule — compare per selector in the list, whitespace-normalized.
    const hit = blockRules.find((r) =>
      r.selector.replace(/\s+/g, " ").split(", ").includes(selector),
    );
    expect(hit, `${selector} inside the reduced-motion block`).toBeDefined();
    expect(valueOf(hit!.body, "transition")).toBe("none");
  });
});
