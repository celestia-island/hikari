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
   *  (absolutely positioned) for the slide's duration. */
  phase: "active" | "leaving";
}

/** A swap in flight: the leaving body slides out while the entering one
 *  slides in. All MOTION is stylesheet-owned (the `data-direction`
 *  attribute plus the `hk-stepflow-enter-from`/`hk-stepflow-leave-to` classes); script only
 *  schedules the staging frame on the shared animation bus and books
 *  the cleanup. */
interface RunningSwap {
  leavingId: number;
  enteringId: number;
  /** The staging frame handle (disconnected when a re-swap pre-empts). */
  frame: AnimationHandle | null;
  /** Bus bookkeeping for the CSS sweep, held for its duration. */
  report: AnimationHandle | null;
  /** Watchdog: settle even if transitionend never arrives. */
  timer: ReturnType<typeof setTimeout> | null;
  listenEl: HTMLElement | null;
  onEnded: ((event: TransitionEvent) => void) | null;
}

export const STEPFLOW_SWAP_EVENT = "hk-stepflow-swap";

/** Extra grace on top of the resolved duration before the watchdog
 *  settles the swap without a transitionend — the same grammar as the
 *  sheet morph's sweep watchdog. */
const SWAP_WATCHDOG_GRACE_MS = 350;

/**
 * Resolve the body's configured transition duration in milliseconds.
 * A zero result means the swap settles INSTANTLY: reduced-motion users
 * (the stylesheet zeroes the transition) and stylesheet-less runtimes
 * (test environments) both get a deterministic single-body DOM with no
 * timers to outlive and no transitionend to wait for.
 */
function bodyTransitionMs(el: HTMLElement | null): number {
  if (!el) return 0;
  const view = el.ownerDocument?.defaultView;
  if (!view) return 0;
  const raw = view.getComputedStyle(el).transitionDuration ?? "";
  // Multiple entries ("0.3s, 0.3s") share one duration here — the first
  // is representative; "0.3s" and "300ms" forms both parse.
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
 * The swap choreography (2026-09-22 user directive: back to the classic
 * direction-aware slide, re-based on pure CSS with the animation context
 * driving state) — old and new bodies slide SIMULTANEOUSLY for the whole
 * `--hk-stepflow-duration` (default 0.3s): forward advances exit left /
 * enter from the right, back mirrors it. The entering body owns the
 * flow's height from frame one (so the hosting sheet's morph targets the
 * NEW geometry immediately) while the leaving body overlays it out of
 * flow; travel distance, direction and easings all live in the
 * stylesheet. State flips are scheduled on the shared animation bus:
 * one staging frame after the DOM patch commits the start states, both
 * bodies' classes flip in the same patch so leave and enter start on
 * the same style recalculation — the simultaneous grammar is what keeps
 * the retired `out-in` slide's empty mid-frame (and its raster flash)
 * from coming back.
 *
 * Each swap also dispatches `hk-stepflow-swap` (bubbles, detail
 * `{ delta }`) from the flow root — the hosting modal listens for it and
 * re-measures immediately, skipping the morph's settle debounce so the
 * sheet's clip sweep starts on the same frame as the slide.
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
    // `swap` is a plain let; `swapStage` carries the reactivity. Every
    // mutation of `swap` is paired with either a `swapStage` or a
    // `bodies` write, so renders always re-read the pair (see the watch
    // and endSwap below).
    let swap: RunningSwap | null = null;
    const swapStage = ref<"idle" | "staged" | "running">("idle");
    const flowRef = ref<HTMLDivElement | null>(null);

    function endSwap(): void {
      if (!swap) return;
      const handle = swap;
      swap = null;
      swapStage.value = "idle";
      handle.frame?.disconnect();
      if (handle.timer !== null) clearTimeout(handle.timer);
      handle.report?.disconnect();
      if (handle.listenEl && handle.onEnded) {
        handle.listenEl.removeEventListener("transitionend", handle.onEnded);
      }
      const id = handle.leavingId;
      bodies.value = bodies.value.filter((b) => b.id !== id);
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
        // A swap while the previous one is still sliding: drop the old
        // leaving body outright and let the new swap own the stage. (If
        // the previous entering body had not visibly settled yet it now
        // becomes the leaving one and exits from its mid-flight state —
        // one frame of re-staging, matching the classic grammar.)
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
        const durationMs = bodyTransitionMs(leavingEl);

        if (durationMs <= 0) {
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
              detail: { delta },
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
        // Register the swap BEFORE the reactive mutations so the staged
        // render already sees which entry is entering (hk-stepflow-enter-from) —
        // `swap` itself is not reactive.
        const handle: RunningSwap = {
          leavingId: leaving.id,
          enteringId: entering.id,
          frame: null,
          report: null,
          timer: null,
          listenEl: null,
          onEnded: null,
        };
        swap = handle;
        bodies.value = [...bodies.value, entering];
        swapStage.value = "staged";
        await nextTick();
        const newEl = flowRef.value?.querySelector<HTMLElement>(
          ".hk-stepflow-body.active",
        );
        const goneEl = flowRef.value?.querySelector<HTMLElement>(
          ".hk-stepflow-body.leaving",
        );
        if (!newEl || !goneEl) {
          // The flow went away mid-swap (unmount) — restore one body.
          swap = null;
          leaving.phase = "active";
          bodies.value = [leaving];
          swapStage.value = "idle";
          return;
        }
        const delta = newEl.offsetHeight - oldH;
        // Tell the hosting sheet to morph NOW (skip the settle debounce)
        // so its clip sweep runs on the same frames as this slide.
        flowRef.value?.dispatchEvent(
          new CustomEvent(STEPFLOW_SWAP_EVENT, {
            bubbles: true,
            detail: { delta },
          }),
        );
        handle.report = reportTransition(durationMs);
        handle.listenEl = goneEl;
        // Staging frame on the shared bus: commit the staged start states
        // (the forced layout read), then flip BOTH bodies' classes in one
        // patch — the leave and enter transitions start on the very same
        // style recalculation.
        handle.frame = scheduleFrame(() => {
          if (swap !== handle) return;
          handle.frame = null;
          void flowRef.value?.offsetHeight;
          const onEnded = (event: TransitionEvent) => {
            // transitionend bubbles — only the leaving body's own
            // property transitions may settle the swap.
            if (event.target === goneEl) endSwap();
          };
          goneEl.addEventListener("transitionend", onEnded);
          handle.onEnded = onEnded;
          handle.timer = setTimeout(
            endSwap,
            durationMs + SWAP_WATCHDOG_GRACE_MS,
          );
          swapStage.value = "running";
        });
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
                  entry.id === swap?.enteringId && swapStage.value === "staged"
                    ? "hk-stepflow-enter-from"
                    : null,
                  entry.id === swap?.leavingId && swapStage.value === "running"
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
