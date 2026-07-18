import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/badge.scss";

export default defineComponent({
  name: "HkBadge",
  props: {
    variant: { type: String as PropType<"default" | "primary" | "secondary" | "success" | "warning" | "danger" | "info">, default: "default" },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    dot: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const cls = computed(() => [
      "hi-badge",
      props.variant && props.variant !== "default" ? `hi-badge-${props.variant}` : "",
      props.size ? `hi-badge-${props.size}` : "",
      props.dot ? "hi-badge-dot" : "",
    ]);

    return () => (
      <span class={cls.value}>
        {props.dot ? <span class="hi-badge-dot-inner" /> : slots.default?.()}
      </span>
    );
  },
});
