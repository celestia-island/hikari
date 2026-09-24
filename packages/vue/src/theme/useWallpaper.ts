import { computed, ref, watch, type WatchStopHandle } from "vue";

import { scheduleInterval, type IntervalHandle } from "../runtime/intervalBus";
import {
  DEFAULT_GEO_LOCATION,
  getGeolocation,
  getTimePeriod,
  type GeoLocation,
  type TimePeriod,
} from "./useSolarTime";
import { useTheme } from "./useTheme";
import {
  DEFAULT_PRESETS,
  DEFAULT_WALLPAPER_ID,
  addCustomWallpaper as addCustom,
  configureWallpaperStorage,
  getDisplaySettings,
  hasStoredWallpaperId,
  isTimeAware,
  loadActiveWallpaperId,
  loadCachedGeolocation,
  loadCustomWallpapers,
  registerWallpaperPack,
  removeCustomWallpaper as removeCustom,
  saveActiveWallpaperId,
  saveCachedGeolocation,
  setDisplaySettings as persistDisplaySettings,
  updateCustomWallpaper as updateCustom,
  type CustomWallpaper,
  type TimeAwareWallpaper,
  type WallpaperDisplaySettings,
  type WallpaperPackEntry,
  type WallpaperPreset,
  type WallpaperSource,
  type WallpaperStorageConfig,
  type WallpaperType,
} from "./wallpaper";

/**
 * Wallpaper bindings the HOST supplies. Every host-specific fact that used to
 * be an import (chest's brand map, its generated wallpaper pack, its shader
 * registry) arrives through this one config object, so hikari carries the
 * logic without carrying any application's assets.
 *
 * `initWallpaper({ ... })` applies the whole object; the underlying
 * registrations are exported individually for hosts that never boot the
 * clock (an SSR pass, a storybook, a test).
 */
export interface WallpaperInitConfig extends WallpaperStorageConfig {
  /** The host's wallpaper pack (see registerWallpaperPack). */
  presets?: readonly WallpaperPackEntry[] | null;
  /** Theme id → wallpaper id, for hosts whose brand themes own a wallpaper. */
  brandDefaults?: Record<string, string>;
  /** Resolves a pipeline id to a host preset (see setWallpaperPipelineLookup). */
  pipelineLookup?: WallpaperPipelineLookup | null;
}

/** Wallpaper bindings declared by SERVER theme configs — they override the
 *  registered brand map (the config file is the source of truth). */
const serverThemeWallpapers = new Map<string, string>();

/** Called by the server registry when a config theme carries a binding. */
export function registerServerThemeWallpaper(themeId: string, wallpaperId: string): void {
  serverThemeWallpapers.set(themeId, wallpaperId);
}

const brandDefaultWallpapers: Record<string, string> = {};

/** Theme id → wallpaper id for the host's brand themes (replaces the previous map). */
export function registerWallpaperBrandDefaults(record: Record<string, string>): void {
  for (const key of Object.keys(brandDefaultWallpapers)) delete brandDefaultWallpapers[key];
  Object.assign(brandDefaultWallpapers, record);
}

/** Wallpaper id a given theme ships with (server config → brand map → pack default). */
export function brandDefaultWallpaperFor(themeId: string): string {
  return serverThemeWallpapers.get(themeId)
    ?? brandDefaultWallpapers[themeId]
    ?? DEFAULT_WALLPAPER_ID;
}

/** The slice of a host pipeline preset this layer needs (chest's shader
 *  registry satisfies it structurally). */
export interface WallpaperPipelinePreset {
  overlay?: { light: string; dark: string };
}

/**
 * Resolves a pipeline preset id (already suffixed with the mode variant)
 * to the host's preset, or null when the host has none. Default: no
 * pipelines — the composable then degrades to the bare preset id, exactly
 * as it does for an unregistered host entry.
 */
export type WallpaperPipelineLookup = (
  presetId: string,
) => WallpaperPipelinePreset | null | undefined;

let pipelineLookup: WallpaperPipelineLookup = () => null;

export function setWallpaperPipelineLookup(lookup: WallpaperPipelineLookup | null): void {
  pipelineLookup = lookup ?? (() => null);
}

