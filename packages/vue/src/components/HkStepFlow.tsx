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
import { reportTransition, type AnimationHandle } from "../runtime/animationBus";

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
  /** `active` bodies share the grid cell; a `leaving` body is sliding out. */
  phase: "active" | "leaving";
}

/** A swap in flight (2026-09-23 user directive, round 16): the content
 *  swap and the sheet's height change play as TWO SEQUENTIAL WINDOWS —
 *  the concurrent choreography they replaced kept the phone GPU's
 *  raster thread behind (whole-region black flashes no layering fix
 *  could absorb), and sequencing costs nothing perceptible:
 *
 *  - SLIDE window (one `--hk-stepflow-duration`): the sheet's height is
 *    FROZEN (the swap event asks the hosting modal to hold its pin);
 *    the old body slides out and the new one slides in — the classic
 *    direction-aware crossfade — and the timeline animates alongside.
 *    Nothing else moves: no fold, no rides, no layer churn.
 *  - MORPH window (after the slide settles): the old node is recycled,
 *    the swap event hands the sheet its new height, and the fold sweeps
 *    or conceals ALONE — the only animation on stage.
 *
 *  The concurrent era's machinery is gone with it: no counter rides, no
 *  ride registry, no phase-overlap edges — the entering body needs no
 *  special geometry because no fold is moving while it fades in. */
interface RunningSwap {
  leavingId: number;
  enteringId: number;
  /** Body height before the swap — the morph's "from" reference. */
  oldH: number;
  /** Resolved slide duration (ms); 0 means transitions are disabled. */
  swapMs: number;
  /** Bus bookkeeping for the slide window. */
  report: AnimationHandle | null;
  /** Watchdog: settle the swap even if transitionend never arrives. */
  timer: ReturnType<typeof setTimeout> | null;
  listenEl: HTMLElement | null;
  onEnded: ((event: TransitionEvent) => void) | null;
}

export const STEPFLOW_SWAP_EVENT = "hk-stepflow-swap";

/** Extra grace on top of the slide duration before the watchdog settles
 *  the swap without a transitionend. */
const SWAP_WATCHDOG_GRACE_MS = 350;

/** The morph window's sweep length: near-instant. A sustained clip
 *  animation re-rasters the moving edge per frame — the phone flicker
 *  the round-17 report caught in the height window even after the
 *  content had settled. One paint, no edge travel (the 2026-09-21
 *  shrink-snap decision, applied to stepflow morphs in both
 *  directions). */
const STEP_MORPH_SNAP_MS = 1;

/** Fade level above which an entering body counts as the visible one. */
const FADED_IN = 0.05;

/**
 * Resolve the body's configured transition duration in milliseconds.
 * A zero result means the swap settles INSTANTLY: reduced-motion users
 * and stylesheet-less runtimes both get a deterministic single-body DOM
 * with no timers to outlive.
 */
function bodyTransitionMs(el: HTMLElement | null): number {
  if (!el) return 0;
  const view = el.ownerDocument?.defaultView;
  if (!view) return 0;
  const raw = view.getComputedStyle(el).transitionDuration ?? "";
  const first = raw.split(",")[0]?.trim() ?? "";
  const match = /^([0-9]*\.?[0-9]+)(ms|s)$/.exec(first);
  if (!match) return 0;
  const value = Number(match[1]);
  return match[2] === "ms" ? value : value * 1000;
}

/** Current computed opacity (1 when it cannot be read). */
function opacityOf(el: HTMLElement | null): number {
  if (!el) return 1;
  const view = el.ownerDocument?.defaultView;
  if (!view) return 1;
  const raw = view.getComputedStyle(el).opacity;
  if (raw === undefined || raw.trim() === "") return 1;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 1;
}

