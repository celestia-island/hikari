import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch,
  type PropType } from "vue";
import { ChevronLeft } from "lucide-vue-next";

import HkIconButton from "./HkIconButton";
import HkMinimap, { type MinimapBox } from "./HkMinimap";
import HkTooltip from "./HkTooltip";
import { drawnScale } from "../composables/layoutGeometry";
import {
  buildHkTreemapLayout,
  contrastTextColor,
  formatHkTreemapPercent,
  layoutHkTreemapCells,
  type HkTreemapCell,
  type HkTreemapLayoutNode,
  type HkTreemapNode,
  type HkTreemapValueFormatter,
} from "./HkTreemap";

import "./HkTreemapStage.scss";

const defaultValueFormatter: HkTreemapValueFormatter = (value) => String(value);

/** One step of the drill path: the node plus its layout at that level. */
interface DrillStep {
  /** The node id at this level ("root" for the top). */
  id: string;
  label: string;
  /** The layout nodes visible at this step (root's children, or the drilled
   *  group's children). */
  siblings: HkTreemapLayoutNode[];
}

/**
 * HkTreemapStage — the interactive treemap surface (user direction
 * 2026-10-27): the block renderer you can CLICK to zoom into.
 *
 *  - DRILL: clicking a GROUP cell zooms into it — its children re-lay out
 *    at the full canvas, so cells that were slivers reveal their labels,
 *    meta and nested structure ("部分方块在放大的时候才会显示更多的细
 *    节"). The header carries a BACK button (ChevronLeft, the family icon
 *    chrome) plus the drill path; clicking an earlier hop pops back to it.
 *  - PAN/ZOOM: the camera scales/translates the cell layer; the ±/slider
 *    zoom bar (via the collapsible HkMinimap pinned bottom-right) steps
 *    50–200%, and dragging the minimap pans. Larger zoom rungs enlarge
 *    cells, pushing more of them over the label/meta ladder floors.
 *  - COLLAPSE: the minimap defaults collapsed to its semi-transparent
 *    map-icon button (hover = opaque); the minimize button in its zoom
 *    bar folds it back.
 *
 * The cell rendering reuses HkTreemap's pure layout (squarified, theme
 * mortar) and its HkTooltip-per-cell contract verbatim — same family, no
 * second renderer.
 */
