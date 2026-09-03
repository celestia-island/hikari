/**
 * HkBoard — the shared node-and-edge board surface.
 *
 * ONE world-camera canvas that every graph-like page builds on (history
 * topic maps, SCADA scenes, PLC panels, and whatever comes next). The
 * board owns the motion feel and the chrome; the page owns the layout:
 *
 *  - CAMERA: 5% geometric zoom ladder with an ANIMATED settle (no snapping),
 *    wheel zoom anchored at the pointer (desktop), two-finger pinch
 *    (touch, continuous while pinching → animated rung on release),
 *    clamped background pan, fit/reset;
 *  - GRID: the engineering dot grid is always on and world-anchored —
 *    it scales and translates with the camera so it doubles as an
 *    alignment aid;
 *  - NODES: DOM shells positioned in world coords, rendered through the
 *    `node` scoped slot (a labeled shell is provided when the slot is
 *    omitted). `draggable` nodes move in world coords and emit
 *    `node-move`; `hidden` nodes paint NOTHING but still route edges —
 *    that is how a page bakes a right-angle corner into its graph;
 *  - EDGES: SVG paths with independently configurable anchor modes
 *    (center / nearest / top / top-left / fan-天女散花) and route styles
 *    (straight / bezier / orthogonal / spine), optionally routed through
 *    `via` junction nodes (see utils/boardEdges.ts);
 *  - MINIMAP: HkMinimap pinned bottom-right, wired to the same camera.
 *
 * The page supplies `nodes` (world rects, reactive) and `edges`; node
 * LAYOUT stays the page's business — the board never forces an
 * arrangement, it only standardizes how things connect and move.
 */

import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  toRef,
  watch,
  type PropType,
  type Ref,
} from "vue";

import { useBoardCamera } from "../composables/useBoardCamera";
import HkMinimap, { type MinimapBox } from "./HkMinimap";
import {
  boardBBox,
  boardStepRung,
  type BoardCamera,
  type BoardPoint,
  type BoardRect,
  type BoardViewport,
} from "../utils/boardCamera";
import {
  boardAnchor,
  boardEdgePath,
  boardFanOrdinals,
  boardViaPath,
  type BoardAnchorMode,
  type BoardEdgeStyle,
} from "../utils/boardEdges";
import "./HkBoard.scss";

/**
 * A node on the board. `hidden` nodes are junction-only (invisible).
 * During a node drag the board mutates the node objects IN PLACE and
 * emits the live reference through `node-move` / `nodeClick` — pass
 * deep-reactive, mutable node objects, not frozen copies.
 */
export interface BoardNodeInput {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  kind?: string;
  /** Invisible junction node — routes edges, paints nothing. */
  hidden?: boolean;
  /** Opt in to pointer dragging (world-coord moves + `node-move` events). */
  draggable?: boolean;
  /** Page payload, handed back through the scoped slot. */
  data?: Record<string, unknown>;
}

export interface BoardEdgeInput {
  id: string;
  from: string;
  to: string;
  /** Junction node ids the edge routes through (their centers). */
  via?: string[];
  style?: BoardEdgeStyle;
  anchorFrom?: BoardAnchorMode;
  anchorTo?: BoardAnchorMode;
  ink?: string;
  dashed?: boolean;
  width?: number;
}

const DEFAULT_INK = "rgb(var(--color-primary) / 38%)";

