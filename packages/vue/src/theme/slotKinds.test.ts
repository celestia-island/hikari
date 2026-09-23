import { beforeEach, describe, expect, it } from "vitest";

import { tokensToCSSVars, themePresets, type ThemeTokenRGB } from "./presets";
import {
  clampToSlot,
  getTokenGroups,
  groupTokensToCSSVars,
  isColorSlot,
  isEnumSlot,
  isNumberSlot,
  parseTokenGroupConfig,
  registerTokenGroup,
  registerTokenGroupConfig,
  resolveGroupTokens,
  rgbToHsl,
  tokenGroupSlotCssVar,
  tokenGroupSlotKind,
  type TokenColorSlot,
  type TokenEnumSlot,
  type TokenGroupDefinition,
  type TokenGroupSlot,
  type TokenNumberSlot,
} from "./tokenGroups";

/**
 * Widened slot kinds — number and enum slots beside the color slots that
 * predate them (see the kind table in tokenGroups.ts).
 *
 * tokenGroups.test.ts pins the COLOR behavior end to end; this file adds
 * (a) the explicit control that the widening left that behavior untouched,
 * and (b) the new kinds through the whole pipeline: registry → resolve →
 * serialize → clamp → config-file parsing → registry isolation.
 */

const KIND_GROUP: TokenGroupDefinition = {
  id: "kinds",
  label: { en: "Kinds", "zh-Hans": "种类" },
  slots: [
    {
      key: "radius-sm",
      // Targets an existing L2 scale token instead of a group-scoped name.
      cssVar: "--radius-sm",
      kind: "number",
      label: { en: "Small radius", "zh-Hans": "小圆角" },
      defaults: { dark: 4, light: 4 },
      min: 0,
      max: 24,
      step: 1,
      unit: "px",
    },
    {
      key: "gap",
      kind: "number",
      label: "Gap",
      defaults: { dark: 4, light: 6 },
      min: 0,
      max: 20,
      step: 2,
    },
    {
      key: "density",
      kind: "enum",
      label: "Density",
      defaults: { dark: "compact", light: "cozy" },
      options: [
        { value: "compact", label: { en: "Compact", "zh-Hans": "紧凑" } },
        { value: "cozy", label: "Cozy" },
      ],
    },
    {
      // The legacy form: no `kind` at all — this is what every SCADA
      // palette in the wild is written as.
      key: "wire",
      label: "Wire",
      defaults: { dark: { r: 220, g: 60, b: 60 }, light: { r: 180, g: 40, b: 40 } },
      hueClamp: { center: 0, range: 20 },
    },
  ],
};

function kindSlot(key: string): TokenNumberSlot | TokenEnumSlot | TokenColorSlot {
  const found = (KIND_GROUP.slots ?? []).find((s) => s.key === key);
  if (!found) throw new Error(`unknown slot ${key}`);
  return found;
}

function numberSlot(key: string): TokenNumberSlot {
  return kindSlot(key) as TokenNumberSlot;
}

function enumSlot(key: string): TokenEnumSlot {
  return kindSlot(key) as TokenEnumSlot;
}

function colorSlot(key: string): TokenColorSlot {
  return kindSlot(key) as TokenColorSlot;
}

beforeEach(() => {
  registerTokenGroup(KIND_GROUP);
});

describe("slot kind discrimination", () => {
  it("reads a missing kind as color and an explicit one as declared", () => {
    expect(tokenGroupSlotKind(colorSlot("wire"))).toBe("color");
    expect(tokenGroupSlotKind(numberSlot("gap"))).toBe("number");
    expect(tokenGroupSlotKind(enumSlot("density"))).toBe("enum");
  });

  it("names the cssvar through cssVar when present, else group-scoped", () => {
    expect(tokenGroupSlotCssVar("kinds", numberSlot("radius-sm"))).toBe("--radius-sm");
    expect(tokenGroupSlotCssVar("kinds", numberSlot("gap"))).toBe("--kinds-gap");
    expect(tokenGroupSlotCssVar("kinds", colorSlot("wire"))).toBe("--kinds-wire");
  });
});

