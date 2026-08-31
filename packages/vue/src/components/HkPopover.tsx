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
import { useReportedTransition } from "../composables/useReportedTransition";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import { onceFrame } from "../runtime/animationBus";
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
  },
  emits: {
    "update:modelValue": (_v: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const attrs = useAttrs();
    const manager = usePopupManager();
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

    const animBus = useReportedTransition(300);

    // Suppress native browser tooltip on the anchor while the popover is open.
    let savedTitle: string | null = null;
    watch(
      () => props.modelValue,
      (open) => {
        const el = props.anchorRef;
        if (!el) return;
        if (open) {
          savedTitle = el.getAttribute("title");
          if (savedTitle !== null && savedTitle !== "") {
            el.setAttribute("title", "");
          } else {
            savedTitle = null;
          }
        } else {
          if (savedTitle !== null) {
            el.setAttribute("title", savedTitle);
          } else if (savedTitle === null && el.getAttribute("title") === "") {
            el.removeAttribute("title");
          }
          savedTitle = null;
        }
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
          handle.value = manager.register("dropdown", false);
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

    onUnmounted(() => {
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
        // Bottom sheet: pinned above the bottom edge with the SAME
        // host-tunable gap as the HkModal mobile docking
        // (--hk-sheet-bottom-gap) so every bottom-up window belongs to
        // one sheet family; full width, inside the top inset reserved
        // for the secondary-window breadcrumb strip.
        return {
          left: "0",
          right: "0",
          bottom: "var(--hk-sheet-bottom-gap, 0.375rem)",
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
          onBeforeEnter={() => animBus.run()}
          onAfterEnter={() => animBus.cancel()}
          onBeforeLeave={() => animBus.run()}
          onAfterLeave={() => { animBus.cancel(); onPopupAfterLeave(); }}
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
                tabindex={sheetMode.value ? "-1" : undefined}
                onKeydown={onPanelKeydown}
              >
                {sheetMode.value && (
                  <div class="hk-popover-sheet-grabber" aria-hidden="true" onClick={() => close()} />
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
