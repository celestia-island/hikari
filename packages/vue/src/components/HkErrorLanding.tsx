import { Braces, Info, TriangleAlert } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  type PropType,
} from "vue";

import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { useI18n } from "../i18n/context";
import HkBadge from "./HkBadge";

import "./HkErrorLanding.scss";

/** Visual severity of the landing icon and accents. */
export type HErrorTone = "error" | "warning" | "info";

/**
 * Layout variant of the landing.
 * - `page` (default): owns a full-viewport backdrop — for overlays and
 *   standalone error pages.
 * - `inline`: drops the backdrop and viewport height so the same card can
 *   live inside a pane captured by HkErrorBoundary.
 */
export type HErrorLandingVariant = "page" | "inline";

/**
 * HkErrorLanding — the shared full-page error landing.
 *
 * Login-page-like layout: a centered card over a full-viewport backdrop,
 * carrying a tone icon, a (pre-translated) title and description, the wire
 * error code / HTTP status as HkBadge chips above the headline, an
 * always-open raw-details pane (the default slot — hosts render HkJsonTree
 * there) with a FIXED ~20vh footprint carried by the family overlay
 * scrollbar, and an actions slot.
 *
 * The details pane deliberately never collapses and never grows past its
 * frame: folding every JSON node still leaves the pane standing, and a
 * long stack trace scrolls inside it instead of stretching the card.
 *
 * The component is presentation-only and route-agnostic: it never touches
 * the router and can be mounted by an SPA overlay, a modal, or a standalone
 * server-rendered error page alike. All host-facing copy (`title`,
 * `description`, action buttons) arrives pre-translated; the component only
 * translates its own labels via `hikari::errors.*`.
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
    /** Layout variant: `page` (viewport backdrop) or `inline` (in-flow card). */
    variant: { type: String as PropType<HErrorLandingVariant>, default: "page" },
  },
  setup(props, { slots }) {
    const { t } = useI18n();

    const titleText = computed(() => props.title || t("hikari::errors.defaultTitle", "Something went wrong"));
    const hasDetails = computed(() => slots.default != null);

    // Badge variant follows the landing tone so the chip, the icon and the
    // card wash always speak the same severity language.
    const codeBadgeVariant = computed(() =>
      props.tone === "warning" ? "warning" : props.tone === "info" ? "info" : "error",
    );

    const detailsBodyRef = ref<HTMLElement | null>(null);
    let detailsScrollbars: OverlayScrollbarHandle | null = null;
    // The pane's viewport box is fixed, so the composable's own viewport
    // ResizeObserver never fires when the slot content changes size — and
    // folding a JSON node re-renders HkJsonTree internally, so the landing
    // itself does not re-render either. Observe the CONTENT element (the
    // tree root) so every fold/expand re-reads the thumb geometry.
    let contentResizeObserver: ResizeObserver | null = null;
    let observedContent: Element | null = null;

    function observeDetailsContent() {
      const content = detailsBodyRef.value?.firstElementChild ?? null;
      if (content === observedContent) return;
      if (observedContent) contentResizeObserver?.unobserve(observedContent);
      observedContent = content;
      if (content) contentResizeObserver?.observe(content);
    }

    function ensureDetailsScrollbars() {
      if (detailsScrollbars || !detailsBodyRef.value) return;
      detailsScrollbars = attachOverlayScrollbars(detailsBodyRef.value);
      contentResizeObserver = new ResizeObserver(() => detailsScrollbars?.update());
      observeDetailsContent();
    }

    function releaseDetailsScrollbars() {
      detailsScrollbars?.detach();
      detailsScrollbars = null;
      contentResizeObserver?.disconnect();
      contentResizeObserver = null;
      observedContent = null;
    }

    onMounted(() => {
      ensureDetailsScrollbars();
    });

    // Covers landing rerenders (thumb geometry re-read) plus the rare
    // dynamic-slot cases: a slot appearing after mount attaches the
    // chrome, a slot removed at runtime tears it down (element-identity
    // check, not the frozen hasDetails computed).
    onUpdated(() => {
      if (detailsBodyRef.value) {
        ensureDetailsScrollbars();
        observeDetailsContent();
        detailsScrollbars?.update();
      } else if (detailsScrollbars) {
        releaseDetailsScrollbars();
      }
    });

    onBeforeUnmount(() => {
      releaseDetailsScrollbars();
    });

    return () => (
      <div class={`hk-error-landing is-${props.tone}${props.variant === "inline" ? " is-inline" : ""}`}>
        <div class="hk-error-landing__card">
          {slots.brand?.()}

          <div class="hk-error-landing__icon" aria-hidden="true">
            {props.tone === "info" ? <Info size={28} /> : <TriangleAlert size={28} />}
          </div>

          {(props.code || props.status != null) && (
            <div class="hk-error-landing__meta">
              {/* The landing-scoped selectors (.hk-error-landing__code/
                  __status) and family tests rely on the class falling
                  through onto the badge root — HkBadge must stay
                  single-rooted for that contract to hold. */}
              {props.code && (
                <HkBadge class="hk-error-landing__code" variant={codeBadgeVariant.value} size="sm" mono>
                  {props.code}
                </HkBadge>
              )}
              {props.status != null && (
                <HkBadge class="hk-error-landing__status" variant="muted" size="sm" mono>
                  HTTP {props.status}
                </HkBadge>
              )}
            </div>
          )}

          <h1 class="hk-error-landing__title">{titleText.value}</h1>

          {props.description && <p class="hk-error-landing__desc">{props.description}</p>}

          {hasDetails.value && (
            <div class="hk-error-landing__details">
              <div class="hk-error-landing__details-label" aria-hidden="true">
                <Braces size={11} />
                <span>{t("hikari::errors.rawDetails", "Raw error details")}</span>
              </div>
              <div class="hk-error-landing__details-pane">
                <div ref={detailsBodyRef} class="hk-error-landing__details-body">
                  {slots.default?.()}
                </div>
              </div>
            </div>
          )}

          {slots.actions && <div class="hk-error-landing__actions">{slots.actions()}</div>}
        </div>
      </div>
    );
  },
});