/**
 * Apply host configuration. Safe to call more than once (each call replaces
 * the previous values); every field is optional so a host can configure only
 * what it has. Re-arms the lazy storage hydrate, because both the namespace
 * and the pack decide what a stored id resolves to.
 */
export function configureWallpaper(config: WallpaperInitConfig): void {
  if ("storagePrefix" in config || "legacyKeys" in config) {
    configureWallpaperStorage({
      storagePrefix: config.storagePrefix,
      legacyKeys: config.legacyKeys,
    });
  }
  if (config.presets !== undefined) registerWallpaperPack(config.presets);
  if (config.brandDefaults !== undefined) registerWallpaperBrandDefaults(config.brandDefaults);
  if (config.pipelineLookup !== undefined) setWallpaperPipelineLookup(config.pipelineLookup);
  rearmWallpaperState();
}

/**
 * Provenance is inferred, never stored: the active id equaling the theme's
 * default means "following the theme". A brand switch therefore re-binds the
 * wallpaper only for follow-state selections — a user-picked wallpaper
 * survives brand switches untouched.
 */
export function resolveThemeFollowSwitch(
  activeId: string,
  prevTheme: string,
  nextTheme: string,
): string | null {
  return activeId === brandDefaultWallpaperFor(prevTheme)
    ? brandDefaultWallpaperFor(nextTheme)
    : null;
}

// ── Module state (no storage access at module scope) ────────────────────
//
// Importing this module must stay safe on a server: the refs below start
// from constants and are filled from storage by the first state access
// (ensureWallpaperState, called by useWallpaper()/initWallpaper()). Reading
// localStorage here — the shape this layer was ported from — threw
// `ReferenceError: localStorage is not defined` the moment an SSR host
// imported the module.

const activeWallpaperId = ref<string>(DEFAULT_WALLPAPER_ID);
const customWallpapers = ref<CustomWallpaper[]>([]);
export const geo = ref<GeoLocation>({ ...DEFAULT_GEO_LOCATION });
export const currentPeriod = ref<TimePeriod>("day");

// Bumped whenever the user edits per-wallpaper display settings so the
// `displaySettings` computed below re-evaluates (it also re-evaluates when
// the active wallpaper changes). The version ref is intentionally module
// scope so any composable consumer shares one source of truth.
const settingsVersion = ref(0);

const displaySettings = computed<WallpaperDisplaySettings>(() => {
  void settingsVersion.value;
  return getDisplaySettings(activeWallpaperId.value);
});

function setDisplaySettings(partial: Partial<WallpaperDisplaySettings>) {
  const id = activeWallpaperId.value;
  const next = { ...getDisplaySettings(id), ...partial };
  persistDisplaySettings(id, next);
  settingsVersion.value++;
}

let hydrated = false;

/** Re-arm the lazy hydrate (a registration changed what storage resolves to). */
function rearmWallpaperState(): void {
  hydrated = false;
}

function hydrateWallpaperState(): void {
  if (hydrated) return;
  hydrated = true;
  activeWallpaperId.value = loadActiveWallpaperId();
  customWallpapers.value = loadCustomWallpapers();
  geo.value = loadCachedGeolocation() ?? { ...DEFAULT_GEO_LOCATION };
  // A stored id that resolves to nothing (retired model custom, removed pack
  // entry, stale cross-device value) resets to the default instead of
  // rendering the fallback wallpaper with a blank picker selection.
  if (
    !DEFAULT_PRESETS.some((w) => w.id === activeWallpaperId.value) &&
    !customWallpapers.value.some((w) => w.id === activeWallpaperId.value)
  ) {
    activeWallpaperId.value = DEFAULT_WALLPAPER_ID;
    saveActiveWallpaperId(DEFAULT_WALLPAPER_ID);
  }
}

/**
 * The first-call storage read (idempotent until a registration re-arms it).
 * Exported for hosts that only consume the store functions, and for tests
 * that must pin the hydrate point.
 */
export function ensureWallpaperState(): void {
  hydrateWallpaperState();
}

