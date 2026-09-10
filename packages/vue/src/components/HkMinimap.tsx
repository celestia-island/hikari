import { Maximize2, ZoomIn, ZoomOut } from "lucide-vue-next";
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";

import HSlider from "./HkSlider";

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
 *
 * The zoom bar is governed by default: ±5% fixed steps clamped to the
 * 50–200% range, each press emitting `zoomTo` with the clamped target
 * percent. Consumers with a wider native camera range override
 * `minZoomPercent`/`maxZoomPercent`.
 *
 * The percent label in the bar is a button: clicking it toggles a small
 * slider dropdown (a zoom-pop panel opening upward from the bar) whose
 * bounds/step follow `minZoomPercent`/`maxZoomPercent`/`zoomStepPercent`.
 * Dragging the slider emits `zoomTo` continuously so consumers animate
 * their camera toward each target. The panel dismisses on Escape, on a
 * pointerdown outside the minimap, and when a real map drag starts; the
 * zoom bar itself sits right-aligned in the card.
 *
 * `zoomTo` carries a `source`: `"step"` (the ± buttons — a RELATIVE
 * one-rung request; consumers may apply directional rung logic) and
 * `"slider"` (the dropdown slider — an ABSOLUTE target; consumers must
 * land the camera on that rung, never push past it). The slider is
 * bounded by min/max alone — `canZoomIn`/`canZoomOut` (the buttons'
 * endpoint guards) deliberately do not gate it; consumers that hold the
 * camera to a dynamic floor above `minZoomPercent` must clamp inside
 * their `zoomTo` handler.
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
    /** Zoom governance (defaults on): the zoom bar steps by a fixed percent
     *  increment and clamps to [min, max]. Consumers with a wider native
     *  camera range override these (e.g. the SCADA scene runs 20–400%). */
    zoomStepPercent: { type: Number, default: 5 },
    minZoomPercent: { type: Number, default: 50 },
    maxZoomPercent: { type: Number, default: 200 },
    /** Show the reset/fit button in the zoom bar (chest only rendered it
     *  when a reset handler was wired up). */
    showReset: { type: Boolean, default: false },
    /** Optional prop-callback surface (alternative to the emits). */
    onZoomTo: {
      type: Function as PropType<(percent: number, source?: "slider" | "step") => void>,
      default: undefined,
    },
    onReset: { type: Function as PropType<() => void>, default: undefined },
    onPanDelta: { type: Function as PropType<(dx: number, dy: number) => void>, default: undefined },
  },
  emits: {
    /** Zoom request carrying the clamped target percent plus the gesture
     *  source — `"step"` (± buttons, relative one-rung request) vs
     *  `"slider"` (dropdown slider, ABSOLUTE target rung). */
    zoomTo: (_percent: number, _source?: "slider" | "step") => true,
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
    const sliderOpen = ref(false);

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

    // ── Fixed-step zoom governance ───────────────────────────────────────
    const canStepIn = computed(() =>
      props.canZoomIn && props.zoomPercent < props.maxZoomPercent - 1e-9);
    const canStepOut = computed(() =>
      props.canZoomOut && props.zoomPercent > props.minZoomPercent + 1e-9);

    /** Step the zoom bar by the fixed increment, clamped to [min, max];
     *  emits `zoomTo` with the exact clamped target percent (source
     *  `"step"`). No-op (and stays disabled) at the bounds. */
    function stepZoom(dir: number) {
      const raw = props.zoomPercent + dir * props.zoomStepPercent;
      const next = Math.min(props.maxZoomPercent, Math.max(props.minZoomPercent, raw));
      if (Math.abs(next - props.zoomPercent) < 1e-9) return;
      emit("zoomTo", next, "step");
    }

    function onDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      // Zoom chrome (bar + slider pop) must never start a map drag — the
      // root's setPointerCapture would swallow the slider's gestures.
      if (target.closest(".hk-mm-zoom-bar") || target.closest(".hk-mm-zoom-pop")) return;
      // A real map drag takes over the gesture: put the slider away.
      sliderOpen.value = false;
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

    // ── Slider pop dismissal (outside pointerdown + Escape) ──────────────
    // Capture-phase document listeners while the pop is open, mirroring
    // HkPopover's outside-click shield; removed on close and unmount so
    // nothing leaks.
    function onDocPointerDown(e: PointerEvent) {
      if (!rootRef.value?.contains(e.target as Node)) sliderOpen.value = false;
    }
    function onDocKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") sliderOpen.value = false;
    }
    watch(sliderOpen, (open) => {
      if (open) {
        document.addEventListener("pointerdown", onDocPointerDown, true);
        document.addEventListener("keydown", onDocKeydown, true);
      } else {
        document.removeEventListener("pointerdown", onDocPointerDown, true);
        document.removeEventListener("keydown", onDocKeydown, true);
      }
    });

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
      if (el) {
        el.removeEventListener("pointerdown", onDown);
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
      }
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onDocKeydown, true);
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
              onClick={() => stepZoom(-1)}
              disabled={!canStepOut.value}
              aria-label={t("hikari::zoomToolbar.zoomOut", "Zoom out")}
              title={t("hikari::zoomToolbar.zoomOut", "Zoom out")}
            >
              <ZoomOut size={12} />
            </button>
            <button
              class="hk-mm-zoom-label"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={sliderOpen.value ? "true" : "false"}
              onClick={() => {
                sliderOpen.value = !sliderOpen.value;
              }}
              title={t("hikari::zoomToolbar.zoomSlider", "Zoom level")}
            >
              {props.zoomPercent}%
            </button>
            <button
              class="hk-mm-zoom-btn"
              type="button"
              onClick={() => stepZoom(1)}
              disabled={!canStepIn.value}
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
          {sliderOpen.value && (
            <div class="hk-mm-zoom-pop">
              <HSlider
                modelValue={props.zoomPercent}
                min={props.minZoomPercent}
                max={props.maxZoomPercent}
                step={props.zoomStepPercent}
                size="sm"
                ariaLabel={t("hikari::zoomToolbar.zoomSlider", "Zoom level")}
                formatValue={(v: number) => `${v}%`}
                onUpdate:modelValue={(v: number) => emit("zoomTo", v, "slider")}
              />
              <div class="hk-mm-zoom-pop-scale" aria-hidden="true">
                <span>{props.minZoomPercent}%</span>
                <span>{props.maxZoomPercent}%</span>
              </div>
            </div>
          )}
        </div>
      );
    };
  },
});
