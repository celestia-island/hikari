import { Check, Clock, Moon, Sun, X } from "lucide-vue-next";
import {
  computed,
  defineComponent,
  nextTick,
  ref,
  useId,
  watch,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import { useBreakpoint } from "../runtime/useBreakpoint";
import HkButton from "./HkButton";
import HPopover from "./HkPopover";
import "./HkTimePicker.scss";

/** `HH:mm`, 24-hour, the wire format every host already speaks. */
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse the `HH:mm` wire format; `null` for empty strings and garbage. */
export function parseHhmm(value: string): { hour: number; minute: number } | null {
  const match = HHMM_RE.exec(String(value ?? "").trim());
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Format a 24-hour pair back into `HH:mm`. */
export function formatHhmm(hour: number, minute: number): string {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const m = ((Math.round(minute) % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Split 0..23 into the 12-hour face's hour (1..12) and the AM/PM half. */
export function to12Hour(hour: number): { hour12: number; pm: boolean } {
  const h = ((Math.round(hour) % 24) + 24) % 24;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return { hour12, pm: h >= 12 };
}

/** Inverse of {@link to12Hour}: a face hour + half becomes 0..23. */
export function from12Hour(hour12: number, pm: boolean): number {
  const h = ((Math.round(hour12) % 12) + 12) % 12;
  return pm ? h + 12 : h;
}

/** Dial angle (0 = 12 o'clock, clockwise) → the 12-hour face number (1..12). */
export function angleToHour12(angleDeg: number): number {
  const angle = ((angleDeg % 360) + 360) % 360;
  const index = Math.round(angle / 30) % 12;
  return index === 0 ? 12 : index;
}

/** Dial angle → a minute 0..59, snapped to the caller's step. */
export function angleToMinute(angleDeg: number, step = 1): number {
  const safeStep = Math.min(30, Math.max(1, Math.round(step) || 1));
  const angle = ((angleDeg % 360) + 360) % 360;
  const snapped = Math.round(angle / 6 / safeStep) * safeStep;
  return ((snapped % 60) + 60) % 60;
}

/**
 * Snap an absolute minute to the step grid (0..59). The dial, the number
 * labels and the keyboard's Home/End/Page steps all use the same grid, so
 * `minuteStep: 15` can never surface an impossible 09:05 slot.
 */
export function snapMinute(value: number, step = 1): number {
  const safeStep = Math.min(30, Math.max(1, Math.round(step) || 1));
  const snapped = Math.round(value / safeStep) * safeStep;
  return ((snapped % 60) + 60) % 60;
}

/**
 * Position of a dial value on the square face, in percent of the face box:
 * `value` counts clockwise from 12 o'clock across `total` slots, and
 * `radiusPct` is the distance from the center in percent of the box.
 */
export function dialPoint(value: number, total: number, radiusPct = 38): { x: number; y: number } {
  const angle = ((value % total) / total) * Math.PI * 2;
  return {
    x: 50 + radiusPct * Math.sin(angle),
    y: 50 - radiusPct * Math.cos(angle),
  };
}

/** Pointer position → dial angle in degrees (0 = 12 o'clock, clockwise). */
function pointerAngle(el: HTMLElement, clientX: number, clientY: number): number {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return 0;
  const dx = clientX - (rect.left + rect.width / 2);
  const dy = clientY - (rect.top + rect.height / 2);
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

function clampMinuteStep(step: number): number {
  return Math.min(30, Math.max(1, Math.round(step) || 1));
}

export default defineComponent({
  name: "HkTimePicker",
  props: {
    /** `HH:mm` (24-hour). `""` = no value yet. */
    modelValue: { type: String, default: "" },
    label: { type: String, default: undefined },
    /** Suppress the caption above the control while keeping `label` semantic. */
    hideLabel: { type: Boolean, default: false },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    clearable: { type: Boolean, default: true },
    /** Minute dial/keyboard granularity (1, 5, 10, 15, 30). */
    minuteStep: { type: Number, default: 1 },
    /** Sheet/popup surface title. */
    title: { type: String, default: undefined },
    confirmLabel: { type: String, default: undefined },
    cancelLabel: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: string) => true,
    /** Fired on a committed change (confirm / Now / clear), never on cancel. */
    change: (_value: string) => true,
    open: () => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const { isMobile } = useBreakpoint();
    const generatedId = useId();
    const labelId = `hk-tp-label-${generatedId}`;

    const open = ref(false);
    const mode = ref<"hour" | "minute">("hour");
    const draftHour = ref(0);
    const draftMinute = ref(0);
    const dragging = ref(false);
    const triggerRef = ref<HTMLElement | null>(null);
    const faceRef = ref<HTMLElement | null>(null);

    const parsed = computed(() => parseHhmm(props.modelValue));
    const hasValue = computed(() => parsed.value !== null);
    const minuteStep = computed(() => clampMinuteStep(props.minuteStep));
    const pm = computed(() => draftHour.value >= 12);
    const hour12 = computed(() => to12Hour(draftHour.value).hour12);
    const isTouch = computed(() => isMobile.value);

    const displayValue = computed(() =>
      parsed.value
        ? formatHhmm(parsed.value.hour, parsed.value.minute)
        : (props.placeholder ?? t("hikari::timePicker.placeholder", "Pick a time")),
    );

    const surfaceTitle = computed(() => props.title ?? t("hikari::timePicker.title", "Pick a time"));

    /** Seed the draft from the model, falling back to the current clock time
     *  (the picker has no null semantics: an empty model still opens on a
     *  concrete, immediately-confirmable time). */
    function seedDraft(): void {
      const current = parsed.value ?? (() => {
        const now = new Date();
        // The synthesized branches are the only minutes the host never
        // chose, so they must land on the step grid; a STORED off-grid
        // model stays verbatim (the user can still re-pick it).
        return { hour: now.getHours(), minute: snapMinute(now.getMinutes(), props.minuteStep) };
      })();
      draftHour.value = current.hour;
      draftMinute.value = current.minute;
    }

    function openPanel(): void {
      if (props.disabled) return;
      seedDraft();
      mode.value = "hour";
      open.value = true;
      emit("open");
      void nextTick(() => faceRef.value?.focus());
    }

    function closeWithoutCommit(): void {
      dragging.value = false;
      open.value = false;
    }

    function toggle(): void {
      if (open.value) closeWithoutCommit();
      else openPanel();
    }

    function commit(value: string): void {
      open.value = false;
      emit("update:modelValue", value);
      emit("change", value);
    }

    function confirm(): void {
      commit(formatHhmm(draftHour.value, draftMinute.value));
    }

    function onClear(e: Event): void {
      e.stopPropagation();
      commit("");
    }

    function setNow(): void {
      const now = new Date();
      draftHour.value = now.getHours();
      draftMinute.value = snapMinute(now.getMinutes(), minuteStep.value);
      commit(formatHhmm(draftHour.value, draftMinute.value));
    }

    function setPeriod(nextPm: boolean): void {
      draftHour.value = from12Hour(hour12.value, nextPm);
    }

    function selectHour(nextHour12: number): void {
      const nextPm = pm.value;
      draftHour.value = from12Hour(nextHour12, nextPm);
      // Material's clock advances to minutes once an hour is picked; the
      // readout stays clickable, so this is a shortcut, never a trap.
      if (mode.value === "hour") mode.value = "minute";
    }

    function selectMinute(nextMinute: number): void {
      draftMinute.value = snapMinute(nextMinute, minuteStep.value);
    }

    function onTriggerKeydown(e: KeyboardEvent): void {
      if (props.disabled) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        if (open.value) faceRef.value?.focus();
        else openPanel();
      } else if (e.key === "Escape" && open.value) {
        e.preventDefault();
        closeWithoutCommit();
      }
    }

    function applyPointer(clientX: number, clientY: number): void {
      const el = faceRef.value;
      if (!el) return;
      const angle = pointerAngle(el, clientX, clientY);
      if (mode.value === "hour") {
        draftHour.value = from12Hour(angleToHour12(angle), pm.value);
      } else {
        draftMinute.value = angleToMinute(angle, minuteStep.value);
      }
    }

    function onFacePointerDown(e: PointerEvent): void {
      if (props.disabled) return;
      dragging.value = true;
      const el = faceRef.value;
      if (el && typeof el.setPointerCapture === "function") {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // Synthetic events (tests, old engines) have no active pointer.
        }
      }
      applyPointer(e.clientX, e.clientY);
    }

    function onFacePointerMove(e: PointerEvent): void {
      if (!dragging.value) return;
      applyPointer(e.clientX, e.clientY);
    }

    function onFacePointerUp(e: PointerEvent): void {
      if (!dragging.value) return;
      dragging.value = false;
      const el = faceRef.value;
      if (el && typeof el.releasePointerCapture === "function") {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          // See onFacePointerDown.
        }
      }
      if (mode.value === "hour") mode.value = "minute";
    }

    function onFaceKeydown(e: KeyboardEvent): void {
      if (props.disabled) return;
      const step = minuteStep.value;
      const hourMode = mode.value === "hour";
      let next: number | null = null;
      let current = hourMode ? draftHour.value : draftMinute.value;
      if (e.key === "ArrowUp" || e.key === "ArrowRight") next = current + (hourMode ? 1 : step);
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = current - (hourMode ? 1 : step);
      else if (e.key === "PageUp") next = current + (hourMode ? 5 : step * 5);
      else if (e.key === "PageDown") next = current - (hourMode ? 5 : step * 5);
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = hourMode ? 23 : Math.floor(59 / step) * step;
      if (next === null) return;
      e.preventDefault();
      if (hourMode) draftHour.value = ((next % 24) + 24) % 24;
      else draftMinute.value = snapMinute(next, step);
    }

    const hand = computed(() => {
      const hourMode = mode.value === "hour";
      const value = hourMode ? hour12.value % 12 : draftMinute.value;
      return dialPoint(value, hourMode ? 12 : 60, 38);
    });

    const ticks = Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2;
      const inner = i % 5 === 0 ? 42.5 : 45;
      return {
        key: i,
        major: i % 5 === 0,
        x1: 50 + inner * Math.sin(angle),
        y1: 50 - inner * Math.cos(angle),
        x2: 50 + 48 * Math.sin(angle),
        y2: 50 - 48 * Math.cos(angle),
      };
    });

    const hourNumbers = computed(() =>
      Array.from({ length: 12 }, (_, i) => {
        const value = i + 1;
        const point = dialPoint(value % 12, 12);
        return {
          value,
          label: String(value),
          selected: value === hour12.value,
          x: point.x,
          y: point.y,
        };
      }),
    );

    /** The dial labels are shortcuts onto the same step grid the dial
     *  snaps to: every 5-minute mark is snapped to the step and duplicates
     *  collapse, so `minuteStep: 15` renders 00 / 15 / 30 / 45 (not a
     *  00..55 row that would let a click commit 09:05). */
    const minuteNumbers = computed(() => {
      const step = minuteStep.value;
      const seen = new Set<number>();
      const out: Array<{ value: number; label: string; selected: boolean; x: number; y: number }> = [];
      for (let i = 0; i < 12; i += 1) {
        const value = snapMinute(i * 5, step);
        if (seen.has(value)) continue;
        seen.add(value);
        const point = dialPoint(value, 60);
        out.push({
          value,
          label: String(value).padStart(2, "0"),
          selected: value === draftMinute.value,
          x: point.x,
          y: point.y,
        });
      }
      return out;
    });

    const numbers = computed(() => (mode.value === "hour" ? hourNumbers.value : minuteNumbers.value));
    const ariaValueNow = computed(() => (mode.value === "hour" ? draftHour.value : draftMinute.value));
    const ariaValueMax = computed(() => (mode.value === "hour" ? 23 : 59));
    const ariaFaceLabel = computed(() =>
      mode.value === "hour"
        ? t("hikari::dateTimePicker.hour", "Hour")
        : t("hikari::dateTimePicker.minute", "Minute"),
    );

    const triggerAriaLabel = computed(() => {
      if (props.label && !props.hideLabel) return undefined;
      return props.label ?? t("hikari::timePicker.title", "Pick a time");
    });

    // A host that disables the field while its popover is open must not be
    // left with a live editor floating over a disabled control.
    watch(
      () => props.disabled,
      (disabled) => {
        if (disabled) closeWithoutCommit();
      },
    );

    function renderPanel() {
      return (
        <div
          class={["hk-tp-panel", isTouch.value ? "is-touch" : ""].filter(Boolean).join(" ")}
          role="group"
          aria-label={surfaceTitle.value}
        >
          <div
            class="hk-tp-period"
            role="group"
            aria-label={t("hikari::timePicker.period", "Day period")}
          >
            <button
              type="button"
              class={["hk-tp-period-btn", !pm.value ? "is-active" : ""].filter(Boolean).join(" ")}
              aria-pressed={!pm.value}
              onClick={() => setPeriod(false)}
            >
              <Sun size={13} />
              <span>{t("hikari::timePicker.am", "AM")}</span>
            </button>
            <button
              type="button"
              class={["hk-tp-period-btn", pm.value ? "is-active" : ""].filter(Boolean).join(" ")}
              aria-pressed={pm.value}
              onClick={() => setPeriod(true)}
            >
              <Moon size={13} />
              <span>{t("hikari::timePicker.pm", "PM")}</span>
            </button>
          </div>

          <div class="hk-tp-readout">
            <button
              type="button"
              class={["hk-tp-readout-btn", mode.value === "hour" ? "is-active" : ""].filter(Boolean).join(" ")}
              aria-label={t("hikari::timePicker.editHour", "Edit hour")}
              aria-pressed={mode.value === "hour"}
              onClick={() => (mode.value = "hour")}
            >
              {String(hour12.value).padStart(2, "0")}
            </button>
            <span class="hk-tp-readout-sep" aria-hidden="true">:</span>
            <button
              type="button"
              class={["hk-tp-readout-btn", mode.value === "minute" ? "is-active" : ""].filter(Boolean).join(" ")}
              aria-label={t("hikari::timePicker.editMinute", "Edit minute")}
              aria-pressed={mode.value === "minute"}
              onClick={() => (mode.value = "minute")}
            >
              {String(draftMinute.value).padStart(2, "0")}
            </button>
          </div>

          <div class="hk-tp-dial">
            <div class="hk-tp-dial-stage">
              <div
                ref={faceRef}
                class="hk-tp-face"
                role="slider"
                tabindex={0}
                aria-label={ariaFaceLabel.value}
                aria-valuemin={0}
                aria-valuemax={ariaValueMax.value}
                aria-valuenow={ariaValueNow.value}
                aria-valuetext={formatHhmm(draftHour.value, draftMinute.value)}
                onPointerdown={onFacePointerDown}
                onPointermove={onFacePointerMove}
                onPointerup={onFacePointerUp}
                onPointercancel={onFacePointerUp}
                onKeydown={onFaceKeydown}
              >
                <svg class="hk-tp-ticks" viewBox="0 0 100 100" aria-hidden="true">
                  {ticks.map((tick) => (
                    <line
                      key={tick.key}
                      class={tick.major ? "is-major" : "is-minor"}
                      x1={tick.x1}
                      y1={tick.y1}
                      x2={tick.x2}
                      y2={tick.y2}
                    />
                  ))}
                </svg>
                <svg class="hk-tp-hand" viewBox="0 0 100 100" aria-hidden="true">
                  <line x1={50} y1={50} x2={hand.value.x} y2={hand.value.y} />
                  <circle class="hk-tp-hand-tip" cx={hand.value.x} cy={hand.value.y} r={2.6} />
                  <circle class="hk-tp-hand-hub" cx={50} cy={50} r={1.8} />
                </svg>
              </div>
              {/* Outside the slider on purpose: role=slider has
                  presentational children, so focusable numbers inside it
                  would lose their role/name in the AT tree. The layer is
                  pointer-transparent; the buttons re-enable pointer
                  events, and drags between them reach the face below. */}
              <div class={["hk-tp-numbers", mode.value === "hour" ? "is-hour" : "is-minute"].join(" ")}>
                {numbers.value.map((number) => (
                  <button
                    key={number.value}
                    type="button"
                    class={[
                      "hk-tp-number",
                      number.selected ? "is-selected" : "",
                    ].filter(Boolean).join(" ")}
                    style={{ left: `${number.x}%`, top: `${number.y}%` }}
                    aria-label={
                      mode.value === "hour"
                        ? `${t("hikari::dateTimePicker.hour", "Hour")} ${number.label}`
                        : `${t("hikari::dateTimePicker.minute", "Minute")} ${number.label}`
                    }
                    onPointerdown={(e: PointerEvent) => e.stopPropagation()}
                    onClick={(e: MouseEvent) => {
                      e.stopPropagation();
                      if (mode.value === "hour") selectHour(number.value);
                      else selectMinute(number.value);
                    }}
                  >
                    {number.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div class="hk-tp-footer">
            <HkButton variant="ghost" size="sm" class="hk-tp-now" onClick={setNow}>
              {t("hikari::timePicker.now", "Now")}
            </HkButton>
            <div class="hk-tp-actions">
              <HkButton
                variant="secondary"
                size="sm"
                class="hk-tp-cancel"
                onClick={closeWithoutCommit}
              >
                {props.cancelLabel ?? t("hikari::messageBox.cancel", "Cancel")}
              </HkButton>
              <HkButton
                variant="primary"
                size="sm"
                class="hk-tp-confirm"
                onClick={confirm}
              >
                <Check size={13} class="hk-tp-confirm-icon" />
                {props.confirmLabel ?? t("hikari::messageBox.ok", "OK")}
              </HkButton>
            </div>
          </div>
        </div>
      );
    }

    return () => (
      <div
        class={[
          "hk-tp",
          props.disabled ? "is-disabled" : "",
          `hk-tp-${props.size}`,
        ].filter(Boolean).join(" ")}
      >
        {props.label && !props.hideLabel && (
          <span class="hk-tp-label" id={labelId}>
            {props.label}
          </span>
        )}
        <div
          ref={triggerRef}
          class={["hk-tp-trigger", `hk-tp-trigger-${props.size}`, open.value ? "is-open" : ""].filter(Boolean).join(" ")}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open.value}
          aria-labelledby={props.label && !props.hideLabel ? labelId : undefined}
          aria-label={triggerAriaLabel.value}
          aria-disabled={props.disabled || undefined}
          tabindex={props.disabled ? -1 : 0}
          onClick={toggle}
          onKeydown={onTriggerKeydown}
        >
          <span class="hk-tp-value" data-empty={!hasValue.value || undefined}>
            {displayValue.value}
          </span>
          {props.clearable && hasValue.value && !props.disabled && (
            <button
              type="button"
              class="hk-tp-clear"
              tabindex={-1}
              aria-label={t("hikari::timePicker.clear", "Clear time")}
              onClick={onClear}
              onKeydown={(e: KeyboardEvent) => e.stopPropagation()}
            >
              <X size={13} />
            </button>
          )}
          <span class="hk-tp-icon" aria-hidden="true">
            <Clock size={15} />
          </span>
        </div>
        <HPopover
          modelValue={open.value}
          onUpdate:modelValue={(value: boolean) => {
            if (!value) closeWithoutCommit();
          }}
          anchorRef={triggerRef.value ?? null}
          placement="bottom-start"
          offset={6}
          backdrop={false}
          sheetOnMobile
          title={surfaceTitle.value}
          class="hk-tp-popover"
        >
          {renderPanel()}
        </HPopover>
      </div>
    );
  },
});
