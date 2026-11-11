import { defineComponent, onBeforeUnmount, onMounted, ref } from "vue";

import "./HkMediaSlider.scss";

/**
 * Generic draggable 0..1 track — the one primitive both the seek bar and the
 * volume slider are built on. Pointer-drag (with capture) emits the ratio
 * continuously so consumers can scrub live. An optional secondary `buffered`
 * fill renders behind the played fill.
 *
 * Rail geometry (2026-11-11, the same shape HkSlider ships): the drawable
 * rail is inset by the thumb radius (6px — the thumb is 12px at every size)
 * at each end via the inline `--hk-media-slider-rail-inset` var, so a thumb
 * parked on 0/1 rests ON the rail instead of hanging off its cap, and the
 * fill starts FLAT at the rail edge (a rounded cap on a thin saturated bar
 * reads as a pointed nib). The emitted positions use the linear calc
 * expansion `calc(F% ± Npx)` — identical geometry to
 * `inset + (100% - 2·inset)·f`, and the form jsdom/cssstyle parses for the
 * contract tests.
 */
export default defineComponent({
  name: "HkMediaSlider",
  props: {
    ratio: { type: Number, required: true },
    buffered: { type: Number, default: 0 },
    disabled: { type: Boolean, default: false },
    ariaLabel: { type: String, default: undefined },
    size: { type: String as () => "md" | "sm", default: "md" },
  },
  emits: {
    "update:ratio": (_ratio: number) => true,
  },
  setup(props, { emit }) {
    const trackRef = ref<HTMLElement | null>(null);
    let dragging = false;

    /** Thumb radius: the thumb is 12px at every size (scss). */
    const railInset = 6;

    function round4(n: number): number {
      return Math.round(n * 1e4) / 1e4;
    }

    /** The fill/buffered width along the rail: `railLength·f` as
     *  `calc(F% - Npx)`. */
    function railWidth(f: number): string {
      return `calc(${round4(f * 100)}% - ${round4(railInset * 2 * f)}px)`;
    }

    /** A position ON the rail (thumb center): `inset + railLength·f`. */
    function railPos(f: number): string {
      const px = round4(railInset * (1 - 2 * f));
      const op = px < 0 ? " - " : " + ";
      return `calc(${round4(f * 100)}%${op}${Math.abs(px)}px)`;
    }

    function ratioFrom(clientX: number): number {
      const el = trackRef.value;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const rail = rect.width - railInset * 2;
      // Degenerate rail (hidden or thinner than both insets): re-assert the
      // current value instead of inventing a position (the Rust mirror's
      // None → no-emit parity).
      if (rect.width <= 0 || rail <= 0) return props.ratio;
      return Math.max(0, Math.min(1, (clientX - rect.left - railInset) / rail));
    }
    function onDown(e: PointerEvent) {
      if (props.disabled) return;
      dragging = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      emit("update:ratio", ratioFrom(e.clientX));
    }
    function onMove(e: PointerEvent) {
      if (dragging) emit("update:ratio", ratioFrom(e.clientX));
    }
    function onUp() {
      dragging = false;
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
        class={[
          "hk-media-slider",
          props.disabled && "is-disabled",
        ].filter(Boolean).join(" ")}
        data-size={props.size}
        style={{ "--hk-media-slider-rail-inset": `${railInset}px` }}
        role="slider"
        tabindex={-1}
        aria-label={props.ariaLabel}
        aria-valuenow={Math.round(props.ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerdown={onDown}
      >
        {props.buffered > 0 && (
          <div
            class="hk-media-slider-buffered"
            style={{ width: railWidth(props.buffered) }}
          />
        )}
        <div class="hk-media-slider-fill" style={{ width: railWidth(props.ratio) }} />
        <div class="hk-media-slider-thumb" style={{ left: railPos(props.ratio) }} />
      </div>
    );
  },
});
