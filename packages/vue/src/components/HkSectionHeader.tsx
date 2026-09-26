import { defineComponent, h, type Component, type PropType } from "vue";

import "./HkSectionHeader.scss";

export type SectionHeaderVariant = "default" | "micro" | "mono";

/**
 * HkSectionHeader — the standard in-card / in-page section header.
 *
 * The audit that introduced this counted ~89 distinct hand-rolled
 * treatments for the same anatomy across the consumers: a small
 * semibold heading, an optional one-line description under (or beside)
 * it, an optional right-aligned actions cluster, and occasionally a
 * leading icon or a trailing count badge. One component replaces the
 * family.
 *
 * Variants:
 * - `default` — `text-sm font-semibold` heading (the dominant idiom).
 * - `micro`   — tiny uppercase eyebrow label for dense panels.
 * - `mono`    — mono-caption idiom used by ledgers/detail rails.
 *
 * ```tsx
 * <HkSectionHeader title="Token Usage" description="Per model this range">
 *   {{ actions: () => <HkButton size="sm">Export</HkButton> }}
 * </HkSectionHeader>
 * ```
 */
export const HkSectionHeader = defineComponent({
  name: "HkSectionHeader",
  props: {
    title: { type: String, required: true },
    /** Heading element: h2/h3 keep document outline, div for visual-only. */
    level: { type: String as PropType<"h2" | "h3" | "div">, default: "h3" },
    /** One-line description rendered under the heading. */
    description: { type: String, default: undefined },
    /** Leading icon component. */
    icon: { type: Object as PropType<Component>, default: undefined },
    /** Trailing count badge (e.g. "12 total") rendered beside the title. */
    count: { type: String, default: undefined },
    variant: { type: String as PropType<SectionHeaderVariant>, default: "default" },
    /** Tighter spacing for dense panels. */
    dense: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => {
      const heading = h(
        props.level,
        { class: "hk-section-header-title" },
        [
          props.title,
          props.count != null ? <span class="hk-section-header-count">{props.count}</span> : null,
        ],
      );
      return (
        <div
          class={[
            "hk-section-header",
            `hk-section-header-${props.variant}`,
            props.dense && "hk-section-header-dense",
          ]}
        >
          <div class="hk-section-header-row">
            {props.icon ? <span class="hk-section-header-icon">{h(props.icon, { size: 15 })}</span> : null}
            {heading}
            {slots.actions ? <div class="hk-section-header-actions">{slots.actions()}</div> : null}
          </div>
          {props.description ? (
            <p class="hk-section-header-description">{props.description}</p>
          ) : slots.description ? (
            <p class="hk-section-header-description">{slots.description()}</p>
          ) : null}
        </div>
      );
    };
  },
});
