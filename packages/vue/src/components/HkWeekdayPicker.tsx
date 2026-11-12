import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  ref,
  watch,
  type CSSProperties,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import { useBreakpoint } from "../runtime/useBreakpoint";
import { asPropType } from "../utils/typing";
import {
  firstWeekdayOf,
  isoWeekday,
  isoWeekdayOfJs,
  monthGrid,
  sameDay,
  weekdayLabels,
  type CalendarDay,
} from "./calendarGrid";
import HkButton from "./HkButton";
import HkIconButton from "./HkIconButton";
import "./HkWeekdayPicker.scss";

/** The inline style carrying a band's grid column (an integer 0 … 6). */
const BAND_COL_VAR = "--hk-wp-col";

/** Sort + dedupe a weekday model, dropping values outside 1 … 7. A set
 *  that ends up holding every weekday is the documented "every day"
 *  spelling (`[]`), so normalization happens on the way IN as well. */
function normalizeDays(days: readonly number[] | null | undefined): number[] {
  const set = new Set<number>();
  for (const raw of days ?? []) {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 1 && n <= 7) set.add(n);
  }
  if (set.size === 7) return [];
  return [...set].sort((a, b) => a - b);
}

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((day, i) => day === b[i]);
}

/**
 * HkWeekdayPicker — the calendar-shaped WEEKDAY picker (2026-11-12
 * product direction: "a whole column can be selected, Mon..Sun columns").
 *
 * A month grid where the selection unit is the weekday, not the date: a
 * selected weekday paints one absolutely-positioned full-height band
 * behind the column's date cells (one layer for the whole grid, so the
 * band reads as a column instead of as a stack of highlighted cells) and
 * the in-month dates inside it carry a filled circle. Clicking a weekday
 * header or ANY date cell toggles that weekday — out-of-month cells stay
 * clickable — while the prev/next arrows only move the displayed month
 * (the selection is weekday-based and survives navigation).
 *
 * Model contract (`modelValue: number[]`, 1 = Monday … 7 = Sunday):
 *   · `[]` means EVERY day: the "Every day" chip is pressed and no band
 *     is drawn;
 *   · clicking from `[]` selects exactly that weekday;
 *   · otherwise the weekday toggles off/on, and a result that is empty
 *     or holds all seven weekdays normalizes back to `[]`.
 *
 * The week order and every label come from `Intl` (see calendarGrid.ts),
 * so a Monday-first locale reorders the header without a lookup table.
 */
