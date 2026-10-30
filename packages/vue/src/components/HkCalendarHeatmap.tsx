import { computed, defineComponent, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import {
  bucketLevel,
  calendarGrid,
  HEATMAP_LEVEL_OPACITY,
  monthMarkers,
  todayIso,
  type CalendarCell,
  type HkCalendarHeatmapDay,
} from "./calendarHeatmap";
import "./HkCalendarHeatmap.scss";

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
 * The leading month is suppressed when the window starts mid-month:
 * the first column shows only the tail of its month, so the marker is
 * rendered only when the grid's first column actually opens its month
 * (Monday = the 1st) — a label over a partial head would claim a
 * month start that is not visible.
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
    /** Peak day of the window; null = derive from `days`. */
    max: { type: Number as PropType<number | null>, default: null },
    /** Square-cell scale (GitHub-scale: a 53-week grid stays compact). */
    cellSize: { type: Number, default: 14 },
    cellGap: { type: Number, default: 3 },
  },
  setup(props, { slots }) {
    const { t } = useI18n();

    const today = todayIso();
    const cells = computed(() => calendarGrid(props.days, today, props.first));
    const markers = computed(() => monthMarkers(cells.value));
    const weeks = computed(() => Math.ceil(cells.value.length / 7));
    const max = computed(() =>
      props.max ?? props.days.reduce((m, d) => Math.max(m, d.value), 0),
    );

    const columns = computed(
      () => `repeat(${weeks.value}, ${props.cellSize}px)`,
    );

    // Locale-reactive (the HkDateTimePicker convention): a computed
    // over the context's locale so a locale switch re-renders the
    // calendar's Intl-formatted labels.
    const locale = computed(() => useI18n().locale);
    const weekdayLabel = (idx: number) =>
      new Intl.DateTimeFormat(locale.value, { weekday: "short" }).format(
        // Any Monday-first week works — take 2024-01-01 (a Monday).
        new Date(Date.UTC(2024, 0, 1 + idx)),
      );
    const monthLabel = (m: string) => {
      if (!m) return "";
      return new Intl.DateTimeFormat(locale.value, { month: "short" }).format(
        new Date(Date.UTC(2024, Number(m) - 1, 1)),
      );
    };
    const dateLabel = (iso: string) =>
      new Intl.DateTimeFormat(locale.value, { dateStyle: "medium" }).format(
        new Date(`${iso}T00:00:00Z`),
      );

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
            background:
              cell.level === 0
                ? "color-mix(in srgb, var(--hi-color-muted) 40%, transparent)"
                : "var(--hi-color-primary)",
            opacity: cell.level === 0 ? undefined : HEATMAP_LEVEL_OPACITY[cell.level],
          };

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
            {HEATMAP_LEVEL_OPACITY.map((o, i) => (
              <span
                key={i}
                data-legend-level={i}
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  background:
                    i === 0
                      ? "color-mix(in srgb, var(--hi-color-muted) 40%, transparent)"
                      : "var(--hi-color-primary)",
                  opacity: i === 0 ? undefined : o,
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
              {/* Month markers, one slot per week column. A leading
               * partial month renders its empty slot (see
               * monthMarkers). */}
              <div
                class="hk-calendar-heatmap-markers"
                style={{
                  gridTemplateColumns: columns.value,
                  columnGap: `${props.cellGap}px`,
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
