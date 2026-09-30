/**
 * scene3d — pure math behind HkBoard3D / HkMinimap3D.
 *
 * Everything in here is dependency-free (no three import) so the geometry
 * is unit-testable in happy-dom and reusable from shaders-less contexts:
 *
 *  - `hashIdToUnit` / `lerpPalette` — stable "slide a palette by id" colour
 *    assignment (fleet stars/planets key their hue off the node id);
 *  - `orbitDelta` — pointer-drag → spherical angles for the 3D minimap
 *    (the minimap eye rides a SPHERE centred on the main camera);
 *  - `fitDistance` / `viewPlaneHalfExtents` / `planeCorners` — camera-fit
 *    and view-plane (frustum footprint) geometry for the minimap overlay.
 */

export type Vec3 = [number, number, number];

/** Layer the minimap-only helpers (main-camera glyph, view-plane frame)
 *  live on — the main camera never enables it, the minimap camera does.
 *  (Lives here, not in HkBoard3D.tsx, so the minimap doesn't need a
 *  runtime import of the board — the two components stay acyclic.) */
export const BOARD3D_HELPERS_LAYER = 1;

/** FNV-1a 32-bit hash of a string folded into [0, 1). Stable across runs
 *  and platforms — the same node id always lands on the same palette stop. */
export function hashIdToUnit(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    // FNV prime multiply via shifts (32-bit).
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  // Second fold so the low bits (which dominate the /2^32 result) depend
  // on every character — without it short ids cluster.
  h ^= h >>> 13;
  h = (h * 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function hexToRgb(hex: string): Vec3 {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/**
 * Slide along an evenly-spaced hex palette: t=0 → first stop, t=1 → last
 * stop, linear interpolation between adjacent stops. Returns linear-space
 * rgb in [0,1]. A degenerate palette (empty) yields white; a single stop
 * yields that stop.
 */
export function lerpPalette(palette: string[], t: number): Vec3 {
  if (palette.length === 0) return [1, 1, 1];
  if (palette.length === 1) return hexToRgb(palette[0]);
  // A non-finite position is a caller bug, not a colour: clamp it to the
  // first stop instead of indexing the palette with NaN (which would
  // throw from hexToRgb) — same tolerance clampMinimapZoom shows.
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const x = clamped * (palette.length - 1);
  const i = Math.min(palette.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(palette[i]);
  const b = hexToRgb(palette[i + 1]);
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

/** Combined helper: id → stable palette colour. */
export function paletteColorForId(id: string, palette: string[]): Vec3 {
  return lerpPalette(palette, hashIdToUnit(id));
}

// ── Minimap spherical orbit ─────────────────────────────────────────────

/** Hard polar clamps keep the minimap eye off the exact poles (where the
 *  azimuth is degenerate and the view would flip). */
export const MINIMAP_MIN_POLAR = 0.12;
export const MINIMAP_MAX_POLAR = Math.PI - 0.12;

/** Radians of orbit per dragged pixel: one full drag across the minimap
 *  (~160 px) sweeps a little over a half-turn. */
export const MINIMAP_DRAG_RADIANS_PER_PX = (Math.PI * 1.25) / 160;

/**
 * Drag-to-orbit for the 3D minimap: the pointer delta (CSS px) rotates the
 * minimap eye around the sphere centred on the MAIN camera. Horizontal drag
 * sweeps azimuth, vertical drag sweeps polar (clamped off the poles).
 */
export function orbitDelta(
  theta: number,
  phi: number,
  dxPx: number,
  dyPx: number,
): { theta: number; phi: number } {
  const t = theta + dxPx * MINIMAP_DRAG_RADIANS_PER_PX;
  // Vertical drag DOWN lowers the eye (moving the view under the scene),
  // matching the "grab the sphere" feel of the main orbit controls.
  const p = phi + dyPx * MINIMAP_DRAG_RADIANS_PER_PX;
  return {
    theta: t,
    phi: Math.min(MINIMAP_MAX_POLAR, Math.max(MINIMAP_MIN_POLAR, p)),
  };
}

/** Eye position on the sphere around `center`. */
export function sphericalPosition(
  center: Vec3,
  theta: number,
  phi: number,
  radius: number,
): Vec3 {
  const sp = Math.sin(phi);
  return [
    center[0] + radius * sp * Math.sin(theta),
    center[1] + radius * Math.cos(phi),
    center[2] + radius * sp * Math.cos(theta),
  ];
}

// ── Fit / frustum geometry ──────────────────────────────────────────────

/**
 * Distance at which a sphere of `radius` exactly fills a `fovDeg` vertical
 * field of view, honouring the horizontal narrowing when aspect < 1.
 */
export function fitDistance(radius: number, fovDeg: number, aspect: number): number {
  if (!(radius > 0) || !(fovDeg > 0) || !(aspect > 0)) return 1;
  const vfov = (fovDeg * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const fov = Math.min(vfov, hfov);
  return radius / Math.sin(fov / 2);
}

/** Half extents of the view plane `dist` in front of the camera — the
 *  "what the main view is looking at" quad the minimap draws. */
export function viewPlaneHalfExtents(
  fovDeg: number,
  aspect: number,
  dist: number,
): { halfW: number; halfH: number } {
  const halfH = Math.tan(((fovDeg / 2) * Math.PI) / 180) * dist;
  return { halfW: halfH * aspect, halfH };
}

/** The four corners (±right·halfW ±up·halfH around `center`), ordered
 *  top-left, top-right, bottom-right, bottom-left as seen by the camera. */
export function planeCorners(
  center: Vec3,
  right: Vec3,
  up: Vec3,
  halfW: number,
  halfH: number,
): [Vec3, Vec3, Vec3, Vec3] {
  const at = (sr: number, su: number): Vec3 => [
    center[0] + right[0] * halfW * sr + up[0] * halfH * su,
    center[1] + right[1] * halfW * sr + up[1] * halfH * su,
    center[2] + right[2] * halfW * sr + up[2] * halfH * su,
  ];
  return [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)];
}

/** Minimap zoom-ladder governance: the ± buttons step the view-radius
 *  factor by a fixed 15% rung inside [50%, 250%] of the auto-fit radius. */
export const MINIMAP_ZOOM_STEP_PERCENT = 15;
export const MINIMAP_MIN_ZOOM_PERCENT = 50;
export const MINIMAP_MAX_ZOOM_PERCENT = 250;

export function clampMinimapZoom(percent: number): number {
  if (!Number.isFinite(percent)) return 100;
  return Math.min(MINIMAP_MAX_ZOOM_PERCENT, Math.max(MINIMAP_MIN_ZOOM_PERCENT, percent));
}
