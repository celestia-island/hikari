import {
  defineComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type PropType,
} from "vue";

import HkTimeline from "./HkTimeline";
import type { TimelineCollapse, TimelineStep } from "./HkTimeline";
import { SCROLL_HOST_CLASS } from "./HkScrollPin";
import {
  reportTransition,
  scheduleFrame,
  type AnimationHandle,
} from "../runtime/animationBus";

// Sticky header mode rides the shared scroll-pin contract (class + data
// attributes on the timeline root); the pin stylesheet ships those
// styles, so it is imported here directly.
import "./HkScrollPin.scss";
import "./HkStepFlow.scss";

/** Scoped argument every step-keyed slot receives. */
export interface StepFlowSlotProps {
  /** Step key this slot renders for (equals the current modelValue). */
  key: string;
  /** Zero-based position of the step inside `steps`. */
  index: number;
  /** Which way navigation moved compared to the previous value. */
  direction: "forward" | "back";
}

/** One rendered body: the active step plus, during a swap, the leaving one. */
interface BodyEntry {
  /** Unique mount id — the v-for key, so a re-entering step remounts. */
  id: number;
  /** The step key this body renders. */
  key: string;
  /** `active` bodies sit in the flow; a `leaving` body is out of flow
   *  (absolutely positioned) for the exit phase. */
  phase: "active" | "leaving";
}

/** A swap in flight. Two PHASES, each half of `--hk-stepflow-duration`:
 *  the exit phase slides the old body out on its own, the enter phase
 *  fades the new one in place — the two bodies are never visible at the
 *  same time (2026-09-22 user directive, round 10: the simultaneous
 *  cross-slide read as a doubled ghost of overlapping text).
 *
 *  All MOTION stays stylesheet-owned (the `data-direction` attribute plus
 *  the `hk-stepflow-leave-to` / `hk-stepflow-enter-pending` classes);
 *  script only schedules the phases, parks geometry against measured
 *  numbers, and books the cleanup. The entering body is MOUNTED from frame
 *  one but invisible through the exit phase (`visibility: hidden`), so the
 *  flow owns the NEW height immediately with no mount-time raster gap at
 *  the phase boundary. */
interface RunningSwap {
  leavingId: number;
  enteringId: number;
  /** Which phase is playing. */
  phase: "exit" | "enter";
  /** Body height before the swap — the sheet morph's "from" reference. */
  oldH: number;
  /** Resolved phase duration (ms): half the total swap window. */
  phaseMs: number;
  /** Height delta (new − old); negative means the sheet must shrink. */
  delta: number;
  /** True while the sheet's fold is parking the new body: the release then
   *  follows the sweep's own landing instead of the body's fade. */
  tail: boolean;
  /** Identity of the sweep this park belongs to: an interrupting dance
   *  publishes the settle of the sweep IT tore down, so only a settle that
   *  names this sweep may release the park. */
  sweep: number | null;
  /** Bus bookkeeping for the CSS window, held for both phases. */
  report: AnimationHandle | null;
  /** Watchdog: advance the phase even if transitionend never arrives. */
  timer: ReturnType<typeof setTimeout> | null;
  /** Bus one-shot used by the pre-emption fast path. */
  frame: AnimationHandle | null;
  listenEl: HTMLElement | null;
  onEnded: ((event: TransitionEvent) => void) | null;
  /** Host element carrying the sheet's sweep events (removed with the phase). */
  settleEl: HTMLElement | null;
  onSettle: ((event: Event) => void) | null;
}

export const STEPFLOW_SWAP_EVENT = "hk-stepflow-swap";

/** The hosting sheet publishes its fold's real span while it stages — the
 *  only place where the sheet's max-height cap is already accounted for.
 *  Content parks against these numbers instead of guessing the delta. */
export const SHEET_SWEEP_STAGE_EVENT = "hk-sheet-sweep-stage";

/** The hosting sheet's fold has landed: the frame is back at its rest
 *  geometry, so parked content must release exactly here. */
export const SHEET_SWEEP_SETTLE_EVENT = "hk-sheet-sweep-settle";

/** Extra grace on top of the resolved duration before the watchdog
 *  settles a phase without a transitionend — the same grammar as the
 *  sheet morph's sweep watchdog. */
const SWAP_WATCHDOG_GRACE_MS = 350;

/** Backstop for a parked fold whose host never publishes a landing: the
 *  host's own sweep watchdog is duration+350ms, so this outlives it. */
