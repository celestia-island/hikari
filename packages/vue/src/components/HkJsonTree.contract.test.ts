import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Source contract: the JSON tree's spacing rhythm is token-based, not
 * ad-hoc. The 2026-09-30 normalization replaced the off-scale gaps
 * (2px toggle margin, 0.35em colon, 0.75em type hint) with design
 * units and added the toggle's first-line centering formula — this
 * contract keeps the file from drifting back to magic values, which is
 * exactly the "crooked collapsed/expanded alignment" regression class
 * the normalization fixed.
 */
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkJsonTree.scss"), "utf-8");

describe("HkJsonTree spacing contract", () => {
  it("keeps the toggle exactly one spacing unit from the row text", () => {
    const block = scss.slice(scss.indexOf(".s-jt-toggle {"), scss.indexOf(".s-jt-toggle[data-parent]"));
    expect(block).toContain("margin-inline-end: var(--space-4");
  });

  it("centers the toggle box on the first text line by formula", () => {
    const block = scss.slice(scss.indexOf(".s-jt-toggle {"), scss.indexOf(".s-jt-toggle[data-parent]"));
    expect(block).toContain("align-self: flex-start");
    expect(block).toContain("margin-block-start: max(0px, calc((1.55em - var(--jt-toggle, 14px)) / 2))");
  });

  it("keeps every --jt-toggle fallback at the 14px the formula assumes", () => {
    // Regex sweep, not a blacklist: ANY fallback other than 14px (today
    // or added later) would de-center the box by the delta.
    const fallbacks = [...scss.matchAll(/var\(--jt-toggle,\s*([^)]+)\)/g)].map((m) => m[1].trim());
    expect(fallbacks.length, "fallback sites were scanned").toBeGreaterThan(2);
    expect(fallbacks.every((f) => f === "14px"), `fallbacks = ${fallbacks}`).toBe(true);
    // The canonical definition itself: the TSX drives depth steps and
    // guide lines from JT_TOGGLE = 14 — a different definition desyncs
    // CSS geometry from the TS geometry with zero other red.
    expect(scss).toContain("--jt-toggle: 14px;");
  });

  it("pins the depth step to exactly one toggle width", () => {
    const tsx = readFileSync(join(here, "HkJsonTree.tsx"), "utf-8");
    expect(tsx).toContain("const JT_INDENT = JT_TOGGLE;");
  });

  it("reads collapsed summaries one tab in, at full row size", () => {
    const tsx = readFileSync(join(here, "HkJsonTree.tsx"), "utf-8");
    // Both collapsed shapes (object preview and long string) carry the
    // one-tab slot before the summary — the collapsed text sits in the
    // child column instead of hugging the chevron.
    expect(tsx.match(/<span class="s-jt-indent" \/>/g)?.length).toBe(2);
    const preview = scss.slice(scss.indexOf(".s-jt-preview {"));
    // A smaller preview font would shrink a keyless row's line box below
    // the toggle centering assumption and float the row high.
    expect(preview).toContain("font-size: inherit");
    expect(preview).not.toContain("0.5rem");
  });

  it("keeps the collapsed summary indent slot exactly one tab wide", () => {
    const indent = scss.slice(scss.indexOf(".s-jt-indent {"), scss.indexOf(".s-jt-preview {"));
    // Deleting the whole rule (not just tweaking it) must also go red —
    // this slot IS the second-round "collapsed text hugs the chevron" fix.
    expect(indent, ".s-jt-indent rule present").not.toBe("");
    expect(indent).toContain("width: var(--jt-toggle, 14px)");
    expect(indent).toContain("flex-shrink: 0");
  });

  it("keeps the key colon gap on one spacing unit", () => {
    const block = scss.slice(scss.indexOf(".s-jt-colon {"), scss.indexOf(".s-jv-null"));
    expect(block).toContain("margin-inline-end: var(--space-4");
    expect(block).not.toContain("0.35em");
  });

  it("keeps the type hint gap on two spacing units", () => {
    const block = scss.slice(scss.indexOf(".s-jt-type {"), scss.indexOf(".s-jt-badge {"));
    expect(block).toContain("margin-inline-start: var(--space-8");
    expect(block).not.toContain("0.75em");
  });

  it("leaves no off-scale magic gaps anywhere in the tree stylesheet", () => {
    expect(scss).not.toMatch(/margin-inline-end: 0\.\d+em/);
    expect(scss).not.toMatch(/margin-inline-start: 0\.\d+em/);
  });
});
