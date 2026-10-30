import { computed, defineComponent } from "vue";

/**
 * HkMenuSection — a captioned run of menu rows.
 *
 * The small caption ABOVE a run of rows is part of the menu-item grammar
 * (see _menu-item.scss, @mixin section / @mixin section-label), but it is
 * hand-rolled at 9+ call sites (six in the product's workspace picker
 * alone) with four different vertical bands and no shared token. This
 * component is the ONE markup for it:
 *
 *   <HkMenuSection label="Temp spaces">
 *     <HkMenuActionItem … />
 *   </HkMenuSection>
 *
 * Accessibility follows the HkTemplateField precedent: grouping is a
 * `role="group"` wrapper carrying the group's name in `aria-label`, and
 * the visible caption band inside is `aria-hidden="true"`. The wrapper
 * already announces the name, so leaving the visible band in the a11y
 * tree would double-announce it (and a bare heading band was invisible to
 * screen readers before that wave).
 *
 * `label` is both the accessible group name and the default visible
 * caption text; the optional `label` slot supplies richer visible content
 * (a badge, a count) while `aria-label` keeps the prop's plain string.
 * The slot must be NON-INTERACTIVE content: it renders inside the
 * aria-hidden band, so a focusable node there would be an axe
 * `aria-hidden-focus` violation, and its visible text must not contradict
 * the accessible name (keep the prop as the plain group name). The
 * default slot is the rows.
 *
 * Metrics come from the global adopter rules in styles/admin-tokens
 * (`@include mi.section` / `@include mi.section-label`), loaded by the
 * canonical styles entry — deliberately NO local scss import, so hosts
 * that render the classes by hand and this component share one
 * declaration (the HkAvatarButton precedent).
 */
export default defineComponent({
  name: "HkMenuSection",
  props: {
    /** Accessible group name AND the default visible caption text. */
    label: { type: String, required: true },
  },
  setup(props, { slots }) {
    // An EMPTY slot result is not nullish: `slots.label?.() ?? props.label`
    // left a padded, empty aria-hidden band when the slot rendered nothing.
    // Treat empty content as absent and fall back to the prop text.
    const caption = computed(() => {
      const content = slots.label?.();
      return content && content.length > 0 ? content : props.label;
    });
    return () => (
      <div class="hk-menu-section" role="group" aria-label={props.label}>
        <div class="hk-menu-section-label" aria-hidden="true">
          {caption.value}
        </div>
        {slots.default?.()}
      </div>
    );
  },
});
