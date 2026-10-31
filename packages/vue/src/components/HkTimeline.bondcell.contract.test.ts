/**
 * Source contract for the bond CELLS of the horizontal stepper (2026-10-31
 * user rule; 60 % share since the same evening's second look).
 *
 * The row is read as one cell per step plus one cell per bond: the steps
 * keep their content width, the leftover splits into EQUAL bond cells, and
 * each bond paints 60 % of its own cell CENTERED, so both ends keep a 20 %
 * air gap. Before that rule the bond filled whatever the step had left after
 * its label, minus two fixed 4px margins — measured on a real engine at the
 * provider wizard's 590px row that put the bond 12px off its own label but
 * only 4px off the next node, i.e. the completed bond read as glued to the
 * following circle instead of sitting in the gap (the user's 圈出来的地方
 * 有点太长 report). The four bonds were already equal in length; what was
 * not equal was the air around them.
 *
 * Every assertion below is anchored to the rule that must carry the
 * declaration, and the colour assertions run against a comment-stripped copy
 * of the source: a declaration that survives only as a comment (while a
 * literal paint stays live) measured as an invisible bond on a real engine,
 * and a whole-file `toContain` cannot tell the two apart.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(here, "HkTimeline.scss"), "utf-8");

/** The source with comments removed — declarations only. */
const src = raw
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((line) => line.replace(/\/\/.*$/, ""))
  .join("\n");

function extractRules(source: string): { selector: string; body: string }[] {
  const rules: { selector: string; body: string }[] = [];
  let i = 0;
  while (i < source.length) {
    const open = source.indexOf("{", i);
    if (open === -1) break;
    const selector = source.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "{") depth += 1;
      else if (source[j] === "}") depth -= 1;
      j += 1;
    }
    rules.push({ selector, body: source.slice(open + 1, j - 1) });
    i = j;
  }
  return rules;
}

const rules = extractRules(src);

function blockFor(selector: string): string {
  const hits = rules.filter((r) =>
    r.selector.split(",").map((s) => s.trim()).includes(selector),
  );
  expect(hits, `exactly one rule carries ${selector}`).toHaveLength(1);
  return hits[0]!.body;
}

/** The shared spacing expression: the bond's box must read the SAME token
 *  the step's gap does, or the cell arithmetic halves itself. */
const GAP = "var(--hk-timeline-step-gap, var(--space-8, 8px))";

const BOND_CELL =
  '.hk-timeline[data-mode="full"][data-orientation="horizontal"] .hk-timeline-step [data-el="connector"]';
const BOND_PAINT = `${BOND_CELL}::before`;

/** The declaration block of one status, comment-stripped. */
function statusBlock(status: string): string {
  const at = src.indexOf(`.hk-timeline-step[data-status="${status}"]`);
  expect(at, `${status} status rule must exist`).toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("\n}", at));
}

/** Only the bond's own declarations inside a status rule (the indicator may
 *  legitimately keep reading the border token for its ring). */
function bondBlockOf(status: string): string {
  const block = statusBlock(status);
  const at = block.indexOf('[data-el="connector"]');
  expect(at, `${status} must style the bond`).toBeGreaterThan(-1);
  return block.slice(at, block.indexOf("}", at));
}

