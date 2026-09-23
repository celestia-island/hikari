import { ref, type Ref } from "vue";

import type { ThemeTokenGroupModes, ThemeTokenGroupValues, ThemeTokenRGB, ThemeTokenValue } from "./presets";

/**
 * Extension token groups — namespaced slots beyond the 16 fixed UI tokens
 * (industrial/SCADA theming: wire colors, pipe states, phase marks — and,
 * since the slot widening, non-color knobs of an existing scale family).
 *
 * A downstream app registers a group (`registerTokenGroup`); hikari then:
 *   - emits `--<groupId>-<slotKey>` (or the slot's explicit `cssVar`) CSS
 *     vars on every theme apply (registry defaults as the final fallback
 *     when no preset defines them), and re-applies the current theme right
 *     away when a group is registered after the theme is already live (see
 *     `setTokenGroupsReapply`),
 *   - rides the values along with presets and custom themes (both modes),
 *   - exposes them in the color scheme dialog: hue-clamped pickers for
 *     color slots (a green wire must stay green: hue locked to center±range,
 *     s/l kept inside safe bands), sliders for number slots and segmented
 *     tabs for enum slots.
 *
 * Three slot kinds share one shape (kind-less slots stay COLOR — the
 * pre-widening form every existing SCADA palette is written in):
 *   color  → `"r g b"` triplet, clamped into the hue/s/l bands
 *   number → `${value}${unit}`, clamped into [min, max] and onto the step grid
 *   enum   → the option string verbatim, snapped back to the option list
 */

export interface HueClamp {
  /** Band center in degrees (circular). */
  center: number;
  /** Allowed distance from the center in degrees, both directions. */
  range: number;
}

/**
 * Localized text — a bare string (legacy / single-locale) or a locale →
 * string map carried inside palette config files (`webui palettes/*.json`).
 * Resolution order: exact locale → `en` → first defined value.
 */
export type LocalizedText = string | { [locale: string]: string };

/** Pick the best string out of a LocalizedText for the active locale. */
export function resolveLocalizedText(text: LocalizedText, locale: string): string {
  if (typeof text === "string") return text;
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? "";
}

/** Slot value kinds a token group can carry. */
export type TokenGroupSlotKind = "color" | "number" | "enum";

/**
 * Fields every slot carries, whatever its kind. `key` still forms the
 * default cssvar name; a slot that targets an EXISTING scale token (e.g.
 * `--radius-md`) names it through `cssVar` instead of duplicating the name
 * by hand into a group id.
 */
interface TokenGroupSlotBase {
  /** cssvar suffix → `--<groupId>-<key>` unless `cssVar` overrides it. */
  key: string;
  /** Display label — bare string or per-locale map (config files). */
  label: LocalizedText;
  /** Explicit target cssvar; defaults to `--<groupId>-<key>`. */
  cssVar?: string;
}

/** Color slot: an rgb triplet both modes, hue/s/l clamped (the default kind). */
export interface TokenColorSlot extends TokenGroupSlotBase {
  /** Discriminant; absent means `"color"` (every legacy registration). */
  kind?: "color";
  defaults: { dark: ThemeTokenRGB; light: ThemeTokenRGB };
  /** Picker hue clamp: hue locked to center±range (degrees, circular). */
  hueClamp?: HueClamp;
  /** Saturation / lightness safe bands, 0–1. */
  sRange?: [number, number];
  lRange?: [number, number];
  /** Two-tone slot pair (e.g. PE wire a/b stripes): key of the sibling slot. */
  pairWith?: string;
}

/** Number slot: a numeric scale constant, rendered as a slider. */
export interface TokenNumberSlot extends TokenGroupSlotBase {
  kind: "number";
  defaults: { dark: number; light: number };
  min: number;
  max: number;
  /** Snap step — clamped values land on `min + n * step`. */
  step: number;
  /** CSS unit appended verbatim after the number (`"px"`, `"rem"`, `"s"`,
   *  `"ms"`); absent/empty emits the bare number. */
  unit?: string;
}

/** Enum slot: one of a closed set of strings, rendered as segmented tabs. */
export interface TokenEnumSlot extends TokenGroupSlotBase {
  kind: "enum";
  defaults: { dark: string; light: string };
  /** Selectable values; the defaults must be listed here. */
  options: Array<{ value: string; label: LocalizedText }>;
}

