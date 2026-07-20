import { computed, defineComponent, type PropType } from "vue";
import { X } from "lucide-vue-next";
import "./HkTag.scss";

export type TagVariant = "default" | "primary" | "success" | "warning" | "danger" | "info";

export default defineComponent({
  name: "HkTag",
  props: {
    variant: { type: String as PropType<TagVariant>, default: "default" },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
    closable: { type: Boolean, default: false },
    icon: { type: String, default: undefined },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const cls = computed(() => [
      "hk-tag",
      `hk-tag-${props.variant}`,
      `hk-tag-${props.size}`,
    ]);

    return () => (
      <span class={cls.value}>
        {props.icon && (
          <span class="hk-tag-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
            </svg>
          </span>
        )}
        {slots.default?.()}
        {props.closable && (
          <button
            type="button"
            class="hk-tag-close"
            onClick={() => emit("close")}
          >
            <X size={12} />
          </button>
        )}
      </span>
    );
  },
});
