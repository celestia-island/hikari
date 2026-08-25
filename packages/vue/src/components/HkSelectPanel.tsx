import {
  computed,
  defineComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  Teleport,
  Transition,
  watch,
  type PropType,
} from "vue";

import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { useOverlay } from "../runtime/useOverlay";
import { useBreakpoint } from "../runtime/useBreakpoint";
import "./HkSelect.scss";

/**
 * The dropdown panel of HkSelect, detached from the select's trigger so it
 * can be invoked in custom form.
 *
 * A dropdown's opened surface — the desktop popout geometry, the mobile
 * bottom sheet (scrim + grabber + title), popup-manager z-stacking, the
 * overlay registry entry, outside-click and Escape closing — is useful far
 * beyond `<HkSelect>`: filter popovers anchored to icon buttons, checkbox
 * list popovers, anything that should LOOK like a dropdown panel without
 * BEING a dropdown. This component is that surface: give it an anchor
 * element and arbitrary row content, and it behaves exactly like the panel
 * a select would open.
 *
 * HkSelect itself delegates here (bottom-start + matched trigger width), so
 * the two can never drift apart. Content is a plain default slot; keyboard
 * events on the panel surface are forwarded (`keydown`) so owners that own
 * an option model (like HkSelect) can run their own arrow/enter navigation.
 */

export type SelectPanelPlacement =
  | "bottom-start"
  | "bottom-end"
  | "top-start"
  | "top-end";

const VIEWPORT_PAD = 8;

