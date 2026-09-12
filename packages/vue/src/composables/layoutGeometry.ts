/**
 * layoutGeometry — where things are LAID OUT, as opposed to where they are
 * DRAWN.
 *
 * A browser keeps two answers to "where is this element", and hikari's
 * interactions keep needing the first one:
 *
 * - the DRAWN box (`getBoundingClientRect`, `getClientRects`, `Range`,
 *   `elementFromPoint`): what the user sees, after every `transform`, zoom,
 *   drag lift, FLIP animation and transition in flight. Every one of those
 *   moves it.
 * - the LAYOUT box (`offsetLeft`, `offsetTop`, `offsetWidth`,
 *   `offsetHeight`, walked along the `offsetParent` chain, plus
 *   `scrollLeft`/`scrollTop`): where the engine put the element in the flow,
 *   in CSS pixels that no transform touches.
 *
 * The difference matters when a gesture has to compare an element that carries
 * a live transform against one that does not — a dragged chip against its
 * neighbours, a ghost against the strip it came from, an overlay against a
 * scrolled container — because the drawn box of the transformed element
 * answers a question about the transform rather than about the layout. These
 * helpers read the layout side and place it back in the viewport coordinates
 * the rest of a component measures in, so the two can be compared.
 *
 * Measured in Chromium (2026-09, the wave that introduced this file):
 *
 * - all four offset values are byte-identical under a transform on the element
 *   itself, on a transition mid-flight, and on any ancestor;
 * - a transform (or even `will-change: transform`) on an ancestor REBINDS
 *   `offsetParent`, so a chain must be re-read on every use and never cached;
 * - an offset is measured from the `offsetParent`'s PADDING edge (its border
 *   excluded, the child's margin included): a positioned `offsetParent`
 *   measures from that padding edge, while a `body` `offsetParent` is
 *   special-cased by Blink (static body → document space, positioned body →
 *   its border box). Walking BOTH the element and its frame to the same root
 *   and subtracting cancels every one of those conventions, which is why
 *   `layoutOffset` also reports whether the walk passed THROUGH the frame:
 *   only then is the difference measured from the frame's padding box, and
 *   only then does its border have to be added back;
 * - the four values are integers (rounded half-up, ~±0.5px per hop) while the
 *   computed `width`/`height` are fractional — `laidSize` takes the finer pair
 *   and rebuilds the border box the integer values measure in;
 * - `scrollLeft`/`scrollTop` are layout values too, so a scroll has to be
 *   applied in layout units and scaled with the content the frame holds.
 */

/** What places a coordinate: the frame's drawn box, its laid-out size (which
 *  no transform touches, so the two together are the scale it is drawn at)
 *  and the scroll that slides its content inside the box. */
export interface FrameMetrics {
  /** The frame's drawn border box, in viewport coordinates. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The frame's laid-out border box (`0` when it has no layout). */
  laidW: number;
  laidH: number;
  /** The frame's own scroll offsets. */
  scrollX: number;
  scrollY: number;
}

/** A border box in viewport coordinates. */
export interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A point in the layout space an element's ancestors share. */
export interface LayoutOffset {
  x: number;
  y: number;
  /** Whether the walk passed through the frame it was asked for. */
  through: boolean;
}

/** An element's border box in the layout space its ancestors share — the
 *  position CSS transforms do not move. `through` reports whether the walk
 *  passed through `frame`, which is what decides whether a caller has to add
 *  that frame's border back (see the file comment).
 *
 *  A chain that runs through something without offsets of its own (an element
 *  inside `<svg>`) sums to `NaN`: callers check `Number.isFinite` before
 *  placing anything with it. */
export function layoutOffset(el: HTMLElement, frame?: HTMLElement | null): LayoutOffset {
  let x = 0;
  let y = 0;
  let through = false;
  for (let node: HTMLElement | null = el; node; node = node.offsetParent as HTMLElement | null) {
    x += node.offsetLeft;
    y += node.offsetTop;
    if (node === frame) through = true;
  }
  return { x, y, through };
}

