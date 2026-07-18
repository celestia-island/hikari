import { computed, defineComponent, ref, onUnmounted, type PropType } from "vue";
import "../../../components/src/styles/components/input_wrapper.scss";
import "../../../components/src/styles/components/number_input.scss";

export default defineComponent({
  name: "HkNumberInput",
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String },
  },
  emits: {
    "update:modelValue": (_value: number) => true,
  },
  setup(props, { emit }) {
    let holdInterval: ReturnType<typeof setInterval> | null = null;
    let holdTimeout: ReturnType<typeof setTimeout> | null = null;

    const canDecrement = computed(() => (props.min != null ? props.modelValue > props.min : true));
    const canIncrement = computed(() => (props.max != null ? props.modelValue < props.max : true));

    function increment() {
      const newVal = props.modelValue + props.step;
      if (props.max != null && newVal > props.max) {
        emit("update:modelValue", props.max);
      } else {
        emit("update:modelValue", newVal);
      }
    }

    function decrement() {
      const newVal = props.modelValue - props.step;
      if (props.min != null && newVal < props.min) {
        emit("update:modelValue", props.min);
      } else {
        emit("update:modelValue", newVal);
      }
    }

    function startHold(dir: "up" | "down") {
      holdTimeout = setTimeout(() => {
        holdInterval = setInterval(() => {
          if (dir === "up") increment();
          else decrement();
        }, 50);
      }, 300);
    }

    function stopHold() {
      if (holdTimeout) clearTimeout(holdTimeout);
      if (holdInterval) clearInterval(holdInterval);
      holdInterval = null;
      holdTimeout = null;
    }

    onUnmounted(stopHold);

    return () => (
      <div class="hi-number-input-wrapper">
        <div class="hi-input-wrapper">
          <div class="hi-input-wrapper-input">
            <input
              type="number"
              value={props.modelValue}
              min={props.min}
              max={props.max}
              step={props.step}
              disabled={props.disabled}
              placeholder={props.placeholder}
              onInput={(e: Event) => emit("update:modelValue", Number((e.target as HTMLInputElement).value))}
            />
          </div>
          <div class="hi-input-wrapper-right" style={{ flexDirection: "column", gap: "1px" }}>
            <button
              type="button"
              class="hi-number-step-btn"
              disabled={!canIncrement.value || props.disabled}
              onMousedown={(e: MouseEvent) => { e.preventDefault(); startHold("up"); }}
              onMouseup={(e: MouseEvent) => { e.preventDefault(); stopHold(); }}
              onMouseleave={(e: MouseEvent) => { e.preventDefault(); stopHold(); }}
              onClick={(e: MouseEvent) => { e.preventDefault(); increment(); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button
              type="button"
              class="hi-number-step-btn"
              disabled={!canDecrement.value || props.disabled}
              onMousedown={(e: MouseEvent) => { e.preventDefault(); startHold("down"); }}
              onMouseup={(e: MouseEvent) => { e.preventDefault(); stopHold(); }}
              onMouseleave={(e: MouseEvent) => { e.preventDefault(); stopHold(); }}
              onClick={(e: MouseEvent) => { e.preventDefault(); decrement(); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  },
});
