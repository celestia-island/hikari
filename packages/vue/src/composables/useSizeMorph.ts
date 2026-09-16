import { onBeforeUnmount, type Ref } from "vue";

/** Chrome-allowance calibration constants (px): the floor covers a
 *  standard header+footer+borders stack (and bodies that overflow at
 *  arm time, where the resting delta goes negative and says nothing
 *  about chrome); the slack absorbs subpixel/border noise so the guard
 *  never trips on a legitimate measurement. */
const CHROME_ALLOWANCE_FLOOR = 96;
const CHROME_ALLOWANCE_SLACK = 32;

/** Growth below this (px) snaps instead of revealing — under half a
 * text row the sweep is imperceptible and not worth promoting a
 * layer for. */
const REVEAL_MIN_PX = 3;

export interface SizeMorph {
  /** Arm the morph: observe the content and pin the frame's natural
   *  height on every change. Call once the surface finished its open
   *  enter transition — pinning during enter would override the
   *  choreography's own height animation. (Surfaces whose enter is
   *  height-INDEPENDENT — HkModal's clip+transform unfold — may arm
   *  earlier with a `deferRemeasure` gate, see below.) */
  start(): void;
  /** Disarm the morph and release the frame to `height: auto` — call
   *  before a surface's leave/close so the exit animation owns the
   *  height again. */
  stop(): void;
  /** Leave-window hold: disarm the observer/timers and cancel any
   *  mid-flight reveal like stop(), but KEEP the height pin — the close
   *  choreography owns the frame's geometry through the whole leave and
   *  the pin keeps it stable (a mid-leave content change must not resize
   *  the folding frame). The next start() re-arms and, because the pin
   *  was kept, a re-pin to the SAME natural height is a no-op (the
   *  typical reopen-interrupt case — held content is unchanged, delta
   *  zero; a re-pin to a CHANGED natural while an enter's transition
   *  classes own the frame lands without a height animation, i.e. snaps
   *  — acceptable, the enter's own choreography owns that moment). */
  hold(): void;
  /** Re-measure and pin now (resize events, open flows). */
  remeasure(): void;
}

