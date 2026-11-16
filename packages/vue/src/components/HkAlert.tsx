import { computed, defineComponent, ref, type PropType } from "vue";
import { useI18n } from "../i18n/context";
import { hkPadStyle, type HkPad } from "../runtime/containerPad";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-vue-next";

import HIconButton from "./HkIconButton";

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
    /** Shared container-padding override (see runtime/containerPad) —
     *  unset keeps the size's own padding. */
    padding: { type: String as PropType<HkPad>, default: undefined },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const isDismissed = ref(false);

    const rootCls = computed(() => [
      "hk-alert",
      `hk-alert-${props.variant}`,
      `hk-alert-${props.size}`,
      props.banner ? "hk-alert-banner" : "",
      !props.title ? "hk-alert-no-title" : "",
    ]);

    // Live-region semantics by variant — the HkToast family split
    // (HkToast.tsx): errors/warnings interrupt (`role="alert"` +
    // assertive), everything else announces politely (`role="status"` +
    // polite). The aria-live attribute rides along explicitly, same as
    // HkToast / HkLoadingVeil / HkPersistentToast, though ARIA already
    // implies it from the role. A live region only announces content
    // inserted or changed AFTER it registers — an alert present at
    // mount is read in document order like static content; both real
    // in-repo consumers mount the alert conditionally (HkSectionCard
    // error state, HkMfaVerifyCard retry hint). The role rides the
    // ROOT so the whole alert body is one announced region.
    const a11y = computed(() =>
      props.variant === "error" || props.variant === "warning"
        ? ({ role: "alert", "aria-live": "assertive" } as const)
        : ({ role: "status", "aria-live": "polite" } as const),
    );

    function onClose() {
      isDismissed.value = true;
      emit("close");
    }

    return () => {
      if (isDismissed.value) return null;

      const IconComp = VARIANT_ICONS[props.variant];

      return (
        <div
          class={rootCls.value}
          style={hkPadStyle(props.padding)}
          role={a11y.value.role}
          aria-live={a11y.value["aria-live"]}
        >
          <span class="hk-alert-icon">
            {slots.icon ? (
              slots.icon()
            ) : (
              <IconComp size={18} />
            )}
          </span>

          <div class="hk-alert-body">
            {props.title && (
              <p class="hk-alert-title">{props.title}</p>
            )}
            <p class="hk-alert-text">
              {slots.default ? slots.default() : props.message}
            </p>
          </div>

          {props.closable && (
            /* The close affordance is the STANDARD icon button (2026-11-06
               family sweep): HkIconButton owns box, glyph size, hover, press
               and focus; the sheet keeps only the seat. */
            <HIconButton
              class="hk-alert-close"
              size={24}
              variant="ghost"
              aria-label={t("hikari::alert.close", "Close")}
              onClick={onClose}
            >
              {{ icon: () => <X aria-hidden="true" /> }}
            </HIconButton>
          )}
        </div>
      );
    };
  },
});