/**
 * A group slot — discriminated by `kind`. The union is what lets the
 * dialog pick a picker / slider / tab strip per slot, and what lets
 * serialization attach a unit only where one is defined.
 */
export type TokenGroupSlot = TokenColorSlot | TokenNumberSlot | TokenEnumSlot;

/** Labeled sub-section of a group (e.g. "electrical power" inside "scada"). */
export interface TokenGroupSection {
  /** Stable key, unique within the group. */
  key: string;
  /** Display label — bare string or per-locale map (config files). */
  label: LocalizedText;
  slots: TokenGroupSlot[];
}

export interface TokenGroupDefinition {
  /** cssvar prefix → `--<id>-<slotKey>` (a slot's `cssVar` overrides it) */
  id: string;
  /** Display label — bare string or per-locale map (config files). */
  label: LocalizedText;
  /** Labeled sub-sections; when present the dialog renders one expansion
   *  block per section (a 38-slot palette needs sub-grouping). */
  sections?: TokenGroupSection[];
  /** Un-sectioned slots (rendered after the sections when both exist). */
  slots?: TokenGroupSlot[];
}

/** Every slot of a group — un-sectioned ones first, then section slots. */
export function allGroupSlots(group: TokenGroupDefinition): TokenGroupSlot[] {
  return [
    ...(group.slots ?? []),
    ...(group.sections ?? []).flatMap((section) => section.slots),
  ];
}

/** Per-group slot values: `groups[groupId][slotKey] = rgb | number | string`. */
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

/** Deep-copy a LocalizedText so registry and callers never share state. */
function cloneLabel(label: LocalizedText): LocalizedText {
  return typeof label === "string" ? label : { ...label };
}

/** Deep-copy a slot (label + defaults + options/clamp bands) so registry
 *  and callers never share state. Primitives (number/string defaults, unit,
 *  min/max/step, option values) copy by value already, so each kind only
 *  re-copies the fields that are objects; `...slot` keeps whatever else a
 *  caller attached, exactly as the pre-widening clone did. */
function cloneSlot(slot: TokenGroupSlot): TokenGroupSlot {
  if (slot.kind === "number") {
    return {
      ...slot,
      label: cloneLabel(slot.label),
      defaults: { dark: slot.defaults.dark, light: slot.defaults.light },
    };
  }
  if (slot.kind === "enum") {
    return {
      ...slot,
      label: cloneLabel(slot.label),
      defaults: { dark: slot.defaults.dark, light: slot.defaults.light },
      options: slot.options.map((option) => ({ value: option.value, label: cloneLabel(option.label) })),
    };
  }
  return {
    ...slot,
    label: cloneLabel(slot.label),
    defaults: {
      dark: { ...slot.defaults.dark },
      light: { ...slot.defaults.light },
    },
    hueClamp: slot.hueClamp ? { ...slot.hueClamp } : undefined,
    sRange: slot.sRange ? [...slot.sRange] : undefined,
    lRange: slot.lRange ? [...slot.lRange] : undefined,
  };
}

