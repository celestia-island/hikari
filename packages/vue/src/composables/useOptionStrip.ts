/**
 * useOptionStrip — the one-line pannable option track behind
 * HkPillToggleGroup's strip mode. Upstreamed from wowsp's optionStrip
 * (the 水表 filter bar's nation popup and every FilterCategoryChip
 * popup, 2026-10-11 direction: the pill groups must pan with edge
 * fades, not wrap). One module owns:
 *
 *   - the wheel→horizontal pan rule (a real horizontal delta wins; a
 *     vertical notch is translated onto the strip; Firefox line mode is
 *     normalized — mirrors HkScrollContainer's wheel rule);
 *   - the mouse drag-pan (pointer capture + the 5px click/pan threshold;
 *     the click a pan leaves behind is swallowed exactly once, so panning
 *     never toggles an option);
 *   - the overflow-side sensing behind the edge fades: the strip mirrors
 *     HkScrollContainer's `data-h-overflow` contract (which inline edges
 *     still hide content), and the host SCSS turns the value into the
 *     matching mask-image gradients.
 *
 * The track element itself stays owned by the host component (its
 * classes and sheet-mode overrides live there); the composable only
 * wires listeners while the element is mounted.
 */
import { onBeforeUnmount, ref, watch, type Ref } from "vue";

/** Firefox line-height wheel mode (deltaMode 1): one notch reports ~3
 *  lines, not pixels — normalized here so a notch pans a wheel-like
 *  distance on every engine (40px/line, the classic WebKit line height).
 *  Page mode (deltaMode 2, effectively extinct) passes through raw. */
export const WHEEL_LINE_PX = 40;

/** Horizontal pan distance for a wheel gesture over the strip: a real
 *  horizontal wheel/trackpad swipe (deltaX — shift+wheel reports as
 *  deltaX natively too) wins; a plain vertical wheel notch is translated
 *  onto the horizontal axis instead. */
export function stripWheelDelta(deltaMode: number, deltaX: number, deltaY: number): number {
  const raw = deltaX !== 0 ? deltaX : deltaY;
  return deltaMode === 1 ? raw * WHEEL_LINE_PX : raw;
}

/** Press→pan decision for the strip drag: once the pointer strays
 *  ≥ threshold px on EITHER axis the press turns into a pan; below it the
 *  gesture stays a click (and clicks must keep toggling options). */
export function panEngaged(dx: number, dy: number, threshold: number): boolean {
  return Math.abs(dx) >= threshold || Math.abs(dy) >= threshold;
}

/** Which inline edges of a strip still hide content — the value mirrored
 *  onto the element as `data-h-overflow` (HkScrollContainer's contract;
 *  the SCSS maps each value to its edge-fade mask). Sub-pixel scroll
 *  offsets count as resting at the edge. RTL flips the visual sides; the
 *  family ships LTR only. */
export type OverflowSides = "none" | "start" | "end" | "both";

export function overflowSides(el: HTMLElement): OverflowSides {
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 0) return "none";
  const EDGE_PX = 1;
  const atStart = el.scrollLeft <= EDGE_PX;
  const atEnd = max - el.scrollLeft <= EDGE_PX;
  if (atStart && atEnd) return "none";
  return atStart ? "end" : atEnd ? "start" : "both";
}

/** Wire one strip element with the pan + fade machinery. The host binds
 *  `stripEl` (template ref), mirrors `panning` into `data-panning`, and
 *  attaches `onPointerDown`; the non-passive wheel listener, the
 *  capture-phase click swallow and the overflow sensing ride the ref
 *  transitions here (a JSX onWheel prop is passive in some paths and
 *  could not preventDefault, and JSX has no capture-phase click prop). */
