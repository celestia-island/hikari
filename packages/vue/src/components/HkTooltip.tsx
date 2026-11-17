import { computed, defineComponent, nextTick, onBeforeUnmount, ref, Teleport, watch, type CSSProperties, type PropType, type SlotsType } from "vue";
import { usePopupManager, type PopupHandle } from "../runtime/usePopupManager";
import { applyTooltipPosition, type TooltipPlacement } from "../runtime/tooltipPosition";
import { armTouchHint } from "../runtime/touchHint";
import "./HkTooltip.scss";
import { ensureOverlayRoot } from "../overlay/overlayRoot";
import { ensureTopRoot } from "../overlay/topRoot";

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

/**
 * Position tracking budget.
 *
 * The bubble used to own a permanent per-frame loop for as long as it was
 * visible: two `getBoundingClientRect` reads plus the computed-style zoom
 * lookup, re-placing the popup 60 times a second whether anything had moved
 * or not (a hover annotation in a dense grid cost more than the app it
 * annotated). Geometry now follows explicit signals — see `hookPositionSignals`
 * — and the frame loop only survives to catch motion that fires no event at
 * all; it retires on its own once the trigger has held still.
 */
/** One geometry sample per display frame at most (16.7ms @ 60Hz). */
const POSITION_FRAME_MIN_MS = 16;
/** No rect change for this long ⇒ the trigger is at rest ⇒ retire. */
const POSITION_QUIET_MS = 180;

interface RectSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function rectSnapshot(rect: DOMRect): RectSnapshot {
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

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
    /**
     * The EXPLICIT caption-band exemption (2026-11-12 user direction):
     * default false — the placed bubble keeps at least a 4px gap under the
     * host caption strip (popupBounds floors the popup frame at the
     * chrome-band inset); true lets the bubble pin over the strip, for
     * triggers that live ON the caption (the title bar's own buttons).
     */
    allowBandOverlap: { type: Boolean, default: false },
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
    let resizeObserver: ResizeObserver | null = null;
    let signalsHooked = false;
    let lastSampleAt = Number.NEGATIVE_INFINITY;
    let quietSince = 0;
    let lastTriggerRect: RectSnapshot | null = null;

