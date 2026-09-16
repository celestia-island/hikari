import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type PropType,
} from "vue";

import "./HkNodeCanvas.scss";

/** A camera: zoom factor plus the translation of the content origin. */
export interface NodeCanvasCamera {
  /** Zoom factor (1 = 1:1). */
  k: number;
  /** Translation of the content origin, in screen pixels. */
  x: number;
  /** Translation of the content origin, in screen pixels. */
  y: number;
}

/** A rectangle in content (world) coordinates. */
export interface NodeCanvasBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What the `overlay` and `minimap` slots receive — the live camera and the
 *  viewport it is drawing into, so a host can place DOM or minimap boxes
 *  without reaching into the component. */
export interface NodeCanvasSlotProps {
  camera: NodeCanvasCamera;
  viewport: { width: number; height: number };
  contentBounds: NodeCanvasBounds | null;
}

export type MinimapPlacement = "bottom-right" | "bottom-left" | "top-right" | "top-left";

/** The defaults the chat views already ship (they were constants in the
 *  scada camera module; a base view has to publish them instead). */
export const NODE_CANVAS_DEFAULTS = {
  zoomFactor: 1.05,
  minZoom: 0.2,
  maxZoom: 4,
  /** Zoom snaps to this grid so a wheel tick lands on a reproducible step. */
  zoomGridStep: 0.05,
  fitPadding: 40,
  fitCap: 1.25,
} as const;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * HkNodeCanvas — the base view for a pannable, zoomable node surface.
 *
 * The industrial topology, the media pipeline and the topic map are all the
 * same shape: a camera over a piece of content, drawn as SVG, as DOM over an
 * SVG edge layer, or as DOM over a canvas. What they share is NOT how they
 * draw — it is the camera: how a wheel tick becomes a zoom step on a fixed
 * grid, how a drag pans, how "fit" frames the content, and how a screen point
 * maps back into content coordinates. That is what this component owns, and
 * it owns it once instead of three times.
 *
 * What it does NOT own: edges, nodes, routing, layout. The host draws those
 * through the default slot, which lives inside the transformed layer, so the
 * host only has to think in content coordinates.
 *
 * Two behaviours are deliberate:
 *
 *   - **the camera is ready on the first frame** when `fitOnLoad` is on and
 *     the content bounds are known: the initial transform is computed before
 *     the first paint instead of starting at 1:1 and snapping a frame later,
 *     which is what makes a large graph flash at the wrong scale;
 *   - **the minimap is mounted by default** (bottom-right, the corner the
 *     chat views use) and takes its boxes from the host through the
 *     `minimap` slot — the component owns where the map sits, the host owns
 *     what it shows.
 */
