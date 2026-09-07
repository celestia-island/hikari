import { onBeforeUnmount, type Ref } from "vue";

/** Chrome-allowance calibration constants (px): the floor covers a
 *  standard header+footer+borders stack (and bodies that overflow at
 *  arm time, where the resting delta goes negative and says nothing
 *  about chrome); the slack absorbs subpixel/border noise so the guard
 *  never trips on a legitimate measurement. */
const CHROME_ALLOWANCE_FLOOR = 96;
const CHROME_ALLOWANCE_SLACK = 32;

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
  /** Contamination allowance (px): how far the frame's natural height may
   *  exceed the content probe at rest — its own chrome (header, footer,
   *  borders, CSS min-height floors), captured at arm time, floored for
   *  bodies that overflow at rest, plus subpixel slack. See the guard in
   *  remeasure(). */
  let chromeAllowance = CHROME_ALLOWANCE_FLOOR + CHROME_ALLOWANCE_SLACK;

  function release(): void {
    const f = frame.value;
    if (f) f.style.height = "";
    pinned = 0;
  }

  /** Calibrate the chrome allowance from the resting (unpinned, enter
   *  finished) frame — the only moment guaranteed free of transition-class
   *  flex rules. Never calibrate from a remeasure sample: the first
   *  remeasure can itself be the contaminated one (a frozen enter leaves
   *  the flex rules behind when the surface is mid-repair). */
  function calibrate(): void {
    const f = frame.value;
    const c = content.value;
    if (!f || !c) return;
    const frameH = f.offsetHeight;
    const contentH = c.offsetHeight;
    chromeAllowance = frameH > 0 && contentH > 0 && frameH >= contentH
      ? Math.max(frameH - contentH, CHROME_ALLOWANCE_FLOOR) + CHROME_ALLOWANCE_SLACK
      : CHROME_ALLOWANCE_FLOOR + CHROME_ALLOWANCE_SLACK;
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
    //    layout flushes are invisible to the screen.
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
    // Contamination guard: at rest the frame can only be taller than the
    // content probe by its own chrome. A natural height past that bound
    // describes a mid-transition state (e.g. enter/leave-class
    // `flex: 0 0 auto` rules uncapping the scroll body) that never
    // exists at rest — pinning it would lock a blank shell at the
    // max-height cap (2026-09 mobile report: a 600px form pinned at
    // 1728px with ~1100px of empty body). A zero-height probe (no layout
    // engine, hidden content) validates nothing — fall through and pin.
    // On a trip, release to auto; the observer re-fires on the next
    // genuine content change.
    if (c.offsetHeight > 0 && natural > c.offsetHeight + chromeAllowance) {
      release();
      f.style.transition = inlineTransition;
      return;
    }
    if (pinned > 0) f.style.height = `${pinned}px`;
    // Flush the old-pin state before re-enabling the transition.
    void f.offsetHeight;
    f.style.transition = inlineTransition;
    f.style.height = `${Math.round(natural)}px`;
    pinned = Math.round(natural);
    // Self-heal the allowance on every VALIDATED pin: chrome that grew
    // after calibration (an async footer, a header slot mounting
    // mid-open) updates the baseline instead of tripping the guard on
    // the next change and silently disabling the morph for the cycle.
    const probeH = c.offsetHeight;
    if (probeH > 0 && natural >= probeH) {
      chromeAllowance =
        Math.max(natural - probeH, CHROME_ALLOWANCE_FLOOR) + CHROME_ALLOWANCE_SLACK;
    }
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
    // Calibrate before the first pin: at this point the surface finished
    // its enter (callers arm in after-enter) and sits at rest, so the
    // frame-vs-content delta is pure chrome.
    calibrate();
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
    // The next start() re-calibrates against whatever chrome that open
    // cycle carries.
    chromeAllowance = CHROME_ALLOWANCE_FLOOR + CHROME_ALLOWANCE_SLACK;
    release();
  }

  onBeforeUnmount(() => {
    ro?.disconnect();
    if (settleTimer) clearTimeout(settleTimer);
    if (raf) cancelAnimationFrame(raf);
  });

  return { start, stop, remeasure };
}
