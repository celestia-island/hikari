import { registerTokenGroup, type TokenGroupDefinition } from "./tokenGroups";

/**
 * Standard theme groups — the token groups hikari registers ITSELF, as
 * opposed to the extension groups a downstream app registers (chest's SCADA
 * palette is the reference). They exist to make already-shipped L2 scale
 * families (see src/scale.scss) reachable from the color scheme dialog
 * instead of being constants a consumer can only fork.
 *
 * Registration is NOT a side effect of importing this module: `initTheme()`
 * calls `registerStandardThemeGroups()` before its first `applyTheme()`, so
 * the group is present in the very first cssvar emission. A consumer that
 * never calls `initTheme()` (tests, SSR, a host with its own theme engine)
 * gets an untouched registry.
 *
 * `shape` — the radius family. Slot values are byte-identical to the L2
 * literals in scale.scss (`--radius-sm: 4px` … `--radius-xl: 16px`) in BOTH
 * modes, which is what makes this group observationally free by default:
 * `applyTheme` only injects vars whose value differs from the static
 * cascade (`pickThemeVarDeltas`), and a group default that matches the
 * stylesheet produces no override at all. Any change to a default here must
 * be matched in scale.scss or every page silently restyles.
 */
export const STANDARD_SHAPE_GROUP_ID = "shape";

const SHAPE_GROUP: TokenGroupDefinition = {
  id: STANDARD_SHAPE_GROUP_ID,
  label: { en: "Shape", "zh-Hans": "形状" },
  slots: [
    {
      key: "radius-sm",
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
      key: "radius-lg",
      cssVar: "--radius-lg",
      kind: "number",
      label: { en: "Large radius", "zh-Hans": "大圆角" },
      defaults: { dark: 12, light: 12 },
      min: 0,
      max: 40,
      step: 1,
      unit: "px",
    },
    {
      key: "radius-xl",
      cssVar: "--radius-xl",
      kind: "number",
      label: { en: "Extra-large radius", "zh-Hans": "超大圆角" },
      defaults: { dark: 16, light: 16 },
      min: 0,
      max: 48,
      step: 1,
      unit: "px",
    },
  ],
};

// Idempotence latch. Registration is keyed by group id (a re-registration
// REPLACES the entry), so calling this twice would otherwise clobber a
// consumer's own replacement of the `shape` group on every initTheme().
let registered = false;

/**
 * Register hikari's standard theme groups. Idempotent: the first call wins,
 * later calls are no-ops, so a host may call it explicitly without having to
 * know whether `initTheme()` already did.
 */
export function registerStandardThemeGroups(): void {
  if (registered) return;
  registered = true;
  registerTokenGroup(SHAPE_GROUP);
}
