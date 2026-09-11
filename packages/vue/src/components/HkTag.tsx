import { X } from "lucide-vue-next";
import { computed, defineComponent, type PropType } from "vue";

import "./HkTag.scss";

export type TagVariant = "default" | "primary" | "success" | "warning" | "danger" | "info";

export default defineComponent({
  name: "HkTag",
  props: {
    variant: { type: String as PropType<TagVariant>, default: "default" },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
    closable: { type: Boolean, default: false },
    /**
     * Accessible name of the close button, rendered as its `aria-label`.
     * Undefined (the default) renders exactly the pre-prop markup, so
     * existing consumers are untouched; tag fields that can carry several
     * chips side by side set it to name the entry each × removes.
     */
    closeLabel: { type: String, default: undefined },
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
        {slots.icon && (
          <span class="hk-tag-icon">
            {slots.icon()}
          </span>
        )}
        {slots.default?.()}
        {props.closable && (
          <button
            type="button"
            class="hk-tag-close"
            aria-label={props.closeLabel}
            onClick={() => emit("close")}
          >
            <X size={12} />
          </button>
        )}
      </span>
    );
  },
});
