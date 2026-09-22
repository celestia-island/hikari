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
  /** `active` bodies share the grid cell; a `leaving` body is fading out. */
  phase: "active" | "leaving";
}

/** A swap in flight. Two PHASES, each half of `--hk-stepflow-duration`:
 *  the exit phase (the old body alone slides and fades out) followed by
 *  the enter phase (the new body fades in place). The whole motion model
 *  is OPACITY (plus the leaving body's direction slide); the old DOM node
 *  is recycled at the phase boundary — no visibility flips, no absolute
 *  positioning, no height pins, no measured offsets (2026-09-22 user
 *  directive, round 12: those all changed the render tree mid-animation
 *  and read as a flash on the phone GPU). */
interface RunningSwap {
  leavingId: number;
  enteringId: number;
  phase: "exit" | "enter";
  /** Body height before the swap — the sheet morph's "from" reference. */
  oldH: number;
  /** Resolved phase duration (ms): half the total swap window. */
  phaseMs: number;
  /** Height delta (new − old), for the hosting sheet's morph. */
  delta: number;
  /** Bus bookkeeping for the CSS window, held for both phases. */
  report: AnimationHandle | null;
  /** Watchdog: advance the phase even if transitionend never arrives. */
  timer: ReturnType<typeof setTimeout> | null;
  listenEl: HTMLElement | null;
  onEnded: ((event: TransitionEvent) => void) | null;
}

export const STEPFLOW_SWAP_EVENT = "hk-stepflow-swap";

/** Extra grace on top of the resolved duration before the watchdog
 *  settles a phase without a transitionend. */
const SWAP_WATCHDOG_GRACE_MS = 350;

/** Fade level at or below which an outgoing body counts as gone. */
const FADED_OUT = 0.05;

