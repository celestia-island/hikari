import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(resolve(here, "HkTimePicker.scss"), "utf8");
const tsx = readFileSync(resolve(here, "HkTimePicker.tsx"), "utf8");

/**
 * Source-contract pins for the two fixes a DOM test cannot see: the
 * minute-mode metrics key (the number layer is a sibling of the slider,
 * so `.hk-tp-face.is-minute` can never match) and the shared segmented
 * period control. A SCSS-only edit reintroducing the old selector used
 * to leave every behavioral test green; this file is the missing guard.
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
});
