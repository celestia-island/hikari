import { readStorageItem, writeStorageItem } from "./safeStorage";

/**
 * Resource-backed wallpaper source types. Exactly three exist by contract:
 * image, video and pipeline. Pipelines are resource dependencies — a preset
 * id supplied by the host, never a URL. The historical GLTF "model" type is
 * retired; stored model customs are dropped on load.
 *
 * "solid" below is the built-in degenerate color fill, not a wallpaper file
 * type: it is not resource-backed and cannot be created in the editor.
 */
export type WallpaperType = "solid" | "image" | "video" | "pipeline";

export type SolidSource = {
  type: "solid";
  color: "black" | "white" | "auto";
};

export type ImageSource = {
  type: "image";
  url: string;
};

export type VideoSource = {
  type: "video";
  url: string;
};

export type PipelineSource = {
  type: "pipeline";
  preset: string;
};

export type WallpaperSource = SolidSource | ImageSource | VideoSource | PipelineSource;

export type TimeAwareWallpaper = {
  day: WallpaperSource;
  dusk: WallpaperSource;
  night: WallpaperSource;
};

export type WallpaperPreset = {
  id: string;
  name: string;
  thumbnail?: string;
  sources: WallpaperSource | TimeAwareWallpaper;
  /** Host-declared display defaults (e.g. a wallpaper pack manifest). */
  display?: { overlay?: number };
};

export type CustomWallpaper = {
  id: string;
  name: string;
  source: WallpaperSource;
  addedAt: number;
};

export type WallpaperPosition = "left" | "center" | "right";
export type WallpaperScale = "cover" | "stretch" | "contain";
export type WallpaperEffect = "none" | "frosted" | "acrylic";

export interface WallpaperDisplaySettings {
  position: WallpaperPosition;
  scale: WallpaperScale;
  effect: WallpaperEffect;
  brightness: number; /** Integer in the closed range [-50, 50]. */
}

export const DEFAULT_DISPLAY_SETTINGS: WallpaperDisplaySettings = {
  position: "center",
  scale: "cover",
  effect: "none",
  brightness: 0,
};

// ── The wallpaper pack (host-registered) ────────────────────────────────
//
// Hikari ships NO wallpaper art: the pack is an application asset (chest
// generates it from res/wallpapers/*.wallpaper.toml at build time), so the
// host registers it before first use. A host that never registers one still
// gets the solid degenerate — the layer is usable, just empty.

/** One entry of a host wallpaper pack. */
export interface WallpaperPackEntry {
  id: string;
  name: string;
  thumbnail?: string;
  /** Marks the pack's default entry (the picker's implied lead, the last-resort fallback). */
  default?: boolean;
  source: WallpaperSource | TimeAwareWallpaper;
  /** Manifest-declared display defaults (res/wallpapers/*.wallpaper.toml [display]). */
  display?: { overlay?: number };
}

/** The id used when no pack entry is marked default (and when no pack exists). */
export const FALLBACK_WALLPAPER_ID = "solid";

const SOLID_PRESET: WallpaperPreset = {
  id: FALLBACK_WALLPAPER_ID,
  name: "wallpaper.solidType",
  sources: { type: "solid", color: "auto" },
};

/**
 * The id a first run (and every unresolvable stored id) falls back to: the
 * pack's declared default, else the solid degenerate. A live binding — the
 * pack is registered after this module is evaluated.
 */
export let DEFAULT_WALLPAPER_ID: string = FALLBACK_WALLPAPER_ID;

/**
 * The built-in preset list, always ending with the solid degenerate. MUTATED
 * IN PLACE by registerWallpaperPack() — importers keep one array identity.
 */
export const DEFAULT_PRESETS: WallpaperPreset[] = [SOLID_PRESET];

/**
 * Register the host's wallpaper pack (idempotent; replaces the previous one).
 * Returns the resolved default id. Order follows the pack's declaration with
 * the default entry leading (the picker's implied order and the last-resort
 * fallback); the solid degenerate always trails the pack.
 */
