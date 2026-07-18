import { computed, defineComponent, ref, type PropType } from "vue";
import "../../../components/src/styles/components/alert.scss";

export default defineComponent({
  name: "HkAlert",
  props: {
    variant: { type: String as PropType<"info" | "success" | "warning" | "error">, default: "info" },
    title: { type: String },
    closable: { type: Boolean, default: false },
    banner: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const closed = ref(false);

    const cls = computed(() => [
      "hi-alert",
      `hi-alert-${props.variant}`,
      `hi-alert-${props.size}`,
      props.banner ? "hi-alert-banner" : "",
      !props.title ? "hi-alert-no-title" : "",
    ]);

    return () => {
      if (closed.value) return null;

      return (
        <div class={cls.value}>
          <span class="hi-alert-icon">
            {props.variant === "success" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            )}
            {props.variant === "error" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            {props.variant === "warning" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
            {props.variant === "info" && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
          </span>
          <div class="hi-alert-content">
            {props.title && <p class="hi-alert-title">{props.title}</p>}
            <p class="hi-alert-description">{slots.default?.()}</p>
          </div>
          {props.closable && (
            <button class="hi-alert-close" onClick={() => { closed.value = true; emit("close"); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      );
    };
  },
});
