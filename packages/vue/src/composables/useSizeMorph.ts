import { onBeforeUnmount, type Ref } from "vue";

export interface SizeMorph {
  /** Arm the morph: observe the content and pin the frame's natural
   *  height on every change. Call once the surface finished its open
   *  enter transition — pinning during enter would override the
   *  choreography's own height animation. */
  start(): void;
  /** Disarm the morph and release the frame to `height: auto` — call
   *  before a surface's leave/close so the exit animation owns the
   *  height again. */
  stop(): void;
  /** Re-measure and pin now (resize events, open flows). */
  remeasure(): void;
}

/**
 * useSizeMorph — smooth size morphing for content-hugging surfaces.
 *
 * Modals and bottom sheets size themselves from their content
 * (`height: auto`), and CSS cannot fire a height transition for an
 * auto→auto growth — even under `interpolate-size: allow-keywords`
 * neither `auto` nor `calc-size(auto, size)` changes its computed value
 * when the content grows (verified in Chromium), so the frame simply
 * snaps. This composable closes the gap: a ResizeObserver on the content
 * reports every change, the frame's natural (capped) height is measured,
 * and it is pinned as an explicit px value so the frame's CSS height
 * transition animates old→new.
 *
 * Measurement uses a transition-disabled dance so the browser's
 * before/after style bookkeeping stays clean: transitions are switched
 * off while the pin is released/measured/restored (no animation, no
 * repaint inside the task — the intermediate frames are never painted),
 * the OLD pin is re-established first, and only then does the new pin
 * flip under the LIVE transition — a real computed-value change from the
 * old height, so the animation plays instead of snapping.
 *
 * The observer does no per-frame work at rest: it fires only on actual
 * content changes (bursts collapse into one rAF), and during a morph the
 * pin chases the target with the CSS transition — bounded, one-shot
 * choreography, not an infinite per-frame animation.
 *
 * Reduced motion / the global animation switch stay honored: the frame's
 * transition-duration collapses to one frame under
 * `html[data-css-animations="0"]`, so the pin updates snap.
 */
export function useSizeMorph(
  frame: Ref<HTMLElement | null | undefined>,
  content: Ref<HTMLElement | null | undefined>,
): SizeMorph {
  let ro: ResizeObserver | null = null;
  let raf = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let armed = false;
  /** Last pinned height (px) — the transition's "from" value. */
  let pinned = 0;

  function release(): void {
    const f = frame.value;
    if (f) f.style.height = "";
    pinned = 0;
  }

  function remeasure(): void {
    if (!armed) return;
    const f = frame.value;
    const c = content.value;
    if (!f || !c) return;
    // 1. Disable transitions, release the pin and measure the frame's
    //    natural (CSS-capped) height in one layout flush.
    // 2. Re-establish the OLD pin (still transition-disabled) and flush
    //    it, so the style history is exactly "old height" when the live
    //    CSS transition returns.
    // 3. Flip to the NEW pin under the live transition — the computed
    //    value changes old→new, so the height transition animates.
    // No paint happens between the steps: they run in one task and the
    // layout flushes are invisible to the screen.
    const inlineTransition = f.style.transition;
    f.style.transition = "none";
    f.style.height = "";
    const natural = f.offsetHeight;
    if (natural <= 0) {
      // Keep pre-transition state intact and bail.
      if (pinned > 0) f.style.height = `${pinned}px`;
      f.style.transition = inlineTransition;
      return;
    }
    if (pinned > 0) f.style.height = `${pinned}px`;
    // Flush the old-pin state before re-enabling the transition.
    void f.offsetHeight;
    f.style.transition = inlineTransition;
    f.style.height = `${Math.round(natural)}px`;
    pinned = Math.round(natural);
  }

  function onResize(): void {
    // Debounce the choreography: content can change in a burst (a list
    // transition shrinking rows over several frames, a textarea growing
    // per keystroke). Dancing to every intermediate would restart the
    // frame's transition mid-flight and cause backwards flicks; instead
    // measure once the content settled (~150ms quiet) and morph after.
    // A keystroke while the debounce runs just pushes the update later.
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        remeasure();
      });
    }, 150);
  }

  function start(): void {
    if (armed) return;
    armed = true;
    if (typeof ResizeObserver === "undefined" || !content.value) {
      remeasure();
      return;
    }
    ro = new ResizeObserver(onResize);
    ro.observe(content.value);
    remeasure();
  }

  function stop(): void {
    if (!armed) return;
    armed = false;
    ro?.disconnect();
    ro = null;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    release();
  }

  onBeforeUnmount(() => {
    ro?.disconnect();
    if (settleTimer) clearTimeout(settleTimer);
    if (raf) cancelAnimationFrame(raf);
  });

  return { start, stop, remeasure };
}