/** Deep-copy a section (label + slots) for registry isolation. */
function cloneSection(section: TokenGroupSection): TokenGroupSection {
  return {
    ...section,
    label: cloneLabel(section.label),
    slots: section.slots.map(cloneSlot),
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
  registry.set(def.id, {
    ...def,
    label: cloneLabel(def.label),
    sections: def.sections?.map(cloneSection),
    slots: def.slots?.map(cloneSlot),
  });
  registryVersion.value++;
  scheduleReapply();
}

/**
 * All registered groups, in registration order. Returns fresh copies —
 * treat the definitions as immutable and re-register to change them.
 */
export function getTokenGroups(): readonly TokenGroupDefinition[] {
  return [...registry.values()].map((group) => ({
    ...group,
    label: cloneLabel(group.label),
    sections: group.sections?.map(cloneSection),
    slots: group.slots?.map(cloneSlot),
  }));
}

/** The slot's kind; a missing discriminant is the legacy color form. */
export function tokenGroupSlotKind(slot: TokenGroupSlot): TokenGroupSlotKind {
  return slot.kind ?? "color";
}

/**
 * Type guards over the same union `tokenGroupSlotKind` classifies — the
 * narrowing form consumers migrate to. `tokenGroupSlotKind(slot) !== "color"`
 * does NOT narrow the union (a plain function's return is not a type
 * predicate), so the obvious guard leaves `slot.hueClamp` / `slot.options`
 * unreachable without a cast; these three are the sanctioned exit.
 *
 * `isColorSlot` reads a missing discriminant as color, byte-for-byte the
 * `tokenGroupSlotKind` default, so the two can never disagree.
 */
export function isColorSlot(slot: TokenGroupSlot): slot is TokenColorSlot {
  return tokenGroupSlotKind(slot) === "color";
}

/** True for `kind: "number"` slots (sliders). */
export function isNumberSlot(slot: TokenGroupSlot): slot is TokenNumberSlot {
  return slot.kind === "number";
}

/** True for `kind: "enum"` slots (segmented tabs). */
export function isEnumSlot(slot: TokenGroupSlot): slot is TokenEnumSlot {
  return slot.kind === "enum";
}

/** The cssvar a slot emits: its explicit `cssVar`, else `--<groupId>-<key>`. */
export function tokenGroupSlotCssVar(groupId: string, slot: TokenGroupSlot): string {
  return slot.cssVar ?? `--${groupId}-${slot.key}`;
}

/**
 * Resolve every registered group/slot for a mode:
 * `overrides?.[group]?.[slot] ?? slot.defaults[mode]`. Unregistered
 * override entries are ignored. Color values come back as fresh copies
 * (callers mutate them); number/string values are primitives. Values are
 * NOT clamped here — the registry defaults are the zero-drift baseline and
 * clamping belongs at the write path (`clampToSlot`).
 */
export function resolveGroupTokens(
  mode: "dark" | "light",
  overrides?: ThemeTokenGroupValues,
): ResolvedGroupTokens {
  const resolved: ResolvedGroupTokens = {};
  for (const group of registry.values()) {
    const slots: Record<string, ThemeTokenValue> = {};
    for (const slot of allGroupSlots(group)) {
      const value = overrides?.[group.id]?.[slot.key] ?? slot.defaults[mode];
      if (slot.kind === "number" || slot.kind === "enum") {
        slots[slot.key] = value;
      } else {
        const rgb = value as ThemeTokenRGB;
        slots[slot.key] = { r: rgb.r, g: rgb.g, b: rgb.b };
      }
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

/**
 * Defense-in-depth clamping of a value destined for one slot, per kind:
 *
 *   color  → hue/s/l bands (`clampRgbToBands`) — unchanged from before the
 *            slot widening, including for kind-less (legacy) slots.
 *   number → clamped into [min, max], then snapped onto the step grid
 *            (`min + n * step`, float drift trimmed exactly like HkSlider's
 *            snap) and clamped again, since the grid can overshoot max.
 *   enum   → must be one of `options`; anything else falls back to
 *            `slot.defaults.dark`. Picking the registry's dark anchor (not
 *            the incoming value) keeps the emitted cssvar inside the option
 *            set the tab strip can render — an out-of-vocabulary value is
 *            unreachable through the dialog anyway, it can only arrive from
 *            stale saved data.
 *
 * A value of the wrong primitive type for the slot's kind falls back to
 * `defaults.dark` for the same reason: the registry anchor is the only
 * value guaranteed to be valid for that slot.
 */
export function clampToSlot(slot: TokenGroupSlot, value: ThemeTokenRGB): ThemeTokenRGB;
export function clampToSlot(slot: TokenGroupSlot, value: number): number;
export function clampToSlot(slot: TokenGroupSlot, value: string): string;
export function clampToSlot(slot: TokenGroupSlot, value: ThemeTokenValue): ThemeTokenValue;
export function clampToSlot(slot: TokenGroupSlot, value: ThemeTokenValue): ThemeTokenValue {
  if (slot.kind === "number") {
    const raw = typeof value === "number" && Number.isFinite(value) ? value : slot.defaults.dark;
    const step = slot.step > 0 ? slot.step : 1;
    const clamped = Math.min(slot.max, Math.max(slot.min, raw));
    const snapped = slot.min + Math.round((clamped - slot.min) / step) * step;
    return Math.min(slot.max, Math.max(slot.min, Number(snapped.toFixed(6))));
  }
  if (slot.kind === "enum") {
    const raw = typeof value === "string" ? value : slot.defaults.dark;
    return slot.options.some((option) => option.value === raw) ? raw : slot.defaults.dark;
  }
  return clampRgbToBands(value as ThemeTokenRGB, slot.hueClamp, slot.sRange, slot.lRange);
}

/** Render one resolved slot value as its cssvar string. */
function serializeSlotValue(slot: TokenGroupSlot, value: ThemeTokenValue): string {
  if (slot.kind === "number") {
    const n = typeof value === "number" && Number.isFinite(value) ? value : slot.defaults.dark;
    return `${n}${slot.unit ?? ""}`;
  }
  if (slot.kind === "enum") {
    return typeof value === "string" ? value : slot.defaults.dark;
  }
  const rgb = value as ThemeTokenRGB;
  return `${rgb.r} ${rgb.g} ${rgb.b}`;
}

/**
 * Render resolved group values as CSS custom properties — ready to merge
 * into the theme cssvar map. The REGISTRY is the source of truth for names
 * and kinds (only a slot definition knows its `cssVar` and `unit`), so the
 * loop walks registered groups and reads the resolved map per slot:
 *
 *   color  → `{ "--<group>-<slot>": "r g b" }`
 *   number → `{ "<cssVar>": "4px" }`        (`unit` appended verbatim)
 *   enum   → `{ "<cssVar>": "pill" }`       (the option value as-is)
 *
 * Registry groups missing from `resolved` emit nothing (callers pair this
 * with `resolveGroupTokens`, which covers every registered slot). Walking
 * the registry rather than the caller's map is the one behavioural
 * tightening here: a hand-built map can no longer leak
 * `undefined undefined undefined` for a group or slot that was never
 * registered. The documented path (resolve → serialize) is unchanged.
 */
export function groupTokensToCSSVars(
  resolved: ResolvedGroupTokens,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const group of registry.values()) {
    const slots = resolved[group.id];
    if (!slots) continue;
    for (const slot of allGroupSlots(group)) {
      const value = slots[slot.key];
      if (value === undefined) continue;
      vars[tokenGroupSlotCssVar(group.id, slot)] = serializeSlotValue(slot, value);
    }
  }
  return vars;
}

// ── Palette config files ───────────────────────────────────────────
//
// The webui-standard way to define an extension palette: a JSON config
// file (e.g. chest `src/theme/palettes/scada.json`) loaded through
// `import.meta.glob` and fed to `registerTokenGroupConfig`. The parser
// below validates the whole document and reports every problem at once,
// so a typo in slot 37 names the slot instead of failing opaque. RGB
// values are `[r, g, b]` arrays for brevity; labels are LocalizedText
// maps so the config file carries its own translations. A slot may set
// `kind: "color" | "number" | "enum"` — absent means color, the form every
// palette written before the widening is in — and each kind validates its
// own fields (number: min/max/step/unit, enum: a non-empty option list the
// defaults must belong to).

export type ParseTokenGroupResult =
  | { ok: true; group: TokenGroupDefinition }
  | { ok: false; errors: string[] };

const IDENT_RE = /^[a-z][a-z0-9-]*$/;
/** An explicit cssvar target: `--` plus at least one ident character. */
const CSSVAR_RE = /^--[A-Za-z0-9_-]+$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseLocalized(v: unknown, where: string, errors: string[]): LocalizedText | null {
  if (typeof v === "string") {
    if (v.length === 0) {
      errors.push(`${where}: label string must not be empty`);
      return null;
    }
    return v;
  }
  if (isRecord(v)) {
    const out: Record<string, string> = {};
    let count = 0;
    for (const [locale, text] of Object.entries(v)) {
      if (locale === "$schema") continue;
      if (typeof text !== "string" || text.length === 0) {
        errors.push(`${where}: label value for locale "${locale}" must be a non-empty string`);
        continue;
      }
      out[locale] = text;
      count++;
    }
    if (count === 0) {
      errors.push(`${where}: label map has no locale entries`);
      return null;
    }
    return out;
  }
  errors.push(`${where}: label must be a string or a locale map`);
  return null;
}

function parseRgb(v: unknown, where: string, errors: string[]): ThemeTokenRGB | null {
  if (!Array.isArray(v) || v.length !== 3 || !v.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 255)) {
    errors.push(`${where}: must be an [r, g, b] array of integers 0–255`);
    return null;
  }
  return { r: v[0] as number, g: v[1] as number, b: v[2] as number };
}

function parseRange01(v: unknown, where: string, errors: string[]): [number, number] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === "number" && n >= 0 && n <= 1) || (v[0] as number) > (v[1] as number)) {
    errors.push(`${where}: must be a [min, max] pair with 0 ≤ min ≤ max ≤ 1`);
    return undefined;
  }
  return [v[0] as number, v[1] as number];
}

