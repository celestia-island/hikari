import type { CSSProperties } from "vue";

/**
 * The shared container-padding scale — the ONE mechanism behind every
 * container component's `padding` prop (HkPopover's panel, HkCard,
 * HkStatCard, HkModal, HkDrawer, HkAlert, …).
 *
 * The contract has two halves:
 *
 *   1. TOKEN — every container's padding rule reads
 *      `padding: var(--hk-pad, <its legacy default>)`. Setting the
 *      custom property on the element (inline, a utility class, or any
 *      ancestor — custom properties inherit) retunes that container's
 *      content padding without touching its stylesheet; leaving it
 *      unset preserves the component's historical look byte-for-byte.
 *      Because the property is consumed (not a competing declaration),
 *      there is no specificity contest with the component's own rules
 *      or the theme layer.
 *
 *   2. PROP — `padding?: HkPad` on the container maps the named step
 *      onto the token via {@link hkPadStyle} (one inline custom
 *      property), so a call site opts in per instance:
 *      `<HkCard padding="none">…</HkCard>`.
 *
 * The steps ride the house spacing scale (--space-* in
 * styles/theme/scale.scss): none=0, xs=4px, sm=8px, md=12px, lg=16px —
 * the same four steps the popover glass chrome (xs), the settings rows
 * (sm) and the card bodies (lg) already speak.
 */

/** The named padding steps every container's `padding` prop accepts. */
export type HkPad = "none" | "xs" | "sm" | "md" | "lg";

/** The custom property the container padding rules consume. Hosts and
 *  themes may also set it directly (per instance or per subtree). */
export const HK_PAD_VAR = "--hk-pad";

/** Step → the spacing-scale value handed to the token. */
const HK_PAD_VALUE: Record<HkPad, string> = {
  none: "0",
  xs: "var(--space-4, 0.25rem)",
  sm: "var(--space-8, 0.5rem)",
  md: "var(--space-12, 0.75rem)",
  lg: "var(--space-16, 1rem)",
};

/** The inline style carrying the token for one `padding` prop value —
 *  an empty object when the prop is unset (the component keeps its
 *  legacy default). Call sites spread it into their existing style
 *  object: `style={{ …panelStyle.value, …hkPadStyle(props.padding) }}`. */
export function hkPadStyle(pad: HkPad | undefined): CSSProperties {
  return pad ? ({ [HK_PAD_VAR]: HK_PAD_VALUE[pad] } as CSSProperties) : {};
}
