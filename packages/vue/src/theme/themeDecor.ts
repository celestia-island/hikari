import { ref, type Component, type Ref } from "vue";

import type { ThemeId } from "./presets";

/**
 * Theme decor registry — the context through which a THEME ships its own
 * decorative widgets, while the HOST keeps deciding where they go and how
 * big they are.
 *
 * The problem this closes: decorative chrome that used to be per-theme
 * markup (chest's SystemTray carried a `TRAY_DECORS` table keyed by theme
 * id, with a `kind`/`cycleMs` record per theme and a component that forked
 * whenever a theme wanted a different cluster). A registry keyed by
 * (themeId, slot) replaces that table: a theme registers a COMPONENT for a
 * slot, hikari resolves it from the ambient theme, and the host mounts
 * `<HkThemeDecor slot="status.tray" />` wherever its layout wants one —
 * a footer, a card corner, a modal chrome band.
 *
 * Hard rules this module holds:
 *
 *  - **No component imports.** The registry stores component references
 *    handed to it; it never imports one itself. That keeps the theme module
 *    free of the component tree (no cycle: components import theme, not the
 *    reverse) and lets hikari's own defaults live in `standardDecor.ts`,
 *    which is the one file allowed to import both sides.
 *  - **Registration is not a side effect of importing.** `standardDecor.ts`
 *    registers hikari's defaults only when `registerStandardThemeDecor()`
 *    runs (initTheme, before the first applyTheme) — a consumer that never
 *    calls `initTheme()` (tests, SSR, a host with its own theme engine)
 *    gets an untouched registry.
 *  - **Invalid input fails loudly.** An uppercase/underscore/digit-leading
 *    or empty slot, an empty theme id, or a missing component throws at
 *    registration time. The alternative (silently dropping the entry) is a
 *    theme that renders nothing with no error anywhere — the silent
 *    degradation class this codebase's guards exist to kill.
 *
 * Resolution order for `getThemeDecor(slot, themeId)`:
 *
 *   1. the exact `themeId` entry (a theme's own implementation),
 *   2. the `"*"` entry (a host/extension wide fallback),
 *   3. the built-in floor registered by `registerStandardThemeDecor()`,
 *   4. `undefined` (the host renders nothing for that slot).
 *
 * Levels 2 and 3 are deliberately distinct: hikari's defaults are the
 * FLOOR, not a wildcard a host has to fight. A host that registers its own
 * `"*"` for `status.tray` replaces hikari's tray for every theme without
 * ever clobbering the registry entry the standard registration owns.
 */

/** A slot name — a namespace, not a sentence: `status.tray`, `empty`,
 *  `placeholder.screen`. Lowercase, digits, dots and dashes only. */
export type ThemeDecorSlot = string;

/** The one accepted spelling of a slot name. */
export const THEME_DECOR_SLOT_PATTERN = /^[a-z][a-z0-9.-]*$/;

/** `"*"` = the wildcard theme id (level 2 of the resolution order). */
export const THEME_DECOR_WILDCARD = "*";

/** Type guard for slot names; the validator behind every registration. */
export function isThemeDecorSlot(value: unknown): value is ThemeDecorSlot {
  return typeof value === "string" && THEME_DECOR_SLOT_PATTERN.test(value);
}

export interface ThemeDecorRegistration {
  /** Exact theme id, or `"*"` for a wildcard fallback. */
  themeId: ThemeId | typeof THEME_DECOR_WILDCARD;
  slot: ThemeDecorSlot;
  /** The Vue component rendered for this slot. */
  component: Component;
  /** Default props for the component; `<HkThemeDecor decor-props>` wins. */
  props?: Record<string, unknown>;
}

/** A built-in floor entry: hikari's own default has no theme id of its own
 *  (it applies to every theme below the `"*"` level). */
export type ThemeDecorBuiltinRegistration = Omit<ThemeDecorRegistration, "themeId">;

