import { ChevronDown, Globe2, X } from "lucide-vue-next";
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  ref,
  useId,
  type PropType,
} from "vue";

import { useI18n } from "../i18n/context";
import { useBreakpoint } from "../runtime/useBreakpoint";
import { pad2 } from "./calendarGrid";
import HkSelect, { type HkSelectOption } from "./HkSelect";
import HPopover from "./HkPopover";
import "./HkTimeZonePicker.scss";

// The globe picker loads lazily (module-level defineAsyncComponent — the
// async wrapper is created once, import() is module-cached): three.js and
// the 3D board only enter the bundle graph when a host actually opens the
// picker, exactly like HkSolarLocationSetting's manual pane. The board
// falls back to its flat sector list where WebGL is unavailable.
const HkTimeZoneGlobe = defineAsyncComponent(() => import("./HkTimeZoneGlobe"));

const OFFSET_RE = /^(?:GMT|UTC)(?:([+-])(\d{1,2})(?::(\d{1,2}))?)?$/;

/**
 * The exact UTC offset of a zone at `at` as `UTC+08:00` / `UTC-03:30` /
 * `UTC`, or `""` for an unusable id.
 *
 * The label is language-independent, so it is derived from
 * `Intl.DateTimeFormat(…, { timeZoneName: "longOffset" })` (which honours
 * DST through `at`) instead of a lookup table, and `GMT` — what V8 prints
 * for a zero offset — is normalized to `UTC`.
 */
export function formatZoneOffset(zone: string, at: Date = new Date()): string {
  if (!zone) return "";
  let name: string;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      timeZoneName: "longOffset",
    }).formatToParts(at);
    name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    // RangeError for an unknown IANA id — never let a bad value throw.
    return "";
  }
  const match = OFFSET_RE.exec(name.trim());
  if (!match) return "";
  // Zero offset: engines print either a bare "GMT"/"UTC" or "GMT+00:00"/
  // "GMT-00:00" depending on the ICU version — the contract is one label.
  const hours = Number(match[2] ?? "0");
  const minutes = Number(match[3] ?? "0");
  if (hours === 0 && minutes === 0) return "UTC";
  if (match[1] === undefined) return "UTC";
  return `UTC${match[1]}${pad2(hours)}:${pad2(minutes)}`;
}

/** `Intl.supportedValuesOf("timeZone")` where the runtime has it. */
function supportedZoneIds(): readonly string[] {
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => unknown })
      .supportedValuesOf;
    if (typeof supported !== "function") return [];
    const ids = supported.call(Intl, "timeZone");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * The runtime's own IANA zone — what "follow the system zone" resolves to
 * for the GLOBE'S eyes only (the model stays `""`). A local helper on
 * purpose: the picker has no business importing the solar-clock engine,
 * whose zone resolution carries strategy/persistence machinery this
 * field neither needs nor may trigger. Falls back to `UTC` where the
 * runtime reports no zone (SSR, stripped ICU).
 */
