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
    // Touch interactions fire emulated mouseenter/mouseleave a moment
    // later on touch devices; without this guard the 140ms mouse delay
    // would instantly undo a touch reveal. Suppress the mouse path for
    // the duration of the touch linger so the touch timer owns the hide.
    let suppressMouseUntil = 0;

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
      // Any touch (tap or swipe over a scrollable main slot) reveals the
      // extension; the finger can keep sweeping without it flickering.
      suppressMouseUntil = Date.now() + props.touchHideDelay;
      reveal();
    }

    function onTouchEnd() {
      suppressMouseUntil = Date.now() + props.touchHideDelay;
      scheduleHide(props.touchHideDelay);
    }

    function onMouseEnter() {
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

    onUnmounted(clearHideTimer);

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
