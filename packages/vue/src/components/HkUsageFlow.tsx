// HkUsageFlow — the usage-distribution business component: three-stage
// Sankey (caller → upstream → model) plus the registered-model legend.
//
// Upstreamed for the arona console / shittim-chest admin panels' "model
// usage distribution" view (2026-11-17 user direction: one statistics
// component in hikari, both admin surfaces show the same picture). The
// component is DUMB by design — the host owns fetching, metric selection
// (tokens / requests / cost) and locale strings; this file only renders
// settled rows through ./usageFlowLayout (pure, pinned by its own tests).
//
// DOM contract (kept stable for the Rust mirror when it lands):
//
//   div.hk-usage-flow
//     div.hk-usage-flow__body                       (with data)
//       svg.hk-usage-flow__chart[role=img][aria-label][viewBox]
//         path.hk-usage-flow__ribbon[data-hint]      (one per link, fill = target)
//         g.hk-usage-flow__node                     (one per node)
//           rect.hk-usage-flow__bar[fill][data-hint]
//           text.hk-usage-flow__label[.hk-usage-flow__label--others]
//                                                    (omitted when the bar is
//                                                     too short to label)
//       ul.hk-usage-flow__legend                    (showLegend)
//         li.hk-usage-flow__legend-row[.hk-usage-flow__legend-row--idle]
//           span.hk-usage-flow__legend-swatch
//           span.hk-usage-flow__legend-label
//           span.hk-usage-flow__legend-value
//           span.hk-usage-flow__legend-pct
//     div.hk-usage-flow__empty                      (no positive rows)
//
// Hover hints ride the consumer's own tooltip channel (`data-hint`), the
// HkBarChart/HkDonutChart convention — no native title bubble, no chart
// library, no measurement API (the viewBox scales the frame; label text is
// sized in SVG units so hosts pick a width that matches their column).
// The `<svg role="img">` owns the accessible name (its aria-label is the
// legend's share summary); per-bar aria-labels are deliberately absent —
// an img-role subtree is presentational, so they would be dead markup.
// The legend list below the chart is real text and is the accessible
// breakdown.
//
// AI-generated (DeepSeek V4.1 via DeepSeek Harness), 2026-11-17 — SySL-1.0 §2.3.

import { computed, defineComponent, type PropType } from "vue";

import { asPropType } from "../utils/typing";
import {
  formatFlowPercent,
  usageFlowLayout,
  type HkUsageFlowLayout,
  type HkUsageFlowRosterEntry,
  type HkUsageFlowRow,
} from "./usageFlowLayout";
import "./HkUsageFlow.scss";

/** Gap between a node bar and its label, in SVG units. */
const LABEL_GAP = 6;