describe("slot kind type predicates", () => {
  /**
   * The narrowing form of the discrimination above. `kindSlot()` hands back
   * the bare `TokenGroupSlot` union — the shape a consumer's own loop sees —
   * so only a predicate can unlock a kind's fields:
   *
   *   if (tokenGroupSlotKind(slot) !== "color") return;
   *   slot.hueClamp;   // still a type error: a plain function does not narrow
   *
   * The helper below is that compile-time proof. Every arm reads a field that
   * exists on ONE member of the union, with no cast and no `as` anywhere; if a
   * predicate stops narrowing, `vue-tsc --noEmit` fails on this file.
   */
  function describeSlot(slot: TokenGroupSlot): string {
    if (isColorSlot(slot)) return `color:${slot.hueClamp?.center ?? "free"}`;
    if (isNumberSlot(slot)) return `number:${slot.min}-${slot.max}/${slot.step}`;
    if (isEnumSlot(slot)) return `enum:${slot.options.map((option) => option.value).join("|")}`;
    throw new Error("unreachable slot kind");
  }

  it("reads a slot with no kind as color, and narrows it to the color fields", () => {
    const wire: TokenGroupSlot = kindSlot("wire");
    expect(wire.kind).toBeUndefined();
    expect(isColorSlot(wire)).toBe(true);
    expect(isNumberSlot(wire)).toBe(false);
    expect(isEnumSlot(wire)).toBe(false);

    // The narrowing itself: hueClamp lives on TokenColorSlot only.
    if (!isColorSlot(wire)) throw new Error("wire must be a color slot");
    expect(wire.hueClamp).toEqual({ center: 0, range: 20 });
    expect(wire.sRange).toBeUndefined();
  });

  it("narrows number slots to min/max/step and enum slots to options", () => {
    const gap: TokenGroupSlot = kindSlot("gap");
    expect(isNumberSlot(gap)).toBe(true);
    if (!isNumberSlot(gap)) throw new Error("gap must be a number slot");
    expect([gap.min, gap.max, gap.step]).toEqual([0, 20, 2]);

    const density: TokenGroupSlot = kindSlot("density");
    expect(isEnumSlot(density)).toBe(true);
    if (!isEnumSlot(density)) throw new Error("density must be an enum slot");
    expect(density.options.map((option) => option.value)).toEqual(["compact", "cozy"]);
  });

  it("agrees with tokenGroupSlotKind — exactly one predicate per slot", () => {
    for (const key of ["wire", "gap", "radius-sm", "density"]) {
      const slot: TokenGroupSlot = kindSlot(key);
      const hits = [isColorSlot(slot), isNumberSlot(slot), isEnumSlot(slot)];
      expect(hits.filter(Boolean), `${key} matches one kind`).toHaveLength(1);
      expect(isColorSlot(slot) ? "color" : isNumberSlot(slot) ? "number" : "enum").toBe(
        tokenGroupSlotKind(slot),
      );
    }
  });

  it("routes every kind through the narrowing helper", () => {
    expect(describeSlot(kindSlot("wire"))).toBe("color:0");
    expect(describeSlot(kindSlot("gap"))).toBe("number:0-20/2");
    expect(describeSlot(kindSlot("radius-sm"))).toBe("number:0-24/1");
    expect(describeSlot(kindSlot("density"))).toBe("enum:compact|cozy");
  });
});

describe("number slots", () => {
  it("serializes as value+unit, and routes the var through cssVar", () => {
    const defaultVars = groupTokensToCSSVars(resolveGroupTokens("dark"));
    expect(defaultVars["--radius-sm"]).toBe("4px");

    const edited = groupTokensToCSSVars(
      resolveGroupTokens("dark", { kinds: { "radius-sm": 8 } }),
    );
    expect(edited["--radius-sm"]).toBe("8px");
    // cssVar IS the target: the group-scoped default name is never emitted.
    expect(edited["--kinds-radius-sm"]).toBeUndefined();
  });

  it("appends no unit when the slot declares none, and follows the mode", () => {
    expect(groupTokensToCSSVars(resolveGroupTokens("dark"))["--kinds-gap"]).toBe("4");
    expect(groupTokensToCSSVars(resolveGroupTokens("light"))["--kinds-gap"]).toBe("6");
    expect(
      groupTokensToCSSVars(resolveGroupTokens("light", { kinds: { gap: 12 } }))["--kinds-gap"],
    ).toBe("12");
  });

  it("resolves number values as primitives, not copies", () => {
    const resolved = resolveGroupTokens("dark");
    expect(resolved.kinds.gap).toBe(4);
    expect(typeof resolved.kinds.gap).toBe("number");
  });
});

describe("enum slots", () => {
  it("serializes as the option string verbatim", () => {
    expect(groupTokensToCSSVars(resolveGroupTokens("dark"))["--kinds-density"]).toBe("compact");
    expect(groupTokensToCSSVars(resolveGroupTokens("light"))["--kinds-density"]).toBe("cozy");
    expect(
      groupTokensToCSSVars(resolveGroupTokens("dark", { kinds: { density: "cozy" } }))[
        "--kinds-density"
      ],
    ).toBe("cozy");
  });

  it("resolves enum values as primitives", () => {
    const resolved = resolveGroupTokens("light");
    expect(resolved.kinds.density).toBe("cozy");
    expect(typeof resolved.kinds.density).toBe("string");
  });
});