export default defineComponent({
  name: "HkTreemapStage",
  props: {
    nodes: { type: Array as PropType<HkTreemapNode[]>, default: () => [] },
    valueFormatter: { type: Function as PropType<HkTreemapValueFormatter>, default: undefined },
    emptyText: { type: String, default: "No data" },
    ariaLabel: { type: String, default: "Treemap" },
    /** The camera's zoom percent; uncontrolled when omitted (50–200). */
    zoomPercent: { type: Number, default: undefined },
    /** The minimap's collapsed flag; uncontrolled when omitted (defaults
     *  collapsed — the user direction's "at a glance it stays out of the
     *  way"; expand on demand). */
    minimapCollapsed: { type: Boolean, default: undefined },
  },
  emits: {
    "update:zoomPercent": (_percent: number) => true,
    "update:minimapCollapsed": (_collapsed: boolean) => true,
    /** A leaf cell was activated (click). */
    select: (_id: string) => true,
  },
  setup(props, { emit }) {
    const hostRef = ref<HTMLElement | null>(null);
    const size = ref<{ w: number; h: number } | null>(null);
    let observer: ResizeObserver | undefined;
    let resizeCleanup: (() => void) | undefined;

    // ── the camera ────────────────────────────────────────────────────
    const MIN_ZOOM = 50;
    const MAX_ZOOM = 200;
    const STEP_ZOOM = 10;
    const internalZoom = ref(100);
    const zoomPct = computed(() => props.zoomPercent ?? internalZoom.value);
    const panX = ref(0);
    const panY = ref(0);

    interface ZoomAnchor { x: number; y: number }
    let pendingControlledZoom: { percent: number; anchor: ZoomAnchor } | null = null;

    function rescalePan(prev: number, next: number, anchor: ZoomAnchor): void {
      // transform = translate(pan) scale(k): keep the WORLD point under
      // `anchor` stationary. Minimap buttons keep the historical origin
      // anchor; wheel passes the pointer's LOCAL canvas point (DPI-safe).
      if (prev <= 0 || next === prev) return;
      const ratio = next / prev;
      panX.value = anchor.x - (anchor.x - panX.value) * ratio;
      panY.value = anchor.y - (anchor.y - panY.value) * ratio;
    }

    function applyZoom(target: number, anchor = { x: 0, y: 0 }): void {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(target)));
      const prev = zoomPct.value;
      if (props.zoomPercent === undefined) {
        internalZoom.value = next;
        rescalePan(prev, next, anchor);
      } else {
        // Controlled mode is a REQUEST until the parent applies it. If the
        // parent rejects/omits the update, scale AND pan must both stay put.
        pendingControlledZoom = { percent: next, anchor };
      }
      emit("update:zoomPercent", next);
    }

    watch(() => props.zoomPercent, (next, prev) => {
      if (next == null || prev == null || next === prev) return;
      const pending = pendingControlledZoom;
      pendingControlledZoom = null;
      rescalePan(prev, next, pending?.percent === next ? pending.anchor : { x: 0, y: 0 });
    });

    function applyPanDelta(dx: number, dy: number): void {
      panX.value += dx;
      panY.value += dy;
    }

    function localPoint(event: WheelEvent): { x: number; y: number } {
      const el = hostRef.value;
      const rect = el?.getBoundingClientRect();
      if (!el) return { x: 0, y: 0 };
      // Pointer coordinates and gBCR are DRAWN px; the camera lives in the
      // canvas's LOCAL CSS px. Follow HkBoard's root-zoom conversion rather
      // than letting a 200%/300% root move the zoom anchor off the pointer.
      const scale = drawnScale(el);
      const factor = el.offsetWidth > 0 ? scale.x : el.offsetHeight > 0 ? scale.y : 1;
      const k = factor > 0 ? factor : 1;
      return {
        x: (event.clientX - (rect?.left ?? 0)) / k,
        y: (event.clientY - (rect?.top ?? 0)) / k,
      };
    }

    function onWheel(event: WheelEvent): void {
      // The stage is a map canvas: wheel gestures belong to its camera, not
      // to the popover/page behind it. Prevent the scroll even at a zoom
      // limit so reaching 50%/200% never unexpectedly scrolls the host.
      event.preventDefault();
      if (event.deltaY === 0) return;
      applyZoom(
        zoomPct.value + (event.deltaY < 0 ? STEP_ZOOM : -STEP_ZOOM),
        localPoint(event),
      );
    }

    function resetCamera(): void {
      internalZoom.value = 100;
      emit("update:zoomPercent", 100);
      panX.value = 0;
      panY.value = 0;
    }

    // ── the drill stack ───────────────────────────────────────────────
    const layout = computed(() => buildHkTreemapLayout(props.nodes));
    const drill = ref<DrillStep[]>([]);
    const current = computed<DrillStep>(() => {
      const step = drill.value[drill.value.length - 1];
      if (step) return step;
      return { id: "root", label: "", siblings: layout.value.nodes };
    });

    function pushDrill(node: HkTreemapLayoutNode): void {
      if (!node.children || node.children.length === 0) {
        emit("select", node.id);
        return;
      }
      drill.value = [
        ...drill.value,
        { id: node.id, label: node.label, siblings: node.children },
    ];
      // Drilling is itself a zoom: reset the pan so the new level starts
      // framed; the zoom rung stays (the user picked it).
      panX.value = 0;
      panY.value = 0;
    }

    function popTo(index: number): void {
      drill.value = drill.value.slice(0, index);
      panX.value = 0;
      panY.value = 0;
    }

    // A changed LAYOUT invalidates the drill stack. Watching the layout
    // (not the array identity) catches the in-place mutation a consumer
    // can make (the computed recomputes off contents). Inline
    // `:nodes="[...]"` literals still reset on every parent re-render —
    // the layout allocates a fresh tree per recompute — so pass a stable
    // reference from hot parents (known limitation, delta review F3).
    watch(layout, () => {
      drill.value = [];
      resetCamera();
    });

    // ── measurement (LOCAL px — the dpiPrefs root-zoom lesson) ────────
    function measure() {
      const el = hostRef.value;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) size.value = { w, h };
    }
    onMounted(() => {
      const el = hostRef.value;
      if (!el) return;
      measure();
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(measure);
        observer.observe(el);
      } else {
        window.addEventListener("resize", measure);
        resizeCleanup = () => window.removeEventListener("resize", measure);
      }
    });
    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = undefined;
      resizeCleanup?.();
      resizeCleanup = undefined;
    });
    watch([layout, current], measure);

    // ── cells at the current level ────────────────────────────────────
    const cells = computed<HkTreemapCell[]>(() => {
      const dims = size.value;
      if (!dims || layout.value.nodes.length === 0) return [];
      return layoutHkTreemapCells(current.value.siblings, 0, 0, dims.w, dims.h);
    });

    const formatValue = (value: number) =>
      (props.valueFormatter ?? defaultValueFormatter)(value);

    // ── the minimap's model: boxes = the level's top cells, viewport =
    //    the camera window over the (virtual) content plane. ──────────
    const ZOOM_FOR_BOUNDS = 1; // content plane == canvas plane at 100%
    const mmBoxes = computed<MinimapBox[]>(() =>
      cells.value.map((cell) => ({
        id: cell.node.id,
        bounds: { x: cell.x, y: cell.y, w: cell.w, h: cell.h },
        color: cell.node.color,
      })),
    );
    const mmContentBounds = computed(() => {
      const dims = size.value;
      return { x: 0, y: 0, w: dims?.w ?? 800, h: dims?.h ?? 600 };
    });
    const mmZoom = computed(() => (zoomPct.value / 100) * ZOOM_FOR_BOUNDS);

    const internalMinimapCollapsed = ref(true);
    const minimapIsCollapsed = computed(() =>
      props.minimapCollapsed !== undefined
        ? props.minimapCollapsed
        : internalMinimapCollapsed.value,
    );
    function onMinimapCollapsed(v: boolean): void {
      internalMinimapCollapsed.value = v;
      emit("update:minimapCollapsed", v);
    }

    // ── render ────────────────────────────────────────────────────────
    function cellText(node: HkTreemapLayoutNode): string {
      return `${node.label}: ${formatValue(node.value)} · ${formatHkTreemapPercent(node.percent)}`;
    }

    const hasData = computed(() => layout.value.nodes.length > 0);
    const surfaceStyle = computed(() => ({
      transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoomPct.value / 100})`,
      transformOrigin: "0 0",
    }));

    return () => (
      <div class="hk-treemap-stage">
        {hasData.value && (
          <header class="hk-treemap-stage__head">
            {drill.value.length > 0 ? (
              <HkIconButton
                size={24}
                variant="ghost"
                aria-label="Back"
                onClick={() => popTo(drill.value.length - 1)}
              >
                {{ icon: () => <ChevronLeft size={15} /> }}
              </HkIconButton>
            ) : (
              <span class="hk-treemap-stage__head-pad" aria-hidden="true" />
            )}
            <nav class="hk-treemap-stage__path" aria-label="Drill path">
              <button
                type="button"
                class="hk-treemap-stage__crumb"
                data-root=""
                onClick={() => popTo(0)}
              >
                {props.ariaLabel}
              </button>
              {drill.value.map((step, i) => (
                <span key={step.id} class="hk-treemap-stage__crumb-seg">
                  <span class="hk-treemap-stage__crumb-sep" aria-hidden="true">/</span>
                  <button
                    type="button"
                    class="hk-treemap-stage__crumb"
                    data-last={i === drill.value.length - 1 || undefined}
                    onClick={() => popTo(i + 1)}
                  >
                    {step.label}
                  </button>
                </span>
              ))}
            </nav>
          </header>
        )}
        <div class="hk-treemap-stage__body">
          <div
            ref={hostRef}
            class="hk-treemap-stage__canvas"
            role="application"
            aria-label={props.ariaLabel}
            onWheel={onWheel}
          >
            {hasData.value && (
              <div class="hk-treemap-stage__surface" style={surfaceStyle.value}>
                {cells.value.map((cell) => {
                  const { node, x, y, w, h } = cell;
                  const isGroup = cell.children.length > 0;
                  // The ladder reads the ZOOMED size: a zoomed-in rung
                  // pushes small cells over the label floors — the
                  // "detail appears when you zoom" contract.
                  const zw = w * (zoomPct.value / 100);
                  const zh = h * (zoomPct.value / 100);
                  const showValue = zh >= 40 && zw >= 56;
                  const showLabel = zh >= 18 && zw >= 24;
                  const frameStyle = {
                    position: "absolute" as const,
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${w}px`,
                    height: `${h}px`,
                  };
                  return (
                    <HkTooltip key={node.id} text={cellText(node)} placement="bottom" style={frameStyle}>
                      {() => (
                        <div
                          class={{
                            "hk-treemap__cell": true,
                            "hk-treemap__cell--group": isGroup,
                            "hk-treemap-stage__cell": true,
                            "hk-treemap-stage__cell--drillable": isGroup,
                          }}
                          style={{
                            inset: "0px",
                            background: node.color,
                            "--hk-treemap-fg": contrastTextColor(node.color),
                          }}
                          // Every cell is an activatable button (groups
                          // drill, leaves select) — keyboard parity with
                          // the mouse path (R2).
                          role="button"
                          tabindex={0}
                          aria-label={cellText(node)}
                          onClick={() => pushDrill(node)}
                          onKeydown={(e: KeyboardEvent) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              pushDrill(node);
                            }
                          }}
                        >
                          {isGroup ? (
                            <span class="hk-treemap__group-head">
                              <span class="hk-treemap__label hk-treemap__label--group">
                                {node.label}
                              </span>
                              {showValue && (
                                <span class="hk-treemap__meta">
                                  {formatValue(node.value)} · {formatHkTreemapPercent(node.percent)}
                                </span>
                              )}
                            </span>
                          ) : (
                            showLabel && (
                              <span class="hk-treemap__leaf-body">
                                <span class="hk-treemap__label">{node.label}</span>
                                {showValue && (
                                  <span class="hk-treemap__meta">
                                    {formatValue(node.value)} · {formatHkTreemapPercent(node.percent)}
                                  </span>
                                )}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </HkTooltip>
                  );
                })}
              </div>
            )}
            {!hasData.value && (
              <div class="hk-treemap__empty">{props.emptyText}</div>
            )}
          </div>
          {hasData.value && (
            <HkMinimap
              collapsible
              collapsed={minimapIsCollapsed.value}
              onUpdate:collapsed={onMinimapCollapsed}
              boxes={mmBoxes.value}
              zoom={mmZoom.value}
              panX={panX.value}
              panY={panY.value}
              viewportWidth={size.value?.w ?? 800}
              viewportHeight={size.value?.h ?? 600}
              contentBounds={mmContentBounds.value}
              zoomPercent={zoomPct.value}
              minZoomPercent={MIN_ZOOM}
              maxZoomPercent={MAX_ZOOM}
              zoomStepPercent={STEP_ZOOM}
              onZoomTo={(pct: number) => applyZoom(pct)}
              onPanDelta={(dx: number, dy: number) => applyPanDelta(dx, dy)}
            />
          )}
        </div>
      </div>
    );
  },
});
