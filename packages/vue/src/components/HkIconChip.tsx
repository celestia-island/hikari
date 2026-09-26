import { defineComponent, h, type Component, type PropType } from "vue";

import type { StatTone } from "./HkStatCard";
import "./HkIconChip.scss";

/**
 * HkIconChip — the standard leading icon chip: a small rounded square
 * painted in a 10% tint of the tone color with the tone color as the
 * glyph ink. This anatomy was copy-pasted as inline styles across the
 * consumers (roster rows, card headers, stat strips) before it became a
 * component; the tone palette is the one HkStatCard owns, so chips always
 * match the stat card's health colors.
 *
 * Purely decorative by contract — the chip is aria-hidden and the icon
 * meaning must be conveyed by adjacent text (row title, card label).
 *
 * ```tsx
 * <HkIconChip icon={Cpu} tone="info" />
 * <HkIconChip icon={Coins} size="sm" />
 * ```
 */
export const HkIconChip = defineComponent({
  name: "HkIconChip",
  props: {
    /** Icon component (lucide-vue-next style). */
    icon: { type: Object as PropType<Component>, required: true },
    /** Tone drives both the tint background and the glyph ink. */
    tone: { type: String as PropType<StatTone>, default: "primary" },
    /** sm = 24px box / 13px glyph, md = 28px box / 15px glyph. */
    size: { type: String as PropType<"sm" | "md">, default: "md" },
  },
  setup(props) {
    return () => (
      <span
        class={["hk-icon-chip", `hk-icon-chip-${props.size}`, `hk-icon-chip-tone-${props.tone}`]}
        aria-hidden="true"
      >
        {h(props.icon, { size: props.size === "sm" ? 13 : 15 })}
      </span>
    );
  },
});
