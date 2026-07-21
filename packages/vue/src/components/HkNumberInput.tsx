import { computed, defineComponent, onUnmounted, ref, type PropType } from "vue";
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
    size: {
      type: String as PropType<"sm" | "md" | "lg">,
      default: "md",
    },
  },
  emits: {
    "update:modelValue": (_value: number) => true,
  },
  setup(props, { emit, slots }) {
    let holdInterval: ReturnType<typeof setInterval> | null = null;
    let holdTimeout: ReturnType<typeof setTimeout> | null = null;
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

    function startHold(dir: "up" | "down") {
      stopHold();
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
      holdTimeout = null;
      holdInterval = null;
    }

    onUnmounted(stopHold);

    const wrapperClass = computed(() => [
      "hk-number-input",
      `hk-number-input-${props.size}`,
      props.disabled ? "hk-number-input-disabled" : "",
    ]);

    return () => (
      <div class={wrapperClass.value}>
        <div class="hk-number-input-inner">
          {slots.prefix ? (
            <span class="hk-number-input-prefix">{slots.prefix()}</span>
          ) : null}
          <input
            ref={inputRef}
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
          {slots.suffix ? (
            <span class="hk-number-input-suffix">{slots.suffix()}</span>
          ) : null}
          <div class="hk-number-input-steppers">
            <button
              type="button"
              class="hk-number-input-step hk-number-input-step--up"
              disabled={!canIncrement.value || props.disabled}
              onMousedown={(e: MouseEvent) => {
                e.preventDefault();
                startHold("up");
              }}
              onMouseup={(e: MouseEvent) => {
                e.preventDefault();
                stopHold();
              }}
              onMouseleave={(e: MouseEvent) => {
                e.preventDefault();
                stopHold();
              }}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                increment();
              }}
              tabindex={-1}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
            <button
              type="button"
              class="hk-number-input-step hk-number-input-step--down"
              disabled={!canDecrement.value || props.disabled}
              onMousedown={(e: MouseEvent) => {
                e.preventDefault();
                startHold("down");
              }}
              onMouseup={(e: MouseEvent) => {
                e.preventDefault();
                stopHold();
              }}
              onMouseleave={(e: MouseEvent) => {
                e.preventDefault();
                stopHold();
              }}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                decrement();
              }}
              tabindex={-1}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  },
});
