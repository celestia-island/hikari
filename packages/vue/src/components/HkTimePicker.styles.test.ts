import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(resolve(here, "HkTimePicker.scss"), "utf8");
const tsx = readFileSync(resolve(here, "HkTimePicker.tsx"), "utf8");

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
  return scss
    .slice(open + 1, end)
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith("*") && !t.startsWith("/*") && !t.startsWith("//");
    })
    .join("\n");
}

/**
 * Source-contract pins: the minute-mode metrics key (the number layer is
 * a sibling of the slider, so `.hk-tp-face.is-minute` can never match —
 * a regression pin even though the selector predates this PR) and the
 * shared segmented period control introduced here. A SCSS-only edit
 * reintroducing the old selector used to leave every behavioral test
 * green; this file is the missing guard.
 */
describe("HkTimePicker source contracts", () => {
  it("keys the minute-mode rules on the number layer, never the face", () => {
    expect(scss).toContain(".hk-tp-numbers.is-minute .hk-tp-number");
    expect(scss).toContain(".hk-tp-panel.is-touch .hk-tp-numbers.is-minute .hk-tp-number");
    expect(scss).not.toContain(".hk-tp-face.is-minute");
  });

  it("builds the day period on hikari's shared pill group", () => {
    expect(tsx).toContain('from "./HkPillToggleGroup"');
    expect(tsx).toContain("<HkPillToggleGroup");
    expect(scss).not.toContain(".hk-tp-period-btn");
  });

  it("centers the hugged period track in the panel's column", () => {
    // HkPillToggleGroup's track hugs its pills (inline-flex + fit-content), so
    // it no longer stretches to the panel width and `justify-content` alone
    // cannot center it; the track must center itself against the panel's
    // stretch alignment via `align-self`.
    expect(ruleBlock(".hk-tp-period")).toMatch(/align-self:\s*center/);
    // …and there is exactly ONE such rule: a later duplicate re-declaring
    // `align-self` (or `justify-content`) would override the centering
    // while the pin above stayed green (presence ≠ winner).
    const ruleCount = scss.match(/\.hk-tp-period\s*\{/g)?.length ?? 0;
    expect(ruleCount, "exactly one .hk-tp-period rule block").toBe(1);
  });
});