const TAIL_WATCHDOG_GRACE_MS = 700;

/** Fade level at or below which an outgoing body counts as gone. */
const FADED_OUT = 0.05;

/**
 * Resolve the body's configured transition duration in milliseconds.
 * The stylesheet sizes one PHASE (`calc(duration / 2)`), so this reads
 * the phase length directly. A zero result means the swap settles
 * INSTANTLY: reduced-motion users (the stylesheet zeroes the transition)
 * and stylesheet-less runtimes (test environments) both get a
 * deterministic single-body DOM with no timers to outlive and no
 * transitionend to wait for.
 */
function bodyTransitionMs(el: HTMLElement | null): number {
  if (!el) return 0;
  const view = el.ownerDocument?.defaultView;
  if (!view) return 0;
  const raw = view.getComputedStyle(el).transitionDuration ?? "";
  // Multiple entries ("0.15s, 0.15s") share one duration here — the first
  // is representative; "0.15s" and "150ms" forms both parse.
  const first = raw.split(",")[0]?.trim() ?? "";
  const match = /^([0-9]*\.?[0-9]+)(ms|s)$/.exec(first);
  if (!match) return 0;
  const value = Number(match[1]);
  return match[2] === "ms" ? value : value * 1000;
}

/** The nearest modal scroll body, i.e. the element the hosting sheet
 *  dispatches its sweep events on. */
function hostBody(el: HTMLElement | null): HTMLElement | null {
  return el?.closest<HTMLElement>(".hk-modal-body") ?? null;
}

/** Current computed opacity (1 when it cannot be read). */
function opacityOf(el: HTMLElement | null): number {
  if (!el) return 1;
  const view = el.ownerDocument?.defaultView;
  if (!view) return 1;
  const raw = view.getComputedStyle(el).opacity ?? "1";
  const value = Number(raw);
  return Number.isFinite(value) ? value : 1;
}

/**
 * Generic step-flow container: an optional HkTimeline header bound to
 * `modelValue` plus a direction-aware sliding body fed purely by named
 * slots keyed by step key. Navigation state lives in the consumer — the
 * component only translates `modelValue` changes into body swaps and
 * echoes timeline selections upward.
 *
 * The swap choreography (2026-09-22 user directive, round 10):
 *
 * - EXIT phase (first half of `--hk-stepflow-duration`, 0.15s of the
 *   0.3s family standard): only the OLD body is visible; it slides out
 *   (forward exits left, back exits right) and fades. The new body is
 *   already mounted and owns the flow's height, but is held invisible
 *   (`hk-stepflow-enter-pending`), so old and new can never overlap.
 * - ENTER phase (second half): the old body is dropped and the new one
 *   fades in PLACE — no travel, matching the directive.
 *
 * Height is scheduled per phase and handed to the hosting sheet through
 * `hk-stepflow-swap` (bubbles, detail `{ delta, durationMs, phase }`),
 * whose listener re-measures immediately and morphs its clip over one
 * phase: a GROW announces at the exit edge (the flow already owns the new
 * height), a SHRINK pins the flow's old height through the exit phase and
 * announces at the enter edge.
 *
 * Vertical geometry is MEASURED, never assumed, because the host decides
 * where a growing sheet's lines sit (bottom-docked phone sheet, centred
 * desktop frame, in-flow stage, or a capped sheet whose box cannot follow
 * its content at all):
 *
 * - the outgoing body gets an inline `top` equal to the distance its stage
 *   travelled during the swap patch, so it keeps its exact screen line;
 * - a shrink's new body is parked on the line the sheet's fold will LAND
 *   on, using the span the sheet publishes (`SHEET_SWEEP_STAGE_EVENT`), and
 *   is released when that fold lands (`SHEET_SWEEP_SETTLE_EVENT`) — a
 *   capped sheet publishes a zero span, which parks nothing.
 *
 * Cleanup grammar per phase: the acting body's own transitionend
 * (target-guarded) plus a duration+grace watchdog, so a lost event can
 * never strand a phase. Every swap also books the whole window on the
 * shared animation context (`reportTransition`).
 */
