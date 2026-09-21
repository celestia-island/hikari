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
   *  (absolutely positioned) for the crossfade's duration. */
  phase: "active" | "leaving";
}

/** A swap whose leaving body was handed its end state (transition armed). */
interface RunningSwap {
  entryId: number;
  timer: ReturnType<typeof setTimeout>;
}

export const STEPFLOW_SWAP_EVENT = "hk-stepflow-swap";

/**
 * Generic step-flow container: an optional HkTimeline header bound to
 * `modelValue` plus a crossfading body fed purely by named slots keyed
 * by step key. Navigation state lives in the consumer — the component
 * only translates `modelValue` changes into body swaps and echoes
 * timeline selections upward.
 *
 * The swap choreography (2026-09-21 user spec, round 7): old and new
 * bodies cross-fade SIMULTANEOUSLY for the whole `--hk-stepflow-duration`
 * (default 0.3s), and exactly one of them rides the sheet's moving top
 * edge while the other stays pinned at the post-swap geometry:
 *
 * - SHRINK (old body taller): the sheet's top edge folds DOWN, so the
 *   OLD body rides it (translateY −Δ → 0, glued to the edge) while it
 *   fades out; the NEW body is already at its final top and only fades
 *   in. (The container's layout height is the new body's from frame
 *   one, so the sheet morph and the crossfade start together.)
 * - GROW: mirrored — the OLD body stays where it was (its top is below
 *   the container's new top by Δ, i.e. exactly the band the sheet's
 *   staged clip keeps visible) and fades out; the NEW body rides the
 *   edge upward (translateY +Δ → 0) while fading in.
 *
 * Each swap also dispatches `hk-stepflow-swap` (bubbles, detail
 * `{ delta }`) from the flow root — the hosting modal listens for it and
 * re-measures immediately, skipping the morph's settle debounce so the
 * sheet's clip sweep starts on the same frame as the crossfade.
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

    // ── Crossfade body bookkeeping ────────────────────────────────────
    let mountSeq = 0;
    const bodies = ref<BodyEntry[]>([
      { id: mountSeq++, key: props.modelValue, phase: "active" },
    ]);
    let swap: RunningSwap | null = null;
    const flowRef = ref<HTMLDivElement | null>(null);

    function endSwap(): void {
      if (!swap) return;
      clearTimeout(swap.timer);
      const id = swap.entryId;
      swap = null;
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
        // A swap while the previous one is still fading: drop the old
        // leaving body outright (its content is gone from the flow) and
        // let the new swap own the choreography.
        endSwap();
        const leaving = bodies.value.find((b) => b.phase === "active");
        if (!leaving) return;
        // Pre-swap geometry while the leaving body still owns the flow:
        // its height is the "old" reference for the ride distance.
        const leavingEl = flowRef.value?.querySelector<HTMLElement>(
          ".hk-stepflow-body.active",
        );
        const oldH = leavingEl?.offsetHeight ?? 0;
        leaving.phase = "leaving";
        bodies.value = [
          ...bodies.value,
          { id: mountSeq++, key: next, phase: "active" },
        ];
        await nextTick();
        // Post-swap geometry: the container's flow height is the new
        // body's; the leaving body (already absolute) keeps reporting
        // its own height for the delta.
        const newEl = flowRef.value?.querySelector<HTMLElement>(
          ".hk-stepflow-body.active",
        );
        const goneEl = flowRef.value?.querySelector<HTMLElement>(
          ".hk-stepflow-body.leaving",
        );
        if (!newEl || !goneEl) {
          leaving.phase = "active";
          bodies.value = bodies.value.filter((b) => b.phase === "active");
          return;
        }
        const newH = newEl.offsetHeight;
        const delta = newH - oldH;
        // Ride distance (px): one body rides the sheet's moving top edge
        // by exactly |Δ|; the other stays put. Grow: new rides from +Δ
        // (the old top) to 0. Shrink: old rides from −Δ (its original
        // top, above the container's new top) to 0.
        const mag = Math.abs(delta);
        const rides = delta > 0 ? goneEl : newEl;
        const from = `${delta > 0 ? mag : -mag}px`;
        // Arm the riders: stage the start state with the transition off,
        // flush, then flip to the end state under the live transition
        // (same dance grammar as the sheet morph — no mid-frame paint of
        // the intermediate state).
        for (const el of [goneEl, newEl]) {
          el.style.transition = "none";
        }
        goneEl.style.transform = delta > 0 ? "translateY(0px)" : from;
        newEl.style.transform = delta > 0 ? from : "translateY(0px)";
        goneEl.style.opacity = "1";
        newEl.style.opacity = "0";
        void flowRef.value?.offsetHeight;
        for (const el of [goneEl, newEl]) {
          el.style.transition = "";
        }
        rides.style.transform = "translateY(0px)";
        goneEl.style.opacity = "0";
        newEl.style.opacity = "1";
        // Tell the hosting sheet to morph NOW (skip the settle debounce)
        // so its clip sweep runs on the same frames as this crossfade.
        flowRef.value?.dispatchEvent(
          new CustomEvent(STEPFLOW_SWAP_EVENT, {
            bubbles: true,
            detail: { delta },
          }),
        );
        const entryId = leaving.id;
        const timer = setTimeout(endSwap, 480);
        swap = { entryId, timer };
      },
      { flush: "post" },
    );

    onMounted(() => {
      const host = flowRef.value?.closest(`.${SCROLL_HOST_CLASS}`);
      if (host?.hasAttribute("data-pad-cover")) pinStrategy.value = "offset";
    });

    onBeforeUnmount(() => {
      if (swap) clearTimeout(swap.timer);
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
          <div class="hk-stepflow-bodies">
            {bodies.value.map((entry) => (
              <div
                key={entry.id}
                class={["hk-stepflow-body", entry.phase]}
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
