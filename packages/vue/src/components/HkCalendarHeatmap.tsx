import { computed, defineComponent, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import {
  calendarGrid,
  heatmapCellFill,
  heatmapCellOpacity,
  monthMarkers,
  todayIso,
  type CalendarCell,
  type HkCalendarHeatmapDay,
} from "./calendarHeatmap";
import "./HkCalendarHeatmap.scss";

/** The legend's five levels, empty first — the same ladder the cells
 * ride, so the swatches come from the one fill/opacity decision
 * (`heatmapCellFill` / `heatmapCellOpacity`) rather than a second,
 * hand-written copy of the colors. */
const LEGEND_LEVELS = [0, 1, 2, 3, 4] as const;

/** The no-data cell (before the account's first activity / after
 * today): muted diagonal hatch over the surface — the wowsp-style
 * "not yet" cell. Rendered inert: no tooltip, no pointer events. */
const GAP_HATCH =
  "repeating-linear-gradient(45deg, color-mix(in srgb, var(--hi-color-muted) 70%, transparent) 0px, color-mix(in srgb, var(--hi-color-muted) 70%, transparent) 2px, transparent 2px, transparent 4px)";

/** Minimal {name} interpolation for the component's i18n strings — the
 * hikari context serves plain strings (no ICU), the placeholders stay
 * in the locale bundles so translators keep the full sentence. */
function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/**
 * HkCalendarHeatmap — a GitHub-style calendar heatmap of daily values.
 *
 * Upstreamed from the shittim-chest quota page's degree-usage section
 * (2026-10 user direction: a calendar heatmap is a big business
 * component — the rich-text-viewer table — and the leading-month
 * marker refinement belongs in the library, not the consumer). A
 * legend (less → more over the primary token), a Monday-first weekday
 * rail, month markers, and hatched no-data gap cells that never claim
 * a fake zero.
 *
 * The leading month is never mislabeled: a month is labeled on the
 * column that carries its 1st, so a window starting mid-month has no
 * label over its partial head (that month's 1st is not on the axis),
 * and no month lands one column late.
 *
 * Dumb by design: the caller owns the fetch lifecycle and passes the
 * settled dense series in (`days`, oldest → newest, zero-filled,
 * inclusive of today) plus the account's first activity date (`first`,
 * null = never). All math lives in ./calendarHeatmap (pure, pinned by
 * its own tests). The `toolbar` slot rides right of the legend — the
 * consumer's range tabs / controls belong there.
 */
export default defineComponent({
  name: "HkCalendarHeatmap",
  props: {
    /** The dense daily series, oldest → newest, inclusive of today. */
    days: {
      type: Array as PropType<HkCalendarHeatmapDay[]>,
      required: true,
    },
    /** The account's first activity date (null = never). */
    first: { type: String as PropType<string | null>, default: null },
    /** The unit the legend/tooltip names ("" = unitless values). */
    unit: { type: String, default: "" },
    /** Peak day pinned across windows (reaches the cell buckets, not
     * just the data-max attribute); null = derive from `days`. */
    max: { type: Number as PropType<number | null>, default: null },
    /** Square-cell scale (GitHub-scale: a 53-week grid stays compact). */
    cellSize: { type: Number, default: 14 },
    cellGap: { type: Number, default: 3 },
  },
  setup(props, { slots }) {
    const { t } = useI18n();

    // The rendered calendar follows the selected range; `today` is
    // taken per recompute (R2: frozen at setup, a long-mounted
    // component crossing UTC midnight rendered its today cell as an
    // "after" gap until the next remount), and the `max` prop pins the
    // intensity scale — it must reach the buckets, not just the
    // data-max attribute.
    const cells = computed(() =>
      calendarGrid(props.days, todayIso(), props.first, props.max),
    );
    const markers = computed(() => monthMarkers(cells.value));
    const weeks = computed(() => Math.ceil(cells.value.length / 7));
    const max = computed(() =>
      props.max ?? props.days.reduce((m, d) => Math.max(m, d.value), 0),
    );

    const columns = computed(
      () => `repeat(${weeks.value}, ${props.cellSize}px)`,
    );

    // Locale-reactive formatter cache (the HkDateTimePicker convention):
    // ONE Intl.DateTimeFormat per shape per locale, held in a computed
    // over the context's locale — not one per rendered cell, which a
    // full-year grid would pay ~370 times over. All formatters format
    // the UTC midnight instant WITH an explicit UTC zone (R2: on a
    // negative-offset host the weekday rail shifted a full row and
    // tooltips landed a day off — the series' day boundary is UTC).
    const locale = computed(() => useI18n().locale);
    const formatters = computed(() => {
      const loc = locale.value;
      return {
        weekday: new Intl.DateTimeFormat(loc, { weekday: "short", timeZone: "UTC" }),
        month: new Intl.DateTimeFormat(loc, { month: "short", timeZone: "UTC" }),
        date: new Intl.DateTimeFormat(loc, { dateStyle: "medium", timeZone: "UTC" }),
      };
    });
    const weekdayLabel = (idx: number) =>
      formatters.value.weekday.format(
        // Any Monday-first week works — take 2024-01-01 (a Monday).
        new Date(Date.UTC(2024, 0, 1 + idx)),
      );
    const monthLabel = (m: string) => {
      if (!m) return "";
      return formatters.value.month.format(
        new Date(Date.UTC(2024, Number(m) - 1, 1)),
      );
    };
    const dateLabel = (iso: string) =>
      formatters.value.date.format(new Date(`${iso}T00:00:00Z`));

    const cellTitle = (d: Extract<CalendarCell, { kind: "day" }>) =>
      fill(
        props.unit
          ? t("hikari::calendarHeatmap.cellTitle", "{date} · {n} {unit}")
          : t("hikari::calendarHeatmap.cellTitleNoUnit", "{date} · {n}"),
        { date: dateLabel(d.date), n: d.value, unit: props.unit },
      );

    const cellStyle = (cell: CalendarCell) =>
      cell.kind === "gap"
        ? {
            borderRadius: "3px",
            background: GAP_HATCH,
            pointerEvents: "none" as const,
          }
        : {
            borderRadius: "3px",
            background: heatmapCellFill(cell.level),
            opacity: heatmapCellOpacity(cell.level),
          };

    // A marker may overflow its 14px column into the empty columns
    // ahead (the GitHub convention — a month label is always followed
    // by unmarked columns). A marker on the LAST column has nothing
    // ahead: its ink would be clipped by the scroll container, so that
    // one case reserves inline-end room for it. The logical property
    // matters: hikari ships RTL hosts (HkMenu reads
    // documentElement.dir), and there the label runs the other way.
    const markersTrailingPad = computed(() => {
      const m = markers.value;
      return m.length > 0 && m[m.length - 1] !== ""
        ? `${props.cellSize * 2 + props.cellGap}px`
        : undefined;
    });

    return () => (
      <div class="hk-calendar-heatmap">
        {/* The legend row: the scale in the caller's one unit on the
         * LEFT, the toolbar slot on the RIGHT — the strip belongs to
         * the centered grid's tail (2026-10-15 chest user direction,
         * carried upstream with the component). */}
        <div class="hk-calendar-heatmap-head">
          <span
            class="hk-calendar-heatmap-legend"
            data-testid="hk-calendar-heatmap-legend"
          >
            {t("hikari::calendarHeatmap.less", "Less")}
            {LEGEND_LEVELS.map((level) => (
              <span
                key={level}
                data-legend-level={level}
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  background: heatmapCellFill(level),
                  opacity: heatmapCellOpacity(level),
                  display: "inline-block",
                }}
              />
            ))}
            {t("hikari::calendarHeatmap.more", "More")}
          </span>
          {slots.toolbar?.({})}
        </div>

        {/* The scroll wrapper centers the whole calendar (rail included)
         * on wide cards while letting narrow screens scroll from the
         * left edge (see the SCSS). */}
        <div class="hk-calendar-heatmap-scroll">
          <div class="hk-calendar-heatmap-body">
            {/* Weekday rail: the first (Monday) and last (Sunday) rows
             * carry the labels, the wowsp convention. */}
            <div
              aria-hidden="true"
              class="hk-calendar-heatmap-rail"
              style={{ rowGap: `${props.cellGap}px` }}
            >
              {[0, 1, 2, 3, 4, 5, 6].map((row) => (
                <span
                  key={row}
                  style={{ height: `${props.cellSize}px`, lineHeight: `${props.cellSize}px` }}
                >
                  {row === 0 || row === 6 ? weekdayLabel(row) : ""}
                </span>
              ))}
            </div>

            <div class="hk-calendar-heatmap-cells">
              {/* Month markers, one slot per week column. A month is
               * labeled on the column carrying its 1st; a partial head
               * month therefore renders an empty slot (see
               * monthMarkers). */}
              <div
                class="hk-calendar-heatmap-markers"
                style={{
                  gridTemplateColumns: columns.value,
                  columnGap: `${props.cellGap}px`,
                  paddingInlineEnd: markersTrailingPad.value,
                }}
              >
                {markers.value.map((m, i) => (
                  <span key={i}>{monthLabel(m)}</span>
                ))}
              </div>

              {/* The grid itself: cells flow column-first into 7 rows. */}
              <div
                data-testid="hk-calendar-heatmap"
                data-max={max.value}
                role="img"
                aria-label={fill(
                  t(
                    "hikari::calendarHeatmap.summary",
                    "Daily usage across {weeks} weeks",
                  ),
                  { weeks: weeks.value },
                )}
                class="hk-calendar-heatmap-grid"
                style={{
                  gridTemplateColumns: columns.value,
                  gridTemplateRows: `repeat(7, ${props.cellSize}px)`,
                  gridAutoFlow: "column",
                  gap: `${props.cellGap}px`,
                }}
              >
                {cells.value.map((cell, i) => (
                  <span
                    key={i}
                    {...(cell.kind === "gap"
                      ? {
                          "data-gap": cell.phase,
                          "data-date": cell.date,
                          "aria-hidden": "true",
                        }
                      : {
                          "data-level": cell.level,
                          "data-date": cell.date,
                          title: cellTitle(cell),
                        })}
                    style={cellStyle(cell)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
});
