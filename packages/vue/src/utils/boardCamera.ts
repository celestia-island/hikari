/**
 * boardCamera.ts — pure world-camera math for HkBoard.
 *
 * A board lives in a fixed WORLD coordinate space; the camera maps
 * world → screen (`screen = world·k + (x, y)`, `transform-origin: 0 0`).
 * This module owns the rules that keep the viewport decoupled from the
 * graph, so every consumer (topic maps, operations scenes, PLC panels, …)
 * shares ONE motion feel:
 *
 *  - zoom is a GEOMETRIC 5% ladder (`k = 1.05ⁿ`): gestures accumulate
 *    into a continuous level and the applied zoom snaps to the rung;
 *  - `boardZoomAt` keeps the world point under a screen anchor (cursor /
 *    pinch midpoint) visually fixed while k changes;
 *  - pan is CLAMPED so the content bbox can never be pushed fully out of
 *    view (half a viewport of slack on each side); content smaller than
 *    the viewport re-centers;
 *  - `boardFit` fits the whole bbox (pad + cap) and may shrink as far as
 *    needed to show the whole board on the default geometric ladder; the
 *    opt-in percent ladder instead respects its readable minimum and pans;
 *  - `boardTweenCam` eases between two cameras with an ease-out curve and
 *    GEOMETRIC k interpolation (log-space lerp) so animated zooms still
 *    land exactly on ladder rungs.
 *
 * Pure functions only — HkBoard / useBoardCamera supply state, timing and
 * gestures. Semantics intentionally mirror the first consumer's operations
 * scene camera.
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

/** Zoom governance is opt-in per board. Existing scene boards keep the
 * geometric ladder; document diagrams use exact linear percent rungs. */
export type BoardZoomLadder = "geometric" | "percent";
export type BoardWritingDirection = "ltr" | "rtl";

export interface BoardFitOptions {
  pad?: number;
  cap?: number;
  /** Reserve on the LOGICAL inline end (right in LTR, left in RTL). */
  endReserve?: number;
  writingDirection?: BoardWritingDirection;
}

export interface BoardPercentZoomOptions {
  /** Linear increment in displayed percent (5 means 50%, 55%, 60%…). */
  stepPercent: number;
  minK: number;
  maxK: number;
  /** Fit rounds DOWN so quantizing never crops content that used to fit. */
  direction?: "nearest" | "floor";
}

/** Snap to exact linear percent rungs, not `1.05ⁿ` (whose labels become
 * 110%, 116%, 122%…). The host's own min/max apply here as well. */