export function registerWallpaperPack(entries?: readonly WallpaperPackEntry[] | null): string {
  const pack = entries ?? [];
  const defaultId = pack.find((entry) => entry.default)?.id ?? FALLBACK_WALLPAPER_ID;
  const fromPack: WallpaperPreset[] = pack.map((entry) => ({
    id: entry.id,
    name: entry.name,
    ...(entry.thumbnail ? { thumbnail: entry.thumbnail } : {}),
    sources: entry.source,
    ...(entry.display ? { display: entry.display } : {}),
  }));
  const ordered = [
    ...fromPack.filter((w) => w.id === defaultId),
    ...fromPack.filter((w) => w.id !== defaultId),
  ];
  DEFAULT_PRESETS.length = 0;
  DEFAULT_PRESETS.push(...ordered, SOLID_PRESET);
  DEFAULT_WALLPAPER_ID = defaultId;
  return defaultId;
}

// ── Storage namespace (host-configured) ─────────────────────────────────
//
// Two applications served from ONE origin share a localStorage profile. When
// they also share wallpaper keys they overwrite each other's state — the
// erp/chest collision that motivated this parameter (a second app reuse of
// the first app's `*-wallpaper` keys) is not a hypothetical. The prefix is
// therefore explicit, and hosts sharing an origin MUST configure distinct
// ones.

/** The four persisted wallpaper facts. */
export type WallpaperStorageSlot = "active" | "custom" | "geolocation" | "display";

const STORAGE_SUFFIXES: Record<WallpaperStorageSlot, string> = {
  active: "wallpaper",
  custom: "custom-wallpapers",
  geolocation: "geolocation",
  display: "wallpaper-display",
};

/** Namespace used until a host configures its own. */
export const DEFAULT_WALLPAPER_STORAGE_PREFIX = "hikari";

export interface WallpaperStorageConfig {
  /** Key namespace: `${storagePrefix}-wallpaper`, `-custom-wallpapers`, `-geolocation`, `-wallpaper-display`. */
  storagePrefix?: string;
  /**
   * Full key names read (never written) when the namespaced key is absent —
   * a deliberate one-time adoption of an older namespace. Omit it and the
   * namespaces stay fully isolated.
   */
  legacyKeys?: Partial<Record<WallpaperStorageSlot, string>>;
}

let storagePrefix = DEFAULT_WALLPAPER_STORAGE_PREFIX;
let legacyKeys: Partial<Record<WallpaperStorageSlot, string>> = {};

/** Point the wallpaper store at a namespace. Replaces the previous config. */
export function configureWallpaperStorage(config: WallpaperStorageConfig): void {
  storagePrefix = config.storagePrefix ?? DEFAULT_WALLPAPER_STORAGE_PREFIX;
  legacyKeys = { ...(config.legacyKeys ?? {}) };
}

/**
 * The key this namespace writes for `slot`. Legacy keys are read-only
 * fallbacks and are never returned here.
 */
export function wallpaperStorageKey(slot: WallpaperStorageSlot): string {
  return `${storagePrefix}-${STORAGE_SUFFIXES[slot]}`;
}

function readStored(slot: WallpaperStorageSlot): string | null {
  const own = readStorageItem(wallpaperStorageKey(slot));
  if (own !== null) return own;
  const legacy = legacyKeys[slot];
  return legacy ? readStorageItem(legacy) : null;
}

function writeStored(slot: WallpaperStorageSlot, value: string): void {
  writeStorageItem(wallpaperStorageKey(slot), value);
}

/**
 * Shape-check a stored custom-wallpaper source against the CURRENT
 * vocabulary. Unknown or retired types (the historical GLTF "model", the
 * pre-rename "slang" spelling) yield null — the entry is dropped on
 * load. No legacy aliasing: the panel is unreleased and carries no
 * compatibility debt (2026-09-08 slimming).
 */
export function isWallpaperSource(
  source: WallpaperSource | Record<string, unknown>,
): source is WallpaperSource {
  const raw = source as { type?: unknown };
  return raw?.type === "solid" || raw?.type === "image" || raw?.type === "video" || raw?.type === "pipeline";
}

export function isTimeAware(
  sources: WallpaperSource | TimeAwareWallpaper,
): sources is TimeAwareWallpaper {
  // A period map is time-aware when ANY of its slots is a real source
  // object: dusk/night-only art is still time-aware, while `day: null`
  // (typeof null === "object") is not a period at all.
  const map = sources as TimeAwareWallpaper;
  return (
    map != null &&
    typeof map === "object" &&
    (isSourceObject(map.day) || isSourceObject(map.dusk) || isSourceObject(map.night))
  );
}

function isSourceObject(v: unknown): boolean {
  return v != null && typeof v === "object";
}