/**
 * Resolve the body's configured transition duration in milliseconds.
 * The stylesheet sizes one PHASE (`calc(duration / 2)`), so this reads
 * the phase length directly. A zero result means the swap settles
 * INSTANTLY: reduced-motion users and stylesheet-less runtimes both get
 * a deterministic single-body DOM with no timers to outlive.
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
 * The swap choreography (2026-09-22 user directive, rounds 10-12):
 *
 * - Both bodies share ONE grid cell, so the container's height is the
 *   taller of the two — the hosting sheet sees the new geometry as soon
 *   as the swap starts for a grow, and keeps the old geometry until the
 *   old node is recycled for a shrink, with no pin.
 * - EXIT phase (first half): the old body slides out and fades; the new
 *   body is mounted but transparent (`hk-stepflow-enter-pending` =
 *   `opacity: 0` + `pointer-events: none`, deliberately NOT
 *   `visibility: hidden` — that flip re-rasters the layer on the phone
 *   GPU, which was the flash the user kept seeing).
 * - ENTER phase (second half): the old node is recycled; the new body
 *   fades in place.
 * - The height handoff to the hosting sheet rides `hk-stepflow-swap`
 *   (bubbles, detail `{ delta, durationMs, phase }`), whose listener
 *   re-measures immediately and morphs over one phase.
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
    const swapPhase = ref<"idle" | "exit" | "enter">("idle");
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

    /** Arm a phase's closer: the acting body's own transitionend plus the
     *  duration+grace watchdog, both routed to the same `advance`. */
    function armPhase(
      handle: RunningSwap,
      el: HTMLElement,
      advance: () => void,
    ): void {
      const onEnded = (event: TransitionEvent) => {
        if (event.target === el) advance();
      };
      el.addEventListener("transitionend", onEnded);
      handle.listenEl = el;
      handle.onEnded = onEnded;
      handle.timer = setTimeout(advance, handle.phaseMs + SWAP_WATCHDOG_GRACE_MS);
    }

    /** Fire the sheet passthrough for this edge. */
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

    function endSwap(): void {
      if (!swap) return;
      const handle = swap;
      swap = null;
      swapPhase.value = "idle";
      disarmPhase(handle);
      handle.report?.disconnect();
      const id = handle.leavingId;
      bodies.value = bodies.value.filter((b) => b.id !== id);
    }

    /** Pre-empt the running swap for a new one, keeping whatever the user
     *  can actually see on stage. A body that never painted is dropped
     *  outright and the visible one stays as the new swap's leaving body;
     *  if it had already faded, the new swap skips its exit phase. */
    function preemptSwap(): boolean {
      const handle = swap;
      if (!handle) return false;
      if (handle.phase !== "exit") {
        endSwap();
        return false;
      }
      const goneEl = elFor(handle.leavingId);
      const faded = opacityOf(goneEl) <= FADED_OUT;
      bodies.value = bodies.value.filter((b) => b.id !== handle.enteringId);
      const survivor = bodies.value.find((b) => b.id === handle.leavingId);
      if (!survivor) {
        endSwap();
        bodies.value = [
          { id: mountSeq++, key: props.modelValue, phase: "active" },
        ];
        return false;
      }
      survivor.phase = "active";
      swap = null;
      swapPhase.value = "idle";
      disarmPhase(handle);
      handle.report?.disconnect();
      return faded;
    }

    /** Exit → enter edge: recycle the old node and reveal the new one. */
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
      // A shrink hands the sheet its new geometry at THIS edge. The
      // announce runs AFTER the flush — the old node was recycled in the
      // filter above, and the sheet must measure the COLLAPSED cell (the
      // announcing-before-flush variant read the old content and skipped
      // the fold, leaving it to the observer's 150ms debounce, which
      // wiped the fading-in content and jumped at the landing).
      if (handle.delta < 0) {
        void nextTick(() => {
          if (swap === handle) announce(handle);
        });
      }
      armPhase(handle, entering, endSwap);
    }

    // Sticky-header whitespace strategy (2026-09-14): see HkScrollPin.
    const pinStrategy = ref<"offset" | "bleed">("bleed");

    watch(
      () => props.modelValue,
      async (next, prev) => {
        if (next === prev) return;
        const skipExit = preemptSwap();
        const leaving = bodies.value.find((b) => b.phase === "active");
        if (!leaving) return;
        const leavingEl = elFor(leaving.id);
        const oldH = leavingEl?.offsetHeight ?? 0;
        const phaseMs = bodyTransitionMs(leavingEl);

        if (phaseMs <= 0) {
          // Instant settle: swap atomically, still poke the sheet.
          bodies.value = [{ id: mountSeq++, key: next, phase: "active" }];
          await nextTick();
          const newEl = elFor(bodies.value[0]?.id);
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
        const handle: RunningSwap = {
          leavingId: leaving.id,
          enteringId: entering.id,
          phase: "exit",
          oldH,
          phaseMs,
          delta: 0,
          report: null,
          timer: null,
          listenEl: null,
          onEnded: null,
        };
        swap = handle;
        bodies.value = [...bodies.value, entering];
        swapPhase.value = "exit";
        await nextTick();
        if (swap !== handle) return;
        const newEl = elFor(entering.id);
        const goneEl = elFor(handle.leavingId);
        if (!newEl || !goneEl) {
          swap = null;
          swapPhase.value = "idle";
          leaving.phase = "active";
          bodies.value = [leaving];
          return;
        }
        handle.delta = newEl.offsetHeight - oldH;
        if (skipExit) {
          // The faded body is gone: this edge IS the enter edge. Tell the
          // sheet and let the new body fade in from this moment.
          bodies.value = bodies.value.filter((b) => b.id !== handle.leavingId);
          handle.phase = "enter";
          swapPhase.value = "enter";
          announce(handle);
          handle.report = reportTransition(phaseMs);
          handle.timer = setTimeout(endSwap, handle.phaseMs + SWAP_WATCHDOG_GRACE_MS);
          return;
        }
        if (handle.delta >= 0) {
          // Grow: the grid cell already owns the new (taller) height, so
          // the sheet can finish growing through THIS phase.
          announce(handle);
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
      endSwap();
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
