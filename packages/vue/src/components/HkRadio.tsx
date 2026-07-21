import { computed, defineComponent, type PropType } from "vue";
import "./HkRadio.scss";

export interface HkRadioOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export default defineComponent({
  name: "HkRadio",
  props: {
    modelValue: {
      type: [String, Number] as PropType<string | number | null>,
      default: null,
    },
    options: {
      type: Array as PropType<HkRadioOption[]>,
      required: true,
    },
    disabled: { type: Boolean, default: false },
    direction: {
      type: String as PropType<"horizontal" | "vertical">,
      default: "horizontal",
    },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
  },
  emits: {
    "update:modelValue": (_value: string | number) => true,
  },
  setup(props, { emit }) {
    return () => (
      <div
        class={[
          "hk-radio-group",
          `hk-radio-group-${props.direction}`,
          `hk-radio-group-${props.size}`,
        ]}
      >
        {props.options.map((opt) => {
          const isSelected = props.modelValue === opt.value;
          const isDisabled = props.disabled || opt.disabled === true;

          return (
            <label
              key={opt.value}
              class="hk-radio"
              data-disabled={isDisabled ? "" : undefined}
              data-size={props.size}
            >
              <span
                class="hk-radio-box"
                data-checked={isSelected ? "" : undefined}
              >
                <input
                  class="hk-radio-input"
                  type="radio"
                  value={opt.value}
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => emit("update:modelValue", opt.value)}
                />
                {isSelected && <span class="hk-radio-dot" />}
              </span>
              <span class="hk-radio-label-text">{opt.label}</span>
            </label>
          );
        })}
      </div>
    );
  },
});
