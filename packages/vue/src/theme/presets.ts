// The stock `default` theme's VALUES live in the Rust palette crate
// (packages/palette/src/stock.rs — hikari#1546 Phase 2); this JSON is the
// serde artifact a snapshot test keeps byte-locked to that crate. This file
// no longer hand-writes the slot table.
import stockThemeJson from "./stock-preset.json";
import { readStorageItem, writeStorageItem } from "./safeStorage";
import { rgbToOklch, oklchToRgb, contrastRatio } from "../theme/semanticPalette";

export interface ThemeTokenRGB {
  r: number;
  g: number;
  b: number;
}

export interface ThemeSchemeTokens {
  primary: ThemeTokenRGB;
  secondary: ThemeTokenRGB;
  accent: ThemeTokenRGB;
  text: ThemeTokenRGB;
  muted: ThemeTokenRGB;
  border: ThemeTokenRGB;
  focusedBorder: ThemeTokenRGB;
  background: ThemeTokenRGB;
  surface: ThemeTokenRGB;
  selectedBackground: ThemeTokenRGB;
  selectedText: ThemeTokenRGB;
  statusBarBackground: ThemeTokenRGB;
  success: ThemeTokenRGB;
  error: ThemeTokenRGB;
  warning: ThemeTokenRGB;
  info: ThemeTokenRGB;
  /**
   * Text color rendered ON solid brand fills (primary buttons, badges).
   * Optional for backward compatibility with saved custom themes that
   * predate the slot; defaults to white when absent.
   */
  onSolidText?: ThemeTokenRGB;
  /**
   * Icon/shape color rendered ON solid brand fills (switch thumb, checkbox
   * tick, radio dot). Optional for backward compatibility with saved custom
   * themes that predate the slot; defaults to white when absent.
   */
  onSolidIcon?: ThemeTokenRGB;
  /**
   * Per-tone ink rendered ON each semantic fill (danger/success/warning/
   * info bands: toasts, alerts, badges). Optional: when a theme omits a
   * slot the fill decides by its own perceptual luminance (white on the
   * saturated tones, black only on the light ones — see solidInk).
   * Declaring one lets a designer override that judgement per tone.
   */
  onDanger?: ThemeTokenRGB;
  onSuccess?: ThemeTokenRGB;
  onWarning?: ThemeTokenRGB;
  onInfo?: ThemeTokenRGB;
}

/**
 * One slot value: an rgb triplet (color slots — the only kind before the
 * slot widening), a number (number slots) or a string (enum slots). See
 * ./tokenGroups.ts for the slot kinds that produce/consume these.
 */
export type ThemeTokenValue = ThemeTokenRGB | number | string;

/**
 * Extension token group values riding along with a preset/custom theme,
 * keyed by group id then slot key (see ./tokenGroups.ts). Optional and
 * additive: presets and saved custom themes without groups keep working —
 * the registry defaults are the final fallback. Values are plain JSON
 * (triplets, numbers, strings), so saved themes stay serializable.
 */
export type ThemeTokenGroupValues = Record<string, Record<string, ThemeTokenValue>>;

export interface ThemeTokenGroupModes {
  dark?: ThemeTokenGroupValues;
  light?: ThemeTokenGroupValues;
}

export interface ThemePreset {
  id: string;
  /**
   * Display name: either a literal string or a message key resolvable in
   * hikari's own i18n catalog (e.g. "hikari::theme.defaultThemeName").
   * Theme rows resolve names through `t()`, which falls back to the raw
   * string for anything that is not a key, so user-named customs and
   * literal preset names render unchanged while keyed built-ins localize.
   */
  name: string;
  /**
   * Per-locale name translations (2026-11-25 user direction: theme names
   * are i18n citizens everywhere). Authored through the scheme editor's
   * localized-name input; rows resolve the map FIRST (family fallbacks:
   * zh-Hans ⇄ zh-Hant → en → first non-empty) and fall back to `t(name)`.
   * Optional: presets without a map resolve through the name alone.
   */
  nameI18n?: Record<string, string>;
  dark: ThemeSchemeTokens;
  light: ThemeSchemeTokens;
  groups?: ThemeTokenGroupModes;
}

export type ThemeId = string;
export type ThemeMode = "system" | "light" | "dark";

export interface CustomThemePreset {
  id: string;
  name: string;
  /** Per-locale name translations (see ThemePreset.nameI18n). Persisted
   *  with the theme in local storage; additive, so customs saved before
   *  the field existed keep loading. */
  nameI18n?: Record<string, string>;
  dark: ThemeSchemeTokens;
  light: ThemeSchemeTokens;
  groups?: ThemeTokenGroupModes;
}

const CUSTOM_STORAGE_KEY = "hikari-custom-themes";

