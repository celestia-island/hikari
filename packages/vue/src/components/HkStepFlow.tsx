import { defineComponent, Transition, onMounted, ref, watch, type PropType } from "vue";

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

/**
 * Generic step-flow container: an optional HkTimeline header bound to
 * `modelValue` plus a direction-aware sliding body fed purely by named
 * slots keyed by step key. Navigation state lives in the consumer — the
 * component only translates `modelValue` changes into `out-in` body
 * transitions and echoes timeline selections upward.
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
    const flowRef = ref<HTMLDivElement | null>(null);
    const pinStrategy = ref<"offset" | "bleed">("bleed");

    onMounted(() => {
      const host = flowRef.value?.closest(`.${SCROLL_HOST_CLASS}`);
      if (host?.hasAttribute("data-pad-cover")) pinStrategy.value = "offset";
    });

    return () => {
      const index = indexOf(props.modelValue);
      // An unknown key finds no slot: the body simply renders empty, no
      // warnings — consumers may briefly park between two known steps.
      const slotFn = index >= 0 ? slots[props.modelValue] : undefined;
      const dir = direction.value;

      return (
        <div
          ref={flowRef}
          class="hk-step-flow"
          data-sticky-header={props.stickyHeader || undefined}
        >
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
          <Transition
            name={dir === "back" ? "hk-stepflow-back" : "hk-stepflow-fwd"}
            mode="out-in"
          >
            <div key={props.modelValue} class="hk-stepflow-body">
              {slotFn?.({ key: props.modelValue, index, direction: dir })}
            </div>
          </Transition>
        </div>
      );
    };
  },
});
