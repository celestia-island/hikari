import { defineComponent, type PropType } from "vue";

import { hasRenderedContent } from "../runtime/hasRenderedContent";
import "./HkModelCard.scss";

/** The capability tier a model card belongs to — the family's shared
 *  vocabulary (arona serves it on every roster row, the consumers group
 *  by it). The tier only drives the inset accent stripe; the card never
 *  interprets it beyond color. */
export type ModelCardTier = "deep" | "normal" | "basic";

export default defineComponent({
  name: "HkModelCard",
  props: {
    /** Capability tier accent (inset leading stripe). Absent = no stripe. */
    tier: { type: String as PropType<ModelCardTier>, default: undefined },
    /** Dimmed, accent-free, hover-inert presentation for a switched-off
     *  model. Deliberately NOT pointer-events: none — the row's controls
     *  (the serving switch) stay operable exactly to un-disable it. */
    disabled: { type: Boolean, default: false },
    /** Border-emphasis hover feedback. The house standard is color only —
     *  the card never transforms, so hovering never displaces neighbors
     *  or reflows the grid (2026-11-04 user direction). */
    hoverable: { type: Boolean, default: true },
    /** Clickable-card presentation (cursor + focus ring) for surfaces
     *  that cycle state on click. Pure presentation — the consumer owns
     *  the actual click semantics and a11y wiring. */
    interactive: { type: Boolean, default: false },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    return () => {
      const caption = slots.caption?.();
      const footer = slots.footer?.();
      const actions = slots.actions?.();
      return (
        <div
          class="hk-model-card"
          data-tier={props.tier}
          data-disabled={props.disabled || undefined}
          data-hoverable={props.hoverable && !props.disabled ? "" : undefined}
          data-interactive={props.interactive && !props.disabled ? "" : undefined}
          onClick={(e: MouseEvent) => emit("click", e)}
        >
          <div class="hk-model-card-top">
            <div class="hk-model-card-leading">{slots.title?.()}</div>
            {hasRenderedContent(actions) && (
              <div class="hk-model-card-actions">{actions}</div>
            )}
          </div>
          {hasRenderedContent(caption) && (
            <div class="hk-model-card-caption">{caption}</div>
          )}
          {hasRenderedContent(footer) && (
            <div class="hk-model-card-footer">{footer}</div>
          )}
        </div>
      );
    };
  },
});
