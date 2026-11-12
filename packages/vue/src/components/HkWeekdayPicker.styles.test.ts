import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const scss = readFileSync(resolve(here, "HkWeekdayPicker.scss"), "utf8");
const tsx = readFileSync(resolve(here, "HkWeekdayPicker.tsx"), "utf8");

describe("HkWeekdayPicker source contracts", () => {
  it("rides the shared picker metrics and the family touch targets", () => {
    expect(scss).toContain("var(--hk-picker-cell, 2rem)");
    expect(scss).toContain("var(--hk-picker-wd, 1.25rem)");
    expect(scss).toContain("var(--hk-picker-cell, 2.75rem)");
    expect(scss).toContain("var(--hk-picker-wd, 1.5rem)");
  });

  it("composes the header actions from hikari's buttons", () => {
    expect(tsx).toContain('from "./HkIconButton"');
    expect(tsx).toContain('from "./HkButton"');
    expect(tsx).toContain("<HkIconButton");
    expect(tsx).toContain("<HkButton");
  });
});
