import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addCustomTheme,
  loadCustomThemes,
  saveCustomThemes,
  themePresets,
  tokensToCSSVars,
  type CustomThemePreset,
} from "./presets";
import {
  allGroupSlots,
  clampToSlot,
  getTokenGroups,
  groupTokensToCSSVars,
  parseTokenGroupConfig,
  registerTokenGroup,
  registerTokenGroupConfig,
  resolveGroupTokens,
  resolveLocalizedText,
  rgbToHsl,
  hslToRgb,
  setTokenGroupsReapply,
  tokenGroupsVersion,
  type TokenGroupDefinition,
} from "./tokenGroups";
import { initTheme, useTheme } from "./useTheme";

// Test-only group — hikari itself registers nothing; the mechanism is the
// product and the registration lives in the downstream app.
const TEST_GROUP: TokenGroupDefinition = {
  id: "test-wires",
  label: "Test wires",
  slots: [
    {
      key: "power-l1",
      label: "Power L1",
      defaults: { dark: { r: 220, g: 60, b: 60 }, light: { r: 180, g: 40, b: 40 } },
      hueClamp: { center: 0, range: 20 },
    },
    {
      key: "pipe-h2",
      label: "Pipe H2",
      defaults: { dark: { r: 60, g: 200, b: 120 }, light: { r: 40, g: 160, b: 90 } },
      hueClamp: { center: 140, range: 30 },
      sRange: [0.3, 0.9],
      lRange: [0.25, 0.7],
    },
    {
      key: "bus-n",
      label: "Bus N",
      defaults: { dark: { r: 200, g: 83, b: 60 }, light: { r: 160, g: 63, b: 40 } },
      hueClamp: { center: 350, range: 20 },
    },
    {
      key: "panel",
      label: "Panel",
      defaults: { dark: { r: 90, g: 90, b: 110 }, light: { r: 70, g: 70, b: 90 } },
      sRange: [0.2, 0.8],
      lRange: [0.2, 0.8],
    },
  ],
};

function slot(key: string) {
  const found = (TEST_GROUP.slots ?? []).find((s) => s.key === key);
  if (!found) throw new Error(`unknown slot ${key}`);
  return found;
}

beforeEach(() => {
  registerTokenGroup(TEST_GROUP);
  localStorage.clear();
});

describe("token group registry", () => {
  it("resolves registry defaults per mode and lets overrides win", () => {
    const dark = resolveGroupTokens("dark");
    expect(dark["test-wires"]["power-l1"]).toEqual({ r: 220, g: 60, b: 60 });

    const light = resolveGroupTokens("light");
    expect(light["test-wires"]["power-l1"]).toEqual({ r: 180, g: 40, b: 40 });
    expect(light["test-wires"]["power-l1"]).not.toEqual(dark["test-wires"]["power-l1"]);

    const overridden = resolveGroupTokens("dark", {
      "test-wires": { "power-l1": { r: 1, g: 2, b: 3 } },
      "not-registered": { anything: { r: 9, g: 9, b: 9 } },
    });
    expect(overridden["test-wires"]["power-l1"]).toEqual({ r: 1, g: 2, b: 3 });
    // Slots without an override keep their defaults.
    expect(overridden["test-wires"]["pipe-h2"]).toEqual({ r: 60, g: 200, b: 120 });
    // Unregistered groups never appear in the resolution.
    expect(overridden["not-registered"]).toBeUndefined();
  });

  it("replaces the definition when re-registered with the same id", () => {
    expect(getTokenGroups().filter((g) => g.id === "test-wires")).toHaveLength(1);
    registerTokenGroup({
      id: "test-wires",
      label: "Test wires v2",
      slots: [slot("power-l1")],
    });
    const groups = getTokenGroups().filter((g) => g.id === "test-wires");
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Test wires v2");
    expect(groups[0].slots).toHaveLength(1);
  });

  it("returns resolved values as fresh copies", () => {
    const resolved = resolveGroupTokens("dark");
    resolved["test-wires"]["power-l1"].r = 0;
    expect(resolveGroupTokens("dark")["test-wires"]["power-l1"].r).toBe(220);
  });

  it("returns registry definitions as copies callers cannot mutate", () => {
    const groups = getTokenGroups();
    const wires = groups.find((g) => g.id === "test-wires")!;
    wires.label = "Mutated";
    const wiresSlots = wires.slots!;
    wiresSlots[0].hueClamp = { center: 99, range: 99 };
    wiresSlots[0].defaults.dark = { r: 0, g: 0, b: 0 };
    const again = getTokenGroups().find((g) => g.id === "test-wires")!;
    expect(again.label).toBe("Test wires");
    const againSlots = again.slots!;
    expect(againSlots[0].hueClamp).toEqual({ center: 0, range: 20 });
    expect(againSlots[0].defaults.dark).toEqual({ r: 220, g: 60, b: 60 });
  });
});

