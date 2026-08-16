import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-vue-next";
import { computed, defineComponent, ref, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import HkButton from "./HkButton";
import HPopover from "./HkPopover";
import "./HkDatePicker.scss";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse an ISO `YYYY-MM-DD` string into a local-time Date (null when invalid). */
function parseISODate(value: string | null | undefined): Date | null {
  if (!value || !ISO_DATE_RE.test(value)) return null;
  const y = Number(value.slice(0, 4));
  const m = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  const date = new Date(y, m - 1, d);
  // Reject rollovers such as 2026-02-31 (Date normalizes them to March).
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/**
 * First day of the week (0 = Sunday … 6 = Saturday) for a locale, taken from
 * `Intl.Locale#weekInfo` (or the older `getInfo`) when the runtime provides
 * it and defaulting to Sunday.
 */
function firstWeekdayOf(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay?: number | string };
      getInfo?: () => { firstDayOfWeek?: string };
    };
    if (loc.weekInfo) {
      const n = Number(loc.weekInfo.firstDay);
      if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
    }
    if (typeof loc.getInfo === "function") {
      const n = Number(loc.getInfo().firstDayOfWeek);
      if (Number.isInteger(n) && n >= 0 && n <= 6) return n;
    }
  } catch {
    // Fall through to the Sunday default.
  }
  return 0;
}

