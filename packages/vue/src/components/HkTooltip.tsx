import { computed, defineComponent, nextTick, onBeforeUnmount, ref, Teleport, type CSSProperties, type PropType, type SlotsType } from "vue";
import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { applyTooltipPosition, type TooltipPlacement } from "../runtime/tooltipPosition";
import { armTouchHint } from "../runtime/touchHint";
import "./HkTooltip.scss";
import { ensureOverlayRoot } from "../overlay/overlayRoot";

/**
 * The default-slot payload, handed to every render of the trigger. An
 * interactive trigger should bind `popupId` onto itself via
 * aria-describedby while `visible` is true — the focus target is the
 * trigger element, not this component's wrapper (HkCopyBadge is the
 * reference consumer).
 */
export interface HkTooltipSlotProps {
  popupId: string;
  visible: boolean;
}

/**
 * The `content` slot payload — the click-trigger confirm body.
 *
 * `close()` hides the popup and hands focus back to the trigger; wire it to
 * both actions (cancel and confirm) so one decision ends the popup. The
 * caller keeps ownership of what "confirm" DOES — this component only owns
 * the confirm surface, never the side effect.
 */
export interface HkTooltipConfirmSlotProps {
  close: () => void;
}

/** Hover hints follow the pointer; click popups own an explicit decision. */
export type TooltipTrigger = "hover" | "click";

let popupSeq = 0;

