import { computed, defineComponent, h, type PropType, type VNode } from "vue";

import { barLayout, type BarSlot } from "./barChart";
import "./HkBarChart.scss";

/** One bar entry. */
export interface HkBarChartBar {
  /** Text label under the slot — also the bar's aria string, even when
   * an `icon` replaces the visible text. */
  label: string;
  value: number;
  /** Hover/focus hint; defaults to `label: formatValue(value)`. */
  hint?: string;
  /** Optional slot mark rendered IN PLACE of the x-label text (the tier
   * histogram's supership Star). Accepts EITHER a component (a lucide
   * icon function, a defineComponent options object) or a prebuilt
   * vnode — normalized exactly like HkPillToggleGroup's icon handling;
   * anything else falls back to the text label (never a blank slot). */
  icon?: unknown;
}

/** Normalize a bar icon to a renderable vnode — the HkPillToggleGroup
 * convention verbatim: a component (function or options object) is
 * instantiated with `h`; a prebuilt vnode passes through; anything
 * else (string, number, null) renders nothing, and the caller falls
 * back to the text label. */
function resolveIcon(icon: unknown): VNode | null {
  if (icon == null) return null;
  if (typeof icon === "object") return icon as VNode;
  if (typeof icon === "function") return h(icon as Parameters<typeof h>[0]);
  return null;
}

/** The slot-mark box (wowsp's tier-star convention): lucide glyphs draw
 * in a 24×24 box, so the wrapper nested <svg> maps that box onto a
 * 12-unit mark centered on the x-label's optical center — the 10-unit
 * text's baseline is baselineY + 14 and its glyph box spans
 * ≈ baselineY + 6 … + 14, so a mark from +4 to +16 shares its center. */
const BAR_MARK = { glyphBox: 24, size: 12, top: 4 } as const;

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
 * The tier histogram's needs ride along as OPTIONAL props (wowsp
 * ShipDistCharts): `showValues` paints formatValue(value) above each
 * bar (empty slots carry no label), `hover` + `activeIndex` implement a
 * dim-pair — the HOST wires activeIndex from the hover events, the bar
 * at activeIndex carries `data-hot` and every other bar `data-dim` —
 * and a bar's `icon` replaces its x-label text (the supership slot's
 * nested-svg Star, positioned/sized here from the 24-unit lucide box).
 * Defaults reproduce the old output exactly.
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
      type: Array as PropType<HkBarChartBar[]>,
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
    /** Paint formatValue(value) as a small label ABOVE each bar. Skip
     * rule: bars with value <= 0 carry NO label (their slot stays an
     * empty slot) — the wowsp tier histogram's old labelY-null behavior,
     * so an unplayed bucket never shows a stray "0". */
    showValues: { type: Boolean, default: false },
    /** The dim-pair head: when set, the bar at this index carries
     * `data-hot` (kept hover lift) and every other bar carries
     * `data-dim` (≈0.45 opacity). The HOST implements the pair by
     * wiring this from the `hover` events; null (the default) draws no
     * pair at all. */
    activeIndex: { type: Number as PropType<number | null>, default: null },
  },
  emits: {
    /** A bar was clicked (its bucket index). */
    select: (index: number) => typeof index === "number",
    /** The pointer entered a bar (its bucket index) or left it / the
     * keyboard focus moved onto or off one (focus/blur parity — null
     * when the hover ended). */
    hover: (index: number | null) => typeof index === "number" || index === null,
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
    /** The dim-pair head, normalized: anything but a number (undefined,
     * null, garbage) means "no pair". */
    const active = computed(() =>
      typeof props.activeIndex === "number" ? props.activeIndex : null,
    );
    const hintOf = (b: HkBarChartBar, i: number): string =>
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
          {l.bars.map((s: BarSlot, i: number) => {
            const bar = props.bars[i];
            const mark = resolveIcon(bar.icon);
            return (
              <g key={i}>
                {s.path ? (
                  <path
                    class="hk-bar-chart__bar"
                    d={s.path}
                    data-hint={hintOf(bar, i)}
                    aria-label={hintOf(bar, i)}
                    tabindex={0}
                    data-hot={active.value === i || undefined}
                    data-dim={(active.value !== null && active.value !== i) || undefined}
                    onClick={() => emit("select", i)}
                    onMouseenter={() => emit("hover", i)}
                    onMouseleave={() => emit("hover", null)}
                    onFocus={() => emit("hover", i)}
                    onBlur={() => emit("hover", null)}
                  />
                ) : null}
                {props.showValues && s.labelY != null ? (
                  <text class="hk-bar-chart__value" x={s.centerX} y={s.labelY}>
                    {props.formatValue(bar.value)}
                  </text>
                ) : null}
                {mark != null ? (
                  // The slot mark (the supership's Star): a nested <svg>
                  // wrapper maps the icon's 24-unit glyph box onto a
                  // 12-unit mark centered on the x-label's optical
                  // center — positioned HERE so the consumer passes a
                  // bare lucide component and knows no geometry. Ink
                  // (currentColor) lives in SCSS.
                  <svg
                    class="hk-bar-chart__xmark"
                    x={s.centerX - BAR_MARK.size / 2}
                    y={l.baselineY + BAR_MARK.top}
                    width={BAR_MARK.size}
                    height={BAR_MARK.size}
                    viewBox={`0 0 ${BAR_MARK.glyphBox} ${BAR_MARK.glyphBox}`}
                    aria-hidden="true"
                  >
                    {mark}
                  </svg>
                ) : (
                  <text class="hk-bar-chart__x" x={s.centerX} y={l.baselineY + 14}>
                    {bar.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      );
    };
  },
});