function parseKind(v: unknown, where: string, errors: string[]): TokenGroupSlotKind | null {
  if (v === undefined) return "color";
  if (v === "color" || v === "number" || v === "enum") return v;
  errors.push(`${where}.kind: must be "color", "number" or "enum"`);
  return null;
}

function parseCssVar(v: unknown, where: string, errors: string[]): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string" || !CSSVAR_RE.test(v)) {
    errors.push(`${where}: must be a cssvar name like "--radius-md"`);
    return undefined;
  }
  return v;
}

function parseFiniteNumber(v: unknown, where: string, errors: string[]): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    errors.push(`${where}: must be a finite number`);
    return null;
  }
  return v;
}

/** Shared "label + defaults are required" diagnostic (mirrors the color path). */
function reportMissingBasics(
  where: string,
  label: LocalizedText | null,
  dark: unknown,
  light: unknown,
  errors: string[],
): null {
  if (!label && dark === null && light === null && errors.length === 0) {
    // A slot whose only problem is a missing label object would otherwise
    // drop silently with zero diagnostics — make sure something is said.
    errors.push(`${where}: label and defaults are required`);
  }
  return null;
}

function parseColorSlot(
  v: Record<string, unknown>,
  where: string,
  key: string,
  label: LocalizedText | null,
  cssVar: string | undefined,
  errors: string[],
): TokenColorSlot | null {
  const defaults = v.defaults;
  let dark: ThemeTokenRGB | null = null;
  let light: ThemeTokenRGB | null = null;
  if (!isRecord(defaults)) {
    errors.push(`${where}.defaults: must be an object with dark/light`);
  } else {
    dark = parseRgb(defaults.dark, `${where}.defaults.dark`, errors);
    light = parseRgb(defaults.light, `${where}.defaults.light`, errors);
  }
  let hueClamp: HueClamp | undefined;
  const hc = v.hueClamp;
  if (hc !== undefined) {
    if (!isRecord(hc) || typeof hc.center !== "number" || typeof hc.range !== "number"
      || hc.center < 0 || hc.center > 360 || hc.range < 0 || hc.range > 180) {
      errors.push(`${where}.hueClamp: must be { center: 0–360, range: 0–180 }`);
    } else {
      hueClamp = { center: hc.center, range: hc.range };
    }
  }
  const sRange = parseRange01(v.sRange, `${where}.sRange`, errors);
  const lRange = parseRange01(v.lRange, `${where}.lRange`, errors);
  const pairWith = v.pairWith === undefined ? undefined : v.pairWith;
  if (pairWith !== undefined && (typeof pairWith !== "string" || !IDENT_RE.test(pairWith))) {
    errors.push(`${where}.pairWith: must be a slot key string`);
    return null;
  }
  if (!label || !dark || !light) {
    return reportMissingBasics(where, label, dark, light, errors);
  }
  return {
    key,
    label,
    cssVar,
    defaults: { dark, light },
    hueClamp,
    sRange,
    lRange,
    pairWith,
  };
}

