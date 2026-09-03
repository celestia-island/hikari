import { computed, ref, watch } from "vue";

import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { scheduleInterval, type IntervalHandle } from "../runtime/intervalBus";
import { addCustomTheme as addCustomThemeToStorage, loadCustomThemes, removeCustomTheme as removeCustomThemeFromStorage, themePresets, tokensToCSSVars, type CustomThemePreset, type ThemeId, type ThemeMode, type ThemePreset } from "./presets";
import { groupTokensToCSSVars, resolveGroupTokens, setTokenGroupsReapply } from "./tokenGroups";
import { invalidateLuminanceCache } from "./useBackgroundLuminance";
import { getGeolocation, getTimePeriod, timezoneFallback, type GeoLocation, type TimePeriod } from "./useSolarTime";

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
  // First paint uses the synchronous timezone-offset estimate; the theme
  // clock below refines it with a real geolocation fix once that lands.
  getTimePeriod(timezoneFallback().lat, timezoneFallback().lng),
);

/**
 * The theme clock. `system` mode resolves day/night from the sun, so it
 * needs (a) a real geolocation fix and (b) re-evaluation as time passes —
 * previously the period was computed once at module init from
 * DEFAULT_GEO_LOCATION and never refreshed, pinning auto mode to Shanghai's
 * daylight at load time.
 */
const themeGeo = ref<GeoLocation>(timezoneFallback());

/** How often the solar period is recomputed from the cached coordinates
 *  (dawn/dusk flips while the page stays open). Visibility-aware: the
 *  interval bus pauses while hidden and catches up once on return. */
const THEME_CLOCK_TICK_MS = 5 * 60 * 1000;

function updatePeriod() {
  currentPeriod.value = getTimePeriod(themeGeo.value.lat, themeGeo.value.lng);
}

let clockStarted = false;
let clockInterval: IntervalHandle | null = null;

function startThemeClock() {
  if (clockStarted) return;
  clockStarted = true;
  // Fire-and-forget: a failed fix keeps the timezone estimate silently.
  void getGeolocation()
    .then((geo) => {
      themeGeo.value = geo;
      updatePeriod();
      if (currentMode.value === "system") applyTheme();
    })
    .catch(() => {});
  clockInterval = scheduleInterval(() => {
    const before = currentPeriod.value;
    updatePeriod();
    // Re-apply only on an actual day↔night flip while in system mode —
    // manual modes ignore the period entirely.
    if (currentMode.value === "system" && currentPeriod.value !== before) {
      applyTheme();
    }
  }, THEME_CLOCK_TICK_MS);
}

/** Re-run the geolocation resolution (and re-apply in system mode). For
 *  hosts that registered a geolocation provider after initTheme(), or that
 *  want a manual refresh (network reconnect, wake-from-sleep). */
export function refreshThemeClock(): Promise<GeoLocation> {
  return getGeolocation().then((geo) => {
    themeGeo.value = geo;
    updatePeriod();
    if (currentMode.value === "system") applyTheme();
    return geo;
  });
}

/** Stop the theme clock. Host teardown / tests; initTheme() restarts it. */
export function stopThemeClock() {
  clockInterval?.disconnect();
  clockInterval = null;
  clockStarted = false;
}

let initialized = false;

function resolveEffectiveMode(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return currentPeriod.value === "day" ? "light" : "dark";
  }
  return mode;
}

const THEME_TRANSITION_DURATION = 300;
let transitionTimer: CronHandle | null = null;

/**
 * Theme vars live in ONE managed stylesheet block (`:root` overrides)
 * instead of a hundred inline declarations on `<html style="...">`.
 *  - Inline style attributes bloat the DOM, show up as giant devtools
 *    noise on the root element, defeat caching of the token set and make
 *    every style recalc parse the whole attribute again.
 *  - A stylesheet block is a single atomic replacement (one recalc for
 *    the whole theme apply) and inspectable/serializable.
 *  - Only the DELTAS are written: hikari's static stylesheet already
 *    seeds :root with the full default token set (including pure
 *    derivations like `--hi-color-primary: rgb(var(--color-primary))`),
 *    so a token whose value already resolves identically needs no
 *    override at all — a default-ish theme injects a handful of vars
 *    instead of ~80.
 */
const THEME_VARS_STYLE_ATTR = "data-hikari-theme-vars";

function normalizeVarValue(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Keep only the vars whose value differs from the static cascade. */
export function pickThemeVarDeltas(
  vars: Record<string, string>,
  baseline: Record<string, string>,
): Record<string, string> {
  const deltas: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    const normalized = normalizeVarValue(value);
    if (normalizeVarValue(baseline[key] ?? "") !== normalized) {
      deltas[key] = normalized;
    }
  }
  return deltas;
}

function themeVarsStyleElement(): HTMLStyleElement {
  let styleEl = document.head.querySelector<HTMLStyleElement>(
    `style[${THEME_VARS_STYLE_ATTR}]`,
  );
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.setAttribute(THEME_VARS_STYLE_ATTR, "");
    document.head.appendChild(styleEl);
  }
  return styleEl;
}

function injectThemeVars(el: HTMLElement, vars: Record<string, string>): void {
  const styleEl = themeVarsStyleElement();
  // Measure the cascade WITHOUT our own previous overrides: disable the
  // managed block, read every candidate, re-enable. One recalc serves
  // all reads, and applyTheme is a rare switch-time action.
  const baseline: Record<string, string> = {};
  try {
    styleEl.disabled = true;
    const computed = getComputedStyle(el);
    for (const key of Object.keys(vars)) {
      baseline[key] = computed.getPropertyValue(key);
    }
  } finally {
    styleEl.disabled = false;
  }

  const deltas = pickThemeVarDeltas(vars, baseline);
  styleEl.textContent = Object.keys(deltas).length > 0
    ? `:root{${Object.entries(deltas).map(([key, value]) => `${key}:${value}`).join(";")}}`
    : "";
}

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

  injectThemeVars(el, vars);

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
  startThemeClock();
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
    /** The theme clock's resolved coordinates (timezone estimate until a
     *  real fix lands). Read-only; refreshThemeClock() updates it. */
    geo: computed(() => themeGeo.value),
    /** The current solar period driving system mode. */
    period: computed(() => currentPeriod.value),
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
