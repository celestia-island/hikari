import { computed, ref, watch } from "vue";

import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { addCustomTheme as addCustomThemeToStorage, loadCustomThemes, removeCustomTheme as removeCustomThemeFromStorage, themePresets, tokensToCSSVars, type CustomThemePreset, type ThemeId, type ThemeMode, type ThemePreset } from "./presets";
import { groupTokensToCSSVars, resolveGroupTokens, setTokenGroupsReapply } from "./tokenGroups";
import { invalidateLuminanceCache } from "./useBackgroundLuminance";
import { getTimePeriod, DEFAULT_GEO_LOCATION, type TimePeriod } from "./useSolarTime";

const DEFAULT_THEME = "synthwave84";
const STORAGE_THEME_KEY = "hikari-theme";
export const THEME_MODE_STORAGE_KEY = "hikari-theme-mode";
const STORAGE_MODE_KEY = THEME_MODE_STORAGE_KEY;

// Page-declared brand themes (optional): a site may declare
// window.__celestiaThemes (extra theme ids) and window.__celestiaDefaultTheme
// in its index.html before this module loads. Honor them when resolving the
// stored theme id so a brand id like "endfield" is not dropped as unknown.
// Both helpers are no-ops when the globals are absent, keeping every other
// consumer's behavior unchanged.
interface PageDeclaredThemeGlobals {
  __celestiaThemes?: Record<string, unknown>;
  __celestiaDefaultTheme?: string;
}

function pageDeclaredThemes(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return (window as Window & PageDeclaredThemeGlobals).__celestiaThemes ?? {};
}

function pageDeclaredDefaultTheme(): string | null {
  if (typeof window === "undefined") return null;
  const declared = (window as Window & PageDeclaredThemeGlobals).__celestiaDefaultTheme;
  return typeof declared === "string" ? declared : null;
}

function resolveDefaultTheme(): ThemeId {
  const declared = pageDeclaredDefaultTheme();
  if (
    declared &&
    (declared in themePresets || declared in pageDeclaredThemes())
  ) {
    return declared as ThemeId;
  }
  return DEFAULT_THEME;
}

const currentMode = ref<ThemeMode>(
  (localStorage.getItem(STORAGE_MODE_KEY) as ThemeMode) || "system",
);
const customThemes = ref<CustomThemePreset[]>(loadCustomThemes());

function storedThemeId(): ThemeId {
  const stored = localStorage.getItem(STORAGE_THEME_KEY);
  if (stored) {
    const known = new Set<string>([
      ...Object.keys(themePresets),
      ...Object.keys(pageDeclaredThemes()),
      ...customThemes.value.map((c: CustomThemePreset) => c.id),
    ]);
    if (known.has(stored)) return stored as ThemeId;
    // Stale/invalid theme id (e.g. written by an older build): drop it so
    // applyTheme() never silently bails and leaves the page unthemed.
    localStorage.removeItem(STORAGE_THEME_KEY);
  }
  return resolveDefaultTheme();
}

const currentTheme = ref<ThemeId>(storedThemeId());

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
  // Extension token groups always emit their cssvars: preset/custom-theme
  // overrides win, registry defaults are the final fallback, so consumers
  // can rely on `--<group>-<slot>` existing once the group is registered.
  const groupVars = groupTokensToCSSVars(
    resolveGroupTokens(effectiveMode, preset.groups?.[effectiveMode]),
  );
  const vars = tokensToCSSVars(tokens, groupVars);

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

// Late token-group registrations re-apply the current theme so their
// cssvars land immediately (microtask-coalesced) instead of waiting for
// the next theme/mode switch. The registry lives in tokenGroups.ts and
// must not import this module (that would be a cycle), so it calls back
// through this injected hook. Hikari wires it once on module load;
// applications never call setTokenGroupsReapply themselves.
setTokenGroupsReapply(() => applyTheme());

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
    const custom = customThemes.value.map((ct: CustomThemePreset) => ({
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
      setTheme(resolveDefaultTheme());
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