export default defineComponent({
  name: "HkUsageFlow",
  props: {
    /** Settled aggregate rows: caller → upstream → model → metric value.
     *  The caller owns aggregation (one row per distinct triple). */
    rows: { type: asPropType<HkUsageFlowRow[]>(Array), required: true },
    /** The complete registered-model roster. Roster order fixes the model
     *  colours, so an idle model keeps its swatch; idle models still get a
     *  greyed legend row. Models that served traffic without a roster row
     *  are appended after it. */
    models: { type: asPropType<HkUsageFlowRosterEntry[] | null>(Array), default: null },
    /** Value formatter for legend numbers and hints. Absent = the runtime
     *  locale's `toLocaleString()` — hosts that pin a locale pass their own
     *  formatter (the admin panels do). */
    formatValue: {
      type: Function as PropType<(value: number) => string>,
      default: null,
    },
    /** Frame width in SVG units (the viewBox; CSS scales it to the host). */
    width: { type: Number, default: 960 },
    /** Frame height in SVG units. */
    height: { type: Number, default: 420 },
    /** Per-column node cap; the tail folds into one `othersLabel` bucket. */
    maxNodes: { type: Number, default: 10 },
    /** Label for the collapsed bucket (host-localized; e.g. 其他 / Others). */
    othersLabel: { type: String, default: "Others" },
    /** Label truncation budget in character units (CJK counts 2). */
    labelMaxChars: { type: Number, default: 28 },
    /** Colour ladder override (theme-token expressions); absent = the
     *  built-in semantic ladder. */
    colors: { type: asPropType<readonly string[] | null>(Array), default: null },
    showLegend: { type: Boolean, default: true },
    emptyText: { type: String, default: "No data" },
    /** Accessible summary; absent = the legend's own share summary. */
    ariaLabel: { type: String, default: null },
  },
  setup(props) {
    const format = (value: number): string =>
      props.formatValue ? props.formatValue(value) : value.toLocaleString();

    const layout = computed<HkUsageFlowLayout>(() =>
      usageFlowLayout(props.rows ?? [], {
        width: props.width,
        height: props.height,
        maxNodes: props.maxNodes,
        othersLabel: props.othersLabel,
        models: props.models ?? [],
        colors: props.colors ?? undefined,
        labelMaxChars: props.labelMaxChars,
      }),
    );

    /** Label anchor per column: the first two columns label to the RIGHT of
     *  their bar, the model column labels to the LEFT (the d3-sankey
     *  convention the design reference uses — the last bar sits at the
     *  frame's right edge so its labels have the room). */
    const labelX = (node: { column: number; x: number; width: number }): number =>
      node.column === 2 ? node.x - LABEL_GAP : node.x + node.width + LABEL_GAP;
    const labelAnchor = (column: number): "start" | "end" =>
      column === 2 ? "end" : "start";

    const nodeHint = (node: { fullLabel: string; value: number }): string =>
      `${node.fullLabel} · ${format(node.value)}`;

    /** One keyed lookup per render — not two linear scans per link. */
    const nodeByKey = computed(() => {
      const map = new Map<string, { fullLabel: string }>();
      for (const node of layout.value.nodes) map.set(node.key, node);
      return map;
    });
    const linkHint = (link: { sourceKey: string; targetKey: string; value: number }): string => {
      const from = nodeByKey.value.get(link.sourceKey);
      const to = nodeByKey.value.get(link.targetKey);
      return `${from?.fullLabel ?? "?"} → ${to?.fullLabel ?? "?"} · ${format(link.value)}`;
    };

    const aria = computed(() => {
      if (props.ariaLabel) return props.ariaLabel;
      const shares = layout.value.legend
        .filter((row) => !row.idle)
        .map((row) => `${row.label} ${formatFlowPercent(row.percent)}`)
        .join(", ");
      return shares || props.emptyText;
    });

    return () => {
      const model = layout.value;
      if (model.empty) {
        // No measured rows: the honest empty face — plus the roster table
        // when the host supplied one, so "all registered models" is still
        // answerable (every row reads 0 / idle).
        return (
          <div
            class="hk-usage-flow hk-usage-flow--empty"
            role="status"
            aria-label={props.ariaLabel ?? undefined}
          >
            <div class="hk-usage-flow__empty">{props.emptyText}</div>
            {props.showLegend && model.legend.length > 0 ? (
              <ul class="hk-usage-flow__legend">
                {model.legend.map((row) => (
                  <li
                    key={row.label}
                    class={["hk-usage-flow__legend-row", { "hk-usage-flow__legend-row--idle": row.idle }]}
                    data-hint={`${row.label} · ${format(row.value)} · ${formatFlowPercent(row.percent)}`}
                  >
                    <span
                      class="hk-usage-flow__legend-swatch"
                      style={{ background: row.color }}
                      aria-hidden="true"
                    />
                    <span class="hk-usage-flow__legend-label">{row.label}</span>
                    <span class="hk-usage-flow__legend-value">{format(row.value)}</span>
                    <span class="hk-usage-flow__legend-pct">0%</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      }
      return (
        <div class="hk-usage-flow">
          <div class="hk-usage-flow__body">
            <svg
              class="hk-usage-flow__chart"
              viewBox={`0 0 ${model.width} ${model.height}`}
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label={aria.value}
            >
              {model.links.map((link) => (
                <path
                  key={link.key}
                  class="hk-usage-flow__ribbon"
                  d={link.path}
                  fill={link.color}
                  data-hint={linkHint(link)}
                />
              ))}
              {model.nodes.map((node) => (
                <g class="hk-usage-flow__node" key={node.key}>
                  <rect
                    class="hk-usage-flow__bar"
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx={2}
                    fill={node.color}
                    data-hint={nodeHint(node)}
                  />
                  {node.labelVisible ? (
                    <text
                      class={[
                        "hk-usage-flow__label",
                        { "hk-usage-flow__label--others": node.others },
                      ]}
                      x={labelX(node)}
                      y={node.y + node.height / 2 + 4}
                      text-anchor={labelAnchor(node.column)}
                    >
                      {node.label}
                    </text>
                  ) : null}
                </g>
              ))}
            </svg>
            {props.showLegend ? (
              <ul class="hk-usage-flow__legend">
                {model.legend.map((row) => (
                  <li
                    key={row.label}
                    class={[
                      "hk-usage-flow__legend-row",
                      { "hk-usage-flow__legend-row--idle": row.idle },
                    ]}
                    data-hint={`${row.label} · ${format(row.value)} · ${formatFlowPercent(row.percent)}`}
                  >
                    <span
                      class="hk-usage-flow__legend-swatch"
                      style={{ background: row.color }}
                      aria-hidden="true"
                    />
                    <span class="hk-usage-flow__legend-label">{row.label}</span>
                    <span class="hk-usage-flow__legend-value">{format(row.value)}</span>
                    <span class="hk-usage-flow__legend-pct">{formatFlowPercent(row.percent)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      );
    };
  },
});
