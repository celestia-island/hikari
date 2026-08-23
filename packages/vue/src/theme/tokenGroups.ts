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

export interface TokenGroupSlot {
  /** cssvar suffix → `--<groupId>-<key>` */
  key: string;
  /** Display label — bare string or per-locale map (config files). */
  label: LocalizedText;
  defaults: { dark: ThemeTokenRGB; light: ThemeTokenRGB };
  /** Picker hue clamp: hue locked to center±range (degrees, circular). */
  hueClamp?: HueClamp;
  /** Saturation / lightness safe bands, 0–1. */
  sRange?: [number, number];
  lRange?: [number, number];
  /** Two-tone slot pair (e.g. PE wire a/b stripes): key of the sibling slot. */
  pairWith?: string;
}

/** Labeled sub-section of a group (e.g. "electrical power" inside "scada"). */
export interface TokenGroupSection {
  /** Stable key, unique within the group. */
  key: string;
  /** Display label — bare string or per-locale map (config files). */
  label: LocalizedText;
  slots: TokenGroupSlot[];
}

export interface TokenGroupDefinition {
  /** cssvar prefix → `--<id>-<slotKey>` */
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

/** Deep-copy a LocalizedText so registry and callers never share state. */
function cloneLabel(label: LocalizedText): LocalizedText {
  return typeof label === "string" ? label : { ...label };
}

/** Deep-copy a slot (label + defaults + clamp bands) so registry and callers never share state. */
function cloneSlot(slot: TokenGroupSlot): TokenGroupSlot {
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
    for (const slot of allGroupSlots(group)) {
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

// ── Palette config files ───────────────────────────────────────────
//
// The webui-standard way to define an extension palette: a JSON config
// file (e.g. chest `src/theme/palettes/scada.json`) loaded through
// `import.meta.glob` and fed to `registerTokenGroupConfig`. The parser
// below validates the whole document and reports every problem at once,
// so a typo in slot 37 names the slot instead of failing opaque. RGB
// values are `[r, g, b]` arrays for brevity; labels are LocalizedText
// maps so the config file carries its own translations.

export type ParseTokenGroupResult =
  | { ok: true; group: TokenGroupDefinition }
  | { ok: false; errors: string[] };

const IDENT_RE = /^[a-z][a-z0-9-]*$/;

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
  const label = parseLocalized(v.label, `${where}.label`, errors);
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
    if (!label && !dark && !light && errors.length === 0) {
      // A slot whose only problem is a missing label object would otherwise
      // drop silently with zero diagnostics — make sure something is said.
      errors.push(`${where}: label and defaults are required`);
    }
    return null;
  }
  return {
    key,
    label,
    defaults: { dark, light },
    hueClamp,
    sRange,
    lRange,
    pairWith,
  };
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
  const seen = new Set<string>();
  for (const slot of allGroupSlots(def)) {
    if (seen.has(slot.key)) errors.push(`duplicate slot key "${slot.key}"`);
    seen.add(slot.key);
  }
  for (const slot of allGroupSlots(def)) {
    if (slot.pairWith !== undefined && !seen.has(slot.pairWith)) {
      errors.push(`slot "${slot.key}" pairs with unknown slot "${slot.pairWith}"`);
    }
  }
  if (allGroupSlots(def).length === 0) {
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
