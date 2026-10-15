import { defineComponent } from "vue";
import { Equal, EqualApproximately, EqualNot } from "lucide-vue-next";

import type { HkFilterOperator } from "./HkFilterPanel";

/**
 * The operator glyph as an ICON, never a text character (user direction
 * 2026-10-15: font stacks render U+2249 ≉ unevenly — the operator
 * buttons are UI chrome, so they draw like every other icon in the
 * family). Lucide ships =, ≠ and ≈; the ordered four and ≉ are
 * hikari-authored in lucide's exact stroke grammar (24×24, stroke 2,
 * currentColor) — ≉ is lucide's own ≈ path pair with EqualNot's slash
 * composed in, so the set reads as one family.
 */

// Lucide's EqualApproximately path pair (ISC, verbatim) + its EqualNot
// slash — composed rather than reinvented.
const NAPPROX_PATHS = [
  "M5 15a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0",
  "M5 9a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0",
  "m5 19 14-14",
];

const CUSTOM: Partial<Record<HkFilterOperator, string[]>> = {
  napprox: NAPPROX_PATHS,
  lt: ["m19 6-11 6 11 6"],
  lte: ["m19 5-11 6 11 6", "M8 20h11"],
  gt: ["m5 6 11 6-11 6"],
  gte: ["m5 5 11 6-11 6", "M5 20h11"],
};

const LUCIDE: Partial<Record<HkFilterOperator, typeof Equal>> = {
  eq: Equal,
  ne: EqualNot,
  approx: EqualApproximately,
};

export default defineComponent({
  name: "HkFilterOperatorIcon",
  props: {
    op: { type: String as () => HkFilterOperator, required: true },
    size: { type: Number, default: 14 },
  },
  setup(props) {
    return () => {
      const Lucide = LUCIDE[props.op];
      if (Lucide) return <Lucide size={props.size} aria-hidden="true" />;
      const paths = CUSTOM[props.op]!;
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={props.size}
          height={props.size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          {paths.map((d) => (
            <path key={d} d={d} />
          ))}
        </svg>
      );
    };
  },
});
