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
}

export interface ThemePreset {
  id: string;
  name: string;
  dark: ThemeSchemeTokens;
  light: ThemeSchemeTokens;
}

export type ThemeId = string;
export type ThemeMode = "system" | "light" | "dark";

export interface CustomThemePreset {
  id: string;
  name: string;
  dark: ThemeSchemeTokens;
  light: ThemeSchemeTokens;
}

const CUSTOM_STORAGE_KEY = "hikari-custom-themes";

export function loadCustomThemes(): CustomThemePreset[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(list: CustomThemePreset[]) {
  localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
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

export const themePresets: Record<ThemeId, ThemePreset> = {
  synthwave84: {
    id: "synthwave84",
    name: "Synthwave '84",
    dark: {
      primary: rgb(255, 107, 157),
      secondary: rgb(199, 146, 234),
      accent: rgb(253, 235, 139),
      text: rgb(228, 228, 231),
      muted: rgb(180, 180, 180),
      border: rgb(255, 255, 255),
      focusedBorder: rgb(255, 107, 157),
      background: rgb(14, 14, 30),
      surface: rgb(24, 24, 42),
      selectedBackground: rgb(70, 70, 85),
      selectedText: rgb(240, 240, 240),
      statusBarBackground: rgb(24, 24, 42),
      success: rgb(114, 241, 184),
      error: rgb(255, 107, 107),
      warning: rgb(253, 235, 139),
      info: rgb(110, 231, 239),
    },
    light: {
      primary: rgb(214, 51, 132),
      secondary: rgb(156, 106, 222),
      accent: rgb(230, 167, 0),
      text: rgb(30, 30, 30),
      muted: rgb(80, 80, 80),
      border: rgb(0, 0, 0),
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
    },
  },
  nord: {
    id: "nord",
    name: "Nord",
    dark: {
      primary: rgb(136, 192, 208),
      secondary: rgb(143, 188, 187),
      accent: rgb(94, 129, 172),
      text: rgb(236, 239, 244),
      muted: rgb(180, 180, 180),
      border: rgb(255, 255, 255),
      focusedBorder: rgb(136, 192, 208),
      background: rgb(22, 27, 38),
      surface: rgb(34, 40, 54),
      selectedBackground: rgb(70, 70, 85),
      selectedText: rgb(240, 240, 240),
      statusBarBackground: rgb(34, 40, 54),
      success: rgb(163, 190, 140),
      error: rgb(191, 97, 106),
      warning: rgb(208, 135, 112),
      info: rgb(136, 192, 208),
    },
    light: {
      primary: rgb(94, 129, 172),
      secondary: rgb(136, 192, 208),
      accent: rgb(143, 188, 187),
      text: rgb(30, 30, 30),
      muted: rgb(80, 80, 80),
      border: rgb(0, 0, 0),
      focusedBorder: rgb(94, 129, 172),
      background: rgb(236, 239, 244),
      surface: rgb(229, 233, 240),
      selectedBackground: rgb(200, 200, 205),
      selectedText: rgb(40, 40, 45),
      statusBarBackground: rgb(220, 224, 232),
      success: rgb(163, 190, 140),
      error: rgb(191, 97, 106),
      warning: rgb(208, 135, 112),
      info: rgb(136, 192, 208),
    },
  },
  gruvbox: {
    id: "gruvbox",
    name: "Gruvbox",
    dark: {
      primary: rgb(251, 189, 84),
      secondary: rgb(177, 161, 134),
      accent: rgb(214, 160, 115),
      text: rgb(235, 219, 178),
      muted: rgb(180, 180, 180),
      border: rgb(255, 255, 255),
      focusedBorder: rgb(251, 189, 84),
      background: rgb(20, 20, 20),
      surface: rgb(34, 32, 30),
      selectedBackground: rgb(70, 70, 85),
      selectedText: rgb(240, 240, 240),
      statusBarBackground: rgb(34, 32, 30),
      success: rgb(169, 195, 85),
      error: rgb(251, 118, 118),
      warning: rgb(251, 189, 84),
      info: rgb(131, 191, 152),
    },
    light: {
      primary: rgb(204, 128, 49),
      secondary: rgb(168, 135, 81),
      accent: rgb(186, 128, 82),
      text: rgb(30, 30, 30),
      muted: rgb(80, 80, 80),
      border: rgb(0, 0, 0),
      focusedBorder: rgb(204, 128, 49),
      background: rgb(251, 241, 199),
      surface: rgb(242, 229, 188),
      selectedBackground: rgb(200, 200, 205),
      selectedText: rgb(40, 40, 45),
      statusBarBackground: rgb(235, 225, 185),
      success: rgb(121, 153, 50),
      error: rgb(204, 69, 57),
      warning: rgb(204, 128, 49),
      info: rgb(70, 120, 104),
    },
  },
  tokyonight: {
    id: "tokyonight",
    name: "Tokyo Night",
    dark: {
      primary: rgb(122, 162, 247),
      secondary: rgb(125, 207, 255),
      accent: rgb(247, 118, 142),
      text: rgb(192, 202, 245),
      muted: rgb(180, 180, 180),
      border: rgb(255, 255, 255),
      focusedBorder: rgb(122, 162, 247),
      background: rgb(14, 15, 24),
      surface: rgb(22, 24, 36),
      selectedBackground: rgb(70, 70, 85),
      selectedText: rgb(240, 240, 240),
      statusBarBackground: rgb(22, 24, 36),
      success: rgb(158, 206, 106),
      error: rgb(247, 118, 142),
      warning: rgb(255, 183, 87),
      info: rgb(125, 207, 255),
    },
    light: {
      primary: rgb(52, 96, 189),
      secondary: rgb(56, 157, 192),
      accent: rgb(225, 72, 96),
      text: rgb(30, 30, 30),
      muted: rgb(80, 80, 80),
      border: rgb(0, 0, 0),
      focusedBorder: rgb(52, 96, 189),
      background: rgb(231, 233, 241),
      surface: rgb(221, 223, 231),
      selectedBackground: rgb(200, 200, 205),
      selectedText: rgb(40, 40, 45),
      statusBarBackground: rgb(215, 217, 227),
      success: rgb(86, 159, 86),
      error: rgb(225, 72, 96),
      warning: rgb(206, 145, 60),
      info: rgb(56, 157, 192),
    },
  },
};

export type ThemeTokens = ThemeSchemeTokens;

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

function mixToken(a: ThemeTokenRGB, b: ThemeTokenRGB, t: number): ThemeTokenRGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export function tokensToCSSVars(
  tokens: ThemeSchemeTokens,
): Record<string, string> {
  const onPrimary = contrastColor(tokens.primary);
  const textSecondary = mixToken(tokens.text, tokens.muted, 0.25);
  return {
    "--color-primary": `${tokens.primary.r} ${tokens.primary.g} ${tokens.primary.b}`,
    "--color-on-primary": `${onPrimary.r} ${onPrimary.g} ${onPrimary.b}`,
    "--color-secondary": `${tokens.secondary.r} ${tokens.secondary.g} ${tokens.secondary.b}`,
    "--color-accent": `${tokens.accent.r} ${tokens.accent.g} ${tokens.accent.b}`,
    "--color-text": `${tokens.text.r} ${tokens.text.g} ${tokens.text.b}`,
    "--color-text-secondary": `${textSecondary.r} ${textSecondary.g} ${textSecondary.b}`,
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
  };
}
