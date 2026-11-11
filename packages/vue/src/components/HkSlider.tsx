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
 *
 * Rail geometry (2026-11-11 user report): the rail is INSET by the thumb
 * radius at each end — the native range-input shape. A thumb parked on
 * the first/last stop then rests ON the rail instead of hanging off its
 * cap, the endpoint tick dots stay inside the rail, and the fill starts
 * flat at the rail's left edge (a pill cap on a 6px saturated bar reads
 * as a pointed nib on screen). The inset lives in the
 * `--hk-slider-rail-inset` var (set inline here, mirrored by the
 * constants below — the stylesheet consumes the var for the track/fill
 * edges; keep the numbers in sync).
 */

/** Thumb diameter / 2 per size (HkSlider.scss thumb rules). */
const RAIL_INSET_PX = { md: 7, sm: 6 } as const;
/** Tick dot diameter (HkSlider.scss `.hk-slider-tick`); dot centers sit
 *  one radius further inside the rail so the last dot never clears the
 *  rail cap. */
const TICK_DOT_PX = 2;

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

    /** The value fraction mapped into the INSET rail: `f` runs 0..1
     *  across the rail's drawable span, so positions derive as
     *  `inset + railLength * f`. Shared by thumb/fill/tick positioning
     *  and the pointer mapping below. Emitted in the expanded linear
     *  calc form (`calc(F% ± Npx)`) — the `(100% - Npx) * f` product
     *  shape renders identically but cssstyle (jsdom) rejects it, and
     *  the contract tests assert on the live inline style. */
    const railInset = computed(() => RAIL_INSET_PX[props.size] ?? RAIL_INSET_PX.md);

    function round4(n: number): number {
      return Math.round(n * 1e4) / 1e4;
    }

    /** A position ON the rail (thumb center / tick center); the extra
     *  inset shaves tick centers by the dot radius so the endpoint
     *  dots stay inside the rail caps. */
    function railPos(f: number, extraInsetPx = 0): string {
      const inset = railInset.value + extraInsetPx;
      const px = round4(inset * (1 - 2 * f));
      const op = px < 0 ? " - " : " + ";
      return `calc(${round4(f * 100)}%${op}${Math.abs(px)}px)`;
    }

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
      const inset = railInset.value;
      const rail = rect.width - inset * 2;
      // Degenerate rail (hidden / zero-width): keep the current value
      // rather than inventing a position.
      if (rect.width <= 0 || rail <= 0) return value.value;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left - inset) / rail));
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
        style={{ "--hk-slider-rail-inset": `${railInset.value}px` }}
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
            // Tick centers ride the rail span, one dot-radius further
            // inset, so the endpoint dots stay inside the rail caps.
            style={{ left: railPos(left / 100, TICK_DOT_PX / 2) }}
            aria-hidden="true"
          />
        ))}
        <div
          class="hk-slider-fill"
          style={{ width: `calc(${round4(pct.value)}% - ${round4(railInset.value * 2 * (pct.value / 100))}px)` }}
        />
        <div class="hk-slider-thumb" style={{ left: railPos(pct.value / 100) }} />
      </div>
    );
  },
});
