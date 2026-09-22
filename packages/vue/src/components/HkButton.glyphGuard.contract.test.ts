import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as sass from "sass";
import { describe, expect, it } from "vitest";

/**
 * Slot-glyph guard contract (2026-09-23).
 *
 * A raw svg passed as HkButton slot content (the lucide `<Icon size={14}/>`
 * child pattern chest uses in every admin table action cell) is a flex
 * item of the button. Under a squeezed host row, the host reset's
 * `svg { max-width: 100% }` clamps the glyph to the button's SHRUNKEN
 * content box: measured 3.3x14 px slivers in ProvidersView, 10x14 in
 * OAuthProvidersView/DeviceModelsView, 0x14 in WebhooksView/GroupTab —
 * the "行内操作按钮莫名其妙很小" report. `.hk-btn > svg { flex: none }`
 * pins the glyph to its intrinsic size; the button's automatic minimum
 * size then covers the full glyph, so an auto-layout table column or
 * toolbar row grows to fit instead of shrinking the controls into
 * slivers. Verified in a real (headless) browser before/after: 3.3px →
 * 14px glyph width at the same viewport.
 *
 * The guard is asserted against the COMPILED sheet, not the source, so
 * a reformat or a selector rename cannot silently unguard it.
 */

const componentsDir = resolve(dirname(fileURLToPath(import.meta.url)));

function compileSheet(): string {
  return sass.compile(join(componentsDir, "HkButton.scss"), {
    loadPaths: [
      resolve(componentsDir, ".."),
      resolve(componentsDir, "../styles"),
      resolve(componentsDir, "../styles/theme"),
    ],
    silenceDeprecations: ["import", "global-builtin", "legacy-js-api"],
  }).css;
}

describe("HkButton slot-glyph guard", () => {
  it("pins direct svg slot glyphs against flex squeeze", () => {
    const css = compileSheet();
    const rule = css.match(/\.hk-btn\s*>\s*svg\s*\{[^}]*\}/);
    expect(rule, "compiled HkButton.scss must carry the .hk-btn > svg guard").toBeTruthy();
    expect(rule![0]).toMatch(/flex:\s*none/);
  });

  it("keeps the icon prop's own fixed boxes flex:none (same contract)", () => {
    const css = compileSheet();
    const block = css.match(/\.hk-btn-icon\s*,\s*\.hk-btn-suffix\s*\{[^}]*\}/);
    expect(block).toBeTruthy();
    expect(block![0]).toMatch(/flex:\s*none/);
  });
});