export default defineComponent({
  name: "HkStepFlow",
  props: {
    steps: { type: Array as PropType<TimelineStep[]>, required: true },
    modelValue: { type: String, required: true },
    /** Render the body only (header hidden) — for body-only usage. */
    hideTimeline: { type: Boolean, default: false },
    /** Passthrough to the header timeline's clickable behaviour. */
    timelineClickable: { type: Boolean, default: false },
    /**
     * Pin the header to the top of the nearest scroll container (modal
     * body hosts) so the step indicator stays visible over long bodies.
     * The header rides the shared scroll-pin contract (HkScrollPin's
     * class + data attributes on the timeline root): inside a host that
     * declares the padding contract the header keeps the body's top
     * whitespace when pinned instead of sitting flush against the
     * window chrome (2026-09-14 wizard report). Legacy styling knobs
     * --hk-stepflow-sticky-top/-z/-bg keep working through the pin's
     * custom properties.
     */
    stickyHeader: { type: Boolean, default: false },
    collapse: {
      type: String as PropType<TimelineCollapse>,
      default: "auto",
    },
  },
  emits: {
    "update:modelValue": (_key: string) => true,
  },
  setup(props, { slots, emit }) {
    /**
     * Which way the body slides: remember the index of the PREVIOUS
     * `modelValue` within `steps`; when the value changes, compare against
     * its new index. Unknown keys (-1) degrade gracefully to "forward".
     */
    const direction = ref<"forward" | "back">("forward");
    const indexOf = (key: string): number =>
      props.steps.findIndex((s) => s.key === key);
    let previousIndex = indexOf(props.modelValue);

    watch(
      () => props.modelValue,
      () => {
        const nextIndex = indexOf(props.modelValue);
        direction.value =
          previousIndex >= 0 && nextIndex >= 0 && nextIndex < previousIndex
            ? "back"
            : "forward";
        previousIndex = nextIndex;
      },
    );

    // A steps-array swap while modelValue stays put (locale switch, flow
    // reconfigured) invalidates the remembered position — resync silently
    // so the NEXT navigation still compares against reality.
    watch(
      () => props.steps.map((s) => s.key).join("\u0000"),
      () => {
        previousIndex = indexOf(props.modelValue);
      },
    );

    // ── Swap body bookkeeping ─────────────────────────────────────────
    let mountSeq = 0;
    const bodies = ref<BodyEntry[]>([
      { id: mountSeq++, key: props.modelValue, phase: "active" },
    ]);
    // `swap` is a plain let; `swapPhase` carries the reactivity. Every
    // mutation of `swap` is paired with a `swapPhase` or a `bodies`
    // write, so renders always re-read the pair (see the watch and
    // endSwap below).
    let swap: RunningSwap | null = null;
    const swapPhase = ref<"idle" | "exit" | "enter">("idle");
    /** Set for the enter phase of a parked shrink: the new body sits on the
     *  line the sheet's fold will land on (`hk-stepflow-enter-tail`). */
    const tailPhase = ref(false);
    const flowRef = ref<HTMLDivElement | null>(null);

    /** Every body element currently on stage, in render order. */
    function bodyEls(): HTMLElement[] {
      return Array.from(
        flowRef.value?.querySelectorAll<HTMLElement>(".hk-stepflow-body") ?? [],
      );
    }

    /** The element rendering one body entry. Class-based queries are NOT
     *  usable here: pre-empting mutates the entries synchronously while
     *  Vue's re-render (and therefore the classes) only lands on the next
     *  flush, so a `.active` query right after a pre-emption still returns
     *  the body the pre-emption just demoted — which measured the WRONG
     *  "old" height and silently disabled both the shrink handshake and the
     *  grow compensation (real-engine verification finding). */
    function elFor(id: number | undefined): HTMLElement | null {
      if (id === undefined) return null;
      return (
        flowRef.value?.querySelector<HTMLElement>(
          `[data-body-id="${id}"]`,
        ) ?? null
      );
    }

    /** Pin the flow to the pre-swap height (shrink exit phase). */
    function pinOldHeight(px: number): void {
      const el = flowRef.value?.querySelector<HTMLElement>(".hk-stepflow-bodies");
      if (el && px > 0) el.style.minHeight = `${px}px`;
    }

    function clearPin(): void {
      const el = flowRef.value?.querySelector<HTMLElement>(".hk-stepflow-bodies");
      if (el) el.style.minHeight = "";
    }

    /** Drop the measured offsets a parked/leaving body carries. */
    function clearOffsets(): void {
      for (const el of bodyEls()) {
        if (el.style.top) el.style.top = "";
      }
    }

    function disarmPhase(handle: RunningSwap): void {
      if (handle.timer !== null) clearTimeout(handle.timer);
      handle.timer = null;
      if (handle.frame) {
        handle.frame.disconnect();
        handle.frame = null;
      }
      if (handle.listenEl && handle.onEnded) {
        handle.listenEl.removeEventListener("transitionend", handle.onEnded);
      }
      handle.listenEl = null;
      handle.onEnded = null;
      if (handle.settleEl && handle.onSettle) {
        handle.settleEl.removeEventListener(
          SHEET_SWEEP_SETTLE_EVENT,
          handle.onSettle,
        );
      }
      handle.settleEl = null;
      handle.onSettle = null;
    }

    /** Arm a phase's closer: the acting body's own transitionend plus the
     *  duration+grace watchdog, both routed to the same `advance`. */
    function armPhase(
      handle: RunningSwap,
      el: HTMLElement,
      advance: () => void,
    ): void {
      const onEnded = (event: TransitionEvent) => {
        // transitionend bubbles — only the acting body's own property
        // transitions may advance the swap.
        if (event.target === el) advance();
      };
      el.addEventListener("transitionend", onEnded);
      handle.listenEl = el;
      handle.onEnded = onEnded;
      handle.timer = setTimeout(advance, handle.phaseMs + SWAP_WATCHDOG_GRACE_MS);
    }

    /** Shared by both phases: fire the sheet passthrough for this edge. */
    function announce(handle: RunningSwap): void {
      flowRef.value?.dispatchEvent(
        new CustomEvent(STEPFLOW_SWAP_EVENT, {
          bubbles: true,
          detail: {
            delta: handle.delta,
            durationMs: handle.phaseMs,
            phase: handle.phase,
          },
        }),
      );
    }

    function endSwap(immediate = false): void {
      if (!swap) return;
      const handle = swap;
      swap = null;
      swapPhase.value = "idle";
      tailPhase.value = false;
      disarmPhase(handle);
      handle.report?.disconnect();
      const id = handle.leavingId;
      bodies.value = bodies.value.filter((b) => b.id !== id);
      // Let go of the held geometry only once the layout is back: a parked
      // body is out of flow until Vue flushes the class change, and a
      // remeasure inside that window reads the collapsed height — it folded
      // the sheet 300px too far after an interrupting dance (real-engine
      // finding). On teardown there is nothing left to measure, so the
      // unmount path clears immediately.
      const release = (): void => {
        if (swap) return;
        clearPin();
        clearOffsets();
      };
      if (immediate) release();
      else void nextTick(release);
    }

    /** Pre-empt the running swap for a new one, keeping whatever the user
     *  can actually see on stage. A body that never painted (still pending
     *  in the exit phase) is dropped outright and the body that IS on
     *  screen stays as the new swap's leaving body — dropping the visible
     *  one instead blanked the stage for 134ms on a double-tap (2026-09-22
     *  R2 verification finding). Returns true when the outgoing body had
     *  already faded to nothing, so the new swap can skip its exit phase
     *  rather than replay a beat nobody can see. */
    function preemptSwap(): boolean {
      const handle = swap;
      if (!handle) return false;
      if (handle.phase !== "exit") {
        endSwap();
        return false;
      }
      const goneEl = elFor(handle.leavingId);
      const faded = opacityOf(goneEl) <= FADED_OUT;
      // The pending body never painted — drop it, keep the visible one.
      bodies.value = bodies.value.filter((b) => b.id !== handle.enteringId);
      const survivor = bodies.value.find((b) => b.id === handle.leavingId);
      if (!survivor) {
        // No visible body left to carry the stage: end the swap cleanly and
        // RE-SEED one for the current step. The branch is unreachable by
        // construction today (the only place that drops a leavingId flips
        // the phase in the same statement block), but falling through it
        // would leave the queue empty and every later navigation would bail
        // — a permanently blank flow (audit finding), so it re-seeds rather
        // than trusting the invariant.
        endSwap();
        bodies.value = [
          { id: mountSeq++, key: props.modelValue, phase: "active" },
        ];
        return false;
      }
      survivor.phase = "active";
      swap = null;
      swapPhase.value = "idle";
      tailPhase.value = false;
      disarmPhase(handle);
      handle.report?.disconnect();
      // Deliberately NEITHER clearOffsets() NOR clearPin(): the survivor is
      // still on stage and must hold its measured line, and the stage must
      // keep standing at the height the sheet is still pinned to. Clearing
      // the offset teleported the visible body by the whole delta in one
      // frame, and clearing the pin collapsed the stage below the sheet —
      // so the re-armed swap read a zero delta and skipped its park
      // handshake entirely (real-browser findings F1a/F1b). Both are cleared
      // when the swap itself ends.
      return faded;
    }

    /** Shrink enter edge, step 1: hand the sheet the NEW natural height (the
     *  pin comes off first) and read back the fold span it stages. Zero
     *  means the sheet cannot fold (capped, or no fold at all), in which
     *  case the new body is not parked. */
    function stageShrinkFold(handle: RunningSwap): { span: number; sweep: number | null } {
      const body = hostBody(flowRef.value);
      let span = 0;
      let sweep: number | null = null;
      if (body) {
        const onStage = (event: Event) => {
          // Same target discipline as the settle twin below: only this
          // flow's own host may stage geometry for it.
          if (event.target !== body) return;
          const info = (
            event as CustomEvent<{
              direction?: string;
              from?: number;
              to?: number;
              sweep?: number;
            }>
          ).detail;
          if (
            info?.direction === "conceal" &&
            typeof info.from === "number" &&
            typeof info.to === "number"
          ) {
            span = Math.max(0, Math.round(info.from - info.to));
            sweep = typeof info.sweep === "number" ? info.sweep : null;
          }
        };
        body.addEventListener(SHEET_SWEEP_STAGE_EVENT, onStage);
        clearPin();
        announce(handle);
        body.removeEventListener(SHEET_SWEEP_STAGE_EVENT, onStage);
        return { span, sweep };
      }
      clearPin();
      announce(handle);
      return { span: 0, sweep: null };
    }

    /** Shrink enter edge, step 2: hold the stage at its old height and park
     *  the new body on the line the fold lands on, releasing with the fold
     *  itself (or the backstop when the host never reports a landing). */
    function parkTail(
      handle: RunningSwap,
      entering: HTMLElement,
      span: number,
      sweep: number | null,
    ): void {
      pinOldHeight(handle.oldH);
      entering.style.top = `${span}px`;
      tailPhase.value = true;
      handle.tail = true;
      handle.sweep = sweep;
      const body = hostBody(flowRef.value);
      if (body) {
        const onSettle = (event: Event) => {
          // Only THIS swap's park, and only the sweep it parked against, may
          // be released: every interrupting dance publishes the settle of
          // the sweep it tore down, which arrives here too.
          if (event.target !== body || swap !== handle) return;
          const info = (
            event as CustomEvent<{ sweep?: number }>
          ).detail;
          if (
            handle.sweep !== null &&
            typeof info?.sweep === "number" &&
            info.sweep !== handle.sweep
          ) {
            return;
          }
          endSwap();
        };
        body.addEventListener(SHEET_SWEEP_SETTLE_EVENT, onSettle);
        handle.settleEl = body;
        handle.onSettle = onSettle;
      }
      // A host that never publishes a landing must not strand the pin (its
      // own sweep watchdog is duration+350ms).
      handle.timer = setTimeout(
        endSwap,
        handle.phaseMs + TAIL_WATCHDOG_GRACE_MS,
      );
    }

    /** Exit → enter edge: drop the old body, reveal the new one, and (for a
     *  shrink the sheet will fold) park the new one on the landing line. */
    function startEnterPhase(): void {
      const handle = swap;
      if (!handle || handle.phase !== "exit") return;
      disarmPhase(handle);
      handle.phase = "enter";
      swapPhase.value = "enter";
      bodies.value = bodies.value.filter((b) => b.id !== handle.leavingId);
      const entering = elFor(handle.enteringId);
      if (!entering) {
        endSwap();
        return;
      }
      if (handle.delta < 0) {
        const { span, sweep } = stageShrinkFold(handle);
        if (span > 0) {
          parkTail(handle, entering, span, sweep);
          return;
        }
      }
      armPhase(handle, entering, endSwap);
    }

    // Sticky-header whitespace strategy (2026-09-14): the timeline is the
    // flow's boundary element, but content may sit ABOVE the whole flow
    // inside the same scroll body — a bleed pin's negative margin would
    // overlap it. Inside a host that paints its gutters (`data-pad-cover`,
    // HkModal) the pin therefore stops at the gutter line ("offset",
    // overlap-free anywhere in the flow); every other host keeps "bleed",
    // where the flow is the de-facto boundary element. Resolution happens
    // on mount (attribute scan only — no geometry), so CSR surfaces see
    // the attribute flip once right after hydration; hikari renders
    // client-side only.
    const pinStrategy = ref<"offset" | "bleed">("bleed");

    watch(
      () => props.modelValue,
      async (next, prev) => {
        if (next === prev) return;
        // A swap while the previous one is still playing: keep the visible
        // body on stage and drop anything that never painted.
        const skipExit = preemptSwap();
        const leaving = bodies.value.find((b) => b.phase === "active");
        if (!leaving) return;
        // Pre-swap geometry while the leaving body still owns the flow:
        // its height is the "old" reference for the sheet's delta, and its
        // screen line is where the outgoing body must stay.
        const leavingEl = elFor(leaving.id);
        const leaveTop0 = leavingEl?.getBoundingClientRect().top ?? 0;
        // The "old" reference is the STAGE's rendered height, not the body's:
        // after a pre-emption the stage still carries the height the sheet
        // pinned itself to (the dropped body owned the flow), so a body-based
        // reading mis-signed the delta — the flow read a grow while the sheet
        // staged a conceal, skipped its park handshake, and left the new body
        // unparked under a running fold (real-engine finding N1/N4/N7/N10).
        // On the ordinary path the stage is exactly the active body's height.
        const stageEl =
          flowRef.value?.querySelector<HTMLElement>(".hk-stepflow-bodies") ?? null;
        const stageH = stageEl?.offsetHeight ?? 0;
        const oldH = stageH > 0 ? stageH : (leavingEl?.offsetHeight ?? 0);
        const phaseMs = bodyTransitionMs(leavingEl);

        if (phaseMs <= 0) {
          // Instant settle: no transition is configured (reduced motion,
          // or a stylesheet-less runtime such as a test environment) —
          // swap the bodies atomically so the DOM never carries two
          // steps, then still poke the hosting sheet to remeasure.
          const atomicId = mountSeq++;
          bodies.value = [{ id: atomicId, key: next, phase: "active" }];
          // A pin preserved across a pre-emption would otherwise outlive the
          // swap that owned it (strandable when the motion path collapses
          // mid-flight, e.g. a reduced-motion flip) and poison the next
          // "old" height read.
          clearPin();
          await nextTick();
          const newEl = elFor(atomicId);
          const delta = (newEl?.offsetHeight ?? oldH) - oldH;
          flowRef.value?.dispatchEvent(
            new CustomEvent(STEPFLOW_SWAP_EVENT, {
              bubbles: true,
              detail: { delta, durationMs: 0, phase: "instant" },
            }),
          );
          return;
        }

        leaving.phase = "leaving";
        const entering: BodyEntry = {
          id: mountSeq++,
          key: next,
          phase: "active",
        };
        // Register the swap BEFORE the reactive mutations so the exit
        // render already knows which entry is leaving (leave-to) and which
        // one is pending (invisible) — `swap` itself is not reactive.
        const handle: RunningSwap = {
          leavingId: leaving.id,
          enteringId: entering.id,
          phase: "exit",
          oldH,
          phaseMs,
          delta: 0,
          tail: false,
          sweep: null,
          report: null,
          timer: null,
          frame: null,
          listenEl: null,
          onEnded: null,
          settleEl: null,
          onSettle: null,
        };
        swap = handle;
        bodies.value = [...bodies.value, entering];
        // Always staged: the new body is invisible for this frame, so the
        // fast path below can commit that start state before its fade.
        swapPhase.value = "exit";
        await nextTick();
        // Preempted while the DOM patched? The newer swap owns the stage —
        // this continuation must not measure, dispatch or arm anything.
        if (swap !== handle) return;
        const newEl = elFor(entering.id);
        const goneEl = elFor(handle.leavingId);
        if (!newEl || !goneEl) {
          // The flow went away mid-swap (unmount) — restore one body.
          swap = null;
          swapPhase.value = "idle";
          clearPin();
          leaving.phase = "active";
          bodies.value = [leaving];
          return;
        }
        handle.delta = newEl.offsetHeight - oldH;
        // The outgoing body must keep its pre-swap screen line. Its stage
        // only moves when the HOST reacts to the height handoff (a
        // bottom-docked sheet pins the new height the moment the sheet is
        // told), so the shift is measured AFTER that handoff — measuring it
        // before left the compensation at zero on exactly the surface it
        // exists for, and the outgoing body rode the sheet's instant growth
        // out of view (real-engine verification finding, 2026-09-22).
        const holdLine = (): void => {
          const shift = Math.round(leaveTop0 - goneEl.getBoundingClientRect().top);
          if (shift) goneEl.style.top = `${shift}px`;
        };
        if (skipExit) {
          // The outgoing body had already faded out, so replaying its exit
          // would only show a blank stage: drop it, hand the sheet the new
          // geometry, and fade the new body in from this edge. The render
          // still carries `swapPhase = "exit"`, i.e. the new body's staged
          // invisible start state, so the bus frame below commits that
          // state before the fade gets its "from" — and the phase is marked
          // "enter" right away, so a navigation inside that single frame
          // takes the safe endSwap path instead of the exit branch.
          bodies.value = bodies.value.filter((b) => b.id !== handle.leavingId);
          // The faded body is gone, so this edge IS the enter edge: a grow
          // hands the sheet its new height here, a shrink runs the same
          // measurement + parking handshake the ordinary path runs.
          handle.phase = "enter";
          let parked = false;
          if (handle.delta < 0) {
            const { span, sweep } = stageShrinkFold(handle);
            if (span > 0) {
              parkTail(handle, newEl, span, sweep);
              parked = true;
            }
          } else {
            announce(handle);
          }
          holdLine();
          handle.report = reportTransition(phaseMs);
          // Commit the staged (invisible) start state for one bus frame,
          // then lift it: that is what gives the fade its "from" AND what
          // applies the parked body's tail class. A parked fold is already
          // armed on the sheet's landing, so only an unparked one needs the
          // body's own closer here.
          handle.frame = scheduleFrame(() => {
            if (swap !== handle) return;
            handle.frame = null;
            swapPhase.value = "enter";
            if (!parked) armPhase(handle, newEl, endSwap);
          });
          return;
        }
        if (handle.delta >= 0) {
          // Grow: the flow already owns the new height, so the sheet can
          // finish growing through THIS phase — the old body slides out on
          // the line it was already on.
          announce(handle);
          holdLine();
        } else {
          // Shrink: hold the old height while the old body plays; the
          // sheet folds in the second phase (startEnterPhase).
          pinOldHeight(oldH);
        }
        handle.report = reportTransition(phaseMs * 2);
        armPhase(handle, goneEl, startEnterPhase);
      },
      { flush: "post" },
    );

    onMounted(() => {
      const host = flowRef.value?.closest(`.${SCROLL_HOST_CLASS}`);
      if (host?.hasAttribute("data-pad-cover")) pinStrategy.value = "offset";
    });

    onBeforeUnmount(() => {
      endSwap(true);
    });

    return () => {
      const dir = direction.value;

      return (
        <div ref={flowRef} class="hk-step-flow" data-sticky-header={props.stickyHeader || undefined}>
          {!props.hideTimeline && (
            <HkTimeline
              steps={props.steps}
              currentKey={props.modelValue}
              clickable={props.timelineClickable}
              collapse={props.collapse}
              onSelect={(key: string) => emit("update:modelValue", key)}
              class={props.stickyHeader ? "hk-scroll-pin" : undefined}
              data-side={props.stickyHeader ? "top" : undefined}
              data-strategy={props.stickyHeader ? pinStrategy.value : undefined}
            />
          )}
          <div class="hk-stepflow-bodies" data-direction={dir}>
            {bodies.value.map((entry) => (
              <div
                key={entry.id}
                data-body-id={entry.id}
                class={[
                  "hk-stepflow-body",
                  entry.phase,
                  entry.id === swap?.enteringId && swapPhase.value === "exit"
                    ? "hk-stepflow-enter-pending"
                    : null,
                  entry.id === swap?.enteringId &&
                  swapPhase.value === "enter" &&
                  tailPhase.value
                    ? "hk-stepflow-enter-tail"
                    : null,
                  entry.id === swap?.leavingId
                    ? "hk-stepflow-leave-to"
                    : null,
                ]}
              >
                {slots[entry.key]?.({
                  key: entry.key,
                  index: indexOf(entry.key),
                  direction: dir,
                })}
              </div>
            ))}
          </div>
        </div>
      );
    };
  },
});
