import { computed, defineComponent, type PropType } from "vue";

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
 *  means the field filters nothing — this is also how a condition is
 *  cleared (re-open the panel, empty the value; there is no separate
 *  reset verb in the header affordance). */
export interface HkFilterCondition {
  op: HkFilterOperator;
  value: string;
}

/** Per-field condition state, keyed by the field def's key. Fields the
 *  record does not mention render with their kind's default operator and
 *  an empty value. */
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
 *  rather than clamping afterwards). */
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
      // filters nothing); pages that ship their own "all" row keep it.
      if (options.some((o) => o.value === "")) return options;
      return [{ value: "", label: "—" }, ...options];
    };

    /** Active-count signal for the trigger's dot (also exported via the
     *  panel's own render for testing). */
    const activeCount = computed(
      () => props.fields.filter((f) => conditionFor(f).value !== "").length,
    );

    return () => {
      const label = props.label ?? t("hikari::filterBar.trigger", "Filters");
      return (
        <div class="hk-filter-panel" data-testid="hk-filter-panel" data-active={activeCount.value > 0 || undefined} aria-label={label}>
          {props.fields.map((field) => {
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
                  {field.kind === "select" ? (
                    <HkPopupSelect
                      modelValue={condition.value}
                      onUpdate:modelValue={(v: string) => emitCondition(field, { value: v })}
                      label={field.label}
                      disabled={props.disabled}
                      options={selectOptions(field)}
                    />
                  ) : (
                    <HkInput
                      type={field.kind === "date" ? "date" : "text"}
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
                      placeholder={field.placeholder ?? ""}
                      disabled={props.disabled}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    };
  },
});
