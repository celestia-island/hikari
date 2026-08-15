import { defineComponent, ref, computed, onMounted, onBeforeUnmount, watch, type PropType } from "vue";
import { onFrame } from "../runtime/animationBus";

/**
 * Overflow strategy for a placeholder that does not fit its input.
 *
 * - `marquee` (default): render the text three times side by side inside a
 *   clipping window and translate the strip leftward in a loop — the classic
 *   scrolling storefront sign. The strip content is identical in all three
 *   copies so the wrap-around is seamless. Animation runs through the hikari
 *   animation bus, so it participates in the unified frame scheduling, pauses
 *   under reduced-motion, and parks the strip at the natural position when
 *   the host input is focused or the text fits.
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
    /** Park delay (ms) while focused — small hold before scrolling resumes. */
    focusHoldMs: { type: Number, default: 600 },
  },
  setup(props, { expose }) {
    const hostEl = ref<HTMLElement | null>(null);
    const stripEl = ref<HTMLElement | null>(null);
    const offset = ref(0);
    const overflowing = ref(false);
    const focused = ref(false);

    let handle: { disconnect(): void } | null = null;
    let holdUntil = 0;
    let copyWidth = 0;

    const measure = () => {
      const host = hostEl.value;
      const strip = stripEl.value;
      if (!host || !strip) return;
      // One copy = a third of the strip (three identical spans + the CSS
      // copy spacing), so copyWidth already includes the 24px gap.
      const total = strip.scrollWidth;
      copyWidth = total / 3;
      overflowing.value = copyWidth - COPY_SPACING > host.clientWidth;
      if (!overflowing.value) offset.value = 0;
    };

    const frame = (ctx: { now: number; delta: number }) => {
      if (!overflowing.value || focused.value || copyWidth <= 0) return;
      if (ctx.now < holdUntil) return;
      // delta is in seconds, matching the animation bus FrameContext —
      // nominal speed holds regardless of the bus's normal-priority frame
      // budget (33ms) or the display's refresh rate.
      offset.value = (offset.value - props.speed * ctx.delta) % copyWidth;
    };

    onMounted(() => {
      measure();
      handle = onFrame(frame, "normal");
      if (typeof ResizeObserver !== "undefined" && hostEl.value) {
        ro = new ResizeObserver(() => measure());
        ro.observe(hostEl.value);
      }
    });

    let ro: ResizeObserver | null = null;
    watch(() => props.text, () => {
      // Re-measure after the DOM paints the new strip.
      requestAnimationFrame(() => measure());
    });

    onBeforeUnmount(() => {
      handle?.disconnect();
      ro?.disconnect();
    });

    expose({
      /** Called by the host input: focus parks the strip, blur resumes. */
      setActive(active: boolean) {
        focused.value = active;
        if (active) holdUntil = performance.now() + props.focusHoldMs;
      },
      measure,
    });

    const stripStyle = computed(() => ({
      transform: `translateX(${offset.value}px)`,
    }));

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
        <span ref={hostEl} class="hk-placeholder-marquee" aria-hidden="true">
          <span ref={stripEl} class="hk-placeholder-marquee__strip" style={stripStyle.value}>
            <span class="hk-placeholder-marquee__copy">{props.text}</span>
            <span class="hk-placeholder-marquee__copy">{props.text}</span>
            <span class="hk-placeholder-marquee__copy">{props.text}</span>
          </span>
        </span>
      );
    };
  },
});

export default HkPlaceholderMarquee;