describe("clampToSlot", () => {
  it("keeps a hue inside the band unchanged", () => {
    // rgb(200, 60, 60) → hsl(0, 0.56, 0.51); power-l1 allows 0 ± 20°.
    expect(clampToSlot(slot("power-l1"), { r: 200, g: 60, b: 60 })).toEqual({
      r: 200,
      g: 60,
      b: 60,
    });
    // rgb(60, 200, 90) → hue ≈ 132.9°; pipe-h2 allows 140 ± 30°.
    expect(clampToSlot(slot("pipe-h2"), { r: 60, g: 200, b: 90 })).toEqual({
      r: 60,
      g: 200,
      b: 90,
    });
  });

  it("clamps an out-of-band hue to the nearest bound", () => {
    // rgb(60, 60, 200) → hue 240°; power-l1 (0 ± 20°) clamps to 340°.
    const clamped = clampToSlot(slot("power-l1"), { r: 60, g: 60, b: 200 });
    expect(rgbToHsl(clamped).h).toBeCloseTo(340, 0);
  });

  it("allows hues across the 0° wrap and clamps the far side", () => {
    // bus-n: center 350° ± 20° → [330°, 10°]. Hue 10° (rgb 200, 83, 60) is allowed.
    expect(clampToSlot(slot("bus-n"), { r: 200, g: 83, b: 60 })).toEqual({
      r: 200,
      g: 83,
      b: 60,
    });
    // Hue 30° is outside; nearest bound is 10° → same color as above.
    expect(clampToSlot(slot("bus-n"), { r: 200, g: 130, b: 60 })).toEqual({
      r: 200,
      g: 83,
      b: 60,
    });
  });

  it("clamps saturation and lightness into their bands", () => {
    // Pure gray has s = 0; panel demands s ≥ 0.2 (no hue clamp → stays neutral-hued).
    // Integer rgb quantization wiggles the measured s slightly below the
    // bound, so assert the band was reached and re-clamping is a fixed point.
    const saturated = clampToSlot(slot("panel"), { r: 128, g: 128, b: 128 });
    const sat = rgbToHsl(saturated);
    expect(sat.s).toBeCloseTo(0.2, 1);
    expect(clampToSlot(slot("panel"), saturated)).toEqual(saturated);

    // Near-white has l ≈ 0.98; panel caps l at 0.8.
    const dimmed = clampToSlot(slot("panel"), { r: 250, g: 250, b: 250 });
    expect(rgbToHsl(dimmed).l).toBeCloseTo(0.8, 2);
  });

  it("clamps both hue and bands together", () => {
    // Blue (hue 240°, s 0.56, l 0.51) under pipe-h2 (140 ± 30°, s ≤ 0.9, l ∈ [0.25, 0.7]):
    // hue snaps to 170°, s/l already inside their bands.
    const clamped = clampToSlot(slot("pipe-h2"), { r: 60, g: 60, b: 200 });
    const hsl = rgbToHsl(clamped);
    expect(hsl.h).toBeCloseTo(170, 0);
    expect(hsl.s).toBeCloseTo(0.56, 2);
    expect(hsl.l).toBeGreaterThan(0.25);
    expect(hsl.l).toBeLessThan(0.7);
  });

  it("round-trips HSL conversions for exact rgb values", () => {
    expect(hslToRgb(rgbToHsl({ r: 60, g: 200, b: 90 }))).toEqual({ r: 60, g: 200, b: 90 });
    expect(hslToRgb(rgbToHsl({ r: 200, g: 83, b: 60 }))).toEqual({ r: 200, g: 83, b: 60 });
  });
});

