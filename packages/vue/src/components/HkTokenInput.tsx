import { computed, defineComponent, ref, watch, type PropType } from "vue";

import HkAdaptiveDialog from "./HkAdaptiveDialog";
import HkInput from "./HkInput";
import HkSelect from "./HkSelect";
import { X } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import "./HkTokenInput.scss";

export type TokenUnit = "K" | "M" | "B";

const UNIT_SCALE: Record<TokenUnit, number> = { K: 1e3, M: 1e6, B: 1e9 };

/** Decimal compaction — 1.5M, 128K, 750 (plain under 1K). The default
 *  `format`; hosts may pass their own. */
export function compactTokenCount(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  if (value >= 1e9) return `${trim(value / 1e9)}B`;
  if (value >= 1e6) return `${trim(value / 1e6)}M`;
  if (value >= 1e3) return `${trim(value / 1e3)}K`;
  return String(Math.round(value));
}

function trim(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * HkTokenInput — the standalone token-budget EDITOR control: a value
 * segment (click to open the precision editor) plus a unit suffix
 * dropdown (auto/K/M/B). No opinion about WHERE it sits — hosts drop
 * it into any slot (commonly HkSliderField's trailing slot; the
 * composition lives in the host).
 *
 * The precision editor is a DRAGGABLE desktop window / slide-up
 * mobile sheet (HkAdaptiveDialog): a numeric input (major) plus a
 * unit picker (minor), both live-commit; a unit flip re-expresses the
 * same absolute budget (1.5M ⇄ 1500K) instead of rescaling it; a
 * clear action unsets. Transiently unparseable intermediates ("1e")
 * commit nothing. An `#editor` slot may replace the built-in body.
 */
export default defineComponent({
  name: "HkTokenInput",
  props: {
    /** Absolute token count; null = unset. */
    modelValue: { type: Number as () => number | null, default: null },
    /** Display/entry unit; "auto" compacts (128K, 1.5M). */
    unit: { type: String as () => "auto" | TokenUnit, default: "auto" },
    disabled: { type: Boolean, default: false },
    /** The precision editor's title (popup naming contract). */
    editorTitle: { type: String, default: undefined },
    /** Display formatter; defaults to decimal compaction. */
    format: {
      type: Function as PropType<(value: number | null, unit: "auto" | TokenUnit) => string>,
      default: undefined,
    },
    ariaLabel: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_value: number | null) => true,
    "update:unit": (_unit: "auto" | TokenUnit) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const editorOpen = ref(false);
    /** The unit the EDITOR works in — seeded from the display unit
     *  (auto compacts to the value's natural magnitude). */
    const editorUnit = ref<TokenUnit>("K");
    const resolvedEditorTitle = computed(
      () => props.editorTitle ?? t("hikari::tokenField.editValue", "Edit value"),
    );
    const clearLabel = computed(() => t("hikari::tokenField.clear", "Clear"));

    function display(): string {
      if (props.format) return props.format(props.modelValue, props.unit);
      if (props.modelValue == null) return "—";
      if (props.unit !== "auto") {
        return `${trim(props.modelValue / UNIT_SCALE[props.unit])}${props.unit}`;
      }
      return compactTokenCount(props.modelValue);
    }

    function seedEditorUnit() {
      if (props.unit !== "auto") {
        editorUnit.value = props.unit;
        return;
      }
      const v = props.modelValue;
      editorUnit.value = v == null ? "K" : v >= 1e9 ? "B" : v >= 1e6 ? "M" : "K";
    }

    function openEditor() {
      if (props.disabled) return;
      seedEditorUnit();
      editorOpen.value = true;
    }

    const unitOptions = computed(() => [
      { value: "auto", label: "auto" },
      { value: "K", label: "K" },
      { value: "M", label: "M" },
      { value: "B", label: "B" },
    ]);

    function switchSuffixUnit(next: string) {
      emit("update:unit", next as "auto" | TokenUnit);
    }

    function clearValue() {
      emit("update:modelValue", null);
      editorOpen.value = false;
    }

    return () => (
      <div
        class={["hk-token-input", props.disabled && "is-disabled"].filter(Boolean).join(" ")}
        role="group"
        aria-label={props.ariaLabel}
      >
        <button
          type="button"
          class="hk-token-input-value"
          disabled={props.disabled}
          aria-haspopup="dialog"
          aria-label={`${resolvedEditorTitle.value}: ${display()}`}
          onClick={openEditor}
          title={resolvedEditorTitle.value}
        >
          {display()}
        </button>
        <HkSelect
          class="hk-token-input-unit"
          modelValue={props.unit}
          options={unitOptions.value}
          disabled={props.disabled}
          onUpdate:modelValue={switchSuffixUnit}
        />
        <HkAdaptiveDialog
          modelValue={editorOpen.value}
          onUpdate:modelValue={(v: boolean) => (editorOpen.value = v)}
          title={resolvedEditorTitle.value}
          width="22rem"
          draggable
        >
          {{
            default: () =>
              slots.editor ? (
                slots.editor({
                  value: props.modelValue,
                  unit: editorUnit.value,
                  close: () => (editorOpen.value = false),
                })
              ) : (
                <div class="hk-token-input-editor-body">
                  <HkTokenValueEditor
                    modelValue={props.modelValue}
                    unit={editorUnit.value}
                    onUpdate:modelValue={(v: number | null) => emit("update:modelValue", v)}
                    onUpdate:unit={(u: TokenUnit) => (editorUnit.value = u)}
                  />
                  <button
                    type="button"
                    class="hk-token-input-clear"
                    aria-label={clearLabel.value}
                    onClick={clearValue}
                  >
                    <X size={13} />
                  </button>
                </div>
              ),
          }}
        </HkAdaptiveDialog>
      </div>
    );
  },
});

