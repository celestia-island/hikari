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
 *  script only schedules the phases and books the cleanup. The entering
 *  body is MOUNTED from frame one but invisible through the exit phase
 *  (`visibility: hidden`), so the flow owns the NEW height immediately
 *  with no mount-time raster gap at the phase boundary — the empty
 *  mid-frame that made the retired `out-in` slide flash. */
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
  /** Bus bookkeeping for the CSS window, held for both phases. */
  report: AnimationHandle | null;
  /** Watchdog: advance the phase even if transitionend never arrives. */
  timer: ReturnType<typeof setTimeout> | null;
  listenEl: HTMLElement | null;
  onEnded: ((event: TransitionEvent) => void) | null;
}

export const STEPFLOW_SWAP_EVENT = "hk-stepflow-swap";

/** Extra grace on top of the resolved duration before the watchdog
 *  settles a phase without a transitionend — the same grammar as the
 *  sheet morph's sweep watchdog. */
const SWAP_WATCHDOG_GRACE_MS = 350;

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
 * phase:
 *
 * - GROW (new body taller): the flow owns the new height from frame one,
 *   so the event fires at the exit edge and the sheet finishes growing
 *   through the FIRST phase while the old body is still leaving.
 * - SHRINK (new body shorter): the flow's old height is pinned
 *   (`min-height`) through the exit phase so the sheet does not fold
 *   under a body that is still playing; at the enter edge the pin lifts
 *   and the event fires, so the sheet shrinks through the SECOND phase
 *   while the new body appears at its final geometry — it never rides
 *   the descending edge.
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
    const flowRef = ref<HTMLDivElement | null>(null);

    /** Pin the flow to the pre-swap height (shrink exit phase). */
    function pinOldHeight(px: number): void {
      const el = flowRef.value?.querySelector<HTMLElement>(".hk-stepflow-bodies");
      if (el && px > 0) el.style.minHeight = `${px}px`;
    }

    function clearPin(): void {
      const el = flowRef.value?.querySelector<HTMLElement>(".hk-stepflow-bodies");
      if (el) el.style.minHeight = "";
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

    function endSwap(): void {
      if (!swap) return;
      const handle = swap;
      swap = null;
      swapPhase.value = "idle";
      disarmPhase(handle);
      handle.report?.disconnect();
      clearPin();
      const id = handle.leavingId;
      bodies.value = bodies.value.filter((b) => b.id !== id);
    }

    /** Exit → enter edge: drop the old body, reveal the new one, and (for a
     *  shrink) lift the height pin so the sheet folds through this phase. */
    function startEnterPhase(): void {
      const handle = swap;
      if (!handle || handle.phase !== "exit") return;
      disarmPhase(handle);
      handle.phase = "enter";
      swapPhase.value = "enter";
      bodies.value = bodies.value.filter((b) => b.id !== handle.leavingId);
      const entering = flowRef.value?.querySelector<HTMLElement>(
        ".hk-stepflow-body.active",
      );
      if (handle.delta < 0) {
        // Shrink: the sheet morphs NOW (the second phase), with the new
        // body already at its final geometry.
        clearPin();
        announce(handle);
      }
      if (!entering) {
        endSwap();
        return;
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
        // A swap while the previous one is still playing: tear it down and
        // let the new swap own the stage. A still-hidden entering body is
        // promoted to plain active first (endSwap drops the pending class
        // through swapPhase), so it never loses its reveal.
        endSwap();
        const leaving = bodies.value.find((b) => b.phase === "active");
        if (!leaving) return;
        // Pre-swap geometry while the leaving body still owns the flow:
        // its height is the "old" reference for the sheet's delta. The
        // same element also answers the motion probe.
        const leavingEl =
          flowRef.value?.querySelector<HTMLElement>(
            ".hk-stepflow-body.active",
          ) ?? null;
        const oldH = leavingEl?.offsetHeight ?? 0;
        const phaseMs = bodyTransitionMs(leavingEl);

        if (phaseMs <= 0) {
          // Instant settle: no transition is configured (reduced motion,
          // or a stylesheet-less runtime such as a test environment) —
          // swap the bodies atomically so the DOM never carries two
          // steps, then still poke the hosting sheet to remeasure.
          bodies.value = [{ id: mountSeq++, key: next, phase: "active" }];
          await nextTick();
          const newEl = flowRef.value?.querySelector<HTMLElement>(
            ".hk-stepflow-body.active",
          );
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
          report: null,
          timer: null,
          listenEl: null,
          onEnded: null,
        };
        swap = handle;
        bodies.value = [...bodies.value, entering];
        swapPhase.value = "exit";
        await nextTick();
        // Preempted while the DOM patched? The newer swap owns the stage —
        // this continuation must not measure, dispatch or arm anything.
        if (swap !== handle) return;
        const newEl = flowRef.value?.querySelector<HTMLElement>(
          ".hk-stepflow-body.active",
        );
        const goneEl = flowRef.value?.querySelector<HTMLElement>(
          ".hk-stepflow-body.leaving",
        );
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
        if (handle.delta >= 0) {
          // Grow: the flow already owns the new height, so the sheet can
          // finish growing through THIS phase — the old body slides out
          // without the frame moving under it.
          announce(handle);
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
