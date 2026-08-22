import { ArrowLeft, Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-vue-next";
import { computed, defineComponent, ref, Transition, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import { useBreakpoint } from "../runtime/useBreakpoint";
import "./HkDateTimePicker.scss";
import HPopover, { type PopupPlacement } from "./HkPopover";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function dayKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

// Wire format of the mobile native input: `YYYY-MM-DD` with an optional
// `THH:mm` (some engines also append `:ss`, which we tolerate and drop).
const NATIVE_INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2})?)?$/;

/** Serialize a Date to the local-time wire format of the native input. */
function toNativeInputValue(d: Date, withTime: boolean): string {
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return withTime ? `${date}T${pad2(d.getHours())}:${pad2(d.getMinutes())}` : date;
}

/**
 * Parse a native-input value (`YYYY-MM-DD` + optional `THH:mm`) into its
 * parts, rejecting rollovers such as 2026-02-31 (Date normalizes them).
 */
function parseNativeInputValue(value: string): { y: number; m: number; d: number; hh: number | null; mm: number | null } | null {
  const match = NATIVE_INPUT_RE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(y, m - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== m - 1 || probe.getDate() !== d) {
    return null;
  }
  return {
    y,
    m,
    d,
    hh: match[4] !== undefined ? Number(match[4]) : null,
    mm: match[5] !== undefined ? Number(match[5]) : null,
  };
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

type ViewKind = "days" | "months" | "years";

export default defineComponent({
  name: "HkDateTimePicker",
  props: {
    modelValue: { type: Date, required: true },
    min: { type: [Date, null] as unknown as PropType<Date | null>, default: null },
    max: { type: [Date, null] as unknown as PropType<Date | null>, default: null },
    markedDays: { type: Set as unknown as PropType<Set<string>>, default: () => new Set<string>() },
    mode: { type: String as PropType<"inline" | "popup">, default: "inline" },
    placement: { type: String as PropType<PopupPlacement>, default: "bottom-start" },
    offset: { type: Number, default: 6 },
    confirmLabel: { type: String, default: undefined },
    showTime: { type: Boolean, default: true },
    /** Render the OS native `<input type="datetime-local">` on touch-sized viewports. */
    nativeOnMobile: { type: Boolean, default: true },
  },
  emits: {
    "update:modelValue": (_d: Date) => true,
    open: () => true,
    confirm: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const { isMobile } = useBreakpoint();

    // On touch devices the OS picker beats a custom popup: swap the whole
    // chrome for a native datetime-local input and keep the custom UI on
    // desktop widths only.
    const useNative = computed(() => props.nativeOnMobile && isMobile.value);
    // The custom calendar renders on touch viewports only when the host
    // opts out of the native input (e.g. bottom-sheet dialogs); enlarge
    // the cells there via the `is-touch` geometry variant.
    const isTouch = computed(() => isMobile.value && !useNative.value);

    const viewYear = ref(props.modelValue.getFullYear());
    const viewMonth = ref(props.modelValue.getMonth());
    const view = ref<ViewKind>("days");
    const viewStack = ref<ViewKind[]>([]);
    // Drift direction of the last view change — drives the pane keyframes
    // wired in HkPickerPane.scss.
    const drift = ref<"fwd" | "back">("fwd");

    function drillTo(next: ViewKind) {
      drift.value = "fwd";
      viewStack.value.push(view.value);
      view.value = next;
    }

    function goBack() {
      drift.value = "back";
      const prev = viewStack.value.pop();
      view.value = prev ?? "days";
    }

    // Time-stepper bumps also update the model, but they must not yank the
    // user out of the drilled month/year grids — only a real day change
    // re-anchors the view to the days grid.
    let lastDayKey = dayKeyOf(props.modelValue);
    watch(
      () => props.modelValue,
      (d) => {
        const key = dayKeyOf(d);
        if (key === lastDayKey) return;
        lastDayKey = key;
        if (d.getFullYear() !== viewYear.value || d.getMonth() !== viewMonth.value) {
          viewYear.value = d.getFullYear();
          viewMonth.value = d.getMonth();
        }
        drift.value = "back";
        view.value = "days";
        viewStack.value = [];
      },
    );

    // ── Localization (all derived from the active locale, no tables) ──
    const locale = computed(() => useI18n().locale);
    const firstDay = computed(() => firstWeekdayOf(locale.value));

    const formatters = computed(() => {
      const loc = locale.value;
      return {
        monthShort: new Intl.DateTimeFormat(loc, { month: "short" }),
        monthLong: new Intl.DateTimeFormat(loc, { month: "long" }),
        weekday: new Intl.DateTimeFormat(loc, { weekday: "short" }),
        // h23 keeps the trigger in the same 24-hour form as the time steppers.
        triggerDateTime: new Intl.DateTimeFormat(loc, {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
        }),
        triggerDate: new Intl.DateTimeFormat(loc, { year: "numeric", month: "short", day: "numeric" }),
      };
    });

    const monthNames = computed(() =>
      Array.from({ length: 12 }, (_, i) => formatters.value.monthShort.format(new Date(2024, i, 15))),
    );

    const monthName = computed(() =>
      formatters.value.monthLong.format(new Date(viewYear.value, viewMonth.value, 1)),
    );

    // 2024-01-07 is a Sunday; offset by the locale's first weekday so the
    // label column follows the locale instead of a hardcoded week start.
    const weekdayLabels = computed(() =>
      Array.from({ length: 7 }, (_, i) =>
        formatters.value.weekday.format(new Date(2024, 0, 7 + ((firstDay.value + i) % 7)))),
    );

    const yearBlockStart = computed(() =>
      viewYear.value - (viewYear.value % 12),
    );

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

    const now = new Date();

    function shiftMonth(delta: number) {
      const d = new Date(viewYear.value, viewMonth.value + delta, 1);
      viewYear.value = d.getFullYear();
      viewMonth.value = d.getMonth();
    }

    function shiftYear(delta: number) {
      viewYear.value = viewYear.value + delta;
    }

    function pickMonth(i: number) {
      viewMonth.value = i;
      goBack();
    }

    function pickYear(y: number) {
      viewYear.value = y;
      goBack();
    }

    function isDisabled(d: Date): boolean {
      const day = startOfDay(d);
      if (props.min && day < startOfDay(props.min)) return true;
      if (props.max && day > startOfDay(props.max)) return true;
      return false;
    }

    function selectDay(d: Date) {
      if (isDisabled(d)) return;
      const next = new Date(
        d.getFullYear(), d.getMonth(), d.getDate(),
        props.modelValue.getHours(), props.modelValue.getMinutes(),
      );
      emit("update:modelValue", next);
    }

    function setHM(h: number, m: number) {
      const cur = props.modelValue;
      emit("update:modelValue", new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), h, m));
    }

    function bump(field: "h" | "m", delta: number) {
      const cur = props.modelValue;
      if (field === "h") setHM((cur.getHours() + delta + 24) % 24, cur.getMinutes());
      else setHM(cur.getHours(), (cur.getMinutes() + delta + 60) % 60);
    }

    function jumpToday() {
      const tgt = props.max && startOfDay(props.max) < startOfDay(now) ? props.max : now;
      viewYear.value = tgt.getFullYear();
      viewMonth.value = tgt.getMonth();
      // The Today button lives under every view now, so jumping home also
      // resets the drill-down state to the day grid.
      view.value = "days";
      viewStack.value = [];
      selectDay(tgt);
    }

    function stepper(label: string, value: number, onUp: () => void, onDown: () => void) {
      return (
        <div class="hk-dtp-step">
          <button class="hk-dtp-step-btn" type="button" aria-label={`${label} +`} onClick={onUp}>
            <ChevronUp size={13} />
          </button>
          <span class="hk-dtp-step-val">{pad2(value)}</span>
          <button class="hk-dtp-step-btn" type="button" aria-label={`${label} -`} onClick={onDown}>
            <ChevronDown size={13} />
          </button>
        </div>
      );
    }

    // ── Popup-mode state ────────────────────────────────────────────
    const open = ref(false);
    // HPopover renders no trigger slot of its own — the wrap below is the
    // real DOM anchor and must live outside the teleported popover.
    const triggerWrapRef = ref<HTMLElement | null>(null);
    function toggleOpen() { open.value = !open.value; if (open.value) emit("open"); }
    function onConfirm() { emit("confirm"); open.value = false; }

    const triggerLabel = computed(() =>
      props.showTime
        ? formatters.value.triggerDateTime.format(props.modelValue)
        : formatters.value.triggerDate.format(props.modelValue),
    );

    // ── Native mobile input ─────────────────────────────────────────
    function onNativeInput(e: Event) {
      const el = e.target as HTMLInputElement;
      if (!el.value) {
        // The model is a required Date with no null semantics — a cleared
        // field must fall back to it instead of silently drifting.
        el.value = toNativeInputValue(props.modelValue, props.showTime);
        return;
      }
      const parsed = parseNativeInputValue(el.value);
      if (!parsed) return;
      // Without a time part (showTime=false) keep the model's clock time,
      // mirroring how the custom grid preserves it across day selection.
      const cur = props.modelValue;
      const next = new Date(
        parsed.y, parsed.m - 1, parsed.d,
        parsed.hh ?? cur.getHours(), parsed.mm ?? cur.getMinutes(),
      );
      if (isDisabled(next)) {
        el.value = toNativeInputValue(cur, props.showTime);
        return;
      }
      emit("update:modelValue", next);
    }

    function renderNative() {
      return (
        <input
          class="hk-dtp-native"
          type={props.showTime ? "datetime-local" : "date"}
          value={toNativeInputValue(props.modelValue, props.showTime)}
          min={props.min ? toNativeInputValue(props.min, props.showTime) : undefined}
          max={props.max ? toNativeInputValue(props.max, props.showTime) : undefined}
          aria-label={t("hikari::dateTimePicker.pickDate", "Pick a date and time")}
          onInput={onNativeInput}
        />
      );
    }

    // ── Header ──────────────────────────────────────────────────────

    /** The view swap removes the clicked button from the DOM and drops
     * focus to <body>; move it onto the incoming pane's primary control
     * once the transition finishes. Never steal focus from an unrelated
     * control that kept it through the swap. */
    function restoreFocusAfterView(el: Element) {
      if (document.activeElement && document.activeElement !== document.body) return;
      const target = el.querySelector<HTMLElement>(".hk-dtp-back, .hk-dtp-title-btn");
      target?.focus();
    }

    function renderHeader() {
      if (view.value === "years") {
        return (
          <div class="hk-dtp-header">
            <div class="hk-dtp-header-side">
              <button class="hk-dtp-back" type="button" aria-label={t("hikari::dateTimePicker.back", "Back")} onClick={goBack}>
                <ArrowLeft size={15} />
              </button>
              <button class="hk-dtp-nav" type="button" aria-label={t("hikari::dateTimePicker.prevYears", "Previous years")} onClick={() => shiftYear(-12)}>
                <ChevronLeft size={16} />
              </button>
            </div>
            <div class="hk-dtp-title">{yearBlockStart.value}–{yearBlockStart.value + 11}</div>
            <div class="hk-dtp-header-side" data-side="right">
              <button class="hk-dtp-nav" type="button" aria-label={t("hikari::dateTimePicker.nextYears", "Next years")} onClick={() => shiftYear(12)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        );
      }

      if (view.value === "months") {
        return (
          <div class="hk-dtp-header">
            <div class="hk-dtp-header-side">
              <button class="hk-dtp-back" type="button" aria-label={t("hikari::dateTimePicker.back", "Back")} onClick={goBack}>
                <ArrowLeft size={15} />
              </button>
              <button class="hk-dtp-nav" type="button" aria-label={t("hikari::dateTimePicker.prevYear", "Previous year")} onClick={() => shiftYear(-1)}>
                <ChevronLeft size={16} />
              </button>
            </div>
            <div class="hk-dtp-title">
              <button class="hk-dtp-title-btn" type="button" onClick={() => drillTo("years")}>
                {viewYear.value}
              </button>
            </div>
            <div class="hk-dtp-header-side" data-side="right">
              <button class="hk-dtp-nav" type="button" aria-label={t("hikari::dateTimePicker.nextYear", "Next year")} onClick={() => shiftYear(1)}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        );
      }

      return (
        <div class="hk-dtp-header">
          <div class="hk-dtp-header-side">
            <button class="hk-dtp-nav" type="button" aria-label={t("hikari::dateTimePicker.prevMonth", "Previous month")} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={16} />
            </button>
          </div>
          <div class="hk-dtp-title">
            <button class="hk-dtp-title-btn" type="button" onClick={() => drillTo("months")}>{monthName.value}</button>
            <button class="hk-dtp-title-btn" type="button" onClick={() => drillTo("years")}>{viewYear.value}</button>
          </div>
          <div class="hk-dtp-header-side" data-side="right">
            <button class="hk-dtp-nav" type="button" aria-label={t("hikari::dateTimePicker.nextMonth", "Next month")} onClick={() => shiftMonth(1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      );
    }

    function renderContent() {
      if (view.value === "months") {
        return (
          <div class="hk-dtp-grid" data-variant="pick">
            {monthNames.value.map((name, i) => {
              const selected = viewYear.value === props.modelValue.getFullYear() && i === props.modelValue.getMonth();
              const isNow = viewYear.value === now.getFullYear() && i === now.getMonth();
              return (
                <button
                  key={i}
                  type="button"
                  class={[
                    "hk-dtp-cell",
                    selected ? "is-selected" : "",
                    isNow ? "is-today" : "",
                  ].filter(Boolean).join(" ")}
                  data-variant="pick"
                  onClick={() => pickMonth(i)}
                >
                  {name}
                </button>
              );
            })}
          </div>
        );
      }

      if (view.value === "years") {
        return (
          <div class="hk-dtp-grid" data-variant="pick">
            {Array.from({ length: 12 }, (_, k) => yearBlockStart.value + k).map((y) => {
              const selected = y === props.modelValue.getFullYear();
              const isNow = y === now.getFullYear();
              return (
                <button
                  key={y}
                  type="button"
                  class={[
                    "hk-dtp-cell",
                    selected ? "is-selected" : "",
                    isNow ? "is-today" : "",
                  ].filter(Boolean).join(" ")}
                  data-variant="pick"
                  onClick={() => pickYear(y)}
                >
                  {y}
                </button>
              );
            })}
          </div>
        );
      }

      // days
      return (
        <>
          <div class="hk-dtp-weekdays">
            {weekdayLabels.value.map((w, i) => (
              <span key={i} class="hk-dtp-wd">{w}</span>
            ))}
          </div>
          <div class="hk-dtp-grid">
            {cells.value.map((d, i) => {
              const outOfMonth = d.getMonth() !== viewMonth.value;
              const disabled = isDisabled(d);
              const selected = sameDay(d, props.modelValue);
              const isToday = sameDay(d, now);
              const marked = props.markedDays.has(dayKeyOf(d));
              return (
                <button
                  key={i}
                  type="button"
                  class={[
                    "hk-dtp-cell",
                    outOfMonth ? "is-out" : "",
                    disabled ? "is-disabled" : "",
                    selected ? "is-selected" : "",
                    isToday ? "is-today" : "",
                  ].filter(Boolean).join(" ")}
                  disabled={disabled}
                  onClick={() => selectDay(d)}
                >
                  <span class="hk-dtp-cell-num">{d.getDate()}</span>
                  {marked && !selected && <span class="hk-dtp-cell-dot" />}
                </button>
              );
            })}
          </div>
        </>
      );
    }

    function renderBody() {
      return (
        /* The stage pins the day view's exact size in every view (see
           HkPickerPane.scss) so drilling into months/years never resizes
           the picker; the drift direction picks the pane keyframes. */
        <div class="hk-dtp-stage" data-dir={drift.value}>
          <Transition name="hk-picker-pane" onAfterEnter={restoreFocusAfterView}>
            <div key={view.value} class="hk-dtp-pane">
              {renderHeader()}
              {renderContent()}
            </div>
          </Transition>
        </div>
      );
    }

    return () => {
      if (useNative.value) {
        return renderNative();
      }

      const body = (
        <div class={["hk-dtp", isTouch.value ? "is-touch" : ""].filter(Boolean).join(" ")} role="group" aria-label={t("hikari::dateTimePicker.pickDate", "Pick a date and time")}>
          {renderBody()}
          {/* The time row lives outside the transitioned pane and stays in
              every view, so the picker's footprint never changes when the
              month/year grids open. */}
          <div class="hk-dtp-time">
            {props.showTime && (
              <>
                {stepper(t("hikari::dateTimePicker.hour", "Hour"), props.modelValue.getHours(), () => bump("h", 1), () => bump("h", -1))}
                <span class="hk-dtp-time-sep">:</span>
                {stepper(t("hikari::dateTimePicker.minute", "Minute"), props.modelValue.getMinutes(), () => bump("m", 1), () => bump("m", -1))}
              </>
            )}
            <button class="hk-dtp-today" type="button" onClick={jumpToday}>
              {t("hikari::dateTimePicker.today", "Today")}
            </button>
          </div>
          {props.mode === "popup" && props.confirmLabel && (
            <div class="hk-dtp-popup-foot">
              <button class="hk-dtp-popup-confirm" type="button" onClick={onConfirm}>
                {props.confirmLabel}
              </button>
            </div>
          )}
        </div>
      );

      if (props.mode !== "popup") {
        return body;
      }

      return (
        <div class="hk-dtp-popup-root">
          <div ref={triggerWrapRef} class="hk-dtp-trigger-wrap" onClick={toggleOpen}>
            {slots.trigger
              ? slots.trigger({ open: open.value })
              : (
                <button class="hk-dtp-trigger" type="button" aria-expanded={open.value}>
                  <Calendar size={14} class="hk-dtp-trigger-icon" />
                  <span class="hk-dtp-trigger-val">{triggerLabel.value}</span>
                  <ChevronDown
                    size={14}
                    class={["hk-dtp-trigger-chev", open.value ? "is-open" : ""].filter(Boolean).join(" ")}
                  />
                </button>
              )}
          </div>
          <HPopover
            modelValue={open.value}
            onUpdate:modelValue={(v: boolean) => { open.value = v; }}
            anchorRef={triggerWrapRef.value ?? null}
            placement={props.placement}
            offset={props.offset}
          >
            <div class="hk-dtp-popup">
              {body}
            </div>
          </HPopover>
        </div>
      );
    };
  },
});
