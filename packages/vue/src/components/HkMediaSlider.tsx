import { defineComponent, onBeforeUnmount, onMounted, ref } from "vue";

import "./HkMediaSlider.scss";

/**
 * Generic draggable 0..1 track — the one primitive both the seek bar and the
 * volume slider are built on. Pointer-drag (with capture) emits the ratio
 * continuously so consumers can scrub live. An optional secondary `buffered`
 * fill renders behind the played fill.
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

    function ratioFrom(clientX: number): number {
      const el = trackRef.value;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
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
        role="slider"
        tabindex={-1}
        aria-label={props.ariaLabel}
        aria-valuenow={Math.round(props.ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerdown={onDown}
      >
        {props.buffered > 0 && (
          <div class="hk-media-slider-buffered" style={{ width: `${props.buffered * 100}%` }} />
        )}
        <div class="hk-media-slider-fill" style={{ width: `${props.ratio * 100}%` }} />
        <div class="hk-media-slider-thumb" style={{ left: `${props.ratio * 100}%` }} />
      </div>
    );
  },
});
