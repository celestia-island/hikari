import { describe, expect, it } from "vitest";

import { HK_PAD_VAR, hkPadStyle } from "./containerPad";

/**
 * Direct unit tests for the shared container-padding helper behind every
 * container's `padding` prop (runtime/containerPad).
 *
 * The contract, in one line each:
 * - the token is `--hk-pad`, the ONE custom property every wired
 *   container's padding rule consumes (each with its own legacy
 *   fallback, so an unset token preserves the historical look);
 * - `hkPadStyle` maps the five named steps onto the house spacing scale
 *   (--space-4/8/12/16) verbatim, with fallbacks inlined — the values
 *   must stay pure `var()` references so themes can re-scale them;
 * - an unset prop renders NO declaration at all (an empty style object),
 *   never a default-valued one — the absence IS the legacy default.
 */
describe("HK_PAD_VAR", () => {
  it("is the one shared custom property", () => {
    expect(HK_PAD_VAR).toBe("--hk-pad");
  });
});

describe("hkPadStyle", () => {
  it("maps each step onto the spacing scale", () => {
    expect(hkPadStyle("none")).toEqual({ [HK_PAD_VAR]: "0" });
    expect(hkPadStyle("xs")).toEqual({ [HK_PAD_VAR]: "var(--space-4, 0.25rem)" });
    expect(hkPadStyle("sm")).toEqual({ [HK_PAD_VAR]: "var(--space-8, 0.5rem)" });
    expect(hkPadStyle("md")).toEqual({ [HK_PAD_VAR]: "var(--space-12, 0.75rem)" });
    expect(hkPadStyle("lg")).toEqual({ [HK_PAD_VAR]: "var(--space-16, 1rem)" });
  });

  it("renders no declaration when the prop is unset", () => {
    expect(hkPadStyle(undefined)).toEqual({});
  });
});
