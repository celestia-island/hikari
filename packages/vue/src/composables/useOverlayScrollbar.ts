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

import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import { scheduleFrame, type AnimationHandle } from "../runtime/animationBus";

/** Which axes get an overlay track. Defaults to "vertical". */
export type OverlayScrollbarAxis = "vertical" | "horizontal" | "both";

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
}

export interface OverlayScrollbarHandle {
  /** Re-read the viewport's scroll geometry and reposition the thumbs. */
  update(): void;
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
    return { update() {}, detach() {} };
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

  function updateAxis(s: AxisState, horizontal: boolean) {
    const { scrollSize, clientSize, scrollPos } = axisMetrics(viewport, horizontal);
    if (scrollSize <= clientSize) {
      // Content fits — no bar at all.
      s.track.style.display = "none";
      return;
    }
    s.track.style.display = "";
    const trackSize = horizontal ? s.track.clientWidth : s.track.clientHeight;
    const ratio = clientSize / scrollSize;
    const thumbSize = Math.max(ratio * trackSize, 20);
    const maxScroll = scrollSize - clientSize;
    const maxTrack = trackSize - thumbSize;
    const offset = maxScroll > 0 ? (scrollPos / maxScroll) * maxTrack : 0;
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
      const delta = (horizontal ? e.clientX : e.clientY) - s.dragStartClient;
      // Mirror updateAxis's RENDER math exactly — the thumb is sized
      // against the TRACK box, so drag travel must divide by the same
      // numbers or the thumb slides out of sync under short tracks.
      // A zero track box counts as unmeasured (no-layout environments)
      // and falls back to the viewport box.
      const trackSize = horizontal ? s.track.clientWidth : s.track.clientHeight;
      const measured = trackSize > 0 ? trackSize : clientSize;
      const thumbSize = Math.max((clientSize / scrollSize) * measured, 20);
      const trackRange = measured - thumbSize;
      if (trackRange <= 0) return;
      const target = s.dragStartScroll + (delta / trackRange) * (scrollSize - clientSize);
      if (horizontal) viewport.scrollLeft = target;
      else viewport.scrollTop = target;
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
      if (horizontal) viewport.scrollLeft = ratio * max;
      else viewport.scrollTop = ratio * max;
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

  return {
    update,
    detach() {
      if (detached) return;
      detached = true;
      viewport.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      ro = null;
      scheduled?.disconnect();
      scheduled = null;
      for (const { state, handlers } of axisBindings) {
        state.thumb.removeEventListener("mousedown", handlers.onDown);
        state.track.removeEventListener("click", handlers.onTrackClick);
        state.track.removeEventListener("mouseenter", handlers.onEnter);
        state.track.removeEventListener("mouseleave", handlers.onLeave);
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
