// useOverlayScrollbar — hikari's ONE sanctioned overlay scrollbar engine.
//
// Attaches the shared `.hk-scrollbar-track` / `.hk-scrollbar-thumb` chrome
// (styled in packages/theme/styles/_scrollbar.scss) onto any native
// scrolling element. The element keeps its own `overflow: auto|scroll`
// mechanics — this module adds only the overlay; the consumer's CSS is
// responsible for hiding the native bar
// (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`).
//
// Features (extracted from HkScrollContainer so every scroll region in
// the library renders the identical scrollbar):
//   - geometry-driven thumb sizing/positioning per enabled axis;
//   - the track hides itself while the content fits;
//   - `is-scrolling` flash on scroll, `is-hovering` on track hover,
//     `is-dragging` while the thumb is dragged;
//   - thumb drag (document-tracked), track-click paging;
//   - updates on viewport resize (ResizeObserver);
//   - positioning guard: the tracks are absolutely positioned inside
//     the viewport's parent — when that parent computes to `static`,
//     an inline `position: relative` is applied (and restored on
//     detach), marked with a data attribute.
//
// Works inside teleported popups/modals: attach on mount/open and call
// `detach()` on close/unmount so no DOM or listener leaks.

import { drawnScale } from "./layoutGeometry";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { scheduleFrame, type AnimationHandle } from "../runtime/animationBus";

/** Which axes get an overlay track. Defaults to "vertical". */
export type OverlayScrollbarAxis = "vertical" | "horizontal" | "both";

/**
 * One change mark on the vertical rail beside the track — the "where in
 * the document is the interesting part" affordance a diff, a search
 * result set or a lint run wants next to its scrollbar (VS Code's
 * overview ruler).
 *
 * Positions are fractions of the FULL content extent, never of the
 * visible window: line 500 of a 1000-line file sits at 0.5 while the
 * user scrolls, and the rail keeps representing the whole document while
 * the thumb represents the window. The engine stays domain-agnostic —
 * the consumer divides its own line numbers, byte offsets or match
 * indices by its own total.
 */
export interface OverlayScrollbarMarker {
  /** Mark start in [0, 1] along the content. */
  start: number;
  /** Mark end in [0, 1]; clamped to at least `start`. */
  end: number;
  /** Semantic tag mirrored onto `data-kind`, so the consumer's theme owns
   *  the palette (this engine ships no colours of its own). */
  kind?: string;
  /**
   * Which third of the band the mark hugs — VS Code's diff overview ruler
   * draws REMOVED content against the band's start edge and ADDED content
   * against its end edge, so one vertical position can carry both. Omitted
   * = the mark spans the full band width.
   */
  side?: "start" | "end";
}

/** Shortest a mark may render, as a fraction of the rail. A one-line edit
 *  in a long file is ~0.1% of the content — without a floor it would be a
 *  sub-pixel sliver, i.e. invisible exactly when the reader needs it. */
const MARKER_MIN_FRACTION = 0.005;

/** …and the same floor in CSS pixels, which is what actually decides
 *  whether a mark can be SEEN and HIT on a short rail: at 1000px tall the
 *  fraction floor is 5px, at 100px it is 0.5px. It lives in the engine —
 *  not as a stylesheet `min-height` — for two reasons: the floor has to
 *  scale with the rail, and the end-of-rail inset below has to be computed
 *  from the SAME number, which CSS cannot express. */
const MARKER_MIN_PX = 2;

/** Width the vertical track widens to when marks arrive, unless the
 *  consumer passes its own. VS Code's scrollbar strip is ~14px; the
 *  default keeps the marks' two lanes readable at a glance. */
const DEFAULT_MARKERS_WIDTH = 14;

/**
 * One rung of an ASYMMETRIC scroll map: `dom` units of rendered scroll
 * space that carry `map` units of document space. The scrollbar then
 * represents the DOCUMENT (the fully-expanded whole) while the scroller
 * holds only what is rendered — collapsed regions ("40 unchanged
 * lines…") occupy real map extent and (near-)zero dom extent, so:
 *
 *  - scrolling the CONTENT sweeps the thumb quickly across a collapsed
 *    region's map range (a one-row divider stands for N document lines);
 *  - DRAGGING the thumb through that range leaves the content pinned
 *    (the divider is all the DOM there is to show) until the range ends;
 *  - markers, which consumers express as fractions of the FULL document,
 *    align with the thumb's map position — with a dom-native bar they
 *    clump against a mostly-collapsed scroller instead.
 *
 * Both sides may use any consistent unit (rows, px, lines); the engine
 * normalises Σdom onto the scroller's real extent, so approximations are
 * fine as long as proportions are honest. `map: 0` rungs are chrome
 * (a hunk heading) and `dom: 0` rungs are fully-collapsed content — both
 * are honoured. Vertical axis only.
 */