function parseNumberSlot(
  v: Record<string, unknown>,
  where: string,
  key: string,
  label: LocalizedText | null,
  cssVar: string | undefined,
  errors: string[],
): TokenNumberSlot | null {
  const min = parseFiniteNumber(v.min, `${where}.min`, errors);
  const max = parseFiniteNumber(v.max, `${where}.max`, errors);
  const step = parseFiniteNumber(v.step, `${where}.step`, errors);
  if (min !== null && max !== null && max < min) {
    errors.push(`${where}.max: must be ≥ min`);
  }
  if (step !== null && step <= 0) {
    errors.push(`${where}.step: must be > 0`);
  }
  let unit: string | undefined;
  if (v.unit !== undefined) {
    if (typeof v.unit !== "string") {
      errors.push(`${where}.unit: must be a string such as "px", "rem", "s" or ""`);
    } else {
      unit = v.unit;
    }
  }
  const defaults = v.defaults;
  let dark: number | null = null;
  let light: number | null = null;
  if (!isRecord(defaults)) {
    errors.push(`${where}.defaults: must be an object with dark/light`);
  } else {
    dark = parseFiniteNumber(defaults.dark, `${where}.defaults.dark`, errors);
    light = parseFiniteNumber(defaults.light, `${where}.defaults.light`, errors);
  }
  // A default outside the slider range is silently rewritten by the
  // dialog's clamp on the first edit — reject it at parse time instead.
  for (const mode of ["dark", "light"] as const) {
    const value = mode === "dark" ? dark : light;
    if (value !== null && min !== null && max !== null && (value < min || value > max)) {
      errors.push(`${where}.defaults.${mode}: ${value} is outside [${min}, ${max}]`);
    }
  }
  if (!label || dark === null || light === null || min === null || max === null || step === null) {
    return reportMissingBasics(where, label, dark, light, errors);
  }
  return { key, kind: "number", label, cssVar, defaults: { dark, light }, min, max, step, unit };
}

