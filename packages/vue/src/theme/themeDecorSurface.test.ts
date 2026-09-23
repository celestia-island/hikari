import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as barrel from "../index";
import { themeDecorSlots } from "./themeDecor";
import * as themeBarrel from "./index";

/**
 * The decor surface's public shape.
 *
 * Two contracts that are easy to break silently:
 *
 *  - the symbols are reachable from BOTH barrels (`hikari/theme` and the
 *    package root) — a missing re-export is only discovered by a consumer;
 *  - `themeDecor.ts` imports no components. That is what keeps the component
 *    tree out of the theme module and the useTheme ↔ components cycle out of
 *    the graph; the one file allowed to import both sides is
 *    `standardDecor.ts`, which is the seam.
 *
 * Importing either barrel must stay side-effect free too: nothing registers
 * until someone calls.
 */

const themeDir = resolve(dirname(fileURLToPath(import.meta.url)));

function importSpecifiers(file: string): string[] {
  const source = readFileSync(resolve(themeDir, file), "utf8");
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}

describe("theme decor public surface", () => {
  it("re-exports the registry, the defaults and both components", () => {
    const registryNames = [
      "registerThemeDecor",
      "registerThemeDecorBuiltin",
      "getThemeDecor",
      "themeDecorSlots",
      "themeDecorVersion",
      "isThemeDecorSlot",
      "THEME_DECOR_SLOT_PATTERN",
      "THEME_DECOR_WILDCARD",
    ];
    for (const name of registryNames) {
      expect((themeBarrel as Record<string, unknown>)[name], `theme/index.ts: ${name}`).toBeDefined();
      expect((barrel as Record<string, unknown>)[name], `src/index.ts: ${name}`).toBeDefined();
    }
    for (const name of ["registerStandardThemeDecor", "STANDARD_THEME_DECOR_SLOTS"]) {
      expect((themeBarrel as Record<string, unknown>)[name], `theme/index.ts: ${name}`).toBeDefined();
      expect((barrel as Record<string, unknown>)[name], `src/index.ts: ${name}`).toBeDefined();
    }

    expect(typeof themeBarrel.registerThemeDecor).toBe("function");
    expect(typeof themeBarrel.getThemeDecor).toBe("function");
    expect(typeof themeBarrel.registerStandardThemeDecor).toBe("function");
    expect(themeBarrel.themeDecorVersion.value).toBeTypeOf("number");
    expect(themeBarrel.STANDARD_THEME_DECOR_SLOTS).toContain("status.tray");

    // The components ride the root barrel, where every other component lives.
    expect((barrel.HkThemeDecor as { name?: string }).name).toBe("HkThemeDecor");
    expect((barrel.HkStatusTray as { name?: string }).name).toBe("HkStatusTray");
  });

  it("registers nothing just because the surface was imported", () => {
    // This file imported both barrels above and nothing else has run yet in
    // this module graph.
    expect(themeDecorSlots()).toEqual([]);
  });

  it("keeps component imports out of themeDecor.ts (the seam is standardDecor.ts)", () => {
    const registryImports = importSpecifiers("themeDecor.ts");
    // Positive control: the extractor sees this file's real imports.
    expect(registryImports).toContain("vue");
    expect(registryImports.filter((s) => /components|lucide|\.tsx|\.vue|\.scss/.test(s))).toEqual([]);

    // …and the extractor does detect a component import where one exists.
    const seamImports = importSpecifiers("standardDecor.ts");
    expect(seamImports.filter((s) => s.includes("components/")).length).toBeGreaterThanOrEqual(5);
  });
});