export interface OverlayScrollMapSegment {
  /** Rendered scroll-space extent of this rung (>0 unless collapsed). */
  dom: number;
  /** Document-space extent it stands for (0 = pure chrome). */
  map: number;
}

/** Nothing has been mapped: run the dom-native math unchanged. */
interface ScrollMap {
  total: number;
  fracToMap(frac: number): number;
  mapToFrac(map: number): number;
}

/** Build the piecewise-linear tables; null unless the map is usable. */
function buildScrollMap(
  segments: OverlayScrollMapSegment[] | null | undefined,
): ScrollMap | null {
  if (!segments || segments.length === 0) return null;
  let domTotal = 0;
  let mapTotal = 0;
  const domCum: number[] = [0];
  const mapCum: number[] = [0];
  for (const seg of segments) {
    const dom = Number.isFinite(seg.dom) ? Math.max(seg.dom, 0) : 0;
    const map = Number.isFinite(seg.map) ? Math.max(seg.map, 0) : 0;
    domTotal += dom;
    mapTotal += map;
    domCum.push(domTotal);
    mapCum.push(mapTotal);
  }
  if (domTotal <= 0 || mapTotal <= 0) return null;
  return {
    total: mapTotal,
    fracToMap(frac: number): number {
      const f = Math.min(Math.max(frac, 0), 1) * domTotal;
      for (let i = 0; i < segments.length; i += 1) {
        if (f <= domCum[i + 1] || i === segments.length - 1) {
          const span = domCum[i + 1] - domCum[i];
          const local = span > 0 ? (f - domCum[i]) / span : 1;
          return mapCum[i] + local * (mapCum[i + 1] - mapCum[i]);
        }
      }
      return mapTotal;
    },
    mapToFrac(map: number): number {
      const m = Math.min(Math.max(map, 0), mapTotal);
      for (let i = 0; i < segments.length; i += 1) {
        if (m <= mapCum[i + 1] || i === segments.length - 1) {
          const span = mapCum[i + 1] - mapCum[i];
          const local = span > 0 ? (m - mapCum[i]) / span : 1;
          return (domCum[i] + local * (domCum[i + 1] - domCum[i])) / domTotal;
        }
      }
      return 1;
    },
  };
}

/** Clamp to [0, 1]; non-finite input is the caller's bug, but the rail
 *  must never render a mark at a meaningless position, so it becomes 0. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** A rail offset as a CSS percentage with the float noise trimmed: the
 *  span `0.8 − 0.2` is 0.6000000000000001, and a position is not a
 *  measurement — "60.00000000000001%" is noise in the DOM, in snapshots
 *  and in any consumer assertion. */
function pct(fraction: number): string {
  return `${Number((fraction * 100).toFixed(4))}%`;
}

export interface OverlayScrollbarOptions {
  axis?: OverlayScrollbarAxis;
  /** Element the tracks are appended to — their positioning context.
   *  MUST be a box wrapping EXACTLY the viewport (the viewport plus the
   *  rails, nothing else): the rails take their insets from this box, so
   *  a host that also contains header/footer/sibling bands would draw
   *  them in the wrong place. Defaults to the viewport's DOM parent,
   *  which is only correct when the viewport fills that parent; wrap
   *  the viewport in a dedicated positioned `div` when it does not
   *  (see HkDrawer/HkSidebar/HkTable for the pattern). Never rely on
   *  the guard to promote `body`. */
  host?: HTMLElement;
  /** Change marks drawn on a rail immediately inboard of the vertical
   *  track. Vertical axis only — a horizontal rail has no meaningful
   *  "position in the document". Omitted or empty creates no rail at all,
   *  so consumers that never pass markers keep the exact chrome they had. */
  markers?: OverlayScrollbarMarker[];
  /** Width the vertical track widens to while marks are showing, in CSS
   *  pixels. Selective: consumers without marks keep the narrow track.
   *  Clamped to a sane range (the thumb and marks share the band). */
  markersWidth?: number;
  /**
   * Asymmetric scroll map for the vertical axis (see
   * `OverlayScrollMapSegment`): the scrollbar represents the DOCUMENT
   * while the scroller holds only the rendered rows. Omitted or empty =
   * the dom-native bar every consumer had before. Update it any time the
   * layout folds or unfolds — the thumb, drag, click and marker-scrub
   * paths all re-derive from it.
   */
  mapSegments?: OverlayScrollMapSegment[];
}

