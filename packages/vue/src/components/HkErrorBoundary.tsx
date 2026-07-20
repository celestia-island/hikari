import { defineComponent, onErrorCaptured, ref, type PropType, type VNode } from "vue";
import { AlertTriangle, Copy, RefreshCw } from "lucide-vue-next";
import { useClipboard } from "../runtime/useClipboard";
import HkButton from "./HkButton";
import HkScrollContainer from "./HkScrollContainer";
import "./HkErrorBoundary.scss";

export default defineComponent({
  name: "HkErrorBoundary",
  props: {
    name: { type: String, default: "unknown" },
    fallback: { type: Function as PropType<(err: string, retry: () => void) => VNode>, default: undefined },
  },
  setup(props, { slots }) {
    const clipboard = useClipboard();
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
          <div class="hk-error-boundary__card">
            <div class="hk-error-boundary__header">
              <AlertTriangle size={16} class="hk-error-boundary__icon" />
              <span class="hk-error-boundary__label">Component Error</span>
              {props.name !== "unknown" && (
                <span class="hk-error-boundary__tag">{props.name}</span>
              )}
            </div>
            <div class="hk-error-boundary__msg">
              <div style={{ maxHeight: "12rem" }}>
                <HkScrollContainer>
                  {error.value}
                </HkScrollContainer>
              </div>
            </div>
            <div class="hk-error-boundary__actions">
              <HkButton variant="ghost" size="sm" onClick={copyError}>
                <Copy size={12} />
                Copy Error
              </HkButton>
              <HkButton variant="outline" size="sm" onClick={retry}>
                <RefreshCw size={12} />
                Retry
              </HkButton>
            </div>
          </div>
        </div>
      );
    };
  },
});
