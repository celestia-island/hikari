import { computed, defineComponent, type PropType } from "vue";
import "./HkSwitch.scss";

export default defineComponent({
  name: "HkSwitch",
  props: {
    modelValue: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
    color: {
      type: String as PropType<"primary" | "secondary" | "danger" | "warning">,
      default: "primary",
    },
    label: { type: String, default: undefined },
    checkedContent: { type: String, default: undefined },
    uncheckedContent: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
  },
  setup(props, { emit }) {
    function toggle() {
      if (props.disabled) return;
      emit("update:modelValue", !props.modelValue);
    }

    return () => (
      <label
        class={[
          "hk-switch",
          `hk-switch-${props.size}`,
          `hk-switch-${props.color}`,
        ]}
        data-checked={props.modelValue ? "" : undefined}
        data-disabled={props.disabled ? "" : undefined}
      >
        <input
          class="hk-switch-input"
          type="checkbox"
          checked={props.modelValue}
          disabled={props.disabled}
          onChange={toggle}
        />
        <span
          class="hk-switch-track"
          onClick={(e: MouseEvent) => {
            e.preventDefault();
            toggle();
          }}
        >
          <span class="hk-switch-thumb" />
          {props.uncheckedContent && !props.modelValue ? (
            <span class="hk-switch-content hk-switch-content--off">
              {props.uncheckedContent}
            </span>
          ) : null}
          {props.checkedContent && props.modelValue ? (
            <span class="hk-switch-content hk-switch-content--on">
              {props.checkedContent}
            </span>
          ) : null}
        </span>
        {props.label ? (
          <span class="hk-switch-label-text">{props.label}</span>
        ) : null}
      </label>
    );
  },
});