export interface OverlayScrollbarHandle {
  /** Re-read the viewport's scroll geometry and reposition the thumbs. */
  update(): void;
  /** Swap the asymmetric scroll map (empty clears it back to dom-native).
   *  Call whenever the layout folds or unfolds. */
  setMapSegments(segments: OverlayScrollMapSegment[]): void;
  /** Replace the rail's marks. Passing an empty list removes the rail
   *  again. No-op when the handle was attached against no host. */
  setMarkers(markers: OverlayScrollbarMarker[]): void;
  /** Remove the tracks and every listener/observer; restore any
   *  inline positioning the guard applied. Safe to call twice. */
  detach(): void;
}

interface AxisState {
  track: HTMLElement;
  thumb: HTMLElement;
  horizontal: boolean;
  dragging: boolean;
  dragStartClient: number;
  dragStartScroll: number;
  hideTimer: CronHandle;
}

/** Data attribute marking a parent whose inline `position: relative`
 *  was set by the guard (so detach can restore it). */
const POSITION_GUARD_ATTR = "data-hk-overlay-scrollbar-positioned";

/** Per-parent guard bookkeeping. Two handles may share one static parent
 *  (e.g. sibling code panes reconciled independently); the inline
 *  `position: relative` must survive until the LAST handle detaches, so
 *  promotion is reference-counted. */
const promotedParents = new WeakMap<HTMLElement, { count: number; saved: string }>();

/** Read the scroll geometry of `viewport` for one axis. */
function axisMetrics(viewport: HTMLElement, horizontal: boolean) {
  return {
    scrollSize: horizontal ? viewport.scrollWidth : viewport.scrollHeight,
    clientSize: horizontal ? viewport.clientWidth : viewport.clientHeight,
    scrollPos: horizontal ? viewport.scrollLeft : viewport.scrollTop,
  };
}

/** Whether the axis runs right-to-left. Only the horizontal one can: a
 *  vertical bar is RTL-agnostic, and `writing-mode` on the scroller is not
 *  something this component supports. */
function isRtlAxis(viewport: HTMLElement, horizontal: boolean): boolean {
  if (!horizontal) return false;
  return getComputedStyle(viewport).direction === "rtl";
}

function makeAxisState(horizontal: boolean): AxisState {
  const track = document.createElement("div");
  track.className = "hk-scrollbar-track";
  if (horizontal) track.setAttribute("data-axis", "horizontal");
  const thumb = document.createElement("div");
  thumb.className = "hk-scrollbar-thumb";
  track.appendChild(thumb);
  return {
    track,
    thumb,
    horizontal,
    dragging: false,
    dragStartClient: 0,
    dragStartScroll: 0,
    hideTimer: undefined as unknown as CronHandle,
  };
}

/** Attach the shared overlay scrollbar chrome to a scrolling viewport.
 *  Returns a handle; when the viewport has no parent element a no-op
 *  handle is returned (nothing to position the tracks against). */
