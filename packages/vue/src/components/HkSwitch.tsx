import { defineComponent, type PropType } from "vue";
import HkLabel from "./HkLabel";
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
    /** Explicit accessible name for callers that render no visible
     *  caption (switches driven by an external label element or pure
     *  icon rows). Falls back to `label`. */
    ariaLabel: { type: String, default: undefined },
    checkedContent: { type: String, default: undefined },
    uncheckedContent: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: boolean) => true,
  },
  setup(props, { emit, slots }) {
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
          // Accessible name (2026-11-18): the wrapping label DOES name the
          // checkbox implicitly via its text content, but that text
          // includes the checked/unchecked content ("ON"/"OFF") and any
          // caller-supplied caption. An explicit aria-label gives the
          // switch a DETERMINISTIC name: `ariaLabel` wins, `label` is the
          // next best, and a bare switch fabricates nothing (callers
          // wiring their own label element keep working — an invented
          // empty name would shadow theirs).
          aria-label={props.ariaLabel ?? props.label}
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
            <span class="hk-switch-content hk-switch-content-off">
              {props.uncheckedContent}
            </span>
          ) : null}
          {props.checkedContent && props.modelValue ? (
            <span class="hk-switch-content hk-switch-content-on">
              {props.checkedContent}
            </span>
          ) : null}
        </span>
        {props.label || slots.default ? (
          <HkLabel size={props.size}>
            {slots.default?.() ?? props.label}
          </HkLabel>
        ) : null}
      </label>
    );
  },
});