    /** Did the trigger move since the last placement? One gBCR read is the
     *  entire cost of a static frame now. */
    function rectMoved(next: RectSnapshot): boolean {
      const prev = lastTriggerRect;
      return (
        !prev ||
        prev.left !== next.left ||
        prev.top !== next.top ||
        prev.width !== next.width ||
        prev.height !== next.height
      );
    }

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
      const trigger = wrapperRef.value;
      const popup = popupRef.value;
      if (!trigger || !popup) return;
      const rect = trigger.getBoundingClientRect();
      lastTriggerRect = rectSnapshot(rect);
      quietSince = nowMs();
      // Placement geometry lives in the shared runtime helper (it also
      // serves the document-level tooltip bridge) — including the
      // ancestor-zoom division that keeps teleported popups pinned to
      // their trigger inside scaled roots, and the measure-and-clamp pass
      // that keeps the measured bubble inside the viewport gutter (flip,
      // cap, shift) instead of spilling off-screen or shrinking to the
      // containing block's leftover space.
      applyTooltipPosition(popup, rect, props.placement, props.maxWidth, {
        allowBandOverlap: props.allowBandOverlap,
      });
      observeGeometry();
    }

    function stopPositionTracking() {
      if (positionFrame !== null) cancelAnimationFrame(positionFrame);
      positionFrame = null;
      // A fresh show always places once, whatever the trigger did while
      // the bubble was down.
      lastTriggerRect = null;
    }

    /** One cheap sample: the trigger rect, and nothing else. */
    function samplePosition() {
      positionFrame = null;
      if (!visible.value) return;
      const now = nowMs();
      // One sample per display frame at most: `requestAnimationFrame` is a
      // ~60Hz clock in a browser, but not in accelerated environments
      // (happy-dom drives it off setImmediate), and the geometry pass must
      // never run more often than a paint could use it.
      if (now - lastSampleAt < POSITION_FRAME_MIN_MS) {
        ensureSampler();
        return;
      }
      lastSampleAt = now;
      const trigger = wrapperRef.value;
      // Both nodes must exist before a sample means anything: the popup is
      // rendered by the next flush after a show, so a missing node is
      // "not placed yet", never "at rest" — the loop waits for it instead
      // of retiring before the first placement.
      if (trigger && popupRef.value) {
        if (rectMoved(rectSnapshot(trigger.getBoundingClientRect()))) {
          updatePosition();
        } else if (now - quietSince >= POSITION_QUIET_MS) {
          // Nothing has moved for a while: retire the loop. The next signal
          // (scroll / resize / wheel / ResizeObserver) revives it, and a
          // resting tooltip then costs exactly zero frames.
          return;
        }
      }
      ensureSampler();
    }

    function ensureSampler() {
      if (positionFrame !== null) return;
      positionFrame = requestAnimationFrame(samplePosition);
    }

    /**
     * Event-driven re-placement: the signal itself is the measurement
     * trigger, so the bubble lands on the event's own turn instead of
     * waiting for the next frame — pan/zoom/drag then track the trigger
     * exactly, and stay free while nothing happens.
     */
    function nudgePositionTracking() {
      if (!visible.value) return;
      lastSampleAt = Number.NEGATIVE_INFINITY;
      lastTriggerRect = null;
      updatePosition();
      ensureSampler();
    }

    function beginPositionTracking() {
      hookPositionSignals();
      lastTriggerRect = null;
      lastSampleAt = Number.NEGATIVE_INFINITY;
      quietSince = nowMs();
      ensureSampler();
      observeGeometry();
    }

    // ── geometry signals ─────────────────────────────────────────────
    // A visible bubble follows three kinds of motion: container movement
    // (scroll, any scroller — capture phase), viewport changes (resize),
    // and canvas/camera motion (wheel), all of which move the trigger
    // without an enter/leave. Size changes come from a ResizeObserver on
    // the trigger and on the bubble itself (its own box reflows when the
    // text lands). Whatever still slips through — an un-evented transform
    // animation — is caught by the short sampler above, which is the only
    // reason a frame loop still exists at all.
    const observedNodes = new Set<Element>();

    function observeGeometry() {
      if (typeof ResizeObserver === "undefined") return;
      const observer = ensureResizeObserver();
      for (const node of [wrapperRef.value, popupRef.value]) {
        if (!node || observedNodes.has(node)) continue;
        observedNodes.add(node);
        observer.observe(node);
      }
    }

    function ensureResizeObserver(): ResizeObserver {
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(() => nudgePositionTracking());
      }
      return resizeObserver;
    }

    function hookPositionSignals() {
      if (signalsHooked) return;
      signalsHooked = true;
      window.addEventListener("resize", nudgePositionTracking, { passive: true });
      // Capture phase on purpose: the scroller that moves the trigger is
      // usually an inner card / list / diff body, and a bubble-phase
      // document listener would never see it.
      document.addEventListener("scroll", nudgePositionTracking, { capture: true, passive: true });
      // Wheel is the pan/zoom signal of every canvas surface (treemap,
      // minimap, board) — those move an element with no scroll and no
      // resize at all.
      window.addEventListener("wheel", nudgePositionTracking, { passive: true, capture: true });
      // A DRAG pan emits neither scroll nor wheel: it starts at a
      // pointerdown, which nudges once and re-arms the sampler while the
      // trigger keeps moving (each moving sample restarts the quiet
      // window). A pause longer than POSITION_QUIET_MS mid-gesture retires
      // the sampler; the next pointerdown/scroll/wheel re-arms it.
      document.addEventListener("pointerdown", nudgePositionTracking, { capture: true, passive: true });
    }

    function unhookPositionSignals() {
      if (signalsHooked) {
        signalsHooked = false;
        window.removeEventListener("resize", nudgePositionTracking);
        document.removeEventListener("scroll", nudgePositionTracking, true);
        window.removeEventListener("wheel", nudgePositionTracking, true);
        document.removeEventListener("pointerdown", nudgePositionTracking, true);
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      observedNodes.clear();
    }

    function show() {
      // Hover/focus entry only: the click-trigger wrapper passes NO
      // hover/focus handlers at all (see the render below), so a confirm
      // surface can never pop open from a pointer passing over it.
      //
      // `text` is optional now (click mode may title from it or not), so a
      // text-less hover trigger must stay silent like the touch-hint path
      // does — an empty bubble is a worse answer than no bubble.
      if (!props.text.trim()) return;
      clearShowTimer();
      ensureEngaged();
      showTimer = setTimeout(() => {
        visible.value = true;
        beginPositionTracking();
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
      beginPositionTracking();
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

    // Anything that changes the geometry INPUTS while the bubble is up
    // (placement, the width cap, the band exemption, the caption text that
    // sizes the box) re-places on the spot — the retired frame loop used to
    // pick these up for free, so they must be an explicit signal.
    watch(
      () => [props.placement, props.maxWidth, props.allowBandOverlap, props.text],
      () => { nudgePositionTracking(); },
      { flush: "post" },
    );

    onBeforeUnmount(() => {
      clearShowTimer();
      stopPositionTracking();
      // Observers and listeners outlive the bubble by design (re-shows must
      // not churn them) but never the component.
      unhookPositionSignals();
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
        {/* The explicit band-overlap exemption (allowBandOverlap) is the
            one tooltip mode allowed to pin OVER the caption strip; it must
            also PAINT over it, so that bubble teleports to the
            above-titlebar root (overlay/topRoot.ts). Default tooltips keep
            the overlay root — every non-exempt bubble is floored below the
            band by popupBounds and never needs the elevation. */}
        <Teleport to={props.allowBandOverlap ? ensureTopRoot() : ensureOverlayRoot()}>
          {everShown.value && (
            <div
              ref={popupRef}
              id={popupId}
              role={clickMode.value ? "dialog" : "tooltip"}
              class={tooltipCls.value}
              style={popupStyle.value}
              // Click mode keeps the popup node mounted after a close (lazy
              // contract), but its actions must not stay reachable: an
              // invisible button is still a tab stop and still speaks. `inert`
              // is the platform's own "out of the tab order and out of the
              // a11y tree" switch, armed exactly while the popup is closed.
              inert={clickMode.value ? !visible.value : undefined}
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
