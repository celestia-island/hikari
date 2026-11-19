import { defineComponent, onBeforeUnmount, onMounted, ref, watch, type VNodeChild } from "vue";

import "./HkSupplementInset.scss";

/**
 * HkSupplementInset — the supplementary slot of a button surface
 * (2026-11-19 user direction: any button surface can mount such a
 * supplement — a ⋯ menu button here, anything else there). At rest the
 * supplement takes NO space, so the surface's own content stays exactly
 * where the host put it (a lane reservation was what pushed the theme
 * panel's auto option off-centre). On reveal the supplement's column
 * animates open — the main content is pushed left — and the supplement
 * content fades in; the whole thing rides the animation context
 * (duration/ease tokens, reduced-motion gets instant states).
 *
 * Reveal sources:
 *  - `revealOnHover` (default on): hovering the inset or moving focus
 *    into it reveals, CSS-only;
 *  - the `revealed` prop (controlled): the host toggles it — the theme
 *    panel reveals on a click of the ALREADY-ACTIVE option (whose press
 *    is otherwise a no-op), which is also the touch path where hover
 *    does not exist.
 *
 * STRUCTURE CONTRACT: the main region and the supplement region are
 * SIBLING controls inside one surface — a supplement control must not be
 * nested inside the main button (a button cannot nest a button). Hosts
 * compose:
 *
 *   <HkSupplementInset revealed={open}>
 *     {{ default: <button>…</button> }}
 *     {{ supplement: <HkIconButton …/> }}
 *   </HkSupplementInset>
 *
 * HkTabs' attached trigger actions are the reference consumer (main =
 * the option trigger, supplement = the ⋯).
 *
 * At rest the supplement is `visibility: hidden` (unfocused, out of the
 * a11y tree); revealing flips visibility immediately while the width and
 * opacity animate. The animation target width is measured from the
 * supplement content (ResizeObserver → `--hk-supplement-w`), so hosts
 * never declare a pixel.
 */
export default defineComponent({
  name: "HkSupplementInset",
  props: {
    /** Controlled reveal (e.g. the host's click-toggle). Hover/focus
     *  reveal is independent (see `revealOnHover`). */
    revealed: { type: Boolean, default: false },
    /** The host's press-off state: forced closed even under hover/focus
     *  (a touch tap leaves sticky hover behind — without this the
     *  toggle-off would be unobservable). */
    closed: { type: Boolean, default: false },
    /** Reveal on hover / focus-within (CSS-only). Default on. */
    revealOnHover: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const innerRef = ref<HTMLElement | null>(null);
    /** The measured supplement content width — the animation's max-width
     *  target. Measurement (not a magic constant) keeps the mechanism
     *  content-agnostic; before the first measurement a safe fallback
     *  applies. */
    const supplementWidth = ref(0);

    let observer: ResizeObserver | null = null;
    const measure = () => {
      const el = innerRef.value;
      // Layout pixels (offsetWidth ignores transforms — the strip's swap
      // enter scales its cells, and a bbox read mid-transition would
      // under-measure), +1 to cover the integer rounding floor.
      if (el) supplementWidth.value = el.offsetWidth + 1;
    };
    onMounted(() => {
      measure();
      if (typeof ResizeObserver !== "undefined" && innerRef.value) {
        observer = new ResizeObserver(() => measure());
        observer.observe(innerRef.value);
      }
    });
    watch(innerRef, () => {
      measure();
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (typeof ResizeObserver !== "undefined" && innerRef.value) {
        observer = new ResizeObserver(() => measure());
        observer.observe(innerRef.value);
      }
    });
    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = null;
    });

    return () => (
      <div
        class="hk-supplement-inset"
        data-revealed={props.revealed || undefined}
        data-closed={props.closed || undefined}
        data-hover-reveal={props.revealOnHover || undefined}
        style={{ "--hk-supplement-w": `${supplementWidth.value}px` }}
      >
        <div class="hk-supplement-inset-main">{slots.default?.()}</div>
        {slots.supplement ? (
          <div class="hk-supplement-inset-supplement">
            {/* The INNER is the measurement target: the outer carries the
                collapsed max-width, the inner keeps its natural width. */}
            <div class="hk-supplement-inset-supplement-inner" ref={innerRef}>
              {(slots.supplement?.() ?? []) as VNodeChild}
            </div>
          </div>
        ) : null}
      </div>
    );
  },
});