function parseEnumSlot(
  v: Record<string, unknown>,
  where: string,
  key: string,
  label: LocalizedText | null,
  cssVar: string | undefined,
  errors: string[],
): TokenEnumSlot | null {
  const options: Array<{ value: string; label: LocalizedText }> = [];
  const rawOptions = v.options;
  if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
    errors.push(`${where}.options: must be a non-empty array of { value, label }`);
  } else {
    const seen = new Set<string>();
    rawOptions.forEach((item, index) => {
      if (!isRecord(item)) {
        errors.push(`${where}.options[${index}]: must be an object with value/label`);
        return;
      }
      const value = item.value;
      if (typeof value !== "string" || value.length === 0) {
        errors.push(`${where}.options[${index}].value: must be a non-empty string`);
        return;
      }
      if (seen.has(value)) errors.push(`${where}.options[${index}].value: duplicate option "${value}"`);
      seen.add(value);
      const optionLabel = parseLocalized(item.label, `${where}.options[${index}].label`, errors);
      if (optionLabel) options.push({ value, label: optionLabel });
    });
  }
  const defaults = v.defaults;
  let dark: string | null = null;
  let light: string | null = null;
  if (!isRecord(defaults)) {
    errors.push(`${where}.defaults: must be an object with dark/light`);
  } else {
    for (const mode of ["dark", "light"] as const) {
      const value = defaults[mode];
      if (typeof value !== "string" || value.length === 0) {
        errors.push(`${where}.defaults.${mode}: must be a non-empty option string`);
      } else if (mode === "dark") {
        dark = value;
      } else {
        light = value;
      }
    }
  }
  const values = new Set(options.map((option) => option.value));
  for (const mode of ["dark", "light"] as const) {
    const value = mode === "dark" ? dark : light;
    if (value !== null && !values.has(value)) {
      errors.push(`${where}.defaults.${mode}: "${value}" is not one of the declared options`);
    }
  }
  if (!label || dark === null || light === null || options.length === 0) {
    return reportMissingBasics(where, label, dark, light, errors);
  }
  return { key, kind: "enum", label, cssVar, defaults: { dark, light }, options };
}

function parseSlot(v: unknown, where: string, errors: string[]): TokenGroupSlot | null {
  if (!isRecord(v)) {
    errors.push(`${where}: must be an object`);
    return null;
  }
  const key = v.key;
  if (typeof key !== "string" || !IDENT_RE.test(key)) {
    errors.push(`${where}: key "${String(key)}" must match ${IDENT_RE}`);
    return null;
  }
  const kind = parseKind(v.kind, where, errors);
  if (kind === null) return null;
  const label = parseLocalized(v.label, `${where}.label`, errors);
  const cssVar = parseCssVar(v.cssVar, `${where}.cssVar`, errors);
  if (kind === "number") return parseNumberSlot(v, where, key, label, cssVar, errors);
  if (kind === "enum") return parseEnumSlot(v, where, key, label, cssVar, errors);
  return parseColorSlot(v, where, key, label, cssVar, errors);
}

function parseSlotList(v: unknown, where: string, errors: string[]): TokenGroupSlot[] | null {
  if (!Array.isArray(v) || v.length === 0) {
    errors.push(`${where}: must be a non-empty array`);
    return null;
  }
  const slots: TokenGroupSlot[] = [];
  v.forEach((item, index) => {
    const slot = parseSlot(item, `${where}[${index}]`, errors);
    if (slot) slots.push(slot);
  });
  return slots.length === 0 ? null : slots;
}

