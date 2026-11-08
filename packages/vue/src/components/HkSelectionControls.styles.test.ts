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
 *   5. label first-line anchoring: checkbox/radio pin the box to the
 *      MIDDLE OF THE LABEL'S FIRST LINE BOX instead of the middle of the
 *      whole label block, so a wrapped option no longer floats its box
 *      between the lines — and a host that used to re-align the row with
 *      `align-items: flex-start` (which parked the box on the line's top
 *      edge, ~2px off) no longer has to. The switch and the offset both
 *      carry the `:has(.hk-label:not(:empty))` gate, so engines without
 *      `:has()` fall back to the previous centering instead of the bare top
 *      edge, and a label-less or empty-label control keeps its old footprint.
 *      See the "label first-line anchoring" block for the three-way
 *      arithmetic this pins.
 *
 * The rules below are parsed out of the COMPILED css (not the .scss
 * source) so a rule that fails to compile can never count as present.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

interface Rule {
  selector: string;
  body: string;
  /** Set for a rule that lives inside an at-rule (only `@media` today), so
   * `find()`/the selector-set helper keep reading the UNCONDITIONAL anatomy
   * and a media-scoped copy can never shadow it. */
  media?: string;
}

/** Splitter for the expanded output of these leaf sheets. */
function rules(css: string): Rule[] {
  // Expanded output keeps loud comments, and sheets containing non-ASCII
  // text get a braille-less `@charset "UTF-8";` statement — both would glue
  // onto the next selector and shift every rule pair, so strip them first.
  const bare = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@charset[^;]*;/g, "")
    .trim();
  const out: Rule[] = [];
  // Brace-matching walk, not a flat regex: a rule inside `@media` must not be
  // parsed as if it were unconditional. `@media (prefers-reduced-motion)
  // .hk-checkbox-box` is exactly that shape, and a flat splitter hands it the
  // same selector as the base rule — `find()` would then read whichever came
  // first while the media copy won at runtime.
  const stack: Array<{ prelude: string; atRule: boolean }> = [];
  let buffer = "";
  for (const char of bare) {
    if (char === "{") {
      const prelude = buffer.trim();
      buffer = "";
      stack.push({ prelude, atRule: prelude.startsWith("@") });
      continue;
    }
    if (char !== "}") {
      buffer += char;
      continue;
    }
    const frame = stack.pop();
    const body = buffer.trim();
    buffer = "";
    if (!frame || frame.atRule || !body) {
      continue;
    }
    // Keep control rules; the rtl mirrors lead with an attribute selector,
    // and HkRadio's size steps nest as `[data-size=…] .hk-radio-box`. A rule
    // that reaches a control PART leads with neither (an `[data-type=…]` or
    // `[data-disabled]` prefix is legal and would otherwise be dropped from
    // every selector-set assertion below), so anything naming a part stays.
    const isControlRule =
      frame.prelude.startsWith(".hk-") ||
      frame.prelude.startsWith("[dir=") ||
      frame.prelude.startsWith("[data-size=") ||
      /\.hk-(?:checkbox|radio|switch)[\w-]*\b/.test(frame.prelude);
    if (!isControlRule) {
      continue;
    }
    const media = stack.filter((f) => f.atRule).map((f) => f.prelude).join(" ");
    out.push(media ? { selector: frame.prelude, body, media } : { selector: frame.prelude, body });
  }
  // `find()` returns the FIRST match, so a rule duplicated further down the
  // sheet (appended, or re-emitted by a later partial) would silently shadow
  // the one every assertion below reads while winning at runtime. No sheet in
  // this package emits a duplicate selector, so pin it.
  const seen = new Set<string>();
  for (const rule of out) {
    const key = `${rule.media ?? ""}|${rule.selector}`;
    expect(seen.has(key), `duplicate compiled selector \`${rule.selector}\``).toBe(false);
    seen.add(key);
  }
  return out;
}

function find(all: Rule[], selector: string): Rule {
  const hit = all.find((r) => !r.media && r.selector === selector);
  expect(hit, `compiled rule for \`${selector}\``).toBeDefined();
  return hit!;
}

/**
 * The R2 adversarial round smuggled a `.hk-switch-md &` override past the
 * per-size assertions (the render picked it up, the tests kept reading the
 * base rule — a 0,2,0 selector beats the 0,1,0 base at runtime). Any
 * geometry face pinned here must therefore pin its WHOLE selector set:
 * a reader can only trust the values below when no unlisted, more
 * specific rule also touches the class.
 */
