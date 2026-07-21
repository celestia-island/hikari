import { defineComponent, ref, type PropType } from "vue";
import { Check } from "lucide-vue-next";
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
    let animTimer: ReturnType<typeof setTimeout> | null = null;

    function markActive() {
      animating.value = true;
      if (animTimer) clearTimeout(animTimer);
      animTimer = setTimeout(() => {
        animating.value = false;
      }, 300);
    }

    function onChange(e: Event) {
      if (props.disabled) return;
      emit("update:modelValue", (e.target as HTMLInputElement).checked);
      markActive();
    }

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
            <span class="hk-checkbox-label-text">
              {slots.default?.() ?? props.label}
            </span>
          ) : null}
        </label>
      );
    };
  },
});
