import { computed, defineComponent, type PropType } from "vue";
import "../../../components/src/styles/components/checkbox.scss";

export default defineComponent({
  name: "HkCheckbox",
  props: {
    modelValue: { type: Boolean, default: false },
    label: { type: String },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
  },
  setup(props, { emit, slots }) {
    const labelCls = computed(() => [
      "hi-checkbox-label",
      props.disabled ? "hi-checkbox-disabled" : "",
    ]);

    const checkboxCls = computed(() => [
      "hi-checkbox",
      `hi-checkbox-${props.size}`,
      props.modelValue ? "hi-checkbox-checked" : "",
    ]);

    return () => (
      <label class={labelCls.value}>
        <input
          type="checkbox"
          class="hi-checkbox-input"
          checked={props.modelValue}
          disabled={props.disabled}
          onChange={(e: Event) => emit("update:modelValue", (e.target as HTMLInputElement).checked)}
        />
        <span class={checkboxCls.value}>
          {props.modelValue && (
            <svg class="hi-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        {props.label ? <span class="hi-checkbox-text">{props.label}</span> : slots.default?.()}
      </label>
    );
  },
});
