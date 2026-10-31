import { computed, defineComponent, type PropType } from "vue";

import { barLayout, type BarSlot } from "./barChart";
import "./HkBarChart.scss";

/**
 * HkBarChart — one bar per bucket over a hand-drawn declarative SVG (no
 * chart library; the HkTreemap/HkCalendarHeatmap dependency-free line).
 *
 * Upstreamed from wowsp's playtime trend chart (2026-10 user direction:
 * the apps' best charts become standard hikari business components).
 * Gridlines at 0 / half / a nice max, x labels under every bar, ink
 * styled in SCSS from theme tokens so scheme flips repaint without a
 * re-render, and hover hints through the consumer's own tooltip channel
 * (`hint` lands in both `aria-label` and the `data-hint` attribute the
 * wowsp delegated-tooltip hook reads — hikari itself renders no native
 * title bubble).
 *
 * Dumb by design: the caller owns aggregation and passes the settled
 * buckets in. All geometry lives in ./barChart (pure, pinned by its own
 * tests).
 *
 * AI-generated (GLM-5.3 via ZCode), 2026-10-31 — SySL-1.0 §2.3.
 */
export default defineComponent({
  name: "HkBarChart",
  props: {
    /** The bars, in axis order (oldest → newest for trend charts). */
    bars: {
      type: Array as PropType<{ label: string; value: number; hint?: string }[]>,
      required: true,
    },
    /** Frame size (the SVG viewBox; CSS scales it). */
    width: { type: Number, default: 640 },
    height: { type: Number, default: 220 },
    /** Value formatter for the axis guides and the aria label. */
    formatValue: {
      type: Function as PropType<(v: number) => string>,
      default: (v: number) => String(Math.round(v)),
    },
    /** Accessible name for the whole chart; defaults to a value summary. */
    ariaLabel: { type: String, default: null },
    /** Rendered when every bucket is zero / the array is empty. */
    emptyText: { type: String, default: "No data" },
  },
  emits: {
    /** A bar was clicked (its bucket index). */
    select: (index: number) => typeof index === "number",
  },
  setup(props, { emit }) {
    const layout = computed(() =>
      barLayout(props.bars.map((b) => b.value), {
        width: props.width,
        height: props.height,
      }),
    );
    const empty = computed(() => props.bars.every((b) => !(b.value > 0)));
    const aria = computed(
      () =>
        props.ariaLabel ??
        props.bars.map((b) => `${b.label} ${props.formatValue(b.value)}`).join(", "),
    );
    const hintOf = (b: { label: string; value: number; hint?: string }, i: number): string =>
      b.hint ?? `${b.label}: ${props.formatValue(b.value)}`;

    return () => {
      if (empty.value) {
        return <div class="hk-bar-chart hk-bar-chart--empty">{props.emptyText}</div>;
      }
      const l = layout.value;
      return (
        <svg
          class="hk-bar-chart"
          viewBox={`0 0 ${l.width} ${l.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={aria.value}
        >
          {l.gridlines.map((g) => (
            <g key={g.value}>
              <line
                class="hk-bar-chart__grid"
                x1={l.sidePad}
                y1={g.y}
                x2={l.width - 8}
                y2={g.y}
              />
              <text class="hk-bar-chart__axis" x={l.sidePad - 6} y={g.y + 3}>
                {props.formatValue(g.value)}
              </text>
            </g>
          ))}
          {l.bars.map((s: BarSlot, i: number) => (
            <g key={i}>
              {s.path ? (
                <path
                  class="hk-bar-chart__bar"
                  d={s.path}
                  data-hint={hintOf(props.bars[i], i)}
                  aria-label={hintOf(props.bars[i], i)}
                  tabindex={0}
                  onClick={() => emit("select", i)}
                />
              ) : null}
              <text class="hk-bar-chart__x" x={s.centerX} y={l.baselineY + 14}>
                {props.bars[i].label}
              </text>
            </g>
          ))}
        </svg>
      );
    };
  },
});
