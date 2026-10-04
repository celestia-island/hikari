/**
 * Style contract (house pattern: HkAboutModal.styles.test.ts) — the
 * section card's class↔rule wiring. `sheetCompile.test.ts` proves every
 * sheet COMPILES; nothing else proves the classes the component emits are
 * the ones the sheet styles, so a rename on either side would silently
 * orphan the rule (the #493 failure mode).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tsx = readFileSync(join(here, "HkSectionCard.tsx"), "utf-8");
const scss = readFileSync(join(here, "HkSectionCard.scss"), "utf-8");

/** Every `hk-section-card*` class the component emits. */
function emittedClasses(): string[] {
  const found = new Set<string>();
  for (const m of tsx.matchAll(/"(hk-section-card[a-z-]*)"/g)) found.add(m[1]!);
  for (const m of tsx.matchAll(/\bhk-section-card[a-z-]*\b/g)) found.add(m[0]);
  return [...found].sort();
}

describe("HkSectionCard styles", () => {
  it("emits at least the wrapper and the footer (the guard is not vacuous)", () => {
    const classes = emittedClasses();
    expect(classes).toContain("hk-section-card");
    expect(classes).toContain("hk-section-card-footer");
  });

  it("styles every class the component emits", () => {
    for (const cls of emittedClasses()) {
      expect(scss, `${cls} must have a rule`).toMatch(new RegExp(`\\.${cls}\\s*\\{`));
    }
  });

  it("keeps the intra-section rhythm token on the wrapper and the footer", () => {
    expect(scss).toMatch(/\.hk-section-card\s*\{[^}]*gap:\s*var\(--space-12/);
    expect(scss).toMatch(/\.hk-section-card-footer\s*\{[^}]*gap:\s*var\(--space-4/);
  });
});
