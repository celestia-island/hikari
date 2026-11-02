import { computed, defineComponent, ref, watch, type PropType } from "vue";

import {
  chunkLegendItems,
  donutSlices,
  focusState,
  type HkDonutEntry,
  type HkDonutSlice,
} from "./donutGeometry";
import "./HkDonutChart.scss";

/** Rows per legend column — wowsp's constant (both of its donut families
 *  chunk their legends identically at 5). */
const LEGEND_ROWS_PER_COLUMN = 5;

/** The default fill ladder: the primary token at ten descending mixes —
 *  token-pure (no hex), so theme flips repaint the ring without JS. */
function defaultFill(i: number): string {
  const pct = 100 - (i % 10) * 9;
  return `color-mix(in srgb, var(--color-primary) ${pct}%, var(--hi-color-muted))`;
}

/**
 * HkDonutChart — a donut ring plus a chunked DOM legend.
 *
 * Upstreamed from wowsp's stats + playtime donut families (2026-10 user
 * direction: the apps' best charts become standard hikari business
 * components): path segments on a square viewBox (radius 40%–68%, 12
 * o'clock start, clockwise), legend rows that stack in fixed-height
 * columns with percents shown inline, and paired hover focus —
 * hovering a slice or its legend row lifts the pair and dims the
 * block's siblings without rescaling any shape. A scoped `legendIcon`
 * slot (slice => node) swaps a legend row's text label for a glyph —
 * nation flags, tier marks — keeping the color dot and the row hint.
 *
 * Entries may carry an explicit `color`; absent entries ride the
 * default primary ladder above. Hints ride the consumer's tooltip
 * channel (`data-hint` + `aria-label`; hikari renders no native title
 * bubble). Dumb by design: the caller owns aggregation; all geometry
 * lives in ./donutGeometry (pure, pinned by its own tests).
 *
 * AI-generated (GLM-5.3 via ZCode), 2026-10-31 — SySL-1.0 §2.3.
 */
export default defineComponent({
  name: "HkDonutChart",
  props: {
    /** The slices' source rows; pass count-desc for the wowsp look. */
    entries: { type: Array as PropType<HkDonutEntry[]>, required: true },
    /** Square ring size (px). */
    size: { type: Number, default: 150 },
    /** Legend rows per column. */
    legendRows: { type: Number, default: LEGEND_ROWS_PER_COLUMN },
    showLegend: { type: Boolean, default: true },
    /** Optional center caption inside the ring. */
    centerValue: { type: String, default: null },
    /** Per-slice hover hint; defaults to "label · value · percent". */
    hintOf: {
      type: Function as PropType<(slice: HkDonutSlice) => string>,
      default: null,
    },
    /** Accessible name; defaults to the legend summary. */
    ariaLabel: { type: String, default: null },
    emptyText: { type: String, default: "No data" },
  },
  emits: {
    select: (key: string) => typeof key === "string",
  },
  setup(props, { emit, slots }) {
    const hovered = ref<string | null>(null);
    // A hover key lives on a DOM element; when the entries swap under a
    // held pointer, the hovered element can unmount WITHOUT firing
    // mouseleave (browsers skip removed nodes) — a dead key would dim
    // the whole block until the pointer deliberately re-entered it.
    // Resetting on every entries repaint costs nothing (a resting
    // pointer only ever clears nulls) and can never stick. Lesson
    // upstreamed from wowsp's ShipDistCharts, whose own test pins it.
    watch(
      () => props.entries,
      () => {
        hovered.value = null;
      },
      { deep: true },
    );

    const slices = computed<HkDonutSlice[]>(() =>
      donutSlices(
        props.entries.map((e, i) => ({ ...e, color: e.color ?? defaultFill(i) })),
        { viewBox: props.size },
      ),
    );
    const legendColumns = computed(() => chunkLegendItems(slices.value, props.legendRows));
    const hint = (s: HkDonutSlice): string =>
      props.hintOf ? props.hintOf(s) : `${s.label} · ${s.value} · ${s.percentInt}%`;
    const aria = computed(
      () => props.ariaLabel ?? slices.value.map((s) => `${s.label} ${s.percentInt}%`).join(", "),
    );

    return () => {
      if (slices.value.length === 0) {
        return <div class="hk-donut hk-donut--empty">{props.emptyText}</div>;
      }
      return (
        <div class="hk-donut" role="img" aria-label={aria.value}>
          <div class="hk-donut__ring-wrap">
            <svg class="hk-donut__ring" viewBox={`0 0 ${props.size} ${props.size}`}>
              {slices.value.map((s) => (
                <path
                  key={s.key}
                  class={["hk-donut__slice", focusState(hovered.value, s.key)]}
                  d={s.path}
                  fill={s.fill}
                  data-hint={hint(s)}
                  aria-label={hint(s)}
                  tabindex={0}
                  onMouseenter={() => (hovered.value = s.key)}
                  onMouseleave={() => (hovered.value = null)}
                  onFocus={() => (hovered.value = s.key)}
                  onBlur={() => (hovered.value = null)}
                  onClick={() => emit("select", s.key)}
                />
              ))}
              {props.centerValue ? (
                <text
                  class="hk-donut__center"
                  x={props.size / 2}
                  y={props.size / 2 + 5}
                  text-anchor="middle"
                >
                  {props.centerValue}
                </text>
              ) : null}
            </svg>
          </div>
          {props.showLegend ? (
            <div class="hk-donut__legend">
              {legendColumns.value.map((col, ci) => (
                <div class="hk-donut__legend-col" key={ci}>
                  {col.map((s) => (
                    <div
                      key={s.key}
                      class={["hk-donut__legend-row", focusState(hovered.value, s.key)]}
                      data-hint={hint(s)}
                      onMouseenter={() => (hovered.value = s.key)}
                      onMouseleave={() => (hovered.value = null)}
                      onClick={() => emit("select", s.key)}
                    >
                      <span class="hk-donut__legend-dot" style={{ background: s.fill }} />
                      <span class="hk-donut__legend-label">
                        {/* legendIcon slot: an optional per-slice glyph
                         * (flags, tier marks) rendered IN PLACE of the
                         * text label — the color dot stays, and the row's
                         * data-hint carries the full slice hint either
                         * way (wowsp's NationFlag contract). */}
                        {slots.legendIcon?.(s) ?? s.label}
                      </span>
                      <span class="hk-donut__legend-pct">{s.percentInt}%</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      );
    };
  },
});
