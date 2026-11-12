import { readStorageItem, writeStorageItem } from "./safeStorage";

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
  dark: ThemeSchemeTokens;
  light: ThemeSchemeTokens;
  groups?: ThemeTokenGroupModes;
}

export type ThemeId = string;
export type ThemeMode = "system" | "light" | "dark";

export interface CustomThemePreset {
  id: string;
  name: string;
  dark: ThemeSchemeTokens;
  light: ThemeSchemeTokens;
  groups?: ThemeTokenGroupModes;
}

const CUSTOM_STORAGE_KEY = "hikari-custom-themes";

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

const rgb = (r: number, g: number, b: number): ThemeTokenRGB => ({ r, g, b });

/**
 * The stock preset table holds exactly ONE theme.
 *
 * `default` carries the pair the library has always fallen back to: its
 * light scheme is the historical pink/paper palette and its dark scheme the
 * black-blue one. The four editor-derived looks (Synthwave '84, Nord,
 * Gruvbox, Tokyo Night) were collapsed into this single pair on user
 * direction — the library stops shipping competing aesthetics. A consumer
 * that wants a distinct brand registers its own preset (chest's `sc` is the
 * reference), and a user who wants another look edits this one through the
 * theme dialog and keeps it as a custom scheme.
 *
 * Values are carried over VERBATIM from the entries this collapse retired —
 * `synthwave84.light` into the light scheme, `nord.dark` into the dark one.
 * Nothing was restyled: the dark scheme therefore keeps Nord's pale Polar
 * Water primary (#88C0D0) and, with it, the near-black on-solid ink slots
 * that pale primary requires (white on it is ~1.9:1). A stored id from the
 * retired set is no longer a known theme, so `storedThemeId()` drops it and
 * the engine resolves this default instead.
 */
export const themePresets: Record<ThemeId, ThemePreset> = {
  default: {
    id: "default",
    name: "Default",
    dark: {
      primary: rgb(136, 192, 208),
      secondary: rgb(143, 188, 187),
      accent: rgb(94, 129, 172),
      text: rgb(247, 249, 252),
      muted: rgb(180, 180, 180),
      border: rgb(128, 128, 128),
      focusedBorder: rgb(136, 192, 208),
      background: rgb(22, 27, 38),
      surface: rgb(34, 40, 54),
      selectedBackground: rgb(70, 70, 85),
      selectedText: rgb(248, 248, 250),
      statusBarBackground: rgb(34, 40, 54),
      success: rgb(163, 190, 140),
      error: rgb(191, 97, 106),
      warning: rgb(208, 135, 112),
      info: rgb(136, 192, 208),
      // The pale primary puts dark ink on solid fills (white is ~1.9:1).
      onSolidText: rgb(46, 52, 64),
      onSolidIcon: rgb(46, 52, 64),
    },
    light: {
      primary: rgb(214, 51, 132),
      secondary: rgb(156, 106, 222),
      accent: rgb(230, 167, 0),
      text: rgb(30, 30, 30),
      muted: rgb(80, 80, 80),
      border: rgb(128, 128, 128),
      focusedBorder: rgb(214, 51, 132),
      background: rgb(245, 245, 240),
      surface: rgb(255, 255, 255),
      selectedBackground: rgb(200, 200, 205),
      selectedText: rgb(40, 40, 45),
      statusBarBackground: rgb(230, 230, 225),
      success: rgb(16, 185, 129),
      error: rgb(239, 68, 68),
      warning: rgb(245, 158, 11),
      info: rgb(6, 182, 212),
      onSolidText: rgb(255, 255, 255),
      onSolidIcon: rgb(255, 255, 255),
    },
  },
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

function contrastColor({ r, g, b }: ThemeTokenRGB): ThemeTokenRGB {
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.55 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
}

/**
 * The white-or-black ink for ONE solid fill. Deliberately NOT "whichever
 * side wins the WCAG ratio": on saturated fills the ratio winner is the
 * black ink far more often than design systems ship it (a 32-colour sweep
 * of shipped brand/semantic solids picked white only 19% of the time by
 * ratio, while Radix, Bootstrap and Material all ship white on them).
 * The house rule (user direction, 2026-11-12) is perception-first:
 *
 *   solid fill  → WHITE by default; BLACK only when the fill is light
 *                 enough to need it (perceptual luminance above 0.65,
 *                 which lands on Radix's "designed for dark foreground"
 *                 set: Sky, Mint, Lime, Yellow, Amber, plus the pale
 *                 Nord tones; see the threshold note in solidInk);
 *   translucent → ride the theme's text channel (never computed here).
 *
 * Per-fill, not per-theme: one global on-solid slot cannot be right for a
 * dark red AND a pale amber at once, which is exactly how the toast
 * copy/close glyphs went near-black on themed bands (2026-11-12 report).
 */
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
  const onPrimary = contrastColor(tokens.primary);
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
    "--hi-color-bg-subtle": "rgb(var(--color-surface) / 0.5)",
    "--hi-color-bg-elevated": "rgb(var(--color-surface))",
    "--hi-color-bg-canvas": "rgb(var(--color-background))",
    "--hi-secondary-bg": "rgb(var(--color-surface) / 0.5)",
    ...groupVars,
  };
}