/** Where `el` sits inside `frame`'s content, in the frame's own layout units —
 *  the number a scroll offset has to be set to in order to bring the element's
 *  top/left edge to the frame's visible top/left (its padding edge).
 *
 *  `layoutOffset` sums a chain all the way to the document root, so using its
 *  result directly as a scroll target is off by the frame's own distance from
 *  that root: measured in Chromium, a frame sitting 310px down the page asked
 *  for 810 where the correct scroll offset was 500. Subtracting the frame's own
 *  sum cancels every offset convention along the way (see the file comment) and
 *  the result is scale-free, so it is the same number at zoom 1 and zoom 3
 *  while the drawn-box equivalent (`rect.top - frameRect.top + frame.scrollTop`)
 *  is `k` times too large at zoom `k`.
 *
 *  The frame's own border is excluded exactly when the walk passed THROUGH it
 *  (`through`): a positioned frame measures its children from its padding edge,
 *  so the difference does too, while a frame that is not in the chain (a
 *  `position: static` scroller) is measured from its border box. The result is
 *  the value `scrollTop`/`scrollLeft` want in both cases — those are offsets
 *  into the scrollable area, whose origin is the padding edge.
 *
 *  `y` (and `x`) are `NaN` when the chain cannot be added up or when `frame` is
 *  not an ancestor of `el` — the difference is meaningless then, and callers
 *  check `Number.isFinite` before scrolling with it. */
export function laidOffsetWithin(el: HTMLElement, frame: HTMLElement): LayoutOffset {
  const at = layoutOffset(el, frame);
  const of = layoutOffset(frame, null);
  const through = at.through;
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y) || !Number.isFinite(of.x) || !Number.isFinite(of.y)) {
    return { x: NaN, y: NaN, through };
  }
  if (el !== frame && !frame.contains(el)) return { x: NaN, y: NaN, through };
  return { x: at.x - of.x, y: at.y - of.y, through };
}

/** An element's laid-out BORDER box, as finely as the engine will report it.
 *  `offsetWidth`/`offsetHeight` are integers — they round, and half a pixel is
 *  a third of the line filter's entire tolerance — while the computed
 *  `width`/`height` are fractional. The computed pair describes the CONTENT
 *  box unless the element is `box-sizing: border-box`, so its padding and
 *  border are added back to reach the border box that `offsetWidth`,
 *  `getBoundingClientRect` and every measurement here uses. Anything
 *  unreadable (`auto` on an unrendered element, no layout at all) falls back
 *  to the integer pair. */
export function laidSize(el: HTMLElement): { w: number; h: number } {
  const style = getComputedStyle(el);
  const edge = (value: string): number => parseFloat(value) || 0;
  const size = (along: "w" | "h"): number => {
    const integer = along === "w" ? el.offsetWidth : el.offsetHeight;
    const computed = parseFloat(along === "w" ? style.width : style.height);
    if (!Number.isFinite(computed)) return integer;
    if (style.boxSizing === "border-box") return computed;
    const padding =
      along === "w"
        ? edge(style.paddingLeft) + edge(style.paddingRight)
        : edge(style.paddingTop) + edge(style.paddingBottom);
    const border =
      along === "w"
        ? edge(style.borderLeftWidth) + edge(style.borderRightWidth)
        : edge(style.borderTopWidth) + edge(style.borderBottomWidth);
    return computed + padding + border;
  };
  return { w: size("w"), h: size("h") };
}

/** How much bigger an element is DRAWN than it is laid out, per axis: the
 *  cumulative scale of every transform above it (its own included). `1` per
 *  axis when either side of the ratio cannot be read. */
