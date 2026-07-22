import { computed, defineComponent, onBeforeUnmount, ref, Transition, watch, type PropType } from "vue";
import { ArrowLeft, Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-vue-next";

import { useHikariI18n } from "../i18n/context";
import "./HkDateTimePicker.scss";
import HkPopover from "./HkPopover";

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

type ViewKind = "days" | "months" | "years";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_NAMES_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default defineComponent({
  name: "HkDateTimePicker",
  props: {
    modelValue: { type: Date, required: true },
    min: { type: [Date, null] as unknown as PropType<Date | null>, default: null },
    max: { type: [Date, null] as unknown as PropType<Date | null>, default: null },
    markedDays: { type: Set as unknown as PropType<Set<string>>, default: () => new Set<string>() },
    mode: { type: String as PropType<"inline" | "popup">, default: "inline" },
    placement: { type: String, default: "bottom-start" },
    offset: { type: Number, default: 6 },
    confirmLabel: { type: String, default: undefined },
    showTime: { type: Boolean, default: true },
  },
  emits: {
    "update:modelValue": (_d: Date) => true,
    open: () => true,
    confirm: () => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useHikariI18n();
    const viewYear = ref(props.modelValue.getFullYear());
    const viewMonth = ref(props.modelValue.getMonth());
    const view = ref<ViewKind>("days");
    const viewStack = ref<ViewKind[]>([]);

    function drillTo(next: ViewKind) {
      viewStack.value.push(view.value);
      view.value = next;
    }

    function goBack() {
      const prev = viewStack.value.pop();
      view.value = prev ?? "days";
    }

    watch(
      () => props.modelValue,
      (d) => {
        if (d.getFullYear() !== viewYear.value || d.getMonth() !== viewMonth.value) {
          viewYear.value = d.getFullYear();
          viewMonth.value = d.getMonth();
        }
        view.value = "days";
        viewStack.value = [];
      },
    );

    const monthName = computed(() =>
      MONTH_NAMES_LONG[viewMonth.value],
    );

    const yearBlockStart = computed(() =>
      viewYear.value - (viewYear.value % 12),
    );

    const cells = computed(() => {
      const first = new Date(viewYear.value, viewMonth.value, 1);
      const start = new Date(first);
      start.setDate(first.getDate() - first.getDay());
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
      selectDay(tgt);
    }

    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));

    function stepper(label: string, value: number, onUp: () => void, onDown: () => void) {
      return (
        <div class="hk-dtp-step">
          <button class="hk-dtp-step-btn" type="button" aria-label={`${label} +`} onClick={onUp}>
            <ChevronUp size={13} />
          </button>
          <span class="hk-dtp-step-val">{pad(value)}</span>
          <button class="hk-dtp-step-btn" type="button" aria-label={`${label} -`} onClick={onDown}>
            <ChevronDown size={13} />
          </button>
        </div>
      );
    }

    // ── Popup-mode state ────────────────────────────────────────────
    const open = ref(false);
    function toggleOpen() { open.value = !open.value; if (open.value) emit("open"); }
    function onConfirm() { emit("confirm"); open.value = false; }

    const triggerLabel = computed(() => {
      const d = props.modelValue;
      const month = MONTH_NAMES[d.getMonth()];
      const day = d.getDate();
      if (props.showTime) {
        const h = pad(d.getHours());
        const m = pad(d.getMinutes());
        return `${month} ${day}, ${h}:${m}`;
      }
      return `${month} ${day}, ${d.getFullYear()}`;
    });

    // ── Header ──────────────────────────────────────────────────────

    function renderHeader() {
      if (view.value === "years") {
        return (
          <div class="hk-dtp-header">
            <div class="hk-dtp-header-side">
              <button class="hk-dtp-back" type="button" aria-label={t("hk.dateTimePicker.back", "Back")} onClick={goBack}>
                <ArrowLeft size={15} />
              </button>
              <button class="hk-dtp-nav" type="button" aria-label={t("hk.dateTimePicker.prevYears", "Previous years")} onClick={() => shiftYear(-12)}>
                <ChevronLeft size={16} />
              </button>
            </div>
            <div class="hk-dtp-title">{yearBlockStart.value}–{yearBlockStart.value + 11}</div>
            <div class="hk-dtp-header-side" data-side="right">
              <button class="hk-dtp-nav" type="button" aria-label={t("hk.dateTimePicker.nextYears", "Next years")} onClick={() => shiftYear(12)}>
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
              <button class="hk-dtp-back" type="button" aria-label={t("hk.dateTimePicker.back", "Back")} onClick={goBack}>
                <ArrowLeft size={15} />
              </button>
            </div>
            <div class="hk-dtp-title">
              <button class="hk-dtp-title-btn" type="button" onClick={() => drillTo("years")}>
                {viewYear.value}
              </button>
            </div>
            <div class="hk-dtp-header-side" data-side="right" />
          </div>
        );
      }

      return (
        <div class="hk-dtp-header">
          <div class="hk-dtp-header-side">
            <button class="hk-dtp-nav" type="button" aria-label={t("hk.dateTimePicker.prevMonth", "Previous month")} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={16} />
            </button>
          </div>
          <div class="hk-dtp-title">
            <button class="hk-dtp-title-btn" type="button" onClick={() => drillTo("months")}>{monthName.value}</button>
            <button class="hk-dtp-title-btn" type="button" onClick={() => drillTo("years")}>{viewYear.value}</button>
          </div>
          <div class="hk-dtp-header-side" data-side="right">
            <button class="hk-dtp-nav" type="button" aria-label={t("hk.dateTimePicker.nextMonth", "Next month")} onClick={() => shiftMonth(1)}>
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
            {MONTH_NAMES.map((name, i) => {
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
            {WEEKDAY_NAMES.map((w, i) => (
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
        <div class="hk-dtp-stage">
          <Transition name="hk-dtp-pane">
            <div key={view.value} class="hk-dtp-pane">
              {renderHeader()}
              {renderContent()}
              {view.value === "days" && (
                <div class="hk-dtp-time">
                  {props.showTime ? (
                    <>
                      {stepper(t("hk.dateTimePicker.hour", "Hour"), props.modelValue.getHours(), () => bump("h", 1), () => bump("h", -1))}
                      <span class="hk-dtp-time-sep">:</span>
                      {stepper(t("hk.dateTimePicker.minute", "Minute"), props.modelValue.getMinutes(), () => bump("m", 1), () => bump("m", -1))}
                    </>
                  ) : null}
                  <button class="hk-dtp-today" type="button" onClick={jumpToday}>
                    {t("hk.dateTimePicker.today", "Today")}
                  </button>
                </div>
              )}
            </div>
          </Transition>
        </div>
      );
    }

    return () => {
      const body = (
        <div class="hk-dtp" role="group" aria-label={t("hk.dateTimePicker.pickDate", "Pick a date and time")}>
          {renderBody()}
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
        <HkPopover
          modelValue={open.value}
          onUpdate:modelValue={(v: boolean) => { open.value = v; }}
        >
          {{
            trigger: () => (
              <div class="hk-dtp-trigger-wrap" onClick={toggleOpen}>
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
            ),
            default: () => (
              <div class="hk-dtp-popup">
                {body}
              </div>
            ),
          }}
        </HkPopover>
      );
    };
  },
});
