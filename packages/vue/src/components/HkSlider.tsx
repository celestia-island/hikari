import { computed, defineComponent, onBeforeUnmount, onMounted, ref, type PropType } from "vue";

import "./HkSlider.scss";

/**
 * HkSlider — the form/settings range slider. Unlike the hover-only
 * HkMediaSlider seek primitive, the thumb here is persistent and always
 * visible (a bare fill bar reads as a progress display, not a control),
 * values snap to a `step` grid with optional tick marks per stop, and the
 * whole control is keyboard reachable. Thumb and fill pick up
 * `--color-primary` from the active theme, so they follow whatever color
 * scheme the user picks without extra wiring.
 *
 * Interaction model matches the rest of the library: pointerdown on the
 * track jumps and drags (emitting continuously so hosts can apply live),
 * with window-level move/up listeners so the drag keeps tracking the
 * pointer past the element bounds.
 */
export default defineComponent({
  name: "HkSlider",
  props: {
    /** Controlled value; every emitted value lands on the step grid. */
    modelValue: { type: Number, required: true },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100 },
    /** Snap step — emitted values are `min + n * step`. */
    step: { type: Number, default: 1 },
    disabled: { type: Boolean, default: false },
    /** Render one tick dot per stop (kept sane for modest stop counts). */
    showTicks: { type: Boolean, default: false },
    size: { type: String as () => "sm" | "md", default: "md" },
    ariaLabel: { type: String, default: undefined },
    /** Optional aria-valuetext formatter (e.g. `v => `${v}%``). */
    formatValue: { type: Function as PropType<(value: number) => string>, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: number) => true,
  },
  setup(props, { emit }) {
    const trackRef = ref<HTMLElement | null>(null);
    let dragging = false;

    const safeStep = computed(() => (props.step > 0 ? props.step : 1));

    /** Snap to the step grid and clamp into [min, max]; kills float drift. */
    function snap(value: number): number {
      const steps = Math.round((value - props.min) / safeStep.value);
      const snapped = props.min + steps * safeStep.value;
      const fixed = Number(snapped.toFixed(6));
      return Math.min(props.max, Math.max(props.min, fixed));
    }

    const value = computed(() =>
      snap(Math.min(props.max, Math.max(props.min, props.modelValue))),
    );

    const pct = computed(() => {
      const span = props.max - props.min;
      return span > 0 ? ((value.value - props.min) / span) * 100 : 0;
    });

    const tickPositions = computed<number[]>(() => {
      if (!props.showTicks) return [];
      const count = Math.round((props.max - props.min) / safeStep.value);
      // Degenerate ranges and unreadable tick density both render bare.
      if (count < 2 || count > 32) return [];
      return Array.from({ length: count + 1 }, (_, i) => (i / count) * 100);
    });

    const valueText = computed(() =>
      props.formatValue ? props.formatValue(value.value) : String(value.value),
    );

    function valueFrom(clientX: number): number {
      const el = trackRef.value;
      if (!el) return value.value;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return value.value;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return snap(props.min + ratio * (props.max - props.min));
    }

    function commit(next: number) {
      if (next !== value.value) emit("update:modelValue", next);
    }

    function onDown(e: PointerEvent) {
      if (props.disabled) return;
      dragging = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      commit(valueFrom(e.clientX));
    }
    function onMove(e: PointerEvent) {
      if (dragging && !props.disabled) commit(valueFrom(e.clientX));
    }
    function onUp() {
      dragging = false;
    }

    function onKey(e: KeyboardEvent) {
      if (props.disabled) return;
      const big = safeStep.value * 4;
      let next: number;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          next = value.value + safeStep.value;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          next = value.value - safeStep.value;
          break;
        case "PageUp":
          next = value.value + big;
          break;
        case "PageDown":
          next = value.value - big;
          break;
        case "Home":
          next = props.min;
          break;
        case "End":
          next = props.max;
          break;
        default:
          return;
      }
      e.preventDefault();
      commit(snap(next));
    }

    onMounted(() => {
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
    onBeforeUnmount(() => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    });

    return () => (
      <div
        ref={trackRef}
        class={["hk-slider", props.disabled && "is-disabled"].filter(Boolean).join(" ")}
        data-size={props.size}
        role="slider"
        tabindex={props.disabled ? -1 : 0}
        aria-label={props.ariaLabel}
        aria-valuemin={props.min}
        aria-valuemax={props.max}
        aria-valuenow={value.value}
        aria-valuetext={valueText.value}
        aria-disabled={props.disabled || undefined}
        onPointerdown={onDown}
        onKeydown={onKey}
      >
        {tickPositions.value.map((left, i) => (
          <span
            key={i}
            class="hk-slider-tick"
            data-active={left <= pct.value + 0.001 || undefined}
            style={{ left: `${left}%` }}
            aria-hidden="true"
          />
        ))}
        <div class="hk-slider-fill" style={{ width: `${pct.value}%` }} />
        <div class="hk-slider-thumb" style={{ left: `${pct.value}%` }} />
      </div>
    );
  },
});
