import { computed, defineComponent, type PropType } from "vue";

export default defineComponent({
  name: "HkKbd",
  props: {
    keys: { type: String, required: true },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
  },
  setup(props) {
    const chunks = computed(() => props.keys.split("+").map((k) => k.trim()));

    return () => (
      <kbd
        class={["hk-kbd", `hk-kbd--${props.size}`]}
        aria-hidden="true"
      >
        {chunks.value.map((key, i) => (
          <span key={i}>
            {i > 0 && <span class="hk-kbd-sep">+</span>}
            <span class="hk-kbd-key">{key}</span>
          </span>
        ))}
      </kbd>
    );
  },
});
