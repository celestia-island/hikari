import { defineComponent, ref, computed, onMounted, onBeforeUnmount, watch, type PropType } from "vue";

/**
 * Overflow strategy for a placeholder that does not fit its input.
 *
 * - `marquee` (default): while the text fits, the overlay stays in the DOM
 *   only as an invisible measuring probe and the host input shows its NATIVE
 *   placeholder (crisp, accessible, zero animation). When the text overflows
 *   the input line, the overlay becomes visible, renders the text three
 *   times side by side inside a clipping window, and translates the strip
 *   leftward in a loop — the classic scrolling storefront sign. The strip
 *   content is identical in all three copies so the wrap-around is seamless.
 *
 *   The motion is PURE CSS: one registered infinite keyframes animation
 *   (`hk-placeholder-marquee-scroll`, see animation/registerAnimations.ts)
 *   whose loop distance and duration live on inline custom properties
 *   (`--hk-marquee-shift` / `--hk-marquee-duration`), measured once per
 *   geometry change — never per frame. There is no JS/rAF animation and no
 *   reactive per-frame transform write, so scrolling the page (or a mobile
 *   bottom sheet) never competes with the strip for the main thread; the
 *   animation runs on the compositor. The animation-context switch
 *   (`setReducedMotion` / performance suspension via
 *   `html[data-css-animations="0"]`) parks the strip, and the strip also
 *   parks while the host input is focused (`data-parked`).
 *
 *   The `overflowChange` event tells the host when to swap its native
 *   placeholder for the scrolling overlay.
 * - `truncate`: hard-cut the text at the container edge with an ellipsis.
 */
export type PlaceholderVariant = "marquee" | "truncate";

/** Horizontal spacing between repeated copies — mirrors the scss copy
 * padding-right; kept in sync so overflow detection measures reality. */
const COPY_SPACING = 24;

export const HkPlaceholderMarquee = defineComponent({
  name: "HkPlaceholderMarquee",
  props: {
    text: { type: String, default: "" },
    variant: { type: String as PropType<PlaceholderVariant>, default: "marquee" },
    /** Pixels per second of strip travel. Negative scrolls rightward. */
    speed: { type: Number, default: 24 },
  },
  emits: {
    overflowChange: (_overflowing: boolean) => true,
  },
  setup(props, { emit, expose }) {
    const hostEl = ref<HTMLElement | null>(null);
    const firstCopyEl = ref<HTMLElement | null>(null);
    const overflowing = ref(false);
    const parked = ref(false);
    /** One copy's laid-out width (incl. trailing spacing) — reactive so
     *  the loop geometry republishes when it changes even if the
     *  overflow state does not (zoom, font swap, text edit mid-overflow). */
    const loopWidth = ref(0);

    let ro: ResizeObserver | null = null;

    const measure = () => {
      const host = hostEl.value;
      const copy = firstCopyEl.value;
      if (!host || !copy) return;
      // Measure ONE copy's laid-out width directly (it includes the 24px
      // copy spacing as trailing padding). Reading the first copy element —
      // instead of stripWidth / 3 — stays correct in the fitting case,
      // where the strip holds a single copy, and through overflow flips,
      // where the copy count changes under the same strip.
      const copyWidth = copy.offsetWidth;
      loopWidth.value = copyWidth;
      overflowing.value = copyWidth - COPY_SPACING > host.clientWidth;
      emit("overflowChange", overflowing.value);
    };

    onMounted(() => {
      measure();
      if (typeof ResizeObserver !== "undefined" && hostEl.value) {
        ro = new ResizeObserver(() => measure());
        ro.observe(hostEl.value);
      }
    });

    watch(() => props.text, () => {
      // Re-measure after the DOM paints the new strip.
      requestAnimationFrame(() => measure());
    });

    onBeforeUnmount(() => {
      ro?.disconnect();
    });

    expose({
      /** Called by the host input: focus parks the strip, blur resumes. */
      setActive(active: boolean) {
        parked.value = active;
      },
      measure,
    });

    /** Loop geometry, published as custom properties + a direction flag
     *  on the strip: the keyframes animate
     *  `translateX(0 → var(--hk-marquee-shift))` over
     *  `var(--hk-marquee-duration)` — both measured, never recomputed per
     *  frame. Duration = one copy width at the configured px/s speed;
     *  the sign of the speed flips the direction (reverse plays the
     *  keyframes backwards, which wraps seamlessly on the three copies).
     *  The duration is clamped away from 0/negative so a 0 or negative
     *  speed can never invalidate the animation shorthand. */
    const stripVars = computed(() => {
      if (!overflowing.value || loopWidth.value <= 0) return undefined;
      const speed = Number.isFinite(props.speed) ? Math.abs(props.speed) : 24;
      return {
        "--hk-marquee-shift": `${-loopWidth.value}px`,
        "--hk-marquee-duration": `${(loopWidth.value / Math.max(speed, 0.1)).toFixed(3)}s`,
        "--hk-marquee-direction": (props.speed ?? 24) < 0 ? "reverse" : "normal",
      } as Record<string, string>;
    });

    return () => {
      if (!props.text) return null;
      if (props.variant === "truncate") {
        return (
          <span ref={hostEl} class="hk-placeholder-marquee hk-placeholder-marquee--truncate">
            <span class="hk-placeholder-marquee__text">{props.text}</span>
          </span>
        );
      }
      return (
        <span
          ref={hostEl}
          class={[
            "hk-placeholder-marquee",
            // While the text fits the overlay stays hidden (but laid out,
            // so the probe keeps measuring) and the input's NATIVE
            // placeholder does the showing.
            overflowing.value ? "" : "hk-placeholder-marquee--hidden",
          ].filter(Boolean).join(" ")}
          data-parked={parked.value || undefined}
          aria-hidden="true"
        >
          <span
            class={[
              "hk-placeholder-marquee__strip",
              overflowing.value ? "hk-placeholder-marquee__strip--scroll" : "",
            ].filter(Boolean).join(" ")}
            style={stripVars.value}
          >
            <span ref={firstCopyEl} class="hk-placeholder-marquee__copy">{props.text}</span>
            {overflowing.value && (
              <>
                <span class="hk-placeholder-marquee__copy">{props.text}</span>
                <span class="hk-placeholder-marquee__copy">{props.text}</span>
              </>
            )}
          </span>
        </span>
      );
    };
  },
});

export default HkPlaceholderMarquee;
