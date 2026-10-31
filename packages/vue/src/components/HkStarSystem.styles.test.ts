import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sheet = readFileSync(join(import.meta.dirname, "HkStarSystem.scss"), "utf8");

describe("HkStarSystem chip theme channels", () => {
  it("uses RGB channel tokens through rgb(), never as complete CSS colors", () => {
    expect(sheet).toContain("color: rgb(var(--color-text,");
    expect(sheet).toContain("background: rgb(var(--color-background,");
    expect(sheet).toContain("border: 1px solid rgb(var(--color-border,");
    expect(sheet).not.toContain("color-mix");
  });
});