describe("horizontal bond cell contract", () => {
  it("spans the whole cell by cancelling the step's trailing gap", () => {
    const cell = blockFor(BOND_CELL);
    // Without the negated start margin the label→bond air is gap+margin
    // while the bond→node air is margin alone — the 12/4 asymmetry that
    // made the bond look glued to the next circle.
    expect(cell).toContain(`margin-inline: calc(-1 * ${GAP}) 0;`);
    // The box must not paint itself: the visible 60 % is the ::before.
    expect(cell).toContain("background: none;");
    // The ::before resolves percentage insets against this box.
    expect(cell).toContain("position: relative;");
    expect(cell).toContain("&::before");
    // The negated margin is only correct against the step's OWN gap
    // declaration, so pin the partner: drifting `gap` alone silently
    // restores the asymmetry (measured 7.84 / 3.84 on a 12px drift).
    expect(blockFor(".hk-timeline-step")).toContain(`gap: ${GAP};`);
  });

  it("paints 60 % of the cell centred with a 20 % inset on each end", () => {
    // The parser above only yields top-level rules; the paint lives in the
    // nested block, so lift it out of the cell rule's body.
    const paint = /&::before\s*\{([^}]*)\}/.exec(blockFor(BOND_CELL))?.[1] ?? "";
    expect(paint, "the bond's ::before must exist").not.toBe("");
    expect(paint).toContain('content: "";');
    expect(paint).toContain("position: absolute;");
    expect(paint).toContain("inset-block: 0;");
    expect(paint).toContain("inset-inline: 20%;");
    expect(paint).toContain("background: var(--_bond-color);");
    // Percentage PADDING would resolve against the step, not the bond —
    // ban the MECHANISM on both boxes, not one pinned value (a stray
    // `padding-inline: 10%` beside the correct inset would widen the paint
    // through the padding box and slip past a value-pinned regex).
    expect(blockFor(BOND_CELL)).not.toMatch(/padding-inline:/);
    expect(paint).not.toMatch(/padding-inline:/);
  });

  it("reserves the two-margin-era collapse threshold through its floor", () => {
    const cell = blockFor(BOND_CELL);
    // The floor (half a rem plus two gaps, minus the cancelled gap) reserves
    // the same sixteen outer pixels per bond the old two 4px margins
    // carried, so collapse="auto" measures the row's max-content width at
    // the two-margin-era threshold — never earlier, never later.
    expect(cell).toContain(`min-width: calc(0.5rem + 2 * ${GAP});`);
    // A definite flex-basis reserves NOTHING: engines size a flex item's
    // intrinsic contribution at max(min-width, content) and ignore the
    // basis (measured: a 100px basis on an empty item contributed its 8px
    // floor). The basis must not creep back in place of the floor — nor as
    // the shorthand `flex:`, whose basis component would be equally silent
    // while the literal reads like a reservation.
    expect(cell).not.toContain("flex-basis");
    expect(cell).not.toMatch(/\bflex\s*:/);
  });

  it("publishes one bond colour token for every status", () => {
    for (const status of ["completed", "active", "pending"]) {
      const bond = bondBlockOf(status);
      expect(bond, `${status} must publish --_bond-color`).toContain("--_bond-color:");
      expect(bond).toContain("background: var(--_bond-color);");
      // No status may paint a literal colour straight onto the box again:
      // in horizontal mode the box itself stays unpainted, and a stray
      // longhand would tint the vertical rail red instead.
      expect(bond, `${status} must not paint the box directly`).not.toMatch(
        /background(-color)?:\s*(?!\s*var\(--_bond-color\))/,
      );
    }
    // The completed bond is the primary tone; the faint ones derive from an
    // OPAQUE tone. `--hi-color-border` already carries the theme's alpha, so
    // 30 % of it computed to about 4.5 % — measured as ~7/255 off a white
    // background (a 248 grey) in full mode, while the window-mode link had
    // already been fixed.
    expect(bondBlockOf("completed")).toContain(
      "--_bond-color: var(--hi-color-primary);",
    );
    for (const status of ["active", "pending"]) {
      const bond = bondBlockOf(status);
      expect(bond, `${status} must not re-multiply the border token's alpha`)
        .toContain("--_bond-color: color-mix(in srgb, var(--hi-color-muted");
      expect(bond).not.toContain("var(--hi-color-border)");
    }
  });

  it("leaves the vertical rail painting its own box", () => {
    // The cell rule is mode+orientation scoped, so the vertical rail (a rail
    // hanging under the node, not a cell-wide bond) keeps the plain
    // `background: var(--_bond-color)` chain and its absolute geometry.
    const vertical = blockFor(
      '.hk-timeline[data-orientation="vertical"][data-mode="full"] .hk-timeline-step',
    );
    expect(vertical).toContain("width: var(--hk-timeline-link-thickness);");
    expect(vertical).toContain("min-width: 0;");
    expect(vertical).not.toContain("background: none");
    // A bare `.hk-timeline-step [data-el="connector"]` override would hit the
    // vertical rail too and blank it.
    const unscoped = rules.filter(
      (r) =>
        r.selector.trim() === '.hk-timeline-step [data-el="connector"]' &&
        /background:\s*none/.test(r.body),
    );
    expect(unscoped, "no unscoped connector background reset").toHaveLength(0);
  });

  it("rides the status crossfade on the painted box, not just the frame", () => {
    // The paint moved to the ::before, so the crossfade must cover THAT
    // selector. Asserting the bare selector name proves nothing (the
    // reduced-motion block lists it too), so pin the transition BODY.
    const crossfade = blockFor(BOND_PAINT);
    expect(crossfade).toContain("background-color var(--hk-timeline-motion)");
    // ...and the reduced-motion switch must cover the same box.
    const reducedAt = src.lastIndexOf("@media (prefers-reduced-motion: reduce)");
    expect(reducedAt).toBeGreaterThan(-1);
    expect(src.slice(reducedAt)).toContain(BOND_PAINT);
  });
});
