import { computed, defineComponent, ref, type PropType } from "vue";
import { ChevronDown, ChevronRight, Info, TriangleAlert } from "lucide-vue-next";
import { useI18n } from "../i18n/context";

import "./HkErrorLanding.scss";

/** Visual severity of the landing icon and accents. */
export type HErrorTone = "error" | "warning" | "info";

/**
 * HkErrorLanding — the shared full-page error landing.
 *
 * Login-page-like layout: a centered card over a full-viewport backdrop,
 * carrying a tone icon, a (pre-translated) title and description, the wire
 * error code / HTTP status as meta chips, a collapsible raw-details section
 * (the default slot — hosts render HkJsonTree there) and an actions slot.
 *
 * The component is presentation-only and route-agnostic: it never touches
 * the router and can be mounted by an SPA overlay, a modal, or a standalone
 * server-rendered error page alike. All host-facing copy (`title`,
 * `description`, action buttons) arrives pre-translated; the component only
 * translates its own two labels via `hikari::errors.*`.
 */
export const HkErrorLanding = defineComponent({
  name: "HkErrorLanding",
  props: {
    /** Pre-translated headline. Falls back to `hikari::errors.defaultTitle`. */
    title: { type: String, default: "" },
    /** Pre-translated secondary text; newlines render as line breaks. */
    description: { type: String, default: "" },
    /** Wire error code chip, e.g. `unknown_provider`. */
    code: { type: String, default: "" },
    /** HTTP status chip, e.g. 400. */
    status: { type: Number, default: undefined },
    tone: { type: String as PropType<HErrorTone>, default: "error" },
    /** Initial expansion of the raw-details section. */
    detailsOpen: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const { t } = useI18n();
    const detailsExpanded = ref(props.detailsOpen);

    const titleText = computed(() => props.title || t("hikari::errors.defaultTitle", "Something went wrong"));
    const hasDetails = computed(() => slots.default != null);

    function toggleDetails() {
      detailsExpanded.value = !detailsExpanded.value;
    }

    return () => (
      <div class={`hk-error-landing is-${props.tone}`}>
        <div class="hk-error-landing__card">
          {slots.brand?.()}

          <div class="hk-error-landing__icon" aria-hidden="true">
            {props.tone === "info" ? <Info size={26} /> : <TriangleAlert size={26} />}
          </div>

          <h1 class="hk-error-landing__title">{titleText.value}</h1>

          {props.description && <p class="hk-error-landing__desc">{props.description}</p>}

          {(props.code || props.status != null) && (
            <div class="hk-error-landing__meta">
              {props.code && <code class="hk-error-landing__code">{props.code}</code>}
              {props.status != null && <span class="hk-error-landing__status">HTTP {props.status}</span>}
            </div>
          )}

          {hasDetails.value && (
            <div class="hk-error-landing__details">
              <button
                type="button"
                class="hk-error-landing__details-toggle"
                aria-expanded={detailsExpanded.value}
                onClick={toggleDetails}
              >
                {detailsExpanded.value ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span>{t("hikari::errors.rawDetails", "Raw error details")}</span>
              </button>
              {detailsExpanded.value && (
                <div class="hk-error-landing__details-body">{slots.default?.()}</div>
              )}
            </div>
          )}

          {slots.actions && <div class="hk-error-landing__actions">{slots.actions()}</div>}
        </div>
      </div>
    );
  },
});
