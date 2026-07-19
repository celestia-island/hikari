import { computed, ref, watch } from "vue";

import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { addCustomTheme as addCustomThemeToStorage, loadCustomThemes, removeCustomTheme as removeCustomThemeFromStorage, themePresets, tokensToCSSVars, type CustomThemePreset, type ThemeId, type ThemeMode, type ThemePreset } from "./presets";
import { invalidateLuminanceCache } from "./useBackgroundLuminance";
import { getTimePeriod, DEFAULT_GEO_LOCATION, type TimePeriod } from "./useSolarTime";

const DEFAULT_THEME = "synthwave84";
const STORAGE_THEME_KEY = "hikari-theme";
const STORAGE_MODE_KEY = "hikari-theme-mode";

const currentTheme = ref<ThemeId>(
  localStorage.getItem(STORAGE_THEME_KEY) || DEFAULT_THEME,
);
const currentMode = ref<ThemeMode>(
  (localStorage.getItem(STORAGE_MODE_KEY) as ThemeMode) || "system",
);
const customThemes = ref<CustomThemePreset[]>(loadCustomThemes());

const currentPeriod = ref<TimePeriod>(
  getTimePeriod(DEFAULT_GEO_LOCATION.lat, DEFAULT_GEO_LOCATION.lng),
);

let initialized = false;

function resolveEffectiveMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return currentPeriod.value === "day" ? "light" : "dark";
  }
  return mode;
}

const THEME_TRANSITION_DURATION = 300;
let transitionTimer: CronHandle | null = null;

function applyTheme() {
  const el = document.documentElement;
  const all = getAllThemePresets();
  const preset = all[currentTheme.value];
  if (!preset) return;

  el.classList.add("s-theme-transitioning");

  const effectiveMode = resolveEffectiveMode(currentMode.value);
  const tokens = effectiveMode === "dark" ? preset.dark : preset.light;
  const vars = tokensToCSSVars(tokens);

  invalidateLuminanceCache();

  for (const [key, value] of Object.entries(vars)) {
    el.style.setProperty(key, value);
  }

  el.setAttribute("data-theme", currentTheme.value);
  el.setAttribute("data-mode", effectiveMode);

  transitionTimer?.disconnect();
  transitionTimer = scheduleCronAfter(() => {
    el.classList.remove("s-theme-transitioning");
    transitionTimer = null;
  }, THEME_TRANSITION_DURATION);
}

function getAllThemePresets(): Record<string, ThemePreset> {
  const result: Record<string, ThemePreset> = { ...themePresets };
  for (const ct of customThemes.value) {
    result[ct.id] = ct;
  }
  return result;
}

export function initTheme() {
  if (initialized) return;
  initialized = true;
  const storedMode = localStorage.getItem(STORAGE_MODE_KEY) as ThemeMode | null;
  if (storedMode === "dark" || storedMode === "light") {
    currentMode.value = storedMode;
  }
  applyTheme();
}

export function useTheme() {
  const effectiveMode = computed(() => resolveEffectiveMode(currentMode.value));

  const allThemeList = computed(() => {
    const builtIn = (Object.keys(themePresets) as string[]).map((id) => ({
      id,
      name: themePresets[id as keyof typeof themePresets].name,
      isCustom: false,
    }));
    const custom = customThemes.value.map((ct) => ({
      id: ct.id,
      name: ct.name,
      isCustom: true,
    }));
    return [...builtIn, ...custom];
  });

  function setTheme(id: ThemeId) {
    currentTheme.value = id;
    localStorage.setItem(STORAGE_THEME_KEY, id);
    applyTheme();
  }

  function setMode(mode: ThemeMode) {
    currentMode.value = mode;
    localStorage.setItem(STORAGE_MODE_KEY, mode);
    applyTheme();
  }

  function toggleMode() {
    setMode(effectiveMode.value === "dark" ? "light" : "dark");
  }

  function addCustomTheme(theme: CustomThemePreset) {
    addCustomThemeToStorage(theme);
    customThemes.value = loadCustomThemes();
  }

  function removeCustomTheme(id: string) {
    removeCustomThemeFromStorage(id);
    customThemes.value = loadCustomThemes();
    if (currentTheme.value === id) {
      setTheme(DEFAULT_THEME);
    }
  }

  return {
    currentTheme,
    currentMode,
    effectiveMode,
    setTheme,
    setMode,
    toggleMode,
    presets: themePresets,
    allThemeList,
    customThemes,
    addCustomTheme,
    removeCustomTheme,
  };
}
