import { Braces, Check, Copy, Info, TriangleAlert } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  ref,
  type PropType,
  type VNode,
} from "vue";

import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { useI18n } from "../i18n/context";
import { useClipboard } from "../runtime/useClipboard";
import HkBadge from "./HkBadge";
import HkButton from "./HkButton";

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

/** Slot renderers may return a single vnode or an array — normalize to an
 *  array so the built-in copy action and the host's actions share one row. */
function normalizeSlotNodes(nodes: VNode | VNode[] | undefined): VNode[] {
  if (!nodes) return [];
  return Array.isArray(nodes) ? nodes : [nodes];
}

/**
 * HkErrorLanding — the shared full-page error landing.
 *
 * Login-page-like layout: a centered card over a full-viewport backdrop,
 * carrying a tone icon, a (pre-translated) title and description, the wire
 * error code / HTTP status as HkBadge chips above the headline, an
 * always-open raw-details pane (the default slot — hosts render HkJsonTree
 * there) with a STABLE standing frame — the larger of 9rem and ~20vh,
 * carried by the family overlay scrollbar on BOTH axes (vertical for long
 * stacks, horizontal for deep/wide JSON) — and an actions slot.
 *
 * The pane never breathes with its content: folding every JSON node only
 * changes what renders INSIDE the standing frame, and a long stack trace
 * scrolls inside it instead of stretching the card. (The 2026-10-01
 * content-hugging frame was reverted the same day: on mobile the whole
 * error card visibly jumped between fold states, which read as broken.)
 *
 * The component is presentation-only and route-agnostic: it never touches
 * the router and can be mounted by an SPA overlay, a modal, or a standalone
 * server-rendered error page alike. All host-facing copy (`title`,
 * `description`, action buttons) arrives pre-translated; the component only
 * translates its own labels via `hikari::errors.*`.
 *
 * The standard copy action: hosts pass `copyText` (the full error info they
 * want on the clipboard — headline, technical context, raw payload, …) and
 * the landing seats its built-in "copy error details" button as the FIRST
 * action, left of whatever the actions slot renders — one design for the
 * whole error-landing family instead of every consumer hand-rolling its
 * own copy row (the boundary used to ship a private one; it now feeds this
 * hook). `copyLabel` overrides the button wording when a host already
 * ships its own.
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
    /** Full error info the built-in copy action puts on the clipboard
     *  (headline + technical context + raw payload, host-composed).
     *  Empty disables the action. */
    copyText: { type: String, default: "" },
    /** Optional wording override for the built-in copy button; empty
     *  falls back to `hikari::errors.copyDetails`. */
    copyLabel: { type: String, default: "" },
    tone: { type: String as PropType<HErrorTone>, default: "error" },
    /** Layout variant: `page` (viewport backdrop) or `inline` (in-flow card). */
    variant: { type: String as PropType<HErrorLandingVariant>, default: "page" },
  },
  setup(props, { slots }) {
    const { t } = useI18n();
    const clipboard = useClipboard();

    const titleText = computed(() => props.title || t("hikari::errors.defaultTitle", "Something went wrong"));
    const hasDetails = computed(() => slots.default != null);
    // The actions row carries the built-in copy action whenever the host
    // feeds it a payload — with or without slot actions beside it.
    // Frozen like hasDetails: the slots object identity is not reactive,
    // so a slot appearing mid-lifetime wouldn't flip this row — every
    // family host mounts the landing with its slot set already settled.
    const hasActions = computed(() => slots.actions != null || props.copyText !== "");

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
      // BOTH axes: the raw payload overflows down (long stacks) and across
      // (deep JSON nesting, long unwrapped keys — the tree's preview rows
      // ellipsize by design and never push the row wide) alike, and the
      // pane's CSS hides the native bar on both axes — a vertical-only
      // attach leaves a horizontal overflow with no scrollbar at all.
      detailsScrollbars = attachOverlayScrollbars(detailsBodyRef.value, { axis: "both" });
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

          {hasActions.value && (
            <div class="hk-error-landing__actions" aria-live="polite">
              {[
                // The standard copy action seats FIRST — left of every
                // host-provided action — so the whole family reads
                // [copy] [retry] [dismiss…] no matter who hosts the card.
                ...(props.copyText
                  ? [(
                    <HkButton
                      key="hk-error-copy"
                      size="sm"
                      variant="ghost"
                      onClick={() => { void clipboard.copy(props.copyText); }}
                    >
                      {clipboard.copied.value ? <Check size={12} /> : <Copy size={12} />}
                      {clipboard.copied.value
                        ? t("hikari::errors.copied", "Copied")
                        : props.copyLabel || t("hikari::errors.copyDetails", "Copy error details")}
                    </HkButton>
                  )]
                  : []),
                ...(normalizeSlotNodes(slots.actions?.())),
              ]}
            </div>
          )}
        </div>
      </div>
    );
  },
});