export function loadActiveWallpaperId(): string {
  return readStored("active") || DEFAULT_WALLPAPER_ID;
}

/** Whether the user ever stored an explicit wallpaper choice. */
export function hasStoredWallpaperId(): boolean {
  return readStored("active") !== null;
}

export function saveActiveWallpaperId(id: string) {
  writeStored("active", id);
}

export function loadCustomWallpapers(): CustomWallpaper[] {
  try {
    const raw = readStored("custom");
    if (!raw) return [];
    const list = JSON.parse(raw) as Array<Partial<CustomWallpaper>>;
    // One choke point for stored-shape migration: retired types drop out,
    // renamed types map forward. Anything without a normalizable source
    // is not a wallpaper anymore.
    return list
      .filter((w) => typeof w?.id === "string" && typeof w?.name === "string")
      .filter((w) => isWallpaperSource(w.source as WallpaperSource))
      .map((w) => ({
        id: w.id as string,
        name: w.name as string,
        source: w.source as WallpaperSource,
        addedAt: typeof w.addedAt === "number" ? w.addedAt : 0,
      }));
  } catch {
    return [];
  }
}

export function saveCustomWallpapers(list: CustomWallpaper[]) {
  writeStored("custom", JSON.stringify(list));
}

export function addCustomWallpaper(wp: CustomWallpaper) {
  const list = loadCustomWallpapers();
  list.push(wp);
  saveCustomWallpapers(list);
}

export function removeCustomWallpaper(id: string) {
  const list = loadCustomWallpapers().filter((w) => w.id !== id);
  saveCustomWallpapers(list);
}

export function updateCustomWallpaper(wp: CustomWallpaper): boolean {
  const list = loadCustomWallpapers();
  const index = list.findIndex((w) => w.id === wp.id);
  if (index < 0) return false;
  list[index] = wp;
  saveCustomWallpapers(list);
  return true;
}

export function loadCachedGeolocation(): { lat: number; lng: number } | null {
  try {
    const raw = readStored("geolocation");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveCachedGeolocation(lat: number, lng: number) {
  writeStored("geolocation", JSON.stringify({ lat, lng }));
}

const WALLPAPER_POSITIONS: readonly WallpaperPosition[] = ["left", "center", "right"];
const WALLPAPER_SCALES: readonly WallpaperScale[] = ["cover", "stretch", "contain"];
const WALLPAPER_EFFECTS: readonly WallpaperEffect[] = ["none", "frosted", "acrylic"];

function isWallpaperPosition(v: unknown): v is WallpaperPosition {
  return typeof v === "string" && (WALLPAPER_POSITIONS as readonly string[]).includes(v);
}

function isWallpaperScale(v: unknown): v is WallpaperScale {
  return typeof v === "string" && (WALLPAPER_SCALES as readonly string[]).includes(v);
}

function isWallpaperEffect(v: unknown): v is WallpaperEffect {
  return typeof v === "string" && (WALLPAPER_EFFECTS as readonly string[]).includes(v);
}

function clampBrightness(v: unknown): number {
  if (typeof v !== "number" || Number.isNaN(v)) return DEFAULT_DISPLAY_SETTINGS.brightness;
  return Math.min(50, Math.max(-50, Math.round(v)));
}

export function loadDisplaySettings(): Record<string, Partial<WallpaperDisplaySettings>> {
  try {
    const raw = readStored("display");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDisplaySettings(map: Record<string, Partial<WallpaperDisplaySettings>>): void {
  writeStored("display", JSON.stringify(map));
}

export function getDisplaySettings(id: string): WallpaperDisplaySettings {
  const stored = loadDisplaySettings()[id] ?? {};
  return {
    position: isWallpaperPosition(stored.position)
      ? stored.position
      : DEFAULT_DISPLAY_SETTINGS.position,
    scale: isWallpaperScale(stored.scale)
      ? stored.scale
      : DEFAULT_DISPLAY_SETTINGS.scale,
    effect: isWallpaperEffect(stored.effect)
      ? stored.effect
      : DEFAULT_DISPLAY_SETTINGS.effect,
    brightness: clampBrightness(stored.brightness),
  };
}

export function setDisplaySettings(id: string, partial: Partial<WallpaperDisplaySettings>): void {
  const map = loadDisplaySettings();
  map[id] = { ...getDisplaySettings(id), ...partial };
  saveDisplaySettings(map);
}
