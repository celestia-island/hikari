import { computed, defineComponent, ref, type PropType } from "vue";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-vue-next";

import "./HkAlert.scss";

export type AlertVariant = "error" | "warning" | "info" | "success";
export type AlertSize = "sm" | "md" | "lg";

const VARIANT_ICONS: Record<AlertVariant, typeof AlertTriangle> = {
  error: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
};

export default defineComponent({
  name: "HkAlert",
  props: {
    variant: { type: String as PropType<AlertVariant>, default: "error" },
    message: { type: String, required: true },
    title: { type: String, default: undefined },
    closable: { type: Boolean, default: false },
    banner: { type: Boolean, default: false },
    size: { type: String as PropType<AlertSize>, default: "md" },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const isDismissed = ref(false);

    const rootCls = computed(() => [
      "hk-alert",
      `hk-alert--${props.variant}`,
      `hk-alert--${props.size}`,
      props.banner ? "hk-alert--banner" : "",
      !props.title ? "hk-alert--no-title" : "",
    ]);

    function onClose() {
      isDismissed.value = true;
      emit("close");
    }

    return () => {
      if (isDismissed.value) return null;

      const IconComp = VARIANT_ICONS[props.variant];

      return (
        <div class={rootCls.value}>
          <span class="hk-alert__icon">
            {slots.icon ? (
              slots.icon()
            ) : (
              <IconComp size={18} />
            )}
          </span>

          <div class="hk-alert__body">
            {props.title && (
              <p class="hk-alert__title">{props.title}</p>
            )}
            <p class="hk-alert__text">
              {slots.default ? slots.default() : props.message}
            </p>
          </div>

          {props.closable && (
            <button
              class="hk-alert__close"
              type="button"
              aria-label="Close"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          )}
        </div>
      );
    };
  },
});
