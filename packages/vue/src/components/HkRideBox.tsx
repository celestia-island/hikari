/**
 * HkRideBox — the surface container for the family-level height ride.
 *
 * One job: give a surface a frame whose LAYOUT height rides between the
 * natural height and `chrome + content × factor`, while every chrome band
 * the caller pins keeps its natural size (see `useHeightRide` for why the
 * motion is done on layout height instead of `transform: scaleY()` — the
 * 2026-11-07 user report: a frame-level scale squashed the title bar and
 * the footer buttons).
 *
 *   <HkRideBox :riding="isRiding" :factor="0.9">
 *     <template #chrome-start><header/></template>
 *     <Body/>                     <!-- the region that gets compressed -->
 *     <template #chrome-end><footer/></template>
 *   </HkRideBox>
 *
 * The chrome split is MEASURED, not declared (`chrome = boxHeight −
 * contentHeight`), so any number of chrome bands — header, sub-header,
 * breadcrumb strip, footer, a status row — works without the caller
 * listing them. The default slot is the only region ever scaled.
 *
 * Scroll-container compatibility: the content slot keeps its natural
 * layout box for the whole ride, so `HkScrollContainer` / `HkScrollPin` /
 * the overlay scrollbar read stable geometry — no per-frame re-measure, no
 * pins drifting. Surfaces that must skip work while a ride is in flight
 * read the `data-hk-riding` attribute this box stamps (the same contract
 * `data-hk-morphing` gives the mobile sheet).
 */
import { defineComponent, h, nextTick, onMounted, ref, watch } from "vue";

import {
  RIDE_ATTR,
  RIDE_CLASS,
  RIDE_CONTENT_CLASS,
  RIDE_FROM_CLASS,
  RIDE_TO_CLASS,
  useHeightRide,
} from "../composables/useHeightRide";

/** Read the ride duration the sheet is using (ms), with a sane default. */
function readRideMs(el: HTMLElement): number {
  const raw = getComputedStyle(el).transitionDuration || "";
  const ms = raw
    .split(",")
    .map((part) => part.trim())
    .map((part) => (part.endsWith("ms") ? parseFloat(part) : parseFloat(part) * 1000))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ms.length > 0 ? Math.max(...ms) : 420;
}
import "./HkRideBox.scss";

export default defineComponent({
  name: "HkRideBox",
  props: {
    /** True for the whole flight: the box is compressed from mount, and
     *  drops back to natural when this goes false. */
    riding: { type: Boolean, default: false },
    /** Content height at the compressed extreme, as a fraction of natural. */
    factor: { type: Number, default: 0.9 },
    /** Root element tag. */
    as: { type: String, default: "div" },
  },
  emits: {
    /** The ride landed (its own transitionend, or immediately when there
     *  was nothing to animate). */
    settle: () => true,
  },
  setup(props, { slots, emit }) {
    const rootRef = ref<HTMLElement | null>(null);
    const contentRef = ref<HTMLElement | null>(null);
    const ride = useHeightRide(rootRef, contentRef, { factor: props.factor });

    /** Stamps the state class for the current phase. Called after the
     *  measurement lands so the first painted frame is already correct. */
    const apply = (riding: boolean): void => {
      const el = rootRef.value;
      if (!el) return;
      el.classList.toggle(RIDE_CLASS, true);
      if (riding) {
        el.classList.add(RIDE_FROM_CLASS);
        el.classList.remove(RIDE_TO_CLASS);
        el.setAttribute(RIDE_ATTR, "");
      } else if (el.classList.contains(RIDE_FROM_CLASS)) {
        // Coming out of a ride: land through the natural end, then drop the
        // classes (see land()) so the box returns to its own height.
        el.classList.remove(RIDE_FROM_CLASS);
        el.classList.add(RIDE_TO_CLASS);
        el.removeAttribute(RIDE_ATTR);
      }
    };

    let landTimer: ReturnType<typeof setTimeout> | null = null;

    const clearLand = (): void => {
      if (landTimer !== null) {
        clearTimeout(landTimer);
        landTimer = null;
      }
    };

    /** Drop every ride state so the box returns to its own layout height
     *  (`auto`, or the consumer's pin) instead of freezing at the measured
     *  px value. */
    const land = (): void => {
      const el = rootRef.value;
      if (!el) return;
      el.classList.remove(RIDE_FROM_CLASS, RIDE_TO_CLASS);
      el.removeAttribute(RIDE_ATTR);
      emit("settle");
    };

    const armRide = async (riding: boolean): Promise<void> => {
      clearLand();
      // Measure at REST geometry first (a frame at the compressed end
      // reports a short box, which would make the next ride shrink twice).
      ride.refresh();
      const wasRiding = rootRef.value?.classList.contains(RIDE_FROM_CLASS) ?? false;
      apply(riding);
      await nextTick();
      if (riding) return;
      if (!wasRiding) {
        emit("settle");
        return;
      }
      // Landing: the natural end is reached once the height transition has
      // run; then the classes come off so the box is `auto` again. A lost
      // transitionend (a WebView that skips it, a frame that never
      // animated) still lands through the watchdog.
      const el = rootRef.value;
      const duration = el ? readRideMs(el) : 420;
      landTimer = setTimeout(() => {
        landTimer = null;
        land();
      }, duration + 120);
    };

    onMounted(() => void armRide(props.riding));
    watch(
      () => props.riding,
      (riding) => void armRide(riding),
    );

    return () =>
      h(
        props.as,
        { ref: rootRef, class: [RIDE_CLASS, "hk-ride-box"] },
        [
          h("div", { class: "hk-ride-chrome-start" }, slots["chrome-start"]?.()),
          h("div", { ref: contentRef, class: RIDE_CONTENT_CLASS }, slots.default?.()),
          h("div", { class: "hk-ride-chrome-end" }, slots["chrome-end"]?.()),
        ],
      );
  },
});