export function attachOverlayScrollbars(
  viewport: HTMLElement,
  opts: OverlayScrollbarOptions = {},
): OverlayScrollbarHandle {
  const axis = opts.axis ?? "vertical";
  const parent = opts.host ?? viewport.parentElement;
  if (!parent) {
    return { update() {}, setMapSegments() {}, setMarkers() {}, detach() {} };
  }

  const wantV = axis !== "horizontal";
  const wantH = axis !== "vertical";

  // Positioning guard: the tracks are position:absolute inside the
  // viewport's parent. A static parent would anchor them to the
  // nearest positioned ancestor instead — promote it to `relative`
  // and remember the previous inline value for restore on detach —
  // reference-counted per parent (see promotedParents) so a sibling
  // handle's detach cannot strip the positioning out from under the
  // tracks that remain.
  // (Real browsers always report "static" for unpositioned elements;
  // happy-dom reports "" — both mean "no positioning context".)
  const computedPosition = getComputedStyle(parent).position;
  if (computedPosition === "static" || computedPosition === "") {
    if (!promotedParents.has(parent)) {
      promotedParents.set(parent, { count: 0, saved: parent.style.position });
      parent.style.position = "relative";
      parent.setAttribute(POSITION_GUARD_ATTR, "true");
    }
  }
  // Count EVERY handle on a promoted parent — including handles whose
  // attach sees the parent already `relative` (computed styles reflect
  // the first handle's inline promotion). Skipping those would let the
  // first detach strip the positioning out from under surviving tracks.
  const entry = promotedParents.get(parent);
  if (entry) entry.count++;

  const states: AxisState[] = [];
  if (wantV) states.push(makeAxisState(false));
  if (wantH) states.push(makeAxisState(true));
  for (const s of states) parent.appendChild(s.track);

  let scheduled: AnimationHandle | null = null;
  let ro: ResizeObserver | null = null;
  let detached = false;

  // ── Change-mark rail (vertical only) ─────────────────────────────────
  // The marks live INSIDE the vertical track, which widens to
  // `markersWidth` for as long as marks are showing (VS Code's overview
  // ruler is a widening of the same strip, not a second one). Consumers
  // that never pass markers keep byte-identical chrome.
  let track: HTMLElement | null = null;
  let markers: OverlayScrollbarMarker[] = [];
  /** The asymmetric document map, when the consumer provides one. */
  let scrollMap: ScrollMap | null = buildScrollMap(opts.mapSegments);
  let railDragging = false;
  /** Rail height the marks were last sized against — the pixel floor is a
   *  function of it, so a resize has to re-render them. */
  let renderedRailHeight = 0;

  /** The vertical track, found once and reused. */
  const verticalTrack = (): HTMLElement | null =>
    states.find((s) => !s.horizontal)?.track ?? null;

  /** Scroll so the rail position under `clientY` lands in the viewport —
   *  the same fraction → scrollTop mapping the track's own click uses, so
   *  a mark and the track at the same height agree. */
  function railScrollTo(clientY: number) {
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.height <= 0) return;
    const ratio = clamp01((clientY - rect.top) / rect.height);
    const { scrollSize, clientSize } = axisMetrics(viewport, false);
    if (scrollMap) {
      // The band is the DOCUMENT: a scrub walks map space and collapses
      // onto whatever dom position can present it.
      const mapStart = scrollMap.fracToMap(viewport.scrollTop / scrollSize);
      const mapEnd = scrollMap.fracToMap((viewport.scrollTop + clientSize) / scrollSize);
      const viewportMap = Math.max(mapEnd - mapStart, 1e-6);
      const mapPos = ratio * Math.max(scrollMap.total - viewportMap, 0);
      viewport.scrollTop = scrollMap.mapToFrac(mapPos) * scrollSize;
      return;
    }
    viewport.scrollTop = ratio * Math.max(scrollSize - clientSize, 0);
  }

  function onRailMove(e: MouseEvent) {
    if (railDragging) railScrollTo(e.clientY);
  }
  function onRailUp() {
    railDragging = false;
    track?.classList.remove("is-dragging");
    document.removeEventListener("mousemove", onRailMove);
    document.removeEventListener("mouseup", onRailUp);
  }
  function onRailDown(e: MouseEvent) {
    // Only a press ON a mark scrubs: the rest of the band keeps the
    // track's own click-to-page behaviour.
    const mark = (e.target as Element | null)?.closest?.(".hk-scrollbar-marker");
    if (!mark) return;
    e.preventDefault();
    // The band rides inside modals/panels that may dismiss on an outside
    // press — scrubbing a mark must not double as that press.
    e.stopPropagation();
    railDragging = true;
    track?.classList.add("is-dragging");
    railScrollTo(e.clientY);
    document.addEventListener("mousemove", onRailMove);
    document.addEventListener("mouseup", onRailUp);
  }

  function renderMarkers() {
    if (!track) return;
    // The thumb is a sibling that must stay on top of the marks (it slides
    // over them, VS Code's semi-transparent thumb over the ruler).
    track.querySelectorAll(":scope > .hk-scrollbar-marker").forEach((m) => m.remove());
    // Measured, not assumed: happy-dom and a `display:none` rail both
    // report 0, and the fraction floor is the honest answer there.
    const railH = track.clientHeight;
    renderedRailHeight = railH;
    const floor = railH > 0
      ? Math.max(MARKER_MIN_FRACTION, MARKER_MIN_PX / railH)
      : MARKER_MIN_FRACTION;
    for (const m of markers) {
      const size = Math.max(
        Math.abs(clamp01(m.end) - clamp01(m.start)),
        floor,
      );
      // Keep the whole mark inside the rail: a mark at the very end would
      // otherwise overflow the bottom, get clipped, and read as absent.
      const top = Math.max(
        Math.min(clamp01(m.start), clamp01(m.end), 1 - size),
        0,
      );
      const el = document.createElement("div");
      el.className = "hk-scrollbar-marker";
      if (m.kind) el.setAttribute("data-kind", m.kind);
      if (m.side) el.setAttribute("data-side", m.side);
      el.style.top = pct(top);
      el.style.height = pct(size);
      track.appendChild(el);
    }
  }

  /** Widen the track to the markers width (and back when they go away). */
  function applyBandWidth() {
    if (!track) return;
    if (markers.length === 0) {
      track.classList.remove("has-markers");
      track.style.width = "";
      return;
    }
    track.classList.add("has-markers");
    const w = Math.round(
      Math.min(Math.max(opts.markersWidth ?? DEFAULT_MARKERS_WIDTH, 8), 40),
    );
    track.style.width = `${w}px`;
  }

  // An arrow const, not a function declaration: the guard above narrows
  // `parent` to non-null, and only a closure created AFTER that narrowing
  // keeps it (a hoisted declaration may run at any time, so TS widens the
  // capture back to `HTMLElement | null`).
  /** Swap in a new fold state; the thumb re-derives on the next update. */
  const setMapSegments = (next: OverlayScrollMapSegment[]) => {
    if (detached) return;
    scrollMap = buildScrollMap(next);
    update();
  };

  const setMarkers = (next: OverlayScrollbarMarker[]) => {
    if (detached) return;
    markers = Array.isArray(next) ? next : [];
    track = verticalTrack();
    if (markers.length === 0) {
      // No marks = exactly the pre-marker chrome.
      track?.querySelectorAll(":scope > .hk-scrollbar-marker").forEach((m) => m.remove());
      applyBandWidth();
      onRailUp();
      return;
    }
    if (!wantV || !track) return;
    if (!track.dataset.markersWired) {
      track.dataset.markersWired = "true";
      track.addEventListener("mousedown", onRailDown);
    }
    applyBandWidth();
    renderMarkers();
    // The marks' visibility follows the track's own fit test.
    update();
  };

  function updateAxis(s: AxisState, horizontal: boolean) {
    const { scrollSize, clientSize, scrollPos } = axisMetrics(viewport, horizontal);
    if (scrollSize <= clientSize) {
      // Content fits — no bar at all. The marks live inside the track, so
      // hiding it hides them too: marks on a region that cannot scroll
      // would claim changes the reader can never reach.
      s.track.style.display = "none";
      return;
    }
    s.track.style.display = "";
    const trackSize = horizontal ? s.track.clientWidth : s.track.clientHeight;
    // Asymmetric map (vertical): the thumb's SIZE and POSITION are
    // document-space quantities — how much of the FILE the viewport shows
    // and where in the FILE it sits — while every input stays the real
    // DOM scroll the browser reports. A collapsed rung therefore shows as
    // the thumb sweeping its map range with (almost) no dom travel.
    let viewportMap = clientSize;
    let maxScroll = scrollSize - clientSize;
    let progressBase = scrollPos;
    if (!horizontal && scrollMap) {
      const mapStart = scrollMap.fracToMap(scrollPos / scrollSize);
      const mapEnd = scrollMap.fracToMap((scrollPos + clientSize) / scrollSize);
      viewportMap = Math.max(mapEnd - mapStart, 1e-6);
      maxScroll = Math.max(scrollMap.total - viewportMap, 0);
      progressBase = mapStart;
    }
    const ratio = viewportMap / (scrollMap && !horizontal ? scrollMap.total : scrollSize);
    const thumbSize = Math.max(ratio * trackSize, 20);
    const maxTrack = trackSize - thumbSize;
    // A right-to-left scroller starts with `scrollLeft` at 0 (showing the
    // content's right end) and counts DOWN to -maxScroll, so its progress is
    // the magnitude — and the thumb rests at the track's right end and
    // travels left, mirrored against the left-to-right bar.
    const rtl = isRtlAxis(viewport, horizontal);
    const progress = maxScroll > 0 ? Math.abs(progressBase) / maxScroll : 0;
    const offset = (rtl ? 1 - progress : progress) * maxTrack;
    if (horizontal) {
      s.thumb.style.width = `${thumbSize}px`;
      s.thumb.style.transform = `translateX(${offset}px)`;
    } else {
      s.thumb.style.height = `${thumbSize}px`;
      s.thumb.style.transform = `translateY(${offset}px)`;
    }
  }

  function update() {
    if (detached) return;
    for (const s of states) updateAxis(s, s.horizontal);
    // The marks' pixel floor is a fraction OF the band, so a height change
    // invalidates the sizes they were rendered with. A hidden band reports
    // 0 and is skipped here; `renderMarkers` leaves that 0 behind as its
    // "never sized against a real height" sentinel, so the first visible
    // update re-renders even when the height matches the last one used.
    const band = verticalTrack();
    const railH = band?.clientHeight ?? 0;
    if (band && markers.length > 0 && railH > 0 && railH !== renderedRailHeight) {
      renderMarkers();
    }
  }

  function scheduleUpdate() {
    scheduled?.disconnect();
    scheduled = scheduleFrame(() => {
      scheduled = null;
      update();
    });
  }

  /** Flash the track while scrolling; it fades out after a beat. */
  function flash(s: AxisState) {
    s.track.classList.add("is-scrolling");
    s.hideTimer?.disconnect();
    s.hideTimer = scheduleCronAfter(() => s.track.classList.remove("is-scrolling"), 1200);
  }

  function onScroll() {
    scheduleUpdate();
    for (const s of states) flash(s);
  }

  function makeDragHandlers(s: AxisState, horizontal: boolean) {
    const onMove = (e: MouseEvent) => {
      if (!s.dragging) return;
      const { scrollSize, clientSize } = axisMetrics(viewport, horizontal);
      // The pointer moves in DRAWN pixels while the track it is compared
      // against is laid out, so the delta is converted into the track's own
      // units first: a scaled or zoomed root would otherwise slide the thumb
      // `k` times further than the pointer went (see `layoutGeometry`).
      const drawnDelta = (horizontal ? e.clientX : e.clientY) - s.dragStartClient;
      const space = drawnScale(s.track);
      const factor = horizontal ? space.x : space.y;
      const delta = factor > 0 ? drawnDelta / factor : drawnDelta;
      // Mirror updateAxis's RENDER math exactly — the thumb is sized
      // against the TRACK box, so drag travel must divide by the same
      // numbers or the thumb slides out of sync under short tracks.
      // A zero track box counts as unmeasured (no-layout environments)
      // and falls back to the viewport box.
      const trackSize = horizontal ? s.track.clientWidth : s.track.clientHeight;
      const measured = trackSize > 0 ? trackSize : clientSize;
      const { scrollSize: sizeNow, clientSize: clientNow } = axisMetrics(viewport, horizontal);
      if (horizontal || !scrollMap) {
        // Dom-native drag (and every horizontal axis).
        const thumbSize = Math.max((clientNow / sizeNow) * measured, 20);
        const trackRange = measured - thumbSize;
        if (trackRange <= 0) return;
        const target = s.dragStartScroll + (delta / trackRange) * (sizeNow - clientNow);
        if (horizontal) viewport.scrollLeft = target;
        else viewport.scrollTop = target;
        return;
      }
      // Mapped drag: the pointer walks the thumb through DOCUMENT space;
      // `mapToFrac` collapses a rung the DOM cannot render into (almost)
      // one scrollTop — dragging across a collapsed region leaves the
      // content pinned at its divider until the range ends.
      const f0 = s.dragStartScroll / sizeNow;
      const mapStart = scrollMap.fracToMap(f0);
      const mapEnd = scrollMap.fracToMap((s.dragStartScroll + clientNow) / sizeNow);
      const viewportMap = Math.max(mapEnd - mapStart, 1e-6);
      const thumbSize = Math.max((viewportMap / scrollMap.total) * measured, 20);
      const trackRange = measured - thumbSize;
      if (trackRange <= 0) return;
      const mapPos = mapStart + (delta / trackRange) * (scrollMap.total - viewportMap);
      viewport.scrollTop = scrollMap.mapToFrac(mapPos) * sizeNow;
    };
    const onUp = () => {
      s.dragging = false;
      s.thumb.classList.remove("is-dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    const onDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      s.dragging = true;
      s.dragStartClient = horizontal ? e.clientX : e.clientY;
      s.dragStartScroll = horizontal ? viewport.scrollLeft : viewport.scrollTop;
      s.thumb.classList.add("is-dragging");
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
    return { onDown, onMove, onUp };
  }

  function attachAxis(s: AxisState) {
    const horizontal = s.horizontal;
    const { onDown, onMove, onUp } = makeDragHandlers(s, horizontal);
    const onTrackClick = (e: MouseEvent) => {
      if (e.target === s.thumb) return;
      const rect = s.track.getBoundingClientRect();
      const ratio = horizontal
        ? (e.clientX - rect.left) / rect.width
        : (e.clientY - rect.top) / rect.height;
      const { scrollSize, clientSize } = axisMetrics(viewport, horizontal);
      const max = scrollSize - clientSize;
      if (!horizontal && scrollMap) {
        // Clicking the band jumps the DOCUMENT to the clicked rung — the
        // same space the thumb lives in.
        const mapStart = scrollMap.fracToMap(viewport.scrollTop / scrollSize);
        const mapEnd = scrollMap.fracToMap((viewport.scrollTop + clientSize) / scrollSize);
        const viewportMap = Math.max(mapEnd - mapStart, 1e-6);
        const mapPos = ratio * Math.max(scrollMap.total - viewportMap, 0);
        viewport.scrollTop = scrollMap.mapToFrac(mapPos) * scrollSize;
        return;
      }
      if (horizontal) {
        // RTL: the track's left end is the content's END, and `scrollLeft`
        // runs 0 → −max (see the thumb mirroring in `update`), so a click at
        // `ratio` from the left asks for `(ratio - 1) * max`. Without this the
        // thumb and the click disagreed in RTL: the thumb was mirrored but the
        // click still mapped LTR, so clicking right of the thumb scrolled the
        // other way.
        const rtl = isRtlAxis(viewport, true);
        viewport.scrollLeft = rtl ? (ratio - 1) * max : ratio * max;
      } else viewport.scrollTop = ratio * max;
    };
    const onEnter = () => s.track.classList.add("is-hovering");
    const onLeave = () => s.track.classList.remove("is-hovering");
    s.thumb.addEventListener("mousedown", onDown);
    s.track.addEventListener("click", onTrackClick);
    s.track.addEventListener("mouseenter", onEnter);
    s.track.addEventListener("mouseleave", onLeave);
    return { onDown, onMove, onUp, onTrackClick, onEnter, onLeave };
  }

  const axisBindings = states.map((s) => ({ state: s, handlers: attachAxis(s) }));

  viewport.addEventListener("scroll", onScroll, { passive: true });
  ro = new ResizeObserver(scheduleUpdate);
  ro.observe(viewport);
  update();
  if (opts.markers?.length) setMarkers(opts.markers);

  return {
    update,
    setMapSegments,
    setMarkers,
    detach() {
      if (detached) return;
      detached = true;
      viewport.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      ro = null;
      scheduled?.disconnect();
      scheduled = null;
      onRailUp();
      for (const { state, handlers } of axisBindings) {
        state.thumb.removeEventListener("mousedown", handlers.onDown);
        state.track.removeEventListener("click", handlers.onTrackClick);
        state.track.removeEventListener("mouseenter", handlers.onEnter);
        state.track.removeEventListener("mouseleave", handlers.onLeave);
        state.track.removeEventListener("mousedown", onRailDown);
        delete state.track.dataset.markersWired;
        document.removeEventListener("mousemove", handlers.onMove);
        document.removeEventListener("mouseup", handlers.onUp);
        state.hideTimer?.disconnect();
        state.track.remove();
      }
      const entry = promotedParents.get(parent);
      if (entry && --entry.count <= 0) {
        // Last handle on this parent is gone — restore its inline
        // positioning exactly as the guard found it.
        parent.style.position = entry.saved;
        parent.removeAttribute(POSITION_GUARD_ATTR);
        promotedParents.delete(parent);
      }
    },
  };
}
