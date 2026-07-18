import { computed, defineComponent, useAttrs, type PropType } from "vue";
import "../../../components/src/styles/components/button.scss";
import "../../../components/src/styles/components/button-vars.scss";

export default defineComponent({
  name: "HkButton",
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<"primary" | "secondary" | "danger" | "ghost" | "outline">, default: "primary" },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    block: { type: Boolean, default: false },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    const attrs = useAttrs();
    const cls = computed(() => [
      "hikari-btn",
      `hikari-btn--${props.variant}`,
      `hikari-btn--${props.size}`,
      props.loading ? "hikari-btn--loading" : "",
      props.block ? "hikari-btn--block" : "",
    ]);

    return () => (
      <button
        class={cls.value}
        disabled={props.disabled || props.loading}
        onClick={(e: MouseEvent) => emit("click", e)}
        {...attrs}
      >
        {props.loading && <span class="hikari-btn__spinner" />}
        {slots.default?.()}
      </button>
    );
  },
});
