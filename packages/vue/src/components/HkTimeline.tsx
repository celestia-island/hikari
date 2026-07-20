import { defineComponent, type PropType } from "vue";
import { Check } from "lucide-vue-next";

import "./HkTimeline.scss";

export type TimelineStepStatus = "completed" | "active" | "pending";

export interface TimelineStep {
  key: string;
  label: string;
  icon?: string;
}

export default defineComponent({
  name: "HkTimeline",
  props: {
    steps: { type: Array as PropType<TimelineStep[]>, required: true },
    currentKey: { type: String, required: true },
    orientation: {
      type: String as PropType<"horizontal" | "vertical">,
      default: "horizontal",
    },
    clickable: { type: Boolean, default: false },
  },
  emits: {
    select: (_key: string) => true,
  },
  setup(props, { emit }) {
    return () => {
      const currentIndex = props.steps.findIndex(
        (s) => s.key === props.currentKey,
      );

      return (
        <div
          class="hk-timeline"
          data-orientation={props.orientation}
        >
          {props.steps.map((step, idx) => {
            const status: TimelineStepStatus =
              idx < currentIndex
                ? "completed"
                : idx === currentIndex
                  ? "active"
                  : "pending";

            const isLast = idx === props.steps.length - 1;

            return (
              <div
                key={step.key}
                class="hk-timeline-step"
                data-status={status}
                data-last={isLast || undefined}
                data-clickable={(props.clickable && status === "completed") || undefined}
                role={props.clickable ? "button" : undefined}
                tabindex={props.clickable && status === "completed" ? 0 : undefined}
                onClick={() => {
                  if (props.clickable && status === "completed")
                    emit("select", step.key);
                }}
                onKeydown={(e: KeyboardEvent) => {
                  if (
                    props.clickable &&
                    status === "completed" &&
                    (e.key === "Enter" || e.key === " ")
                  ) {
                    e.preventDefault();
                    emit("select", step.key);
                  }
                }}
              >
                <span
                  data-el="indicator"
                  aria-hidden="true"
                >
                  {status === "completed" && (
                    <Check size={12} data-el="check" strokeWidth={3} />
                  )}
                  {status !== "completed" && (
                    <span data-el="num">{idx + 1}</span>
                  )}
                </span>
                <span data-el="label">{step.label}</span>
                {!isLast && (
                  <div data-el="connector" />
                )}
              </div>
            );
          })}
        </div>
      );
    };
  },
});
