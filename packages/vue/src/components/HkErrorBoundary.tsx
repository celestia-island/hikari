import { Copy, RefreshCw, TriangleAlert as AlertTriangle } from "lucide-vue-next";
import { defineComponent, onErrorCaptured, ref, type PropType, type VNode } from "vue";



import { useClipboard } from "../runtime/useClipboard";
import { useI18n } from "../i18n/context";
import HButton from "./HkButton";
import HScrollContainer from "./HkScrollContainer";
import "./HkErrorBoundary.scss";

export default defineComponent({
  name: "HkErrorBoundary",
  props: {
    name: { type: String, default: "unknown" },
    fallback: { type: Function as PropType<(err: string, retry: () => void) => VNode>, default: undefined },
    errorTitle: { type: String, default: "" },
    copyErrorLabel: { type: String, default: "" },
    retryLabel: { type: String, default: "" },
  },
  setup(props, { slots }) {
    const clipboard = useClipboard();
    const { t } = useI18n();
    const error = ref<string | null>(null);

    onErrorCaptured((err) => {
      const msg =
        err instanceof Error
          ? `${err.name}: ${err.message}\n\n${err.stack || ""}`
          : String(err);
      console.error(`[ErrorBoundary:${props.name}]`, msg);
      error.value = msg;
      return false;
    });

    function retry() {
      error.value = null;
    }

    function copyError() {
      clipboard.copy(error.value!);
    }

    return () => {
      if (error.value === null) {
        return slots.default?.();
      }

      if (props.fallback) {
        return props.fallback(error.value, retry);
      }

      return (
        <div class="hk-error-boundary">
          <div class="hk-error-boundary-card">
            <div class="hk-error-boundary-header">
              <AlertTriangle size={16} class="hk-error-boundary-icon" />
              <span class="hk-error-boundary-label">{props.errorTitle || t("hikari::errorBoundary.title", "Component Error")}</span>
              {props.name !== "unknown" && (
                <span class="hk-error-boundary-tag">{props.name}</span>
              )}
            </div>
            <div class="hk-error-boundary-msg">
              <div style={{ maxHeight: "12rem" }}>
                <HScrollContainer>
                  {error.value}
                </HScrollContainer>
              </div>
            </div>
            <div class="hk-error-boundary-actions">
              <HButton variant="ghost" size="sm" onClick={copyError}>
                <Copy size={12} />
                {props.copyErrorLabel || t("hikari::errorBoundary.copyError", "Copy Error")}
              </HButton>
              <HButton variant="outline" size="sm" onClick={retry}>
                <RefreshCw size={12} />
                {props.retryLabel || t("hikari::errorBoundary.retry", "Retry")}
              </HButton>
            </div>
          </div>
        </div>
      );
    };
  },
});
