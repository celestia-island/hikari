/**
 * HkBoard — the shared node-and-edge board surface.
 *
 * ONE world-camera canvas that every graph-like page builds on (history
 * topic maps, operations scenes, PLC panels, and whatever comes next). The
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
  BOARD_FIT_PAD,
  boardBBox,
  boardStepRung,
  quantizeBoardK,
  quantizeBoardPercentK,
  type BoardCamera,
  type BoardZoomLadder,
  type BoardPoint,
  type BoardRect,
  type BoardViewport,
} from "../utils/boardCamera";
import {
  boardAnchor,
  boardAnchorNormal,
  boardEdgeMidpoint,
  boardFanOrdinals,
  boardViaPath,
  type BoardAnchorMode,
  type BoardEdgeStyle,
  type BoardTangents,
} from "../utils/boardEdges";
import "./HkBoard.scss";
import { drawnScale } from "../composables/layoutGeometry";

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
  /** Paint-only node: the shell renders but pointer gestures pass straight
   *  through to the board. Subgraph cluster frames need this — a frame covers
   *  its members' surroundings, and it must not swallow the pan drag. */
  passthrough?: boolean;
  /** Opt in to pointer dragging (world-coord moves + `node-move` events). */
  draggable?: boolean;
  /** Page payload, handed back through the scoped slot. */
  data?: Record<string, unknown>;
}

/** Below twice the fit padding, `boardFit` has no room left after its own
 * padding: the board is unplaced (k = 0) until its container grows past it. */
const FIT_FLOOR_PX = BOARD_FIT_PAD * 2;

/** What a drag may do once the whole content is already in view. */
export type BoardPanMode = "clamp" | "float";

/** Unit vector from `p` toward `q` (the +x axis when the two coincide). */
function unitToward(p: BoardPoint, q: BoardPoint): BoardPoint {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  return len > 1e-9 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
}

/** Per-instance sequence for document-unique marker ids (url(#id)
 * resolves document-wide — two boards must never mint the same id). */
let boardInstanceCounter = 0;
function boardInstanceSeq(): number {
  boardInstanceCounter += 1;
  return boardInstanceCounter;
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
  /** Arrowhead at the `to` end: solid triangle, open chevron, or none
   * (the default — plain path, current behavior). */
  arrow?: "none" | "solid" | "open";
  /** Non-arrow adornment at the `to` end — mermaid's `--o` ring / `--x`
   *  cross. Drawn INSTEAD of the plain arrowhead when set. */
  headEnd?: "circle" | "cross";
  /** Adornment at the `from` end. Only `"arrow"` today: mermaid's `<-->`
   *  draws an arrowhead at both ends. */
  headStart?: "arrow";
  /** Caption painted at the path midpoint (mermaid edge labels, sequence
   * message text). Plain text — no markup, SVG <text> with a surface
   * halo so it stays legible over the path it names. */
  label?: string;
  /** Small caption at the FROM end, just off the border (mermaid class
   * multiplicities: `Student "1"` paints `1` near Student). */
  labelFrom?: string;
  /** Small caption at the TO end. */
  labelTo?: string;
}