/** The runtime's own memo of a CUSTOM theme's computed cssvars, keyed by
 *  theme id then mode, so the PRE-PAINT boot asset can replay the colors
 *  without re-implementing (or duplicating) the color math (hikari#1546
 *  point 2). Written by applyTheme for non-stock themes only — the stock
 *  preset already ships as the static sheet.
 *
 *  VERSION DISCIPLINE: the memo bakes THREE inputs, and any of them
 *  changing makes a stored payload wrong —
 *    1. `tokensToCSSVars` / its OKLCH-contrast helpers (this repo),
 *    2. the token GROUPS a host registers (their resolved defaults feed the
 *       memo through `groupTokensToCSSVars`),
 *    3. a host's own preset table (`window.__celestiaThemes` / in-place
 *       preset overrides), whose values are memoized like any custom theme.
 *  (1) is ours to police in review; (2) and (3) live in consumers, so the
 *  version is also the hatch for a HOST-driven refresh — a host that changes
 *  a group default or a preset's colors bumps nothing here, and its users
 *  keep one load of the previous palette. That is accepted (the memo is a
 *  first-paint hint, `applyTheme` overwrites it immediately) but it is why
 *  this is a hint and not a cache of record. */
export const THEME_VARS_MEMO_KEY = "hikari-theme-vars";
export const THEME_VARS_MEMO_VERSION = 1;

