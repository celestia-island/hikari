import { defineComponent, onErrorCaptured, ref } from "vue";
import { AlertTriangle } from "lucide-vue-next";
import { useClipboard } from "../runtime/useClipboard";
import HkButton from "./HkButton";
import "./HkErrorBoundary.scss";

export default defineComponent({
  name: "HkErrorBoundary",
  props: {
    name: { type: String, default: "unknown" },
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
            <div class="hk-error-boundary__msg">{error.value}</div>
            <div class="hk-error-boundary__actions">
              <HkButton variant="ghost" size="sm" onClick={copyError}>
                Copy Error
              </HkButton>
              <HkButton variant="outline" size="sm" onClick={retry}>
                Retry
              </HkButton>
            </div>
          </div>
        </div>
      );
    };
  },
});
