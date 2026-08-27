import { defineComponent, Transition, watch, ref, type PropType } from "vue";

import HkTimeline from "./HkTimeline";
import type { TimelineCollapse, TimelineStep } from "./HkTimeline";

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
    let previousIndex = props.steps.findIndex((s) => s.key === props.modelValue);

    watch(
      () => props.modelValue,
      () => {
        const nextIndex = props.steps.findIndex((s) => s.key === props.modelValue);
        direction.value =
          previousIndex >= 0 && nextIndex >= 0 && nextIndex < previousIndex
            ? "back"
            : "forward";
        previousIndex = nextIndex;
      },
    );

    return () => {
      const index = props.steps.findIndex((s) => s.key === props.modelValue);
      // An unknown key finds no slot: the body simply renders empty, no
      // warnings — consumers may briefly park between two known steps.
      const slotFn = index >= 0 ? slots[props.modelValue] : undefined;
      const dir = direction.value;

      return (
        <div class="hk-step-flow">
          {!props.hideTimeline && (
            <HkTimeline
              steps={props.steps}
              currentKey={props.modelValue}
              clickable={props.timelineClickable}
              collapse={props.collapse}
              onSelect={(key: string) => emit("update:modelValue", key)}
            />
          )}
          <Transition
            name={dir === "back" ? "hk-stepflow-back" : "hk-stepflow-fwd"}
            mode="out-in"
            appear
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
