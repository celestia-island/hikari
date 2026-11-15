import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Compiled-stylesheet guard for the dock edge gap family (2026-11-15).
 *
 * The whole facility is CSS: `--hk-dock-gap` is declared ONCE by the
 * foundation (scale.scss), every edge resolves it through one fallback
 * chain declared once on the dock base class, and each anchor rule turns
 * that resolved value into (a) its RESTING INSET from the viewport edge —
 * gap plus that edge's safe-area inset — and (b) a transparent CONTENT BAND
 * on the face that points at the content. Vitest stubs CSS, so
 * HkDockBar.test.tsx can only read the SCSS source; this file compiles the
 * real sheets and pins the emitted declarations, so a rule that silently
 * regresses to a literal 12px inset, loses a band, or leaves the surface
 * uncapped turns red here.
 *
 * The negative controls matter as much as the positive ones: a `:root`
 * pre-declaration of `--hk-dock-gap-<edge>` would freeze that edge against
 * every descendant `--hk-dock-gap` override (a custom property resolves on
 * the element that DECLARES it), and a per-anchor re-spelling of the chain
 * would let the family drift back into several mechanisms.
 */

const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));
const srcDir = resolve(componentDir, "..");

const dockCss = compile(resolve(componentDir, "HkDockBar.scss"), {
  style: "expanded",
}).css;
const scaleCss = compile(resolve(srcDir, "scale.scss"), { style: "expanded" }).css;
const scaleSource = readFileSync(resolve(srcDir, "scale.scss"), "utf8");

/** The sheet minus its block comments: the contract prose quotes the very
 *  declarations the negative controls scan for (the header comment spells the
 *  cascade trap as a literal `--hk-dock-gap-bottom` declaration), so the scans
 *  must only ever see real declarations. */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The compiled rule that is EXACTLY `selector` followed by its own block. A
 *  selector shared with a sibling (`.a, .b { … }`) does not count: the anchor
 *  assertions must read that anchor's own rule body, never a shared one. */
function ruleFor(css: string, selector: string): string {
  const start = new RegExp(`(?:^|\\n)[ \\t]*${escapeRe(selector)}\\s*\\{`).exec(css);
  expect(start, `${selector} present in the compiled sheet`).not.toBeNull();
  return sliceRule(css, start!.index);
}

/** The compiled rule whose selector LIST starts with `selector` (a shared rule
 *  such as the two side-anchor caps, emitted as one `.left, .right { … }`). */
function groupRuleFor(css: string, selector: string): string {
  const start = new RegExp(`(?:^|\\n)[ \\t]*${escapeRe(selector)}(?=[\\s,{])`).exec(css);
  expect(start, `${selector} present in the compiled sheet`).not.toBeNull();
  return sliceRule(css, start!.index);
}

/** The rule body that begins at `from` (`{` … first `}`). */
function sliceRule(css: string, from: number): string {
  const open = css.indexOf("{", from);
  const close = css.indexOf("}", open);
  return css.slice(from, close + 1);
}

const EDGES = ["top", "right", "bottom", "left"] as const;

/** The private resolved gap one edge reads (declared once on the base). */
function gap(edge: string): string {
  return `var(--_hk-dock-gap-${edge})`;
}

/** The resting inset of an anchored edge: the gap plus its safe-area. */
function inset(edge: string): string {
  return `calc(${gap(edge)} + env(safe-area-inset-${edge}, 0px))`;
}

/**
 * The §2 anchor table, transcribed — every one of the ten `data-anchor`
 * values the component accepts (nine geometries; `bottom` is `page`'s
 * compass alias). Each row is `[css side, edge]` for the resting inset and
 * `[padding property, edge]` for the content band, so a missing anchor row,
 * a missing rule, or a band on the wrong face fails.
 */
type AnchorRow = {
  anchor: string;
  insets: [string, string][];
  bands: [string, string][];
};

const ANCHOR_TABLE: AnchorRow[] = [
  {
    anchor: "page",
    insets: [["bottom", "bottom"]],
    bands: [["padding-block-start", "bottom"]],
  },
  {
    anchor: "bottom",
    insets: [["bottom", "bottom"]],
    bands: [["padding-block-start", "bottom"]],
  },
  {
    anchor: "plane",
    insets: [["margin", "bottom"]],
    bands: [["padding-block-start", "bottom"]],
  },
  { anchor: "top", insets: [["top", "top"]], bands: [["padding-block-end", "top"]] },
  { anchor: "left", insets: [["left", "left"]], bands: [["padding-inline-end", "left"]] },
  { anchor: "right", insets: [["right", "right"]], bands: [["padding-inline-start", "right"]] },
  {
    anchor: "top-left",
    insets: [
      ["top", "top"],
      ["left", "left"],
    ],
    bands: [
      ["padding-block-end", "top"],
      ["padding-inline-end", "left"],
    ],
  },
  {
    anchor: "top-right",
    insets: [
      ["top", "top"],
      ["right", "right"],
    ],
    bands: [
      ["padding-block-end", "top"],
      ["padding-inline-start", "right"],
    ],
  },
  {
    anchor: "bottom-left",
    insets: [
      ["bottom", "bottom"],
      ["left", "left"],
    ],
    bands: [
      ["padding-block-start", "bottom"],
      ["padding-inline-end", "left"],
    ],
  },
  {
    anchor: "bottom-right",
    insets: [
      ["bottom", "bottom"],
      ["right", "right"],
    ],
    bands: [
      ["padding-block-start", "bottom"],
      ["padding-inline-start", "right"],
    ],
  },
];