describe("color slots after the widening", () => {
  // Explicit control: tokenGroups.test.ts covers this in depth; the point
  // here is that adding the other two kinds changed nothing about it.
  it("keeps the triplet, the group-scoped var name and the copy semantics", () => {
    const resolved = resolveGroupTokens("dark");
    expect(resolved.kinds.wire).toEqual({ r: 220, g: 60, b: 60 });

    // Still a fresh copy: mutating a resolved value must not stick.
    (resolved.kinds.wire as ThemeTokenRGB).r = 0;
    expect(resolveGroupTokens("dark").kinds.wire).toEqual({ r: 220, g: 60, b: 60 });

    const vars = tokensToCSSVars(
      themePresets.default.dark,
      groupTokensToCSSVars(resolveGroupTokens("dark")),
    );
    expect(vars["--kinds-wire"]).toBe("220 60 60");

    // Overrides win, still serialized as an "r g b" triplet.
    expect(
      groupTokensToCSSVars(
        resolveGroupTokens("dark", { kinds: { wire: { r: 1, g: 2, b: 3 } } }),
      )["--kinds-wire"],
    ).toBe("1 2 3");
  });
});

describe("clampToSlot per kind", () => {
  it("clamps a number into [min, max] and onto the step grid", () => {
    const gap = numberSlot("gap"); // 0..20 step 2
    expect(clampToSlot(gap, 7)).toBe(8);
    expect(clampToSlot(gap, 6)).toBe(6);
    expect(clampToSlot(gap, -4)).toBe(0);
    expect(clampToSlot(gap, 999)).toBe(20);
    // Float steps must not leak binary noise into the cssvar.
    const tenths: TokenNumberSlot = {
      key: "tenths",
      kind: "number",
      label: "Tenths",
      defaults: { dark: 0, light: 0 },
      min: 0,
      max: 1,
      step: 0.1,
    };
    expect(clampToSlot(tenths, 0.1 + 0.2)).toBe(0.3);
  });

  it("re-clamps after snapping when the step grid overshoots max", () => {
    const odd: TokenNumberSlot = {
      key: "odd",
      kind: "number",
      label: "Odd",
      defaults: { dark: 0, light: 0 },
      min: 0,
      max: 5,
      step: 2,
    };
    // 5 snaps to 6 on the grid, which is outside the slot — max wins.
    expect(clampToSlot(odd, 5)).toBe(5);
  });

  it("falls back to the dark default for a value of the wrong type", () => {
    expect(clampToSlot(numberSlot("gap"), "nope")).toBe(4);
    expect(clampToSlot(enumSlot("density"), 7)).toBe("compact");
  });

  it("keeps a declared enum option and falls back on an unknown one", () => {
    const density = enumSlot("density");
    expect(clampToSlot(density, "compact")).toBe("compact");
    expect(clampToSlot(density, "cozy")).toBe("cozy");
    // Out of vocabulary → the registry's dark anchor, never the stray value.
    expect(clampToSlot(density, "spacious")).toBe("compact");
  });

  it("keeps the color band behavior (hue clamp) unchanged", () => {
    const wire = colorSlot("wire");
    expect(clampToSlot(wire, { r: 200, g: 60, b: 60 })).toEqual({ r: 200, g: 60, b: 60 });
    expect(rgbToHsl(clampToSlot(wire, { r: 60, g: 60, b: 200 })).h).toBeCloseTo(340, 0);
  });
});

describe("registry isolation for the new kinds", () => {
  it("hands back new-kind definitions as copies callers cannot mutate", () => {
    const group = getTokenGroups().find((g) => g.id === "kinds")!;
    const density = group.slots!.find((s) => s.key === "density") as TokenEnumSlot;
    density.options.push({ value: "spacious", label: "Spacious" });
    density.defaults.dark = "spacious";
    density.options[0].value = "mutated";

    const again = getTokenGroups()
      .find((g) => g.id === "kinds")!
      .slots!.find((s) => s.key === "density") as TokenEnumSlot;
    expect(again).not.toBe(density);
    expect(again.options.map((o) => o.value)).toEqual(["compact", "cozy"]);
    expect(again.defaults.dark).toBe("compact");
  });
});

