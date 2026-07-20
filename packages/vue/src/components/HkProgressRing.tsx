import { computed, defineComponent, type PropType } from "vue";

import "./HkProgressRing.scss";

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
    const clampedValue = computed(() => Math.min(100, Math.max(0, props.value)));

    const radius = computed(() => (props.size - props.strokeWidth) / 2);
    const circumference = computed(() => 2 * Math.PI * radius.value);
    const dashOffset = computed(() => circumference.value * (1 - clampedValue.value / 100));

    const variantClass = computed(() => {
      if (props.variant === "success") return "hk-progress-ring--success";
      if (props.variant === "exception") return "hk-progress-ring--exception";
      return "";
    });

    const textSize = computed(() => Math.round(props.size / 5));

    const center = computed(() => props.size / 2);

    return () => (
      <div
        class={["hk-progress-ring", variantClass.value]}
        style={{ width: `${props.size}px`, height: `${props.size}px` }}
        role="progressbar"
        aria-valuenow={clampedValue.value}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg class="hk-progress-ring-svg" viewBox={`0 0 ${props.size} ${props.size}`}>
          <circle
            class="hk-progress-ring-track"
            cx={center.value}
            cy={center.value}
            r={radius.value}
            fill="none"
            stroke="currentColor"
            stroke-width={props.strokeWidth}
            stroke-linecap="round"
          />
          <circle
            class="hk-progress-ring-fill"
            cx={center.value}
            cy={center.value}
            r={radius.value}
            fill="none"
            stroke-width={props.strokeWidth}
            stroke-dasharray={circumference.value}
            stroke-dashoffset={dashOffset.value}
            stroke-linecap="round"
            transform={`rotate(-90 ${center.value} ${center.value})`}
          />
        </svg>
        {props.showLabel && (
          <span class="hk-progress-ring-label" style={{ fontSize: `${textSize.value}px` }}>
            {Math.round(clampedValue.value)}%
          </span>
        )}
      </div>
    );
  },
});