function systemZoneId(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * HkTimeZonePicker — the trigger-field wrapper around the IANA time-zone
 * GLOBE (2026-11-12 product direction: the peak-rule dialog picks its
 * zone on hikari's 3D sphere instead of a 400-row dropdown).
 *
 * The field itself mirrors HkDatePicker's trigger chrome (globe icon,
 * value, a small exact-offset chip, clear, chevron) and opens an
 * HkPopover that docks as a bottom sheet on touch widths. Inside it:
 * `HkTimeZoneGlobe` (sector wedges; each sector emits its representative
 * IANA id) plus an exact-zone `HkSelect` for the ids the 24 sectors
 * cannot express, and a "use system time zone" action that clears the
 * model back to `""` (follow the system/server zone).
 *
 * Contract notes:
 *   · the model is passed through VERBATIM — a stored half-hour id
 *     (Asia/Kolkata, Australia/Adelaide …) is never rewritten to a
 *     sector's representative id; only an explicit re-pick changes it;
 *   · the exact-zone list defaults to `Intl.supportedValuesOf("timeZone")`
 *     and the select is hidden where that API (or a host-supplied list)
 *     is unavailable — the globe stays usable either way; a stored id
 *     outside a host's curated list is prepended to the rows so foreign
 *     values round-trip visibly instead of rendering against no option;
 *   · `""` is a real value meaning "follow the system zone", so it is
 *     rendered as `emptyLabel` rather than as an empty field — and the
 *     GLOBE is oriented to the resolved system id for display while the
 *     model itself stays `""` (the wrapper never emits a resolution).
 */
export default defineComponent({
  name: "HkTimeZonePicker",
  props: {
    /** IANA zone id; `""` = follow the system/server local zone. */
    modelValue: { type: String, default: "" },
    label: { type: String, default: undefined },
    hideLabel: { type: Boolean, default: false },
    placeholder: { type: String, default: undefined },
    disabled: { type: Boolean, default: false },
    size: { type: String as PropType<"sm" | "md">, default: "md" },
    /** Show the clear affordance + the "use system time zone" row. */
    clearable: { type: Boolean, default: true },
    /** Label rendered for `""` (the system zone). */
    emptyLabel: { type: String, default: undefined },
    /** Exact-zone candidates; default `Intl.supportedValuesOf("timeZone")`. */
    zones: { type: Array as PropType<readonly string[]>, default: undefined },
    /** Caption of the exact-zone select. */
    exactLabel: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_zone: string) => true,
    change: (_zone: string) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();
    const { isMobile } = useBreakpoint();
    const generatedId = useId();
    const labelId = `hk-tzp-label-${generatedId}`;

    const zone = computed(() => props.modelValue ?? "");
    const hasZone = computed(() => zone.value.length > 0);
    const offsetText = computed(() => (hasZone.value ? formatZoneOffset(zone.value) : ""));
    const displayText = computed(() =>
      hasZone.value
        ? zone.value
        : (props.emptyLabel ?? t("hikari::timeZonePicker.system", "System time zone")));

    const triggerAriaLabel = computed(() => {
      if (props.label && !props.hideLabel) return undefined;
      return props.label ?? props.placeholder ?? t("hikari::timeZonePicker.placeholder", "Pick a time zone");
    });

    /** What the GLOBE is oriented to. `""` means "the system zone", and
     *  the globe has no empty sector — handing it `""` would resolve to
     *  the UTC wedge and read out UTC/London next to a trigger that says
     *  "System time zone". Resolve the system id for DISPLAY only; the
     *  wrapper's model stays `""` and nothing is emitted. */
    const globeZone = computed(() => zone.value || systemZoneId());

    // ── Exact-zone candidates ───────────────────────────────────────
    const zoneCandidates = computed<readonly string[]>(() =>
      props.zones ?? supportedZoneIds());
    /** No candidate source (old runtime without `supportedValuesOf`, or a
     *  host that passed an empty list) → the select steps aside instead of
     *  rendering an empty dropdown; the globe still works. */
    const showExact = computed(() => zoneCandidates.value.length > 0);

    /**
     * The select's rows. A host list is a curated subset (the peak-rule
     * dialog passes ~50 ids) and the globe emits its own 24
     * representatives, while stored rows may hold any historical id — so
     * a CURRENT value outside the list is prepended (label = the id, the
     * historic host dropdown's "foreign value round-trips visibly"
     * behaviour). Without it HkSelect would fall back to rendering the
     * raw id against no matching row. Membership is checked by id, so a
     * value that already IS a candidate is never duplicated.
     *
     * Gated on `showExact` on purpose: an unavailable candidate SOURCE
     * still hides the select entirely (the frozen contract) instead of
     * degrading into a one-row dropdown.
     */
    const exactOptions = computed<HkSelectOption[]>(() => {
      const candidates = zoneCandidates.value;
      if (!showExact.value) return [];
      const options = candidates.map((id) => ({ value: id, label: id }));
      const current = zone.value;
      if (current && !candidates.includes(current)) {
        options.unshift({ value: current, label: current });
      }
      return options;
    });

    const exactLabelText = computed(() =>
      props.exactLabel ?? t("hikari::timeZonePicker.exact", "Exact time zone"));
    const placeholderText = computed(() =>
      props.placeholder ?? t("hikari::timeZonePicker.placeholder", "Pick a time zone"));
    const useSystemText = computed(() =>
      t("hikari::timeZonePicker.useSystem", "Use system time zone"));
    const popoverTitle = computed(() =>
      t("hikari::timeZonePicker.title", "Pick a time zone"));

    // ── Field + popup wiring ────────────────────────────────────────
    const open = ref(false);
    const triggerRef = ref<HTMLElement | null>(null);
    const isTouch = computed(() => isMobile.value);

    function commit(next: string) {
      if (props.disabled) return;
      if (next === zone.value) return;
      emit("update:modelValue", next);
      emit("change", next);
    }

    function toggle() {
      if (props.disabled) return;
      open.value = !open.value;
    }

    function onTriggerKeydown(e: KeyboardEvent) {
      if (props.disabled) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        if (!open.value) open.value = true;
      } else if (e.key === "Escape" && open.value) {
        e.preventDefault();
        open.value = false;
      }
    }

    function onClear(e: MouseEvent) {
      // The clear affordance must never double as "open the picker".
      e.stopPropagation();
      commit("");
    }

    return () => {
      const offset = offsetText.value;
      return (
        <div class={["hk-tzp", props.disabled ? "is-disabled" : ""].filter(Boolean).join(" ")}>
          {props.label && !props.hideLabel && (
            <span class="hk-tzp-label" id={labelId}>{props.label}</span>
          )}
          <div
            ref={triggerRef}
            class={[
              "hk-tzp-trigger",
              `hk-tzp-trigger-${props.size}`,
              open.value ? "is-open" : "",
            ].filter(Boolean).join(" ")}
            role="combobox"
            aria-haspopup="dialog"
            aria-expanded={open.value}
            aria-disabled={props.disabled || undefined}
            aria-labelledby={props.label && !props.hideLabel ? labelId : undefined}
            aria-label={triggerAriaLabel.value}
            tabindex={props.disabled ? -1 : 0}
            onClick={toggle}
            onKeydown={onTriggerKeydown}
          >
            <span class="hk-tzp-icon" aria-hidden="true">
              <Globe2 size={15} />
            </span>
            <span class="hk-tzp-value" data-empty={!hasZone.value || undefined}>
              {displayText.value}
            </span>
            {offset && <span class="hk-tzp-offset">{offset}</span>}
            {props.clearable && hasZone.value && !props.disabled && (
              <button
                type="button"
                class="hk-tzp-clear"
                tabindex={-1}
                // Clearing IS "follow the system zone", so the action's
                // own name doubles as the clear affordance's name (the
                // frozen key set has no separate `clear` string).
                aria-label={useSystemText.value}
                onClick={onClear}
                onKeydown={(e) => e.stopPropagation()}
              >
                <X size={14} />
              </button>
            )}
            <span class="hk-tzp-chevron" aria-hidden="true">
              <ChevronDown size={15} />
            </span>
          </div>

          <HPopover
            modelValue={open.value}
            onUpdate:modelValue={(v: boolean) => { open.value = v; }}
            anchorRef={triggerRef.value ?? null}
            placement="bottom-start"
            offset={6}
            backdrop={false}
            sheetOnMobile
            title={popoverTitle.value}
            padding="md"
            class="hk-tzp-popover"
          >
            <div class={["hk-tzp-panel", isTouch.value ? "is-touch" : ""].filter(Boolean).join(" ")}>
              {/* The globe keeps the model VERBATIM: a stored half-hour id
                  survives until the user actually re-picks a sector. The
                  `""` model is the one exception the DIRECTION needs — it
                  is displayed as the resolved system zone, while the model
                  itself stays `""` (see globeZone). */}
              <div class="hk-tzp-globe">
                <HkTimeZoneGlobe
                  modelValue={globeZone.value}
                  onUpdate:modelValue={(next: string) => commit(next)}
                />
              </div>
              {showExact.value && (
                <div class="hk-tzp-exact">
                  <HkSelect
                    label={exactLabelText.value}
                    modelValue={zone.value}
                    options={exactOptions.value}
                    placeholder={placeholderText.value}
                    disabled={props.disabled}
                    onUpdate:modelValue={(next: string) => commit(next)}
                  />
                </div>
              )}
              {props.clearable && (
                <button
                  type="button"
                  class="hk-tzp-system"
                  onClick={() => commit("")}
                >
                  {useSystemText.value}
                </button>
              )}
            </div>
          </HPopover>
        </div>
      );
    };
  },
});
