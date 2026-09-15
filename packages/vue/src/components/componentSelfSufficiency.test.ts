import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Component self-sufficiency guard.
 *
 * A hikari component must carry its own styling. Class literals in a
 * component's TSX are allowed to name hikari's own namespaces (`hk-`, the
 * plana-ui shared surface `s-`, state modifiers `is-`, `hii-`, `hljs`) —
 * those are defined in this package and ship with it. Anything else in a
 * class literal is a HOST-DIALECT utility (`flex`, `inset-0`, `w-7 h-7`,
 * `text-2xs`, `animate-pulse`, …): it resolves only if the consuming app
 * happens to run an atomic-CSS layer, and silently does nothing otherwise.
 *
 * That silent degradation is exactly what shipped: four components
 * (HkAdminHeader, HkAdminShell, HkGaugeRing, HkNavSidebar) spoke the
 * utility dialect, so the evernight flasher rendered its gauge ring with
 * the value unstyled beside the circle and its header with no gap or
 * padding at all — while hosts with UnoCSS (chest) owned values the
 * design system could not fix. Those four were rewritten to component
 * scss (2026-09-15) and the utility sheet they had been propped up with
 * was deleted; this test is the fence that keeps the dialect out.
 *
 * Adding a component that needs a utility class means either giving it a
 * semantic class with rules in its own scss (the house style) or adding
 * it here — and the second should feel like the wrong answer.
 */

const componentsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "components",
);

/** Namespaces that are hikari's own (semantic classes, not host dialect). */
const OWN_NAMESPACE = /^(?:hk-|s-|is-|hii-|hljs)/;

/** `"desc"` inside `sortDirection === "desc"` is a comparison operand, not
 *  a class name — the only false-positive source a class-literal scan has. */
const COMPARISON_BEFORE = /(?:===|!==|==|!=)\s*$/;

/**
 * Cut the literal source of every `class=` attribute and say whether it is
 * bare class text (`class="a b"` — a token list already) or an expression
 * (`class={…}` — token lists hide inside its string literals).
 */
function classAttributeSources(source: string): { text: string; expression: boolean }[] {
  const out: { text: string; expression: boolean }[] = [];
  const attr = "class=";
  for (let i = source.indexOf(attr); i !== -1; i = source.indexOf(attr, i + 1)) {
    const start = i + attr.length;
    const first = source[start];
    if (first === '"' || first === "'") {
      const end = source.indexOf(first, start + 1);
      if (end !== -1) out.push({ text: source.slice(start + 1, end), expression: false });
      continue;
    }
    if (first === "{") {
      let depth = 0;
      for (let j = start; j < source.length; j += 1) {
        if (source[j] === "{") depth += 1;
        else if (source[j] === "}") {
          depth -= 1;
          if (depth === 0) {
            out.push({ text: source.slice(start + 1, j), expression: true });
            break;
          }
        }
      }
    }
  }
  return out;
}

/** String literals in an expression, with the text right before each one. */
function literals(expression: string): { value: string; before: string }[] {
  const out: { value: string; before: string }[] = [];
  const pattern = /(["'])((?:\\.|(?!\1)[^\\])*)\1/g;
  for (let m = pattern.exec(expression); m !== null; m = pattern.exec(expression)) {
    out.push({ value: m[2], before: expression.slice(0, m.index) });
  }
  return out;
}

/** Host-dialect utility tokens found in the component sources, mapped to
 *  the files that write them. */
function utilityUsages(): Map<string, Set<string>> {
  const usage = new Map<string, Set<string>>();
  for (const name of readdirSync(componentsDir).sort()) {
    if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) continue;
    const source = readFileSync(join(componentsDir, name), "utf8").replace(/\r\n/g, "\n");
    for (const attr of classAttributeSources(source)) {
      const lists = attr.expression
        ? literals(attr.text)
            .filter(({ before }) => !COMPARISON_BEFORE.test(before))
            .map(({ value }) => value)
        : [attr.text];
      for (const list of lists) {
        for (const token of list.split(/\s+/)) {
          if (!token || token.includes("${") || OWN_NAMESPACE.test(token)) continue;
          if (!usage.has(token)) usage.set(token, new Set());
          usage.get(token)!.add(name);
        }
      }
    }
  }
  return usage;
}

describe("component self-sufficiency", () => {
  it("keeps host-dialect utility classes out of component markup", () => {
    const used = utilityUsages();
    const offenders = [...used.keys()].sort();
    expect(
      offenders,
      `components must style themselves (hk-*/s-*/is-* classes + their own scss), ` +
        `not rely on the host's atomic layer: ${offenders
          .map((t) => `${t} (${[...used.get(t)!].join(", ")})`)
          .join("; ")}`,
    ).toEqual([]);
  });

  it("still sees the class literals it is supposed to guard", () => {
    // An extractor that silently stopped matching would make the assertion
    // above pass on an empty set. Anchor it: the four rewritten components
    // carry semantic classes, and the scan must find them.
    const seen = new Map<string, Set<string>>();
    for (const name of readdirSync(componentsDir).sort()) {
      if (!name.endsWith(".tsx") || name.endsWith(".test.tsx")) continue;
      const source = readFileSync(join(componentsDir, name), "utf8");
      for (const attr of classAttributeSources(source)) {
        const lists = attr.expression
          ? literals(attr.text).map(({ value }) => value)
          : [attr.text];
        for (const list of lists) {
          for (const token of list.split(/\s+/)) {
            if (!token) continue;
            if (!seen.has(token)) seen.set(token, new Set());
            seen.get(token)!.add(name);
          }
        }
      }
    }
    for (const anchor of ["s-glass-header", "hk-gauge-ring-center", "s-admin-shell"]) {
      expect(seen.has(anchor), `scan lost ${anchor}`).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(50);
  });
});