describe("dock edge gap token — foundation declaration", () => {
  it("declares --hk-dock-gap exactly once, defaulting to the 16px step", () => {
    const root = ruleFor(scaleCss, ":root");
    expect(root).toContain("--hk-dock-gap: var(--space-16, 1rem);");
    expect(withoutComments(scaleCss).match(/--hk-dock-gap\s*:/g) ?? []).toHaveLength(1);
    // …and NOT inside the mobile media query that halves other gutters: the
    // dock gap is a product decision, not a breakpoint-dependent gutter.
    expect(scaleCss.split("@media")[0]).toContain("--hk-dock-gap:");
  });

  it("never pre-declares a per-edge gap (cascade trap negative control)", () => {
    // A custom property resolves on the element that declares it, so a
    // :root-level `--hk-dock-gap-bottom: var(--hk-dock-gap)` would freeze the
    // bottom edge against every descendant override. Per-edge names may only
    // appear as READ-time fallbacks.
    for (const [name, css] of [
      ["scale.scss", scaleCss],
      ["HkDockBar.scss", dockCss],
    ] as const) {
      expect(
        withoutComments(css).match(/(^|[^\w-])--hk-dock-gap-(top|right|bottom|left)\s*:/m),
        `${name} must not declare a per-edge gap`,
      ).toBeNull();
    }
    expect(scaleSource.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
      /--hk-dock-gap-(top|right|bottom|left)\s*:/,
    );
  });
});

describe("dock edge gap token — one resolver per edge", () => {
  it("declares the four resolved gaps on the base class, each reading the full chain", () => {
    const base = ruleFor(dockCss, ".hk-dock-bar");
    for (const edge of EDGES) {
      expect(base).toContain(
        `--_hk-dock-gap-${edge}: var(--hk-dock-gap-${edge}, var(--hk-dock-inset, var(--hk-dock-gap, var(--space-16, 1rem))));`,
      );
    }
    // Exactly four declarations: the chain lives in ONE place (the base), not
    // re-spelled per anchor.
    expect(dockCss.match(/--_hk-dock-gap-(top|right|bottom|left):/g) ?? []).toHaveLength(4);
  });
});

describe("dock edge gap — anchor geometry", () => {
  it("covers every anchor the component accepts, and no other", () => {
    // Completeness in both directions: a new anchor must get a row here, and
    // the table may not carry an anchor the sheet does not style.
    const styled = new Set(
      [...withoutComments(dockCss).matchAll(/\[data-anchor=([a-z-]+)\]/g)].map((m) => m[1]),
    );
    expect([...styled].sort()).toEqual(ANCHOR_TABLE.map((row) => row.anchor).sort());
  });

  it.each(ANCHOR_TABLE)(
    '$anchor: edge gap inset(s) + content band(s) from the same family',
    ({ anchor, insets, bands }) => {
      const rule = ruleFor(dockCss, `.hk-dock-bar[data-anchor=${anchor}]`);
      for (const [side, edge] of insets) {
        if (side === "margin") {
          // The in-flow plane anchor rests by a margin, not a pinned edge.
          expect(rule).toContain(`margin: 0 auto ${inset(edge)};`);
        } else {
          expect(rule).toContain(`${side}: ${inset(edge)};`);
        }
      }
      for (const [property, edge] of bands) {
        expect(rule).toContain(`${property}: ${gap(edge)};`);
      }
      // No literal fallback left behind: every distance is a resolved edge gap.
      expect(rule).not.toContain("--space-16");
      expect(rule).not.toContain("--hk-dock-inset");
    },
  );

  it("opens exactly two bands on each corner and one elsewhere", () => {
    for (const { anchor, bands } of ANCHOR_TABLE) {
      const rule = ruleFor(dockCss, `.hk-dock-bar[data-anchor=${anchor}]`);
      const padding = rule.match(/padding-(block|inline)-(start|end):/g) ?? [];
      expect(padding, anchor).toHaveLength(bands.length);
    }
  });

  it("every anchored rule adds the safe-area inset for its own edge only", () => {
    for (const { anchor, insets } of ANCHOR_TABLE) {
      const rule = ruleFor(dockCss, `.hk-dock-bar[data-anchor=${anchor}]`);
      for (const [, edge] of insets) {
        expect(rule, anchor).toContain(`env(safe-area-inset-${edge}, 0px)`);
      }
      for (const other of EDGES.filter((e) => !insets.some(([, edge]) => edge === e))) {
        expect(rule, anchor).not.toContain(`safe-area-inset-${other}`);
      }
    }
  });
});

describe("dock edge gap — surface caps read the same family", () => {
  it("caps the surface width on both horizontal edge gaps", () => {
    const base = ruleFor(dockCss, ".hk-dock-bar-surface");
    expect(base).toContain(
      `max-width: var(--dock-max-width, calc(100vw - ${gap("left")} - ${gap("right")}));`,
    );
    expect(base).not.toContain("--space-16");
  });

  it("caps vertical side docks by both block gaps", () => {
    // Sass emits the two side anchors as one selector list; the cap rule body
    // is what this pins.
    const cap = groupRuleFor(dockCss, '.hk-dock-bar[data-anchor=left] .hk-dock-bar-surface');
    expect(cap).toContain(
      `max-height: var(--dock-max-height, calc(100dvh - ${gap("top")} - ${gap("bottom")}));`,
    );
    expect(cap).not.toContain("--space-16");
  });
});