export interface SizeMorphOptions {
  /** While this returns true, resize-driven re-measurements are deferred
   *  (the current pin stays). HkModal freezes the frame's height during
   *  the enter unfold: the choreography's translateY(5%) + bottom-10%
   *  clip are fractions of the frame height, so late-streaming content
   *  resizing the frame mid-enter would recompute the geometry under the
   *  running animation (2026-09-16 chest field report — the frame snapped
   *  459→697px mid-unfold). The caller flushes the deferred growth with
   *  an explicit remeasure() at the open edge. */
  deferRemeasure?: () => boolean;
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
 * Growth morphs on clip-mode surfaces (the mobile sheet docking, flagged
 * `--hk-sheet-morph: clip` in CSS) reveal instead of animating height:
 * the new pin lands instantly and the box's top edge sweeps up through
 * `clip-path: inset()` — same duration/ease tokens as the height
 * transition, same "content rides rigidly" grammar as the modal unveil,
 * but paint/compositor-level: no per-frame layout and no per-frame
 * backdrop-filter re-raster over the resizing fixed layer (the mobile
 * patchy-flicker source, 2026-09-15 chest report). Shrinks and every
 * height-mode surface keep the height transition — the rare direction
 * is not worth the flex-compression look-ahead trade.
 *
 * Reduced motion / the global animation switch stay honored: the frame's
 * transition-duration collapses to one frame under
 * `html[data-css-animations="0"]`, so the pin updates snap.
 */
export function useSizeMorph(
  frame: Ref<HTMLElement | null | undefined>,
  content: Ref<HTMLElement | null | undefined>,
  options: SizeMorphOptions = {},
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
  /** In-flight clip reveal (clip-mode growth morph): the frame whose
   *  inline clip-path/will-change must come off again once the sweep
   *  lands, plus the listener that does it. */
  let revealEl: HTMLElement | null = null;
  let revealEnd: ((ev: Event) => void) | null = null;

  /** Tear down an in-flight clip reveal: drop the listener and return
   *  the inline clip/will-change to CSS ownership. Safe to call when no
   *  reveal is running (every dance start, stop, and unmount). */
  function stopReveal(): void {
    if (revealEl && revealEnd) {
      revealEl.removeEventListener("transitionend", revealEnd);
    }
    if (revealEl) {
      revealEl.style.clipPath = "";
      revealEl.style.willChange = "";
    }
    revealEl = null;
    revealEnd = null;
  }

  /** Clip-mode opt-in, owned by CSS: the modal's mobile media block
   *  sets `--hk-sheet-morph: clip` inside its ≤767px query, and the
   *  select sheet sets it on its class rule directly (that class only
   *  renders in JS-gated sheet mode, so the breakpoint still owns the
   *  behavior); a host can override per surface either way (an inline
   *  custom property wins over the stylesheet's). */
  function clipMode(f: HTMLElement): boolean {
    const inline = f.style.getPropertyValue("--hk-sheet-morph").trim();
    if (inline) return inline === "clip";
    try {
      return getComputedStyle(f).getPropertyValue("--hk-sheet-morph").trim() === "clip";
    } catch {
      return false;
    }
  }

  /** The frame's corner radii for the reveal's `round` clause — the
   *  moving clip edge keeps the sheet's own rounded corners instead of
   *  shaving them straight for the sweep's duration. First token only
   *  (horizontal radius); non-px values degrade to square. */
  function cornerRadii(f: HTMLElement): string {
    let cs: CSSStyleDeclaration | null = null;
    try {
      cs = getComputedStyle(f);
    } catch {
      cs = null;
    }
    const first = (v: string | undefined): string => {
      const token = (v ?? "").trim().split(/\s+/)[0] ?? "";
      return token.endsWith("px") ? token : "0px";
    };
    return [
      first(cs?.borderTopLeftRadius),
      first(cs?.borderTopRightRadius),
      first(cs?.borderBottomRightRadius),
      first(cs?.borderBottomLeftRadius),
    ].join(" ");
  }

  function release(): void {
    const f = frame.value;
    if (f) f.style.height = "";
    stopReveal();
    pinned = 0;
  }

  /** Calibrate the chrome allowance from the resting (unpinned, enter
   *  finished) frame — the only moment guaranteed free of transition-class
   *  flex rules. Never calibrate from a remeasure sample: the first
   *  remeasure can itself be the contaminated one (a frozen enter leaves
   *  the flex rules behind when the surface is mid-repair). HkModal's
   *  reopen-interrupt arm violates the precondition on purpose (it
   *  calibrates a pinned, enter-classed frame): benign today because no
   *  current enter/leave class carries height/flex rules (the inline pin
   *  beats the mobile sheet's static height:auto), and the contamination
   *  guard below degrades any future SCSS regression to a dropped pin
   *  rather than a corrupted one. */
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
    // 2. Clip-mode growth: pin the NEW height outright and stage the
    //    clip start (still transition-disabled), so the reveal that
    //    follows sweeps a fully-laid-out box — layout happens once,
    //    here, never per frame.
    //    Otherwise re-establish the OLD pin (still transition-disabled)
    //    and flush it, so the style history is exactly "old height" when
    //    the live CSS transition returns.
    // 3. Flip to the new state under the live transition — a real
    //    computed-value change, so the CSS transition animates.
    // No paint happens between the steps: they run in one task and the
    //    layout flushes are invisible to the screen.
    const inlineTransition = f.style.transition;
    f.style.transition = "none";
    // A second content change mid-reveal restarts from the new delta
    // (the settle debounce already collapses bursts; this makes it a
    // hard guarantee that no stale clip survives into the new dance).
    stopReveal();
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
    const next = Math.round(natural);
    const growth = next - pinned;
    // Clip reveal (see the composable doc): the pin lands instantly and
    // the top edge sweeps up through paint-only clip-path, with the
    // box's own corner radii riding the moving edge. The frame's
    // stylesheet owns the clip-path transition (duration/ease tokens
    // shared with the height transition), so reduced-motion and the
    // global animation switch collapse it exactly like the height morph
    // they already govern. Everything else — shrink, first pin,
    // sub-threshold growth, height-mode surfaces — keeps the height
    // morph below (desktop stays exactly as it was).
    const reveal = pinned > 0 && growth >= REVEAL_MIN_PX && clipMode(f);
    let radii = "";
    if (reveal) {
      radii = cornerRadii(f);
      f.style.height = `${next}px`;
      f.style.clipPath = `inset(${growth}px 0 0 0 round ${radii})`;
    } else if (pinned > 0) {
      f.style.height = `${pinned}px`;
    }
    // Flush the staged state (new pin + clip start, or the old pin)
    // before re-enabling the transition, so the sweep starts from the
    // old visual edge / the height transition starts from the old pin.
    void f.offsetHeight;
    f.style.transition = inlineTransition;
    if (reveal) {
      const onEnd = (ev: Event): void => {
        // transitionend bubbles: a descendant animating its own
        // clip-path must not end the frame's reveal early.
        if (
          ev.target === f &&
          (ev as TransitionEvent).propertyName === "clip-path"
        ) {
          stopReveal();
        }
      };
      f.addEventListener("transitionend", onEnd);
      revealEl = f;
      revealEnd = onEnd;
      f.style.willChange = "clip-path";
      f.style.clipPath = `inset(0px 0 0 0 round ${radii})`;
    } else {
      f.style.height = `${next}px`;
    }
    pinned = next;
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
    // Frozen window (e.g. HkModal's enter unfold): keep the current pin;
    // the caller flushes the accumulated change with an explicit
    // remeasure() once the choreography hands the height back.
    if (options.deferRemeasure?.()) return;
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

  function hold(): void {
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
    stopReveal();
    // Deliberately no release(): the pin stays on the frame so the close
    // fold plays on a stable box, and a reopen interrupt animates from it.
  }

  function stop(): void {
    // Disarm only when armed — after hold() the morph is already
    // disarmed and only the release is owed. release() is internally
    // guarded (no pin / no frame → no-op), so a never-armed stop()
    // stays the no-op it always was.
    if (armed) hold();
    release();
  }

  onBeforeUnmount(() => {
    ro?.disconnect();
    if (settleTimer) clearTimeout(settleTimer);
    if (raf) cancelAnimationFrame(raf);
    stopReveal();
  });

  return { start, stop, hold, remeasure };
}