// The wallpaper solar clock must share hikari's theme-clock semantics
// (intervalBus: paused while hidden, fires once on visibility return), not
// the rAF-driven animationBus — rAF suspends entirely in background tabs,
// so the period could lag a full cadence behind the theme after a
// day/night flip while the page was hidden. Two clocks, one fact.
let periodHandle: IntervalHandle | null = null;
let themeWatchStop: WatchStopHandle | null = null;

function updatePeriod() {
  currentPeriod.value = getTimePeriod(geo.value.lat, geo.value.lng);
}

export function initWallpaper(config?: WallpaperInitConfig) {
  // Idempotent: a second call replaces the previous clock and follow
  // watcher instead of stacking duplicates (the app boots once, but a
  // hot-reload or a defensive re-init must not double the sync watcher —
  // its flush:"sync" clobber-protection depends on there being exactly
  // one).
  if (config) configureWallpaper(config);
  // Adopt the persisted state BEFORE seeding: a stored choice outranks the
  // theme default, and the seed below is a no-op once the marker exists.
  ensureWallpaperState();
  periodHandle?.disconnect();
  periodHandle = null;
  themeWatchStop?.();
  themeWatchStop = null;
  updatePeriod();
  periodHandle = scheduleInterval(updatePeriod, 60_000);

  getGeolocation().then(({ lat, lng }) => {
    geo.value = { lat, lng };
    saveCachedGeolocation(lat, lng);
    updatePeriod();
  });

  // Brand themes own a matching wallpaper. First run (no stored choice)
  // seeds the current theme's default; afterwards a brand switch re-binds
  // the wallpaper only while it still follows the previous theme's default
  // (see resolveThemeFollowSwitch). Registered once here — the composable
  // body runs per consumer, this init runs once per boot.
  const { currentTheme } = useTheme();
  if (!hasStoredWallpaperId()) {
    const seeded = brandDefaultWallpaperFor(currentTheme.value);
    if (seeded !== activeWallpaperId.value) {
      activeWallpaperId.value = seeded;
      saveActiveWallpaperId(seeded);
    }
  }
  // flush:"sync" is load-bearing: applyFromServer() adopts an explicit
  // server wallpaper AFTER setTheme() within one synchronous tick, and a
  // default-flush watcher would fire afterwards and clobber that adoption
  // back to the (new) theme default — persisting the clobber via the
  // bridge's sync-up. Synchronous execution keeps the follow switch inside
  // the setTheme call, before any later explicit adoption runs.
  themeWatchStop = watch(
    currentTheme,
    (next, prev) => {
      const target = resolveThemeFollowSwitch(activeWallpaperId.value, prev, next);
      if (target && target !== activeWallpaperId.value) {
        activeWallpaperId.value = target;
        saveActiveWallpaperId(target);
      }
    },
    { flush: "sync" },
  );
}

export function destroyWallpaper() {
  periodHandle?.disconnect();
  periodHandle = null;
  themeWatchStop?.();
  themeWatchStop = null;
}

