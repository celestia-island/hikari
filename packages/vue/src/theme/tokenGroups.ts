import { ref, type Ref } from "vue";

import type { ThemeTokenGroupModes, ThemeTokenGroupValues, ThemeTokenRGB } from "./presets";

/**
 * Extension token groups — namespaced color slots beyond the 16 fixed UI
 * tokens (industrial/SCADA theming: wire colors, pipe states, phase marks).
 *
 * A downstream app registers a group (`registerTokenGroup`); hikari then:
 *   - emits `--<groupId>-<slotKey>: "r g b"` CSS vars on every theme apply
 *     (registry defaults as the final fallback when no preset defines them),
 *     and re-applies the current theme right away when a group is
 *     registered after the theme is already live (see `setTokenGroupsReapply`),
 *   - rides the values along with presets and custom themes (both modes),
 *   - exposes them in the color scheme dialog with hue-clamped pickers
 *     (a green wire must stay green: hue locked to center±range, s/l kept
 *     inside safe bands).
 */

export interface HueClamp {
  /** Band center in degrees (circular). */
  center: number;
  /** Allowed distance from the center in degrees, both directions. */
  range: number;
}

export interface TokenGroupSlot {
  /** cssvar suffix → `--<groupId>-<key>` */
  key: string;
  /** i18n key suffix — the dialog renders t(`hikari::theme.groups.${groupId}.${key}`) with fallback to this string. */
  label: string;
  defaults: { dark: ThemeTokenRGB; light: ThemeTokenRGB };
  /** Picker hue clamp: hue locked to center±range (degrees, circular). */
  hueClamp?: HueClamp;
  /** Saturation / lightness safe bands, 0–1. */
  sRange?: [number, number];
  lRange?: [number, number];
  /** Two-tone slot pair (e.g. PE wire a/b stripes): key of the sibling slot. */
  pairWith?: string;
}

export interface TokenGroupDefinition {
  /** cssvar prefix → `--<id>-<slotKey>` */
  id: string;
  /** i18n key fallback for the group title. */
  label: string;
  slots: TokenGroupSlot[];
}

/** Per-group slot values: `groups[groupId][slotKey] = rgb`. */
export type { ThemeTokenGroupValues, ThemeTokenGroupModes };

/** Fully resolved group values for one mode (every registered slot present). */
export type ResolvedGroupTokens = ThemeTokenGroupValues;

const registry = new Map<string, TokenGroupDefinition>();

// Reactive registry version: bumps on every registration so UI derived
// from the registry (e.g. the color scheme dialog's group sections) can
// track groups registered after it first rendered.
const registryVersion = ref(0);
/** Read-only view of the registry version — consumers never bump it manually. */
export const tokenGroupsVersion: Readonly<Ref<number>> = registryVersion;

/**
 * "Re-apply the current theme" callback injected by useTheme (which this
 * module must not import — that would be a cycle). When present, every
 * registration re-emits the theme cssvars through a microtask-coalesced
 * call, so groups registered after `initTheme()` land their
 * `--<group>-<slot>` vars immediately instead of waiting for the next
 * theme/mode switch.
 */
export type TokenGroupsReapplyFn = () => void;

let reapplyFn: TokenGroupsReapplyFn | null = null;
let reapplyScheduled = false;

/**
 * Install (or clear, with null) the re-apply callback. Returns the
 * previously installed callback so callers (and tests) can restore it.
 * hikari wires this automatically in useTheme; applications normally
 * never call it.
 */
export function setTokenGroupsReapply(fn: TokenGroupsReapplyFn | null): TokenGroupsReapplyFn | null {
  const previous = reapplyFn;
  reapplyFn = fn;
  return previous;
}

/** Coalesce same-tick registrations into one re-apply (microtask flush). */
function scheduleReapply(): void {
  if (reapplyScheduled || !reapplyFn) return;
  reapplyScheduled = true;
  queueMicrotask(() => {
    reapplyScheduled = false;
    try {
      reapplyFn?.();
    } catch {
      // A failing re-apply must never break the registration itself.
    }
  });
}

/** Deep-copy a slot (defaults + clamp bands) so registry and callers never share state. */
function cloneSlot(slot: TokenGroupSlot): TokenGroupSlot {
  return {
    ...slot,
    defaults: {
      dark: { ...slot.defaults.dark },
      light: { ...slot.defaults.light },
    },
    hueClamp: slot.hueClamp ? { ...slot.hueClamp } : undefined,
    sRange: slot.sRange ? [...slot.sRange] : undefined,
    lRange: slot.lRange ? [...slot.lRange] : undefined,
  };
}