interface SlotEntry {
  /** Exact theme ids plus the `"*"` wildcard, keyed as registered. */
  themes: Map<ThemeId, ThemeDecorRegistration>;
  /** Level 3 of the resolution order, set by registerStandardThemeDecor(). */
  builtin?: ThemeDecorRegistration;
}

const registry = new Map<ThemeDecorSlot, SlotEntry>();

// Reactive registry version: bumps on every successful registration so
// components that resolve decor (HkThemeDecor) re-resolve after a late
// registration instead of waiting for a theme switch. Same shape as
// tokenGroupsVersion — consumers never bump it manually.
const registryVersion = ref(0);
/** Read-only view of the registry version. */
export const themeDecorVersion: Readonly<Ref<number>> = registryVersion;

function copyRegistration(reg: ThemeDecorRegistration): ThemeDecorRegistration {
  // Deep-copy the props bag so later caller mutation cannot desync the
  // registry (the tokenGroups registry holds the same line).
  return { ...reg, props: reg.props ? { ...reg.props } : undefined };
}

function assertRegistration(reg: ThemeDecorRegistration): void {
  if (!isThemeDecorSlot(reg?.slot)) {
    throw new Error(
      `[themeDecor] invalid slot name ${JSON.stringify(reg?.slot)} — expected /${THEME_DECOR_SLOT_PATTERN.source}/`,
    );
  }
  if (reg.themeId !== THEME_DECOR_WILDCARD && (typeof reg.themeId !== "string" || reg.themeId.length === 0)) {
    throw new Error(
      `[themeDecor] slot "${reg.slot}" needs a theme id or "*" (got ${JSON.stringify(reg.themeId)})`,
    );
  }
  if (!reg.component) {
    throw new Error(`[themeDecor] slot "${reg.slot}" registered without a component`);
  }
}

function slotEntry(slot: ThemeDecorSlot): SlotEntry {
  let entry = registry.get(slot);
  if (!entry) {
    entry = { themes: new Map() };
    registry.set(slot, entry);
  }
  return entry;
}

/**
 * Register (or replace — idempotent by `(themeId, slot)`) a theme decor.
 * Re-registering the same pair overwrites the previous entry in place and
 * bumps `themeDecorVersion`, so a live `<HkThemeDecor>` re-resolves and
 * re-renders without a remount.
 *
 * Throws on an invalid slot name, an empty theme id or a missing component.
 */
export function registerThemeDecor(reg: ThemeDecorRegistration): void {
  assertRegistration(reg);
  slotEntry(reg.slot).themes.set(reg.themeId, copyRegistration(reg));
  registryVersion.value++;
}

/**
 * Register hikari's own default for a slot — the FLOOR of the resolution
 * order, below every `themeId` and below `"*"`. Called by
 * `registerStandardThemeDecor()`; applications register with
 * `registerThemeDecor` instead.
 */
export function registerThemeDecorBuiltin(reg: ThemeDecorBuiltinRegistration): void {
  assertRegistration({ ...reg, themeId: THEME_DECOR_WILDCARD });
  slotEntry(reg.slot).builtin = copyRegistration({ ...reg, themeId: THEME_DECOR_WILDCARD });
  registryVersion.value++;
}

/**
 * Resolve the decor for `slot` under `themeId`: exact theme id, then `"*"`,
 * then hikari's built-in floor, then `undefined`. Returns a fresh copy so
 * callers cannot mutate the registry through the result.
 */
export function getThemeDecor(
  slot: ThemeDecorSlot,
  themeId: ThemeId,
): ThemeDecorRegistration | undefined {
  const entry = registry.get(slot);
  if (!entry) return undefined;
  const hit =
    entry.themes.get(themeId) ??
    entry.themes.get(THEME_DECOR_WILDCARD) ??
    entry.builtin;
  return hit ? copyRegistration(hit) : undefined;
}

/**
 * Every slot with at least one registration (exact, wildcard or built-in),
 * deduplicated by construction and in first-registration order — stable
 * across calls, so a UI listing the slots does not reshuffle between
 * renders.
 */
export function themeDecorSlots(): string[] {
  return [...registry.keys()];
}