export function useWallpaper() {
  ensureWallpaperState();
  const { effectiveMode, currentTheme } = useTheme();

  const allWallpapers = computed<WallpaperPreset[]>(() => [
    ...DEFAULT_PRESETS,
    ...customWallpapers.value.map((cw) => ({
      id: cw.id,
      name: cw.name,
      sources: cw.source,
    })),
  ]);

  const activeWallpaper = computed(() =>
    allWallpapers.value.find((w) => w.id === activeWallpaperId.value)
    ?? allWallpapers.value.find((w) => w.id === DEFAULT_WALLPAPER_ID)
    ?? allWallpapers.value[0],
  );

  function setActiveWallpaper(id: string) {
    activeWallpaperId.value = id;
    saveActiveWallpaperId(id);
  }

  // Follow-state is inferred (active id == the theme's default), so it is
  // self-healing across devices: the server pref stays a plain id string.
  const followsTheme = computed(
    () => activeWallpaperId.value === brandDefaultWallpaperFor(currentTheme.value),
  );

  function rebindToThemeDefault() {
    setActiveWallpaper(brandDefaultWallpaperFor(currentTheme.value));
  }

  function addCustomWallpaper(name: string, source: WallpaperSource): string {
    const id = `custom-${Date.now()}`;
    addCustom({ id, name, source, addedAt: Date.now() });
    customWallpapers.value = loadCustomWallpapers();
    return id;
  }

  function updateCustomWallpaper(wp: CustomWallpaper): boolean {
    const ok = updateCustom(wp);
    if (ok) customWallpapers.value = loadCustomWallpapers();
    return ok;
  }

  function removeCustomWallpaper(id: string) {
    removeCustom(id);
    customWallpapers.value = loadCustomWallpapers();
    if (activeWallpaperId.value === id) {
      setActiveWallpaper(DEFAULT_WALLPAPER_ID);
    }
  }

  function resolveSource(sources: WallpaperSource | TimeAwareWallpaper): WallpaperSource | null {
    if (!isTimeAware(sources)) return sources as WallpaperSource;
    const tw = sources as TimeAwareWallpaper;
    const src = tw[currentPeriod.value];
    if (src) return src;
    for (const key of Object.keys(tw) as (keyof TimeAwareWallpaper)[]) {
      if (tw[key]) return tw[key];
    }
    return null;
  }

  const currentSource = computed(() => {
    const wp = activeWallpaper.value;
    if (!wp) return null;
    return resolveSource(wp.sources);
  });

  const wallpaperType = computed<WallpaperType>(() => {
    return currentSource.value?.type ?? "solid";
  });

  const isVideo = computed(() => wallpaperType.value === "video");
  const isPipeline = computed(() => wallpaperType.value === "pipeline");
  const isSolid = computed(() => wallpaperType.value === "solid");

  const mediaUrl = computed(() => {
    const src = currentSource.value;
    if (src?.type === "image" || src?.type === "video") {
      return src.url;
    }
    return "";
  });

  const solidColor = computed<"black" | "white" | null>(() => {
    const src = currentSource.value;
    if (src?.type === "solid") {
      if (src.color === "auto") {
        return effectiveMode.value === "light" ? "white" : "black";
      }
      return src.color;
    }
    return null;
  });

  const pipelinePreset = computed<string | null>(() => {
    const src = currentSource.value;
    if (src?.type !== "pipeline") return null;
    // Dual-mode pipelines (light/dark variants) resolve per effective mode;
    // single-mode pipelines are used as-is.
    const mode = effectiveMode.value === "light" ? "light" : "dark";
    return pipelineLookup(`${src.preset}.${mode}`) ? `${src.preset}.${mode}` : src.preset;
  });

  const pipelineOverlay = computed<string | null>(() => {
    if (!isPipeline.value || !pipelinePreset.value) return null;
    const preset = pipelineLookup(pipelinePreset.value);
    if (!preset?.overlay) return null;
    return effectiveMode.value === "light" ? preset.overlay.light : preset.overlay.dark;
  });

  const overlayOpacity = computed(() => {
    if (isSolid.value) return 0;
    if (isPipeline.value) {
      return pipelineOverlay.value ? 1 : 0;
    }
    // A host-declared overlay (e.g. a wallpaper pack manifest [display])
    // wins over the mode/period defaults.
    const manifestOverlay = activeWallpaper.value?.display?.overlay;
    if (typeof manifestOverlay === "number") return manifestOverlay;
    if (effectiveMode.value === "light") {
      if (currentPeriod.value === "night") return 0.6;
      return 0.78;
    }
    // Dark mode needs a deeper scrim than light: mid-tone wallpaper art
    // eats text contrast at 0.6 (the dark tint also composes over the
    // 60% page-tint). 0.78 keeps foreground content clearly readable.
    return 0.78;
  });

  return {
    activeWallpaperId,
    activeWallpaper,
    allWallpapers,
    customWallpapers,
    currentSource,
    currentPeriod,
    wallpaperType,
    isVideo,
    isPipeline,
    isSolid,
    displaySettings,
    setDisplaySettings,
    mediaUrl,
    solidColor,
    pipelinePreset,
    pipelineOverlay,
    overlayOpacity,
    geo,
    followsTheme,
    setActiveWallpaper,
    rebindToThemeDefault,
    addCustomWallpaper,
    updateCustomWallpaper,
    removeCustomWallpaper,
    resolveSource,
  };
}
