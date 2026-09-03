import { defineComponent, onBeforeUnmount, onMounted, ref } from "vue";

/** Grace window that force-releases the `--measuring` clip if the height
 *  `transitionend` never arrives (interrupted transition, backgrounded
 *  tab, reduced-motion). Slightly longer than the 0.3s CSS height
 *  transition so a normal completion is always released by the event. */
const MEASURE_BACKSTOP_MS = 450;

/**
 * HkAuthCard — the shared shell of every Celestia auth screen (login,
 * register, setup): centered header (logo/title/subtitle) over a column
 * form body.
 *
 * Slot layout contract:
 * - `methods` renders into a full-width block between the form and the
 *   footer (typically `HkAuthMethodList`): alternative sign-in buttons
 *   that must line up with the form inputs. Keeping them OUT of the
 *   footer is what lets the footer's checkbox rows stay a centered,
 *   fit-content group instead of being dragged full width with the
 *   buttons.
 * - `footer` renders into `.s-auth-footer`, a flex column sized to its
 *   widest row and centered in the card: every slot child is its own row
 *   (remember-me, protocol consent, a sign-in link…) and the rows share
 *   one left edge. Children must not assume a shared inline line or
 *   per-row centering; content that must sit on one row belongs inside
 *   one child element.
 * - `logo` swaps the header's logo slot; `default` is the form body.
 *
 * Smooth height contract:
 * The card's content is consumer-driven and changes at runtime — channel
 * tabs swap the OAuth `methods` list (3 buttons ↔ 1), validation banners
 * appear, locale switches reflow labels — and the card's height would
 * otherwise snap between the two layouts. The root card is therefore
 * wrapped in a `.s-auth-card-height` measuring wrapper that owns an
 * explicit `height` and animates toward whatever natural height the card
 * grows or shrinks to:
 *
 * - On mount the wrapper seeds its `height` from the card's current
 *   `offsetHeight` while the animating state is impossible, so the first
 *   paint never animates.
 * - A `ResizeObserver` on the card element (not the wrapper) fires when
 *   the content-driven natural height changes. Changes smaller than 1px
 *   are ignored to keep rounding noise from starting a cycle. A real
 *   change adds the `s-auth-card--measuring` class — the ONLY place
 *   `overflow: hidden` is applied — then rewrites the height, and the CSS
 *   `height` transition animates the wrapper between the two sizes.
 * - The clipping class is released by the wrapper's `transitionend`
 *   (propertyName === "height") and, if that event never fires, by a
 *   450ms backstop timer. Between animations the card carries no clip,
 *   so its shadow, focus rings and popovers are never cut off at rest.
 * - `smoothHeight: false` opts out entirely: the wrapper still renders
 *   (the DOM shape stays stable for consumers) but no height style, no
 *   observer and no listeners are installed, and height changes snap as
 *   before. The prop is read ONCE at mount time — runtime toggles are
 *   ignored, making it a static opt-out rather than a reactive switch
 *   (remount with a changed `:key` to apply a new value).
 * - Environments without `ResizeObserver` degrade the same way: instant
 *   snap, no measurement, no clipping.
 * - `prefers-reduced-motion: reduce` disables the transition in CSS, so
 *   the height still tracks the content, just without animation. While
 *   it matches, the observer updates the height directly WITHOUT opening
 *   a measuring window — no clip and no backstop timer — because a clip
 *   held for the backstop would cut off the card's shadow with nothing
 *   animating to mask it.
 *
 * The wrapper is transparent to descendant styling: nothing inside
 * `.s-auth-card` changes, and no hikari stylesheet targets the card as a
 * direct child. Only consumer styles that select `.s-auth-card` as a
 * DIRECT child of a specific parent must account for the extra wrapper
 * (e.g. `.us-main > .s-auth-card` becomes
 * `.us-main > .s-auth-card-height > .s-auth-card`).
 */
export const HkAuthCard = defineComponent({
  name: "HkAuthCard",
  props: {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    smoothHeight: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const heightEl = ref<HTMLElement | null>(null);
    const cardEl = ref<HTMLElement | null>(null);

    let observer: ResizeObserver | null = null;
    let backstopTimer: ReturnType<typeof setTimeout> | null = null;

    /** End the current measuring window: drop the clip and the backstop. */
    const releaseClip = () => {
      if (backstopTimer !== null) {
        clearTimeout(backstopTimer);
        backstopTimer = null;
      }
      heightEl.value?.classList.remove("s-auth-card--measuring");
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      // Only the wrapper's OWN height transition may release the clip —
      // a descendant slot element's height transition bubbling up must
      // not end a measuring window it did not open.
      if (event.target !== heightEl.value) return;
      if (event.propertyName !== "height") return;
      releaseClip();
    };

    onMounted(() => {
      if (!props.smoothHeight) return;
      const wrapper = heightEl.value;
      const card = cardEl.value;
      if (!wrapper || !card || typeof ResizeObserver === "undefined") return;

      // Seed the explicit height BEFORE any animating class exists, so
      // the first paint (wrapper already at the natural size) never
      // animates.
      wrapper.style.height = `${card.offsetHeight}px`;
      wrapper.addEventListener("transitionend", onTransitionEnd);

      observer = new ResizeObserver(() => {
        const next = card.offsetHeight;
        const current = parseFloat(wrapper.style.height) || 0;
        // Ignore sub-pixel churn — rounding noise must not start a
        // clip-and-animate cycle.
        if (Math.abs(next - current) < 1) return;

        // Reduced motion: the CSS transition is `none`, so transitionend
        // will never fire and the clip would just sit there for the
        // backstop window, cutting off the shadow with nothing to mask.
        // Snap unclipped instead — no class, no timer.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          wrapper.style.height = `${next}px`;
          return;
        }

        // Clip ONLY while a height transition is actually running; the
        // class is released by transitionend or the backstop timer.
        wrapper.classList.add("s-auth-card--measuring");
        wrapper.style.height = `${next}px`;

        if (backstopTimer !== null) clearTimeout(backstopTimer);
        backstopTimer = setTimeout(releaseClip, MEASURE_BACKSTOP_MS);
      });
      observer.observe(card);
    });

    onBeforeUnmount(() => {
      observer?.disconnect();
      observer = null;
      heightEl.value?.removeEventListener("transitionend", onTransitionEnd);
      if (backstopTimer !== null) {
        clearTimeout(backstopTimer);
        backstopTimer = null;
      }
    });

    return () => (
      <div class="s-auth-card-height" ref={heightEl}>
        <div class="s-auth-card" ref={cardEl}>
          {slots.logo && (
            <div class="s-auth-header">
              {slots.logo()}
              <h1 class="s-auth-title">{props.title}</h1>
              {props.subtitle && <p class="s-auth-subtitle">{props.subtitle}</p>}
            </div>
          )}
          {!slots.logo && (
            <div class="s-auth-header">
              <h1 class="s-auth-title">{props.title}</h1>
              {props.subtitle && <p class="s-auth-subtitle">{props.subtitle}</p>}
            </div>
          )}
          <div class="s-auth-form">
            {slots.default?.()}
          </div>
          {slots.methods && (
            <div class="s-auth-methods">
              {slots.methods()}
            </div>
          )}
          {slots.footer && (
            <div class="s-auth-footer">
              {slots.footer()}
            </div>
          )}
        </div>
      </div>
    );
  },
});