export default defineComponent({
  name: "HkTooltip",
  props: {
    /** The hint/caption text. In click mode it is the confirm popup's title;
     *  omit it when a `content` slot carries its own heading. */
    text: { type: String, default: "" },
    placement: { type: String as PropType<TooltipPlacement>, default: "top" },
    delay: { type: Number, default: 300 },
    maxWidth: { type: String, default: undefined },
    /**
     * `"hover"` (default) is the classic annotation: shows on hover/focus
     * after `delay`, hides on leave, never takes pointer events.
     *
     * `"click"` turns the same anchored bubble into an explicit-decision
     * surface: the trigger's click toggles it, no hover/focus path opens or
     * closes it, the popup takes pointer events (so it can hold buttons),
     * outside pointerdown and Escape dismiss it, and focus moves into it on
     * open and back to the trigger on an Escape/`close()` dismissal. This is
     * the "are you sure?" shape a confirm-on-submit flow needs; `delay` is
     * ignored in this mode.
     */
    trigger: { type: String as PropType<TooltipTrigger>, default: "hover" },
  },
  slots: Object as SlotsType<{
    default?: (props: HkTooltipSlotProps) => unknown;
    /** Click mode: the popup body below `text` (actions included). */
    content?: (props: HkTooltipConfirmSlotProps) => unknown;
  }>,
  setup(props, { slots }) {
    const visible = ref(false);
    const clickMode = computed(() => props.trigger === "click");
    // Stable id for the aria-describedby link from the trigger wrapper to
    // the popup (set while the popup is visible, mirroring the tooltip
    // bridge's contract).
    const popupId = `hk-tooltip-${++popupSeq}`;
    const titleId = `${popupId}-title`;
    const wrapperRef = ref<HTMLElement | null>(null);
    const popupRef = ref<HTMLElement | null>(null);
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let positionFrame: number | null = null;
    // Click mode owns its own dismissal wiring: listeners exist only while
    // the popup is open, and the trigger focus is remembered so a dismissal
    // decision can hand focus back.
    let dismissPointer: ((event: PointerEvent) => void) | null = null;
    let dismissEscape: ((event: KeyboardEvent) => void) | null = null;
    let restoreFocusEl: HTMLElement | null = null;

    // The band handle and the popup DOM are both LAZY (dense-list contract,
    // 2026-10-05): a tooltip that is never engaged — the overwhelming
    // majority in a list of tags — costs no teleported node, no band
    // registration and no pointer wiring beyond the wrapper's own handlers.
    // The first engage registers the popup-manager handle (kind "tooltip",
    // above modal/drawer overlays, below toasts) and mounts the popup;
    // both are held until unmount so re-shows never churn.
    const manager = usePopupManager();
    let popupHandle: PopupHandle | null = null;
    const zIndex = ref<number | null>(null);
    const everShown = ref(false);

    function ensureEngaged() {
      if (!everShown.value) {
        everShown.value = true;
        if (!popupHandle) {
          popupHandle = manager.register("tooltip", false);
        }
        zIndex.value = popupHandle.zIndex;
      }
    }

    function updatePosition() {
      if (!wrapperRef.value || !popupRef.value) return;
      const rect = wrapperRef.value.getBoundingClientRect();
      // Placement geometry lives in the shared runtime helper (it also
      // serves the document-level tooltip bridge) — including the
      // ancestor-zoom division that keeps teleported popups pinned to
      // their trigger inside scaled roots, and the measure-and-clamp pass
      // that keeps the measured bubble inside the viewport gutter (flip,
      // cap, shift) instead of spilling off-screen or shrinking to the
      // containing block's leftover space.
      applyTooltipPosition(popupRef.value, rect, props.placement, props.maxWidth);
    }

    function stopPositionTracking() {
      if (positionFrame !== null) cancelAnimationFrame(positionFrame);
      positionFrame = null;
    }

    function trackPositionWhileVisible() {
      if (positionFrame !== null) return;
      const tick = () => {
        positionFrame = null;
        if (!visible.value) return;
        // A visible trigger can move without a pointer event (treemap wheel
        // zoom, minimap pan, layout animation). Re-read its rect per frame
        // until hide/unmount; each visible tooltip owns one such loop.
        updatePosition();
        positionFrame = requestAnimationFrame(tick);
      };
      positionFrame = requestAnimationFrame(tick);
    }

    function show() {
      // Hover/focus entry only: the click-trigger wrapper passes NO
      // hover/focus handlers at all (see the render below), so a confirm
      // surface can never pop open from a pointer passing over it.
      clearShowTimer();
      ensureEngaged();
      showTimer = setTimeout(() => {
        visible.value = true;
        trackPositionWhileVisible();
      }, props.delay);
    }

    function detachDismissal() {
      if (dismissPointer) {
        document.removeEventListener("pointerdown", dismissPointer, true);
        dismissPointer = null;
      }
      if (dismissEscape) {
        document.removeEventListener("keydown", dismissEscape, true);
        dismissEscape = null;
      }
    }

    /**
     * Click mode dismissal wiring, live only while the popup is open:
     * - a pointerdown OUTSIDE both the trigger and the popup dismisses (an
     *   outside click already moves focus elsewhere, so no focus hand-back);
     * - Escape dismisses and hands focus back to the trigger, consuming the
     *   key only when it actually closed the popup — the same one-press-one-
     *   thing rule HkSelect uses for triggers hosted inside a dialog.
     */
    function attachDismissal() {
      if (dismissPointer || dismissEscape) return;
      dismissPointer = (event: PointerEvent) => {
        const target = event.target as Node | null;
        if (target == null) return;
        // The actions and the trigger keep the popup open; the trigger's
        // own click handler toggles it.
        if (popupRef.value?.contains(target) || wrapperRef.value?.contains(target)) return;
        hide();
      };
      dismissEscape = (event: KeyboardEvent) => {
        if (event.key !== "Escape" || !visible.value) return;
        event.preventDefault();
        event.stopPropagation();
        hide({ restoreFocus: true });
      };
      document.addEventListener("pointerdown", dismissPointer, true);
      document.addEventListener("keydown", dismissEscape, true);
    }

    function hide(opts: { restoreFocus?: boolean } = {}) {
      clearShowTimer();
      const wasVisible = visible.value;
      visible.value = false;
      stopPositionTracking();
      // A hide means the hover/focus gesture is over — a touch hint
      // armed in parallel (pen press while hovering) retires with it.
      cancelTouchHint();
      detachDismissal();
      const restore = opts.restoreFocus === true ? restoreFocusEl : null;
      restoreFocusEl = null;
      if (restore && wasVisible) {
        // Hand focus back only when it still lives on the popup/trigger:
        // a dismissal that already moved focus (outside click, caller
        // navigation) must not yank it back.
        const active = document.activeElement;
        const stillOurs = active == null || active === document.body || active === restore
          || popupRef.value?.contains(active) === true
          || wrapperRef.value?.contains(active) === true;
        if (stillOurs) nextTick(() => restore.focus());
      }
    }

    /** Click mode: the trigger toggles the popup (open immediately). */
    function onTriggerClick() {
      if (visible.value) {
        hide();
        return;
      }
      clearShowTimer();
      ensureEngaged();
      visible.value = true;
      trackPositionWhileVisible();
      // A keyboard activation must land on the actions rather than staying
      // on the trigger; remember the origin for the focus hand-back.
      const active = document.activeElement;
      restoreFocusEl = active instanceof HTMLElement ? active : null;
      attachDismissal();
      nextTick(() => popupRef.value?.focus());
    }

    /** The confirm slot's `close`: dismiss and hand focus back. */
    function closeFromPopup() {
      hide({ restoreFocus: true });
    }

    function clearShowTimer() {
      if (showTimer !== null) {
        clearTimeout(showTimer);
        showTimer = null;
      }
    }

    // ── touch long-press ────────────────────────────────────────────
    // Touch has no hover, and the "what is this?" gesture on a phone is
    // the LONG-PRESS — owned by the touch hint bar docked at the top of
    // the viewport (runtime/touchHint.ts), never by this anchored popup
    // (the finger would occlude the very element being inspected). A
    // quick tap shows nothing at all: neither the popup nor the bar.
    // Pen joins touch for the press (a stylus hold is the same
    // deliberate ask) while KEEPING hover — stylus users float this
    // popup, and a pen long-press may surface the bar beside it.
    // Tap-derived synthetic mouseenter/mouseleave events are ignored for
    // a short window after a touch so they cannot flash the anchored
    // popup the touch mode never shows.
    // -Infinity sentinel: a plain 0 would suppress hover during the
    // first 600ms of page life (performance.now() starts near 0) and
    // under test fake timers (frozen at 0).
    let lastTouchAt = -Infinity;
    let touchHintCancel: (() => void) | null = null;

    function cancelTouchHint() {
      if (touchHintCancel) {
        touchHintCancel();
        touchHintCancel = null;
      }
    }

    function onPointerdown(e: PointerEvent) {
      // Click mode owns touch too: a tap opens the confirm popup, so the
      // long-press hint bar would be a second, conflicting surface.
      if (clickMode.value) return;
      if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
      if (!props.text.trim()) return; // nothing to hint
      lastTouchAt = performance.now();
      // One hold at a time: a fresh press re-arms from scratch.
      cancelTouchHint();
      const node = wrapperRef.value;
      if (!node) return;
      touchHintCancel = armTouchHint(node, props.text, {
        pointerId: e.pointerId,
        // The exact contact point keeps the recognizer's slop math
        // honest (the arm hook cannot see this event itself).
        origin: { x: e.clientX, y: e.clientY },
      });
    }

    onBeforeUnmount(() => {
      clearShowTimer();
      stopPositionTracking();
      cancelTouchHint();
      detachDismissal();
      if (popupHandle) {
        manager.unregister(popupHandle.id);
        popupHandle = null;
      }
    });

    const tooltipCls = computed(() => [
      "hk-tooltip-popup",
      `hk-tooltip-${props.placement}`,
      clickMode.value ? "hk-tooltip-popup--click" : "",
      visible.value ? "hk-tooltip-visible" : "",
    ]);

    // Only the popup-manager z rides the vnode; the geometry is written
    // straight onto the element by applyTooltipPosition (same as the
    // tooltip bridge) so a re-render can never clobber a clamp shift.
    const popupStyle = computed<CSSProperties>(() =>
      zIndex.value != null ? { zIndex: zIndex.value } : {},
    );

    /**
     * Popup children as an array: absent halves must not leave a comment
     * placeholder behind, so the hover tooltip's DOM stays exactly the
     * pre-click-mode shape (the `content` slot is click mode only).
     */
    function popupChildren(): unknown[] {
      const kids: unknown[] = [];
      // A text-only tooltip keeps its content block even when `text` is
      // empty (the legacy bubble); with a `content` slot and no text the
      // slot owns the body and an empty padded block would be dead space.
      if (props.text !== "" || !slots.content) {
        kids.push(
          <div class="hk-tooltip-content" id={clickMode.value ? titleId : undefined}>
            {props.text}
          </div>,
        );
      }
      if (slots.content) kids.push(slots.content({ close: closeFromPopup }));
      return kids;
    }

    return () => (
      <span
        ref={wrapperRef}
        class="hk-tooltip-wrapper"
        data-position={props.placement}
        // Hover hints describe their trigger; a click confirm announces the
        // dialog it will open instead.
        aria-describedby={!clickMode.value && visible.value ? popupId : undefined}
        aria-haspopup={clickMode.value ? "dialog" : undefined}
        aria-expanded={clickMode.value ? visible.value : undefined}
        onClick={clickMode.value ? onTriggerClick : undefined}
        onPointerdown={onPointerdown}
        onMouseenter={
          clickMode.value
            ? undefined
            : () => {
              // Synthetic mouseenter right after a touch press must not
              // flash the anchored popup the touch mode never shows — the
              // top hint bar owns touch.
              if (performance.now() - lastTouchAt < 600) return;
              show();
            }
        }
        onMouseleave={clickMode.value ? undefined : () => hide()}
        onFocusin={clickMode.value ? undefined : show}
        onFocusout={clickMode.value ? undefined : () => hide()}
      >
        <span class="hk-tooltip-trigger">
          {slots.default?.({ popupId, visible: visible.value })}
        </span>
        <Teleport to={ensureOverlayRoot()}>
          {everShown.value && (
            <div
              ref={popupRef}
              id={popupId}
              role={clickMode.value ? "dialog" : "tooltip"}
              class={tooltipCls.value}
              style={popupStyle.value}
              // A dialog surface takes focus so keyboard users land on the
              // actions (the slot's buttons are the next Tab stops).
              tabindex={clickMode.value ? -1 : undefined}
              aria-labelledby={clickMode.value && props.text !== "" ? titleId : undefined}
            >
              {popupChildren()}
            </div>
          )}
        </Teleport>
      </span>
    );
  },
});
