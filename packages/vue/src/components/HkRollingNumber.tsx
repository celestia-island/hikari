import { defineComponent, onBeforeUnmount, ref, watch, type PropType } from "vue";

import { useReportedTransition } from "../composables/useReportedTransition";
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
    onBeforeUnmount(stopWatch);

    function onAnimEnd(i: number) {
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
