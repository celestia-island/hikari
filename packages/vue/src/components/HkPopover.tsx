import {
  computed,
  defineComponent,
  nextTick,
  onActivated,
  onDeactivated,
  onUnmounted,
  ref,
  Teleport,
  Transition,
  useAttrs,
  watch,
  type PropType,
} from "vue";

import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { useBreakpoint } from "../runtime/useBreakpoint";
import { useI18n } from "../i18n/context";
import { useSurfaceTransition } from "../composables/useSurfaceTransition";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { onceFrame } from "../runtime/animationBus";
import HIconButton from "./HkIconButton";
import HIcon from "./HkIcon";
import "./window-close.scss";
import "./HkPopover.scss";

export type PopupPlacement =
  | "top" | "top-start" | "top-end"
  | "bottom" | "bottom-start" | "bottom-end"
  | "left" | "left-start" | "left-end"
  | "right" | "right-start" | "right-end";

type BaseSide = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

function parsePlacement(p: PopupPlacement): { side: BaseSide; align: Align } {
  const [side, align] = p.split("-") as [BaseSide, Align | undefined];
  return { side, align: align ?? "center" };
}

const VIEWPORT_PAD = 8;

export default defineComponent({
  name: "HkPopover",
  props: {
    modelValue: { type: Boolean, required: true },
    placement: {
      type: String as PropType<PopupPlacement>,
      default: "bottom",
    },
    offset: { type: Number, default: 4 },
    autoFlip: { type: Boolean, default: true },
    backdrop: { type: Boolean, default: true },
    closeOnBackdrop: { type: Boolean, default: true },
    closeOnEscape: { type: Boolean, default: true },
    glass: { type: Boolean, default: true },
    anchorRef: { type: Object as PropType<HTMLElement | null>, default: null },
    /**
     * Dock the panel as a bottom sheet on mobile-width viewports (<768px,
     * useBreakpoint().isMobile): scrim (click closes) + full-width sheet
     * rising from the bottom edge, instead of the anchored popup. The
     * desktop path is untouched; z-order still rides the popup manager
     * either way. The mode flips live with the viewport — an open popover
     * closes when crossing the breakpoint rather than hanging mid-morph.
     */
    sheetOnMobile: { type: Boolean, default: false },
    /**
     * i18n-resolved surface name. While anchored (desktop) the popover is
     * a non-blocking hidden level, but the name still travels: the
     * modal-stack breadcrumb lists this layer the moment the popover
     * blocks as a mobile bottom sheet, and the sheet renders it as a
     * heading band. Popovers without a title fall back to a generic
     * localized label there (dev builds warn).
     */
    title: { type: String, default: "" },
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const attrs = useAttrs();
    const manager = usePopupManager();
    const { t } = useI18n();
    const handle = ref<PopupHandle | null>(null);
    const panelRef = ref<HTMLElement>();
    const resolvedPlacement = ref<PopupPlacement>(props.placement);
    const coords = ref<{ top?: number; left?: number; bottom?: number; right?: number }>({});

    const { isMobile } = useBreakpoint();
    const sheetMode = computed(() => props.sheetOnMobile && isMobile.value);

    // Crossing the mobile/desktop breakpoint mid-flight would leave a
    // SHEET-mode panel hung between two form factors — close it and let
    // the user reopen in the shape the viewport now calls for. Consumers
    // that never opted into sheetOnMobile keep the historic behavior
    // (stay open, reposition on the resize).
    watch(isMobile, () => {
      if (props.sheetOnMobile && props.modelValue) close();
    });

    // Open/close motion reported into the unified animation context
    // through the same standard hook wiring every surface shares
    // (useSurfaceTransition) — this component was the pattern's
    // origin and now consumes it like the rest.
    const anim = useSurfaceTransition(300).hooks();

    // Suppress native browser tooltips while the popover is open — and
    // not just on the anchor itself: a `title` on ANY descendant fires
    // the same native tooltip on top of the custom popup surface (the
    // model pill of hikari #338 was exactly that bug). Only non-empty
    // titles are blanked: `title=""` fires no native tooltip, so it is
    // left byte-for-byte as the consumer wrote it (and elements with no
    // title at all never gain one). Titles added to the subtree while
    // the popover is already open are NOT suppressed — the popover
    // content is the consumer's own popup surface, titles inside it are
    // legitimate. Only the `title` attribute is touched; aria-label and
    // friends stay as authored.
    let suppressedTitles: { el: Element; title: string }[] = [];

    function suppressNativeTitles(anchor: HTMLElement) {
      suppressedTitles = [];
      // querySelectorAll covers descendants only, so the anchor itself
      // rides along explicitly.
      const titled = [anchor, ...Array.from(anchor.querySelectorAll("[title]"))];
      for (const el of titled) {
        const title = el.getAttribute("title");
        if (title === null || title === "") continue;
        suppressedTitles.push({ el, title });
        el.setAttribute("title", "");
      }
    }

    function restoreNativeTitles() {
      for (const { el, title } of suppressedTitles) {
        el.setAttribute("title", title);
      }
      suppressedTitles = [];
    }

    watch(
      () => props.modelValue,
      (open) => {
        if (open) {
          if (props.anchorRef) suppressNativeTitles(props.anchorRef);
        } else {
          restoreNativeTitles();
        }
      },
      // immediate: a consumer can v-if the popover in already open — the
      // suppression must hold from the very first render, not just from
      // a false→true flip.
      { immediate: true },
    );

    // Anchor swapped while open: hand the retired subtree its titles
    // back before suppressing the new one, or the old anchor leaks a
    // blanked title forever (and a null anchor just releases the old
    // subtree without adopting a new one).
    watch(
      () => props.anchorRef,
      (anchor) => {
        if (!props.modelValue) return;
        restoreNativeTitles();
        if (anchor) suppressNativeTitles(anchor);
      },
    );

    function close() {
      emit("update:modelValue", false);
    }

    let resizeObserver: ResizeObserver | null = null;
    let positionScheduled = false;

    function schedulePosition() {
      if (positionScheduled) return;
      positionScheduled = true;
      onceFrame(() => {
        positionScheduled = false;
        computePosition();
      });
    }

    function computeInitialCoords() {
      const anchor = props.anchorRef;
      if (!anchor) return;
      const anchorRect = anchor.getBoundingClientRect();
      const panel = panelRef.value;
      const panelRect = panel ? panel.getBoundingClientRect() : null;
      const { side, align } = parsePlacement(props.placement);
      const off = props.offset;
      const c: typeof coords.value = {};
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const isVertical = side === "top" || side === "bottom";
      const panelSize = panelRect ? (isVertical ? panelRect.width : panelRect.height) : 0;
      const anchorStart = isVertical ? anchorRect.left : anchorRect.top;
      const anchorEnd = isVertical ? anchorRect.right : anchorRect.bottom;
      const anchorSize = isVertical ? anchorRect.width : anchorRect.height;

      let crossPos: number;
      if (align === "start") {
        crossPos = anchorStart;
      } else if (align === "end") {
        crossPos = anchorEnd - panelSize;
      } else {
        crossPos = anchorStart + (anchorSize - panelSize) / 2;
      }

      if (side === "bottom") {
        c.top = anchorRect.bottom + off;
        c.left = crossPos;
      } else if (side === "top") {
        c.bottom = vh - anchorRect.top + off;
        c.left = crossPos;
      } else if (side === "right") {
        c.left = anchorRect.right + off;
        c.top = crossPos;
      } else {
        c.right = vw - anchorRect.left + off;
        c.top = crossPos;
      }

      coords.value = c;
    }

    function computePosition() {
      const anchor = props.anchorRef;
      const panel = panelRef.value;
      if (!anchor || !panel) return;

      const anchorRect = anchor.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      if (panelRect.width === 0 && panelRect.height === 0) {
        schedulePosition();
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let { side } = parsePlacement(props.placement);
      const { align } = parsePlacement(props.placement);

      if (props.autoFlip) {
        if (side === "bottom") {
          const spaceBelow = vh - anchorRect.bottom;
          const spaceAbove = anchorRect.top;
          if (spaceBelow < panelRect.height + VIEWPORT_PAD && spaceAbove > spaceBelow) {
            side = "top";
          }
        } else if (side === "top") {
          const spaceAbove = anchorRect.top;
          const spaceBelow = vh - anchorRect.bottom;
          if (spaceAbove < panelRect.height + VIEWPORT_PAD && spaceBelow > spaceAbove) {
            side = "bottom";
          }
        } else if (side === "right") {
          const spaceRight = vw - anchorRect.right;
          const spaceLeft = anchorRect.left;
          if (spaceRight < panelRect.width + VIEWPORT_PAD && spaceLeft > spaceRight) {
            side = "left";
          }
        } else if (side === "left") {
          const spaceLeft = anchorRect.left;
          const spaceRight = vw - anchorRect.right;
          if (spaceLeft < panelRect.width + VIEWPORT_PAD && spaceRight > spaceLeft) {
            side = "right";
          }
        }
      }

      resolvedPlacement.value = `${side}${align !== "center" ? `-${align}` : ""}` as PopupPlacement;
      const off = props.offset;
      const c: typeof coords.value = {};

      const isVertical = side === "top" || side === "bottom";
      const panelSize = isVertical ? panelRect.width : panelRect.height;
      const anchorStart = isVertical ? anchorRect.left : anchorRect.top;
      const anchorEnd = isVertical ? anchorRect.right : anchorRect.bottom;
      const anchorSize = isVertical ? anchorRect.width : anchorRect.height;
      const viewportSize = isVertical ? vw : vh;

      let crossPos: number;
      if (align === "start") {
        crossPos = anchorStart;
      } else if (align === "end") {
        crossPos = anchorEnd - panelSize;
      } else {
        crossPos = anchorStart + (anchorSize - panelSize) / 2;
      }
      crossPos = Math.max(VIEWPORT_PAD, Math.min(crossPos, viewportSize - panelSize - VIEWPORT_PAD));

      if (side === "bottom") {
        c.top = anchorRect.bottom + off;
        c.left = crossPos;
      } else if (side === "top") {
        c.bottom = vh - anchorRect.top + off;
        c.left = crossPos;
      } else if (side === "right") {
        c.left = anchorRect.right + off;
        c.top = crossPos;
      } else {
        c.right = vw - anchorRect.left + off;
        c.top = crossPos;
      }

      if (side === "bottom") {
        c.top = Math.max(VIEWPORT_PAD, Math.min(c.top!, vh - panelRect.height - VIEWPORT_PAD));
      } else if (side === "top") {
        c.bottom = Math.max(VIEWPORT_PAD, Math.min(c.bottom ?? 0, vh - panelRect.height - VIEWPORT_PAD));
      } else if (side === "right") {
        c.left = Math.max(VIEWPORT_PAD, Math.min(c.left!, vw - panelRect.width - VIEWPORT_PAD));
      } else {
        c.right = Math.max(VIEWPORT_PAD, Math.min(c.right ?? 0, vw - panelRect.width - VIEWPORT_PAD));
      }

      coords.value = c;
      observePanel();
    }

    function attachObservers() {
      if (resizeObserver) return;
      resizeObserver = new ResizeObserver(() => { schedulePosition(); });
      window.addEventListener("resize", schedulePosition);
      if (props.anchorRef) resizeObserver.observe(props.anchorRef);
    }

    function observePanel() {
      if (resizeObserver && panelRef.value) {
        resizeObserver.observe(panelRef.value);
      }
    }

    function detachObservers() {
      positionScheduled = false;
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      window.removeEventListener("resize", schedulePosition);
    }

    function cleanup() {
      detachObservers();
      if (handle.value) {
        manager.unregister(handle.value.id);
        handle.value = null;
      }
    }

    function fullCleanup() {
      cleanup();
      detachPanelScrollbar();
      coords.value = {};
    }

    function onPopupAfterLeave() {
      fullCleanup();
    }

    // Overlay scrollbar (shared chrome) — only the mobile sheet scrolls
    // its panel; the fixed positioning wrapper rendered around the panel
    // (panelHostRef) hosts the tracks, since the panel's own parent is
    // the teleported body.
    const panelHostRef = ref<HTMLElement>();
    let panelScrollbar: OverlayScrollbarHandle | null = null;

    function detachPanelScrollbar(): void {
      panelScrollbar?.detach();
      panelScrollbar = null;
    }

    watch(
      () => props.anchorRef,
      (anchor) => {
        if (anchor && props.modelValue) {
          if (resizeObserver) resizeObserver.observe(anchor);
          schedulePosition();
        }
      },
    );

    watch(
      () => props.modelValue,
      (open) => {
        if (open) {
          fullCleanup();
          // Blocking follows the sheet decision: anchored (desktop) the
          // popover is a hidden breadcrumb level, docked as a bottom
          // sheet (mobile) it is a window layer and must be listed —
          // hence the i18n `title` riding along.
          handle.value = manager.register(
            "dropdown",
            false,
            props.title || undefined,
            sheetMode.value,
          );
          if (sheetMode.value) {
            // Bottom sheet: nothing to anchor-measure; the scrim handles
            // dismissal (the outside-click shield is desktop-only).
            nextTick(() => {
              panelRef.value?.focus?.();
              // The sheet mounts on this render — attach the overlay
              // once the DOM has landed (sheet panels scroll; desktop
              // popovers size to content and need none).
              if (props.modelValue && sheetMode.value && panelRef.value) {
                detachPanelScrollbar();
                panelScrollbar = attachOverlayScrollbars(panelRef.value, {
                  axis: "vertical",
                  host: panelHostRef.value,
                });
              }
            });
          } else {
            computeInitialCoords();
            attachObservers();
            attachOutsideClickShield();
            nextTick(() => {
              computePosition();
              schedulePosition();
            });
          }
        } else {
          detachObservers();
          detachOutsideClickShield();
        }
      },
      { immediate: true },
    );

    // Viewport crossing the mobile breakpoint mid-open: the sheet↔anchor
    // morph must carry the breadcrumb level with it (blocking flips both
    // ways), and a retitled open sheet re-labels its layer.
    watch(sheetMode, (mode) => {
      if (handle.value) manager.setBlocking(handle.value.id, mode);
    });
    watch(
      () => props.title,
      (newTitle) => {
        if (handle.value && newTitle) {
          manager.setTitle(handle.value.id, newTitle);
        }
      },
    );

    onUnmounted(() => {
      // Unmounting while open (e.g. parent v-if's the popover away) never
      // runs the close branch of the modelValue watch — restore here or
      // the anchor keeps its blanked title forever.
      restoreNativeTitles();
      detachOutsideClickShield();
      fullCleanup();
    });
    onDeactivated(() => {
      if (props.modelValue) {
        detachObservers();
        detachOutsideClickShield();
      }
    });
    onActivated(() => {
      if (props.modelValue) {
        attachObservers();
        attachOutsideClickShield();
        schedulePosition();
      }
    });

    function onDocumentClick(e: MouseEvent) {
      if (!props.closeOnBackdrop || !props.modelValue) return;
      const target = e.target as Node;
      // panelHostRef wraps the panel AND the overlay scrollbar tracks —
      // scrolling through the custom bar must not count as a backdrop click.
      if (panelHostRef.value?.contains(target)) return;
      if (panelRef.value?.contains(target)) return;
      if (props.anchorRef?.contains(target)) return;
      close();
    }

    function attachOutsideClickShield() {
      document.addEventListener("click", onDocumentClick, true);
    }

    function detachOutsideClickShield() {
      document.removeEventListener("click", onDocumentClick, true);
    }

    function onPanelKeydown(e: KeyboardEvent) {
      if (e.key === "Escape" && props.closeOnEscape) {
        e.preventDefault();
        close();
      }
    }

    const backdropZ = computed(() => (handle.value?.zIndex ?? 0));
    const panelZ = computed(() => (handle.value?.zIndex ?? 0) + 1);

    const panelStyle = computed(() => {
      if (sheetMode.value) {
        // Bottom sheet: sits flush on the viewport bottom edge (the
        // host-tunable --hk-sheet-bottom-gap lift is still honored so the
        // sheet belongs to the HkModal/HkSelect sheet family — the family
        // default is 0 since the 2026-09-04 report: even a 0.375rem lift
        // read as a visible seam under the docked sheet); full width,
        // inside the top inset reserved for the secondary-window
        // breadcrumb strip.
        return {
          left: "0",
          right: "0",
          bottom: "var(--hk-sheet-bottom-gap, 0px)",
          top: "auto" as const,
          position: "fixed" as const,
          pointerEvents: "auto" as const,
          zIndex: panelZ.value,
        };
      }
      const c = coords.value;
      return {
        ...(c.top != null ? { top: `${c.top}px` } : {}),
        ...(c.left != null ? { left: `${c.left}px` } : {}),
        ...(c.bottom != null ? { bottom: `${c.bottom}px` } : {}),
        ...(c.right != null ? { right: `${c.right}px` } : {}),
        position: "fixed" as const,
        pointerEvents: "auto" as const,
        zIndex: panelZ.value,
      };
    });

    return () => (
      <Teleport to="body">
        {sheetMode.value && props.modelValue && props.closeOnBackdrop && (
          <div
            class="hk-popover-scrim"
            style={{ zIndex: backdropZ.value }}
            onClick={() => close()}
          />
        )}
        {props.backdrop && !sheetMode.value && props.modelValue && (
          <div
            class="hk-popover-backdrop"
            style={{ zIndex: backdropZ.value }}
          />
        )}
        <Transition
          name={sheetMode.value ? "hk-popover-sheet" : "hk-popover"}
          appear
          onBeforeEnter={anim.onBeforeEnter}
          onAfterEnter={anim.onAfterEnter}
          onBeforeLeave={anim.onBeforeLeave}
          onAfterLeave={() => {
            anim.onAfterLeave();
            onPopupAfterLeave();
          }}
          onEnterCancelled={anim.onEnterCancelled}
          onLeaveCancelled={anim.onLeaveCancelled}
        >
          {props.modelValue ? (
            <div ref={panelHostRef} style={panelStyle.value}>
              <div
                ref={panelRef}
                class={[
                  "hk-popover-panel",
                  ...(sheetMode.value ? ["hk-is-sheet"] : [`hk-popover-${resolvedPlacement.value}`]),
                  props.glass ? "hii-dropdown-content" : "",
                  ...(typeof attrs.class === "string" ? [attrs.class]
                    : Array.isArray(attrs.class) ? attrs.class as string[]
                    : attrs.class && typeof attrs.class === "object"
                      ? Object.entries(attrs.class as Record<string, unknown>)
                          .filter(([, v]) => v).map(([k]) => k)
                      : []),
                ]}
                role="dialog"
                aria-modal={sheetMode.value ? "true" : undefined}
                aria-label={props.title || undefined}
                tabindex={sheetMode.value ? "-1" : undefined}
                onKeydown={onPanelKeydown}
              >
                {sheetMode.value && (
                  <div class="hk-popover-sheet-grabber" aria-hidden="true" onClick={() => close()} />
                )}
                {sheetMode.value && (
                  // Sheet heading row — the title and the close button on
                  // one vertically-centered line (2026-09-04 user report:
                  // the bare title band read too small and hung right of
                  // the content it named, and every other window in the
                  // app carries an explicit ✕). Same header grammar as the
                  // HkModal header: title left, close on the right edge.
                  <div class="hk-popover-sheet-header">
                    {props.title && (
                      <div class="hk-popover-sheet-title">{props.title}</div>
                    )}
                    <HIconButton
                      class="hk-window-close hk-popover-sheet-close"
                      size={32}
                      variant="ghost"
                      aria-label={t("hikari::modal.close", "Close")}
                      onClick={close}
                    >
                      <HIcon name="X" size={16} />
                    </HIconButton>
                  </div>
                )}
                {slots.default?.()}
              </div>
            </div>
          ) : null}
        </Transition>
      </Teleport>
    );
  },
});