describe("group cssvars", () => {
  it("emits --<group>-<slot> vars merged into the scheme map", () => {
    const vars = tokensToCSSVars(
      themePresets.nord.dark,
      groupTokensToCSSVars(resolveGroupTokens("dark")),
    );
    expect(vars["--color-primary"]).toBe("136 192 208");
    expect(vars["--test-wires-power-l1"]).toBe("220 60 60");
    expect(vars["--test-wires-pipe-h2"]).toBe("60 200 120");
    expect(vars["--test-wires-panel"]).toBe("90 90 110");
  });

  it("emits preset-group overrides when provided", () => {
    const vars = tokensToCSSVars(
      themePresets.nord.dark,
      groupTokensToCSSVars(
        resolveGroupTokens("dark", { "test-wires": { "power-l1": { r: 7, g: 8, b: 9 } } }),
      ),
    );
    expect(vars["--test-wires-power-l1"]).toBe("7 8 9");
    // Non-overridden slots still fall back to defaults.
    expect(vars["--test-wires-pipe-h2"]).toBe("60 200 120");
  });

  it("keeps tokensToCSSVars backward compatible without groups", () => {
    const vars = tokensToCSSVars(themePresets.nord.dark);
    expect(vars["--test-wires-power-l1"]).toBeUndefined();
    expect(Object.keys(vars).every((k) => k.startsWith("--color-") || k.startsWith("--hi-"))).toBe(true);
  });
});

describe("custom theme storage with groups", () => {
  const scheme = themePresets.nord.dark;
  const themeWithGroups: CustomThemePreset = {
    id: "custom-theme-1",
    name: "Wired",
    dark: scheme,
    light: themePresets.nord.light,
    groups: {
      dark: { "test-wires": { "power-l1": { r: 210, g: 50, b: 50 } } },
      light: { "test-wires": { "power-l1": { r: 170, g: 30, b: 30 } } },
    },
  };

  it("round-trips groups through localStorage", () => {
    saveCustomThemes([themeWithGroups]);
    const loaded = loadCustomThemes();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].groups).toEqual(themeWithGroups.groups);
  });

  it("still loads old saves that carry no groups", () => {
    localStorage.setItem(
      "hikari-custom-themes",
      JSON.stringify([{ id: "legacy", name: "Legacy", dark: scheme, light: scheme }]),
    );
    const loaded = loadCustomThemes();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("legacy");
    expect(loaded[0].groups).toBeUndefined();
  });

  it("replaces and persists groups via addCustomTheme", () => {
    addCustomTheme(themeWithGroups);
    addCustomTheme({ ...themeWithGroups, groups: { dark: { "test-wires": { "power-l1": { r: 1, g: 2, b: 3 } } } } });
    const loaded = loadCustomThemes();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].groups?.dark?.["test-wires"]?.["power-l1"]).toEqual({ r: 1, g: 2, b: 3 });
  });
});