export default defineComponent({
  name: "HkBoard",
  props: {
    nodes: { type: Array as PropType<BoardNodeInput[]>, default: () => [] },
    edges: { type: Array as PropType<BoardEdgeInput[]>, default: () => [] },
    /** Wire wheel / pinch / pan gestures (node clicks always work). */
    interactive: { type: Boolean, default: true },
    grid: { type: Boolean, default: true },
    gridSize: { type: Number, default: 24 },
    minimap: { type: Boolean, default: true },
    minK: { type: Number, default: 0.2 },
    maxK: { type: Number, default: 4 },
    animated: { type: Boolean, default: true },
    fitOnMount: { type: Boolean, default: true },
  },
  emits: {
    nodeClick: (_node: BoardNodeInput) => true,
    nodeMove: (_node: BoardNodeInput, _x: number, _y: number) => true,
    viewportChange: (_cam: BoardCamera) => true,
  },
  setup(props, { emit, expose, slots }) {
    const viewportRef = ref<HTMLElement | null>(null);
    const viewportSize = ref<BoardViewport>({ w: 800, h: 600 });

    /** Content bbox (world) — nodes plus a small margin. */
    const content = computed<BoardRect>(() => {
      const box = boardBBox(props.nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })));
      return { x: box.x - 20, y: box.y - 20, w: box.w + 40, h: box.h + 40 };
    });

    const cam: ReturnType<typeof useBoardCamera> = useBoardCamera({
      viewportSize,
      content,
      minK: props.minK,
      maxK: props.maxK,
      animated: props.animated,
    });
    const camera = cam.camera as Ref<BoardCamera>;

    // ── geometry ────────────────────────────────────────────────────────
    const rectOf = computed(() => {
      const map = new Map<string, BoardRect>();
      for (const n of props.nodes) map.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h });
      return map;
    });

    /** Edges sharing a `from` node fan across its border (天女散花). */
    const fanOrdinal = computed(() => boardFanOrdinals(props.edges));

    const edgePaths = computed(() => {
      const rects = rectOf.value;
      const out: { id: string; d: string; ink: string; dashed: boolean; width: number }[] = [];
      for (const e of props.edges) {
        const from = rects.get(e.from);
        const to = rects.get(e.to);
        if (!from || !to) continue;
        const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
        const fan = fanOrdinal.value.get(e.id) ?? { index: 0, count: 1 };
        const a = boardAnchor(from, e.anchorFrom ?? "center", toCenter, fan.index, fan.count);
        const b = boardAnchor(to, e.anchorTo ?? "center", fromCenter, fan.index, fan.count);
        const viaCenters = (e.via ?? [])
          .map((id) => rects.get(id))
          .filter((r): r is BoardRect => Boolean(r))
          .map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }));
        out.push({
          id: e.id,
          d: boardViaPath(a, viaCenters, b, e.style ?? "orthogonal"),
          ink: e.ink ?? DEFAULT_INK,
          dashed: Boolean(e.dashed),
          width: e.width ?? 1.5,
        });
      }
      return out;
    });

    const contentBounds = computed(() => content.value);

    const worldStyle = computed(() => ({
      transform: `translate(${camera.value.x}px, ${camera.value.y}px) scale(${camera.value.k})`,
      width: `${contentBounds.value.w}px`,
      height: `${contentBounds.value.h}px`,
    }));

    const gridStyle = computed(() => {
      if (!props.grid) return { display: "none" };
      const s = props.gridSize * camera.value.k;
      return {
        backgroundImage: "radial-gradient(rgb(var(--color-text) / 12%) 1px, transparent 1px)",
        backgroundSize: `${s}px ${s}px`,
        backgroundPosition: `${camera.value.x}px ${camera.value.y}px`,
      };
    });

    const minimapBoxes = computed<MinimapBox[]>(() =>
      props.nodes
        .filter((n) => !n.hidden)
        .map((n) => ({
          id: n.id,
          bounds: { x: n.x, y: n.y, w: n.w, h: n.h },
          color: "rgb(var(--color-primary) / 40%)",
        })),
    );

    // ── gestures ────────────────────────────────────────────────────────
    const pointers = new Map<number, { x: number; y: number }>();
    let panState: { px: number; py: number } | null = null;
    let pinchBase: { cam: BoardCamera; dist: number; mid: BoardPoint } | null = null;
    let dragState: { node: BoardNodeInput; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
    // Every node press is tracked (draggable or not) so read-only boards
    // — SCADA scenes, mind maps — still get `nodeClick` on a short tap.
    let pressed: { id: string; pointerId: number; x: number; y: number } | null = null;

    const localPoint = (e: PointerEvent | WheelEvent): BoardPoint => {
      const rect = viewportRef.value?.getBoundingClientRect();
      return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
    };

    function onWheel(e: WheelEvent): void {
      if (!props.interactive) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      cam.zoomByFactor(factor, localPoint(e));
    }

    function refreshSize(): void {
      const el = viewportRef.value;
      if (!el) return;
      viewportSize.value = { w: el.clientWidth, h: el.clientHeight };
    }

    let resizeObs: ResizeObserver | null = null;

    /** Snapshot the camera + current finger pair as the pinch baseline —
     *  at gesture start, or whenever the pair's composition changes — so
     *  the scale keeps following the fingers 1:1 without a jump. */
    function rearmPinch(): void {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      const rect = viewportRef.value?.getBoundingClientRect();
      pinchBase = {
        cam: { ...camera.value },
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: {
          x: (a.x + b.x) / 2 - (rect?.left ?? 0),
          y: (a.y + b.y) / 2 - (rect?.top ?? 0),
        },
      };
    }

    function onPointerDown(e: PointerEvent): void {
      if (!props.interactive) return;
      // Defensive prune: tracked pointers no gesture is using are stale
      // (their up/cancel AND capture loss were both lost) — drop them so
      // the next single-finger touch cannot become a phantom pinch.
      if (pointers.size > 0 && !pinchBase && !panState && !dragState) pointers.clear();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Capture EVERY finger: up/cancel are only guaranteed while capture
      // holds, and an uncaptured pinch finger would never leave `pointers`.
      viewportRef.value?.setPointerCapture(e.pointerId);
      if (pointers.size === 1) {
        panState = { px: e.clientX, py: e.clientY };
      } else if (pointers.size === 2) {
        // pinch begins: snapshot camera + finger geometry, suspend panning
        rearmPinch();
        panState = null;
      }
    }

    function onPointerMove(e: PointerEvent): void {
      if (!props.interactive) return;
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchBase && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const rect = viewportRef.value?.getBoundingClientRect();
        const mid = {
          x: (a.x + b.x) / 2 - (rect?.left ?? 0),
          y: (a.y + b.y) / 2 - (rect?.top ?? 0),
        };
        pinchBase.mid = mid;
        cam.pinchZoom(pinchBase.cam, dist / pinchBase.dist, mid);
        return;
      }
      if (dragState) {
        const k = camera.value.k || 1;
        const dx = (e.clientX - dragState.sx) / k;
        const dy = (e.clientY - dragState.sy) / k;
        if (Math.abs(e.clientX - dragState.sx) + Math.abs(e.clientY - dragState.sy) > 3) dragState.moved = true;
        dragState.node.x = Math.round(dragState.ox + dx);
        dragState.node.y = Math.round(dragState.oy + dy);
        emit("nodeMove", dragState.node, dragState.node.x, dragState.node.y);
        return;
      }
      if (panState) {
        cam.panBy(e.clientX - panState.px, e.clientY - panState.py);
        panState = { px: e.clientX, py: e.clientY };
      }
    }

    function onPointerUp(e: PointerEvent): void {
      const press = pressed;
      pressed = null;
      dragState = null;
      retirePointer(e.pointerId);
      // nodeClick: a press that belongs to THIS pointer and stayed within
      // the drag slop clicks — regardless of `draggable`.
      if (press && press.pointerId === e.pointerId
        && Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) < 3) {
        const node = props.nodes.find((n) => n.id === press.id);
        if (node) emit("nodeClick", node);
      }
    }

    function onPointerCancel(e: PointerEvent): void {
      // An aborted gesture must never synthesize a click: prune state only.
      pressed = null;
      dragState = null;
      retirePointer(e.pointerId);
    }

    /** A pointer left the gesture (up, cancel, or capture loss): prune it,
     *  re-baseline or settle the pinch, and hand panning to any surviving
     *  pointer so a pinch that ends with one finger down keeps panning. */
    function retirePointer(pointerId: number): void {
      if (!pointers.delete(pointerId)) return;
      if (pinchBase && pointers.size >= 2) {
        // The pinch pair composition changed (a finger lifted while two
        // or more remain): re-baseline onto the surviving pair.
        rearmPinch();
        return;
      }
      if (pinchBase) {
        const mid = pinchBase.mid;
        pinchBase = null;
        cam.settlePinch(mid);
      }
      const rest = pointers.values().next().value;
      panState = rest ? { px: rest.x, py: rest.y } : null;
    }

    /** Capture-loss backstop: up/cancel are only guaranteed while pointer
     *  capture holds; a pointer that was released without an up is pruned
     *  here — otherwise the next single-finger touch would silently become
     *  a phantom pinch. The event fires on the capture target and does not
     *  bubble, hence the capture-phase listener; after a normal up it is a
     *  no-op (the pointer was already pruned there). */
    function onLostPointerCapture(e: PointerEvent): void {
      pressed = null;
      dragState = null;
      retirePointer(e.pointerId);
    }

    function onNodePointerDown(e: PointerEvent, node: BoardNodeInput): void {
      pressed = { id: node.id, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      // Draggable nodes own the gesture (no board pan); every other press
      // bubbles on so the board can pan — and still click on a short tap.
      if (!props.interactive || !node.draggable) return;
      e.stopPropagation();
      dragState = { node, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y, moved: false };
      viewportRef.value?.setPointerCapture(e.pointerId);
    }

    watch(() => camera.value, (c) => emit("viewportChange", { ...c }), { deep: true });
    watch(toRef(props, "nodes"), () => {
      // content growth invalidates clamping — re-clamp against the new bbox
      cam.setCamera({ ...camera.value });
    });

    onMounted(() => {
      refreshSize();
      resizeObs = new ResizeObserver(refreshSize);
      if (viewportRef.value) resizeObs.observe(viewportRef.value);
      viewportRef.value?.addEventListener("wheel", onWheel, { passive: false });
      // Capture phase: lostpointercapture does not bubble and fires on the
      // element that held capture.
      viewportRef.value?.addEventListener("lostpointercapture", onLostPointerCapture, true);
      if (props.fitOnMount) cam.fit();
    });

    onBeforeUnmount(() => {
      cam.stop(); // kill any in-flight tween rAF
      resizeObs?.disconnect();
      viewportRef.value?.removeEventListener("wheel", onWheel);
      viewportRef.value?.removeEventListener("lostpointercapture", onLostPointerCapture, true);
    });

    expose({
      fit: () => cam.fit(),
      zoomIn: () => cam.zoomIn(),
      zoomOut: () => cam.zoomOut(),
      zoomToPercent: (p: number, anchor?: BoardPoint) => cam.zoomToPercent(p, anchor),
      reset: () => cam.fit(),
      camera,
    });

    return () => (
      <div
        class="hk-board"
        ref={viewportRef}
        onPointerdown={onPointerDown}
        onPointermove={onPointerMove}
        onPointerup={onPointerUp}
        onPointercancel={onPointerCancel}
      >
        <div class="hk-board-grid" style={gridStyle.value} />
        <div class="hk-board-world" style={worldStyle.value}>
          <svg class="hk-board-edges" width={contentBounds.value.w} height={contentBounds.value.h}>
            {edgePaths.value.map((e) => (
              <path
                key={e.id}
                class="hk-board-edge"
                d={e.d}
                stroke={e.ink}
                stroke-width={e.width}
                stroke-dasharray={e.dashed ? "6 5" : undefined}
                fill="none"
                stroke-linecap="round"
              />
            ))}
          </svg>
          {props.nodes.filter((n) => !n.hidden).map((n) => (
            <div
              key={n.id}
              class={[
                "hk-board-node",
                { "hk-board-node--draggable": Boolean(n.draggable) },
                n.kind ? `hk-board-node--${n.kind}` : undefined,
              ]}
              style={{ left: `${n.x}px`, top: `${n.y}px`, width: `${n.w}px`, height: `${n.h}px` }}
              onPointerdown={(e: PointerEvent) => onNodePointerDown(e, n)}
            >
              {slots.node
                ? slots.node({ node: n })
                : <div class="hk-board-node-shell">{n.label ?? ""}</div>}
            </div>
          ))}
        </div>
        {props.minimap && (
          <div class="hk-board-minimap">
            <HkMinimap
              boxes={minimapBoxes.value}
              zoom={camera.value.k}
              panX={camera.value.x}
              panY={camera.value.y}
              viewportWidth={viewportSize.value.w}
              viewportHeight={viewportSize.value.h}
              contentBounds={contentBounds.value}
              zoomPercent={Math.round(camera.value.k * 100)}
              canZoomIn={camera.value.k < props.maxK}
              canZoomOut={camera.value.k > props.minK}
              zoomStepPercent={5}
              minZoomPercent={Math.round(props.minK * 100)}
              maxZoomPercent={Math.round(props.maxK * 100)}
              showReset
              onZoomTo={(percent: number) => cam.zoomToK(boardStepRung(camera.value.k, percent / 100))}
              onReset={() => cam.fit()}
              onPanDelta={(dx: number, dy: number) => cam.panBy(dx, dy)}
            />
          </div>
        )}
      </div>
    );
  },
});
