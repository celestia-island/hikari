import { defineComponent, type PropType } from "vue";

import "./HkCornerText.scss";

/** One entry of a corner text lane: plain text, or a link when `href`
 *  is set (registry links open in a new tab with `noopener`, the same
 *  contract as the beian filings). */
export interface HkCornerTextEntry {
  /** Stable identity for the list renderer. */
  key: string;
  /** Display text (an ICP filing number, a system name, …). */
  text: string;
  /** Link target. Set = the entry renders as an `<a target="_blank">`;
   *  unset = a plain `<span>`. */
  href?: string;
}

/**
 * HkCornerText — chrome text for the six corners of a header/footer
 * (2026-11-26 user direction: the band's text lanes had drifted into
 * per-app flex wrappers that squeezed whole compliance lines onto one
 * `nowrap` row or clipped a second row outside a fixed-height band).
 *
 * One instance is ONE text lane for one corner. The lane:
 *
 * - aligns itself to its corner — `align: "start" | "center" | "end"`
 *   covers all six slots (header/footer × left/center/right): the items
 *   justify to that edge and WRAPPED lines keep aligning to it, so a
 *   right-corner lane that wraps still hugs the right edge;
 * - wraps BETWEEN entries, never inside one: each entry is a
 *   `white-space: nowrap` atom (a filing number must never break
 *   mid-sequence — the 2026-11-25 wrap bug), and the lane flows its
 *   atoms onto as many rows as the corner's width allows;
 * - is chrome-quiet by default: `text-2xs`, muted ink (`muted: false`
 *   restores full ink for a corner that needs emphasis);
 * - stacks: several instances in a column form the rows of one corner
 *   (identity line above the filings line), each keeping the corner's
 *   alignment — the fixed 3rem status band holds two such rows (the
 *   version pill's double-row grid proves the geometry).
 *
 * Content comes either as the structured `items` list (text/href
 * entries — filings, links) or as the default slot (arbitrary inline
 * children — a status chip riding the same lane). Both combine; `items`
 * render before the slot children. `as: "nav"` + `ariaLabel` marks a
 * lane that is a group of links (the compliance filings).
 *
 * ```tsx
 * <HkCornerText align="center">…identity…</HkCornerText>
 * <HkCornerText
 *   align="center"
 *   as="nav"
 *   ariaLabel="Beian"
 *   items={[{ key: "icp", text: "苏ICP备…", href: "https://beian.miit.gov.cn/" }]}
 * />
 * ```
 */
export const HkCornerText = defineComponent({
  name: "HkCornerText",
  props: {
    /** Which corner this lane sits in: `start` = left corners,
     *  `center` = the middle lane, `end` = right corners. Drives both
     *  the flex justification and the text alignment of wrapped rows. */
    align: {
      type: String as PropType<"start" | "center" | "end">,
      default: "start",
    },
    /** Structured entries rendered before the slot children. */
    items: {
      type: Array as PropType<HkCornerTextEntry[]>,
      default: () => [],
    },
    /** Root tag: `nav` marks a lane of links (compliance filings) for
     *  assistive tech; pair it with `ariaLabel`. */
    as: {
      type: String as PropType<"div" | "nav">,
      default: "div",
    },
    /** Accessible name for the `nav` landmark. */
    ariaLabel: { type: String, default: undefined },
    /** Muted chrome ink (the default). Pass false for a corner whose
     *  text must carry full ink. */
    muted: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    return () => {
      const entries = props.items.map((entry) =>
        entry.href ? (
          <a
            key={entry.key}
            class="hk-corner-text-entry"
            data-link="true"
            href={entry.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {entry.text}
          </a>
        ) : (
          <span key={entry.key} class="hk-corner-text-entry">
            {entry.text}
          </span>
        ),
      );
      const slotContent = slots.default?.();
      const empty = entries.length === 0 && !slotContent;
      if (empty) return null;
      const Tag = props.as;
      return (
        <Tag
          class="hk-corner-text"
          data-align={props.align}
          data-muted={props.muted ? "true" : undefined}
          aria-label={props.as === "nav" && props.ariaLabel ? props.ariaLabel : undefined}
        >
          {entries}
          {slotContent}
        </Tag>
      );
    };
  },
});

export default HkCornerText;
