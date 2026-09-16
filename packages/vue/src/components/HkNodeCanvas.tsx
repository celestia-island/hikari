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

/** Movement (px) a pointer must travel before it stops being a tap. */
const PAN_SLOP = 6;

/** How long a request made of a controlled host stays in flight before the host
 *  is presumed not to have applied it. Long enough for an async write-back (a
 *  store behind an RPC queue answers late), short enough that a request the
 *  host dropped cannot become the camera the next gesture composes from — or
 *  leave `fit()` refusing for ever. */
const REQUEST_GRACE_MS = 250;

/** How many unanswered requests are remembered. A drag asks once per pointer
 *  move, so an in-order echo can lag by a second's worth and still be named. */
const MAX_PENDING_REQUESTS = 64;

/** A camera asked of a controlled host that it has not answered yet. */
interface PendingRequest {
  camera: NodeCanvasCamera;
  /** A `fit()` request: absolute and one-off, unlike a gesture's relative move. */
  framing: boolean;
  /** When it was written, so a request nobody answered can expire. */
  at: number;
}

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
    /** Frame the content immediately instead of starting at 1:1.
     *
     *  Only the component's OWN camera is framed: a host that passes `camera`
     *  owns the view and calls `fit()` when it wants one. Automatic framing
     *  also stops for good once the camera has been moved by hand — a gesture,
     *  or an imperative `zoomBy`/`panBy`/`setCamera` — so a late `contentBounds`
     *  cannot throw the user's view away; `fit()` stays available to re-frame
     *  on demand. */
    fitOnLoad: { type: Boolean, default: true },
    /** Also frame a host-supplied `camera`, which is otherwise left alone: the
     *  host owns that camera and calls `fit()` when it wants one. Opt in when
     *  the host wants the component to seed the first frame anyway — framing
     *  still stops as soon as the camera is moved by hand. */
    fitControlled: { type: Boolean, default: false },
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
    let panning: {
      pointerId: number;
      x: number;
      y: number;
      startX: number;
      startY: number;
      captured: boolean;
    } | null = null;
    /** Set by setCamera (gestures and imperative calls) — never by `fit`. */
    let movedByHand = false;

    const camera = computed<NodeCanvasCamera>(() => props.camera ?? inner.value);

    /** Snap a zoom factor onto the grid, then into range. `quantizeScaleStep`
     *  in the scada module does the same thing; the base view carries the
     *  rule rather than the consumer. */
    function normalizeZoom(k: number): number {
      const step = props.zoomGridStep;
      const snapped = step > 0 ? Math.round(k / step) * step : k;
      return clamp(Number(snapped.toFixed(6)), props.minZoom, props.maxZoom);
    }

    /** Whether two cameras describe the same view. */
    function sameCamera(a: NodeCanvasCamera, b: NodeCanvasCamera) {
      return a.k === b.k && a.x === b.x && a.y === b.y;
    }

    /** The requests made of a controlled host that it has not answered yet,
     *  newest first. A drag asks once per pointer move, and a store behind a
     *  queue echoes them in order: only by naming the request a write belongs
     *  to can a host that is still catching up be told from one that answered
     *  the newest ask. */
    let pending: PendingRequest[] = [];
    /** Set once the host answers a request — it applies what it is asked to. */
    let hostApplied = false;
    /** The newest camera asked of the host. Repeating it is pointless while the
     *  host has not moved anywhere, and required as soon as it has. */
    let lastRequested: NodeCanvasCamera | null = null;

    /** Write a camera through to the host (controlled) or the local state.
     *  `framing` marks a `fit()` request: it is absolute and one-off, so it is
     *  never part of the gesture chain a drag composes from. */
    function writeCamera(normalized: NodeCanvasCamera, framing = false) {
      if (props.camera) {
        lastRequested = normalized;
        pending.unshift({ camera: normalized, framing, at: Date.now() });
        if (pending.length > MAX_PENDING_REQUESTS) pending.length = MAX_PENDING_REQUESTS;
        emit("update:camera", normalized);
      } else {
        inner.value = normalized;
      }
    }

    function setCamera(next: NodeCanvasCamera) {
      const k = normalizeZoom(next.k);
      // A host camera with a zero or non-finite scale turns every coordinate
      // derived from it into Infinity, and the browser drops the transform —
      // the surface freezes with no way back. Refuse to propagate it.
      if (!Number.isFinite(k) || k <= 0) return;
      if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return;
      // Any non-automatic camera move is the user's: a late `contentBounds`
      // must not throw that work away. It also means the host is somewhere
      // else, so a later `fit()` may ask for the same camera again.
      movedByHand = true;
      lastRequested = null;
      writeCamera({ k, x: next.x, y: next.y });
    }

    /** The camera that frames `contentBounds` inside the viewport. */
    function computeFit(): NodeCanvasCamera {
      const bounds = props.contentBounds;
      const { width, height } = viewport.value;
      if (
        !bounds ||
        !(bounds.width > 0) ||
        !(bounds.height > 0) ||
        !Number.isFinite(bounds.x) ||
        !Number.isFinite(bounds.y) ||
        !Number.isFinite(bounds.width) ||
        !Number.isFinite(bounds.height) ||
        !(width > 0) ||
        !(height > 0)
      ) {
        return camera.value;
      }
      const pad = props.fitPadding;
      // Snap FIRST: the translation below has to be derived from the k that is
      // actually rendered, or the content lands off-centre and a tall graph can
      // run past the viewport edge.
      const step = props.zoomGridStep;
      const raw = clamp(
        Math.min((width - pad * 2) / bounds.width, (height - pad * 2) / bounds.height),
        props.minZoom,
        Math.min(props.maxZoom, props.fitCap),
      );
      // Snap DOWN: rounding fit to the nearest grid step can land above the
      // padding budget and squeeze (or push) the content past the viewport.
      // Flooring can only lower k, so the upper bound after it is maxZoom:
      // minZoom must still win over a fitCap configured below it.
      const floorValue = step > 0 ? Math.floor(raw / step + 1e-9) * step : raw;
      // A graph too large for one grid step floors to 0. Raising it to a whole
      // step would over-zoom (up to 10x past the budget, and past `fitCap`);
      // the un-quantised ideal is already inside [minZoom, min(fitCap, maxZoom)],
      // so that is what frames it.
      const floored = floorValue <= 0 ? raw : floorValue;
      // The multiplication leaves binary dust (6 * 0.05 is 0.30000000000000004),
      // and a camera whose k differs from what `normalizeZoom` would return for
      // the same factor makes the first gesture after a fit jump a hair. Round
      // it exactly like `normalizeZoom` does.
      const k = clamp(Number(floored.toFixed(6)), props.minZoom, props.maxZoom);
      // A host can configure a range that cannot describe a fit (minZoom 0, a
      // padding budget wider than the viewport); framing with a zero or
      // non-finite scale would put NaN into every coordinate derived from it.
      if (!Number.isFinite(k) || k <= 0) return camera.value;
      const x = (width - bounds.width * k) / 2 - bounds.x * k;
      const y = (height - bounds.height * k) / 2 - bounds.y * k;
      // A finite but enormous origin (1e308) overflows the translation into
      // Infinity: the browser then drops the whole transform.
      if (!Number.isFinite(x) || !Number.isFinite(y)) return camera.value;
      return { k, x, y };
    }

    /** Frame the content. Automatic while the camera is untouched, and exposed
     *  for the host to re-frame whenever it likes. */
    function fit(): boolean {
      const next = computeFit();
      // Degenerate bounds return the live camera unchanged, and an unchanged
      // camera must not be written back: a host that spells `contentBounds` as
      // a fresh object literal re-renders on every emit, so comparing by
      // identity would loop — fit emits, the host writes the value back, the
      // object identity changes, the watcher fits again. Compare by value.
      if (sameCamera(next, camera.value)) return false;
      // A host may transform what it stores (rounding, clamping, a 10 Hz
      // mirror), so its value never equals what we asked for and a host that
      // frames on every update would ask again for ever. One request stands —
      // but only while the host is still where it was when we asked: a host
      // that moved the camera itself (a restored viewport, a minimap jump) is
      // asking us to frame, and must get an answer.
      //
      // `false` therefore means "nothing was written": the camera is already the
      // fitted one, the same request is still standing, or the host has not had
      // the grace to answer it. What it must not mean is "for ever": a host that
      // dropped the write would never be frameable again and could not be told
      // apart from one with nothing to change, so an unanswered request expires
      // and a later fit() asks again. A host that frames on every update cannot
      // loop that way — it answers, and an answered request stands.
      if (lastRequested && sameCamera(next, lastRequested)) {
        if (!pending.length || Date.now() - pending[0].at <= REQUEST_GRACE_MS) return false;
      }
      writeCamera(next, true); // already normalised by computeFit
      return true;
    }

    /** Automatic framing: the component's own camera only, and only until the
     *  host or the user has taken the view over. */
    function autoFit() {
      if (!props.fitOnLoad || movedByHand) return;
      if (props.camera && !props.fitControlled) return;
      fit();
    }

    /** The camera a gesture builds on. A controlled host may write back late — a
     *  throttled mirror, a store behind an RPC queue — so composing from its
     *  echo would make the surface trail the pointer, and an in-order queue
     *  makes it step backwards. The newest request is the truth until the host
     *  answers it. */
    function gestureBase(): NodeCanvasCamera {
      if (props.camera) {
        const base = requestBase();
        if (base) return base;
      }
      return camera.value;
    }

    /** The newest request, while it is still the camera the surface is being
     *  built on. A gesture is relative, so its request stays the base until the
     *  host answers it. A framing request is absolute and one-off: it is the
     *  base only while it is plausibly still in flight, and only for a host that
     *  has shown it applies what it is asked to — one that dropped it never had
     *  that camera, and a drag composed from it teleports the surface. */
    function requestBase(): NodeCanvasCamera | null {
      const newest = pending[0];
      if (!newest) return null;
      if (!newest.framing) return newest.camera;
      if (!hostApplied) return null;
      return Date.now() - newest.at <= REQUEST_GRACE_MS ? newest.camera : null;
    }

    function zoomAt(nextK: number, at: { x: number; y: number }) {
      const current = gestureBase();
      const k = normalizeZoom(nextK);
      if (!Number.isFinite(k) || k <= 0 || k === current.k) return;
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
      // Same base as the translation applied below, or a step computed from one
      // camera lands on another.
      const current = gestureBase().k;
      const scaled = current * (direction > 0 ? props.zoomFactor : 1 / props.zoomFactor);
      // Below k = 0.5 a 1.05 step is smaller than half a grid step, so snapping
      // would round it straight back and the wheel would do nothing at all.
      const step = props.zoomGridStep;
      const next =
        step > 0 && Math.abs(scaled - current) < step ? current + direction * step : scaled;
      zoomAt(next, point);
    }

    function panBy(dx: number, dy: number) {
      const current = gestureBase();
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
      // A host that drags its own nodes suppresses the pan by preventing the
      // default on its card's pointerdown: the root listens in the bubble
      // phase, so it sees the flag. Without an opt-out the root's capture
      // would retarget the gesture and cut the host's drag short.
      if (event.defaultPrevented) return;
      // The overlay and minimap slots carry the host's chrome — inspectors,
      // rails, sliders. A press there is the chrome's, not the canvas's. A host
      // that draws its own interactive nodes in the default slot marks them
      // with `data-hk-canvas-no-pan` (or claims the gesture with
      // `preventDefault`, above).
      const target = event.target as Element | null;
      if (target?.closest?.("[data-hk-canvas-no-pan]")) return;
      // Chrome is not a pan surface, unless the host marks a subtree inside it
      // as one (`data-hk-canvas-pan`), which is how a HUD wrapper that covers
      // the whole canvas stays pannable.
      if (
        !target?.closest?.("[data-hk-canvas-pan]") &&
        target?.closest?.(".hk-node-canvas-overlay, .hk-node-canvas-minimap")
      ) {
        return;
      }
      panning = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        startX: event.clientX,
        startY: event.clientY,
        captured: false,
      };
      // A release outside this element never reaches it, and the gesture is
      // only captured once it passes the slop: listen for the release on the
      // window so a pan cannot outlive the button.
      window.addEventListener("pointerup", endPan, true);
      window.addEventListener("pointercancel", endPan, true);
      // A release swallowed by a focus change never arrives as an event.
      window.addEventListener("blur", loseFocus, true);
    }

    function onPointerMove(event: PointerEvent) {
      if (!panning || event.pointerId !== panning.pointerId) return;
      // The gesture is only captured once it passes the slop, so a release that
      // happens outside the canvas never reaches this element. Without this the
      // pan would stay armed and the next button-less hover would move the
      // camera on its own.
      if (event.buttons === 0 && !panning.captured) {
        endPan(event);
        return;
      }
      if (!panning.captured) {
        // Capturing at pointerdown retargets the gesture's click to the capture
        // element and kills clicks on node cards (shittim-chest #818).
        if (Math.hypot(event.clientX - panning.startX, event.clientY - panning.startY) < PAN_SLOP) {
          return;
        }
        rootEl.value?.setPointerCapture?.(event.pointerId);
        panning = { ...panning, captured: true };
      }
      const dx = event.clientX - panning.x;
      const dy = event.clientY - panning.y;
      panning = { ...panning, x: event.clientX, y: event.clientY };
      panBy(dx, dy);
    }

    /** Stop watching for a release (the gesture is over either way). */
    function stopWindowWatch() {
      window.removeEventListener("pointerup", endPan, true);
      window.removeEventListener("pointercancel", endPan, true);
      window.removeEventListener("blur", loseFocus, true);
    }

    function endPan(event: PointerEvent) {
      if (!panning || event.pointerId !== panning.pointerId) return;
      const pointerId = panning.pointerId;
      panning = null;
      stopWindowWatch();
      rootEl.value?.releasePointerCapture?.(pointerId);
    }

    /** A blur carries no pointer id: whatever was being dragged is over. */
    function loseFocus(event: FocusEvent) {
      // `blur` reaches this capture listener for ELEMENT blurs too (pressing the
      // canvas clears focus), and ending the gesture there would kill the first
      // pan after any click. Only the window's own blur ends it.
      if (event.target && event.target !== window) return;
      if (!panning) return;
      const pointerId = panning.pointerId;
      panning = null;
      stopWindowWatch();
      rootEl.value?.releasePointerCapture?.(pointerId);
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
      if (props.contentBounds) autoFit();
      if (typeof ResizeObserver !== "undefined" && rootEl.value) {
        ro = new ResizeObserver(() => {
          const wasUnmeasurable = viewport.value.width <= 0 || viewport.value.height <= 0;
          measureViewport();
          // Mounted inside a hidden tab there was nothing to fit into; frame it
          // now that it has a viewport (unless the host or the user drives it).
          if (wasUnmeasurable && props.contentBounds) autoFit();
        });
        ro.observe(rootEl.value);
      }
    });

    // Late-arriving bounds (the usual case: the graph loads after mount) are
    // framed as soon as they exist, still before the host has drawn at the
    // wrong scale.
    // Keyed on the VALUES: a host that mutates its bounds object in place (or
    // reuses one instance) still gets framed.
    // Handing control back (the host drops the `camera` prop) keeps the view
    // the host was showing instead of jumping to the internal seed.
    watch(
      () => props.camera,
      (next, previous) => {
        if (!next) {
          if (previous) inner.value = previous;
          // The requests we made of it are moot.
          pending = [];
          lastRequested = null;
          return;
        }
        // Which request is this the answer to? A store behind a queue echoes
        // them in order, so a write that reproduces an OLDER request is the host
        // catching up — the newest request has not been seen yet, and the
        // gesture under the pointer must keep composing from it. Drop what the
        // host has consumed and leave the newer requests standing.
        const index = pending.findIndex((request) => sameCamera(request.camera, next));
        if (index > 0) {
          pending = pending.slice(0, index);
          hostApplied = true;
          return;
        }
        // The host answered the newest request — it may have transformed it, so
        // this camera is where the surface is now — or it moved on its own, and
        // then a later `fit()` may ask for the same camera again.
        if (pending.length) {
          pending = [];
          hostApplied = true;
          return;
        }
        lastRequested = null;
      },
    );

    watch(
      () => {
        const bounds = props.contentBounds;
        return bounds ? `${bounds.x}|${bounds.y}|${bounds.width}|${bounds.height}` : null;
      },
      (key) => {
        if (key) autoFit();
      },
    );

    onBeforeUnmount(() => {
      ro?.disconnect();
      ro = null;
      panning = null;
      window.removeEventListener("pointerup", endPan, true);
      window.removeEventListener("pointercancel", endPan, true);
      window.removeEventListener("blur", loseFocus, true);
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
          style={{
            // Only a surface that consumes the gesture may take touch scrolling
            // away from the page.
            touchAction: props.pannable || props.zoomable ? "none" : undefined,
          }}
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
