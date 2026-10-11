import { computed, defineComponent, ref, watch, type PropType } from "vue";

import { useI18n } from "../i18n/context";

import HkAdaptiveDialog from "./HkAdaptiveDialog";
import HkInput from "./HkInput";
import HkSelect from "./HkSelect";
import HkSlider from "./HkSlider";
import { X } from "lucide-vue-next";

import "./HkTokenField.scss";

/** The ladder the field snaps to: each stop doubles the previous one,
 *  16K → 4M (the curation the model editor asked for — token budgets
 *  cluster on powers of two). Hosts may pass their own. */
export const DEFAULT_TOKEN_STOPS = [
  16_000, 32_000, 64_000, 128_000, 256_000, 512_000, 1_000_000, 2_000_000, 4_000_000,
] as const;

export type TokenUnit = "K" | "M" | "B";

const UNIT_SCALE: Record<TokenUnit, number> = { K: 1e3, M: 1e6, B: 1e9 };

/** Decimal token compaction — 1.5M, 128K, 750 (plain under 1K). */
export function compactTokens(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (value >= 1e9) return `${trim(value / 1e9)}B`;
  if (value >= 1e6) return `${trim(value / 1e6)}M`;
  if (value >= 1e3) return `${trim(value / 1e3)}K`;
  return String(Math.round(value));
}

function trim(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r);
}

/** The default precision editor body: a big numeric input (left) plus
 * a unit picker (right) — both live-commit. Exposed for hosts that
 * mount it inside their own `#editor` slot chrome. */
