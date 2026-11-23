import {
  computed,
  defineComponent,
  getCurrentInstance,
  ref,
  watch,
  onBeforeUnmount,
  type Component,
  type PropType,
  type SlotsType,
  type VNode,
} from "vue";

import { useI18n } from "../i18n/context";
import { useBreakpoint } from "../runtime/useBreakpoint";
import {
  attachOverlayScrollbars,
  type OverlayScrollbarHandle,
} from "../composables/useOverlayScrollbar";
import HkEmptyState from "./HkEmptyState";
import HkIconButton from "./HkIconButton";
import HkModal from "./HkModal";
import "./HkMasterDetail.scss";

/**
 * Scoped payload of HkMasterDetail's slots. All three are plain renders —
 * the pane hands out no state: selection is the host's (`detailOpen` +
 * whatever row the roster drew), never this component's.
 */
export type HkMasterDetailSlots = SlotsType<{
  /** The roster column's content — typically a flex-none head row (title,
   *  count, tools) over a scrolling list (HkScrollContainer / HkTable).
   *  Required in practice — an empty list slot leaves the column blank. */
  list?: () => VNode[];
  /** The selected item's body. Rendered only while `detailOpen`; closed,
   *  the pane shows the empty state instead. A canvas child (a 3D scene)
   *  fills the region with `flex: 1; min-height: 0` of its own. */
  detail?: () => VNode[];
  /** Trailing header actions inside the detail pane (refresh, copy, a
   *  "open full page" link…) — rendered BEFORE the close affordance. */
  actions?: () => VNode[];
}>;

/**
 * HkMasterDetail — the family's standard two-pane roster+detail console
 * (mail inbox, replay browser, mod roster, audit log: any host list that
 * picks one row and shows it beside the list).
 *
 * Geometry — the WoWSP replay/resources contract (2026-11-23 user
 * direction: the detail is a LAYOUT REGION, not a floating card): one
 * full-height flex row the HOST bounds (`height: 100%` on the root; the
 * host hands it a definite height — a stage-mode shell content box, or a
 * page wrapper with a definite height). The roster column is a fixed
 * flush sidebar (`listWidth`, 1px separator, the surface tint IS the
 * page); the detail region takes the remaining width, scrolls
 * internally, and carries NO card chrome — no radius, no shadow, no
 * gutter. Each column owns its own scroll; the page never scrolls.
 *
 * Narrow viewports (`splitAt`, default 768 — the family phone
 * breakpoint): the roster keeps the whole width and the detail rides
 * HkModal — the family window, which docks as the standard bottom sheet
 * on phones (scrim, grabber, Escape, back-gesture: all the modal's, not
 * re-implemented here). The modal mounts only while a detail is open
 * (nothing to show behind a closed one).
 *
 * The head band (`.hk-master-detail-detail-head`) carries the host's
 * `actions` slot and the close affordance; it renders only when it has
 * at least one of those (plus the overlay-scrollbar rail, which the
 * component attaches to the pane over its own scroll region — native
 * MECHANICS, the library's chrome).
 *
 * Emits `close` when the user dismisses the selection. The close
 * affordance renders only when a listener is bound (`@close` /
 * `onClose`) — a pane whose host cannot deselect has no button to press.
 *
 * ```tsx
 * <HkMasterDetail
 *   detailOpen={selected.value != null}
 *   detailTitle={t("inbox.message", "Message")}
 *   emptyTitle={t("inbox.pickOne", "Pick a message")}
 *   onClose={() => (selected.value = null)}
 * >
 *   {{ list: () => <InboxRoster … />, detail: () => <MessageBody … /> }}
 * </HkMasterDetail>
 * ```
 */
