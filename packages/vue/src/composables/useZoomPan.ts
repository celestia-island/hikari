import { computed, onUnmounted, ref, type Ref } from "vue";

import { useReportedTransition } from "@celestia-island/hikari";

/** Duration of the transform settle transition (see `style` below) AND the
 *  window reported to the unified animation bus. JS == CSS so the bus
 *  timeline tracks the CSS timeline exactly (SGaugeRing convention). */
const SETTLE_ANIM_MS = 150;

export interface ZoomPanOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  containerRef: Ref<HTMLElement | null>;
  contentRef: Ref<HTMLElement | null>;
}

export interface ZoomPanState {
  zoom: Ref<number>;
  panX: Ref<number>;
  panY: Ref<number>;
  isZoomed: Ref<boolean>;
  canZoomIn: Ref<boolean>;
  canZoomOut: Ref<boolean>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  style: Ref<Record<string, string>>;
}

export function useZoomPan(options: ZoomPanOptions): ZoomPanState {
  const {
    minZoom = 0.5,
    maxZoom = 1,
    zoomStep = 0.1,
    containerRef,
    contentRef,
  } = options;

  const zoom = ref(1);
  const panX = ref(0);
  const panY = ref(0);
  const isPanning = ref(false);
  const lastPointerX = ref(0);
  const lastPointerY = ref(0);
  const contentOverflow = ref(false);

  // Reports the 150ms transform settle to the animation bus whenever a
  // value change starts a non-panning transition (zoom step, reset, or the
  // pointer-up that ends a drag). Panning itself sets transition:none so
  // there's nothing to report during an active drag.
  const settleAnim = useReportedTransition(SETTLE_ANIM_MS);

  const isZoomed = computed(() => zoom.value < 1);
  const canZoomIn = computed(() => zoom.value < maxZoom);
  const canZoomOut = computed(() => {
    if (zoom.value <= minZoom) return false;
    return contentOverflow.value;
  });

  function checkOverflow() {
    const container = containerRef.value;
    const content = contentRef.value;
    if (!container || !content) {
      contentOverflow.value = false;
      return;
    }
    contentOverflow.value =
      content.scrollHeight > container.clientHeight ||
      content.scrollWidth > container.clientWidth;
  }

  function clampPan() {
    if (!containerRef.value || !contentRef.value) return;
    const cw = containerRef.value.clientWidth;
    const ch = containerRef.value.clientHeight;
    const sw = contentRef.value.scrollWidth * zoom.value;
    const sh = contentRef.value.scrollHeight * zoom.value;
    const maxX = Math.max(0, (sw - cw) / 2);
    const maxY = Math.max(0, (sh - ch) / 2);
    panX.value = Math.max(-maxX, Math.min(maxX, panX.value));
    panY.value = Math.max(-maxY, Math.min(maxY, panY.value));
  }

  function zoomIn() {
    if (!canZoomIn.value) return;
    zoom.value = Math.min(maxZoom, +(zoom.value + zoomStep).toFixed(2));
    if (zoom.value >= 1) {
      panX.value = 0;
      panY.value = 0;
    }
    checkOverflow();
    clampPan();
    settleAnim.run();
  }

  function zoomOut() {
    if (!canZoomOut.value) return;
    zoom.value = Math.max(minZoom, +(zoom.value - zoomStep).toFixed(2));
    checkOverflow();
    clampPan();
    settleAnim.run();
  }

  function resetView() {
    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;
    settleAnim.run();
  }

  function onWheel(e: WheelEvent) {
    if (zoom.value >= 1) return;
    if (!contentOverflow.value && e.deltaY > 0) return;
    if (e.deltaY > 0) zoomOut();
    else if (e.deltaY < 0) zoomIn();
    e.preventDefault();
  }

  function onPointerDown(e: PointerEvent) {
    if (zoom.value >= 1) return;
    isPanning.value = true;
    lastPointerX.value = e.clientX;
    lastPointerY.value = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent) {
    if (!isPanning.value) return;
    const dx = e.clientX - lastPointerX.value;
    const dy = e.clientY - lastPointerY.value;
    lastPointerX.value = e.clientX;
    lastPointerY.value = e.clientY;
    panX.value += dx;
    panY.value += dy;
    clampPan();
  }

  function onPointerUp() {
    if (!isPanning.value) return;
    isPanning.value = false;
    // Drag just ended → the transform now switches from transition:none
    // to the 0.15s settle, so report it to the bus.
    settleAnim.run();
  }

  let detach: (() => void) | null = null;
  if (typeof window !== "undefined") {
    const el = containerRef.value;
    if (el) {
      const wheelOpts = { passive: false } as AddEventListenerOptions;
      el.addEventListener("wheel", onWheel, wheelOpts);
      el.addEventListener("pointerdown", onPointerDown);
      el.addEventListener("pointermove", onPointerMove);
      el.addEventListener("pointerup", onPointerUp);
      el.addEventListener("pointercancel", onPointerUp);
      detach = () => {
        el.removeEventListener("wheel", onWheel, wheelOpts);
        el.removeEventListener("pointerdown", onPointerDown);
        el.removeEventListener("pointermove", onPointerMove);
        el.removeEventListener("pointerup", onPointerUp);
        el.removeEventListener("pointercancel", onPointerUp);
      };
    }
  }

  const style = computed(() => ({
    transform: `scale(${zoom.value}) translate(${panX.value / zoom.value}px, ${panY.value / zoom.value}px)`,
    transformOrigin: "top left",
    // 0.15s mirrors SETTLE_ANIM_MS above — see the comment there.
    transition: isPanning.value ? "none" : `transform ${SETTLE_ANIM_MS}ms ease-out`,
  }));

  onUnmounted(() => {
    detach?.();
    resetView();
  });

  return {
    zoom,
    panX,
    panY,
    isZoomed,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    resetView,
    style,
  };
}