/**
 * Generic step-flow container: an optional HkTimeline header bound to
 * `modelValue` plus a direction-aware sliding body fed purely by named
 * slots keyed by step key.
 *
 * The swap choreography (2026-09-23 user directive, round 16):
 *
 * - Both bodies share ONE grid cell (the taller sizes it) with the
 *   sheet's height frozen for the whole slide, so the container's
 *   geometry never changes mid-swap.
 * - SLIDE window: the entering body mounts staged (transparent, offset
 *   to its direction side — an initial state, so nothing animates on
 *   the mount frame) and is released in the same frame the leaving
 *   body's exit starts; the two crossfade and slide apart like the
 *   classic stepper. The timeline animates in the same window.
 * - MORPH window: once the slide settles, the old node is recycled and
 *   `hk-stepflow-swap` (bubbles, detail `{ phase: "morph", delta,
 *   durationMs }`) hands the hosting sheet its new height — the fold
 *   then plays alone, with the title riding it (the sheet's own
 *   fold-ride machinery, untouched by this component).
 */
export default defineComponent({
  name: "HkStepFlow",
  props: {
    steps: { type: Array as PropType<TimelineStep[]>, required: true },
    modelValue: { type: String, required: true },
    hideTimeline: { type: Boolean, default: false },
    timelineClickable: { type: Boolean, default: false },
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

    // A steps-array swap while modelValue stays put: resync silently.
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
    let swap: RunningSwap | null = null;
    const swapPhase = ref<"idle" | "slide" | "morph">("idle");
    const flowRef = ref<HTMLDivElement | null>(null);

    /** The element rendering one body entry. */
    function elFor(id: number | undefined): HTMLElement | null {
      if (id === undefined) return null;
      return (
        flowRef.value?.querySelector<HTMLElement>(
          `[data-body-id="${id}"]`,
        ) ?? null
      );
    }

    function disarmPhase(handle: RunningSwap): void {
      if (handle.timer !== null) clearTimeout(handle.timer);
      handle.timer = null;
      if (handle.listenEl && handle.onEnded) {
        handle.listenEl.removeEventListener("transitionend", handle.onEnded);
      }
      handle.listenEl = null;
      handle.onEnded = null;
    }

    /** Fire the sheet passthrough for an edge. */
    function announce(
      detail: {
        delta: number;
        durationMs: number;
        phase: "swap" | "morph" | "instant";
      },
    ): void {
      flowRef.value?.dispatchEvent(
        new CustomEvent(STEPFLOW_SWAP_EVENT, { bubbles: true, detail }),
      );
    }

    /** Settle the slide: recycle the old node and hand the sheet its new
     *  height — the morph window plays alone from here. The morph
     *  requests a NEAR-INSTANT sweep (1ms): a sustained clip animation
     *  re-rasters the moving edge every frame, which on the phone GPU
     *  read as the height window flickering even with the content
     *  settled (round-17 report; the same mechanism that made shrinks
     *  snap in 2026-09-21). The height change still lands as its own
     *  window — it just completes in one paint instead of 300ms of
     *  edge travel. */
    function endSwap(): void {
      if (!swap) return;
      const handle = swap;
      swap = null;
      swapPhase.value = "morph";
      disarmPhase(handle);
      handle.report?.disconnect();
      const enteringEl = elFor(handle.enteringId);
      const newH = enteringEl?.offsetHeight ?? handle.oldH;
      bodies.value = bodies.value.filter((b) => b.id !== handle.leavingId);
      announce({
        delta: newH - handle.oldH,
        durationMs: STEP_MORPH_SNAP_MS,
        phase: "morph",
      });
      swapPhase.value = "idle";
    }

    /** Pre-empt the running swap for a new one, keeping whichever body
     *  the user can actually see on stage as the new swap's leaving
     *  body — the mid-flight one is dropped outright (its opacity says
     *  which is which). */
    function preemptSwap(): boolean {
      const handle = swap;
      if (!handle) return false;
      const enterEl = elFor(handle.enteringId);
      const keepEntering = opacityOf(enterEl) > FADED_IN;
      disarmPhase(handle);
      handle.report?.disconnect();
      swap = null;
      swapPhase.value = "idle";
      const keepId = keepEntering ? handle.enteringId : handle.leavingId;
      const survivor = bodies.value.find((b) => b.id === keepId);
      if (!survivor) {
        bodies.value = [
          { id: mountSeq++, key: props.modelValue, phase: "active" },
        ];
        return false;
      }
      survivor.phase = "active";
      bodies.value = [survivor];
      return keepEntering;
    }

    // Sticky-header whitespace strategy (2026-09-14): see HkScrollPin.
    const pinStrategy = ref<"offset" | "bleed">("bleed");

    watch(
      () => props.modelValue,
      async (next, prev) => {
        if (next === prev) return;
        preemptSwap();
        const leaving = bodies.value.find((b) => b.phase === "active");
        if (!leaving) return;
        const leavingEl = elFor(leaving.id);
        const oldH = leavingEl?.offsetHeight ?? 0;
        const swapMs = bodyTransitionMs(leavingEl);

        if (swapMs <= 0) {
          // Instant settle: swap atomically, still hand the sheet its
          // new height (no freeze, no morph animation requested).
          bodies.value = [{ id: mountSeq++, key: next, phase: "active" }];
          await nextTick();
          const newEl = elFor(bodies.value[0]?.id);
          const delta = (newEl?.offsetHeight ?? oldH) - oldH;
          announce({ delta, durationMs: 0, phase: "instant" });
          return;
        }

        leaving.phase = "leaving";
        const entering: BodyEntry = {
          id: mountSeq++,
          key: next,
          phase: "active",
        };
        const handle: RunningSwap = {
          leavingId: leaving.id,
          enteringId: entering.id,
          oldH,
          swapMs,
          report: null,
          timer: null,
          listenEl: null,
          onEnded: null,
        };
        swap = handle;
        bodies.value = [...bodies.value, entering];
        swapPhase.value = "slide";
        // Freeze the sheet for the whole slide window: its height must
        // not chase the cell's new geometry while the bodies crossfade.
        announce({ delta: 0, durationMs: Math.round(swapMs), phase: "swap" });
        handle.report = reportTransition(swapMs);
        await nextTick();
        if (swap !== handle) return;
        const enteringEl = elFor(entering.id);
        if (!enteringEl) {
          swap = null;
          swapPhase.value = "idle";
          leaving.phase = "active";
          bodies.value = [leaving];
          return;
        }
        // Release the entering body's staged offset imperatively, in the
        // same frame the leaving body's exit began: the two slides run
        // as one classic crossfade. The vdom agrees (swapPhase is
        // already "slide"), so the patch never re-adds the class.
        enteringEl.classList.remove("hk-stepflow-enter-from");
        // The slide's closer: the entering body's own opacity end plus
        // the duration+grace watchdog, both routed to endSwap. The
        // property guard keeps a stray transform end (e.g. a riding
        // ancestor's) from settling the swap early.
        const onEnded = (event: TransitionEvent) => {
          if (
            event.target === enteringEl &&
            event.propertyName === "opacity"
          ) {
            endSwap();
          }
        };
        enteringEl.addEventListener("transitionend", onEnded);
        handle.listenEl = enteringEl;
        handle.onEnded = onEnded;
        handle.timer = setTimeout(endSwap, swapMs + SWAP_WATCHDOG_GRACE_MS);
      },
      { flush: "post" },
    );

    onMounted(() => {
      const host = flowRef.value?.closest(`.${SCROLL_HOST_CLASS}`);
      if (host?.hasAttribute("data-pad-cover")) pinStrategy.value = "offset";
    });

    onBeforeUnmount(() => {
      if (swap) {
        disarmPhase(swap);
        swap.report?.disconnect();
        swap = null;
        swapPhase.value = "idle";
      }
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
                  entry.id === swap?.enteringId && swapPhase.value === "slide"
                    ? "hk-stepflow-enter-from"
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
