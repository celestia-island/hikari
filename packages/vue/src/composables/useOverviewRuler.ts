import {
  scheduleCronAfter,
  type CronHandle,
} from "../runtime/cronBus";
import { scheduleFrame, type AnimationHandle } from "../runtime/animationBus";
import { laidOffsetWithin } from "./layoutGeometry";

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
 *   - "jump" (default): pointer down anywhere on the strip scrolls that
 *     content position under the pointer, then keeps dragging (双向可拖动
 *     — both the cursor and a strip click steer the scroll);
 *   - "thumb": only the cursor box is draggable; strip clicks are inert.
 *
 * Sampling: bands are harvested from `bandSelector` matches inside the
 * viewport (default: direct children). Each band's extent is its offset
 * share of the content extent; bands shorter than `minBandPx` still render
 * (a waterfall that drops short lines misrepresents density). Caller-driven
 * content (virtualized rows, a canvas terminal) should pass `bandSelector`
 * for whatever stands in for lines, or drive `setBands` directly with
 * fractions.
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
  /** Selector harvested INSIDE the viewport for band sources. Default:
   *  the viewport's direct element children. */
  bandSelector?: string;
  /** Cursor behaviour: "jump" (default) = strip pointer down jumps then
   *  drags; "thumb" = only the cursor box is draggable. */
  cursorDrag?: OverviewRulerCursorMode;
  /** Element the strip is appended to — its positioning context. Same
   *  contract as OverlayScrollbarOptions.host: a box wrapping exactly the
   *  viewport. Defaults to the viewport's DOM parent. */
  host?: HTMLElement;
  /** Sampling cadence for content changes, in ms. Content that only grows
   *  (a log) triggers on scroll-end anyway; virtualized content churns
   *  every frame — 250ms keeps the strip honest without thrashing.
   *  Default 250. */
  resampleMs?: number;
}

export interface OverviewRulerHandle {
  /** Resample the bands and reposition the cursor. */
  update(): void;
  /** Replace the sampled bands with caller fractions (virtualized or
   *  canvas content). An empty list clears the waterfall. */
  setBands(bands: OverviewRulerBand[]): void;
  /** Remove the strip and every listener/observer. Safe to call twice. */
  detach(): void;
}

/** Clamp to [0, 1]; a band outside the content extent is caller noise and
 *  would render outside the strip. */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** A band box as inline styles: position + size on the strip axis. */
