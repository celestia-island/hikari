import { computed, defineComponent } from "vue";

import { useI18n } from "../i18n/context";
import HButton from "../components/HkButton";
import { HkErrorLanding } from "../components/HkErrorLanding";
import { HkJsonTree } from "../components/HkJsonTree";
import {
  getErrorReportingOptions,
  useErrorReportingState,
} from "./state";

import "./HkErrorReportingOverlay.scss";

/**
 * HkErrorReportingOverlay — the full-viewport takeover for uncaught errors.
 *
 * Renders nothing until the error-reporting state is raised. The card is
 * the family-wide HkErrorLanding (same design language as every unified
 * error surface): tone icon, headline, the error name as the code chip,
 * the message as the description, the raw error record in a collapsible
 * JSON tree, and Home / Retry actions.
 *
 * Mounted by `createErrorReporting` on a dedicated root appended to
 * `document.body` via its own tiny app instance, so it keeps working even
 * when the host component tree is the thing that crashed.
 */
export const HkErrorReportingOverlay = defineComponent({
  name: "HkErrorReportingOverlay",
  setup() {
    const { t } = useI18n();
    const state = useErrorReportingState();

    const detailsValue = computed<Record<string, unknown> | undefined>(() => {
      const err = state.value;
      if (!err) return undefined;
      const record: Record<string, unknown> = {
        name: err.name,
        message: err.message,
        source: err.source,
      };
      if (err.stack) record.stack = err.stack;
      if (err.info) record.info = err.info;
      return record;
    });

    function goHome() {
      const options = getErrorReportingOptions();
      if (options.onHome) {
        options.onHome();
        return;
      }
      const href = options.homeHref === undefined ? "/" : options.homeHref;
      if (href !== false) window.location.assign(href);
    }

    function retry() {
      const options = getErrorReportingOptions();
      if (options.onRetry) {
        options.onRetry();
        return;
      }
      window.location.reload();
    }

    return () => {
      const err = state.value;
      if (!err) return null;
      const options = getErrorReportingOptions();

      const description = options.describe
        ? options.describe(err)
        : err.message || t("hikari::errors.unexpectedDesc", "An unhandled error occurred.");

      const showHome = Boolean(options.onHome) || options.homeHref !== false;

      return (
        <div class="hk-error-reporting-overlay" role="alertdialog" aria-live="assertive" aria-modal="true">
          <HkErrorLanding
            title={options.title || t("hikari::errors.defaultTitle", "Something went wrong")}
            description={description}
            code={err.name}
          >
            {{
              default: () => <HkJsonTree value={detailsValue.value} ariaLabel="stack trace" />,
              actions: () => [
                ...(showHome
                  ? [(
                    <HButton key="home" size="sm" onClick={goHome}>
                      {t("hikari::errors.backHome", "Back to home")}
                    </HButton>
                  )]
                  : []),
                <HButton key="retry" size="sm" variant="secondary" onClick={retry}>
                  {t("hikari::errorBoundary.retry", "Retry")}
                </HButton>,
              ],
            }}
          </HkErrorLanding>
        </div>
      );
    };
  },
});
