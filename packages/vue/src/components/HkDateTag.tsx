// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { computed, defineComponent, type PropType } from "vue";

import { activeLocale } from "../i18n/context";
import "./HkDateTag.scss";

/**
 * HkDateTag — a locale-aware date pill: ONE horizontal line whose
 * calendar segments read in the order the ACTIVE hikari locale writes
 * dates (zh: 2024/10/06 — year first; en: 10/06/2024 — the year LAST;
 * de: 06.10.2024 — day first), joined by that locale's own literal
 * separators. With the `time` flag a fourth, muted segment carries the
 * locale time (hour + minute, 2-digit) after a blank separator.
 *
 * Generic business part (peer of HkTemplateText / HkMarkdownRenderer,
 * NOT of the HkInput family): hosts render compact per-row dates in
 * data tables and cards — wowsp's water-meter ship tables are the
 * first consumer.
 *
 * Contract:
 *  - `value` accepts a Date, an epoch-MILLISECONDS number or a
 *    date-ish string, normalized with `new Date(value)` (so a number is
 *    NEVER seconds — pass what `Date.now()` returns). Unparseable input
 *    renders NOTHING but the empty pill shell; the caller owns the
 *    empty state.
 *  - The segment order AND the separators come from the locale itself,
 *    never a hardcoded locale→layout map:
 *    `Intl.DateTimeFormat(activeLocale(), { year, month, day })
 *    .formatToParts(date)` supplies the year/month/day segments and
 *    the literal separators in the order that locale writes them. The
 *    component is a computed over the reactive i18n state, so a host
 *    `setLocale` re-orders the line live.
 *  - `time` (default false) appends the muted time segment
 *    (`hk-date-tag__seg--time`) after a blank separator.
 */
export const HkDateTag = defineComponent({
  name: "HkDateTag",
  props: {
    /** The date to render — Date, epoch milliseconds or a parseable
     * string. Invalid input renders the empty pill. */
    value: {
      type: [String, Number, Date] as PropType<string | number | Date>,
      required: true,
    },
    /** Append the muted locale time segment (hour + minute, 2-digit). */
    time: { type: Boolean, default: false },
  },
  setup(props) {
    const date = computed<Date | null>(() => {
      const d = new Date(props.value);
      return Number.isNaN(d.getTime()) ? null : d;
    });

    // The locale is read through the reactive i18n state (activeLocale
    // reads it on every evaluation), so this computed re-runs — and the
    // line re-orders — whenever the host calls setLocale. One formatter
    // per shape per locale, rebuilt only on a locale/value change (the
    // HkCalendarHeatmap idiom).
    const locale = computed(() => activeLocale());

    /** Every format part — the year/month/day segments interleaved
     * with the locale's own literal separators. */
    const parts = computed<Intl.DateTimeFormatPart[]>(() => {
      const d = date.value;
      if (d === null) return [];
      return new Intl.DateTimeFormat(locale.value, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
    });

    /** The locale time (hour + minute, 2-digit) when the pill opts
     * in — null without `time` or for an invalid date. */
    const timeText = computed<string | null>(() => {
      const d = date.value;
      if (!props.time || d === null) return null;
      return new Intl.DateTimeFormat(locale.value, { hour: "2-digit", minute: "2-digit" }).format(d);
    });

    return () => (
      <span class="hk-date-tag">
        {parts.value.map((part, index) =>
          part.type === "literal" ? (
            part.value ? (
              <span key={`sep-${index}`} class="hk-date-tag__sep">
                {part.value}
              </span>
            ) : null
          ) : (
            <span
              key={part.type}
              class={part.type === "year" ? "hk-date-tag__seg hk-date-tag__seg--year" : "hk-date-tag__seg"}
            >
              {part.value}
            </span>
          ),
        )}
        {timeText.value !== null && (
          <span key="time-sep" class="hk-date-tag__sep">
            {" "}
          </span>
        )}
        {timeText.value !== null && (
          <span key="time" class="hk-date-tag__seg hk-date-tag__seg--time">
            {timeText.value}
          </span>
        )}
      </span>
    );
  },
});

export default HkDateTag;
