import { computed, defineComponent, type PropType } from "vue";
import { Plus, X } from "lucide-vue-next";

import HkDatePicker from "./HkDatePicker";
import HkInput from "./HkInput";
import HkPopupSelect, { type HkPopupSelectOption } from "./HkPopupSelect";
import { useI18n } from "../i18n/context";
import "./HkFilterPanel.scss";

/**
 * Filter condition operators. The symbol IS the button (one glyph, one
 * toggle — compact by design): the regular kinds get three (equals /
 * not-equals / fuzzy), numeric fields get the ordered five (no
 * not-equals), select fields narrow to equals / not-equals, and date
 * fields bound with the ordered pair.
 */
export type HkFilterOperator = "eq" | "ne" | "approx" | "lt" | "lte" | "gte" | "gt";

/** One filterable field a page declares for the panel. */
export interface HkFilterFieldDef {
  /** Condition key — stable, page-owned (maps to the RPC parameter). */
  key: string;
  label: string;
  kind: "text" | "number" | "select" | "date";
  /** select kind: the offered values. A leading "—" (empty value = no
   *  filter) row is prepended when the page did not include one. */
  options?: HkPopupSelectOption[];
  /** Override the kind's default operator set. */
  operators?: HkFilterOperator[];
  placeholder?: string;
}

/** One condition: the operator and the (string) value. An EMPTY value
 *  means the field filters nothing — pages map absent/empty onto "no
 *  filter" at the RPC boundary; the row's own remove button is the UI
 *  verb that drops the condition entirely. */
export interface HkFilterCondition {
  op: HkFilterOperator;
  value: string;
}

/** Per-field condition state, keyed by the field def's key. The record
 *  IS the list of visible condition rows: a declared field the record
 *  does not mention is latent — it only materializes when the user adds
 *  it from the panel's add row (user direction 2026-10-12: conditions
 *  are ADDED, not all rendered at once), and a row the user removes
 *  leaves the record. */
export type HkFilterState = Record<string, HkFilterCondition>;

const OPERATOR_SYMBOL: Record<HkFilterOperator, string> = {
  eq: "=",
  ne: "≠",
  approx: "≈",
  lt: "<",
  lte: "≤",
  gte: "≥",
  gt: ">",
};

const OPERATOR_LABEL: Record<HkFilterOperator, { key: string; fallback: string }> = {
  eq: { key: "hikari::filterPanel.op.eq", fallback: "equals" },
  ne: { key: "hikari::filterPanel.op.ne", fallback: "not equals" },
  approx: { key: "hikari::filterPanel.op.approx", fallback: "fuzzy match" },
  lt: { key: "hikari::filterPanel.op.lt", fallback: "less than" },
  lte: { key: "hikari::filterPanel.op.lte", fallback: "at most" },
  gte: { key: "hikari::filterPanel.op.gte", fallback: "at least" },
  gt: { key: "hikari::filterPanel.op.gt", fallback: "greater than" },
};

const DEFAULT_OPERATORS: Record<HkFilterFieldDef["kind"], HkFilterOperator[]> = {
  text: ["eq", "ne", "approx"],
  number: ["lt", "lte", "eq", "gte", "gt"],
  select: ["eq", "ne"],
  date: ["gte", "lte"],
};

/** Keep only a legal number shape: optional leading minus, digits, one
 *  decimal point ("只允许输入合法数字" — the input filters the keystrokes
 *  rather than clamping afterwards). The intermediate fragments "-",
 *  "." and "-." survive deliberately: rejecting them mid-keystroke would
 *  make typing a negative or a decimal impossible; no chest page ships a
 *  number field yet, and one will want Number()-validation at the wire
 *  boundary when the first does. */
export function sanitizeNumberInput(raw: string): string {
  let out = raw.replace(/[^-0-9.]/g, "");
  // One minus, and only leading.
  const hasMinus = out.startsWith("-");
  out = out.replace(/-/g, "");
  if (hasMinus) out = `-${out}`;
  // One decimal point.
  const firstDot = out.indexOf(".");
  if (firstDot >= 0) {
    out = out.slice(0, firstDot + 1) + out.slice(firstDot + 1).replace(/\./g, "");
  }
  return out;
}

