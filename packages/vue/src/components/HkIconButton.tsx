import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/icon_button.scss";
import "../../../components/src/styles/components/icon-button-vars.scss";

export default defineComponent({
  name: "HkIconButton",
  inheritAttrs: false,
  props: {
    icon: { type: String, default: "" },
    variant: { type: String as PropType<"ghost" | "primary" | "secondary" | "danger" | "success">, default: "ghost" },
    size: { type: Number as PropType<16 | 24 | 32 | 36 | 40>, default: 32 },
    disabled: { type: Boolean, default: false },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    const cls = computed(() => [
      "hi-icon-button",
      `hi-icon-button-${props.size}`,
      `hi-icon-button-${props.variant}`,
    ]);

    return () => (
      <button
        class={cls.value}
        disabled={props.disabled}
        onClick={(e: MouseEvent) => emit("click", e)}
      >
        <span class="hi-icon-button-icon">
          {slots.icon ? (
            slots.icon()
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
        </span>
      </button>
    );
  },
});
