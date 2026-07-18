import { computed, defineComponent, type PropType } from "vue";

export default defineComponent({
  name: "HkKbd",
  props: {
    keys: { type: Array as PropType<string[]>, default: () => [] },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
  },
  setup(props, { slots }) {
    const cls = computed(() => ["hi-kbd", `hi-kbd-${props.size}`]);

    return () => (
      <kbd class={cls.value}>
        {slots.default ? (
          slots.default()
        ) : (
          props.keys.map((key, i) => (
            <span key={i}>
              {i > 0 && <span class="hi-kbd-plus">+</span>}
              <span class="hi-kbd-key">{key}</span>
            </span>
          ))
        )}
      </kbd>
    );
  },
});
