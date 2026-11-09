import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Source contract for the overspend stretch's look. vitest cannot see
 * stylesheets (happy-dom loads no SCSS), so a deleted rule would leave the
 * DOM geometry guards green while the stretch painted as another primary
 * fill — the whole point of the second segment is that it reads as PAST
 * quota.
 */
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkProgressBar.scss"), "utf8");

/** The DECLARATIONS of a rule, comments stripped (a comment that names a
 *  property must not satisfy a guard about it). */
function ruleBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const head = new RegExp(`${escaped}\\s*\\{`).exec(scss);
  if (!head) throw new Error(`no rule for ${selector}`);
  // Nested SCSS blocks: walk braces to the matching close.
  const open = head.index + head[0].length - 1;
  let depth = 0;
  let end = open;
  for (; end < scss.length; end++) {
    if (scss[end] === "{") depth += 1;
    else if (scss[end] === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return scss.slice(open + 1, end)
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("//");
    })
    .join("\n");
}

describe("HkProgressBar overspend sheet contract", () => {
  it("positions the stretch as an inline-end block on the stretched track", () => {
    const rule = ruleBlock(".hk-progress-bar-overspend");
    expect(rule).toMatch(/position:\s*absolute/);
    // Logical anchoring — the stretch sits at the inline end in RTL too.
    expect(scss).not.toMatch(/\.hk-progress-bar-overspend[^{]*\{[^}]*\b(?:left|right):/);
  });

  it("tones the stretch muted by default and error-toned for danger", () => {
    const block = ruleBlock(".hk-progress-bar-overspend");
    expect(block).toMatch(/&-muted\s*\{[^}]*background:\s*rgb\(var\(--color-muted\)\)/);
    expect(block).toMatch(/&-danger\s*\{[^}]*background:\s*rgb\(var\(--color-error\)\)/);
  });

  it("squares both sides of the 1px seam so it reads as a divider", () => {
    const block = ruleBlock(".hk-progress-bar-overspend");
    expect(block).toMatch(/border-start-start-radius:\s*0/);
    expect(block).toMatch(/border-end-start-radius:\s*0/);
    const fill = ruleBlock(".hk-progress-bar-track--overspend .hk-progress-bar-fill");
    expect(fill).toMatch(/border-start-end-radius:\s*0/);
    expect(fill).toMatch(/border-end-end-radius:\s*0/);
  });

  it("moves with the family cadence and stops under reduced motion", () => {
    const block = ruleBlock(".hk-progress-bar-overspend");
    expect(block).toMatch(/transition:[\s\S]*width var\(--duration-normal\)/);
    const media = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(scss);
    expect(media, "reduced-motion guard").not.toBeNull();
    expect(media![1]!).toMatch(/\.hk-progress-bar-overspend[\s\S]*transition:\s*none/);
  });

  it("co-locates the caption with the value label row", () => {
    const rule = ruleBlock(".hk-progress-bar-overspend-label");
    expect(rule).toMatch(/margin-inline-start:\s*var\(--space-6\)/);
    expect(rule).toMatch(/&-danger\s*\{[^}]*color:\s*rgb\(var\(--color-error\)\)/);
  });
});
