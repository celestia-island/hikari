import {
  computed,
  defineComponent,
  getCurrentInstance,
  onBeforeUnmount,
  ref,
  watch,
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
import "./HkMasterDetail.scss";

/**
 * Scoped payload of HkMasterDetail's slots. All three are plain renders —
 * the pane hands out no state: selection is the host's (`detailOpen` +
 * whatever row the roster drew), never this component's.
 */
export type HkMasterDetailSlots = SlotsType<{
  /** The roster: typically an `HkAdminTablePage` / `HkTable`, a card list
   *  or any scrolling list. Required in practice — an empty list slot
   *  leaves the left column blank. */
  list?: () => VNode[];
  /** The selected item's body. Rendered only while `detailOpen`; closed,
   *  the pane shows the empty state instead. */
  detail?: () => VNode[];
  /** Trailing header actions inside the detail pane (refresh, copy, a
   *  "open full page" link…) — rendered BEFORE the close affordance. */
  actions?: () => VNode[];
}>;

/**
 * HkMasterDetail — the family's standard two-pane roster+detail surface
 * (mail inbox, ticket queue, audit log: any host list that picks one row
 * and shows it beside the list).
 *
 * Layout: one CSS grid, `[list][detail]` with the family's `--space-12`
 * gutter; the detail pane is a CARD (HkCard's chrome: the surface blend,
 * `border-subtle`, `--radius-lg`, `--shadow-elevated`) that STICKS while
 * the roster scrolls — `sticky: false` for hosts that embed the pane in a
 * container that is already shorter than the viewport. The column tracks
 * come from `listWidth` / `detailWidth` (host-tunable through
 * `--hk-master-detail-list-w` / `-detail-w`, which the props write).
 *
 * Narrow viewports (`splitAt`, default 1100px, driven by the shared
 * `useBreakpoint` width): ONE column — the roster keeps the full width and
 * the detail pane becomes an OVERLAY DRAWER from the right over a scrim.
 * The drawer mounts only while a detail is open (nothing to show behind a
 * closed one) and closes through the same `close` emit the header
 * affordance uses: Escape anywhere on the drawer face, a tap on the scrim,
 * or the labelled close button. Escape's precedence follows HkDrawer /
 * HkModal — a nested control that already consumed the key owns it.
 *
 * The head band (`.hk-master-detail-detail-head`) carries the drawer-form
 * title, the `actions` slot and the close affordance; it renders only when
 * it has at least one of those. A wide, closed, action-less pane therefore
 * shows just the empty state — a band holding nothing would be blank
 * chrome above a placeholder.
 *
 * NOT a focus-trapping window: the drawer is a page region laid OVER the
 * roster (fixed position, dialog-sized), not a teleported overlay. It
 * paints in the page-chrome band (`--hk-z-sidebar`), so a host popup or
 * window teleported to `#hk-overlay-root` (--hk-z-float and up) covers it
 * by design. Hosts that need capture semantics (focus trap, body scroll
 * lock, back-gesture handling) mount HkDrawer themselves; this component
 * deliberately does not re-implement that surface family.
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
 *   {{ list: () => <InboxTable … />, detail: () => <MessageBody … /> }}
 * </HkMasterDetail>
 * ```
 */
export const HkMasterDetail = defineComponent({
  name: "HkMasterDetail",
  slots: Object as HkMasterDetailSlots,
  props: {
    /** Whether a detail is selected. Closed, the detail pane renders the
     *  empty state (two-pane) or nothing at all (drawer form). */
    detailOpen: { type: Boolean, default: false },
    /** Accessible name of the detail region — and, in the drawer form,
     *  the visible header title. */
    detailTitle: { type: String, required: true },
    /** Empty-state heading. An empty value falls back to the localized
     *  "Nothing selected" message. */
    emptyTitle: { type: String, default: "" },
    emptyDescription: { type: String, default: undefined },
    /** Empty-state icon (lucide-vue-next style), forwarded to
     *  HkEmptyState. */
    emptyIcon: { type: [Object, Function] as PropType<Component>, default: undefined },
    /** Roster column track. */
    listWidth: { type: String, default: "minmax(360px, 1fr)" },
    /** Detail column track. */
    detailWidth: { type: String, default: "minmax(0, 1.15fr)" },
    /** Stick the detail pane while the roster scrolls. Hosts embedding
     *  the pane in an already-bounded container pass false — a sticky
     *  child inside a short box just scrolls with it. */
    sticky: { type: Boolean, default: true },
    /** Viewport width (px) below which the two panes collapse into one
     *  column with the detail in the overlay drawer. */
    splitAt: { type: Number, default: 1100 },
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
    // A server pass has no viewport: `useBreakpoint`'s server fallback is a
    // placeholder, not a measurement, so the composer renders the WIDE
    // layout there (the same desktop assumption its `isDesktop` makes) and
    // the split only ever answers a real width.
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

    /**
     * Escape closes the drawer face only: in the two-pane layout every
     * selection is one click away, so swallowing the key there would be a
     * surprise. `defaultPrevented` keeps a nested control that already
     * consumed Escape (a popup, an inline editor) the owner of the key.
     */
    function onEscape(e: KeyboardEvent): void {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      emit("close");
    }

    let listening = false;
    function listenForEscape(on: boolean): void {
      // SSR / non-DOM hosts: the drawer form only exists in a window.
      if (typeof document === "undefined") return;
      if (on && !listening) {
        document.addEventListener("keydown", onEscape);
        listening = true;
      } else if (!on && listening) {
        document.removeEventListener("keydown", onEscape);
        listening = false;
      }
    }

    // The listener tracks the drawer's actual visibility — not the prop
    // alone: a closed detail on a narrow viewport has nothing to dismiss.
    watch(() => narrow.value && props.detailOpen, listenForEscape, { immediate: true });
    onBeforeUnmount(() => listenForEscape(false));

    // ── the pane's overlay scrollbar ───────────────────────────────────
    // The pane is a scroll surface, so it wears the family chrome: native
    // SCROLLING mechanics, the library's overlay rail (nativeScrollbar
    // contract). The rail host is the PANE, never the scroll region — a
    // track inside a scrolling box would travel with the content. Re-synced
    // through the refs because the wide pane and the drawer form are
    // different element lifetimes (a mode flip unmounts one, mounts the
    // other).
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

    const onScrimClick = () => emit("close");

    return () => {
      const isNarrow = narrow.value;
      // Two-pane: the pane always exists (empty state when closed). Drawer:
      // it exists only while open — an overlay holding an empty state over
      // the roster would be a dead layer.
      const detailVisible = props.detailOpen || !isNarrow;
      const headVisible = isNarrow || Boolean(slots.actions) || hasCloseListener.value;
      return (
        <div
          class="hk-master-detail"
          data-split={isNarrow ? "single" : "two"}
          data-open={props.detailOpen || undefined}
          style={{
            "--hk-master-detail-list-w": props.listWidth,
            "--hk-master-detail-detail-w": props.detailWidth,
          }}
        >
          <div class="hk-master-detail-list">{slots.list?.()}</div>
          {isNarrow && props.detailOpen ? (
            // Purely visual + input-blocking: it keeps the roster from
            // being tapped behind the drawer. Tapping it dismisses, the
            // family's overlay convention (HkModal / HkDrawer).
            <div class="hk-master-detail-scrim" aria-hidden="true" onClick={onScrimClick} />
          ) : null}
          {detailVisible ? (
            <section
              ref={paneRef}
              class={[
                "hk-master-detail-detail",
                isNarrow ? "hk-master-detail-drawer" : "",
              ]}
              // The HOST's declaration, not the mode: the two-pane layout
              // is where stickiness applies (scss gates on data-split).
              data-sticky={props.sticky || undefined}
              role="region"
              aria-label={props.detailTitle}
            >
              {/* The pane's own scroll region. It is a CHILD of the card
                  (the HkCard-scrollable / HkTable shape) so the shared
                  overlay rail can attach to the non-scrolling pane and
                  the native bar never paints — the library's scroll
                  contract (nativeScrollbar.contract.test.ts). */}
              <div ref={scrollRef} class="hk-master-detail-detail-scroll">
                {headVisible ? (
                  <div class="hk-master-detail-detail-head">
                    {isNarrow ? (
                      <h2 class="hk-master-detail-detail-title">{props.detailTitle}</h2>
                    ) : null}
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
          ) : null}
        </div>
      );
    };
  },
});