import { RefreshCw } from "lucide-vue-next";
import { computed, defineComponent, onErrorCaptured, ref, type PropType, type VNode } from "vue";

import { useI18n } from "../i18n/context";
import HButton from "./HkButton";
import { HkErrorLanding } from "./HkErrorLanding";
import { HkJsonTree } from "./HkJsonTree";

interface CapturedError {
  name: string;
  message: string;
  stack: string;
}

function captureError(err: unknown): CapturedError {
  if (err instanceof Error) {
    return { name: err.name || "Error", message: err.message, stack: err.stack || "" };
  }
  return { name: "Error", message: String(err), stack: "" };
}

function formatError(err: CapturedError): string {
  return err.stack ? `${err.name}: ${err.message}\n\n${err.stack}` : `${err.name}: ${err.message}`;
}

/**
 * HkErrorBoundary — inline crash guard rendering the shared error landing.
 *
 * Captures descendant errors via `onErrorCaptured` and stops propagation.
 * The built-in fallback is the same HkErrorLanding card the family's
 * full-page takeovers use (inline variant): tone icon, headline, the error
 * name as the tone-matched HkBadge chip, the message as the description,
 * the raw name/message/stack in the fixed-height JSON tree pane, plus the
 * retry action and the landing's built-in copy action (fed with the
 * formatted error text).
 */
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
    const { t } = useI18n();
    const error = ref<CapturedError | null>(null);

    onErrorCaptured((err) => {
      const captured = captureError(err);
      console.error(`[ErrorBoundary:${props.name}]`, err);
      error.value = captured;
      return false;
    });

    function retry() {
      error.value = null;
    }

    const detailsValue = computed(() => {
      if (!error.value) return undefined;
      const record: Record<string, unknown> = {
        name: error.value.name,
        message: error.value.message,
      };
      if (error.value.stack) record.stack = error.value.stack;
      if (props.name !== "unknown") record.boundary = props.name;
      return record;
    });

    return () => {
      if (error.value === null) {
        return slots.default?.();
      }

      const err = error.value;

      if (props.fallback) {
        return props.fallback(formatError(err), retry);
      }

      return (
        <HkErrorLanding
          variant="inline"
          title={props.errorTitle || t("hikari::errors.defaultTitle", "Something went wrong")}
          description={err.message}
          code={err.name}
          // The copy action is the landing's built-in now (seated left of
          // the host actions, one design family-wide); this boundary only
          // feeds it the formatted error and its legacy label override.
          copyText={formatError(err)}
          copyLabel={props.copyErrorLabel}
        >
          {{
            default: () => <HkJsonTree value={detailsValue.value} ariaLabel="stack trace" />,
            actions: () => [
              <HButton variant="primary" size="sm" onClick={retry}>
                <RefreshCw size={12} />
                {props.retryLabel || t("hikari::errorBoundary.retry", "Retry")}
              </HButton>,
            ],
          }}
        </HkErrorLanding>
      );
    };
  },
});