export default defineComponent({
  name: "HkWeekdayPicker",
  props: {
    /** Selected ISO weekdays: 1 = Monday … 7 = Sunday; `[]` = every day. */
    modelValue: {
      type: Array as PropType<number[]>,
      default: () => [] as number[],
    },
    /** Field caption. Unset → the localized "Active days" default. */
    label: { type: String, default: undefined },
    /** Hide the caption visually; it still names the grid for AT. */
    hideLabel: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
    /** Month the grid opens on; null/unset → the current month. */
    initialMonth: { type: asPropType<Date | null>([Date, null]), default: null },
  },
  emits: {
    "update:modelValue": (_days: number[]) => true,
    change: (_days: number[]) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const { isMobile } = useBreakpoint();

    // Locale-dependent formatters are rebuilt whenever the active locale
    // changes (the i18n context is a module singleton; reading it INSIDE
    // the computed is what makes the switch visible here).
    const locale = computed(() => useI18n().locale);

    const formatters = computed(() => {
      const loc = locale.value;
      return {
        header: new Intl.DateTimeFormat(loc, { year: "numeric", month: "long" }),
        full: new Intl.DateTimeFormat(loc, { dateStyle: "full" }),
      };
    });

    // ── View state (displayed month only; selection is weekday-based) ──
    const initial = props.initialMonth ?? new Date();
    const viewYear = ref(initial.getFullYear());
    const viewMonth = ref(initial.getMonth());
    const today = new Date();

    // A host that loads the month after mount (async data) still lands the
    // grid on the requested month; selection is weekday-based and unmoved.
    watch(
      () => {
        const value = props.initialMonth;
        // Year/month, not the timestamp: a host rendering a live `new
        // Date()` (or any fresh equal Date) must not yank the operator
        // out of the month they navigated to.
        return value ? `${value.getFullYear()}-${value.getMonth()}` : null;
      },
      () => {
        const value = props.initialMonth;
        if (!value) return;
        viewYear.value = value.getFullYear();
        viewMonth.value = value.getMonth();
      },
    );

    function shiftMonth(delta: number) {
      const d = new Date(viewYear.value, viewMonth.value + delta, 1);
      viewYear.value = d.getFullYear();
      viewMonth.value = d.getMonth();
    }

    // ── Selection model ────────────────────────────────────────────
    const normalizedModel = computed(() => normalizeDays(props.modelValue));
    const selectedSet = computed(() => new Set(normalizedModel.value));
    /** `[]` (and a full seven-day array, normalized to `[]`) = every day. */
    const everyDay = computed(() => selectedSet.value.size === 0);

    function emitDays(next: Set<number>) {
      const days = [...next].sort((a, b) => a - b);
      const payload = days.length === 7 ? [] : days;
      if (sameDays(payload, normalizedModel.value)) return;
      emit("update:modelValue", payload);
      emit("change", payload);
    }

    function toggleWeekday(day: number) {
      if (props.disabled) return;
      const next = new Set(selectedSet.value);
      if (next.size === 0) {
        // From "every day" a click narrows the filter to that weekday.
        next.add(day);
      } else if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      emitDays(next);
    }

    function selectEveryDay() {
      if (props.disabled) return;
      emitDays(new Set());
    }

    // ── Localization (all derived from the active locale, no tables) ──
    const firstDay = computed(() => firstWeekdayOf(locale.value));
    const shortLabels = computed(() => weekdayLabels(locale.value));
    const longLabels = computed(() => weekdayLabels(locale.value, "long"));

    /** ISO weekday (1 … 7) of each column, in the locale's week order. */
    const columnDays = computed(() =>
      Array.from({ length: 7 }, (_, i) => isoWeekdayOfJs((firstDay.value + i) % 7)));

    /** Columns (0 … 6) whose weekday is selected — one band per column. */
    const bandColumns = computed(() => {
      const selected = selectedSet.value;
      const out: number[] = [];
      columnDays.value.forEach((day, column) => {
        if (selected.has(day)) out.push(column);
      });
      return out;
    });

    const cells = computed(() => monthGrid(viewYear.value, viewMonth.value, firstDay.value));

    const headerLabel = computed(() =>
      formatters.value.header.format(new Date(viewYear.value, viewMonth.value, 1)));

    const pickerLabel = computed(() => props.label ?? t("hikari::weekdayPicker.title", "Active days"));

    const everyDayText = computed(() => t("hikari::weekdayPicker.everyDay", "Every day"));

    function weekdayButtonLabel(dayIndex: number): string {
      return t("hikari::weekdayPicker.selectDay", "Select every {day}")
        .replace("{day}", longLabels.value[dayIndex] ?? "");
    }

    /** The text summary under the grid: "Every day", or the selected
     *  weekdays in the locale's own list grammar. */
    const summaryText = computed(() => {
      if (everyDay.value) return everyDayText.value;
      const byDay = new Map<number, string>();
      columnDays.value.forEach((day, i) => byDay.set(day, shortLabels.value[i] ?? ""));
      const parts = normalizedModel.value.map((day) => byDay.get(day) ?? String(day));
      try {
        return new Intl.ListFormat(locale.value, { style: "short", type: "conjunction" })
          .format(parts);
      } catch {
        return parts.join(", ");
      }
    });

    function bandStyle(column: number): CSSProperties {
      return { [BAND_COL_VAR]: String(column) } as CSSProperties;
    }

    function cellClass(cell: CalendarDay): string {
      const active = selectedSet.value.has(isoWeekday(cell.date));
      return [
        "hk-wp-cell",
        cell.inMonth ? "" : "is-out",
        active ? "is-active" : "",
        sameDay(cell.date, today) ? "is-today" : "",
      ].filter(Boolean).join(" ");
    }

    return () => (
      <div
        class={[
          "hk-wp",
          `hk-wp-${props.size}`,
          isMobile.value ? "is-touch" : "",
          props.disabled ? "is-disabled" : "",
        ].filter(Boolean).join(" ")}
        aria-disabled={props.disabled || undefined}
      >
        {/* The caption is decorative for AT: the grid carries the same
            name via aria-label, and hideLabel only suppresses the ink. */}
        {!props.hideLabel && <span class="hk-wp-label">{pickerLabel.value}</span>}

        <div class="hk-wp-header">
          <HkIconButton
            size={24}
            variant="ghost"
            data-test="hk-wp-prev"
            aria-label={t("hikari::datePicker.prevMonth", "Previous month")}
            disabled={props.disabled}
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft size={14} />
          </HkIconButton>
          <div class="hk-wp-title">{headerLabel.value}</div>
          <HkIconButton
            size={24}
            variant="ghost"
            data-test="hk-wp-next"
            aria-label={t("hikari::datePicker.nextMonth", "Next month")}
            disabled={props.disabled}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight size={14} />
          </HkIconButton>
          <HkButton
            size="sm"
            variant={everyDay.value ? "primary" : "secondary"}
            data-test="hk-wp-every"
            aria-pressed={everyDay.value}
            disabled={props.disabled}
            onClick={selectEveryDay}
          >
            {everyDayText.value}
          </HkButton>
        </div>

        <div class="hk-wp-weekdays">
          {shortLabels.value.map((label, i) => (
            <button
              key={columnDays.value[i]}
              type="button"
              class="hk-wp-wd"
              aria-pressed={selectedSet.value.has(columnDays.value[i] ?? 0)}
              aria-label={weekdayButtonLabel(i)}
              disabled={props.disabled}
              onClick={() => toggleWeekday(columnDays.value[i] ?? 0)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* The selected-column bands: ONE absolutely-positioned layer
            behind the date grid (not per-cell backgrounds), so a column
            reads as one continuous rounded strip. */}
        <div class="hk-wp-grid-wrap">
          <div class="hk-wp-bands" aria-hidden="true">
            {bandColumns.value.map((column) => (
              <span key={column} class="hk-wp-band" style={bandStyle(column)} />
            ))}
          </div>
          <div class="hk-wp-grid" role="group" aria-label={pickerLabel.value}>
            {cells.value.map((cell) => (
              <button
                key={cell.key}
                type="button"
                class={cellClass(cell)}
                aria-pressed={selectedSet.value.has(isoWeekday(cell.date))}
                aria-label={formatters.value.full.format(cell.date)}
                disabled={props.disabled}
                onClick={() => toggleWeekday(isoWeekday(cell.date))}
              >
                <span class="hk-wp-cell-num">{cell.date.getDate()}</span>
              </button>
            ))}
          </div>
        </div>

        <div class="hk-wp-summary">{summaryText.value}</div>
      </div>
    );
  },
});
