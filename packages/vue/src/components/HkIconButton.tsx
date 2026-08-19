import { computed, defineComponent, type PropType } from "vue";
import "./HkIconButton.scss";
import "./HkIconButtonVars.scss";

/** Flatten every Vue class-binding form (string | array | object) into
 *  class-name strings. Object keys whose value is truthy are kept — the
 *  same normalization Vue itself applies to `class` bindings. */
function classesOf(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === "string") {
    return raw.split(/\s+/).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => classesOf(entry));
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, on]) => !!on)
      .map(([name]) => name);
  }
  return [];
}

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
  setup(props, { emit, slots, attrs }) {
    const cls = computed(() => [
      "hk-icon-button",
      `hk-icon-button-${props.size}`,
      `hk-icon-button-${props.variant}`,
      // inheritAttrs is false, so the caller's class would be silently
      // dropped by the spread below (explicit class wins). Merge every
      // binding form back in manually.
      ...classesOf(attrs.class),
    ]);

    return () => (
      <button
        {...attrs}
        class={cls.value}
        disabled={props.disabled}
        onClick={(e: MouseEvent) => emit("click", e)}
      >
        <span class="hk-icon-button-icon">
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