export function quantizeBoardPercentK(k: number, options: BoardPercentZoomOptions): number {
  const stepPercent = Number.isFinite(options.stepPercent) && options.stepPercent > 0
    ? options.stepPercent
    : 5;
  const minK = Math.max(0, options.minK);
  const maxK = Math.max(minK, options.maxK);
  const clamped = Math.min(maxK, Math.max(minK, k));
  const units = clamped * 100 / stepPercent;
  const rung = options.direction === "floor" ? Math.floor(units + 1e-9) : Math.round(units);
  const result = Math.min(maxK, Math.max(minK, rung * stepPercent / 100));
  // Decimal rungs should remain stable values for equality checks and CSS
  // labels (0.85, not 0.8500000000000001).
  return Math.round(result * 1_000_000) / 1_000_000;
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

/**
 * Quantize a fixed-step zoom target (the minimap ± button: linear ±5% on
 * a geometric ladder) into a rung, in the step's DIRECTION. Nearest-rung
 * rounding alone can collapse onto the rung the camera already sits on —
 * from the last reachable rung below the cap, a +5% percent target rounds
 * straight back to it and the press does nothing. A target that resolves
 * to the current rung is therefore pushed ONE rung further in the press
 * direction (clamped to the global bounds); targets that already resolve
 * elsewhere are untouched.
 */
export function boardStepRung(currentK: number, targetK: number): number {
  const clamped = boardClampK(targetK);
  const rung = quantizeBoardK(clamped);
  const currentLevel = Math.round(boardLevelOf(boardClampK(currentK)));
  const rungLevel = Math.round(boardLevelOf(rung));
  if (rungLevel !== currentLevel) return rung;
  const dir = clamped >= currentK ? 1 : -1;
  return boardClampK(boardKOf(currentLevel + dir));
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
 * What a drag may do with content that is SMALLER than the viewport on an
 * axis.
 *  - `"center"` (the board default): re-center — a fitted board is pinned,
 *    a drag never moves it;
 *  - `"keep"`: it may be dragged anywhere as long as half of it stays in
 *    view (the same "never pushed fully out of view" invariant the larger
 *    than-viewport case already has, applied to small content).
 */
export type BoardSmallContentPan = "center" | "keep";

/**
 * Clamp the pan so the content bbox can never be dragged fully out of
 * view: content larger than the viewport keeps half a viewport of slack
 * on each side; content smaller than the viewport re-centers — unless
 * `small` is `"keep"` (see BoardSmallContentPan).
 */
export function boardClampPan(
  cam: BoardCamera,
  content: BoardRect,
  viewport: BoardViewport,
  slack = 0.5,
  small: BoardSmallContentPan = "center",
): BoardCamera {
  const clampAxis = (pan: number, view: number, size: number): number => {
    const drawn = size * cam.k;
    if (drawn <= view) {
      if (small === "keep") return Math.min(Math.max(pan, -drawn / 2), view - drawn / 2);
      return (view - drawn) / 2;
    }
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
 * boards shrink as far as needed to show everything — fit is allowed
 * below the interaction minimum (the ladder is for gestures, not for
 * the initial framing); tiny boards never blow up past the cap.
 *
 * The usable span is floored at zero, so k is never NEGATIVE. A viewport
 * narrower than the padding is degenerate (a board mounted inside a
 * hidden tab / collapsed panel / an unlaid-out flex item measures 0), and
 * an unfloored `(0 - 80) / 1538 = -0.052` makes the whole world render
 * mirrored and shrunken instead of merely unplaced — measured on the docs
 * site, where the mermaid card's canvas collapsed and every diagram
 * vanished. Zero is the honest answer for "no room"; the host re-fits
 * once a real viewport exists (HkBoard's ResizeObserver path).
 */
export function boardFit(
  content: BoardRect,
  viewport: BoardViewport,
  opts: BoardFitOptions = {},
): BoardCamera {
  const pad = opts.pad ?? BOARD_FIT_PAD;
  const cap = opts.cap ?? BOARD_FIT_CAP;
  const endReserve = Math.max(0, opts.endReserve ?? 0);
  const availW = Math.max(0, viewport.w - pad * 2 - endReserve);
  const availH = Math.max(0, viewport.h - pad * 2);
  const kw = content.w > 0 ? availW / content.w : cap;
  const kh = content.h > 0 ? availH / content.h : cap;
  const k = Math.min(cap, Math.min(kw, kh));
  const signedReserve = opts.writingDirection === "rtl" ? endReserve : -endReserve;
  return {
    k,
    x: (viewport.w + signedReserve - content.w * k) / 2 - content.x * k,
    y: (viewport.h - content.h * k) / 2 - content.y * k,
  };
}

/** Fit on the linear percent ladder. Rounding down preserves the old fit's
 * guarantee when a rung exists; when even the minimum cannot contain the
 * content, the minimum wins and the board becomes pannable instead of
 * shrinking into illegibility. */
export function boardFitPercent(
  content: BoardRect,
  viewport: BoardViewport,
  opts: BoardPercentZoomOptions & BoardFitOptions,
): BoardCamera {
  const raw = boardFit(content, viewport, opts);
  // Preserve the degenerate-viewport sentinel. Turning 0 into minK would draw
  // a hidden board at an arbitrary pan instead of waiting for its real size.
  if (raw.k <= 0) return raw;
  const k = quantizeBoardPercentK(raw.k, { ...opts, direction: "floor" });
  const endReserve = Math.max(0, opts.endReserve ?? 0);
  const signedReserve = opts.writingDirection === "rtl" ? endReserve : -endReserve;
  return {
    k,
    x: (viewport.w + signedReserve - content.w * k) / 2 - content.x * k,
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

/**
 * Union of rects (ignoring empty ones) — the content bbox for clamp/fit.
 * A zero-size rect is a JUNCTION (an invisible node that only routes
 * edges): by default it does not count, but a board whose picture is made
 * of them (a sequence diagram's message rows sit on zero-size junctions)
 * must pass `points: true` or the bbox covers the participants only and
 * the fit parks the camera on a quarter of the diagram (measured on
 * docs.celestia.world 2026-11-27: 7 of 9 messages fell outside the card).
 */
export function boardBBox(rects: BoardRect[], opts: { points?: boolean } = {}): BoardRect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.w <= 0 || r.h <= 0) {
      // A junction with no finite position is a placeholder, not content:
      // one NaN here would poison every min/max below and the `isFinite`
      // fallback at the end can no longer tell.
      if (!opts.points || !Number.isFinite(r.x) || !Number.isFinite(r.y)) continue;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x);
      maxY = Math.max(maxY, r.y);
      continue;
    }
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1200, h: 800 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
