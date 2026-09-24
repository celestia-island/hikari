import { describe, expect, it } from "vitest";

import {
  getShaderPreset,
  listShaderPresetIds,
  registerShaderPresets,
} from "./wallpaperShaderPresets";

// NOTE (test-order): the "ships an empty table" block relies on running
// before any registration below; vitest executes describes in file order.
// Later blocks use dedicated ids so an ordering change cannot alias them.
describe("wallpaperShaderPresets builtin default", () => {
  it("ships an empty table — hikari bundles no GLSL of its own", () => {
    expect(listShaderPresetIds()).toEqual([]);
    expect(getShaderPreset("omphalos.dark")).toBeNull();
    expect(getShaderPreset("anything")).toBeNull();
  });
});

describe("registerShaderPresets", () => {
  it("registers a preset under its record key and fills `id` from it", () => {
    registerShaderPresets({
      "reg.full": {
        fragment: "// frag",
        texture: "data:image/webp;base64,zz",
        render: { desktop: 1.5, mobile: "1.0" },
        overlay: { light: "rgb(255 255 255 / 55%)", dark: "rgb(0 0 0 / 35%)" },
      },
    });
    const preset = getShaderPreset("reg.full");
    expect(preset).not.toBeNull();
    expect(preset!.id).toBe("reg.full");
    expect(preset!.fragment).toBe("// frag");
    expect(preset!.texture).toBe("data:image/webp;base64,zz");
    expect(preset!.overlay).toEqual({
      light: "rgb(255 255 255 / 55%)",
      dark: "rgb(0 0 0 / 35%)",
    });
    expect(preset!.render!.desktop).toBe(1.5);
    expect(listShaderPresetIds()).toContain("reg.full");
  });

  it("re-registering an id overrides the previous entry in place", () => {
    registerShaderPresets({ "reg.over": { fragment: "// first" } });
    registerShaderPresets({ "reg.over": { fragment: "// second" } });
    const preset = getShaderPreset("reg.over");
    expect(preset!.fragment).toBe("// second");
    // Override, not append: the id appears exactly once.
    expect(listShaderPresetIds().filter((id) => id === "reg.over")).toHaveLength(1);
  });

  it("accepts prototype-member ids without shadowing anything", () => {
    // A plain-object registry would let "toString" collide with the
    // prototype member; the Map must hold it as an ordinary key.
    registerShaderPresets({ toString: { fragment: "// literal key" } });
    expect(getShaderPreset("toString")!.fragment).toBe("// literal key");
    expect(listShaderPresetIds()).toContain("toString");
  });

  it("throws loudly on an empty preset id", () => {
    expect(() => registerShaderPresets({ "": { fragment: "// frag" } })).toThrow(
      /empty id/,
    );
  });

  it("throws loudly on a missing or empty fragment", () => {
    expect(() =>
      registerShaderPresets({ "reg.bad": { fragment: "" } }),
    ).toThrow(/without a fragment shader/);
    expect(() =>
      registerShaderPresets({ "reg.bad2": {} as never }),
    ).toThrow(/without a fragment shader/);
  });

  it("shallow-copies the overlay so later host mutation cannot desync the registry", () => {
    const overlay = { light: "rgb(255 0 0 / 10%)", dark: "rgb(0 0 0 / 10%)" };
    registerShaderPresets({ "reg.copy": { fragment: "// frag", overlay } });
    overlay.light = "rgb(0 255 0 / 90%)";
    expect(getShaderPreset("reg.copy")!.overlay!.light).toBe("rgb(255 0 0 / 10%)");
  });
});

describe("mobile scale formula evaluation", () => {
  it("evaluates an arithmetic formula with the live aspect", () => {
    registerShaderPresets({
      "scale.formula": {
        fragment: "// frag",
        render: { desktop: 1.8, mobile: "Math.min(4.0, 2.88 / aspect)" },
      },
    });
    const render = getShaderPreset("scale.formula")!.render!;
    expect(render.desktop).toBe(1.8);
    // Below aspect 0.72 the raw curve (2.88 / aspect) exceeds the 4.0
    // ceiling and clamps — 2.88 / 0.45 = 6.4 → 4.0.
    expect(render.mobile(0.45)).toBe(4.0);
    expect(render.mobile(0.8)).toBeCloseTo(2.88 / 0.8, 10);
    // Wide aspects fall below the ceiling and follow the raw curve.
    expect(render.mobile(2.0)).toBeCloseTo(2.88 / 2.0, 10);
  });

  it("evaluates plain arithmetic without function calls", () => {
    registerShaderPresets({
      "scale.arith": {
        fragment: "// frag",
        render: { desktop: 1.2, mobile: "1.0 + 0.5 * aspect" },
      },
    });
    const render = getShaderPreset("scale.arith")!.render!;
    expect(render.mobile(0.5)).toBeCloseTo(1.25, 10);
    expect(render.mobile(0.72)).toBeCloseTo(1.36, 10);
  });

  it("falls back to the constant desktop scale when the charset is rejected", () => {
    registerShaderPresets({
      "scale.charset": {
        fragment: "// frag",
        render: { desktop: 0.9, mobile: "aspect ^ 2" },
      },
    });
    const render = getShaderPreset("scale.charset")!.render!;
    expect(render.mobile(0.3)).toBe(0.9);
    expect(render.mobile(2.0)).toBe(0.9);
  });

  it("falls back to the constant desktop scale when the formula parses to NaN", () => {
    // Passes the charset gate but the evaluator cannot parse it
    // (function-call syntax) — the Number.isFinite guard carried from
    // chest's registry keeps NaN out of the u_scale uniform.
    registerShaderPresets({
      "scale.nan": {
        fragment: "// frag",
        render: { desktop: 1.4, mobile: "Math.pow(aspect, 2)" },
      },
    });
    const render = getShaderPreset("scale.nan")!.render!;
    expect(render.mobile(0.5)).toBe(1.4);
    expect(render.mobile(1.7)).toBe(1.4);
  });

  it("accepts a host closure and gates its NaN through the same finite guard", () => {
    registerShaderPresets({
      "scale.fn": {
        fragment: "// frag",
        render: {
          desktop: 1.8,
          mobile: (a) => (a > 0 ? 2.88 / a : Number.NaN),
        },
      },
    });
    const render = getShaderPreset("scale.fn")!.render!;
    expect(render.mobile(0.5)).toBeCloseTo(5.76, 10);
    expect(render.mobile(-1)).toBe(1.8);
  });

  it("leaves no render config when the host declares none", () => {
    registerShaderPresets({ "scale.none": { fragment: "// frag" } });
    expect(getShaderPreset("scale.none")!.render).toBeUndefined();
  });
});