function crossValidate(def: TokenGroupDefinition, errors: string[]): void {
  const slots = allGroupSlots(def);
  const seen = new Set<string>();
  const byKey = new Map<string, TokenGroupSlot>();
  for (const slot of slots) {
    if (seen.has(slot.key)) errors.push(`duplicate slot key "${slot.key}"`);
    seen.add(slot.key);
    byKey.set(slot.key, slot);
  }
  for (const slot of slots) {
    // pairWith is a color-only field: number/enum slots have no pair.
    if (slot.kind === "number" || slot.kind === "enum") continue;
    if (slot.pairWith === undefined) continue;
    const paired = byKey.get(slot.pairWith);
    if (!paired) {
      errors.push(`slot "${slot.key}" pairs with unknown slot "${slot.pairWith}"`);
    } else if (tokenGroupSlotKind(paired) !== "color") {
      // Striped-pair semantics only exist for colors; pairing a color with
      // a slider would leave the dialog with nothing to render a pair for.
      errors.push(`slot "${slot.key}" pairs with "${slot.pairWith}", which is not a color slot`);
    }
  }
  // Two slots aimed at the same cssvar overwrite each other on every apply
  // (last write wins, silently) — a widened slot that names an existing
  // scale token makes that collision reachable, so it is checked here.
  const targets = new Set<string>();
  for (const slot of slots) {
    const target = tokenGroupSlotCssVar(def.id, slot);
    if (targets.has(target)) errors.push(`duplicate cssvar target "${target}"`);
    targets.add(target);
  }
  if (slots.length === 0) {
    errors.push(`group "${def.id}" defines no slots`);
  }
}

/**
 * Parse (and validate) a palette config file document into a
 * TokenGroupDefinition. Unknown top-level keys (e.g. `$schema`) are
 * ignored; every other problem is reported in `errors` — the caller
 * decides whether to log-and-skip or to throw.
 */
export function parseTokenGroupConfig(config: unknown): ParseTokenGroupResult {
  const errors: string[] = [];
  if (!isRecord(config)) {
    return { ok: false, errors: ["config: must be a JSON object"] };
  }
  const id = config.id;
  if (typeof id !== "string" || !IDENT_RE.test(id)) {
    return { ok: false, errors: [`id: "${String(id)}" must match ${IDENT_RE}`] };
  }
  const label = parseLocalized(config.label, "label", errors);
  if (!label) return { ok: false, errors };

  const sections: TokenGroupSection[] = [];
  const rawSections = config.sections;
  if (rawSections !== undefined) {
    if (!Array.isArray(rawSections)) {
      errors.push("sections: must be an array");
    } else {
      const sectionKeys = new Set<string>();
      rawSections.forEach((item, index) => {
        if (!isRecord(item)) {
          errors.push(`sections[${index}]: must be an object`);
          return;
        }
        const sKey = item.key;
        if (typeof sKey !== "string" || !IDENT_RE.test(sKey)) {
          errors.push(`sections[${index}].key: "${String(sKey)}" must match ${IDENT_RE}`);
          return;
        }
        if (sectionKeys.has(sKey)) errors.push(`duplicate section key "${sKey}"`);
        sectionKeys.add(sKey);
        const sLabel = parseLocalized(item.label, `sections[${index}].label`, errors);
        const slots = parseSlotList(item.slots, `sections[${index}].slots`, errors);
        if (sLabel && slots) sections.push({ key: sKey, label: sLabel, slots });
      });
    }
  }

  let flatSlots: TokenGroupSlot[] | undefined;
  if (config.slots !== undefined) {
    flatSlots = parseSlotList(config.slots, "slots", errors) ?? undefined;
  }

  if (errors.length > 0) return { ok: false, errors };
  const def: TokenGroupDefinition = { id, label, ...(sections.length > 0 ? { sections } : {}), ...(flatSlots ? { slots: flatSlots } : {}) };
  crossValidate(def, errors);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, group: def };
}

/**
 * Parse + register a palette config document in one step. Returns the
 * parse result so loaders can log-and-skip broken files without
 * throwing; a valid config registers exactly like `registerTokenGroup`.
 */
export function registerTokenGroupConfig(config: unknown): ParseTokenGroupResult {
  const result = parseTokenGroupConfig(config);
  if (result.ok) registerTokenGroup(result.group);
  return result;
}