export default defineComponent({
  name: "HkFilterPanel",
  props: {
    fields: { type: Array as PropType<HkFilterFieldDef[]>, required: true },
    modelValue: { type: Object as PropType<HkFilterState>, default: () => ({}) },
    disabled: { type: Boolean, default: false },
    /** Panel aria-label / heading context (defaults to "Filters"). */
    label: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_state: HkFilterState) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const operatorsFor = (field: HkFilterFieldDef): HkFilterOperator[] =>
      field.operators ?? DEFAULT_OPERATORS[field.kind];

    const conditionFor = (field: HkFilterFieldDef): HkFilterCondition =>
      props.modelValue[field.key] ?? { op: operatorsFor(field)[0]!, value: "" };

    function emitCondition(field: HkFilterFieldDef, patch: Partial<HkFilterCondition>) {
      const next: HkFilterState = { ...props.modelValue };
      next[field.key] = { ...conditionFor(field), ...patch };
      emit("update:modelValue", next);
    }

    const selectOptions = (field: HkFilterFieldDef): HkPopupSelectOption[] => {
      const options = field.options ?? [];
      // The empty row IS the clear affordance for select fields (value ""
      // filters nothing) — pages that ship their own "all" row keep it;
      // otherwise a LOCALIZED all-row is prepended so an empty-seeded
      // select reads as "no filter", not as a dash.
      if (options.some((o) => o.value === "")) return options;
      return [{ value: "", label: t("hikari::filterPanel.all", "All") }, ...options];
    };

    /** Active-count signal for the trigger's dot (also exported via the
     *  panel's own render for testing). */
    const activeCount = computed(
      () => props.fields.filter((f) => conditionFor(f).value !== "").length,
    );

    return () => {
      const label = props.label ?? t("hikari::filterBar.trigger", "Filters");
      // The visible rows ARE the state record's declared fields, in
      // declaration order; the rest stay latent behind the add row.
      const rows = props.fields.filter((f) => props.modelValue[f.key] !== undefined);
      const addable = props.fields.filter((f) => props.modelValue[f.key] === undefined);
      return (
        <div class="hk-filter-panel" data-testid="hk-filter-panel" data-active={activeCount.value > 0 || undefined} aria-label={label}>
          {rows.map((field) => {
            const condition = conditionFor(field);
            const ops = operatorsFor(field);
            return (
              <div key={field.key} class="hk-filter-panel-row" data-kind={field.kind}>
                <span class="hk-filter-panel-field">{field.label}</span>
                <div class="hk-filter-panel-ops" role="group" aria-label={`${field.label} — ${label}`}>
                  {ops.map((op) => (
                    <button
                      key={op}
                      type="button"
                      class="hk-filter-panel-op"
                      aria-pressed={condition.op === op}
                      aria-label={t(OPERATOR_LABEL[op].key, OPERATOR_LABEL[op].fallback)}
                      title={t(OPERATOR_LABEL[op].key, OPERATOR_LABEL[op].fallback)}
                      disabled={props.disabled}
                      onClick={() => emitCondition(field, { op })}
                    >
                      {OPERATOR_SYMBOL[op]}
                    </button>
                  ))}
                </div>
                <div class="hk-filter-panel-value">
                  <div class="hk-filter-panel-control">
                    {field.kind === "select" ? (
                      <HkPopupSelect
                        modelValue={condition.value}
                        onUpdate:modelValue={(v: string) => emitCondition(field, { value: v })}
                        label={field.label}
                        // The row's left cell already names the field —
                        // the control's own caption above it reads as
                        // duplication (user direction 2026-10-12), and
                        // the compact variant keeps the dense row stock.
                        hideLabel
                        size="sm"
                        disabled={props.disabled}
                        options={selectOptions(field)}
                      />
                    ) : field.kind === "date" ? (
                      // The calendar picker — never the OS native input
                      // (2026-10-11 direction); the wire format is the same
                      // ISO YYYY-MM-DD the native input spoke.
                      <HkDatePicker
                        modelValue={condition.value || null}
                        onUpdate:modelValue={(v: string | null) =>
                          emitCondition(field, { value: v ?? "" })
                        }
                        size="sm"
                        disabled={props.disabled}
                      />
                    ) : (
                      <HkInput
                        type="text"
                        variant={field.kind === "number" ? "number" : "text"}
                        modelValue={condition.value}
                        onUpdate:modelValue={(v: string) =>
                          emitCondition(field, {
                            // Belt over the browser's native number filtering:
                            // the stored model keeps a clean number SHAPE only
                            // (sign, digits, one dot), so pages can hand it to
                            // RPC params verbatim.
                            value: field.kind === "number" ? sanitizeNumberInput(v) : v,
                          })
                        }
                        label={field.label}
                        hideLabel
                        size="sm"
                        placeholder={field.placeholder ?? ""}
                        disabled={props.disabled}
                      />
                    )}
                  </div>
                  {/* Drop the condition entirely (the row leaves the
                   * panel; the page refetches unfiltered). Clearing the
                   * VALUE still means "filters nothing" for the wire —
                   * removal is just the tidy-up verb on top. */}
                  <button
                    type="button"
                    class="hk-filter-panel-remove"
                    aria-label={t("hikari::filterPanel.removeCondition", "Remove condition")}
                    title={t("hikari::filterPanel.removeCondition", "Remove condition")}
                    disabled={props.disabled}
                    onClick={() => {
                      const next: HkFilterState = { ...props.modelValue };
                      delete next[field.key];
                      emit("update:modelValue", next);
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
          {addable.length > 0 && (
            <div class="hk-filter-panel-addrow">
              {/* The ONE growth verb, parked in the operator column so
               * the row grid reads as one aligned axis (user direction
               * 2026-10-12). Appends the next unused field with its
               * kind's default operator and an empty value. */}
              <button
                type="button"
                class="hk-filter-panel-add"
                disabled={props.disabled}
                onClick={() => {
                  const field = addable[0]!;
                  emitCondition(field, { op: operatorsFor(field)[0]!, value: "" });
                }}
              >
                <Plus size={14} aria-hidden="true" />
                <span>{t("hikari::filterPanel.addCondition", "Add condition")}</span>
              </button>
            </div>
          )}
        </div>
      );
    };
  },
});
