import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/progress.scss";

export default defineComponent({
  name: "HkProgressRing",
  props: {
    value: { type: Number, default: 0 },
    size: { type: Number, default: 120 },
    strokeWidth: { type: Number, default: 8 },
    variant: { type: String as PropType<"normal" | "success" | "exception">, default: "normal" },
    showLabel: { type: Boolean, default: false },
  },
  setup(props) {
    const clampedValue = computed(() => Math.max(0, Math.min(100, props.value)));

    const radius = computed(() => (props.size - props.strokeWidth) / 2);
    const circumference = computed(() => 2 * Math.PI * radius.value);
    const dashOffset = computed(() => circumference.value * (1 - clampedValue.value / 100));

    const variantClass = computed(() => {
      if (props.variant === "exception") return "hi-progress-exception";
      if (props.variant === "success") return "hi-progress-success";
      return "hi-progress-normal";
    });

    const textSize = computed(() => Math.round(props.size / 5));

    return () => (
      <div class={["hi-progress-circle-wrapper", variantClass.value]} style={{ width: `${props.size}px`, height: `${props.size}px` }}>
        <svg class="hi-progress-circle" width={props.size} height={props.size}>
          <circle
            class="hi-progress-circle-trail"
            cx={props.size / 2}
            cy={props.size / 2}
            r={radius.value}
            fill="none"
            stroke-width={props.strokeWidth}
          />
          <circle
            class="hi-progress-circle-path"
            cx={props.size / 2}
            cy={props.size / 2}
            r={radius.value}
            fill="none"
            stroke-width={props.strokeWidth}
            stroke-dasharray={circumference.value}
            stroke-dashoffset={dashOffset.value}
            stroke-linecap="round"
          />
        </svg>
        {props.showLabel && (
          <span class="hi-progress-circle-text" style={{ fontSize: `${textSize.value}px` }}>
            {Math.round(clampedValue.value)}%
          </span>
        )}
      </div>
    );
  },
});
