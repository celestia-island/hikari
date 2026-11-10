import { computed, defineComponent, ref, useId, type PropType } from "vue";
import HkNumberSteppers from "./HkNumberSteppers";
import "./HkNumberInput.scss";

export default defineComponent({
  name: "HkNumberInput",
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: undefined },
    label: { type: String, default: undefined },
    /* `id` for the field element; the rendered label's `for` points here.
       Generated via Vue's useId when omitted, so a bare `label` prop is
       fully associated for screen readers and label clicks with zero
       caller effort (HkInput's contract, same shape). Without this the
       bare <label> had NO programmatic association at all — the field
       announced as "spin button" (2026-11-10, #1206). */
    id: { type: String, default: undefined },
    /* Affix text rendered INSIDE the field (before/after the input,
       flex-centered by the inner row). Slots of the same name take
       precedence; empty/undefined means no affix. Consumers should use
       these instead of placing unit text in a sibling element next to
       the component — the root stacks label over input, so a sibling
       centered against the root targets the wrong axis midpoint. */
    prefix: { type: String, default: undefined },
    suffix: { type: String, default: undefined },
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
  },
  emits: {
    "update:modelValue": (_value: number) => true,
  },
  setup(props, { emit, slots }) {
    const inputRef = ref<HTMLInputElement | null>(null);

    const canIncrement = computed(() =>
      props.max != null ? props.modelValue < props.max : true,
    );
    const canDecrement = computed(() =>
      props.min != null ? props.modelValue > props.min : true,
    );

    function emitValue(val: number) {
      if (props.min != null && val < props.min) {
        emit("update:modelValue", props.min);
        return;
      }
      if (props.max != null && val > props.max) {
        emit("update:modelValue", props.max);
        return;
      }
      emit("update:modelValue", val);
    }

    function increment() {
      if (!canIncrement.value) return;
      emitValue(props.modelValue + props.step);
    }

    function decrement() {
      if (!canDecrement.value) return;
      emitValue(props.modelValue - props.step);
    }

    // Field identity: the rendered label points at this id, so a bare
    // `label` prop gives a fully associated field (screen readers, label
    // clicks). An explicit `id` prop wins. useId() must run synchronously
    // in setup; it is SSR-safe (HkInput's same shape).
    const generatedId = useId();
    const fieldId = computed(() => props.id ?? generatedId);

    const wrapperClass = computed(() => [
      "hk-number-input",
      `hk-number-input-${props.size}`,
      props.disabled ? "hk-number-input-disabled" : "",
    ]);

    return () => (
      <div class={wrapperClass.value}>
        {props.label && <label class="hk-input-label" for={fieldId.value}>{props.label}</label>}
        <div class="hk-number-input-inner">
          {(slots.prefix || props.prefix) ? (
            <span class="hk-number-input-prefix">
              {slots.prefix ? slots.prefix() : props.prefix}
            </span>
          ) : null}
          <input
            ref={inputRef}
            id={fieldId.value}
            type="number"
            class="hk-number-input-field"
            value={props.modelValue}
            min={props.min}
            max={props.max}
            step={props.step}
            disabled={props.disabled}
            placeholder={props.placeholder}
            onInput={(e: Event) =>
              emitValue(Number((e.target as HTMLInputElement).value))
            }
          />
          {(slots.suffix || props.suffix) ? (
            <span class="hk-number-input-suffix">
              {slots.suffix ? slots.suffix() : props.suffix}
            </span>
          ) : null}
          {/* The shared stepper column (lucide ChevronUp/Down) — it owns
              the hold-to-repeat cadence on the animation bus; the bounds
              mirror this field's min/max so dead ends render greyed. */}
          <HkNumberSteppers
            canUp={canIncrement.value}
            canDown={canDecrement.value}
            disabled={props.disabled}
            size={props.size}
            onStep={(dir: "up" | "down") => (dir === "up" ? increment() : decrement())}
          />
        </div>
      </div>
    );
  },
});
