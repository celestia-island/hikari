import { defineComponent, h, onUnmounted, ref, watch, type PropType } from "vue";

import "./HkHoverRevealAction.scss";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";

export type HoverRevealPlacement = "right" | "left" | "top" | "bottom";

export default defineComponent({
  name: "HkHoverRevealAction",
  props: {
    hideDelay: { type: Number, default: 140 },
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

    function scheduleHide() {
      if (props.forceRevealed) return;
      clearHideTimer();
      hideTimer = scheduleCronAfter(() => {
        if (revealed.value) {
          revealed.value = false;
          emit("revealChange", false);
        }
      }, props.hideDelay);
    }

    watch(
      () => props.forceRevealed,
      (forced) => {
        if (forced) reveal();
        else scheduleHide();
      },
    );

    onUnmounted(clearHideTimer);

    return () => {
      return h(
        props.as,
        {
          class: ["hk-hover-reveal", revealed.value && "is-revealed"],
          "data-placement": props.placement,
          onMouseenter: reveal,
          onMouseleave: scheduleHide,
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