export function drawnScale(el: HTMLElement): { x: number; y: number } {
  const rect = el.getBoundingClientRect();
  const laid = laidSize(el);
  return {
    x: laid.w > 0 && rect.width > 0 ? rect.width / laid.w : 1,
    y: laid.h > 0 && rect.height > 0 ? rect.height / laid.h : 1,
  };
}

/** Read a frame as it is right now (see `FrameMetrics`). */
export function frameMetrics(frame: HTMLElement): FrameMetrics {
  const rect = frame.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.top,
    w: rect.width,
    h: rect.height,
    laidW: frame.offsetWidth,
    laidH: frame.offsetHeight,
    scrollX: frame.scrollLeft,
    scrollY: frame.scrollTop,
  };
}

/** The scale a frame draws its content at, per axis (`1` when its laid-out
 *  size cannot be read). */
export function frameScale(box: FrameMetrics): { x: number; y: number } {
  return {
    x: box.laidW > 0 ? box.w / box.laidW : 1,
    y: box.laidH > 0 ? box.h / box.laidH : 1,
  };
}

/** Where a frame DRAWS a point that was laid out at `at` inside it, given the
 *  frame's metrics and the offset-chain sums of the element (`at`) and of the
 *  frame itself (`of`). This is the placement every helper here reduces to:
 *  the frame's drawn origin, plus its border when the element's chain ran
 *  through it (a positioned frame measures its children from its padding
 *  edge), plus the element's offset from that origin taken against the scroll
 *  the frame has since moved, all at the scale the frame is drawn at. */
export function placePoint(
  frame: HTMLElement,
  box: FrameMetrics,
  at: LayoutOffset,
  of: LayoutOffset,
): { x: number; y: number } {
  const scale = frameScale(box);
  const style = getComputedStyle(frame);
  const border = (edge: string, factor: number): number =>
    at.through ? (parseFloat(edge) || 0) * factor : 0;
  return {
    x: box.x + border(style.borderLeftWidth, scale.x) + (at.x - of.x - box.scrollX) * scale.x,
    y: box.y + border(style.borderTopWidth, scale.y) + (at.y - of.y - box.scrollY) * scale.y,
  };
}

/** The nearest ancestor of `el` that is actually LAID OUT. A layout box can
 *  only be measured inside a frame that has a box to measure it in: an element
 *  with `display: contents` generates none, and its children are laid out by
 *  the next box up — which is the frame their movement follows. A tree with no
 *  boxes anywhere (no layout engine, a test environment) walks out of
 *  ancestors and keeps the parent it started with. */
export function nearestLaidAncestor(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0 || node.offsetWidth > 0 || node.offsetHeight > 0) {
      return node;
    }
  }
  return el.parentElement;
}

/** The element's layout border box in VIEWPORT coordinates — where the layout
 *  says it is, whatever its own transform (or any transform above it) draws.
 *  `frame` defaults to the element's `offsetParent`; pass the box the caller
 *  measures against when that is a different element (a strip's frame, a
 *  scrolled container). `null` when nothing can be placed: no frame, a frame
 *  that is detached, a chain that cannot be added up, or a frame drawn with no
 *  size on an axis the box needs. */
export function layoutRect(el: HTMLElement, frame?: HTMLElement | null): LayoutRect | null {
  const target = (frame === undefined ? el.offsetParent : frame) as HTMLElement | null;
  if (!target || !target.isConnected) return null;
  const box = frameMetrics(target);
  const at = layoutOffset(el, target);
  const of = layoutOffset(target, null);
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return null;
  if (!Number.isFinite(of.x) || !Number.isFinite(of.y)) return null;
  const size = laidSize(el);
  if (!(size.w > 0) || !(size.h > 0)) return null;
  if (!(box.w > 0) || !(box.h > 0)) return null;
  const drawn = placePoint(target, box, at, of);
  const scale = frameScale(box);
  return {
    left: drawn.x,
    top: drawn.y,
    width: size.w * scale.x,
    height: size.h * scale.y,
  };
}