/**
 * Register (or replace — idempotent by id) an extension token group.
 * The definition is deep-copied so later mutation by the caller cannot
 * desync the registry. Registering after the theme is live re-emits the
 * theme cssvars (microtask-coalesced) so the new group's vars appear
 * immediately.
 */
export function registerTokenGroup(def: TokenGroupDefinition): void {
  registry.set(def.id, { ...def, slots: def.slots.map(cloneSlot) });
  registryVersion.value++;
  scheduleReapply();
}

/**
 * All registered groups, in registration order. Returns fresh copies —
 * treat the definitions as immutable and re-register to change them.
 */
export function getTokenGroups(): readonly TokenGroupDefinition[] {
  return [...registry.values()].map((group) => ({ ...group, slots: group.slots.map(cloneSlot) }));
}

/**
 * Resolve every registered group/slot for a mode:
 * `overrides?.[group]?.[slot] ?? slot.defaults[mode]`. Unregistered
 * override entries are ignored; returned values are fresh copies.
 */
export function resolveGroupTokens(
  mode: "dark" | "light",
  overrides?: ThemeTokenGroupValues,
): ResolvedGroupTokens {
  const resolved: ResolvedGroupTokens = {};
  for (const group of registry.values()) {
    const slots: Record<string, ThemeTokenRGB> = {};
    for (const slot of group.slots) {
      const override = overrides?.[group.id]?.[slot.key];
      const value = override ?? slot.defaults[mode];
      slots[slot.key] = { r: value.r, g: value.g, b: value.b };
    }
    resolved[group.id] = slots;
  }
  return resolved;
}

// ── RGB ↔ HSL helpers ─────────────────────────────────────────────

export interface ColorHSL {
  h: number;
  s: number;
  l: number;
}

export function wrapHue(h: number): number {
  return ((h % 360) + 360) % 360;
}

export function rgbToHsl({ r, g, b }: ThemeTokenRGB): ColorHSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  } else if (max === gn) {
    h = ((bn - rn) / d + 2) * 60;
  } else {
    h = ((rn - gn) / d + 4) * 60;
  }
  return { h: wrapHue(h), s, l };
}

export function hslToRgb({ h, s, l }: ColorHSL): ThemeTokenRGB {
  const hp = wrapHue(h) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Signed shortest circular distance from `center` to `h`, in
 * [-180, 180) — the exactly-opposite angle maps to -180. Both inputs
 * are normalized first.
 */
export function hueDelta(h: number, center: number): number {
  return ((wrapHue(h) - wrapHue(center) + 540) % 360) - 180;
}

/** Clamp a hue to the circular band `center ± range`. */
export function clampHue(h: number, center: number, range: number): number {
  const delta = Math.max(-range, Math.min(range, hueDelta(h, center)));
  return wrapHue(wrapHue(center) + delta);
}

function clampRange01(v: number, range?: [number, number]): number {
  if (!range) return v;
  return Math.max(range[0], Math.min(range[1], v));
}

/**
 * Clamp an arbitrary color into the hue/saturation/lightness bands.
 * Colors already inside every band round-trip through HSL unchanged
 * (integer RGB is reproduced exactly up to float rounding).
 */
export function clampRgbToBands(
  color: ThemeTokenRGB,
  hueClamp?: HueClamp,
  sRange?: [number, number],
  lRange?: [number, number],
): ThemeTokenRGB {
  if (!hueClamp && !sRange && !lRange) return { r: color.r, g: color.g, b: color.b };
  const hsl = rgbToHsl(color);
  if (hueClamp) hsl.h = clampHue(hsl.h, hueClamp.center, hueClamp.range);
  hsl.s = clampRange01(hsl.s, sRange);
  hsl.l = clampRange01(hsl.l, lRange);
  return hslToRgb(hsl);
}

/** Defense-in-depth clamping of a value destined for one slot. */
export function clampToSlot(slot: TokenGroupSlot, color: ThemeTokenRGB): ThemeTokenRGB {
  return clampRgbToBands(color, slot.hueClamp, slot.sRange, slot.lRange);
}

/**
 * Render resolved group values as CSS custom properties:
 * `{ "--<group>-<slot>": "r g b" }` — ready to merge into the theme
 * cssvar map (values feed `rgb(var(--…))` consumers).
 */
export function groupTokensToCSSVars(
  resolved: ResolvedGroupTokens,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [groupId, slots] of Object.entries(resolved)) {
    for (const [slotKey, rgb] of Object.entries(slots)) {
      vars[`--${groupId}-${slotKey}`] = `${rgb.r} ${rgb.g} ${rgb.b}`;
    }
  }
  return vars;
}
