// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { computed, defineComponent, type PropType } from "vue";

import { activeLocale } from "../i18n/context";
import "./HkDateTag.scss";

/**
 * HkDateTag — a locale-aware date capsule: a small pill whose calendar
 * segments are stacked vertically, ONE PER ROW, each centered, ordered
 * the way the ACTIVE hikari locale orders dates (zh: year → month → day
 * top to bottom; en: month → day → year, the year LAST; de: day first …).
 * With the `time` flag a fourth, muted row carries the locale time
 * (hour + minute, 2-digit each).
 *
 * Generic business part (peer of HkTemplateText / HkMarkdownRenderer,
 * NOT of the HkInput family): hosts render compact per-row dates in data
 * tables and cards — wowsp's water-meter ship tables are the first
 * consumer.
 *
 * Contract:
 *  - `value` accepts a Date, an epoch-MILLISECONDS number or a
 *    date-ish string, normalized with `new Date(value)` (so a number is
 *    NEVER seconds — pass what `Date.now()` returns). Unparseable input
 *    renders NOTHING but the empty capsule shell; the caller owns the
 *    empty state.
 *  - The row order is derived from the locale itself, never a hardcoded
 *    locale→order map: `Intl.DateTimeFormat(activeLocale(), { year,
 *    month, day }).formatToParts(date)` supplies the year/month/day
 *    segments in the order that locale writes them. The component is a
 *    computed over the reactive i18n state, so a host `setLocale`
 *    re-orders the rows live.
 *  - `time` (default false) appends the muted time row
 *    (`hk-date-tag__row--time`) under the date rows.
 */
export const HkDateTag = defineComponent({
  name: "HkDateTag",
  props: {
    /** The date to render — Date, epoch milliseconds or a parseable
     * string. Invalid input renders the empty capsule. */
    value: {
      type: [String, Number, Date] as PropType<string | number | Date>,
      required: true,
    },
    /** Append the muted locale time row (hour + minute, 2-digit). */
    time: { type: Boolean, default: false },
  },
  setup(props) {
    const date = computed<Date | null>(() => {
      const d = new Date(props.value);
      return Number.isNaN(d.getTime()) ? null : d;
    });

    // The locale is read through the reactive i18n state (activeLocale
    // reads it on every evaluation), so this computed re-runs — and the
    // rows re-order — whenever the host calls setLocale. One formatter
    // per shape per locale, rebuilt only on a locale/value change (the
    // HkCalendarHeatmap idiom).
    const locale = computed(() => activeLocale());

    /** The year/month/day segments in the locale's own order. */
    const rows = computed<Intl.DateTimeFormatPart[]>(() => {
      const d = date.value;
      if (d === null) return [];
      return new Intl.DateTimeFormat(locale.value, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(d)
        .filter((part) => part.type === "year" || part.type === "month" || part.type === "day");
    });

    /** The locale time (hour + minute, 2-digit) when the capsule opts
     * in — null without `time` or for an invalid date. */
    const timeText = computed<string | null>(() => {
      const d = date.value;
      if (!props.time || d === null) return null;
      return new Intl.DateTimeFormat(locale.value, { hour: "2-digit", minute: "2-digit" }).format(d);
    });

    return () => (
      <span class="hk-date-tag">
        {rows.value.map((part) => (
          <span
            key={part.type}
            class={part.type === "year" ? "hk-date-tag__row hk-date-tag__row--year" : "hk-date-tag__row"}
          >
            {part.value}
          </span>
        ))}
        {timeText.value !== null && (
          <span key="time" class="hk-date-tag__row hk-date-tag__row--time">{timeText.value}</span>
        )}
      </span>
    );
  },
});

export default HkDateTag;