describe("parseTokenGroupConfig with the new kinds", () => {
  const CONFIG = {
    $schema: "https://celestia.example/palette.v1.json",
    id: "tuning",
    label: { en: "Tuning", "zh-Hans": "调参" },
    slots: [
      {
        key: "radius-md",
        cssVar: "--radius-md",
        kind: "number",
        label: { en: "Medium radius", "zh-Hans": "中圆角" },
        defaults: { dark: 8, light: 8 },
        min: 0,
        max: 32,
        step: 1,
        unit: "px",
      },
      {
        key: "density",
        kind: "enum",
        label: "Density",
        defaults: { dark: "compact", light: "cozy" },
        options: [
          { value: "compact", label: { en: "Compact", "zh-Hans": "紧凑" } },
          { value: "cozy", label: "Cozy" },
        ],
      },
      // Kind-less slot: still parsed as a color (backward compatibility).
      { key: "legacy", label: "Legacy color", defaults: { dark: [1, 2, 3], light: [4, 5, 6] } },
    ],
  };

  it("parses number/enum slots, keeps kind-less slots as colors, and registers", () => {
    const result = parseTokenGroupConfig(CONFIG);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const slots = result.group.slots!;
    expect(slots[0]).toMatchObject({
      kind: "number",
      cssVar: "--radius-md",
      min: 0,
      max: 32,
      step: 1,
      unit: "px",
    });
    expect(slots[1]).toMatchObject({ kind: "enum", defaults: { dark: "compact", light: "cozy" } });
    expect((slots[1] as TokenEnumSlot).options.map((o) => o.value)).toEqual(["compact", "cozy"]);
    expect(slots[2].kind).toBeUndefined();
    expect(tokenGroupSlotKind(slots[2])).toBe("color");

    // Parsed configs register and serialize exactly like hand-built ones.
    expect(registerTokenGroupConfig(CONFIG).ok).toBe(true);
    expect(groupTokensToCSSVars(resolveGroupTokens("dark"))["--radius-md"]).toBe("8px");
    expect(groupTokensToCSSVars(resolveGroupTokens("dark"))["--tuning-density"]).toBe("compact");
  });

  it("reports every number/enum/cssVar problem at once", () => {
    const result = parseTokenGroupConfig({
      id: "broken",
      label: "Broken",
      slots: [
        // Out-of-range dark default, non-positive step, non-string unit.
        {
          key: "n",
          kind: "number",
          label: "n",
          defaults: { dark: 99, light: 1 },
          min: 0,
          max: 10,
          step: 0,
          unit: 5,
        },
        // Empty option list plus defaults outside the (empty) vocabulary.
        {
          key: "e",
          kind: "enum",
          label: "e",
          defaults: { dark: "ghost", light: "a" },
          options: [],
        },
        { key: "k", kind: "bogus", label: "k", defaults: { dark: 1, light: 1 } },
        {
          key: "c",
          label: "c",
          defaults: { dark: [1, 2, 3], light: [4, 5, 6] },
          cssVar: "radius",
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const has = (needle: string) => result.errors.some((e) => e.includes(needle));
    expect(has("slots[0].defaults.dark")).toBe(true);
    expect(has("slots[0].step")).toBe(true);
    expect(has("slots[0].unit")).toBe(true);
    expect(has("slots[1].options")).toBe(true);
    expect(has("slots[1].defaults.dark")).toBe(true);
    expect(has("slots[2].kind")).toBe(true);
    expect(has("slots[3].cssVar")).toBe(true);
  });

  it("flags two slots aimed at the same cssvar", () => {
    const result = parseTokenGroupConfig({
      id: "collide",
      label: "Collide",
      slots: [
        {
          key: "a",
          cssVar: "--radius-md",
          kind: "number",
          label: "a",
          defaults: { dark: 2, light: 2 },
          min: 0,
          max: 4,
          step: 1,
        },
        {
          key: "b",
          cssVar: "--radius-md",
          kind: "number",
          label: "b",
          defaults: { dark: 3, light: 3 },
          min: 0,
          max: 4,
          step: 1,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('duplicate cssvar target "--radius-md"');
  });

  it("refuses a color slot paired with a non-color sibling", () => {
    const result = parseTokenGroupConfig({
      id: "mismatch",
      label: "Mismatch",
      slots: [
        { key: "wire", label: "Wire", defaults: { dark: [1, 2, 3], light: [4, 5, 6] }, pairWith: "gap" },
        {
          key: "gap",
          kind: "number",
          label: "Gap",
          defaults: { dark: 2, light: 2 },
          min: 0,
          max: 8,
          step: 1,
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('"gap", which is not a color slot'))).toBe(true);
  });
});
