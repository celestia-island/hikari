import { computed, defineComponent, type PropType } from "vue";

export default defineComponent({
  name: "HkTag",
  props: {
    color: { type: String },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    closable: { type: Boolean, default: false },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const cls = computed(() => [
      "hi-tag",
      `hi-tag-${props.size}`,
    ]);

    const tagStyle = computed(() => {
      if (props.color) {
        return {
          borderColor: props.color,
          color: props.color,
          backgroundColor: `${props.color}1a`,
        };
      }
      return {};
    });

    return () => (
      <span class={cls.value} style={tagStyle.value}>
        {slots.default?.()}
        {props.closable && (
          <button type="button" class="hi-tag-close" onClick={() => emit("close")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </span>
    );
  },
});
