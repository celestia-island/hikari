import { computed, defineComponent, useAttrs, type PropType } from "vue";

import "./HkButton.scss";
import HIcon from "./HkIcon";
import HKbd from "./HkKbd";
import HSpinner from "./HkSpinner";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

/** Breakpoints below which a `collapseLabel` button hides its label and
 *  collapses to the icon-only square. Mirrors the runtime useBreakpoint
 *  scale (sm 640 / md 768 / lg 1024 / xl 1280) — the SCSS side repeats
 *  the px values because a media query cannot read a TS constant; keep
 *  the two in sync. "xs" is deliberately absent: collapse-at-xs means
 *  "always collapsed", which is just the icon prop + label-less button. */
export type ButtonLabelCollapse = "sm" | "md" | "lg" | "xl";

export default defineComponent({
  name: "HkButton",
  inheritAttrs: false,
  props: {
    variant: { type: String as PropType<ButtonVariant>, default: "primary" },
    size: { type: String as PropType<ButtonSize>, default: "md" },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    block: { type: Boolean, default: false },
    ariaLabel: { type: String, default: undefined },
    shortcut: { type: String, default: undefined },
    icon: { type: String, default: undefined },
    suffix: { type: String, default: undefined },
    /** Plain-text label, rendered in a `.hk-btn-label` span after the
     *  glyph. Pairs with `collapseLabel`: at wide viewports the button
     *  reads icon + text; below the chosen breakpoint the label hides
     *  and the button collapses to the icon-only square. When set, the
     *  default slot is ignored (one label source per button) and the
     *  accessible name falls back to this text, so the button keeps its
     *  name at breakpoints where the visible label is display:none. */
    label: { type: String, default: undefined },
    /** Breakpoint below which the label hides and the button collapses
     *  to the icon-only square (see `ButtonLabelCollapse`). Requires
     *  `label`; ignored together with `block` (a full-width button has
     *  nothing to collapse into) and with `shortcut` (the shortcut chip
     *  is an extra child the square width would visibly clip — the same
     *  exclusion the icon-only contract applies). */
    collapseLabel: {
      type: String as PropType<ButtonLabelCollapse>,
      default: undefined,
    },
  },
  emits: {
    click: (_e: MouseEvent) => true,
  },
  setup(props, { emit, slots }) {
    const attrs = useAttrs();

    const buttonClass = computed(() => [
      "hk-btn",
      `hk-btn-${props.variant}`,
      `hk-btn-${props.size}`,
      props.block ? "hk-btn-block" : "",
      props.loading ? "hk-btn-loading" : "",
      props.shortcut ? "hk-btn-has-shortcut" : "",
      props.collapseLabel && props.label && !props.block && !props.shortcut
        ? `hk-btn-label-collapse-${props.collapseLabel}`
        : "",
    ]);

    return () => {
      // Icon-only contract (2026-09-10 user direction): a button carrying
      // just a prefix/suffix glyph and no text collapses to the same
      // square footprint the HIconButton family guarantees — a bare icon
      // in a padded text button reads as a squat rectangle otherwise.
      // Re-evaluated per render, NOT a computed: slots.default is not
      // reactive, so a cached flag would go stale when a parent toggles
      // the label slot without touching the icon props. A shortcut chip
      // is excluded: it renders as an extra flex child the fixed square
      // width would visibly clip. A `label` prop counts as text (the
      // responsive collapse handles the narrow end via CSS instead).
      const iconOnly =
        !slots.default &&
        props.label === undefined &&
        Boolean(props.icon || props.suffix) &&
        !props.shortcut;

      return (
        <button
          {...attrs}
          type={(attrs.type as "button" | "submit" | "reset") || "button"}
          disabled={props.disabled || props.loading}
          class={[buttonClass.value, iconOnly ? "hk-btn-icon-only" : "", attrs.class]}
          style={attrs.style || undefined}
          aria-label={props.ariaLabel ?? props.label}
          aria-busy={props.loading || undefined}
          onClick={(e) => emit("click", e)}
        >
          {props.loading ? (
            /* Loading ring as inline SVG + SMIL: renders identically in
               WebView2 hosts where CSS-border rings got lost to border-
               color pipelines or where the animation context suspends CSS
               animations in rAF-starved background windows (user report
               2026-09-16: an empty gap where the login ring should be).
               Stroke follows currentcolor; SMIL rotates independently of
               the CSS animation suspension switch. */
            <svg
              class="hk-btn-ring"
              viewBox="0 0 16 16"
              width="14"
              height="14"
              aria-hidden="true"
            >
              <circle
                cx="8"
                cy="8"
                r="6.5"
                fill="none"
                stroke="currentColor"
                stroke-opacity="0.3"
                stroke-width="1.8"
              />
              <circle
                cx="8"
                cy="8"
                r="6.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-dasharray="30 11"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 8 8"
                  to="360 8 8"
                  dur="0.7s"
                  repeatCount="indefinite"
                />
              </circle>
            </svg>
          ) : null}
          {!props.loading && props.icon ? (
            <span class="hk-btn-icon">
              <HIcon name={props.icon} size={16} />
            </span>
          ) : null}
          {props.label !== undefined && props.label !== "" ? (
            <span class="hk-btn-label">{props.label}</span>
          ) : (
            slots.default?.()
          )}
          {props.suffix ? (
            <span class="hk-btn-suffix">
              <HIcon name={props.suffix} size={16} />
            </span>
          ) : null}
          {props.shortcut ? (
            <HKbd keys={props.shortcut!} size="sm" />
          ) : null}
        </button>
      );
    };
  },
});
