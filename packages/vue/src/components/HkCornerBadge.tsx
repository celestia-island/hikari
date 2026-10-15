import { computed, defineComponent, type PropType } from "vue";

import "./HkCornerBadge.scss";

/** The color channels HkBadge already standardizes (same variant names,
 * same override escape hatch — kept in lockstep with HkBadge.tsx). */
export type CornerBadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "error"
  | "warning"
  | "info"
  | "muted";

/**
 * HkCornerBadge — the generic corner mark for ANY anchor (user
 * direction 2026-10-15): a green/red/traffic dot, a notification count
 * ("9+"), or a custom text label pinned to one corner of whatever sits
 * in the default slot. The Vue package had every consumer hand-rolling
 * its own absolute span (the filter/search trigger dots, the icon-group
 * marker, chest's dock time-range pill); this is the one component they
 * converge on — API parity with the Rust family's badge.rs (dot / count
 * / max "N+" / showZero), plus the corner + custom-label the web needs.
 *
 * Decorative by default (aria-hidden): the mark VISUALIZES state the
 * anchor already exposes (a filtered trigger, a selected range); pass
 * `label` when it is the only place a count is announced.
 */
export default defineComponent({
  name: "HkCornerBadge",
  props: {
    variant: { type: String as PropType<CornerBadgeVariant>, default: "primary" },
    /** Bare dot form (the green/red/traffic light). */
    dot: { type: Boolean, default: false },
    /** Count form: renders the number, or "max+" past `max`. Hidden at
     * 0 unless showZero (notification semantics). */
    count: { type: Number, default: undefined },
    max: { type: Number, default: undefined },
    showZero: { type: Boolean, default: false },
    /** Custom label text (the pill form). The default slot is the
     *  ANCHOR, never the label — overloading it made every anchored
     *  child's own text leak into the badge. */
    text: { type: String, default: undefined },
    /** Which corner of the anchor. */
    corner: {
      type: String as PropType<"top-right" | "top-left" | "bottom-right" | "bottom-left">,
      default: "top-right",
    },
    /** Extra clearance from the corner in px (0 = sit ON the corner,
     * the translate(50%,-50%) centering). */
    offset: { type: Number, default: 0 },
    /** Accessible name for the mark (without it the badge is
     * aria-hidden decoration). */
    label: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const text = computed<string | null>(() => {
      if (props.count !== undefined) {
        if (props.count === 0 && !props.showZero) return null;
        if (props.max !== undefined && props.count > props.max) return `${props.max}+`;
        return String(props.count);
      }
      return props.text && props.text.length > 0 ? props.text : null;
    });

    const show = computed(() => props.dot || text.value !== null);

    return () => (
      <span class="hk-corner-badge-anchor">
        {slots.default?.()}
        {show.value && (
          <span
            class={[
              "hk-corner-badge",
              `hk-corner-badge-${props.variant}`,
              props.dot ? "hk-corner-badge--dot" : "hk-corner-badge--pill",
            ]}
            data-corner={props.corner}
            style={props.offset ? { "--hk-corner-badge-offset": `${props.offset}px` } : undefined}
            aria-hidden={props.label ? undefined : "true"}
            role={props.label ? "img" : undefined}
            aria-label={props.label}
          >
            {props.dot ? null : text.value}
          </span>
        )}
      </span>
    );
  },
});
