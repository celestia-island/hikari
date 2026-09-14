/**
 * Source contract: the toast stacks are floating layers too, so their
 * screen-edge inset rides the same shared --viewport-gutter token as the
 * anchored popups (16px desktop / 8px mobile, hikari #501). Pinned here
 * so a refactor cannot quietly re-hardcode a pixel value or drift the
 * fallback away from the token's declared desktop magnitude.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("toast container viewport gutter contract", () => {
  for (const sheet of ["HkToast.scss", "HkBlockingToast.scss"]) {
    it(`${sheet} pins the container inset to the shared gutter token`, () => {
      const css = readFileSync(join(here, sheet), "utf-8");
      // EVERY inset-inline-end declaration in the sheet must be the
      // gutter var — no re-hardcoded pixel sibling may creep in.
      const decls = css.match(/inset-inline-end:[^;]+;/g) ?? [];
      expect(decls).toEqual(["inset-inline-end: var(--viewport-gutter, 16px);"]);
    });
  }
});
