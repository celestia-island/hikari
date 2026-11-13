// The family's shared webui scaffolding — the six pieces chest and erp
// carried byte-identical copies of (PA-7, 2026-11-13 ruling: fold into
// hikari rather than mint a new package name).
//
// Each piece lives at its natural home in this package (`i18n/`, `theme/`,
// `stores/`, `runtime/`, `plugins/`), so it is a first-class hikari file
// rather than a corner of it. This module exists only so consumers have one
// stable entry point: it re-exports, it does not implement.
//
// `useSystemStore` needs pinia, which hikari does not otherwise depend on.
// It is declared as an OPTIONAL peer, so a host that never imports this
// subpath installs nothing extra.
export { detectLocale } from "./i18n/detectLocale";
export { useSystemStore } from "./stores/system";
// Renamed on the way out: hikari's main barrel already exports its own
// `useConfirm`, and this one is a different API over it.
export { useConfirm as useConfirmView } from "./runtime/useConfirmView";
export {
  WALLPAPER_UPLOAD_LIMITS,
  WallpaperUploadError,
  isUploadError,
  computeScaledDimensions,
  fileToWallpaperDataUrl,
  type WallpaperUploadErrorCode,
  type WallpaperUploadLimits,
} from "./theme/wallpaperUpload";