function bandStyle(
  axis: OverviewRulerAxis,
  startFrac: number,
  lengthFrac: number,
): Partial<CSSStyleDeclaration> {
  const pos = `${Number((clamp01(startFrac) * 100).toFixed(4))}%`;
  const len = `${Number((Math.max(clamp01(lengthFrac), 0.002) * 100).toFixed(4))}%`;
  return axis === "vertical"
    ? { top: pos, height: len }
    : { left: pos, width: len };
}

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
  // A captured const: TS's closure narrowing keeps this non-null for every
  // function below (the early return already excluded the null case).
  const host: HTMLElement = parent;

  const strip = document.createElement("div");
  strip.className = "hk-overview-ruler";
  strip.dataset.axis = axis;
  strip.dataset.side = opts.side ?? "end";
  strip.style.setProperty(
    "--hk-overview-ruler-thickness",
    `${thickness}px`,
  );
  strip.setAttribute("aria-hidden", "true");

  const cursor = document.createElement("div");
  cursor.className = "hk-overview-ruler-cursor";
  strip.appendChild(cursor);

  const bandsHost = document.createElement("div");
  bandsHost.className = "hk-overview-ruler-bands";
  strip.appendChild(bandsHost);

  parent.appendChild(strip);

  // Positioning guard: the strip is position:absolute inside the host —
  // same reference-counted promotion contract as the overlay scrollbar.
  let promoted = false;
  let prevPosition = "";
  if (getComputedStyle(parent).position === "static") {
    prevPosition = parent.style.position;
    parent.style.position = "relative";
    promoted = true;
  }

  const contentExtent = (): number =>
    horizontal
      ? Math.max(viewport.scrollWidth, viewport.clientWidth)
      : Math.max(viewport.scrollHeight, viewport.clientHeight);

  const visibleExtent = (): number =>
    horizontal ? viewport.clientWidth : viewport.clientHeight;

  /** Bands from the DOM: one per `bandSelector` match (default direct
   *  element children), positioned by its offset in the content extent. */
  function sampleDomBands(): OverviewRulerBand[] {
    const extent = contentExtent();
    if (extent <= 0) return [];
    const nodes = opts.bandSelector
      ? Array.from(viewport.querySelectorAll<HTMLElement>(opts.bandSelector))
      : Array.from(viewport.children).filter(
          (n): n is HTMLElement => n instanceof HTMLElement,
        );
    const scroll = horizontal ? viewport.scrollLeft : viewport.scrollTop;
    const bands: OverviewRulerBand[] = [];
    for (const node of nodes) {
      const laid = laidOffsetWithin(node, viewport);
      if (!Number.isFinite(laid.x) || !Number.isFinite(laid.y)) continue;
      const laidCoord = horizontal ? laid.x : laid.y;
      const start = (laidCoord + scroll) / extent;
      const length = (horizontal ? node.offsetWidth : node.offsetHeight) / extent;
      if (length <= 0) continue;
      bands.push({ start, length });
    }
    return bands;
  }

  let manualBands: OverviewRulerBand[] | null = null;

  function renderBands() {
    const bands = manualBands ?? sampleDomBands();
    bandsHost.textContent = "";
    for (const band of bands) {
      const el = document.createElement("div");
      el.className = "hk-overview-ruler-band" + (band.modifier ? ` ${band.modifier}` : "");
      const style = bandStyle(axis, band.start, band.length);
      for (const [k, v] of Object.entries(style)) {
        el.style.setProperty(k, v as string);
      }
      bandsHost.appendChild(el);
    }
  }

  /** The visible window as a fraction pair, clamped into [0,1]. */
  function windowFractions(): { start: number; length: number } {
    const extent = contentExtent();
    const visible = visibleExtent();
    const scroll = horizontal ? viewport.scrollLeft : viewport.scrollTop;
    if (extent <= 0 || visible <= 0) return { start: 0, length: 1 };
    const length = Math.min(visible / extent, 1);
    const maxScroll = Math.max(extent - visible, 0);
    const start = maxScroll > 0 ? Math.min(scroll / maxScroll, 1) : 0;
    return { start, length };
  }

  function renderCursor() {
    const { start, length } = windowFractions();
    const style = bandStyle(axis, start, length);
    if (axis === "vertical") {
      cursor.style.top = style.top as string;
      cursor.style.height = style.height as string;
    } else {
      cursor.style.left = style.left as string;
      cursor.style.width = style.width as string;
    }
  }

  function update() {
    if (manualBands) renderBands();
    else renderBands();
    renderCursor();
  }

  // Strip geometry along the drag axis, for pointer→fraction math.
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

  function scrollToFraction(fraction: number) {
    const extent = contentExtent();
    const visible = visibleExtent();
    const maxScroll = Math.max(extent - visible, 0);
    const target = fraction * maxScroll;
    if (horizontal) viewport.scrollLeft = target;
    else viewport.scrollTop = target;
  }

  let dragging = false;
  let dragStartClient = 0;
  let dragStartScroll = 0;
  let dragStartFraction = 0;

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const fraction = pointerFraction(event);
    if (cursorDrag === "thumb") {
      // Only the cursor box is draggable.
      const path = event.composedPath();
      if (!path.includes(cursor)) return;
      dragStartFraction = windowFractions().start;
    } else {
      scrollToFraction(fraction);
      dragStartFraction = fraction;
    }
    dragging = true;
    dragStartClient = horizontal ? event.clientX : event.clientY;
    dragStartScroll = horizontal ? viewport.scrollLeft : viewport.scrollTop;
    strip.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return;
    const rect = strip.getBoundingClientRect();
    const extent = stripExtent();
    if (extent <= 0) return;
    const coord = horizontal ? event.clientX - rect.left : event.clientY - rect.top;
    const fraction = Math.min(Math.max(coord / extent, 0), 1);
    if (cursorDrag === "thumb") {
      const delta = (horizontal ? event.clientX : event.clientY) - dragStartClient;
      const scrollable = Math.max(contentExtent() - visibleExtent(), 0);
      const target = dragStartScroll + (delta / extent) * scrollable;
      if (horizontal) viewport.scrollLeft = target;
      else viewport.scrollTop = target;
    } else {
      scrollToFraction(fraction);
    }
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
  strip.addEventListener("pointermove", onPointerMove);
  strip.addEventListener("pointerup", onPointerUp);
  strip.addEventListener("pointercancel", onPointerUp);

  viewport.addEventListener("scroll", onViewportScroll, { passive: true });

  let frame: AnimationHandle | null = null;
  function onViewportScroll() {
    if (frame) return;
    frame = scheduleFrame(() => {
      frame = null;
      renderCursor();
    });
  }

  // Content churn: logs grow, virtualized rows recycle. A cron sample keeps
  // the waterfall honest without a MutationObserver per child.
  let cron: CronHandle | null = null;
  cron = scheduleCronAfter(() => {
    if (!manualBands) renderBands();
    renderCursor();
  }, resampleMs);

  function detach() {
    viewport.removeEventListener("scroll", onViewportScroll);
    strip.removeEventListener("pointerdown", onPointerDown);
    strip.removeEventListener("pointermove", onPointerMove);
    strip.removeEventListener("pointerup", onPointerUp);
    strip.removeEventListener("pointercancel", onPointerUp);
    cron?.disconnect();
    frame?.disconnect();
    strip.remove();
    if (promoted) host.style.position = prevPosition;
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
