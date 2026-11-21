import { laidOffsetWithin } from "./layoutGeometry";
import { scheduleEvery, type AnimationHandle } from "../runtime/animationBus";

/**
 * useOverviewRuler — a standalone minimap strip ("竖向瀑布流") that any
 * scrollable element can attach, the same way attachOverlayScrollbars
 * attaches the scrollbar. It renders a proportional density map of the
 * viewport's content (one band per top-level block, sized by its share of
 * the content extent) plus a cursor marking the visible window; dragging
 * scrolls the viewport, clicking jumps.
 *
 * Design direction (2026-11-21 user ruling): the minimap is a STANDALONE
 * attachment — not a mode of the scrollbar — and it is the same primitive
 * a waterfall layout needs: a vertical (or horizontal) strip of
 * proportional bands with a draggable cursor. Direction and cursor
 * behaviour are options, not separate components.
 *
 * Two cursor modes:
 *   - "jump" (default): pointer down anywhere on the strip scrolls so the
 *     content window under the pointer becomes the visible window, then
 *     keeps dragging (双向可拖动 — both the cursor and a strip click steer
 *     the scroll);
 *   - "thumb": only the cursor box is draggable; strip clicks are inert.
 *
 * Sampling: bands are harvested from `bandSelector` matches inside the
 * viewport (default: the viewport's DIRECT element children). Nested
 * matches are dropped when a match contains another (a parent band's
 * extent already contains its children's — counting both would paint the
 * same content twice). Caller-driven content (virtualized rows, a canvas
 * terminal) should pass a `bandSelector` for whatever stands in for lines,
 * or drive `setBands` directly with fractions.
 *
 * The strip sits at z-index 9 — UNDER the overlay scrollbar's interactive
 * track (z-index 10, see theme/scrollbar.scss) so a host that attaches
 * both keeps fine scrolling on the track while the ruler carries the map.
 */

export type OverviewRulerAxis = "vertical" | "horizontal";
export type OverviewRulerCursorMode = "jump" | "thumb";

export interface OverviewRulerBand {
  /** Band start as a fraction of the content extent, 0..1. */
  start: number;
  /** Band length as a fraction of the content extent, 0..1. */
  length: number;
  /** Extra class for the band (e.g. severity coloring for log lines). */
  modifier?: string;
}

export interface OverviewRulerOptions {
  /** Strip direction. Default "vertical" (the waterfall). */
  axis?: OverviewRulerAxis;
  /** Strip thickness in CSS px. Default 48 (vertical) / 36 (horizontal). */
  thickness?: number;
  /** Which edge of the host the strip docks to. Default "end"
   *  (right for vertical, bottom for horizontal). */
  side?: "start" | "end";
  /** Selector harvested INSIDE the viewport for band sources. Matches
   *  contained within another match are dropped (the parent band already
   *  covers them). Default: the viewport's DIRECT element children. */
  bandSelector?: string;
  /** Cursor behaviour: "jump" (default) = strip pointer down jumps then
   *  drags; "thumb" = only the cursor box is draggable. */
  cursorDrag?: OverviewRulerCursorMode;
  /** Element the strip is appended to — its positioning context. Same
   *  contract as OverlayScrollbarOptions.host: a box wrapping exactly the
   *  viewport. Defaults to the viewport's DOM parent. */
  host?: HTMLElement;
  /** Content-resample cadence in ms (bands, not the cursor — the cursor
   *  tracks scroll and resize live). Default 250. */
  resampleMs?: number;
}

export interface OverviewRulerHandle {
  /** Resample the bands and reposition the cursor. */
  update(): void;
  /** Replace the sampled bands with caller fractions (virtualized or
   *  canvas content). An empty list clears the waterfall. */
  setBands(bands: OverviewRulerBand[]): void;
  /** Remove the strip and every listener/observer; restore any inline
   *  positioning the promotion applied. Safe to call twice. */
  detach(): void;
}

