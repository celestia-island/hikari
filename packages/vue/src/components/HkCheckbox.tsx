import { Check } from "lucide-vue-next";
import { defineComponent, onUnmounted, ref, type PropType } from "vue";

import { scheduleCronAfter, type CronHandle } from "../runtime/cronBus";
import HkLabel from "./HkLabel";
import "./HkCheckbox.scss";

export default defineComponent({
  name: "HkCheckbox",
  props: {
    modelValue: { type: Boolean, default: false },
    label: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    type: {
      type: String as PropType<"checkbox" | "radio">,
      default: "checkbox",
    },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const animating = ref(false);
    let animTimer: CronHandle | null = null;

    function markActive() {
      animating.value = true;
      // cronBus one-shot (not the rAF-driven animationBus one): the
      // flag must always clear, even while the animation bus is parked
      // under reduced motion.
      animTimer?.disconnect();
      animTimer = scheduleCronAfter(() => {
        animTimer = null;
        animating.value = false;
      }, 300);
    }

    function onChange(e: Event) {
      if (props.disabled) return;
      emit("update:modelValue", (e.target as HTMLInputElement).checked);
      markActive();
    }

    onUnmounted(() => {
      animTimer?.disconnect();
      animTimer = null;
    });

    return () => {
      const inputType = props.type === "radio" ? "radio" : "checkbox";
      const isChecked = props.modelValue === true || props.modelValue === null;

      return (
        <label
          class={[
            "hk-checkbox",
            `hk-checkbox-${props.size}`,
          ]}
          data-type={inputType}
          data-disabled={props.disabled ? "" : undefined}
          data-animating={animating.value ? "" : undefined}
        >
          <span
            class="hk-checkbox-box"
            data-checked={props.modelValue ? "" : undefined}
            data-indeterminate={props.modelValue === null ? "" : undefined}
          >
            <input
              class="hk-checkbox-input"
              type={inputType}
              checked={props.modelValue === true}
              disabled={props.disabled}
              onChange={onChange}
            />
            {props.modelValue === true
              ? props.type === "radio"
                ? <span class="hk-checkbox-dot" />
                : <Check size={14} class="hk-checkbox-icon" />
              : null}
            {props.modelValue === null && props.type !== "radio" ? (
              <span class="hk-checkbox-indeterminate" />
            ) : null}
          </span>
          {props.label || slots.default ? (
            <HkLabel size={props.size}>
              {slots.default?.() ?? props.label}
            </HkLabel>
          ) : null}
        </label>
      );
    };
  },
});
