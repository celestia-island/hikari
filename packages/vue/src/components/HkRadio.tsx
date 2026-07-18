import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/radio.scss";

export default defineComponent({
  name: "HkRadio",
  props: {
    modelValue: { type: [String, Number] as PropType<string | number | null>, default: null },
    options: { type: Array as PropType<{ value: string | number; label: string; disabled?: boolean }[]>, required: true },
    disabled: { type: Boolean, default: false },
    direction: { type: String as PropType<"horizontal" | "vertical">, default: "horizontal" },
  },
  emits: {
    "update:modelValue": (_value: string | number) => true,
  },
  setup(props, { emit }) {
    const groupCls = computed(() => [
      "hi-radio-group",
      `hi-radio-group-${props.direction}`,
    ]);

    return () => (
      <div class={groupCls.value}>
        {props.options.map((opt) => (
          <label key={opt.value} class="hi-radio-label">
            <input
              type="radio"
              value={opt.value}
              checked={props.modelValue === opt.value}
              disabled={props.disabled || opt.disabled}
              onChange={() => emit("update:modelValue", opt.value)}
            />
            <span class="hi-radio-indicator">
              <span class="hi-radio-dot" />
            </span>
            <span class="hi-radio-text">{opt.label}</span>
          </label>
        ))}
      </div>
    );
  },
});