export function useOptionStrip() {
  const stripEl: Ref<HTMLElement | null> = ref(null);
  const panning = ref(false);
  const PAN_THRESHOLD = 5;
  let pressX = 0;
  let pressY = 0;
  let lastX = 0;
  let armed = false;
  /** Set when a gesture turned into a pan: the trailing click (and only
   *  that one) must not toggle an option. */
  let dragged = false;
  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;

  /** Re-read the overflow sides and mirror them onto the element. Fires
   *  on scroll, on element resizes and on content mutations (options
   *  re-rendering can change the track's scroll width). */
  function sense() {
    const el = stripEl.value;
    if (!el) return;
    const sides = overflowSides(el);
    if (sides === "none") delete el.dataset.hOverflow;
    else el.dataset.hOverflow = sides;
  }

  function onWheel(e: WheelEvent) {
    const el = stripEl.value;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const delta = stripWheelDelta(e.deltaMode, e.deltaX, e.deltaY);
    if (delta === 0) return;
    const prev = el.scrollLeft;
    el.scrollLeft += delta;
    // A saturated edge lets the wheel keep scrolling the page behind.
    if (el.scrollLeft !== prev) e.preventDefault();
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    // A pan released off-strip leaves no click behind; clear the stale
    // swallow flag so this press's own click always lands.
    dragged = false;
    pressX = lastX = e.clientX;
    pressY = e.clientY;
    armed = false;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    window.addEventListener("pointercancel", onPointerCancel, { once: true });
  }

  function onPointerMove(e: PointerEvent) {
    if (!armed) {
      if (!panEngaged(e.clientX - pressX, e.clientY - pressY, PAN_THRESHOLD)) return;
      // Engage: capture the pointer so the pan keeps tracking off-panel,
      // flag the strip (grabbing cursor + selection off) and arm the
      // one-shot click swallow — with capture held, the trailing click
      // retargets to the strip anyway, never onto an option.
      armed = true;
      panning.value = true;
      dragged = true;
      stripEl.value?.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    const el = stripEl.value;
    if (!el) return;
    el.scrollLeft -= e.clientX - lastX;
    lastX = e.clientX;
  }

  function teardownPress() {
    armed = false;
    panning.value = false;
    window.removeEventListener("pointermove", onPointerMove);
  }

  function onPointerUp() {
    teardownPress();
  }

  function onPointerCancel() {
    // A cancelled gesture never leaves a click — no swallow to hold.
    dragged = false;
    teardownPress();
  }

  /** The click a completed pan leaves behind must never toggle an
   *  option: swallowed exactly once, capture phase (ahead of every
   *  option handler). Plain clicks pass untouched. */
  function onClickCapture(e: MouseEvent) {
    if (!dragged) return;
    dragged = false;
    e.stopPropagation();
  }

  /** A host popup that closed before the pan's trailing click (window
   *  blur mid-drag — pointerup lost) must not carry the swallow flag
   *  into the reopened panel. */
  function resetDragged() {
    dragged = false;
  }

  watch(stripEl, (el, prev) => {
    prev?.removeEventListener("wheel", onWheel);
    prev?.removeEventListener("click", onClickCapture, true);
    prev?.removeEventListener("scroll", sense);
    resizeObserver?.disconnect();
    resizeObserver = null;
    mutationObserver?.disconnect();
    mutationObserver = null;
    if (el) {
      el.addEventListener("wheel", onWheel, { passive: false });
      el.addEventListener("click", onClickCapture, true);
      el.addEventListener("scroll", sense, { passive: true });
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(sense);
        resizeObserver.observe(el);
      }
      if (typeof MutationObserver !== "undefined") {
        mutationObserver = new MutationObserver(sense);
        mutationObserver.observe(el, { childList: true, subtree: true });
      }
      sense();
    }
  });
  onBeforeUnmount(() => {
    teardownPress();
    // Full listener teardown: a component unmounting mid-pan must not
    // leave listeners behind on the strip element or the window's
    // once-listeners unheld.
    const el = stripEl.value;
    el?.removeEventListener("wheel", onWheel);
    el?.removeEventListener("click", onClickCapture, true);
    el?.removeEventListener("scroll", sense);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
  });

  return { stripEl, panning, onPointerDown, resetDragged };
}
