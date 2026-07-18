import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/progress.scss";

export default defineComponent({
  name: "HkProgressBar",
  props: {
    value: { type: Number, default: 0 },
    variant: { type: String as PropType<"normal" | "active" | "success" | "exception">, default: "normal" },
    showLabel: { type: Boolean, default: false },
    height: { type: String, default: "8px" },
  },
  setup(props) {
    const clampedValue = computed(() => Math.max(0, Math.min(100, props.value)));

    const variantClass = computed(() => {
      if (props.variant === "exception") return "hi-progress-exception";
      if (props.variant === "success") return "hi-progress-success";
      if (props.variant === "active") return "hi-progress-active";
      return "hi-progress-normal";
    });

    return () => (
      <div class={["hi-progress-wrapper", variantClass.value]}>
        <div class="hi-progress-outer">
          <div class="hi-progress-inner" style={{ height: props.height }}>
            <div class="hi-progress-bg" style={{ width: `${clampedValue.value}%` }} />
          </div>
          {props.showLabel && <span class="hi-progress-text">{Math.round(clampedValue.value)}%</span>}
        </div>
      </div>
    );
  },
});