export const HkTokenValueEditor = defineComponent({
  name: "HkTokenValueEditor",
  props: {
    /** Absolute token count; null = unset. */
    modelValue: { type: Number as () => number | null, default: null },
    /** Entry unit for the numeric input (K = the input reads
     * thousands). Hosts may preselect; defaults from the value. */
    unit: { type: String as () => TokenUnit, default: "K" },
    stops: { type: Array as () => number[], required: true },
  },
  emits: {
    "update:modelValue": (_value: number | null) => true,
    "update:unit": (_unit: TokenUnit) => true,
  },
  setup(props, { emit }) {
    /** The numeric text in the CURRENT unit; rescaled when the unit
     * flips so the absolute value never moves underneath. */
    const text = ref("");
    /** The absolute we last emitted — a round-tripped prop equal to it
     * is OUR OWN commit echoing back, not an external change: skip
     * the rescale or typing gets clobbered mid-edit (select-all + "0"
     * used to swallow the keystroke; "1e" cleared the field). */
    let lastEmitted: number | null = null;

    function rescale(value: number | null, unit: TokenUnit) {
      if (value == null || !Number.isFinite(value) || value <= 0) {
        text.value = "";
        return;
      }
      const scaled = value / UNIT_SCALE[unit];
      text.value = String(Math.round(scaled * 100) / 100);
    }

    watch(
      () => [props.modelValue, props.unit] as const,
      ([value, unit], prev) => {
        // The immediate first run has no previous pair — seed.
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
      // Re-express the SAME absolute value in the new unit first, so a
      // flip never multiplies the budget by 1000. Transiently
      // unparseable text cannot be re-expressed — clearing it is the
      // honest move (a stale number under a new scale would commit a
      // 1000x jump on the next keystroke).
      const n = Number(text.value.replace(/[,_\s]/g, ""));
      if (Number.isFinite(n) && n > 0) {
        const absolute = n * UNIT_SCALE[props.unit];
        text.value = String(Math.round((absolute / UNIT_SCALE[unit]) * 100) / 100);
      } else if (text.value.trim()) {
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

/**
 * HkTokenField — one integrated box for token-scale budgets: the left
 * (major) part is a stepped slider over a doubling ladder (16K → 4M by
 * default); the right part is the exact value, clickable to open a
 * precision editor (a draggable desktop window / a slide-up mobile
 * sheet via HkAdaptiveDialog) where any value may be typed and the
 * unit switched (K/M/B). The box's unit suffix is itself a dropdown —
 * the same K/M/B choice, switching the display and the editor's entry
 * unit. Values off the ladder survive: the slider thumb rests at the
 * nearest stop while the exact value stands until the user drags.
 *
 * Composition: hosts may replace the built-in editor entirely through
 * the `#editor` slot (the two-business-component strategy the model
 * editor asked for) — the slot receives `{ value, unit, close }`.
 */
export default defineComponent({
  name: "HkTokenField",
  props: {
    /** Absolute token count; null = unset (nothing chosen yet). */
    modelValue: { type: Number as () => number | null, default: null },
    /** Ascending stop ladder; the slider works in index space so the
     *  geometric rungs sit evenly. */
    stops: {
      type: Array as () => number[],
      default: () => [...DEFAULT_TOKEN_STOPS],
    },
    /** Display/entry unit; "auto" compacts (128K, 1.5M). */
    unit: { type: String as () => "auto" | TokenUnit, default: "auto" },
    disabled: { type: Boolean, default: false },
    ariaLabel: { type: String, default: undefined },
    /** The precision editor's title. */
    editorTitle: { type: String, default: undefined },
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
    /** The popup contract wants every window named; hosts that don't
     *  care still get the stock string (never the dev warning). */
    const resolvedEditorTitle = computed(
      () => props.editorTitle ?? t("hikari::tokenField.editValue", "Edit value"),
    );
    const clearLabel = computed(() => t("hikari::tokenField.clear", "Clear"));

    const stops = computed(() =>
      [...props.stops].filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b),
    );

    /** Index of the nearest stop (ties → lower). */
    const stopIndex = computed(() => {
      const list = stops.value;
      if (!list.length) return 0;
      const v = props.modelValue;
      if (v == null) return 0;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < list.length; i++) {
        const d = Math.abs(list[i]! - v);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return best;
    });

    const offLadder = computed(() => {
      const v = props.modelValue;
      return v != null && !stops.value.includes(v);
    });

    function display(value: number | null): string {
      if (value == null) return "—";
      if (props.unit !== "auto") {
        const scaled = value / UNIT_SCALE[props.unit];
        return `${trim(scaled)}${props.unit}`;
      }
      return compactTokens(value);
    }

    function pickStop(i: number) {
      const list = stops.value;
      if (list[i] != null) emit("update:modelValue", list[i]!);
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
        class={["hk-token-field", props.disabled && "is-disabled"].filter(Boolean).join(" ")}
        role="group"
        aria-label={props.ariaLabel}
        data-off-ladder={offLadder.value || undefined}
      >
        <HkSlider
          class="hk-token-field-slider"
          modelValue={stopIndex.value}
          min={0}
          max={Math.max(stops.value.length - 1, 0)}
          step={1}
          showTicks={stops.value.length > 1}
          disabled={props.disabled}
          ariaLabel={props.ariaLabel}
          formatValue={(i: number) => display(stops.value[i] ?? null)}
          onUpdate:modelValue={pickStop}
        />
        <button
          type="button"
          class="hk-token-field-value"
          disabled={props.disabled}
          aria-haspopup="dialog"
          aria-label={`${resolvedEditorTitle.value}: ${display(props.modelValue)}`}
          onClick={openEditor}
          title={resolvedEditorTitle.value}
        >
          {display(props.modelValue)}
        </button>
        <HkSelect
          class="hk-token-field-unit"
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
              slots.editor
                ? slots.editor({
                    value: props.modelValue,
                    unit: editorUnit.value,
                    close: () => (editorOpen.value = false),
                  })
                : (
                    <div class="hk-token-field-editor-body">
                      <HkTokenValueEditor
                        modelValue={props.modelValue}
                        unit={editorUnit.value}
                        stops={stops.value}
                        onUpdate:modelValue={(v: number | null) => emit("update:modelValue", v)}
                        onUpdate:unit={(u: TokenUnit) => (editorUnit.value = u)}
                      />
                      <button
                        type="button"
                        class="hk-token-field-clear"
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
