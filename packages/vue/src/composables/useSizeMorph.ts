import { onBeforeUnmount, type Ref } from "vue";

import {
  reportTransition,
  scheduleFrame,
  type AnimationHandle,
} from "../runtime/animationBus";

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

/** Reveal warmup (bus frames): how long the staged clip holds before
 *  the sweep starts. The pin + clip start + `will-change` land in one
 *  task, so the promoted layer starts re-rastering the whole resized
 *  box immediately; holding the sweep for two frames lets that raster
 *  land before the moving edge reveals it. Starting the sweep in the
 *  staging task outran the raster thread on phone GPUs and the
 *  just-revealed band composited as black tiles (2026-09-21 chest
 *  field report, AddProviderWizard step growth). The staged clip keeps
 *  the new band hidden through the hold, so the visible geometry is
 *  the pre-growth sheet while warming — the wait itself is invisible. */
const REVEAL_WARMUP_FRAMES = 2;

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

export interface RideEntry {
  /** The element whose translateY must track the fold edge. */
  el: HTMLElement;
  /** Hold the element at its FINAL viewport position while the block
   *  rides: staged at the mirrored offset in BOTH directions (−delta on
   *  a reveal, +delta on a conceal — the layout sits at the other end of
   *  the sweep in each direction), gliding to zero as the sweep runs and
   *  landing exactly at the re-pinned geometry. The stepflow's entering
   *  body uses this: its content must never move as the fold sweeps
   *  (round-7 rejection), and a one-sided counter rode the block AND
   *  inherited the block's ride on shrinks — a 2×delta sink with a delta
   *  jump at the landing (2026-09-23 R1 rig finding). */
  counter?: boolean;
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
  /** Fold riders (2026-09-23 round-14 chest report): elements collected
   *  when a clip sweep is STAGED whose translateY must track the sweep's
   *  clip edge in lockstep. Without a ride the content tree sits at the
   *  sweep's LAYOUT geometry while the clip edge sweeps over it, so the
   *  moving edge slices through whatever crosses it — on the sheet that
   *  was the title bar (cut mid-text through the sweep) and, on shrinks,
   *  the whole column snapping down delta at the atomic re-pin. Riders
   *  start at their pre-morph visual offset in the SAME transition-
   *  disabled task that stages the clip (so the first painted frame is
   *  pixel-identical to the pre-morph one), then glide to zero-offset
   *  under a transform transition that mirrors the frame's own clip-path
   *  transition (same duration, same easing, flipped in the same task) —
   *  compositor-side and in exact lockstep with the edge. The settle
   *  clears them atomically with the frame's own landing. */
  collectRide?: () => RideEntry[];
  /** Clip-mode sweep staged: reports the sweep's direction and the pinned
   *  heights it runs between, at the moment the start state is committed
   *  (before the warmup). Hosts forward this to their content so it can
   *  position against the LANDING geometry instead of guessing: the cap
   *  makes `from − to` the only correct answer, and only the morph knows
   *  it (2026-09-22 stepflow verification finding — a content-side guess
   *  of the delta cut 276px off a capped sheet's outgoing step). */
  onSweepStage?: (info: {
    direction: "reveal" | "conceal";
    from: number;
    to: number;
    /** Identity of this sweep, echoed by onSweepSettle: a consumer that
     *  parks geometry for a fold must only release on ITS OWN sweep, since
     *  an interrupting dance publishes the interrupted sweep's settle. */
    sweep: number;
  }) => void;
  /** Clip-mode sweep landed: the frame is back at its rest geometry
   *  (transitionend, its own watchdog, or an interrupting dance). Content
   *  holding geometry for the sweep — e.g. a parked body waiting for the
   *  fold — must release it here; releasing on its own clock instead left
   *  the frame clipped for up to 334ms (same finding). */
  onSweepSettle?: (info: {
    /** The sweep this settle belongs to (see onSweepStage.sweep): every
     *  teardown — its own end, its watchdog, or an interrupting dance —
     *  publishes it, so a consumer holding geometry for one sweep can tell
     *  its own from another's. */
    sweep: number;
  }) => void;
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
 * Size morphs on clip-mode surfaces (the mobile sheet docking, flagged
 * `--hk-sheet-morph: clip` in CSS) ride paint-only clip-path in BOTH
 * directions — same duration/ease tokens as the height transition, same
 * "content rides rigidly" grammar as the modal unveil, but
 * compositor-level: no per-frame layout and no per-frame
 * backdrop-filter re-raster over the resizing fixed layer (the mobile
 * patchy-flicker source, 2026-09-15 chest report). Growth REVEALS: the
 * new pin lands instantly and the top edge sweeps up through the staged
 * inset — never in the staging task, a two-frame warmup
 * (REVEAL_WARMUP_FRAMES) lets the layer's raster land first
 * (2026-09-21 chest report — same-task starts revealed black tiles).
 * Shrink CONCEALS: the box keeps its old pin while the top edge folds
 * down through the closing inset, and an atomic re-pin (transition-off
 * height swap) lands the target when the sweep ends — restoring the
 * shrink animation the clip-path-only transition list had lost
 * (2026-09-21 chest report, round 5) without reintroducing a frame of
 * per-frame layout. The layer promotion is RESIDENT for the whole arm
 * cycle (applied at start(), cleared on hold/release): promoting at the
 * step-change moment cost a one-frame see-through as the old layer died
 * before the new one rastered (same report).
 * Height-mode surfaces (desktop) keep the height morph unchanged.
 *
 * Scheduling rides the shared animation context
 * (`runtime/animationBus`): the measurement hop and the reveal warmup
 * are bus one-shots (`scheduleFrame`), and the CSS sweep is reported
 * (`reportTransition`) so the bus keeps beating through it and the
 * runtime registry sees the load. The settle debounce stays a
 * real-time timer on purpose — it gates MEASUREMENT, not motion, and a
 * parked (reduced-motion) bus must never freeze layout by stalling it;
 * bus one-shots fire even parked, so every frame path still completes
 * and the motion collapse itself stays CSS-owned.
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
  let raf: AnimationHandle | null = null;
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
  /** In-flight clip morph (clip-mode size change): the frame whose inline
   *  clip-path must come off again once the sweep lands, the listener
   *  that does it, the warmup one-shot that starts the sweep, the sweep's
   *  bus transition report — and, for a CONCEAL (shrink), the target
   *  height the atomic re-pin lands when the sweep ends. */
  let revealEl: HTMLElement | null = null;
  let revealEnd: ((ev: Event) => void) | null = null;
  let revealWarmup: AnimationHandle | null = null;
  let revealReport: AnimationHandle | null = null;
  let revealDir: "reveal" | "conceal" | null = null;
  let concealTo: number | null = null;
  /** Sweep watchdog: transitionend is the normal closer, but a lost
   *  event (a WebView that skips clip-path end events entirely — the
   *  2026-09-21 round-6 regression: a none→inset() start point made
   *  Chromium drop the transition AND its events, freezing the sheet
   *  clipped at its old pin) must not freeze the frame forever. The
   *  timer fires the exact same landing path and is disarmed on every
   *  normal close. */
  let revealWatchdog: ReturnType<typeof setTimeout> | null = null;
  /** Resident layer promotion on clip-mode surfaces: applied at arm time
   *  and cleared on hold/release. Promoting at the STEP-change moment
   *  (0.55.38's per-sweep will-change) destroyed the old layer one frame
   *  before the new one had rastered — on the phone GPU the sheet read
   *  as a one-frame see-through flash exactly when the raster race had
   *  just been fixed (2026-09-21 chest report, round 5). Promoting once
   *  at open and KEEPING it means step morphs never cross a layer
   *  boundary at all. */
  let residentWill = false;
  /** Identity of the sweep currently staged/folding, echoed to consumers. */
  let sweepSeq = 0;
  let activeSweep = 0;
  /** A background (observer-driven) measurement arrived while a sweep was in
   *  flight: it is flushed once that sweep lands, because measuring through
   *  a live sweep tears it down and republishes its teardown as a landing. */
  let pendingMeasure = false;
  /** Riders of the sweep currently staged/folding (see collectRide): their
   *  inline transform/transition/will-change is owned by the sweep's own
   *  stage→flip→settle lifecycle and cleared atomically with the frame. */
  let rideEls: Array<{
    el: HTMLElement;
    counter?: boolean;
    /** The element's OWN computed transition shorthand, captured at stage
     *  time: the ride's inline override must keep those legs live — the
     *  stepflow's entering body is often MID-FADE when a shrink stages,
     *  and cancelling a running opacity transition snaps it to 1. */
    ownTransition: string;
  }> = [];