describe("late registration", () => {
  const LATE_GROUP: TokenGroupDefinition = {
    id: "late-wires",
    label: "Late wires",
    slots: [
      {
        key: "a",
        label: "A",
        defaults: { dark: { r: 1, g: 2, b: 3 }, light: { r: 4, g: 5, b: 6 } },
      },
    ],
  };

  /** Flush all pending microtasks (the re-apply coalescing window). */
  function flushMicrotasks(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("bumps the reactive registry version on every registration", () => {
    const before = tokenGroupsVersion.value;
    registerTokenGroup(TEST_GROUP);
    expect(tokenGroupsVersion.value).toBe(before + 1);
    registerTokenGroup(TEST_GROUP);
    expect(tokenGroupsVersion.value).toBe(before + 2);
  });

  it("re-emits group cssvars immediately when registered after applyTheme", async () => {
    // Apply a theme FIRST (the chest ordering risk), then register.
    const { setMode } = useTheme();
    setMode("dark");
    initTheme();
    const el = document.documentElement;
    expect(el.style.getPropertyValue("--late-wires-a")).toBe("");

    registerTokenGroup(LATE_GROUP);
    await flushMicrotasks();

    // The injected hook re-applied the current dark theme, so the late
    // group's registry defaults are already on the document element.
    expect(el.style.getPropertyValue("--late-wires-a")).toBe("1 2 3");
  });

  it("coalesces same-tick registrations into a single re-apply", async () => {
    const spy = vi.fn();
    const previous = setTokenGroupsReapply(spy);
    try {
      registerTokenGroup(LATE_GROUP);
      registerTokenGroup(TEST_GROUP);
      registerTokenGroup({ ...LATE_GROUP, id: "late-wires-2" });
      await flushMicrotasks();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      setTokenGroupsReapply(previous);
    }
  });

  it("re-applies again for a registration in a later tick", async () => {
    const spy = vi.fn();
    const previous = setTokenGroupsReapply(spy);
    try {
      registerTokenGroup(LATE_GROUP);
      await flushMicrotasks();
      registerTokenGroup({ ...LATE_GROUP, id: "late-wires-3" });
      await flushMicrotasks();
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      setTokenGroupsReapply(previous);
    }
  });
});

// ── LocalizedText + sections + config-file parsing ──────────────────

describe("localized text and sections", () => {
  it("resolves LocalizedText by locale with en and first-value fallbacks", () => {
    const map = { en: "Hydrogen", "zh-Hans": "氢气", ja: "水素" };
    expect(resolveLocalizedText(map, "zh-Hans")).toBe("氢气");
    expect(resolveLocalizedText(map, "fr")).toBe("Hydrogen");
    expect(resolveLocalizedText({ de: "Wasserstoff" }, "fr")).toBe("Wasserstoff");
    expect(resolveLocalizedText("bare string", "zh-Hans")).toBe("bare string");
  });

  it("resolves section slots through allGroupSlots and resolveGroupTokens", () => {
    registerTokenGroup({
      id: "sectioned",
      label: "Sectioned",
      sections: [
        {
          key: "power",
          label: "Power",
          slots: [
            { key: "l1", label: "L1", defaults: { dark: { r: 1, g: 1, b: 1 }, light: { r: 2, g: 2, b: 2 } } },
          ],
        },
        {
          key: "media",
          label: "Media",
          slots: [
            { key: "h2", label: "H2", defaults: { dark: { r: 3, g: 3, b: 3 }, light: { r: 4, g: 4, b: 4 } } },
          ],
        },
      ],
    });
    const resolved = resolveGroupTokens("dark");
    expect(resolved.sectioned.l1).toEqual({ r: 1, g: 1, b: 1 });
    expect(resolved.sectioned.h2).toEqual({ r: 3, g: 3, b: 3 });
    const group = getTokenGroups().find((g) => g.id === "sectioned")!;
    expect(allGroupSlots(group).map((s) => s.key)).toEqual(["l1", "h2"]);
  });
});

describe("parseTokenGroupConfig", () => {
  const VALID = {
    id: "scada",
    label: { en: "SCADA industrial colors", "zh-Hans": "SCADA 工业配色" },
    sections: [
      {
        key: "power",
        label: { en: "Electrical power", "zh-Hans": "电力" },
        slots: [
          {
            key: "power-l1",
            label: { en: "Phase L1 (yellow)", "zh-Hans": "L1 相（黄）" },
            defaults: { dark: [234, 179, 8], light: [161, 98, 7] },
            hueClamp: { center: 45, range: 20 },
            sRange: [0.35, 0.95],
            lRange: [0.25, 0.75],
          },
          {
            key: "power-pe-a",
            label: "PE stripe (green)",
            defaults: { dark: [22, 163, 74], light: [22, 101, 52] },
            pairWith: "power-pe-b",
          },
          {
            key: "power-pe-b",
            label: "PE stripe (yellow)",
            defaults: { dark: [250, 204, 21], light: [202, 138, 4] },
            pairWith: "power-pe-a",
          },
        ],
      },
    ],
  };

  it("parses a valid config into a definition", () => {
    const result = parseTokenGroupConfig(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.group.id).toBe("scada");
    expect(result.group.sections).toHaveLength(1);
    const slot = result.group.sections![0].slots[0];
    expect(slot.defaults.dark).toEqual({ r: 234, g: 179, b: 8 });
    expect(slot.hueClamp).toEqual({ center: 45, range: 20 });
    expect(slot.sRange).toEqual([0.35, 0.95]);
    expect(allGroupSlots(result.group)).toHaveLength(3);
  });

  it("accepts a flat section-less config and a $schema hint", () => {
    const result = parseTokenGroupConfig({
      $schema: "https://celestia.example/palette.v1.json",
      id: "oa-board",
      label: "OA board",
      slots: [
        { key: "todo", label: "Todo", defaults: { dark: [1, 2, 3], light: [4, 5, 6] } },
      ],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects bad ids, bad rgb, empty slots and reports all errors at once", () => {
    // Invalid id is rejected up-front (the group has no usable identity).
    const idRejected = parseTokenGroupConfig({ id: "Bad Id", label: "x", slots: [] });
    expect(idRejected.ok).toBe(false);

    const result = parseTokenGroupConfig({
      id: "bad-values",
      label: "x",
      sections: [
        {
          key: "s",
          label: "s",
          slots: [
            { key: "ok", label: "ok", defaults: { dark: [1, 2, 3], light: [4, 5, 6] } },
            { key: "bad-rgb", label: "x", defaults: { dark: [1, 2], light: [4, 5, 6] } },
            { key: "band-swap", label: "x", defaults: { dark: [1, 2, 3], light: [4, 5, 6] }, sRange: [0.9, 0.1] },
          ],
        },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("slots[1].defaults.dark"))).toBe(true);
    expect(result.errors.some((e) => e.includes("slots[2].sRange"))).toBe(true);
  });

  it("flags dangling pairWith and duplicate slot keys", () => {
    const result = parseTokenGroupConfig({
      id: "dangling",
      label: "x",
      slots: [
        { key: "a", label: "a", defaults: { dark: [1, 2, 3], light: [4, 5, 6] }, pairWith: "ghost" },
        { key: "a", label: "a2", defaults: { dark: [1, 2, 3], light: [4, 5, 6] } },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes("ghost"))).toBe(true);
    expect(result.errors.some((e) => e.includes("duplicate slot key"))).toBe(true);
  });

  it("registerTokenGroupConfig registers valid configs and skips invalid ones", () => {
    const bad = registerTokenGroupConfig({ id: "also-bad", label: "x", slots: [] });
    expect(bad.ok).toBe(false);
    expect(getTokenGroups().some((g) => g.id === "also-bad")).toBe(false);

    const good = registerTokenGroupConfig(VALID);
    expect(good.ok).toBe(true);
    expect(getTokenGroups().some((g) => g.id === "scada")).toBe(true);
  });
});
