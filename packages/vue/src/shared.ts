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
// Same NAME as the main barrel's `useConfirm` but a different API — the
// view-facing state machine (`confirm(title, message)` plus the exposed
// visible/title/message/cancel fields) over the core one-liner. The two
// live on different specifiers (`hikari` vs `hikari/shared`), so they do
// not collide; the name stays so a consumer migrating from its own copy
// keeps its 100+ call sites unchanged.
export { useConfirm } from "./runtime/useConfirmView";
export {
  WALLPAPER_UPLOAD_LIMITS,
  WallpaperUploadError,
  isUploadError,
  computeScaledDimensions,
  fileToWallpaperDataUrl,
  type WallpaperUploadErrorCode,
  type WallpaperUploadLimits,
} from "./theme/wallpaperUpload";
