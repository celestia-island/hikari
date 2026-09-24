import type { WallpaperDisplaySettings } from "./wallpaper";

/**
 * Compose a CSS `filter` value for a wallpaper layer from display settings.
 * Pure and side-effect free (unit-testable). CSS filter functions multiply,
 * so brightness is kept as a separate `brightness()` part and all parts are
 * joined with spaces. Returns "none" when nothing applies.
 */
export function buildWallpaperFilter(settings: WallpaperDisplaySettings): string {
  const parts: string[] = [];

  if (settings.effect === "frosted") {
    parts.push("blur(12px)");
  } else if (settings.effect === "acrylic") {
    parts.push("blur(8px) saturate(1.5) brightness(1.06)");
  }

  if (settings.brightness !== 0) {
    parts.push(`brightness(${(1 + settings.brightness / 100).toFixed(2)})`);
  }

  return parts.length > 0 ? parts.join(" ") : "none";
}