/** The precision editor's numeric body: value input (major) + unit
 * picker (minor), live-committing unit-scaled absolutes. Internal to
 * this file (hosts wanting a custom body use the #editor slot). */
const HkTokenValueEditor = defineComponent({
  name: "HkTokenValueEditor",
  props: {
    modelValue: { type: Number as () => number | null, default: null },
    unit: { type: String as () => TokenUnit, default: "K" },
  },
  emits: {
    "update:modelValue": (_value: number | null) => true,
    "update:unit": (_unit: TokenUnit) => true,
  },
  setup(props, { emit }) {
    const text = ref("");
    /** The absolute we last emitted — a round-tripped prop equal to it
     *  is OUR OWN commit echoing back, not an external change: skip
     *  the rescale or typing gets clobbered mid-edit. */
    let lastEmitted: number | null = null;

    function rescale(value: number | null, unit: TokenUnit) {
      if (value == null || !Number.isFinite(value) || value <= 0) {
        text.value = "";
        return;
      }
      text.value = String(Math.round((value / UNIT_SCALE[unit]) * 100) / 100);
    }

    watch(
      () => [props.modelValue, props.unit] as const,
      ([value, unit], prev) => {
        if (!prev) {
          rescale(value, unit);
          return;
        }
        const [prevValue, prevUnit] = prev;
        if (value !== prevValue && value === lastEmitted) return;
        if (value === prevValue && unit !== prevUnit) {
          // A pure unit flip (the host round-tripped update:unit):
          // re-express our own text — switchUnit already did.
          return;
        }
        // An external change: whatever we last emitted is stale as an
        // echo marker.
        lastEmitted = null;
        rescale(value, unit);
      },
      { immediate: true },
    );

    function commit() {
      const raw = text.value.trim();
      // Only a deliberately emptied field unsets. A transiently
      // unparseable intermediate ("1e", "-", "") mid-typing commits
      // NOTHING — live consumers never see a flicker of null.
      if (!raw) {
        lastEmitted = null;
        emit("update:modelValue", null);
        return;
      }
      const n = Number(raw.replace(/[,_\s]/g, ""));
      if (!Number.isFinite(n) || n <= 0) return;
      lastEmitted = Math.round(n * UNIT_SCALE[props.unit]);
      emit("update:modelValue", lastEmitted);
    }

    const unitOptions = computed(() => [
      { value: "K", label: "K" },
      { value: "M", label: "M" },
      { value: "B", label: "B" },
    ]);

    function switchUnit(next: string) {
      const unit = next as TokenUnit;
      if (unit === props.unit) return;
      const n = Number(text.value.replace(/[,_\s]/g, ""));
      if (Number.isFinite(n) && n > 0) {
        const absolute = n * UNIT_SCALE[props.unit];
        text.value = String(Math.round((absolute / UNIT_SCALE[unit]) * 100) / 100);
      } else if (text.value.trim()) {
        // Unparseable text cannot be re-expressed: clearing is the
        // honest move (stale text under a new scale would commit a
        // 1000x jump on the next keystroke).
        text.value = "";
        lastEmitted = null;
        emit("update:modelValue", null);
      }
      emit("update:unit", unit);
    }

    return () => (
      <div class="hk-token-editor">
        <HkInput
          class="hk-token-editor-input"
          modelValue={text.value}
          onUpdate:modelValue={(v: string) => {
            text.value = v;
            commit();
          }}
        />
        <HkSelect
          class="hk-token-editor-unit"
          modelValue={props.unit}
          options={unitOptions.value}
          onUpdate:modelValue={switchUnit}
        />
      </div>
    );
  },
});