export function loadCustomThemes(): CustomThemePreset[] {
  try {
    const raw = readStorageItem(CUSTOM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(list: CustomThemePreset[]) {
  writeStorageItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
}

export function addCustomTheme(theme: CustomThemePreset) {
  const list = loadCustomThemes();
  const idx = list.findIndex((t) => t.id === theme.id);
  if (idx >= 0) {
    list[idx] = theme;
  } else {
    list.push(theme);
  }
  saveCustomThemes(list);
}

export function removeCustomTheme(id: string) {
  const list = loadCustomThemes().filter((t) => t.id !== id);
  saveCustomThemes(list);
}

/**
 * The stock preset table holds exactly ONE theme, and its VALUES are no
 * longer written here: they live in the Rust palette crate
 * (`packages/palette/src/stock.rs`, hikari#1546 Phase 2) and arrive as the
 * checked-in JSON artifact above. Editing a color means editing Rust and
 * regenerating (`REGEN_STOCK_JSON=1 cargo test -p hikari-palette --test
 * stock_snapshot`) — the artifact snapshot test in that crate keeps the
 * two sides locked.
 *
 * A consumer that wants a distinct brand still registers its own preset
 * (chest's `sc` is the reference), and a user who wants another look edits
 * the default through the theme dialog and keeps it as a custom scheme.
 */
export const themePresets: Record<ThemeId, ThemePreset> = {
  default: stockThemeJson as unknown as ThemePreset,
};

export type ThemeTokens = ThemeSchemeTokens;

/**
 * The shipped default preset, addressable even after a consumer replaces the
 * table. Chest clears EVERY stock key at boot and registers only its brand
 * line (`brandPresets.ts`), so `themePresets.default` is not guaranteed to
 * exist downstream — a component that dereferences it unconditionally dies
 * at mount in that consumer while every test in this repo stays green.
 *
 * This is not a second copy of the palette: it is the same object the table
 * was built from, kept reachable by name.
 */
export const stockDefaultPreset: ThemePreset = themePresets.default;

export function getThemeTokens(
  name: string,
  mode: string,
): ThemeSchemeTokens | null {
  const preset = themePresets[name as keyof typeof themePresets];
  if (preset) return mode === "dark" ? preset.dark : preset.light;
  return null;
}
/**
 * This colour as TEXT on `bg`: itself when it already clears `target`,
 * otherwise the nearest OKLCH-lightness step that does. Hue is preserved;
 * chroma is only given up where the sRGB gamut forces it (the same trade the
 * fill derivation makes). This is what lets a semantic FILL stay
 * mode-independent while whatever paints it as text stays readable.
 */
function readableOn(
  fg: ThemeTokenRGB,
  backgrounds: ThemeTokenRGB[],
  target = 4.5,
): ThemeTokenRGB {
  // Already readable everywhere it can land: keep the fill's own chroma.
  if (backgrounds.every((bg) => contrastRatio(fg, bg) >= target)) return fg;
  const { l, c, h } = rgbToOklch(fg);
  let best: ThemeTokenRGB | null = null;
  let bestDist = Infinity;
  for (let step = 0; step <= 400; step++) {
    const li = step / 400;
    // oklchToRgb reduces chroma into the sRGB gamut internally.
    const candidate = oklchToRgb({ l: li, c, h });
    if (backgrounds.every((bg) => contrastRatio(candidate, bg) >= target)) {
      const dist = Math.abs(li - l);
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
  }
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };
  const fallback =
    contrastRatio(white, backgrounds[0]) >= contrastRatio(black, backgrounds[0]) ? white : black;
  return best ?? fallback;
}

export function solidInk({ r, g, b }: ThemeTokenRGB): ThemeTokenRGB {
  // 0.65, not the legacy 0.55: the green channel dominates this metric
  // (0.7152), so ordinary greens/cyans like #10B981 / #06B6D4 sat just over
  // 0.55 and flipped to black ink even though they read as saturated fills
  // (Bootstrap and Radix both ship white on them). At 0.65 only genuinely
  // pale fills — yellows, pale greens and light sky blues, the Radix
  // "designed for dark foreground" set — take black.
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.65 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
}

function mixToken(a: ThemeTokenRGB, b: ThemeTokenRGB, t: number): ThemeTokenRGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

/**
 * Build the cssvar map for a scheme. `groupVars` (optional, from
 * `groupTokensToCSSVars(resolveGroupTokens(...))`) is merged in so
 * extension token groups ship alongside the fixed tokens; callers that
 * omit it get the exact previous behavior.
 */
export function tokensToCSSVars(
  tokens: ThemeSchemeTokens,
  groupVars?: Record<string, string>,
): Record<string, string> {
  const onPrimary = solidInk(tokens.primary);
  const textSecondary = mixToken(tokens.text, tokens.muted, 0.25);
  const textTertiary = mixToken(tokens.text, tokens.muted, 0.5);
  // Content colors for solid brand fills default to white (the historical
  // hardcoded value); saved custom themes that predate the slots stay white.
  const onSolidText = tokens.onSolidText ?? { r: 255, g: 255, b: 255 };
  const onSolidIcon = tokens.onSolidIcon ?? { r: 255, g: 255, b: 255 };
  // Per-fill content ink for the semantic tone fills (toast bands, tinted
  // badges, alert headers). A theme that declares the slot wins (a designer
  // can hand-pick); otherwise the fill decides via solidInk — white on the
  // saturated tones, black only on the light ones.
  const onDanger = tokens.onDanger ?? solidInk(tokens.error);
  const onSuccess = tokens.onSuccess ?? solidInk(tokens.success);
  const onWarning = tokens.onWarning ?? solidInk(tokens.warning);
  const onInfo = tokens.onInfo ?? solidInk(tokens.info);
  // Per-tone PAGE-READABLE fills: a semantic slot is a solid fill and ignores
  // the mode (user direction), but components that paint it as TEXT (tags,
  // links) sit on the page or on a tint of the fill — the fill itself can be
  // unreadable there. This is the lightness-move that fixes it, per mode.
  // The chip backdrop is color-mix(fill 10%, transparent) over the page:
  // 10% fill + 90% background.
  // The chip can land on the page background or on a card surface — the fg
  // must clear its tint against BOTH.
  const tint = (fill: ThemeTokenRGB): ThemeTokenRGB =>
    mixToken(tokens.background, fill, 0.1);
  const tintS = (fill: ThemeTokenRGB): ThemeTokenRGB =>
    mixToken(tokens.surface, fill, 0.1);
  const successFg = readableOn(tokens.success, [tint(tokens.success), tintS(tokens.success)]);
  const errorFg = readableOn(tokens.error, [tint(tokens.error), tintS(tokens.error)]);
  const warningFg = readableOn(tokens.warning, [tint(tokens.warning), tintS(tokens.warning)]);
  const infoFg = readableOn(tokens.info, [tint(tokens.info), tintS(tokens.info)]);
  return {
    "--color-primary": `${tokens.primary.r} ${tokens.primary.g} ${tokens.primary.b}`,
    "--color-on-primary": `${onPrimary.r} ${onPrimary.g} ${onPrimary.b}`,
    "--color-on-solid-text": `${onSolidText.r} ${onSolidText.g} ${onSolidText.b}`,
    "--color-on-solid-icon": `${onSolidIcon.r} ${onSolidIcon.g} ${onSolidIcon.b}`,
    // Legacy name kept as an alias of the text slot: existing consumers
    // (HkButton, --hi-color-text-on-secondary/danger/success) keep working
    // and now follow the theme-configurable text choice.
    "--color-on-solid": `${onSolidText.r} ${onSolidText.g} ${onSolidText.b}`,
    // Per-tone on-fill inks: the semantic fills carry their own judgement
    // instead of inheriting the global brand-slot ink.
    "--color-on-danger": `${onDanger.r} ${onDanger.g} ${onDanger.b}`,
    "--color-on-success": `${onSuccess.r} ${onSuccess.g} ${onSuccess.b}`,
    "--color-on-warning": `${onWarning.r} ${onWarning.g} ${onWarning.b}`,
    "--color-on-info": `${onInfo.r} ${onInfo.g} ${onInfo.b}`,
    "--color-secondary": `${tokens.secondary.r} ${tokens.secondary.g} ${tokens.secondary.b}`,
    "--color-accent": `${tokens.accent.r} ${tokens.accent.g} ${tokens.accent.b}`,
    "--color-text": `${tokens.text.r} ${tokens.text.g} ${tokens.text.b}`,
    "--color-text-secondary": `${textSecondary.r} ${textSecondary.g} ${textSecondary.b}`,
    "--color-text-tertiary": `${textTertiary.r} ${textTertiary.g} ${textTertiary.b}`,
    "--color-muted": `${tokens.muted.r} ${tokens.muted.g} ${tokens.muted.b}`,
    "--color-border": `${tokens.border.r} ${tokens.border.g} ${tokens.border.b}`,
    "--color-focused-border": `${tokens.focusedBorder.r} ${tokens.focusedBorder.g} ${tokens.focusedBorder.b}`,
    "--color-background": `${tokens.background.r} ${tokens.background.g} ${tokens.background.b}`,
    "--color-surface": `${tokens.surface.r} ${tokens.surface.g} ${tokens.surface.b}`,
    "--color-selected-bg": `${tokens.selectedBackground.r} ${tokens.selectedBackground.g} ${tokens.selectedBackground.b}`,
    "--color-selected-text": `${tokens.selectedText.r} ${tokens.selectedText.g} ${tokens.selectedText.b}`,
    "--color-status-bar-bg": `${tokens.statusBarBackground.r} ${tokens.statusBarBackground.g} ${tokens.statusBarBackground.b}`,
    "--color-success": `${tokens.success.r} ${tokens.success.g} ${tokens.success.b}`,
    "--color-error": `${tokens.error.r} ${tokens.error.g} ${tokens.error.b}`,
    "--color-warning": `${tokens.warning.r} ${tokens.warning.g} ${tokens.warning.b}`,
    "--color-info": `${tokens.info.r} ${tokens.info.g} ${tokens.info.b}`,
    "--hi-color-primary": "rgb(var(--color-primary))",
    "--hi-color-secondary": "rgb(var(--color-secondary))",
    "--hi-color-surface": "rgb(var(--color-surface))",
    "--hi-color-background": "rgb(var(--color-background))",
    "--hi-color-border": "rgb(var(--color-border) / 15%)",
    "--hi-color-text-primary": "rgb(var(--color-text))",
    "--hi-color-text-secondary": "rgb(var(--color-text-secondary))",
    "--hi-color-muted": "rgb(var(--color-muted))",
    "--hi-color-on-primary": "rgb(var(--color-on-primary))",
    "--hi-color-text-on-primary": "rgb(var(--color-on-primary))",
    "--hi-color-text-on-solid": "rgb(var(--color-on-solid-text, 255 255 255))",
    "--hi-color-icon-on-solid": "rgb(var(--color-on-solid-icon, 255 255 255))",
    "--hi-color-success": "rgb(var(--color-success))",
    "--hi-color-error": "rgb(var(--color-error))",
    "--hi-color-warning": "rgb(var(--color-warning))",
    "--hi-color-info": "rgb(var(--color-info))",
    // Content ink for each semantic fill — the same names the pre-existing
    // danger/success consumers already read, now fed per-tone instead of by
    // the global brand slot.
    "--hi-color-text-on-danger": "rgb(var(--color-on-danger))",
    "--hi-color-text-on-success": "rgb(var(--color-on-success))",
    "--hi-color-text-on-warning": "rgb(var(--color-on-warning))",
    "--hi-color-text-on-info": "rgb(var(--color-on-info))",
    // The semantic fills as TEXT on this palette's page/tint — distinct from
    // the on-solid inks above (those assume the background IS the fill).
    "--hi-color-success-fg": `rgb(${successFg.r} ${successFg.g} ${successFg.b})`,
    "--hi-color-danger-fg": `rgb(${errorFg.r} ${errorFg.g} ${errorFg.b})`,
    "--hi-color-warning-fg": `rgb(${warningFg.r} ${warningFg.g} ${warningFg.b})`,
    "--hi-color-info-fg": `rgb(${infoFg.r} ${infoFg.g} ${infoFg.b})`,
    "--hi-color-bg-subtle": "rgb(var(--color-text) / 4%)",
    "--hi-color-bg-elevated": "rgb(var(--color-surface))",
    // hikari-components (the Rust registry CSS) consumes this legacy name
    // for its code/editor surfaces (issue #1496) — alias it onto the
    // channel so embedded hosts follow the live theme instead of the
    // hardcoded light fallback their own sheets carry.
    "--hi-color-bg-container": "rgb(var(--color-surface))",
    "--hi-color-bg-canvas": "rgb(var(--color-background))",
    "--hi-secondary-bg": "rgb(var(--color-text) / 6%)",
    ...groupVars,
  };
}
