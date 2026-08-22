import { Maximize2, ZoomIn, ZoomOut } from "lucide-vue-next";
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, type PropType } from "vue";




import { useI18n } from "../i18n/context";
import "./HkMinimap.scss";

export interface MinimapBox {
  id: string;
  bounds: { x: number; y: number; w: number; h: number };
  color: string;
}

export interface MinimapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Generic minimap / overview overlay for pannable+zoomable surfaces.
 *
 * Renders an optionally-zoomed content area as an SVG scaled to fit, with
 * coloured boxes (or an image background for an image navigator), a hub
 * marker, the current viewport rectangle, and a small zoom bar. Dragging
 * inside the map pans the viewport via the `panDelta` event. The math
 * assumes the main surface uses `translate(panX, panY) scale(zoom)` with
 * `transform-origin: 0 0` — the same model HImageViewer uses.
 */
export default defineComponent({
  name: "HkMinimap",
  props: {
    boxes: { type: Array as PropType<MinimapBox[]>, default: () => [] },
    hubPos: { type: Object as PropType<{ x: number; y: number } | null>, default: null },
    /** Optional image rendered as the minimap background (image navigator).
     *  When set, the minimap renders even with no boxes. */
    imageSrc: { type: String, default: undefined },
    imageBounds: { type: Object as PropType<MinimapRect | undefined>, default: undefined },
    zoom: { type: Number, default: 1 },
    panX: { type: Number, default: 0 },
    panY: { type: Number, default: 0 },
    viewportWidth: { type: Number, default: 800 },
    viewportHeight: { type: Number, default: 600 },
    contentBounds: {
      type: Object as PropType<MinimapRect>,
      default: () => ({ x: 0, y: 0, w: 1200, h: 800 }),
    },
    zoomPercent: { type: Number, default: 100 },
    canZoomIn: { type: Boolean, default: true },
    canZoomOut: { type: Boolean, default: true },
    /** Show the reset/fit button in the zoom bar (chest only rendered it
     *  when a reset handler was wired up). */
    showReset: { type: Boolean, default: false },
    /** Optional prop-callback surface (alternative to the emits). */
    onZoomIn: { type: Function as PropType<() => void>, default: undefined },
    onZoomOut: { type: Function as PropType<() => void>, default: undefined },
    onReset: { type: Function as PropType<() => void>, default: undefined },
    onPanDelta: { type: Function as PropType<(dx: number, dy: number) => void>, default: undefined },
  },
  emits: {
    zoomIn: () => true,
    zoomOut: () => true,
    reset: () => true,
    panDelta: (_dx: number, _dy: number) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const svgW = 160;
    const svgH = 110;
    const rootRef = ref<HTMLElement | null>(null);
    const dragging = ref(false);
    const dragStart = ref({ x: 0, y: 0 });

    const cb = computed(() => props.contentBounds);
    const overpanW = computed(() => Math.max(props.contentBounds.w * 0.5, props.viewportWidth * 0.3));
    const overpanH = computed(() => Math.max(props.contentBounds.h * 0.5, props.viewportHeight * 0.3));

    const mapRect = computed(() => ({
      x: cb.value.x - overpanW.value,
      y: cb.value.y - overpanH.value,
      w: cb.value.w + overpanW.value * 2,
      h: cb.value.h + overpanH.value * 2,
    }));

    const scale = computed(() => {
      const sx = svgW / mapRect.value.w;
      const sy = svgH / mapRect.value.h;
      return Math.min(sx, sy);
    });

    const contentOffset = computed(() => {
      const sw = mapRect.value.w * scale.value;
      const sh = mapRect.value.h * scale.value;
      return { ox: (svgW - sw) / 2, oy: (svgH - sh) / 2 };
    });

    function toMap(wx: number, wy: number): [number, number] {
      const s = scale.value;
      const { ox, oy } = contentOffset.value;
      return [(wx - mapRect.value.x) * s + ox, (wy - mapRect.value.y) * s + oy];
    }

    const viewportRect = computed(() => {
      const z = props.zoom;
      const tl = toMap(-props.panX / z, -props.panY / z);
      const br = toMap(-props.panX / z + props.viewportWidth / z, -props.panY / z + props.viewportHeight / z);
      return { x: tl[0], y: tl[1], w: Math.max(1, br[0] - tl[0]), h: Math.max(1, br[1] - tl[1]) };
    });

    function onDown(e: PointerEvent) {
      if ((e.target as HTMLElement).closest(".hk-mm-zoom-bar")) return;
      e.stopPropagation();
      e.preventDefault();
      dragging.value = true;
      dragStart.value = { x: e.clientX, y: e.clientY };
      rootRef.value?.setPointerCapture(e.pointerId);
    }
    function onMove(e: PointerEvent) {
      if (!dragging.value) return;
      e.stopPropagation();
      const dx = e.clientX - dragStart.value.x;
      const dy = e.clientY - dragStart.value.y;
      dragStart.value = { x: e.clientX, y: e.clientY };
      if (scale.value > 0) {
        emit("panDelta", (-dx / scale.value) * props.zoom, (-dy / scale.value) * props.zoom);
      }
    }
    function onUp(e: PointerEvent) {
      if (!dragging.value) return;
      e.stopPropagation();
      dragging.value = false;
      rootRef.value?.releasePointerCapture(e.pointerId);
    }

    onMounted(() => {
      const el = rootRef.value;
      if (!el) return;
      el.addEventListener("pointerdown", onDown);
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    });
    onBeforeUnmount(() => {
      const el = rootRef.value;
      if (!el) return;
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    });

    return () => {
      if (props.boxes.length === 0 && !props.imageSrc) return null;

      const s = scale.value;
      const vr = viewportRect.value;

      const ib = props.imageBounds ?? props.contentBounds;
      const imgPos = props.imageSrc ? toMap(ib.x, ib.y) : null;

      const boxRects = props.boxes.map((b) => {
        const p = toMap(b.bounds.x, b.bounds.y);
        return (
          <rect
            key={`mm-${b.id}`}
            x={p[0]}
            y={p[1]}
            width={b.bounds.w * s}
            height={b.bounds.h * s}
            rx={2}
            fill={b.color}
            opacity="0.28"
            stroke={b.color}
            stroke-width="0.6"
          />
        );
      });

      const hubP = props.hubPos ? toMap(props.hubPos.x, props.hubPos.y) : null;

      return (
        <div
          ref={rootRef}
          class="hk-minimap"
          data-dragging={dragging.value ? "" : undefined}
        >
          <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} class="hk-minimap-svg">
            {imgPos && (
              <image
                href={props.imageSrc}
                x={imgPos[0]}
                y={imgPos[1]}
                width={ib.w * s}
                height={ib.h * s}
                preserveAspectRatio="none"
                class="hk-mm-image"
              />
            )}
            {boxRects}
            {hubP && (
              <circle
                cx={hubP[0]}
                cy={hubP[1]}
                r={3}
                fill="rgb(var(--color-primary))"
                filter="drop-shadow(0 0 2px rgb(var(--color-primary) / 0.6))"
              />
            )}
            <rect
              x={vr.x}
              y={vr.y}
              width={Math.max(1, vr.w)}
              height={Math.max(1, vr.h)}
              fill="none"
              stroke="rgb(var(--color-primary))"
              stroke-width="1"
              stroke-dasharray="3 2"
              rx="2"
              opacity="0.85"
            />
          </svg>
          <div class="hk-mm-zoom-bar">
            <button
              class="hk-mm-zoom-btn"
              type="button"
              onClick={() => emit("zoomOut")}
              disabled={!props.canZoomOut}
              aria-label={t("hikari::zoomToolbar.zoomOut", "Zoom out")}
              title={t("hikari::zoomToolbar.zoomOut", "Zoom out")}
            >
              <ZoomOut size={12} />
            </button>
            <span class="hk-mm-zoom-label">{props.zoomPercent}%</span>
            <button
              class="hk-mm-zoom-btn"
              type="button"
              onClick={() => emit("zoomIn")}
              disabled={!props.canZoomIn}
              aria-label={t("hikari::zoomToolbar.zoomIn", "Zoom in")}
              title={t("hikari::zoomToolbar.zoomIn", "Zoom in")}
            >
              <ZoomIn size={12} />
            </button>
            {props.showReset && (
              <button
                class="hk-mm-zoom-btn hk-mm-zoom-reset-btn"
                type="button"
                onClick={() => emit("reset")}
                aria-label={t("hikari::zoomToolbar.reset", "Reset zoom")}
                title={t("hikari::zoomToolbar.reset", "Reset zoom")}
              >
                <Maximize2 size={11} />
              </button>
            )}
          </div>
        </div>
      );
    };
  },
});
