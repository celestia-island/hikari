import { defineComponent, type PropType } from "vue";

import HkSlider from "./HkSlider";
import "./HkSliderField.scss";

/**
 * HkSliderField — the boxed form-slider: an HkSlider riding a form
 * chrome row with a LEADING and a TRAILING slot flanking it (either
 * may host arbitrary content — a value editor, a dropdown, a badge).
 * The slider itself takes all the room the slots leave; the box owns
 * the border/padding so the row reads as one control.
 *
 * Purely generic: no idea what the value means. Hosts that need a
 * stepped ladder drive it in index space (min 0, max stops-1) and
 * map indices themselves; the trailing slot commonly carries their
 * value editor (the composition lives in the host, not here).
 */
export default defineComponent({
  name: "HkSliderField",
  props: {
    /** Controlled value; every emitted value lands on the step grid. */
    modelValue: { type: Number, required: true },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    /** Snap step — emitted values are `min + n * step`. */
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    /** Render one tick dot per stop. */
    showTicks: { type: Boolean, default: false },
    size: { type: String as () => "sm" | "md", default: "md" },
    ariaLabel: { type: String, default: undefined },
    /** Optional aria-valuetext formatter. */
    formatValue: { type: Function as PropType<(value: number) => string>, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: number) => true,
  },
  setup(props, { emit, slots }) {
    return () => (
      <div
        class={["hk-slider-field", props.disabled && "is-disabled"].filter(Boolean).join(" ")}
        role="group"
        aria-label={props.ariaLabel}
      >
        {slots.leading && (
          <div class="hk-slider-field-slot" data-side="leading">
            {slots.leading()}
          </div>
        )}
        <HkSlider
          class="hk-slider-field-slider"
          modelValue={props.modelValue}
          min={props.min}
          max={props.max}
          step={props.step}
          disabled={props.disabled}
          showTicks={props.showTicks}
          size={props.size}
          ariaLabel={props.ariaLabel}
          formatValue={props.formatValue}
          onUpdate:modelValue={(v: number) => emit("update:modelValue", v)}
        />
        {slots.trailing && (
          <div class="hk-slider-field-slot" data-side="trailing">
            {slots.trailing()}
          </div>
        )}
      </div>
    );
  },
});
