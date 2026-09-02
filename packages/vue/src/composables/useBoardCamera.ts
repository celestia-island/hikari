/**
 * useBoardCamera — reactive world camera + gesture primitives for HkBoard.
 *
 * Owns the camera state (`{x, y, k}`) and the motion rules:
 *  - every zoom lands on the 5% geometric ladder (quantizeBoardK / quantizeBoardStep);
 *  - zoom changes ANIMATE (~170ms ease-out, geometric k tween) instead of
 *    snapping — an active pinch stays raw/continuous while the fingers
 *    move and only animates to the nearest rung on release;
 *  - wheel steps one rung per notch, anchored at the pointer;
 *  - pan is clamped against the content bbox (half-viewport slack);
 *  - reduced-motion (or `animated: false`) skips the tween and snaps.
 *
 * The component wires DOM events; this composable stays input-agnostic.
 */
import { computed, ref, toValue, type MaybeRefOrGetter, type Ref } from "vue";

import {
  BOARD_K_MAX,
  BOARD_K_MIN,
  BOARD_ZOOM_FACTOR,
  type BoardCamera,
  type BoardPoint,
  type BoardRect,
  type BoardViewport,
  boardClampPan,
  boardFit,
  boardTweenCam,
  boardZoomAt,
  quantizeBoardK,
} from "../utils/boardCamera";

/** Animated transition duration, ms (wheel notch / minimap bar / pinch release). */
const BOARD_ANIM_MS = 170;

/** System reduced-motion preference — animations snap instead of tweening. */
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export interface UseBoardCameraOptions {
  /** The viewport element (screen space) — used for anchor math. */
  viewportSize: MaybeRefOrGetter<BoardViewport>;
  /** World bbox of the board content (nodes + padding). */
  content: MaybeRefOrGetter<BoardRect>;
  minK?: number;
  maxK?: number;
  /** Master animation switch; reduced-motion forces snapping regardless. */
  animated?: boolean;
}

export interface UseBoardCameraReturn {
  camera: Ref<BoardCamera>;
  isAnimating: Ref<boolean>;
  /** Screen↔world conversion at the CURRENT camera. */
  screenToWorld: (p: BoardPoint) => BoardPoint;
  worldToScreen: (p: BoardPoint) => BoardPoint;
  /** Animated, ladder-quantized zoom keeping `anchor` (screen px) fixed. */
  zoomByFactor: (factor: number, anchor?: BoardPoint) => void;
  zoomToK: (targetK: number, anchor?: BoardPoint) => void;
  zoomToPercent: (percent: number, anchor?: BoardPoint) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** Raw (unquantized, unanimated) pinch zoom — call per pointermove. */
  pinchZoom: (base: BoardCamera, ratio: number, anchor: BoardPoint) => void;
  /** Snap the post-pinch camera onto the nearest rung (animated). */
  settlePinch: () => void;
  panBy: (dx: number, dy: number) => void;
  setCamera: (cam: BoardCamera, opts?: { animate?: boolean }) => void;
  fit: () => void;
  reset: () => void;
}

export function useBoardCamera(options: UseBoardCameraOptions): UseBoardCameraReturn {
  const {
    viewportSize,
    content,
    minK = BOARD_K_MIN,
    maxK = BOARD_K_MAX,
    animated = true,
  } = options;

  const camera = ref<BoardCamera>({ x: 0, y: 0, k: 1 });
  const isAnimating = ref(false);

  let raf = 0;
  let tweenFrom: BoardCamera = { x: 0, y: 0, k: 1 };
  let tweenTo: BoardCamera = { x: 0, y: 0, k: 1 };
  let tweenStart = 0;

  const stopTween = (): void => {
    if (raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    isAnimating.value = false;
  };

  const viewport = (): BoardViewport => toValue(viewportSize);
  const contentRect = (): BoardRect => toValue(content);

  const clampCam = (cam: BoardCamera): BoardCamera => {
    const k = Math.min(maxK, Math.max(minK, cam.k));
    return boardClampPan({ ...cam, k }, contentRect(), viewport());
  };

  function animateTo(target: BoardCamera): void {
    const doSnap = !animated || prefersReducedMotion();
    if (doSnap) {
      stopTween();
      camera.value = clampCam(target);
      return;
    }
    tweenFrom = { ...camera.value };
    tweenTo = target;
    tweenStart = performance.now();
    isAnimating.value = true;
    if (raf) window.cancelAnimationFrame(raf);
    const step = (now: number): void => {
      const t = Math.min(1, (now - tweenStart) / BOARD_ANIM_MS);
      camera.value = clampCam(boardTweenCam(tweenFrom, tweenTo, t));
      if (t < 1) {
        raf = window.requestAnimationFrame(step);
      } else {
        raf = 0;
        isAnimating.value = false;
      }
    };
    raf = window.requestAnimationFrame(step);
  }

  const anchorPoint = (anchor?: BoardPoint): BoardPoint => {
    const vp = viewport();
    return anchor ?? { x: vp.w / 2, y: vp.h / 2 };
  };

  function zoomByFactor(factor: number, anchor?: BoardPoint): void {
    const next = boardZoomAt(camera.value, camera.value.k * factor, anchorPoint(anchor));
    animateTo({ ...next, k: quantizeBoardK(next.k) });
  }

  function zoomToK(targetK: number, anchor?: BoardPoint): void {
    const next = boardZoomAt(camera.value, targetK, anchorPoint(anchor));
    animateTo({ ...next, k: quantizeBoardK(next.k) });
  }

  function zoomToPercent(percent: number, anchor?: BoardPoint): void {
    zoomToK(Math.min(maxK, Math.max(minK, percent / 100)), anchor);
  }

  function zoomIn(): void {
    zoomByFactor(BOARD_ZOOM_FACTOR);
  }

  function zoomOut(): void {
    zoomByFactor(1 / BOARD_ZOOM_FACTOR);
  }

  function pinchZoom(base: BoardCamera, ratio: number, anchor: BoardPoint): void {
    // Raw and continuous while the fingers move; quantized on release.
    stopTween();
    camera.value = clampCam(boardZoomAt(base, base.k * ratio, anchor));
  }

  function settlePinch(): void {
    const settled = { ...camera.value, k: quantizeBoardK(camera.value.k) };
    animateTo(settled);
  }

  function panBy(dx: number, dy: number): void {
    stopTween();
    camera.value = clampCam({ ...camera.value, x: camera.value.x + dx, y: camera.value.y + dy });
  }

  function setCamera(cam: BoardCamera, opts: { animate?: boolean } = {}): void {
    if (opts.animate) animateTo(cam);
    else {
      stopTween();
      camera.value = clampCam(cam);
    }
  }

  function fit(): void {
    animateTo(boardFit(contentRect(), viewport()));
  }

  function reset(): void {
    fit();
  }

  function screenToWorld(p: BoardPoint): BoardPoint {
    const c = camera.value;
    return { x: (p.x - c.x) / c.k, y: (p.y - c.y) / c.k };
  }

  function worldToScreen(p: BoardPoint): BoardPoint {
    const c = camera.value;
    return { x: p.x * c.k + c.x, y: p.y * c.k + c.y };
  }

  return {
    camera,
    isAnimating,
    screenToWorld,
    worldToScreen,
    zoomByFactor,
    zoomToK,
    zoomToPercent,
    zoomIn,
    zoomOut,
    pinchZoom,
    settlePinch,
    panBy,
    setCamera,
    fit,
    reset,
  };
}