/** Clamp to [0, 1]; a band outside the content extent is caller noise and
 *  would render outside the strip. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Reference-counted host-position promotion, shared with the overlay
 *  scrollbar's contract: N handles on one host keep the promotion until
 *  the LAST one detaches (a bare boolean would let ruler A strip ruler
 *  B's positioning context). */
const promotedParents = new WeakMap<HTMLElement, { count: number; saved: string }>();

export function attachOverviewRuler(
  viewport: HTMLElement,
  opts: OverviewRulerOptions = {},
): OverviewRulerHandle {
  const axis = opts.axis ?? "vertical";
  const horizontal = axis === "horizontal";
  const thickness = Math.max(
    16,
    Math.round(opts.thickness ?? (horizontal ? 36 : 48)),
  );
  const cursorDrag = opts.cursorDrag ?? "jump";
  const resampleMs = Math.max(50, opts.resampleMs ?? 250);
  const parent = opts.host ?? viewport.parentElement;
  if (!parent) {
    return { update() {}, setBands() {}, detach() {} };
  }
  const host: HTMLElement = parent;

  // ── Promotion (reference-counted; see promotedParents above) ──────────
  let promoted = false;
  // Count EVERY handle on this host, even when the host is already
  // positioned (an earlier ruler promoted it): otherwise ruler A's detach
  // would strip the positioning out from under a still-live ruler B —
  // exactly the accident the overlay scrollbar's comment exists to prevent.
  let entry = promotedParents.get(host);
  if (!entry) {
    entry = { count: 0, saved: host.style.position };
    promotedParents.set(host, entry);
  }
  entry.count += 1;
  const computedPosition = getComputedStyle(host).position;
  // Only the handle whose count triggered the promotion owns the restore:
  // a host that arrived positioned (absolute/fixed/already relative) must
  // keep its inline style when this handle detaches.
  promoted = entry.count === 1 && (computedPosition === "static" || computedPosition === "");
  if (promoted) {
    host.style.position = "relative";
  }

  // ── Chrome ─────────────────────────────────────────────────────────────
  const strip = document.createElement("div");
  strip.className = "hk-overview-ruler";
  strip.dataset.axis = axis;
  strip.dataset.side = opts.side ?? "end";
  strip.style.setProperty("--hk-overview-ruler-thickness", `${thickness}px`);
  strip.setAttribute("aria-hidden", "true");

  const cursor = document.createElement("div");
  cursor.className = "hk-overview-ruler-cursor";
  strip.appendChild(cursor);

  const bandsHost = document.createElement("div");
  bandsHost.className = "hk-overview-ruler-bands";
  strip.appendChild(bandsHost);

  host.appendChild(strip);

  // ── Geometry ───────────────────────────────────────────────────────────
  const scrollCoord = (): number => (horizontal ? viewport.scrollLeft : viewport.scrollTop);
  const setScrollCoord = (v: number) => {
    if (horizontal) viewport.scrollLeft = v;
    else viewport.scrollTop = v;
  };
  /** Horizontal RTL: the engine reports scrollLeft descending 0 → −maxScroll
   *  (useOverlayScrollbar's isRtlAxis exists for exactly this axis). The
   *  vertical axis and every LTR horizontal engine are unaffected. */
  const rtlHorizontal = horizontal
    && typeof getComputedStyle === "function"
    && getComputedStyle(viewport).direction === "rtl";
  /** The scroll position in the ruler's positive-fraction domain. */
  const readScroll = (): number => (rtlHorizontal ? -scrollCoord() : scrollCoord());
  const writeScroll = (v: number): void => setScrollCoord(rtlHorizontal ? -v : v);
  const contentExtent = (): number =>
    horizontal
      ? Math.max(viewport.scrollWidth, viewport.clientWidth)
      : Math.max(viewport.scrollHeight, viewport.clientHeight);
  const visibleExtent = (): number =>
    horizontal ? viewport.clientWidth : viewport.clientHeight;

  /** The visible window mapped onto the strip: the cursor spans
   *  visible/extent of the strip, and its EDGE travels progress times the
   *  strip's remaining travel — the same mapping the overlay scrollbar's
   *  thumb uses (offset = progress × (track − thumb)), so the cursor
   *  always covers the visible window and lands exactly at the strip's
   *  end when fully scrolled. */
  function windowFractions(): { start: number; length: number } {
    const extent = contentExtent();
    const visible = visibleExtent();
    const maxScroll = Math.max(extent - visible, 0);
    const length = Math.min(visible / extent, 1);
    const progress = maxScroll > 0 ? clamp01(readScroll() / maxScroll) : 0;
    return { start: progress * (1 - length), length };
  }

  /** Pointer fraction (0..1 down the strip) → the scroll position whose
   *  visible window START lands at that fraction of the travel, clamped.
   *  Jump-mode scrubbing follows the pointer proportionally: re-targeting
   *  the same fraction is idempotent (the same input yields the same
   *  scroll), so no drag state double-applies. */
  function scrollToFraction(fraction: number) {
    const extent = contentExtent();
    const visible = visibleExtent();
    const maxScroll = Math.max(extent - visible, 0);
    writeScroll(clamp01(fraction) * maxScroll);
  }

  /** Strip geometry along the drag axis, for pointer→fraction math. */
  function stripExtent(): number {
    const rect = strip.getBoundingClientRect();
    return horizontal ? rect.width : rect.height;
  }

  function pointerFraction(event: PointerEvent): number {
    const rect = strip.getBoundingClientRect();
    const coord = horizontal ? event.clientX - rect.left : event.clientY - rect.top;
    const extent = stripExtent();
    return extent > 0 ? Math.min(Math.max(coord / extent, 0), 1) : 0;
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  function renderCursor() {
    const { start, length } = windowFractions();
    const pos = `${Number((clamp01(start) * 100).toFixed(4))}%`;
    const len = `${Number((Math.max(clamp01(length), 0.002) * 100).toFixed(4))}%`;
    if (axis === "vertical") {
      cursor.style.top = pos;
      cursor.style.height = len;
    } else {
      cursor.style.left = pos;
      cursor.style.width = len;
    }
  }

  let manualBands: OverviewRulerBand[] | null = null;

  function sampleDomBands(): OverviewRulerBand[] {
    const extent = contentExtent();
    if (extent <= 0) return [];
    let nodes: HTMLElement[] = opts.bandSelector
      ? (Array.from(viewport.querySelectorAll<HTMLElement>(opts.bandSelector)) as HTMLElement[])
      : (viewport.children as HTMLCollectionOf<HTMLElement> as unknown as HTMLElement[]);
    nodes = Array.from(nodes);
    // Drop matches contained within another match: a parent band's extent
    // already covers its children's, and counting both paints content twice.
    nodes = nodes.filter(
      (n) => !nodes.some((other) => other !== n && other.contains(n)),
    );
    const bands: OverviewRulerBand[] = [];
    for (const node of nodes) {
      const laid = laidOffsetWithin(node, viewport);
      if (!Number.isFinite(laid.x) || !Number.isFinite(laid.y)) continue;
      // Horizontal RTL mirrors band placement too (S2-R4-5): laid.x grows
      // visually leftward under RTL, so the band's start anchors at the
      // FAR edge minus its own extent.
      const laidCoord = rtlHorizontal
        ? extent - laid.x - node.offsetWidth
        : horizontal
          ? laid.x
          : laid.y;
      const start = laidCoord / extent;
      const length = (horizontal ? node.offsetWidth : node.offsetHeight) / extent;
      if (length <= 0) continue;
      bands.push({ start, length });
    }
    return bands;
  }

  function renderBands() {
    const bands = manualBands ?? sampleDomBands();
    bandsHost.textContent = "";
    for (const band of bands) {
      const el = document.createElement("div");
      el.className = "hk-overview-ruler-band" + (band.modifier ? ` ${band.modifier}` : "");
      const pos = `${Number((clamp01(band.start) * 100).toFixed(4))}%`;
      const len = `${Number((Math.max(clamp01(band.length), 0.002) * 100).toFixed(4))}%`;
      if (axis === "vertical") {
        el.style.top = pos;
        el.style.height = len;
      } else {
        el.style.left = pos;
        el.style.width = len;
      }
      bandsHost.appendChild(el);
    }
  }

  function update() {
    renderBands();
    renderCursor();
  }

  // ── Pointer steering ───────────────────────────────────────────────────
  let dragging = false;
  let dragMode: OverviewRulerCursorMode = cursorDrag;
  let dragStartClient = 0;
  let dragStartScroll = 0;
  /** The cursor's own travel along the strip in px (strip − cursor box):
   *  the denominator that makes thumb-drag 1:1 with the pointer — moving
   *  the pointer the full cursor travel scrolls the full document. */
  let cursorTravelPx = 1;

  function beginDrag(event: PointerEvent) {
    dragging = true;
    dragMode = cursorDrag;
    dragStartClient = horizontal ? event.clientX : event.clientY;
    dragStartScroll = readScroll();
    const extent = contentExtent();
    const visible = visibleExtent();
    const length = Math.min(visible / extent, 1);
    cursorTravelPx = Math.max((1 - length) * stripExtent(), 1);
    strip.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
      return;
    const fraction = pointerFraction(event);
    if (cursorDrag === "thumb") {
      if (event.target !== cursor) return;
    } else {
      scrollToFraction(fraction);
    }
    beginDrag(event);
    // Move/up ride the WINDOW (not the strip): setPointerCapture keeps the
    // events flowing through the strip when it works, and the window
    // bindings are the fallback everywhere capture is unavailable.
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    if (dragMode === "thumb") {
      const deltaPx = (horizontal ? event.clientX : event.clientY) - dragStartClient;
      const maxScroll = Math.max(contentExtent() - visibleExtent(), 0);
      writeScroll(dragStartScroll + (deltaPx / cursorTravelPx) * maxScroll);
      return;
    }
    scrollToFraction(pointerFraction(event));
  }

  function onPointerUp(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    try {
      strip.releasePointerCapture(event.pointerId);
    } catch {
      // already released by the browser on pointer cancel
    }
  }

  strip.addEventListener("pointerdown", onPointerDown);

  // ── Live cursor: scroll + viewport resize ─────────────────────────────
  const onViewportScroll = () => renderCursor();
  viewport.addEventListener("scroll", onViewportScroll, { passive: true });

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(() => {
      renderCursor();
      renderBands();
    });
    observer.observe(viewport);
  }

  // ── Content resample (bands only; the cursor tracks live) ─────────────
  const sampler = scheduleEvery(
    () => {
      if (!manualBands) renderBands();
    },
    resampleMs,
  );

  // First frame now — the sampler's first tick is resampleMs away, and a
  // bare background strip for a quarter second reads as a flash.
  renderBands();
  renderCursor();

  function endDrag(event: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    try {
      strip.releasePointerCapture(event.pointerId);
    } catch {
      // already released by the browser on pointer cancel
    }
  }

  function detach() {
    viewport.removeEventListener("scroll", onViewportScroll);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    strip.removeEventListener("pointerdown", onPointerDown);
    sampler.disconnect();
    observer?.disconnect();
    observer = null;
    strip.remove();
    const entry = promotedParents.get(host);
    if (entry) {
      entry.count -= 1;
      if (entry.count <= 0) {
        host.style.position = entry.saved;
        promotedParents.delete(host);
      }
    }
  }

  return {
    update,
    setBands(bands: OverviewRulerBand[]) {
      manualBands = bands;
      renderBands();
      renderCursor();
    },
    detach,
  };
}
