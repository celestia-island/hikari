import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * Host-reset composition guard.
 *
 * reset.scss is the base normalization every hikari host needs (measured
 * 2026-09-14 in the flasher: without it the UA typography chain inflates
 * the component wrappers — sign-in fields ~100px vs ~40px with it). Hosts
 * that historically rode a utility-layer preflight (chest: UnoCSS, with
 * preflight later disabled) no longer need a hand-rolled equivalent.
 *
 * The contract under test: the canonical composition (index.scss) loads
 * the reset FIRST, and the reset actually normalizes the native control
 * typography chain — the exact rules the flasher regression hinged on.
 */

const stylesDir = resolve(dirname(fileURLToPath(import.meta.url)));

function read(path: string): string {
  return readFileSync(resolve(stylesDir, path), "utf8").replace(/\r\n/g, "\n");
}

describe("host reset sheet", () => {
  it("loads first in the canonical composition", () => {
    const index = read("index.scss");
    const first = index.match(/^@use "([^"]+)";/m)?.[1];
    expect(first).toBe("./reset.scss");
  });

  it("normalizes the native control typography chain", () => {
    const reset = read("reset.scss");
    for (const selector of ["button,", "input,", "textarea"]) {
      expect(reset).toContain(selector);
    }
    expect(reset).toContain("font: inherit");
    expect(reset).toContain("line-height: inherit");
    expect(reset).toContain("box-sizing: border-box");
  });
});