function expectSelectorSet(all: Rule[], classSuffix: string, expected: string[]) {
  const present = all
    .filter((r) => !r.media)
    .map((r) => r.selector)
    .filter((s) => {
      const last = s.split(/\s+>/).pop()!.trim().split(" ").pop()!;
      return last === classSuffix && !s.startsWith("[dir=");
    })
    .sort();
  expect(present, `selector set touching \`${classSuffix}\``).toEqual(expected.sort());
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

/** `var(--token, fallback)` → its two halves; a literal value fails loudly. */
function cssVar(body: string, prop: string): { token: string; fallback: string } {
  const decl = valueOf(body, prop);
  const m = decl.match(/^var\((--[\w-]+),\s*(.+)\)$/);
  expect(m, `\`${prop}: ${decl}\` must read a token with a fallback`).not.toBeNull();
  return { token: m![1]!, fallback: m![2]!.trim() };
}

/**
 * `calc((1.5 * var(--text-base, 0.875rem) - 1.125rem) / 2)` → the four moving
 * parts: the label line-height coefficient, the label font token + fallback,
 * and the box term. Every one of them is checked against its home sheet in
 * "label first-line anchoring" below, so the formula can never drift away
 * from the label typography or the box scale it rides on.
 */
function offsetTerms(body: string): {
  lineHeight: number;
  token: string;
  fallback: string;
  box: string;
} {
  const decl = valueOf(body, "margin-block-start");
  const m = decl.match(
    /^calc\(\(([\d.]+) \* var\((--[\w-]+),\s*([^)]+)\) - ([\d.]+rem)\) \/ 2\)$/,
  );
  expect(
    m,
    `first-line offset \`${decl}\` must stay "(line-height × label font − box) / 2"`,
  ).not.toBeNull();
  return {
    lineHeight: parseFloat(m![1]!),
    token: m![2]!,
    fallback: m![3]!.trim(),
    box: m![4]!,
  };
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

describe("label first-line anchoring", () => {
  // HkLabel owns BOTH numbers the offset rides on: the label line box
  // (`line-height`) and the per-size font size. Compile that sheet here so
  // the pairing is checked against the real label, not a copy of its numbers.
  const labelSheet = rules(
    compile(resolve(componentDir, "HkLabel.scss"), { style: "expanded" }).css,
  );
  const labelLineHeightRule = find(labelSheet, ".hk-label").body;
  // A bare number: `line-height: 1.5` is a multiplier of the label's font
  // size, which is what the offset's `1.5 * font-size` term assumes. A px
  // line-height would parse to the same float but mean a different line box.
  const labelLineHeightDecl = valueOf(labelLineHeightRule, "line-height");
  expect(
    labelLineHeightDecl,
    `HkLabel line-height "${labelLineHeightDecl}" must be a unitless multiplier`,
  ).toMatch(/^[\d.]+$/);
  const labelLineHeight = parseFloat(labelLineHeightDecl);
  const labelFont = (selector: string) => cssVar(find(labelSheet, selector).body, "font-size");

  // The offset rides the label's FIRST line box, which starts at the label's
  // border-box top: a block-direction margin or padding on `.hk-label` would
  // sit between them and silently shift every box.
  const labelBox = find(labelSheet, ".hk-label").body;
  expect(
    labelBox,
    "the offset assumes a margin/padding-free .hk-label",
  ).not.toMatch(/(?:^|;)\s*(?:margin|padding)(?:-(?:block|top|bottom)(?:-start|-end)?)?\s*:/);

  it.each([
    ["HkCheckbox", checkbox, ".hk-checkbox"],
    ["HkRadio", radio, ".hk-radio"],
  ])("%s switches a labeled row to flex-start, keeping centering as the fallback", (
    _name,
    all,
    selector,
  ) => {
    // `center` rode the middle of the whole label block (a wrapped option
    // floated its box between the lines); `flex-start` alone parks the box on
    // the line's TOP edge (~2px high/low depending on the host font). The
    // pair — flex-start plus the offsets below — is the contract, and both
    // halves carry the `:has(.hk-label:not(:empty))` gate so an engine without `:has()`
    // keeps the old centering instead of the bare top edge.
    expect(valueOf(find(all, selector).body, "align-items")).toBe("center");
    expect(valueOf(find(all, `${selector}:has(.hk-label:not(:empty))`).body, "align-items")).toBe(
      "flex-start",
    );
  });

  // Each row pairs the offset rule with the label size it reads and the box
  // it centers; the box size is read from the box's OWN rule, so changing the
  // box scale without updating the offset fails here.
  const rows: Array<[string, Rule[], string, string, string]> = [
    ["checkbox md", checkbox, ".hk-checkbox:has(.hk-label:not(:empty)) .hk-checkbox-box", ".hk-label", ".hk-checkbox-box"],
    [
      "checkbox sm",
      checkbox,
      ".hk-checkbox-sm:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-label.hk-label-sm",
      ".hk-checkbox-sm .hk-checkbox-box",
    ],
    [
      "checkbox lg",
      checkbox,
      ".hk-checkbox-lg:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-label.hk-label-lg",
      ".hk-checkbox-lg .hk-checkbox-box",
    ],
    ["radio md", radio, ".hk-radio:has(.hk-label:not(:empty)) .hk-radio-box", ".hk-label", "[data-size=md] .hk-radio-box"],
    [
      "radio sm",
      radio,
      ".hk-radio[data-size=sm]:has(.hk-label:not(:empty)) .hk-radio-box",
      ".hk-label.hk-label-sm",
      "[data-size=sm] .hk-radio-box",
    ],
    [
      "radio lg",
      radio,
      ".hk-radio[data-size=lg]:has(.hk-label:not(:empty)) .hk-radio-box",
      ".hk-label.hk-label-lg",
      "[data-size=lg] .hk-radio-box",
    ],
  ];

  it.each(rows)(
    "%s offset is half of (one label line − box), in the label's own units",
    (_name, all, offsetSelector, labelSelector, boxSelector) => {
      const terms = offsetTerms(find(all, offsetSelector).body);
      const font = labelFont(labelSelector);
      const boxBody = find(all, boxSelector).body;
      const boxPx = toPx(valueOf(boxBody, "width"));
      expect(toPx(valueOf(boxBody, "height")), "box stays square").toBe(boxPx);

      // The formula and the sheets it serves must agree on every input.
      expect(terms.lineHeight, "line-height coefficient mirrors HkLabel").toBe(labelLineHeight);
      expect(terms.token, "label font token").toBe(font.token);
      expect(terms.fallback, "label font token fallback").toBe(font.fallback);
      expect(toPx(terms.box), "box term mirrors the box's own width").toBe(boxPx);

      // Structure: the offset is HALF the leftover between one line box and
      // the box, i.e. the box midline lands on the line midline — exactly
      // where `align-items: center` put it for a single-line label. Dropping
      // the `/ 2` (box top on the line top) or over-correcting fails here.
      const lineBoxPx = labelLineHeight * toPx(font.fallback);
      const declaredOffset = (terms.lineHeight * toPx(terms.fallback) - toPx(terms.box)) / 2;
      expect(declaredOffset).toBeCloseTo((lineBoxPx - boxPx) / 2, 6);
      expect(declaredOffset, "box must be shorter than one line box").toBeGreaterThan(0);
    },
  );

  it.each([
    ["checkbox", checkbox, ".hk-checkbox-box", [
      ".hk-checkbox:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-checkbox-sm:has(.hk-label:not(:empty)) .hk-checkbox-box",
      ".hk-checkbox-lg:has(.hk-label:not(:empty)) .hk-checkbox-box",
    ]],
    ["radio", radio, ".hk-radio-box", [
      ".hk-radio:has(.hk-label:not(:empty)) .hk-radio-box",
      ".hk-radio[data-size=sm]:has(.hk-label:not(:empty)) .hk-radio-box",
      ".hk-radio[data-size=lg]:has(.hk-label:not(:empty)) .hk-radio-box",
    ]],
  ])(
    "%s box only moves on a label-gated offset",
    (_name, all, box, expected) => {
      // (a) every vertical-shift declaration on the box is one of the three
      // offset rules and carries the `:has(.hk-label:not(:empty))` gate — a
      // label-less (or empty-label) control has no line box to ride and must
      // keep its old footprint; (b) nothing else in the sheet can move the
      // box: a smuggled `margin-*`, `padding-*`, `translate`, `align-self` or
      // `top`/`bottom`/`inset` lands in this set and fails the exact toEqual.
      // The parser keeps every rule that names a control part, and it rejects
      // duplicate selectors, so such a rule can neither hide outside the
      // filter nor shadow the rule this test reads.
      const shiftRules = all.filter(
        (r) =>
          r.selector.trim().endsWith(box) &&
          /(?:^|;)\s*(?:margin(?:-[a-z-]+)?|padding(?:-[a-z-]+)?|translate|align-self|top|bottom|inset(?:-[a-z-]+)?)\s*:/.test(
            r.body,
          ),
      );
      expect(shiftRules.map((r) => r.selector).sort()).toEqual([...expected].sort());
      for (const rule of shiftRules) {
        expect(rule.selector).toContain(":has(.hk-label:not(:empty))");
      }
    },
  );

  it.each([
    ["checkbox", checkbox, ".hk-checkbox-box"],
    ["radio", radio, ".hk-radio-box"],
  ])("%s box declares the sizing its offset reads", (_name, all, box) => {
    // The offset reads the box's width as a BORDER-BOX height (`width` and
    // `height` are equal, the box is square but its 1px border is added on
    // top of a content-box). Under a host reset that is border-box and
    // everything agrees; a consumer that imports this sheet without one would
    // inflate the box by 2px and land the offset 1px low, so the sheet
    // declares the sizing itself.
    expect(valueOf(find(all, box).body, "box-sizing")).toBe("border-box");
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

  it("pins the whole selector set of each caption face (R2 M7 blind spot)", () => {
    // A more specific override (e.g. `.hk-switch-md .hk-switch-content-off`)
    // wins at runtime but is invisible to the per-size assertions above,
    // which read the base rule — the ONLY sanctioned scoped faces are the
    // sm/lg ones; anything else must fail here first.
    for (const face of [".hk-switch-content-off", ".hk-switch-content-on"]) {
      expectSelectorSet(sw, face, [
        face,
        `.hk-switch-sm ${face}`,
        `.hk-switch-lg ${face}`,
      ]);
    }
  });

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