// Ink colors ride INLINE STYLES beside the stroke presentation attribute:
// var() references in a presentation attribute are not substituted on every
// engine (Firefox drops the whole declaration → stroke:none → invisible
// edges; svgwg#1031, 2025-11: browsers still disagree). Same contract as
// HkGaugeRing/HkProgressRing.
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
    /** Let the overview fold to its map-icon affordance. */
    minimapCollapsible: { type: Boolean, default: false },
    /** Existing scene boards stay geometric; document diagrams can request
     * exact linear percent rungs. */
    zoomLadder: { type: String as PropType<BoardZoomLadder>, default: "geometric" },
    zoomStepPercent: { type: Number, default: 5 },
    /** `"clamp"` (default): content smaller than the viewport re-centers,
     *  so a fitted board cannot be dragged. `"float"`: it may be dragged
     *  while half of it stays in view — a diagram is content a reader
     *  may want to move aside, not a full-bleed scene. */
    pan: { type: String as PropType<BoardPanMode>, default: "clamp" },
    minK: { type: Number, default: 0.2 },
    maxK: { type: Number, default: 4 },
    /** Ceiling for the fit zoom (reset button, fitOnMount). The library
     *  default caps a fit at 1.25 so a small board never fills a huge
     *  viewport; a host that wants fill-the-stage framing passes a higher
     *  cap (the camera clamp still honours maxK). */
    fitCap: { type: Number, default: undefined },
    /** End-edge safe-area reserve for overlay chrome such as a minimap. */
    fitEndReserve: { type: Number, default: 0 },
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

    /** Content bbox (world) — nodes (hidden junctions included: a
     *  sequence diagram's rows live on them) plus a small margin. */
    const content = computed<BoardRect>(() => {
      const box = boardBBox(props.nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })), { points: true });
      return { x: box.x - 20, y: box.y - 20, w: box.w + 40, h: box.h + 40 };
    });

    const cam: ReturnType<typeof useBoardCamera> = useBoardCamera({
      viewportSize,
      content,
      minK: props.minK,
      maxK: props.maxK,
      animated: props.animated,
      fitCap: props.fitCap,
      fitEndReserve: props.fitEndReserve,
      zoomLadder: props.zoomLadder,
      zoomStepPercent: props.zoomStepPercent,
      smallContentPan: props.pan === "float" ? "keep" : "center",
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

    /** A point `dist` px from `from`, toward `to` (straight line). */
    const offsetToward = (from: BoardPoint, to: BoardPoint, dist: number): { x: number; y: number } => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist };
    };

    /** An end caption's anchor: `dist` px along the line from its border and
     *  `side` px OFF the shaft (perpendicular). On the shaft the caption
     *  crosses the arrow and is illegible (audit screenshot, 2026-11-28);
     *  off to one side it reads like mermaid's own placement. The two ends
     *  naturally land on opposite sides because their directions invert. */
    const offsetEnd = (from: BoardPoint, to: BoardPoint, dist: number, side: number): { x: number; y: number } => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      return { x: from.x + ux * dist - uy * side, y: from.y + uy * dist + ux * side };
    };

    const edgePaths = computed(() => {
      const rects = rectOf.value;
      const out: {
        id: string;
        d: string;
        ink: string;
        dashed: boolean;
        width: number;
        arrow: "none" | "solid" | "open";
        headEnd?: "circle" | "cross";
        headStart?: "arrow";
        label: string | null;
        labelAt: { x: number; y: number };
        labelFrom: string | null;
        labelFromAt: { x: number; y: number } | null;
        labelTo: string | null;
        labelToAt: { x: number; y: number } | null;
      }[] = [];
      for (const e of props.edges) {
        const from = rects.get(e.from);
        const to = rects.get(e.to);
        if (!from || !to) continue;
        const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
        const fan = fanOrdinal.value.get(e.id) ?? { index: 0, count: 1 };
        const edgeLen = Math.hypot(toCenter.x - fromCenter.x, toCenter.y - fromCenter.y);
        const a = boardAnchor(from, e.anchorFrom ?? "center", toCenter, fan.index, fan.count);
        const b = boardAnchor(to, e.anchorTo ?? "center", fromCenter, fan.index, fan.count);
        const viaCenters = (e.via ?? [])
          .map((id) => rects.get(id))
          .filter((r): r is BoardRect => Boolean(r))
          .map((r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 }));
        // Route tangents: a bezier must LEAVE the source and ARRIVE at the
        // target along the border normal of the anchor it sits on, because
        // that end tangent is what an `orient="auto"` arrowhead rotates to
        // (see the "Route tangents" note in utils/boardEdges.ts — with the
        // old always-horizontal tangent every top-down arrow pointed
        // sideways). Only the rect owner can tell which border that is;
        // a junction (zero-size rect) has none and falls back to the leg's
        // travel axis.
        const leave: BoardPoint = unitToward(a, viaCenters[0] ?? b);
        const arrive: BoardPoint = unitToward(viaCenters[viaCenters.length - 1] ?? a, b);
        // At the target the border is picked by the normal pointing AGAINST
        // the travel, and the route's own tangent is that normal's opposite
        // (it travels inward).
        const arriveOut = boardAnchorNormal(to, b, { x: -arrive.x, y: -arrive.y });
        const tangents: BoardTangents = {
          from: boardAnchorNormal(from, a, leave) ?? undefined,
          to: arriveOut ? { x: -arriveOut.x, y: -arriveOut.y } : undefined,
        };
        const style: BoardEdgeStyle = e.style ?? "orthogonal";
        // Label anchor: on the bezier itself (its parametric midpoint),
        // pulled onto the middle via leg when the route bends through
        // junctions (the sequence self-loop reads best with the caption
        // beside the jog).
        const mid = boardEdgeMidpoint(a, viaCenters, b, style, tangents);
        out.push({
          id: e.id,
          d: boardViaPath(a, viaCenters, b, style, tangents),
          ink: e.ink ?? DEFAULT_INK,
          dashed: Boolean(e.dashed),
          width: e.width ?? 1.5,
          arrow: e.arrow ?? "none",
          headEnd: e.headEnd,
          headStart: e.headStart,
          label: e.label && e.label !== "" ? e.label : null,
          labelAt: mid,
          // End captions sit OFF the shaft (perpendicular to the line): on it
          // they cross the arrow and are illegible (audit screenshot,
          // 2026-11-28). Short edges (adjacent classes) would stack them onto
          // the midpoint caption, so they step closer to the border and
          // further off the shaft as the edge shrinks.
          labelFrom: e.labelFrom ?? null,
          labelFromAt: e.labelFrom
            ? offsetEnd(a, b, edgeLen > 90 ? 14 : 8, edgeLen > 90 ? 12 : 16)
            : null,
          labelTo: e.labelTo ?? null,
          labelToAt: e.labelTo
            ? offsetEnd(b, a, edgeLen > 90 ? 14 : 8, edgeLen > 90 ? 12 : 16)
            : null,
        });
      }
      return out;
    });

    /** One marker per (kind, ink) pair actually used — marker fill cannot
     * follow the referencing stroke on every engine hikari supports, so
     * the defs are minted from the edge list (deterministic, in edge
     * order) instead of trusting `context-stroke`. Ids carry a per-BOARD
     * sequence: `url(#id)` resolves document-wide, and two mounted boards
     * minting `hk-board-ah-0` each would cross-wire their arrowheads. */
    const boardSeq = boardInstanceSeq();
    // Every adornment an edge can carry at an end: the two arrowheads plus
    // mermaid's ring (`--o`) and cross (`--x`). They share one <defs> pool
    // keyed by (kind, ink) so a diagram with many such edges emits each
    // marker once.
    type MarkerKind = "solid" | "open" | "circle" | "cross";
    const edgeMarkers = computed(() => {
      const index = new Map<string, number>();
      const add = (kind: MarkerKind, ink: string): void => {
        const key = `${kind}\u0000${ink}`;
        if (!index.has(key)) index.set(key, index.size);
      };
      for (const e of edgePaths.value) {
        if (e.arrow !== "none") add(e.arrow, e.ink);
        if (e.headEnd) add(e.headEnd, e.ink);
        // `<-->` draws an ordinary arrow at the source end too.
        if (e.headStart) add("solid", e.ink);
      }
      return [...index.entries()].map(([key, i]) => {
        const [kind, ink] = key.split("\u0000");
        return { id: `hk-board-ah-${boardSeq}-${i}`, kind: kind as MarkerKind, ink };
      });
    });

    const markerRef = (kind: MarkerKind, ink: string): string | undefined => {
      const idx = edgeMarkers.value.findIndex((m) => m.kind === kind && m.ink === ink);
      return idx >= 0 ? `url(#hk-board-ah-${boardSeq}-${idx})` : undefined;
    };

    const markerOf = (kind: "none" | "solid" | "open", ink: string): string | undefined => {
      if (kind === "none") return undefined;
      return markerRef(kind, ink);
    };

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
    // During an animated zoom the world passes through intermediate scales,
    // but a percent-governed toolbar still displays a rung label rather than
    // arbitrary values such as 87% between 85% and 90%.
    const displayedZoomPercent = computed(() => props.zoomLadder === "percent"
      ? Math.round(quantizeBoardPercentK(camera.value.k, {
          stepPercent: props.zoomStepPercent,
          minK: props.minK,
          maxK: props.maxK,
        }) * 100)
      : Math.round(camera.value.k * 100));

    // ── gestures ────────────────────────────────────────────────────────
    const pointers = new Map<number, { x: number; y: number }>();
    let panState: { px: number; py: number } | null = null;
    let pinchBase: { cam: BoardCamera; dist: number; mid: BoardPoint } | null = null;
    let dragState: { node: BoardNodeInput; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
    // Every node press is tracked (draggable or not) so read-only boards
    // — operations scenes, mind maps — still get `nodeClick` on a short tap.
    let pressed: { id: string; pointerId: number; x: number; y: number } | null = null;

    /** How many of the board's own pixels one DRAWN pixel is worth: the
     *  camera and every anchor live in the board's local CSS pixels while the
     *  pointer arrives in drawn ones, and a scaled or zoomed root separates
     *  the two (see `layoutGeometry`). */
    const pxScale = (): number => {
      const el = viewportRef.value;
      if (!el) return 1;
      const scale = drawnScale(el);
      const factor = el.offsetWidth > 0 ? scale.x : el.offsetHeight > 0 ? scale.y : 1;
      return factor > 0 ? factor : 1;
    };

    const localPoint = (e: PointerEvent | WheelEvent): BoardPoint => {
      const el = viewportRef.value;
      const rect = el?.getBoundingClientRect();
      const k = pxScale();
      return { x: (e.clientX - (rect?.left ?? 0)) / k, y: (e.clientY - (rect?.top ?? 0)) / k };
    };

    function onWheel(e: WheelEvent): void {
      if (!props.interactive) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      cam.zoomByFactor(factor, localPoint(e));
    }

    /** One-way latch: set by the first call the HOST makes into the camera
     *  through `expose` (`fit`, `reset`, `zoomIn`, `zoomOut`, `zoomToPercent`).
     *  Any such call — a single zoom included — means the framing is the
     *  host's, so the late recovery fit below must not take it back. The
     *  board's own chrome (the minimap reset) does not trip it: that is the
     *  component's UI, not a host decision. */
    let hostOwnsCamera = false;

    function refreshSize(): void {
      const el = viewportRef.value;
      if (!el) return;
      const next = { w: el.clientWidth, h: el.clientHeight };
      // "Unplaced" is the fit's own notion of no room: below twice the fit
      // padding there is nothing left to frame into, so a fit on that box
      // yields k = 0 and paints nothing. That covers a 0×0 hidden container
      // AND the collapsed flex item measured on the docs hub (2px, its
      // borders only) — a `w > 0` test would have missed the real case.
      const unplaced = (s: BoardViewport): boolean => s.w <= FIT_FLOOR_PX || s.h <= FIT_FLOOR_PX;
      const wasUnplaced = unplaced(viewportSize.value);
      viewportSize.value = next;
      // A board can mount before its container has a box: a hidden tab, a
      // collapsed panel, a card whose own parent is still unmounted. The
      // mount fit then frames against nothing and the camera stayed there
      // forever — the diagram/chart only appeared after a manual reset.
      // Re-fit on the FIRST size that follows an unplaced one; ordinary
      // resizes keep the reader's camera, and a host that drives the camera
      // itself keeps it too.
      if (wasUnplaced && props.fitOnMount && !hostOwnsCamera) {
        cam.fit();
      }
    }

    let resizeObs: ResizeObserver | null = null;

    /** Snapshot the camera + current finger pair as the pinch baseline —
     *  at gesture start, or whenever the pair's composition changes — so
     *  the scale keeps following the fingers 1:1 without a jump. */
    function rearmPinch(): void {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      pinchBase = {
        cam: { ...camera.value },
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: localPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 } as PointerEvent),
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
        const mid = localPoint({
          clientX: (a.x + b.x) / 2,
          clientY: (a.y + b.y) / 2,
        } as PointerEvent);
        pinchBase.mid = mid;
        cam.pinchZoom(pinchBase.cam, dist / pinchBase.dist, mid);
        return;
      }
      if (dragState) {
        // The node lives in WORLD units: the drawn delta comes down through
        // the ancestor scale and then through the camera's own zoom.
        const k = (camera.value.k || 1) * pxScale();
        const dx = (e.clientX - dragState.sx) / k;
        const dy = (e.clientY - dragState.sy) / k;
        if (Math.abs(e.clientX - dragState.sx) + Math.abs(e.clientY - dragState.sy) > 3) dragState.moved = true;
        dragState.node.x = Math.round(dragState.ox + dx);
        dragState.node.y = Math.round(dragState.oy + dy);
        emit("nodeMove", dragState.node, dragState.node.x, dragState.node.y);
        return;
      }
      if (panState) {
        const k = pxScale();
        cam.panBy((e.clientX - panState.px) / k, (e.clientY - panState.py) / k);
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
      fit: () => {
        hostOwnsCamera = true;
        cam.fit();
      },
      zoomIn: () => {
        hostOwnsCamera = true;
        cam.zoomIn();
      },
      zoomOut: () => {
        hostOwnsCamera = true;
        cam.zoomOut();
      },
      zoomToPercent: (p: number, anchor?: BoardPoint) => {
        hostOwnsCamera = true;
        cam.zoomToPercent(p, anchor);
      },
      reset: () => {
        hostOwnsCamera = true;
        cam.fit();
      },
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
            <defs>
              {edgeMarkers.value.map((m) => {
                // The arrowheads keep the family's 10×8 box pinned at the line
                // end; the ring and the cross are centred ON that end (a ring
                // that trailed the line would read as a separate dot).
                if (m.kind === "circle") {
                  return (
                    <marker
                      key={m.id}
                      id={m.id}
                      viewBox="0 0 10 10"
                      refX={5}
                      refY={5}
                      markerWidth={10}
                      markerHeight={10}
                      markerUnits="userSpaceOnUse"
                      orient="auto"
                    >
                      <circle
                        cx={5}
                        cy={5}
                        r={3.6}
                        // `var()` in a PRESENTATION ATTRIBUTE is not
                        // substituted on every engine (the family rule this
                        // file's ink notes spell out) — the halo fill rides an
                        // inline style like every other token here.
                        style={{ fill: "rgb(var(--color-surface, 255 255 255))" }}
                        stroke={m.ink}
                        stroke-width={1.5}
                      />
                    </marker>
                  );
                }
                if (m.kind === "cross") {
                  return (
                    <marker
                      key={m.id}
                      id={m.id}
                      viewBox="0 0 10 10"
                      refX={5}
                      refY={5}
                      markerWidth={10}
                      markerHeight={10}
                      markerUnits="userSpaceOnUse"
                      orient="auto"
                    >
                      <path
                        d="M1.5,1.5 L8.5,8.5 M8.5,1.5 L1.5,8.5"
                        fill="none"
                        stroke={m.ink}
                        stroke-width={1.5}
                        stroke-linecap="round"
                      />
                    </marker>
                  );
                }
                return (
                  <marker
                    key={m.id}
                    id={m.id}
                    viewBox="0 0 10 8"
                    refX={9}
                    refY={4}
                    markerWidth={10}
                    markerHeight={8}
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    {m.kind === "solid"
                      ? <path d="M0,0 L10,4 L0,8 Z" fill={m.ink} />
                      : <path d="M0,0 L10,4 L0,8" fill="none" stroke={m.ink} stroke-width={1.5} stroke-linecap="round" />}
                  </marker>
                );
              })}
            </defs>
            {edgePaths.value.map((e) => (
              <g key={e.id}>
                <path
                  class="hk-board-edge"
                  d={e.d}
                  stroke={e.ink}
                  style={{ stroke: e.ink }}
                  stroke-width={e.width}
                  stroke-dasharray={e.dashed ? "6 5" : undefined}
                  fill="none"
                  stroke-linecap="round"
                  marker-end={e.headEnd ? markerRef(e.headEnd, e.ink) : markerOf(e.arrow, e.ink)}
                  marker-start={e.headStart ? markerRef("solid", e.ink) : undefined}
                />
                {e.label !== null && (
                  <text
                    class="hk-board-edge-label"
                    x={e.labelAt.x}
                    y={e.labelAt.y}
                    text-anchor="middle"
                    dominant-baseline="middle"
                  >
                    {e.label}
                  </text>
                )}
                {e.labelFrom !== null && e.labelFromAt !== null && (
                  <text
                    class="hk-board-edge-endlabel"
                    x={e.labelFromAt.x}
                    y={e.labelFromAt.y}
                    text-anchor="middle"
                    dominant-baseline="middle"
                  >
                    {e.labelFrom}
                  </text>
                )}
                {e.labelTo !== null && e.labelToAt !== null && (
                  <text
                    class="hk-board-edge-endlabel"
                    x={e.labelToAt.x}
                    y={e.labelToAt.y}
                    text-anchor="middle"
                    dominant-baseline="middle"
                  >
                    {e.labelTo}
                  </text>
                )}
              </g>
            ))}
          </svg>
          {props.nodes.filter((n) => !n.hidden).map((n) => (
            <div
              key={n.id}
              class={[
                "hk-board-node",
                {
                  "hk-board-node--draggable": Boolean(n.draggable),
                  "hk-board-node--passthrough": Boolean(n.passthrough),
                },
                n.kind ? `hk-board-node--${n.kind}` : undefined,
              ]}
              style={{ left: `${n.x}px`, top: `${n.y}px`, width: `${n.w}px`, height: `${n.h}px` }}
              onPointerdown={(e: PointerEvent) => onNodePointerDown(e, n)}
            >
              {slots.node
                ? slots.node({ node: n })
                : <div class="hk-board-node-shell">{n.label ?? ""}</div>}
              {slots.nodeActions
                ? (
                  <div
                    class="hk-board-node-actions"
                    // A press that starts on an action belongs to that
                    // action: this component captures the pointer on its own
                    // root for every draggable node, and a captured press
                    // retargets the following events to the ancestor — an
                    // action button's own click would never fire. Stopping
                    // the bubble here is the same guard HkMinimap puts on
                    // its zoom chrome. The keydown twin keeps a focused
                    // action's Enter/Space from reaching the node's own key
                    // handling.
                    onPointerdown={(e: PointerEvent) => e.stopPropagation()}
                    onKeydown={(e: KeyboardEvent) => e.stopPropagation()}
                  >
                    {slots.nodeActions({ node: n })}
                  </div>
                )
                : null}
            </div>
          ))}
        </div>
        {props.minimap && (
          // Slider drags arrive as ABSOLUTE rung targets — land the camera
          // on the thumb's rung exactly (boardStepRung's directional push
          // is only for the ± buttons' relative steps).
          <div class="hk-board-minimap">
            <HkMinimap
              boxes={minimapBoxes.value}
              zoom={camera.value.k}
              panX={camera.value.x}
              panY={camera.value.y}
              viewportWidth={viewportSize.value.w}
              viewportHeight={viewportSize.value.h}
              contentBounds={contentBounds.value}
              zoomPercent={displayedZoomPercent.value}
              canZoomIn={camera.value.k < props.maxK}
              canZoomOut={camera.value.k > props.minK}
              zoomStepPercent={props.zoomStepPercent}
              minZoomPercent={Math.round(props.minK * 100)}
              maxZoomPercent={Math.round(props.maxK * 100)}
              showReset
              collapsible={props.minimapCollapsible}
              onZoomTo={(percent: number, source?: "slider" | "step") =>
                props.zoomLadder === "percent"
                  ? cam.zoomToPercent(percent)
                  : cam.zoomToK(source === "slider"
                    ? quantizeBoardK(percent / 100)
                    : boardStepRung(camera.value.k, percent / 100))}
              onReset={() => cam.fit()}
              onPanDelta={(dx: number, dy: number) => cam.panBy(dx, dy)}
            />
          </div>
        )}
      </div>
    );
  },
});