export const HkMasterDetail = defineComponent({
  name: "HkMasterDetail",
  slots: Object as HkMasterDetailSlots,
  props: {
    /** Whether a detail is selected. Closed, the detail pane renders the
     *  empty state (two-pane) or nothing at all (narrow modal form). */
    detailOpen: { type: Boolean, default: false },
    /** Accessible name of the detail region — and, in the narrow form,
     *  the modal's visible title. */
    detailTitle: { type: String, required: true },
    /** Empty-state heading. An empty value falls back to the localized
     *  "Nothing selected" message. */
    emptyTitle: { type: String, default: "" },
    emptyDescription: { type: String, default: undefined },
    /** Empty-state icon (lucide-vue-next style), forwarded to
     *  HkEmptyState. */
    emptyIcon: { type: [Object, Function] as PropType<Component>, default: undefined },
    /** Roster column width (any CSS width). The detail takes the rest. */
    listWidth: { type: String, default: "20rem" },
    /** Viewport width (px) below which the roster takes the whole width
     *  and the detail rides the HkModal sheet. */
    splitAt: { type: Number, default: 768 },
    /** Accessible label of the close affordance (defaults to the
     *  localized "Close"). */
    closeLabel: { type: String, default: undefined },
  },
  emits: {
    close: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    // The shared viewport-width composable (HkAdaptiveDialog / the shells
    // use the same one): a reactive `window.innerWidth`, so the split
    // follows a live resize instead of a CSS media query the component
    // could not read from its props.
    const { width } = useBreakpoint();
    const instance = getCurrentInstance();
    // A server pass has no viewport: `useBreakpoint`'s server fallback is
    // a placeholder, not a measurement, so the composer renders the WIDE
    // layout there (the same desktop assumption its `isDesktop` makes)
    // and the split only ever answers a real width.
    const hasViewport = typeof window !== "undefined";

    const narrow = computed(() => hasViewport && width.value < props.splitAt);
    // `close` is a DECLARED emit, so Vue strips its listener from `$attrs`
    // — the only place the bound listener is still visible is the
    // instance's own vnode props. Read per render (the vnode is replaced
    // on every parent patch), never cached at setup.
    const hasCloseListener = computed(() => Boolean(instance?.vnode.props?.onClose));
    const closeLabel = computed(
      () => props.closeLabel || t("hikari::masterDetail.close", "Close"),
    );
    const emptyTitle = computed(
      () => props.emptyTitle || t("hikari::masterDetail.emptyTitle", "Nothing selected"),
    );

    // ── the pane's overlay scrollbar ───────────────────────────────────
    // The pane is a scroll surface, so it wears the family chrome: native
    // SCROLLING mechanics, the library's overlay rail (nativeScrollbar
    // contract). The rail host is the PANE, never the scroll region — a
    // track inside a scrolling box would travel with the content. The
    // narrow form has no in-flow pane (HkModal's body owns scrolling
    // there), so the rail is attached only while the wide pane exists.
    const paneRef = ref<HTMLElement>();
    const scrollRef = ref<HTMLElement>();
    let rail: OverlayScrollbarHandle | null = null;
    function syncRail(): void {
      rail?.detach();
      rail = null;
      if (!paneRef.value || !scrollRef.value) return;
      rail = attachOverlayScrollbars(scrollRef.value, {
        axis: "vertical",
        host: paneRef.value,
      });
    }
    watch([paneRef, scrollRef], syncRail, { flush: "post" });
    onBeforeUnmount(() => {
      rail?.detach();
      rail = null;
    });

    return () => {
      const isNarrow = narrow.value;
      return (
        <div
          class="hk-master-detail"
          data-split={isNarrow ? "single" : "two"}
          data-open={props.detailOpen || undefined}
          style={{ "--hk-master-detail-list-w": props.listWidth }}
        >
          <div class="hk-master-detail-list">{slots.list?.()}</div>
          {isNarrow ? (
            // Narrow form: the detail rides the family window. HkModal
            // docks as the standard bottom sheet on phones and owns every
            // dismissal path (close button, scrim, Escape, back gesture)
            // — declining the close (closable=false) is not offered here
            // because a host that cannot deselect never sees this form
            // with detailOpen=true in the first place.
            props.detailOpen ? (
              <HkModal
                modelValue={true}
                title={props.detailTitle}
                width="lg"
                contentClass="hk-master-detail-sheet"
                onUpdate:modelValue={(open: boolean) => {
                  if (!open) emit("close");
                }}
              >
                {{
                  default: () => (
                    <div class="hk-master-detail-sheet-body">
                      {slots.actions ? (
                        <div class="hk-master-detail-detail-actions">
                          {slots.actions()}
                        </div>
                      ) : null}
                      {slots.detail?.()}
                    </div>
                  ),
                }}
              </HkModal>
            ) : null
          ) : (
            // Two-pane: the detail region always exists (empty state when
            // closed) — a blank right half would read as a broken layout.
            <section
              ref={paneRef}
              class="hk-master-detail-detail"
              role="region"
              aria-label={props.detailTitle}
            >
              {/* The pane's own scroll region. It is a CHILD of the pane
                  (the HkCard-scrollable / HkTable shape) so the shared
                  overlay rail can attach to the non-scrolling pane and
                  the native bar never paints — the library's scroll
                  contract (nativeScrollbar.contract.test.ts). */}
              <div ref={scrollRef} class="hk-master-detail-detail-scroll">
                {slots.actions || hasCloseListener.value ? (
                  <div class="hk-master-detail-detail-head">
                    {slots.actions ? (
                      <div class="hk-master-detail-detail-actions">{slots.actions()}</div>
                    ) : null}
                    {hasCloseListener.value ? (
                      <HkIconButton
                        class="hk-master-detail-close"
                        size={28}
                        variant="ghost"
                        icon="close"
                        aria-label={closeLabel.value}
                        onClick={() => emit("close")}
                      />
                    ) : null}
                  </div>
                ) : null}
                <div class="hk-master-detail-detail-body">
                  {props.detailOpen ? (
                    slots.detail?.()
                  ) : (
                    <HkEmptyState
                      boxed
                      title={emptyTitle.value}
                      description={props.emptyDescription}
                      icon={props.emptyIcon}
                    />
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      );
    };
  },
});