export default defineComponent({
  name: "HkSelectPanel",
  props: {
    /** Panel visibility — v-model:open. */
    open: { type: Boolean, required: true },
    /** Anchor element for the desktop popout (usually the custom trigger). */
    anchorRef: { type: Object as PropType<HTMLElement | null>, default: null },
    /** Sheet header on mobile / a11y name for the panel. */
    title: { type: String, default: "" },
    /** Base placement of the popout relative to the anchor (auto-flips). */
    placement: {
      type: String as PropType<SelectPanelPlacement>,
      default: "bottom-start",
    },
    /** Gap between anchor and popout, in px. */
    offset: { type: Number, default: 4 },
    /** Popout min-width follows the anchor width (select parity). */
    matchAnchorWidth: { type: Boolean, default: true },
    /** Dock as a bottom sheet on phone-width viewports. */
    sheetOnMobile: { type: Boolean, default: true },
  },
  emits: {
    "update:open": (_v: boolean) => true,
    /** Raw keydown from the panel surface (arrows/enter for option owners). */
    keydown: (_e: KeyboardEvent) => true,
  },
  setup(props, { emit, slots, expose }) {
    const manager = usePopupManager();
    const handle = ref<PopupHandle | null>(null);
    const popoutZ = computed(() => (handle.value?.zIndex ?? 0) + 1);

    // Overlay registry entry so closeAll()/isOverlayOpen() see the open
    // panel; the onCloseRequested hook makes a global close flip the open
    // prop, which is what actually tears the panel down.
    const overlay = useOverlay({
      name: "hk-select-panel",
      onCloseRequested: () => { emit("update:open", false); },
    });

    const { isMobile } = useBreakpoint();
    const sheetMode = computed(() => props.sheetOnMobile && isMobile.value);

    // Crossing the mobile/desktop breakpoint mid-flight would leave a sheet
    // hung between two form factors — close and let the user reopen in the
    // shape the viewport now calls for (HkSelect's historic behavior).
    watch(isMobile, () => {
      if (props.open) emit("update:open", false);
    });

    const panelRef = ref<HTMLElement>();
    const coords = ref<{ top?: string; left?: string; minWidth?: string }>({});

    function close(): void {
      emit("update:open", false);
    }

    function onDocumentClick(e: MouseEvent): void {
      if (!props.open || sheetMode.value) return;
      const target = e.target as Node;
      if (props.anchorRef?.contains(target)) return;
      if (panelRef.value?.contains(target)) return;
      close();
    }

    // Escape is handled surface-attached (the panel's own onKeydown and,
    // via forwarding, the owner) — NOT via a document-capture listener,
    // which would close the panel on Escape pressed in unrelated inputs
    // and run ahead of every other Escape handler on the page. This
    // matches the library convention (HkPopover / HkModal surfaces).
    function onSurfaceEscape(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }

    function forwardKeydown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        onSurfaceEscape(e);
        return;
      }
      emit("keydown", e);
    }

    watch(
      () => props.open,
      (open) => {
        if (open) {
          handle.value = manager.register("dropdown", false);
          overlay.open();
          if (!sheetMode.value) {
            document.addEventListener("click", onDocumentClick, true);
          }
          window.addEventListener("resize", onResize);
        } else {
          document.removeEventListener("click", onDocumentClick, true);
          window.removeEventListener("resize", onResize);
          if (handle.value) {
            manager.unregister(handle.value.id);
            handle.value = null;
          }
          overlay.close();
        }
      },
      // immediate: mounting with open=true must register with the popup
      // manager (z band) and overlay registry right away — the HkPopover /
      // HkModal convention.
      { immediate: true },
    );

    onBeforeUnmount(() => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("resize", onResize);
      overlay.close();
      if (handle.value) {
        manager.unregister(handle.value.id);
        handle.value = null;
      }
    });

    // ── desktop popout geometry ────────────────────────────────────
    // Computed twice per opening: immediately from the anchor rect (with a
    // height fallback so top placements land sensibly before measure) and
    // again after the DOM settles, when the panel's real box is known and
    // flip/clamp decisions can use actual numbers.
    function positionPanel(): void {
      const anchor = props.anchorRef;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      // 0 (unstyled/test environments) counts as unmeasured — fall back.
      const pw = panelRef.value?.offsetWidth || Math.max(r.width, 180);
      const ph = panelRef.value?.offsetHeight || 200;
      let side: "top" | "bottom" = props.placement.startsWith("top-") ? "top" : "bottom";
      let top =
        side === "top"
          ? r.top - props.offset - ph
          : r.bottom + props.offset;
      // Auto-flip when the chosen side cannot host the panel.
      if (side === "bottom" && top + ph > window.innerHeight - VIEWPORT_PAD) {
        side = "top";
        top = r.top - props.offset - ph;
      } else if (side === "top" && top < VIEWPORT_PAD) {
        side = "bottom";
        top = r.bottom + props.offset;
      }
      let left = props.placement.endsWith("-end") ? r.right - pw : r.left;
      const maxLeft = Math.max(VIEWPORT_PAD, window.innerWidth - VIEWPORT_PAD - pw);
      left = Math.min(Math.max(left, VIEWPORT_PAD), maxLeft);
      coords.value = {
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        ...(props.matchAnchorWidth ? { minWidth: `${Math.round(r.width)}px` } : {}),
      };
    }

    function onResize(): void {
      if (props.open && !sheetMode.value) positionPanel();
    }

    watch(
      () => [props.open, props.anchorRef, props.placement] as const,
      () => {
        if (!props.open) return;
        positionPanel();
        void nextTick(positionPanel);
      },
      { immediate: true },
    );

    /** The live panel root element — sheet or popout, or null while closed.
     * Lets option-owning consumers (HkSelect) scope row queries to THEIR
     * panel instead of the whole document, where another open panel's
     * rows (or HkPopupSelect's) could match first. */
    expose({
      panelEl: () => panelRef.value ?? null,
    });

    return () => {
      // Sheet mode keeps its Teleport mounted across the close so the
      // leave transition (slide-down) actually runs — unmounting the
      // subtree on close would snap the sheet shut instead (the same
      // reason HkPopover keeps its Teleport alive through the leave).
      if (sheetMode.value) {
        return (
          <Teleport to="body">
            <Transition name="hk-select-sheet" appear>
              {props.open ? (
                <div
                  class="hk-select-sheet-scrim"
                  style={{ zIndex: popoutZ.value - 1 }}
                  onClick={close}
                />
              ) : null}
            </Transition>
            <Transition name="hk-select-sheet" appear>
              {props.open ? (
                <div
                  ref={panelRef}
                  class="hk-select-sheet-panel"
                  style={{ zIndex: popoutZ.value }}
                  role="dialog"
                  aria-modal="true"
                  aria-label={props.title || undefined}
                  tabindex="-1"
                  onKeydown={forwardKeydown}
                >
                  <div
                    class="hk-select-sheet-grabber"
                    aria-hidden="true"
                    onClick={close}
                  />
                  {props.title ? (
                    <div class="hk-select-sheet-title">{props.title}</div>
                  ) : null}
                  <div class="hk-select-sheet-list">{slots.default?.()}</div>
                </div>
              ) : null}
            </Transition>
          </Teleport>
        );
      }

      // Desktop popout: no enter/leave transition on master either —
      // mount on open, unmount on close.
      if (!props.open) return null;
      return (
        <Teleport to="body">
          <div
            ref={panelRef}
            class="hk-select-popout"
            style={{ ...coords.value, zIndex: popoutZ.value }}
            aria-label={props.title || undefined}
            onKeydown={forwardKeydown}
          >
            {slots.default?.()}
          </div>
        </Teleport>
      );
    };
  },
});
