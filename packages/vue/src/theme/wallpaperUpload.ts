/**
 * Local-image ingestion for the theme wallpaper picker (user direction
 * 2026-09-10: 上传一张新图片 — a plain file upload, not a URL form).
 *
 * Phone photos are far too large to store verbatim: the picker persists
 * custom wallpapers as data URLs in localStorage (~5MB total quota), so a
 * 12MP shot must be re-encoded. Every upload is decoded, fitted under
 * `maxDimension` on its longest edge and re-exported as a JPEG data URL —
 * wallpapers never need alpha, and JPEG keeps the stored entry in the
 * few-hundred-KB range.
 */

export interface WallpaperUploadLimits {
  /** Longest-edge cap for the stored image (CSS pixels). */
  maxDimension: number;
  /** JPEG quality for the stored image. */
  quality: number;
  /** Hard byte ceiling before decoding (decode-of-death guard). */
  maxBytes: number;
  /** Quieter second attempt when localStorage refuses the first entry. */
  retryDimension: number;
  retryQuality: number;
}

export const WALLPAPER_UPLOAD_LIMITS: WallpaperUploadLimits = {
  maxDimension: 2560,
  quality: 0.85,
  maxBytes: 32 * 1024 * 1024,
  retryDimension: 1280,
  retryQuality: 0.72,
};

/** Stable failure codes; the dialog maps each to an i18n key verbatim. */
export type WallpaperUploadErrorCode = "uploadFailed" | "uploadTooLarge";

export class WallpaperUploadError extends Error {
  readonly code: WallpaperUploadErrorCode;

  constructor(code: WallpaperUploadErrorCode) {
    super(code);
    this.name = "WallpaperUploadError";
    this.code = code;
  }
}

export function isUploadError(e: unknown): e is WallpaperUploadError {
  return e instanceof WallpaperUploadError;
}

/** Longest-edge fit: never upscales, never zeroes out. */
export function computeScaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height, 1));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Decode a File to something drawImage accepts, old-engine safe:
 * createImageBitmap when present, an <img> object URL otherwise. */
async function decodeImageSource(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path (SVG without intrinsic size, etc.).
    }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new WallpaperUploadError("uploadFailed"));
    };
    img.src = url;
  });
}

/** Read, downscale and encode one local image as a JPEG data URL.
 * Rejects with a coded WallpaperUploadError only — storage-write failures
 * surface as whatever localStorage threw, at the call site. */
export async function fileToWallpaperDataUrl(
  file: File,
  overrides: Partial<WallpaperUploadLimits> = {},
): Promise<string> {
  const limits = { ...WALLPAPER_UPLOAD_LIMITS, ...overrides };
  if (file.size > limits.maxBytes) {
    throw new WallpaperUploadError("uploadTooLarge");
  }
  const source = await decodeImageSource(file);
  const width = source.width;
  const height = source.height;
  if (!width || !height) {
    (source as ImageBitmap).close?.();
    throw new WallpaperUploadError("uploadFailed");
  }
  try {
    const scaled = computeScaledDimensions(width, height, limits.maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new WallpaperUploadError("uploadFailed");
    ctx.drawImage(source as CanvasImageSource, 0, 0, scaled.width, scaled.height);
    const url = canvas.toDataURL("image/jpeg", limits.quality);
    if (!url.startsWith("data:image/")) {
      throw new WallpaperUploadError("uploadFailed");
    }
    return url;
  } catch (e) {
    throw isUploadError(e) ? e : new WallpaperUploadError("uploadFailed");
  } finally {
    (source as ImageBitmap).close?.();
  }
}
