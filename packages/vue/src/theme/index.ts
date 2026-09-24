export { initTheme, useTheme } from "./useTheme";
export { initFontContext, applyFontContext, resetFontContext, useFontContext, HIKARI_FONT_SANS, HIKARI_FONT_MONO, HIKARI_FONT_READING } from "./fontContext";
export type { FontContextOverrides } from "./fontContext";
export { themePresets, stockDefaultPreset, tokensToCSSVars, getThemeTokens, loadCustomThemes, saveCustomThemes, addCustomTheme, removeCustomTheme } from "./presets";
export type { ThemeTokenRGB, ThemeSchemeTokens, ThemePreset, CustomThemePreset, ThemeId, ThemeMode, ThemeTokenValue, ThemeTokenGroupValues, ThemeTokenGroupModes } from "./presets";
export type { ThemeTokens } from "./presets";
export {
  registerTokenGroup, getTokenGroups, resolveGroupTokens, clampToSlot,
  clampRgbToBands, clampHue, hueDelta, groupTokensToCSSVars, rgbToHsl, hslToRgb, wrapHue,
  tokenGroupsVersion, setTokenGroupsReapply,
  allGroupSlots, resolveLocalizedText, parseTokenGroupConfig, registerTokenGroupConfig,
  tokenGroupSlotKind, tokenGroupSlotCssVar,
  isColorSlot, isNumberSlot, isEnumSlot,
} from "./tokenGroups";
export type {
  TokenGroupDefinition, TokenGroupSlot, TokenGroupSection, HueClamp,
  TokenGroupSlotKind, TokenColorSlot, TokenNumberSlot, TokenEnumSlot,
  ResolvedGroupTokens, ColorHSL, TokenGroupsReapplyFn,
  LocalizedText, ParseTokenGroupResult,
} from "./tokenGroups";
export { registerStandardThemeGroups, STANDARD_SHAPE_GROUP_ID } from "./standardGroups";
export {
  registerThemeDecor, registerThemeDecorBuiltin, getThemeDecor, themeDecorSlots,
  themeDecorVersion, isThemeDecorSlot, THEME_DECOR_SLOT_PATTERN, THEME_DECOR_WILDCARD,
} from "./themeDecor";
export type {
  ThemeDecorSlot, ThemeDecorRegistration, ThemeDecorBuiltinRegistration,
} from "./themeDecor";
export { registerStandardThemeDecor, STANDARD_THEME_DECOR_SLOTS } from "./standardDecor";
export { getTimePeriod, getGeolocation, solarAltitude, DEFAULT_GEO_LOCATION, timezoneFallback, setGeolocationProvider } from "./useSolarTime";
export type { GeoLocation, GeoLocationProvider } from "./useSolarTime";
export { refreshThemeClock, stopThemeClock } from "./useTheme";
export {
  startLuminanceSampler, stopLuminanceSampler, sampleLuminanceNow, invalidateLuminanceCache,
  registerWallpaperSurfaceSources, resolveWallpaperSurfaceElement, LEGACY_WALLPAPER_SURFACE_IDS,
  retainLuminanceSampler, releaseLuminanceSampler, luminanceSamplerRefCount,
} from "./useBackgroundLuminance";
export type { WallpaperSurfaceKind, WallpaperSurfaceSources } from "./useBackgroundLuminance";
export type { TimePeriod } from "./useSolarTime";
export { HK_AUTH_CARD_MAX_WIDTH, HK_AUTH_CARD_MAX_WIDTH_VAR } from "./authCard";
// SSR-safe storage primitives (no-ops without DOM storage, never throw).
export { hasStorage, readStorageItem, writeStorageItem, removeStorageItem } from "./safeStorage";
// Wallpaper logic layer. The pack, the brand map and the pipeline registry
// are host registrations — hikari ships the logic, not an app's assets.
export {
  FALLBACK_WALLPAPER_ID, DEFAULT_WALLPAPER_ID, DEFAULT_PRESETS, DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_WALLPAPER_STORAGE_PREFIX, registerWallpaperPack, configureWallpaperStorage,
  wallpaperStorageKey, isWallpaperSource, isTimeAware,
  loadActiveWallpaperId, hasStoredWallpaperId, saveActiveWallpaperId,
  loadCustomWallpapers, saveCustomWallpapers, addCustomWallpaper, removeCustomWallpaper,
  updateCustomWallpaper, loadCachedGeolocation, saveCachedGeolocation,
  loadDisplaySettings, saveDisplaySettings, getDisplaySettings, setDisplaySettings,
} from "./wallpaper";
export type {
  WallpaperType, SolidSource, ImageSource, VideoSource, PipelineSource, WallpaperSource,
  TimeAwareWallpaper, WallpaperPreset, WallpaperPackEntry, CustomWallpaper,
  WallpaperPosition, WallpaperScale, WallpaperEffect, WallpaperDisplaySettings,
  WallpaperStorageSlot, WallpaperStorageConfig,
} from "./wallpaper";
export { buildWallpaperFilter } from "./wallpaperDisplay";
export {
  initWallpaper, destroyWallpaper, useWallpaper, ensureWallpaperState, configureWallpaper,
  registerWallpaperBrandDefaults, registerServerThemeWallpaper, brandDefaultWallpaperFor,
  resolveThemeFollowSwitch, setWallpaperPipelineLookup, geo, currentPeriod,
} from "./useWallpaper";
export type { WallpaperInitConfig, WallpaperPipelineLookup, WallpaperPipelinePreset } from "./useWallpaper";
