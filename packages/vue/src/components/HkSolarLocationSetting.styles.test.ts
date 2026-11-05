import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * HkSolarLocationSetting row-geometry contract (S3 follow-up, 2026-11-05):
 * the first polish wave let `line-height: 1` clip descenders through every
 * gate because ONLY Vue↔Rust sheet equality was guarded — both forms were
 * wrong together. This spec pins the VALUES the row's single-center
 * geometry depends on, so a future "simplification" of the leading (or the
 * row minimum, or the glyph box) fails here before it ships.
 *
 * The vendored Rust mirror is byte-guarded by
 * packages/components/tests/vue_mirror_drift_tests.rs
 * (mirror_bodies_match_their_upstream_sheets); this file only has to pin
 * the canonical Vue sheet.
 */
const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(join(here, "HkSolarLocationSetting.scss"), "utf8");

/** Comments stripped: a comment naming a property must not satisfy a guard
 *  about it (the house rule from HkAmbientLayer's pointer contract). */
const declarations = scss.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** One ruleset's body, or null when the selector never appears. */
function bodyOf(selector: string): string | null {
  const re = new RegExp(
    selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^{}]*)\\}",
  );
  const m = declarations.match(re);
  return m ? m[1] : null;
}

describe("HkSolarLocationSetting row geometry", () => {
  it("pins the row's cross size to the 28px action square", () => {
    const row = bodyOf(".hk-solar-row");
    expect(row, "the row ruleset exists").not.toBeNull();
    // The single geometric center: the row's cross size is the icon-button
    // square, not the summary's line box.
    expect(row).toMatch(/min-height:\s*var\(--space-28,\s*1\.75rem\)/);
    expect(row).toMatch(/align-items:\s*center/);
  });

  it("pins the summary leading to the resolved font's own metrics", () => {
    const summary = bodyOf(".hk-solar-summary");
    expect(summary, "the summary ruleset exists").not.toBeNull();
    // `normal` — NOT a hand-picked multiplier: fixed 1em/1.2em line boxes
    // clipped descenders in Latin, Arabic and CJK fallback faces (the text
    // clips at the ellipsis via overflow:hidden).
    expect(summary).toMatch(/line-height:\s*normal/);
  });

  it("keeps the glyph box leading-free", () => {
    const icon = bodyOf(".hk-solar-summary-icon");
    expect(icon, "the glyph ruleset exists").not.toBeNull();
    expect(icon).toMatch(/line-height:\s*0/);
  });

  it("collapses the screen-reader reason without display:none", () => {
    const reason = bodyOf(".hk-solar-edit-reason");
    expect(reason, "the reason ruleset exists").not.toBeNull();
    // display:none would drop the span from the accessibility tree, which
    // defeats the aria-describedby contract; the clip pair hides it
    // visually while keeping it readable.
    expect(reason).not.toMatch(/display:\s*none/);
    expect(reason).toMatch(/position:\s*absolute/);
    expect(reason).toMatch(/clip-path:\s*inset\(50%\)/);
  });

  it("anchors the reason span inside the wrapper", () => {
    const wrap = bodyOf(".hk-solar-edit-wrap");
    expect(wrap, "the wrapper ruleset exists").not.toBeNull();
    expect(wrap).toMatch(/position:\s*relative/);
  });
});