export default defineComponent({
  name: "HkDatePicker",
  props: {
    /** Selected date as an ISO `YYYY-MM-DD` string (the native input wire format). */
    modelValue: { type: String as PropType<string | null>, default: null },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    clearable: { type: Boolean, default: true },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
    /** Inclusive lower bound as an ISO date; earlier days render disabled. */
    min: { type: String as PropType<string | undefined>, default: undefined },
    /** Inclusive upper bound as an ISO date; later days render disabled. */
    max: { type: String as PropType<string | undefined>, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: string | null) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const selected = computed(() => parseISODate(props.modelValue));
    const hasValue = computed(() => selected.value !== null);

    // ── View state ──────────────────────────────────────────────────
    // Refreshed on every popup open so the today highlight and the
    // footer button cannot go stale on pages that live past midnight.
    const today = ref(new Date());
    const anchorDate = computed(() => selected.value ?? today.value);
    const viewYear = ref(anchorDate.value.getFullYear());
    const viewMonth = ref(anchorDate.value.getMonth());

    watch(
      () => props.modelValue,
      () => {
        viewYear.value = anchorDate.value.getFullYear();
        viewMonth.value = anchorDate.value.getMonth();
      },
    );

    function shiftMonth(delta: number) {
      const d = new Date(viewYear.value, viewMonth.value + delta, 1);
      viewYear.value = d.getFullYear();
      viewMonth.value = d.getMonth();
    }

    // ── Localization (all derived from the active locale, no tables) ──
    const locale = computed(() => useI18n().locale);
    const firstDay = computed(() => firstWeekdayOf(locale.value));

    const formatters = computed(() => {
      const loc = locale.value;
      return {
        display: new Intl.DateTimeFormat(loc, { dateStyle: "medium" }),
        header: new Intl.DateTimeFormat(loc, { year: "numeric", month: "long" }),
        full: new Intl.DateTimeFormat(loc, { dateStyle: "full" }),
        weekday: new Intl.DateTimeFormat(loc, { weekday: "narrow" }),
      };
    });

    // 2024-01-07 is a Sunday; offset by the locale's first weekday so the
    // label column follows the locale instead of a hardcoded week start.
    const weekdayLabels = computed(() =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(2024, 0, 7 + ((firstDay.value + i) % 7));
        return formatters.value.weekday.format(d);
      }),
    );

    const headerLabel = computed(() =>
      formatters.value.header.format(new Date(viewYear.value, viewMonth.value, 1)),
    );

    const displayText = computed(() =>
      selected.value ? formatters.value.display.format(selected.value) : "",
    );

    // ── Month grid ──────────────────────────────────────────────────
    // Normalize bounds through the parser so unpadded inputs ("2026-8-6")
    // and invalid dates cannot skew the day-key comparisons below.
    const minKey = computed(() => {
      const d = parseISODate(props.min);
      return d ? toISODate(d) : null;
    });
    const maxKey = computed(() => {
      const d = parseISODate(props.max);
      return d ? toISODate(d) : null;
    });

    const cells = computed(() => {
      const first = new Date(viewYear.value, viewMonth.value, 1);
      const start = new Date(first);
      start.setDate(first.getDate() - ((first.getDay() - firstDay.value + 7) % 7));
      const out: Date[] = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        out.push(d);
      }
      return out;
    });

    function isDisabledDay(d: Date): boolean {
      const key = toISODate(d);
      if (minKey.value && key < minKey.value) return true;
      if (maxKey.value && key > maxKey.value) return true;
      return false;
    }

    function selectDay(d: Date) {
      if (isDisabledDay(d)) return;
      emit("update:modelValue", toISODate(d));
      open.value = false;
    }

    function jumpToday() {
      const tgt = isDisabledDay(today.value) ? null : today.value;
      if (!tgt) return;
      viewYear.value = tgt.getFullYear();
      viewMonth.value = tgt.getMonth();
      selectDay(tgt);
    }

    // ── Trigger + popup wiring ──────────────────────────────────────
    const open = ref(false);
    const triggerRef = ref<HTMLElement | null>(null);

    function toggle() {
      if (props.disabled) return;
      open.value = !open.value;
      if (open.value) {
        today.value = new Date();
        viewYear.value = anchorDate.value.getFullYear();
        viewMonth.value = anchorDate.value.getMonth();
      }
    }

    function onTriggerKeydown(e: KeyboardEvent) {
      if (props.disabled) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        if (!open.value) toggle();
      } else if (e.key === "Escape" && open.value) {
        e.preventDefault();
        open.value = false;
      } else if (
        (e.key === "Backspace" || e.key === "Delete")
        && props.clearable
        && hasValue.value
      ) {
        // Keyboard path to the clear affordance (the X button is
        // mouse-oriented; this keeps clearing reachable without it).
        e.preventDefault();
        emit("update:modelValue", null);
      }
    }

    function onClear(e: MouseEvent) {
      e.stopPropagation();
      emit("update:modelValue", null);
    }

    return () => (
      <div class={["hk-dp", props.disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}>
        <div
          ref={triggerRef}
          class={[
            "hk-dp-trigger",
            `hk-dp-trigger-${props.size}`,
            open.value ? "is-open" : "",
          ].filter(Boolean).join(" ")}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open.value}
          aria-disabled={props.disabled || undefined}
          tabindex={props.disabled ? -1 : 0}
          onClick={toggle}
          onKeydown={onTriggerKeydown}
        >
          <span class="hk-dp-value" data-empty={!hasValue.value || undefined}>
            {hasValue.value ? displayText.value : (props.placeholder ?? t("hk.datePicker.placeholder", "Pick a date"))}
          </span>
          {props.clearable && hasValue.value && !props.disabled && (
            <button
              type="button"
              class="hk-dp-clear"
              tabindex={-1}
              aria-label={t("hk.datePicker.clear", "Clear date")}
              onClick={onClear}
              onKeydown={(e) => e.stopPropagation()}
            >
              <X size={14} />
            </button>
          )}
          <span class="hk-dp-icon">
            <Calendar size={15} />
          </span>
        </div>
        <HPopover
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => { open.value = v; }}
          anchorRef={triggerRef.value ?? null}
          placement="bottom-start"
          offset={6}
          backdrop={false}
          class="hk-dp-popover"
        >
          <div class="hk-dp-panel">
            <div class="hk-dp-header">
              <button
                class="hk-dp-nav"
                type="button"
                aria-label={t("hk.datePicker.prevMonth", "Previous month")}
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <div class="hk-dp-title">{headerLabel.value}</div>
              <button
                class="hk-dp-nav"
                type="button"
                aria-label={t("hk.datePicker.nextMonth", "Next month")}
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div class="hk-dp-weekdays">
              {weekdayLabels.value.map((w, i) => (
                <span key={i} class="hk-dp-wd">{w}</span>
              ))}
            </div>
            <div class="hk-dp-grid">
              {cells.value.map((d, i) => {
                const outOfMonth = d.getMonth() !== viewMonth.value;
                const disabled = isDisabledDay(d);
                const isSelected = selected.value !== null && sameDay(d, selected.value);
                const isToday = sameDay(d, today.value);
                return (
                  <button
                    key={i}
                    type="button"
                    class={[
                      "hk-dp-cell",
                      outOfMonth ? "is-out" : "",
                      disabled ? "is-disabled" : "",
                      isSelected ? "is-selected" : "",
                      isToday ? "is-today" : "",
                    ].filter(Boolean).join(" ")}
                    disabled={disabled}
                    aria-label={formatters.value.full.format(d)}
                    onClick={() => selectDay(d)}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div class="hk-dp-footer">
              <HkButton size="sm" disabled={isDisabledDay(today.value)} onClick={jumpToday}>
                {t("hk.datePicker.today", "Today")}
              </HkButton>
            </div>
          </div>
        </HPopover>
      </div>
    );
  },
});
