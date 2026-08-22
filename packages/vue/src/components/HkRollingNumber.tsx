import { defineComponent, onBeforeUnmount, ref, watch, type PropType } from "vue";

import { useReportedTransition } from "../composables/useReportedTransition";
import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import "./HkRollingNumber.scss";

export default defineComponent({
  name: "HkRollingNumber",
  props: {
    value: { type: [Number, String] as PropType<number | string>, required: true },
  },
  setup(props) {
    interface CharState {
      current: string;
      prev: string;
      animating: boolean;
    }

    const chars = ref<CharState[]>([]);

    const ROLL_ANIM_MS = 100;
    const rollAnim = useReportedTransition(ROLL_ANIM_MS);

    // Fallback commit: under the global animation switch
    // (`html[data-css-animations="0"]`, driven by reduced motion /
    // performance suspension) the roll keyframes are paused at 0% and
    // `animationend` never fires — the OLD digit would stay visible
    // forever. A cronBus one-shot always fires (the rAF-driven animation
    // bus is parked in exactly that situation) and force-commits the
    // final digit if `animationend` has not fired yet.
    const ROLL_COMMIT_MS = 350;
    const fallbacks = new Map<number, CronHandle>();

    function cancelFallback(i: number) {
      const h = fallbacks.get(i);
      if (h) {
        h.disconnect();
        fallbacks.delete(i);
      }
    }

    function armFallback(i: number) {
      cancelFallback(i);
      const handle = scheduleCronAfter(() => {
        fallbacks.delete(i);
        if (chars.value[i]) chars.value[i].animating = false;
      }, ROLL_COMMIT_MS);
      fallbacks.set(i, handle);
    }

    function cancelAllFallbacks() {
      for (const h of fallbacks.values()) h.disconnect();
      fallbacks.clear();
    }

    function update(newStr: string): boolean {
      const newChars = newStr.split("");
      const oldLen = chars.value.length;

      if (newChars.length !== oldLen) {
        chars.value = newChars.map((ch) => ({
          current: ch,
          prev: ch,
          animating: false,
        }));
        return false;
      }

      let anyRolled = false;
      for (let i = 0; i < newChars.length; i++) {
        const prev = chars.value[i].current;
        const next = newChars[i];
        if (prev !== next) {
          chars.value[i] = {
            current: next,
            prev,
            animating: true,
          };
          armFallback(i);
          anyRolled = true;
        }
      }
      return anyRolled;
    }

    const stopWatch = watch(
      () => String(props.value),
      (val) => {
        if (update(val)) rollAnim.run();
      },
      { immediate: true },
    );
    onBeforeUnmount(() => {
      stopWatch();
      cancelAllFallbacks();
    });

    function onAnimEnd(i: number) {
      cancelFallback(i);
      if (chars.value[i]) {
        chars.value[i].animating = false;
      }
    }

    return () => (
      <span class="hk-rolling-number">
        {chars.value.map((ch, i) => {
          const isDigit = /^[0-9]$/.test(ch.current);
          if (!isDigit || !ch.animating) {
            return (
              <span key={i} data-el="char">
                {ch.current}
              </span>
            );
          }
          return (
            <span key={i} data-el="slot">
              <span
                data-el="roll"
                onAnimationend={() => onAnimEnd(i)}
              >
                <span data-el="digit" data-variant="old">
                  {ch.prev}
                </span>
                <span data-el="digit" data-variant="new">
                  {ch.current}
                </span>
              </span>
            </span>
          );
        })}
      </span>
    );
  },
});
