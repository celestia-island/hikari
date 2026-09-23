import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { compile } from "sass";
import { describe, expect, it } from "vitest";

/**
 * Centering contract for the HkOtpInput messages.
 *
 * The cell row (`.hk-otp`) centers itself unconditionally — flex
 * `justify-content: center` with no opt-out — and every host card around
 * it (HkAuthCard header, chest's step-up panel) centers too. The hint and
 * error paragraphs therefore must carry their own `text-align: center`:
 * left at the page's default `start`, the TOTP hint hugged the card's
 * left edge under centered cells (user screenshot on the deployed chest
 * step-up panel, 2026-09-23).
 *
 * The assertions run on the COMPILED sheet, not the source text, so a
 * declaration cannot hide behind SCSS nesting, and comments are stripped
 * first so a commented-out `text-align` cannot keep a hollow guard green.
 */
const componentDir = resolve(dirname(fileURLToPath(import.meta.url)));

function otpCss(): string {
  const file = resolve(componentDir, "HkOtpInput.scss");
  return compile(file, { style: "expanded", loadPaths: [componentDir] }).css.replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

function ruleBody(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return m ? m[1]! : null;
}

describe("HkOtpInput message centering", () => {
  const css = otpCss();

  it("compiles", () => {
    expect(css.length).toBeGreaterThan(0);
    // Sanity anchors so a renamed file cannot hollow this guard.
    expect(css).toContain(".hk-otp-hint");
    expect(css).toContain(".hk-otp-error-msg");
  });

  it("centers the hint under the centered cell row", () => {
    const body = ruleBody(css, ".hk-otp-hint");
    expect(body, "the hint rule exists").not.toBeNull();
    expect(body).toContain("text-align: center");
  });

  it("centers the error message the same way", () => {
    const body = ruleBody(css, ".hk-otp-error-msg");
    expect(body, "the error-message rule exists").not.toBeNull();
    expect(body).toContain("text-align: center");
  });

  it("keeps the row's own centering unconditional", () => {
    // The contract above only makes sense while the row stays centered:
    // if the row ever grows an alignment opt-out, these messages need to
    // follow it instead of pinning `center` outright.
    const body = ruleBody(css, ".hk-otp");
    expect(body, "the row rule exists").not.toBeNull();
    expect(body).toContain("justify-content: center");
  });
});
