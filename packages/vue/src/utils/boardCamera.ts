/**
 * boardCamera.ts — pure world-camera math for HkBoard.
 *
 * A board lives in a fixed WORLD coordinate space; the camera maps
 * world → screen (`screen = world·k + (x, y)`, `transform-origin: 0 0`).
 * This module owns the rules that keep the viewport decoupled from the
 * graph, so every consumer (topic maps, SCADA scenes, PLC panels, …)
 * shares ONE motion feel:
 *
 *  - zoom is a GEOMETRIC 5% ladder (`k = 1.05ⁿ`): gestures accumulate
 *    into a continuous level and the applied zoom snaps to the rung;
 *  - `boardZoomAt` keeps the world point under a screen anchor (cursor /
 *    pinch midpoint) visually fixed while k changes;
 *  - pan is CLAMPED so the content bbox can never be pushed fully out of
 *    view (half a viewport of slack on each side); content smaller than
 *    the viewport re-centers;
 *  - `boardFit` fits the whole bbox (pad + floor + cap);
 *  - `boardTweenCam` eases between two cameras with an ease-out curve and
 *    GEOMETRIC k interpolation (log-space lerp) so animated zooms still
 *    land exactly on ladder rungs.
 *
 * Pure functions only — HkBoard / useBoardCamera supply state, timing and
 * gestures. Semantics intentionally mirror the chest SCADA scene camera
 * (the first consumer of this contract).
 */

export interface BoardCamera {
  x: number;
  y: number;
  k: number;
}

export interface BoardRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardPoint {
  x: number;
  y: number;
}

export interface BoardViewport {
  w: number;
  h: number;
}

/** One zoom step = ±5% (geometric). */
export const BOARD_ZOOM_FACTOR = 1.05;
export const BOARD_K_MIN = 0.2;
export const BOARD_K_MAX = 4;
/** fit() may shrink as far as needed to show the whole board. */
export const BOARD_FIT_FLOOR = 0.2;
/** fit() never blows above this (nearly-empty boards). */
export const BOARD_FIT_CAP = 1.25;
/** Padding around the bbox used by fit(), world px. */
export const BOARD_FIT_PAD = 40;

export const boardLevelOf = (k: number): number =>
  Math.log(k) / Math.log(BOARD_ZOOM_FACTOR);

export const boardKOf = (level: number): number =>
  Math.pow(BOARD_ZOOM_FACTOR, level);

export const boardClampK = (k: number): number =>
  Math.min(BOARD_K_MAX, Math.max(BOARD_K_MIN, k));

/** Clamp a raw zoom into the legal ladder, snapped to a 5% rung. */
export function quantizeBoardK(k: number): number {
  const clamped = boardClampK(k);
  if (clamped <= BOARD_K_MIN) return BOARD_K_MIN;
  if (clamped >= BOARD_K_MAX) return BOARD_K_MAX;
  return boardKOf(Math.round(boardLevelOf(clamped)));
}

/**
 * Quantize a zoom CHANGE (relative rung ladder anchored at `base`):
 * base·ratio stays exactly on `base·1.05ⁿ`, so a pinch always feels like
 * clean 5% steps from wherever the gesture started. Clamped to the
 * global bounds.
 */
export function quantizeBoardStep(base: number, ratio: number): number {
  const raw = base * ratio;
  const level = Math.round(boardLevelOf(raw) - boardLevelOf(base));
  return boardClampK(base * boardKOf(level));
}

export function boardToScreen(cam: BoardCamera, wx: number, wy: number): BoardPoint {
  return { x: wx * cam.k + cam.x, y: wy * cam.k + cam.y };
}

export function boardToWorld(cam: BoardCamera, sx: number, sy: number): BoardPoint {
  return { x: (sx - cam.x) / cam.k, y: (sy - cam.y) / cam.k };
}

/**
 * Zoom while keeping the world point under the screen anchor visually
 * fixed (cursor / pinch midpoint zoom). The result is NOT rung-quantized —
 * callers quantize when they want the ladder (see quantizeBoardK).
 */
export function boardZoomAt(
  cam: BoardCamera,
  targetK: number,
  anchorScreen: BoardPoint,
): BoardCamera {
  const k = boardClampK(targetK);
  const world = boardToWorld(cam, anchorScreen.x, anchorScreen.y);
  return { k, x: anchorScreen.x - world.x * k, y: anchorScreen.y - world.y * k };
}

/**
 * Clamp the pan so the content bbox can never be dragged fully out of
 * view: content larger than the viewport keeps half a viewport of slack
 * on each side; content smaller than the viewport re-centers.
 */
export function boardClampPan(
  cam: BoardCamera,
  content: BoardRect,
  viewport: BoardViewport,
  slack = 0.5,
): BoardCamera {
  const clampAxis = (pan: number, view: number, size: number): number => {
    const drawn = size * cam.k;
    if (drawn <= view) return (view - drawn) / 2;
    const slackPx = view * slack;
    return Math.min(Math.max(pan, view - drawn - slackPx), slackPx);
  };
  return {
    k: cam.k,
    x: clampAxis(cam.x, viewport.w, content.w),
    y: clampAxis(cam.y, viewport.h, content.h),
  };
}

/**
 * Fit the whole content bbox into the viewport (centered, padded). Wide
 * boards shrink fully into view; tiny boards never blow up past the cap.
 */
export function boardFit(
  content: BoardRect,
  viewport: BoardViewport,
  opts: { pad?: number; floor?: number; cap?: number } = {},
): BoardCamera {
  const pad = opts.pad ?? BOARD_FIT_PAD;
  const floor = opts.floor ?? BOARD_FIT_FLOOR;
  const cap = opts.cap ?? BOARD_FIT_CAP;
  const kw = content.w > 0 ? (viewport.w - pad * 2) / content.w : cap;
  const kh = content.h > 0 ? (viewport.h - pad * 2) / content.h : cap;
  const k = Math.min(cap, Math.max(floor, Math.min(kw, kh)));
  return {
    k,
    x: (viewport.w - content.w * k) / 2 - content.x * k,
    y: (viewport.h - content.h * k) / 2 - content.y * k,
  };
}

export const boardEaseOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));

/**
 * Interpolate between two cameras for an animated transition. Pan lerps
 * linearly, k interpolates GEOMETRICALLY (log-space) so a tween between
 * two ladder rungs passes through intermediate rungs, not linear noise.
 * `t` is clamped to [0, 1] and eased with ease-out cubic.
 */
export function boardTweenCam(from: BoardCamera, to: BoardCamera, t: number): BoardCamera {
  const e = boardEaseOutCubic(clamp01(t));
  const k = from.k > 0 && to.k > 0 ? from.k * Math.pow(to.k / from.k, e) : to.k;
  return {
    k,
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e,
  };
}

/** Union of rects (ignoring empty ones) — the content bbox for clamp/fit. */
export function boardBBox(rects: BoardRect[]): BoardRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.w <= 0 || r.h <= 0) continue;
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1200, h: 800 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
