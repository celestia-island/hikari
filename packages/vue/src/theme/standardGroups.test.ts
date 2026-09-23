import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { registerStandardThemeGroups, STANDARD_SHAPE_GROUP_ID } from "./standardGroups";
import {
  getTokenGroups,
  groupTokensToCSSVars,
  resolveGroupTokens,
  tokenGroupsVersion,
  type TokenNumberSlot,
} from "./tokenGroups";
import { pickThemeVarDeltas } from "./useTheme";

/**
 * The `shape` standard group — hikari's own token group, shipped to make the
 * L2 radius family configurable.
 *
 * It must be observationally free at its defaults: `applyTheme` injects only
 * the vars whose value differs from the static cascade, so a group whose
 * defaults byte-match src/scale.scss produces no override at all. The drift
 * guard below reads the L2 sheet itself rather than a second hand-copied
 * list, so changing a radius in scale.scss without moving the group default
 * (or the reverse) fails HERE instead of restyling every consumer silently.
 */

const themeDir = resolve(dirname(fileURLToPath(import.meta.url)));
const scaleScss = readFileSync(resolve(themeDir, "..", "scale.scss"), "utf8");

/** `--name: value;` declarations of the L2 sheet, comments stripped. */
function parseScaleVars(source: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of css.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars[match[1]] = match[2].replace(/\s+/g, " ").trim();
  }
  return vars;
}

const SHAPE_KEYS = ["radius-sm", "radius-md", "radius-lg", "radius-xl"];

function shapeSlots(): TokenNumberSlot[] {
  const group = getTokenGroups().find((g) => g.id === STANDARD_SHAPE_GROUP_ID);
  expect(group, "shape group is registered").toBeDefined();
  return group!.slots as TokenNumberSlot[];
}

describe("registerStandardThemeGroups", () => {
  // ORDER MATTERS: this case is the cold-start proof — importing the module
  // (and useTheme with it) registers nothing, so the registry is clean until
  // someone calls. Every later case in this file works on a registry that
  // already carries the group, which is why this one stays first.
  it("registers nothing at import, then registers the shape group exactly once", () => {
    expect(getTokenGroups().some((g) => g.id === STANDARD_SHAPE_GROUP_ID)).toBe(false);

    registerStandardThemeGroups();
    const afterFirstCall = tokenGroupsVersion.value;
    expect(getTokenGroups().filter((g) => g.id === STANDARD_SHAPE_GROUP_ID)).toHaveLength(1);

    // Idempotent: the second call neither re-registers (which would bump the
    // reactive registry version and clobber a consumer's own `shape`) nor throws.
    registerStandardThemeGroups();
    registerStandardThemeGroups();
    expect(tokenGroupsVersion.value).toBe(afterFirstCall);
    expect(getTokenGroups().filter((g) => g.id === STANDARD_SHAPE_GROUP_ID)).toHaveLength(1);
  });

  it("initTheme() puts the shape group into the registry", async () => {
    // Fresh module graph: proves the group lands via initTheme() itself and
    // not because this file registered it in an earlier case.
    vi.resetModules();
    const tokenGroups = await import("./tokenGroups");
    const useTheme = await import("./useTheme");
    expect(tokenGroups.getTokenGroups().some((g) => g.id === STANDARD_SHAPE_GROUP_ID)).toBe(false);

    useTheme.initTheme();

    expect(tokenGroups.getTokenGroups().some((g) => g.id === STANDARD_SHAPE_GROUP_ID)).toBe(true);
  });
});

describe("shape group vs the L2 scale sheet", () => {
  it("declares the four radius stops against their existing cssvars", () => {
    const slots = shapeSlots();
    expect(slots.map((s) => s.key)).toEqual(SHAPE_KEYS);
    for (const slot of slots) {
      expect(slot.kind).toBe("number");
      expect(slot.unit).toBe("px");
      expect(slot.cssVar).toBe(`--${slot.key}`);
    }
  });

  it("serializes every default byte-identically to scale.scss", () => {
    const scaleVars = parseScaleVars(scaleScss);
    // Zero-hit discipline: a mis-typed pattern yields an empty map, and an
    // equality against undefined would then pass vacuously. Pin known
    // positives from the same sheet first.
    expect(Object.keys(scaleVars).length).toBeGreaterThan(40);
    expect(scaleVars["--space-16"]).toBe("1rem");

    const slots = shapeSlots();
    for (const mode of ["dark", "light"] as const) {
      const vars = groupTokensToCSSVars(resolveGroupTokens(mode));
      for (const slot of slots) {
        const target = slot.cssVar!;
        expect(scaleVars[target], `${target} is declared in scale.scss`).toBeDefined();
        expect(vars[target], `${target} is emitted for ${mode}`).toBeDefined();
        expect(vars[target]).toBe(scaleVars[target]);
      }
    }
  });

  it("produces zero cssvar overrides at its default values", () => {
    const scaleVars = parseScaleVars(scaleScss);
    // Positive control on the needle this guard turns on.
    expect(scaleVars["--radius-sm"]).toBe("4px");

    for (const mode of ["dark", "light"] as const) {
      const vars = groupTokensToCSSVars(resolveGroupTokens(mode));
      // The real applyTheme path: everything equal to the static cascade
      // drops out, so a default-valued shape group injects nothing.
      expect(pickThemeVarDeltas(vars, scaleVars)).toEqual({});
    }

    // ...and the filter is not vacuous: a moved slider survives it.
    const moved = groupTokensToCSSVars(resolveGroupTokens("dark", { shape: { "radius-sm": 6 } }));
    expect(pickThemeVarDeltas(moved, scaleVars)).toEqual({ "--radius-sm": "6px" });
  });
});
