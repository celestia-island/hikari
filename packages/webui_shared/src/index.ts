// The family's shared webui scaffolding — the byte-identical pieces both
// webuis carried as copies (PA-7 option A, 2026-11-13 ruling). Everything
// here is re-exported verbatim from its subpath; nothing is re-implemented.
export { useSystemStore } from "./stores/system";
export { detectLocale } from "./utils/locale";
export { useConfirm } from "./composables/useConfirm";
export {
  WALLPAPER_UPLOAD_LIMITS,
  WallpaperUploadError,
  isUploadError,
  computeScaledDimensions,
  fileToWallpaperDataUrl,
  type WallpaperUploadErrorCode,
  type WallpaperUploadLimits,
} from "./theme/wallpaperUpload";
