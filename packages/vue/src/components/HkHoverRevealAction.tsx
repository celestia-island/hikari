import { defineComponent, h, onUnmounted, ref, watch, type PropType } from "vue";

import "./HkHoverRevealAction.scss";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";

export type HoverRevealPlacement = "right" | "left" | "top" | "bottom";

export default defineComponent({
  name: "HkHoverRevealAction",
  props: {
    hideDelay: { type: Number, default: 140 },
    /** How long a touch-revealed extension stays visible after the finger
     *  lifts. Touch devices have no hover, so a swipe/tap on the host
     *  reveals the extension and it lingers for this delay before hiding. */
    touchHideDelay: { type: Number, default: 3000 },
    /** When the extension may appear on touch devices:
     *  - "tap" (default): any touch reveals it (legacy behaviour).
     *  - "longpress": the finger must REST on the host for longPressDelay
     *    before the extension reveals — casual taps and swipes never flash
     *    it. Reveals still linger for touchHideDelay after the lift. */
    touchRevealMode: { type: String as PropType<"tap" | "longpress">, default: "tap" },
    /** Rest duration before a longpress reveal fires. */
    longPressDelay: { type: Number, default: 500 },
    as: { type: String, default: "span" },
    placement: { type: String as PropType<HoverRevealPlacement>, default: "right" },
    forceRevealed: { type: Boolean, default: false },
  },
  emits: {
    revealChange: (_revealed: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const revealed = ref(false);
    let hideTimer: CronHandle | null = null;
    // Long-press reveal timer (touchRevealMode="longpress").
    let longPressTimer: CronHandle | null = null;
    // Touch interactions fire emulated mouseenter/mouseleave a moment
    // later on touch devices; without this guard the 140ms mouse delay
    // would instantly undo a touch reveal. Suppress the mouse path for
    // the duration of the touch linger so the touch timer owns the hide.
    let suppressMouseUntil = 0;

    function clearLongPressTimer() {
      if (longPressTimer) {
        longPressTimer.disconnect();
        longPressTimer = null;
      }
    }

    function clearHideTimer() {
      if (hideTimer) {
        hideTimer.disconnect();
        hideTimer = null;
      }
    }

    function reveal() {
      clearHideTimer();
      if (!revealed.value) {
        revealed.value = true;
        emit("revealChange", true);
      }
    }

    function scheduleHide(delay: number) {
      if (props.forceRevealed) return;
      clearHideTimer();
      hideTimer = scheduleCronAfter(() => {
        if (revealed.value) {
          revealed.value = false;
          emit("revealChange", false);
        }
      }, delay);
    }

    function onTouchStart() {
      // Any touch suppresses the mouse path (emulated mouseenter would
      // otherwise instantly undo the touch reveal).
      suppressMouseUntil = Date.now() + props.touchHideDelay;
      if (props.touchRevealMode === "longpress") {
        // Long-press mode: arm a timer; a quick lift or a slide cancels it
        // without ever revealing, so casual tab taps never flash the "+".
        clearLongPressTimer();
        longPressTimer = scheduleCronAfter(() => {
          longPressTimer = null;
          reveal();
        }, props.longPressDelay);
        return;
      }
      // Tap mode (legacy): any touch (tap or swipe over a scrollable main
      // slot) reveals the extension; the finger can keep sweeping without
      // it flickering.
      reveal();
    }

    function onTouchEnd() {
      suppressMouseUntil = Date.now() + props.touchHideDelay;
      clearLongPressTimer();
      scheduleHide(props.touchHideDelay);
    }

    function onMouseEnter() {
      // Touch devices fire an emulated mouseenter a moment after a tap;
      // during the touch linger window the touch reveal owns the state and
      // its hide timer must survive, so do not re-reveal (which would clear
      // the timer and leave the extension visible forever).
      if (Date.now() < suppressMouseUntil) return;
      reveal();
    }

    function onMouseLeave() {
      if (Date.now() < suppressMouseUntil) return;
      scheduleHide(props.hideDelay);
    }

    watch(
      () => props.forceRevealed,
      (forced) => {
        if (forced) reveal();
        else scheduleHide(props.hideDelay);
      },
    );

    onUnmounted(() => {
      clearHideTimer();
      clearLongPressTimer();
    });

    return () => {
      return h(
        props.as,
        {
          class: ["hk-hover-reveal", revealed.value && "is-revealed"],
          "data-placement": props.placement,
          onMouseenter: onMouseEnter,
          onMouseleave: onMouseLeave,
          onTouchstart: onTouchStart,
          onTouchend: onTouchEnd,
          onTouchcancel: onTouchEnd,
          // A sliding finger is a swipe, not a press — cancel any pending
          // long-press reveal so scrolling over the tabs never flashes
          // the extension.
          onTouchmove: () => {
            if (props.touchRevealMode === "longpress") clearLongPressTimer();
          },
        },
        [
          h("span", { class: "hk-hover-reveal-main" }, slots.default?.()),
          slots.extension
            ? h("span", { class: "hk-hover-reveal-extension" }, slots.extension({ revealed: revealed.value }))
            : null,
        ].filter(Boolean),
      );
    };
  },
});
