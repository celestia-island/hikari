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
 * Where the mark sits relative to the anchor — TWO families, not just
 * corners (user direction 2026-11-05: a corner overlay on every anchor
 * was wrong; "（n）" replaced by a badge must not cover the trigger's own
 * label).
 *
 * - `top-right` / `top-left` / `bottom-right` / `bottom-left` OVERLAY the
 *   anchor: the mark centers ON the anchor's edge (half of it straddles
 *   the corner) — the classic subscript / notification mark for a fixed
 *   box (an avatar, an icon button).
 * - `right` / `left` place the mark BESIDE the anchor in the flow,
 *   vertically centered, so the anchor's own box (and text) is never
 *   covered; the wrapper grows to fit both — the button-group / tab
 *   trigger default.
 *
 * Scenario defaults follow the same line: an anchor that can grow (a
 * trigger inside a button group / tab strip) wants a side placement, a
 * fixed-box anchor (an avatar) wants the bottom-right overlay. The
 * component default is `bottom-right` (the subscript mark); hosts whose
 * scenario is a button group pass `right` as their own default (HkTabs).
 */
export type CornerBadgePlacement =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "right"
  | "left";

/**
 * HkCornerBadge — the generic anchored mark for ANY anchor (user
 * direction 2026-10-15): a green/red/traffic dot, a notification count
 * ("9+"), or a custom text label pinned to a corner of — or beside —
 * whatever sits in the default slot (see CornerBadgePlacement). The Vue
 * package had every consumer hand-rolling
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
    /** Where the mark hangs (see CornerBadgePlacement). The four corners
     *  overlay the anchor; `right` / `left` sit beside it, vertically
     *  centered and never covering it. Default `bottom-right` = the
     *  subscript mark (avatar / icon). Button-group hosts (HkTabs)
     *  default to `right` instead. */
    placement: {
      type: String as PropType<CornerBadgePlacement>,
      default: "bottom-right",
    },
    /** Extra clearance in px. Corner placements: clearance from the
     *  corner (0 = the mark centers ON it via translate(±50%,±50%));
     *  side placements: the gap beyond the shared --hk-corner-badge-gap. */
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
      <span class="hk-corner-badge-anchor" data-placement={props.placement}>
        {slots.default?.()}
        {show.value && (
          <span
            class={[
              "hk-corner-badge",
              `hk-corner-badge-${props.variant}`,
              props.dot ? "hk-corner-badge--dot" : "hk-corner-badge--pill",
            ]}
            data-placement={props.placement}
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
