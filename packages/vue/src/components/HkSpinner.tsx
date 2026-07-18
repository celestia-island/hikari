import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/spin.scss";

export default defineComponent({
  name: "HkSpinner",
  props: {
    size: { type: String as PropType<"xs" | "sm" | "md" | "lg">, default: "md" },
    label: { type: String },
    tone: { type: String },
  },
  setup(props, { slots }) {
    const cls = computed(() => [
      "hi-spin",
      `hi-spin-${props.size}`,
    ]);

    return () => (
      <div class={cls.value}>
        <span class="hi-spin-spinner" />
        {props.label ? <span class="hi-spin-tip">{props.label}</span> : slots.default?.()}
      </div>
    );
  },
});