  /** Split a computed transition-list value at TOP-LEVEL commas only —
   *  `cubic-bezier(0.4, 0, 0.2, 1)` must survive as one token. */
  function splitTopLevel(value: string): string[] {
    const out: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (ch === "," && depth === 0) {
        out.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    out.push(value.slice(start).trim());
    return out.filter((token) => token !== "");
  }

  /** Compose the riders' transform transition as an exact mirror of the
   *  frame's own clip-path transition (same duration, same easing), so the
   *  ride and the edge stay in compositor lockstep. Read at the FLIP (the
   *  frame's inline transition is live again there, so the computed values
   *  are the ones the clip itself animates under); a zero/absent read
   *  (no layout engine, SSR) falls back to the sweep's resolved duration
   *  and the family's standard ease. */
  function clipTransitionMirror(f: HTMLElement, fallbackMs: number): string {
    let duration = `${fallbackMs}ms`;
    let easing = "cubic-bezier(0.4, 0, 0.2, 1)";
    try {
      const cs = getComputedStyle(f);
      const props = splitTopLevel(cs.transitionProperty ?? "");
      const idx = props.findIndex((p) => p === "clip-path");
      const durations = splitTopLevel(cs.transitionDuration ?? "");
      const easings = splitTopLevel(cs.transitionTimingFunction ?? "");
      const d = idx >= 0 ? durations[idx] : durations[0];
      if (d && /\d/.test(d) && !/^0s?$/i.test(d.replace(/\s/g, ""))) {
        duration = d;
      }
      const e = idx >= 0 ? easings[idx] : easings[0];
      if (e) easing = e;
    } catch {
      // Keep the family defaults.
    }
    return `transform ${duration} ${easing}`;
  }

  /** Compose the riders' inline transition: the element's OWN stylesheet
   *  transitions stay live (an override would cancel a running one — the
   *  entering step body is mid-fade when a shrink stages its ride), with
   *  the transform leg appended at the given clock. An element with no
   *  own transitions carries the transform leg alone. */
  function riderTransitionCss(own: string, transformLeg: string): string {
    if (!own || own === "none") return transformLeg;
    return `${own}, ${transformLeg}`;
  }

  /** The element's computed transition shorthand ("" when unreadable). */
  function ownTransitionOf(el: HTMLElement): string {
    try {
      const own = getComputedStyle(el).transition ?? "";
      return own === "none" ? "" : own;
    } catch {
      return "";
    }
  }

  /** Clear the riders atomically: the transform leg and the promotion
   *  come off with the element's own transitions kept live, one layout
   *  flush, then the inline transition itself is dropped — all inside
   *  the caller's already-atomic settle task, so the ride's zero-offset
   *  never animates on the way out. A conceal pairs this with
   *  finishConceal's re-pin: the layout drops delta while the ride's
   *  delta offset disappears — net zero, no visible step. */
  function clearRiders(): void {
    if (rideEls.length === 0) return;
    for (const r of rideEls) {
      // Transform is no longer in the list → the offset release is
      // instant; opacity (still listed with its own clock) keeps running.
      r.el.style.transition = r.ownTransition || "none";
      r.el.style.transform = "";
      r.el.style.willChange = "";
    }
    void frame.value?.offsetHeight;
    for (const r of rideEls) {
      r.el.style.transition = "";
    }
    rideEls = [];
  }

  /** Land a conceal atomically: pin the target height and clear the clip
   *  in one transition-disabled task. Called from the sweep's end, from
   *  stopReveal() when a conceal is interrupted, and from hold/release.
   *  Visually a no-op: the box top is exactly where the clip edge sits,
   *  so the pin swap paints nothing. */
  function finishConceal(f: HTMLElement): void {
    const inlineTransition = f.style.transition;
    f.style.transition = "none";
    if (concealTo != null) {
      f.style.height = `${concealTo}px`;
      pinned = concealTo;
    }
    f.style.clipPath = "";
    void f.offsetHeight;
    f.style.transition = inlineTransition;
    concealTo = null;
  }

  /** Tear down an in-flight clip morph: cancel the pending warmup and
   *  the bus report, drop the listener, and land the frame in its rest
   *  state — an interrupted conceal re-pins its target atomically
   *  (clearing the clip alone would pop the box back to full height for
   *  one frame); a reveal just clears the clip. The resident
   *  will-change is NOT touched here (it belongs to the arm cycle, see
   *  residentWill). Safe to call when nothing is running (every dance
   *  start, stop, and unmount). */
  function stopReveal(): void {
    if (revealWarmup) {
      revealWarmup.disconnect();
      revealWarmup = null;
    }
    if (revealReport) {
      revealReport.disconnect();
      revealReport = null;
    }
    if (revealWatchdog) {
      clearTimeout(revealWatchdog);
      revealWatchdog = null;
    }
    if (revealEl && revealEnd) {
      revealEl.removeEventListener("transitionend", revealEnd);
    }
    // The riders come off in the same atomic task as the frame's own
    // landing (see clearRiders): a conceal's re-pin then swaps the layout
    // under them with the offset already gone.
    clearRiders();
    if (revealEl) {
      if (revealDir === "conceal" && concealTo != null) {
        finishConceal(revealEl);
      } else {
        revealEl.style.clipPath = "";
      }
    }
    const hadSweep = revealEl !== null;
    const sweptId = activeSweep;
    revealEl = null;
    revealEnd = null;
    revealDir = null;
    concealTo = null;
    // The frame is at rest again (sweep end, its watchdog, or an
    // interrupting dance): content that parked geometry for the fold
    // releases it here, not on its own clock. The identity and the
    // interruption flag let a consumer tell its own landing from another
    // dance's teardown.
    if (hadSweep) {
      options.onSweepSettle?.({ sweep: sweptId });
    }
    if (pendingMeasure) {
      pendingMeasure = false;
      // The sweep is out of the way: flush the measurement it deferred. It
      // stays a BACKGROUND measurement — one bus frame later an explicit
      // announce may already have staged the successor fold, and an
      // interrupting flush would tear that down and replay it (real-engine
      // finding, the last intermittent race in this handshake).
      scheduleFrame(() => remeasure(false));
    }
  }

  /** Drop the resident layer promotion (hold / release paths). */
  function clearResidentWill(): void {
    if (!residentWill) return;
    residentWill = false;
    const f = frame.value;
    if (f) f.style.willChange = "";
  }

  /** The frame's computed clip-transition duration, for the bus report
   *  at sweep start: the sweep is CSS-owned, so without a report the
   *  bus goes quiet for its duration and starves concurrent entries
   *  (and the runtime registry under-reports load). Max across the
   *  duration list; falls back to the --duration-fast default when the
   *  read fails (SSR) or carries no time token. */
  function transitionDurationMs(f: HTMLElement): number {
    let raw = "";
    try {
      raw = getComputedStyle(f).transitionDuration;
    } catch {
      raw = "";
    }
    let max = 0;
    for (const m of raw.matchAll(/(\d+(?:\.\d+)?)(m?)s/g)) {
      max = Math.max(max, parseFloat(m[1]!) * (m[2] ? 1 : 1000));
    }
    return max > 0 ? max : 150;
  }

  /** Begin the actual sweep: attach the end listener, report the CSS
   *  transition to the bus so it keeps beating for the duration, and
   *  flip the clip to the sweep's END state under the live transition.
   *  A reveal opens the clip (inset(delta)→inset(0), the top edge
   *  sweeping up); a conceal closes it (inset(0)→inset(delta), the top
   *  edge folding down while the box itself stays pinned at the OLD
   *  height — the atomic re-pin lands in finishConceal when the sweep
   *  ends). Only ever called from the warmup's last frame — never
   *  synchronously from the dance (see REVEAL_WARMUP_FRAMES). */
  function startRevealSweep(
    f: HTMLElement,
    radii: string,
    dir: "reveal" | "conceal",
    insetPx: number,
  ): void {
    const onEnd = (ev: Event): void => {
      // transitionend bubbles: a descendant animating its own
      // clip-path must not end the frame's morph early.
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
    revealDir = dir;
    const durationMs = transitionDurationMs(f);
    revealReport = reportTransition(durationMs);
    // Watchdog (see revealWatchdog): same landing, forced, if the
    // transitionend never arrives.
    revealWatchdog = setTimeout(() => {
      if (revealEl === f && revealDir === dir) stopReveal();
    }, durationMs + 350);
    f.style.clipPath =
      dir === "reveal"
        ? `inset(0px 0 0 0 round ${radii})`
        : `inset(${insetPx}px 0 0 0 round ${radii})`;
    // The riders flip WITH the clip, in the same task, under a mirrored
    // transform transition — same duration, same easing, same start
    // moment, so the ride tracks the edge sample-for-sample. Their own
    // transition legs (an entering body mid-fade) stay live in the list.
    if (rideEls.length > 0) {
      const mirror = clipTransitionMirror(f, durationMs);
      for (const r of rideEls) {
        r.el.style.transition = riderTransitionCss(r.ownTransition, mirror);
        // Normal riders follow the edge (0 on a reveal, +delta down on a
        // conceal); a counter glides to zero in both directions — its
        // layout swap at the landing is exactly the ride it releases.
        const target = r.counter ? 0 : dir === "reveal" ? 0 : insetPx;
        r.el.style.transform = `translateY(${target}px)`;
      }
    }
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
    clearResidentWill();
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

  function remeasure(interrupt = true): void {
    if (!armed) return;
    if (!interrupt && revealEl !== null) {
      // A background measurement must never tear down a live sweep: doing so
      // republished the sweep's own teardown as its LANDING, so a consumer
      // parking geometry for that fold released it ~2ms in and the sheet
      // undid and replayed the fold (real-engine finding). The change is
      // measured as soon as the sweep lands instead.
      pendingMeasure = true;
      return;
    }
    const f = frame.value;
    const c = content.value;
    if (!f || !c) return;
    // 1. Disable transitions, release the pin and measure the frame's
    //    natural (CSS-capped) height in one layout flush.
    // 2. Clip-mode growth: pin the NEW height outright and stage the
    //    clip start (still transition-disabled), so the reveal that
    //    follows (after the warmup, started by the bus) sweeps a
    //    fully-laid-out box — layout happens once, here, never per frame.
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
    const delta = next - pinned;
    // Clip morphs (see the composable doc): on clip-mode surfaces BOTH
    // directions ride paint-only clip-path — growth REVEALS (pin the new
    // height outright, then sweep the top edge up through the staged
    // inset) and shrink CONCEALS (keep the old pin, then fold the top
    // edge down; the atomic re-pin lands when the sweep ends). No
    // per-frame layout in either direction; the frame's stylesheet owns
    // the clip-path transition (duration/ease tokens shared with the
    // height transition), so reduced-motion and the global animation
    // switch collapse both exactly like the height morph they govern.
    // First pin, sub-threshold deltas and height-mode surfaces keep the
    // height morph below (desktop stays exactly as it was).
    const reveal = pinned > 0 && delta >= REVEAL_MIN_PX && clipMode(f);
    const conceal = pinned > 0 && delta <= -REVEAL_MIN_PX && clipMode(f);
    let radii = "";
    if (reveal) {
      radii = cornerRadii(f);
      f.style.height = `${next}px`;
      f.style.clipPath = `inset(${delta}px 0 0 0 round ${radii})`;
    } else if (conceal) {
      radii = cornerRadii(f);
      // The box stays pinned at the OLD height, and the clip start is an
      // EXPLICIT inset(0) — not a cleared inline clip. Chromium does not
      // interpolate clip-path between none and inset(), so a none start
      // made the sweep jump to its end state and never fire
      // transitionend, freezing the sheet clipped at its old pin
      // (2026-09-21 round-6 regression report: "the top half is just cut
      // off and then it stays there"). inset(0)→inset(N) interpolates.
      f.style.height = `${pinned}px`;
      f.style.clipPath = `inset(0px 0 0 0 round ${radii})`;
    } else if (pinned > 0) {
      f.style.height = `${pinned}px`;
    }
    // Riders stage with the clip: they snap to their pre-morph visual
    // offset (a reveal's content block starts at its OLD position,
    // cancelling the instant re-layout the new pin caused; a conceal
    // starts at zero) so the first painted frame of the morph is
    // pixel-identical to the last one before it. A COUNTER stages at the
    // mirrored offset in both directions — its layout sits at the far
    // end of the sweep (final on a reveal, pre-collapse on a conceal),
    // so ±delta lands it at its final viewport position either way. The
    // transform leg is staged at a zero clock (instant) while the
    // element's OWN transition legs stay live; the promotion (will-change)
    // rides along here on purpose — the warmup that follows is exactly
    // the window the layer's raster needs before it moves.
    if (reveal || conceal) {
      rideEls = (options.collectRide?.() ?? []).map((entry) => ({
        el: entry.el,
        counter: entry.counter,
        ownTransition: ownTransitionOf(entry.el),
      }));
      for (const r of rideEls) {
        r.el.style.transition = riderTransitionCss(r.ownTransition, "transform 0s");
        r.el.style.willChange = "transform";
        // The counter's stage is −delta in BOTH directions: on a reveal
        // (delta>0) that is the pre-growth offset down; on a conceal
        // (delta<0) it is the collapsed layout's missing height up.
        const startPx = r.counter ? -delta : reveal ? delta : 0;
        r.el.style.transform = `translateY(${startPx}px)`;
      }
    }
    // Flush the staged state (new pin + clip start, or the old pin)
    // before re-enabling the transition, so the sweep starts from the
    // old visual edge / the height transition starts from the old pin.
    void f.offsetHeight;
    f.style.transition = inlineTransition;
    if (reveal || conceal) {
      // Warmup (see REVEAL_WARMUP_FRAMES): hold the staged state for two
      // bus frames so the layer's raster lands before the edge moves;
      // the sweep itself starts from the bus. The layer is ALREADY
      // promoted (resident will-change since start()), so the warmup
      // costs no layer churn. Bus one-shots fire even while the bus is
      // parked for reduced motion — they are scheduling primitives, not
      // motion; the motion collapse stays CSS-owned
      // (transition-duration → one frame), so a parked bus still lands
      // the sweep instantly and transitionend cleans up exactly as
      // before.
      revealEl = f;
      revealDir = reveal ? "reveal" : "conceal";
      concealTo = conceal ? next : null;
      // Publish the sweep's real span (see onSweepStage): this is the only
      // place where the cap is already accounted for, so a host content
      // choreography can park against the landing instead of a guess.
      activeSweep = ++sweepSeq;
      options.onSweepStage?.({
        direction: revealDir,
        from: pinned,
        to: next,
        sweep: activeSweep,
      });
      const dir = revealDir;
      const insetPx = Math.abs(delta);
      let framesLeft = REVEAL_WARMUP_FRAMES;
      const armWarmup = (): void => {
        revealWarmup = scheduleFrame(() => {
          revealWarmup = null;
          // Torn down mid-warmup (new dance / hold / stop / unmount).
          if (revealEl !== f || revealDir !== dir) return;
          if (--framesLeft > 0) {
            armWarmup();
            return;
          }
          startRevealSweep(f, radii, dir, insetPx);
        });
      };
      armWarmup();
    } else {
      f.style.height = `${next}px`;
    }
    if (!conceal) {
      // The pin bookkeeping is immediate for reveals (the box already
      // sits at the new height) and snaps (nothing animates). A conceal
      // keeps the OLD pin until finishConceal() lands the target — a
      // mid-flight remeasure must see the still-visual height as its
      // "from".
      pinned = next;
    }
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
      // Frame work rides the shared bus; the settle debounce above
      // deliberately stays a real-time timer — it gates MEASUREMENT,
      // not motion, and a parked (reduced-motion) bus must never freeze
      // the layout by stalling a bus-ridden interval. One-shots fire
      // even parked, so this hop is safe in every motion state.
      raf = scheduleFrame(() => {
        raf = null;
        remeasure(false);
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
    // Resident promotion on clip-mode surfaces (see residentWill): the
    // layer crosses no boundary during later step morphs. Applied here,
    // at the open edge — one promotion per open cycle instead of one
    // per resize.
    const f0 = frame.value;
    if (f0 && clipMode(f0)) {
      f0.style.willChange = "clip-path";
      residentWill = true;
    }
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
      raf.disconnect();
      raf = null;
    }
    // The next start() re-calibrates against whatever chrome that open
    // cycle carries.
    chromeAllowance = CHROME_ALLOWANCE_FLOOR + CHROME_ALLOWANCE_SLACK;
    stopReveal();
    pendingMeasure = false;
    // The leave fold no longer clips; drop the resident promotion with
    // it (start() re-applies on the next open).
    clearResidentWill();
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
    if (raf) raf.disconnect();
    stopReveal();
    clearResidentWill();
  });

  return { start, stop, hold, remeasure };
}