export default defineComponent({
  name: "HkNodeCanvas",
  props: {
    /** Controlled camera (`v-model:camera`). Without it the component keeps
     *  its own, seeded by `fitOnLoad`. */
    camera: { type: Object as PropType<NodeCanvasCamera | undefined>, default: undefined },
    /** Content rectangle, in world units, used for fit and clamping. */
    contentBounds: { type: Object as PropType<NodeCanvasBounds | null>, default: null },
    /** Smallest zoom the camera will settle on. */
    minZoom: { type: Number, default: NODE_CANVAS_DEFAULTS.minZoom },
    /** Largest zoom the camera will settle on. */
    maxZoom: { type: Number, default: NODE_CANVAS_DEFAULTS.maxZoom },
    /** One wheel/trackpad step multiplies zoom by this factor. */
    zoomFactor: { type: Number, default: NODE_CANVAS_DEFAULTS.zoomFactor },
    /** Zoom is snapped to this grid (0 disables snapping). */
    zoomGridStep: { type: Number, default: NODE_CANVAS_DEFAULTS.zoomGridStep },
    /** Padding (px) left around the content when fitting. */
    fitPadding: { type: Number, default: NODE_CANVAS_DEFAULTS.fitPadding },
    /** Largest zoom "fit" will choose, so a tiny graph is not blown up. */
    fitCap: { type: Number, default: NODE_CANVAS_DEFAULTS.fitCap },
    /** Frame the content immediately instead of starting at 1:1. */
    fitOnLoad: { type: Boolean, default: true },
    /** Whether dragging pans the camera. */
    pannable: { type: Boolean, default: true },
    /** Whether the wheel zooms. */
    zoomable: { type: Boolean, default: true },
    /** Mount the minimap in the corner. */
    minimap: { type: Boolean, default: true },
    /** Which corner the minimap takes. */
    minimapPlacement: {
      type: String as PropType<MinimapPlacement>,
      default: "bottom-right",
    },
    ariaLabel: { type: String, default: undefined },
  },
  emits: ["update:camera"],
  setup(props, { slots, emit, expose }) {
    const rootEl = shallowRef<HTMLElement | null>(null);
    const viewport = ref({ width: 0, height: 0 });
    const inner = ref<NodeCanvasCamera>({ k: 1, x: 0, y: 0 });
    /** Panning state: the last pointer position while a drag is live. */
    let panning: { pointerId: number; x: number; y: number } | null = null;

    const camera = computed<NodeCanvasCamera>(() => props.camera ?? inner.value);

    /** Snap a zoom factor onto the grid, then into range. `quantizeScaleStep`
     *  in the scada module does the same thing; the base view carries the
     *  rule rather than the consumer. */
    function normalizeZoom(k: number): number {
      const step = props.zoomGridStep;
      const snapped = step > 0 ? Math.round(k / step) * step : k;
      return clamp(Number(snapped.toFixed(6)), props.minZoom, props.maxZoom);
    }

    function setCamera(next: NodeCanvasCamera) {
      const normalized = { k: normalizeZoom(next.k), x: next.x, y: next.y };
      if (props.camera) emit("update:camera", normalized);
      else inner.value = normalized;
    }

    /** The camera that frames `contentBounds` inside the viewport. */
    function computeFit(): NodeCanvasCamera {
      const bounds = props.contentBounds;
      const { width, height } = viewport.value;
      if (!bounds || bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) {
        return camera.value;
      }
      const pad = props.fitPadding;
      const k = clamp(
        Math.min((width - pad * 2) / bounds.width, (height - pad * 2) / bounds.height),
        props.minZoom,
        Math.min(props.maxZoom, props.fitCap),
      );
      return {
        k,
        x: (width - bounds.width * k) / 2 - bounds.x * k,
        y: (height - bounds.height * k) / 2 - bounds.y * k,
      };
    }

    /** Frame the content. Called on load when `fitOnLoad`, and exposed. */
    function fit() {
      setCamera(computeFit());
    }

    function zoomAt(nextK: number, at: { x: number; y: number }) {
      const current = camera.value;
      const k = normalizeZoom(nextK);
      if (k === current.k) return;
      // Keep the world point under `at` fixed: the content moves opposite to
      // the growth of the scale.
      const scale = k / current.k;
      setCamera({
        k,
        x: at.x - (at.x - current.x) * scale,
        y: at.y - (at.y - current.y) * scale,
      });
    }

    function zoomBy(direction: 1 | -1, at?: { x: number; y: number }) {
      const point = at ?? { x: viewport.value.width / 2, y: viewport.value.height / 2 };
      zoomAt(camera.value.k * (direction > 0 ? props.zoomFactor : 1 / props.zoomFactor), point);
    }

    function panBy(dx: number, dy: number) {
      const current = camera.value;
      setCamera({ k: current.k, x: current.x + dx, y: current.y + dy });
    }

    /** Content coordinates of a point given in viewport pixels. */
    function screenToWorld(point: { x: number; y: number }) {
      const { k, x, y } = camera.value;
      return { x: (point.x - x) / k, y: (point.y - y) / k };
    }

    /** Viewport pixels of a point given in content coordinates. */
    function worldToScreen(point: { x: number; y: number }) {
      const { k, x, y } = camera.value;
      return { x: point.x * k + x, y: point.y * k + y };
    }

    function onWheel(event: WheelEvent) {
      if (!props.zoomable) return;
      event.preventDefault();
      const rect = rootEl.value?.getBoundingClientRect();
      const at = rect
        ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
        : undefined;
      // A wheel event's deltaY is device-dependent; the sign is what matters,
      // and the grid keeps the result reproducible.
      zoomBy(event.deltaY < 0 ? 1 : -1, at);
    }

    function onPointerDown(event: PointerEvent) {
      if (!props.pannable || event.button !== 0) return;
      panning = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      rootEl.value?.setPointerCapture?.(event.pointerId);
    }

    function onPointerMove(event: PointerEvent) {
      if (!panning || event.pointerId !== panning.pointerId) return;
      const dx = event.clientX - panning.x;
      const dy = event.clientY - panning.y;
      panning = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
      panBy(dx, dy);
    }

    function endPan(event: PointerEvent) {
      if (!panning || event.pointerId !== panning.pointerId) return;
      panning = null;
      rootEl.value?.releasePointerCapture?.(event.pointerId);
    }

    let ro: ResizeObserver | null = null;

    function measureViewport() {
      const el = rootEl.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      if (next.width === viewport.value.width && next.height === viewport.value.height) return;
      viewport.value = next;
    }

    onMounted(() => {
      // Measure BEFORE the first paint the watcher can react to: with
      // `fitOnLoad` this is what makes the first painted frame already be the
      // fitted one instead of 1:1 and then a snap.
      measureViewport();
      if (props.fitOnLoad && props.contentBounds) fit();
      if (typeof ResizeObserver !== "undefined" && rootEl.value) {
        ro = new ResizeObserver(() => {
          measureViewport();
        });
        ro.observe(rootEl.value);
      }
    });

    // Late-arriving bounds (the usual case: the graph loads after mount) are
    // framed as soon as they exist, still before the host has drawn at the
    // wrong scale.
    watch(
      () => props.contentBounds,
      (bounds) => {
        if (bounds && props.fitOnLoad) fit();
      },
    );

    onBeforeUnmount(() => {
      ro?.disconnect();
      ro = null;
      panning = null;
    });

    expose({
      camera,
      viewport,
      fit,
      zoomBy,
      panBy,
      screenToWorld,
      worldToScreen,
      setCamera,
    });

    const slotProps = computed<NodeCanvasSlotProps>(() => ({
      camera: camera.value,
      viewport: viewport.value,
      contentBounds: props.contentBounds,
    }));

    return () => {
      const { k, x, y } = camera.value;
      return (
        <div
          ref={rootEl}
          class="hk-node-canvas"
          data-pannable={props.pannable ? "" : undefined}
          aria-label={props.ariaLabel}
          onWheel={onWheel}
          onPointerdown={onPointerDown}
          onPointermove={onPointerMove}
          onPointerup={endPan}
          onPointercancel={endPan}
        >
          {/* The transformed layer: the host draws in CONTENT coordinates and
              this transform puts it on screen. */}
          <div
            class="hk-node-canvas-layer"
            style={{ transform: `translate(${x}px, ${y}px) scale(${k})` }}
          >
            {slots.default?.(slotProps.value)}
          </div>
          <div class="hk-node-canvas-overlay">{slots.overlay?.(slotProps.value)}</div>
          {props.minimap && (
            <div
              class="hk-node-canvas-minimap"
              data-placement={props.minimapPlacement}
            >
              {slots.minimap?.(slotProps.value)}
            </div>
          )}
        </div>
      );
    };
  },
});
