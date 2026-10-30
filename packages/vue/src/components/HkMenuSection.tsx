import { Comment, Fragment, defineComponent } from "vue";

/** True when slot content carries something visible. A compiled `v-if`
 *  root is a COMMENT vnode (not an empty array), a fragment may wrap only
 *  comments, and whitespace-only strings are not a caption — none of them
 *  may leave a padded, empty aria-hidden band. */
function hasVisibleContent(nodes: readonly unknown[]): boolean {
  for (const node of nodes) {
    if (typeof node === "string") {
      if (node.trim() !== "") return true;
      continue;
    }
    if (typeof node === "number") return true;
    if (node && typeof node === "object") {
      const vnode = node as { type?: unknown; children?: unknown };
      if (vnode.type === Comment) continue;
      if (vnode.type === Fragment) {
        if (Array.isArray(vnode.children)) {
          if (hasVisibleContent(vnode.children)) return true;
        } else if (typeof vnode.children === "string" && vnode.children.trim() !== "") {
          return true;
        }
        continue;
      }
      return true;
    }
  }
  return false;
}

/**
 * HkMenuSection — a captioned run of menu rows.
 *
 * The small caption ABOVE a run of rows is part of the menu-item grammar
 * (see _menu-item.scss, @mixin section / @mixin section-label), but it is
 * hand-rolled at call sites across this library and its consumer's popup
 * menus, with vertical insets from 0 to 6px and no shared token. This
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
    // Resolve the caption INSIDE the render function: a computed caches
    // the slot's vnodes and a pre-built-node slot goes stale when the
    // parent re-renders. An empty result ([] / comment vnodes / blank
    // strings) falls back to the prop text instead of leaving a padded,
    // empty aria-hidden band.
    return () => {
      const caption = slots.label?.();
      return (
        <div class="hk-menu-section" role="group" aria-label={props.label}>
          <div class="hk-menu-section-label" aria-hidden="true">
            {caption && hasVisibleContent(caption) ? caption : props.label}
          </div>
          {slots.default?.()}
        </div>
      );
    };
  },
});
