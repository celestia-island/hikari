import { computed, defineComponent, nextTick, ref, watch, type PropType } from "vue";
import { Plus, X } from "lucide-vue-next";

import HkDatePicker from "./HkDatePicker";
import HkInput from "./HkInput";
import HkPopover from "./HkPopover";
import HkPopupSelect, { type HkPopupSelectOption } from "./HkPopupSelect";
import HkScrollContainer from "./HkScrollContainer";
import { useI18n } from "../i18n/context";
import "./HkFilterPanel.scss";

/**
 * Filter condition operators. The symbol IS the button (one glyph, one
 * toggle — compact by design). Kind sets (user direction 2026-10-15):
 * TEXT fields speak the FUZZY pair only — ≈ (contains) and ≉ (does not
 * contain); the old exact =/≠ for text is gone ("等于其实是模糊匹配，
 * 干脆就标成约等于/约不等于"). Numeric fields keep the ordered five
 * (exact = among them), select fields keep equals / not-equals, and
 * date fields the ordered pair.
 */
export type HkFilterOperator = "eq" | "ne" | "approx" | "napprox" | "lt" | "lte" | "gte" | "gt";

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

/** One condition: WHICH field, the operator and the (string) value. An
 * EMPTY value means the condition filters nothing — pages map absent/
 * empty onto "no filter" at the RPC boundary; the row's own remove
 * button is the UI verb that drops the condition entirely. */
export interface HkFilterCondition {
  key: string;
  op: HkFilterOperator;
  value: string;
}

/** The panel's state IS the visible row list (user direction
 * 2026-10-15): an ORDERED ARRAY so the SAME field may carry MANY
 * conditions — filter a text column by ≈香蕉 and ≈苹果 at once, or pin
 * a value band with several ordered comparisons on one numeric column.
 * A page starts with NO conditions ([] — the default list is always
 * empty) and every visible row was deliberately added through the
 * field chooser. */
export type HkFilterState = HkFilterCondition[];

const OPERATOR_SYMBOL: Record<HkFilterOperator, string> = {
  eq: "=",
  ne: "≠",
  approx: "≈",
  napprox: "≉",
  lt: "<",
  lte: "≤",
  gte: "≥",
  gt: ">",
};

const OPERATOR_LABEL: Record<HkFilterOperator, { key: string; fallback: string }> = {
  eq: { key: "hikari::filterPanel.op.eq", fallback: "equals" },
  ne: { key: "hikari::filterPanel.op.ne", fallback: "not equals" },
  approx: { key: "hikari::filterPanel.op.approx", fallback: "fuzzy match" },
  napprox: { key: "hikari::filterPanel.op.napprox", fallback: "fuzzy non-match" },
  lt: { key: "hikari::filterPanel.op.lt", fallback: "less than" },
  lte: { key: "hikari::filterPanel.op.lte", fallback: "at most" },
  gte: { key: "hikari::filterPanel.op.gte", fallback: "at least" },
  gt: { key: "hikari::filterPanel.op.gt", fallback: "greater than" },
};

const DEFAULT_OPERATORS: Record<HkFilterFieldDef["kind"], HkFilterOperator[]> = {
  text: ["approx", "napprox"],
  number: ["lt", "lte", "eq", "gte", "gt"],
  select: ["eq", "ne"],
  date: ["gte", "lte"],
};

/** Keep only a legal number shape: optional leading minus, digits, one
 * decimal point ("只允许输入合法数字" — the input filters the keystrokes
 * rather than clamping afterwards). The intermediate fragments "-",
 * "." and "-." survive deliberately: rejecting them mid-keystroke would
 * make typing a negative or a decimal impossible; pages hand the model
 * to RPC boundaries that want Number()-validation anyway. */
export function sanitizeNumberInput(raw: string): string {
  let out = raw.replace(/[^-0-9.]/g, "");
  const hasMinus = out.startsWith("-");
  out = out.replace(/-/g, "");
  if (hasMinus) out = `-${out}`;
  const firstDot = out.indexOf(".");
  if (firstDot >= 0) {
    out = out.slice(0, firstDot + 1) + out.slice(firstDot + 1).replace(/\./g, "");
  }
  return out;
}

/** Operators whose multiple conditions on ONE field combine with OR
 * (user direction 2026-10-15): a fuzzy ≈香蕉 plus ≈苹果 matches rows
 * containing EITHER — 香蕉牛奶、苹果牛奶、苹果醋 all pass; the second
 * condition is never shadowed by the first. Select-kind equals joins
 * the OR class (match ANY of the picked options); a NUMBER's exact =
 * does not — it stays in the ALL-must-hold band of hkFieldMatches. */
function matchOpsFor(kind: HkFilterFieldDef["kind"]): HkFilterOperator[] {
  return kind === "select" ? ["eq", "approx"] : ["approx"];
}

/** Does ONE non-empty condition hold against a concrete raw value?
 * (String forms compare case-insensitively for the fuzzy pair —
 * "contains" reads better caseless; numeric comparisons coerce and are
 * false on non-numbers.) */
export function hkConditionMatches(
  cond: HkFilterCondition,
  kind: HkFilterFieldDef["kind"],
  raw: unknown,
): boolean {
  const value = String(raw ?? "");
  const needle = cond.value.toLowerCase();
  const hay = value.toLowerCase();
  switch (cond.op) {
    case "approx":
      return hay.includes(needle);
    case "napprox":
      return !hay.includes(needle);
    case "eq":
      if (kind === "number") {
        const a = Number(value);
        const b = Number(cond.value);
        return Number.isFinite(a) && Number.isFinite(b) && a === b;
      }
      return hay === needle;
    case "ne":
      return !hkConditionMatches({ ...cond, op: "eq" }, kind, raw);
    case "lt":
    case "lte":
    case "gt":
    case "gte": {
      const a = Number(value);
      const b = Number(cond.value);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      if (cond.op === "lt") return a < b;
      if (cond.op === "lte") return a <= b;
      if (cond.op === "gt") return a > b;
      return a >= b;
    }
  }
}

/** Combine ALL of one field's conditions against a concrete raw value —
 * the canonical semantics pages (and servers) must mirror (user
 * direction 2026-10-15):
 *   - the field's MATCH-class conditions (≈; select =) OR-combine: at
 *     least one must hit;
 *   - every other condition must hold INDIVIDUALLY (AND): each ≉/≠
 *     exclusion (the value may match none of them) and each ordered
 *     comparison (a band like ≥10 AND ≤50 restricts the range).
 * Empty-valued conditions filter nothing and are skipped. An empty
 * condition LIST matches everything. */
export function hkFieldMatches(
  kind: HkFilterFieldDef["kind"],
  conditions: HkFilterCondition[],
  raw: unknown,
): boolean {
  const live = conditions.filter((c) => c.value !== "");
  const matchOps = matchOpsFor(kind);
  const matchers = live.filter((c) => matchOps.includes(c.op));
  if (matchers.length > 0 && !matchers.some((c) => hkConditionMatches(c, kind, raw))) {
    return false;
  }
  for (const c of live) {
    if (matchOps.includes(c.op)) continue;
    if (!hkConditionMatches(c, kind, raw)) return false;
  }
  return true;
}

export default defineComponent({
  name: "HkFilterPanel",
  props: {
    fields: { type: Array as PropType<HkFilterFieldDef[]>, required: true },
    modelValue: { type: Array as PropType<HkFilterState>, default: () => [] },
    disabled: { type: Boolean, default: false },
    /** Panel aria-label / heading context (defaults to "Filters"). */
    label: { type: String, default: undefined },
  },
  emits: {
    "update:modelValue": (_state: HkFilterState) => true,
  },
  setup(props, { emit }) {
    const { t } = useI18n();

    const fieldByKey = (key: string): HkFilterFieldDef | undefined =>
      props.fields.find((f) => f.key === key);

    const operatorsFor = (field: HkFilterFieldDef): HkFilterOperator[] =>
      field.operators ?? DEFAULT_OPERATORS[field.kind];

    function emitCondition(index: number, patch: Partial<HkFilterCondition>) {
      const next = props.modelValue.map((c, i) => (i === index ? { ...c, ...patch } : c));
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

    /** Active-count signal for the trigger's corner badge (also exported
     * via the panel's own render for testing). */
    const activeCount = computed(
      () => props.modelValue.filter((c) => c.value !== "").length,
    );

    // The visible rows ARE the state array, in order (2026-10-15); the
    // chooser offers EVERY declared field — the same field may join
    // many times over.
    const rows = computed(() => props.modelValue);

    // ── The add-condition field chooser (user direction 2026-10-14) ──
    // "Add condition" NEVER appends by declaration order — it opens a
    // menu of the fields and the user picks WHO joins the panel. The
    // keyboard model mirrors HkPopupSelect: focus stays on the trigger,
    // arrows move a highlight, Enter confirms it.
    const addMenuOpen = ref(false);
    const addBtnRef = ref<HTMLElement | null>(null);
    const addHighlight = ref(-1);

    function openAddMenu() {
      addMenuOpen.value = true;
      addHighlight.value = props.fields.length > 0 ? 0 : -1;
    }

    function closeAddMenu() {
      addMenuOpen.value = false;
      addHighlight.value = -1;
    }

    function pickAddable(field: HkFilterFieldDef) {
      const candidate: HkFilterCondition = { key: field.key, op: operatorsFor(field)[0]!, value: "" };
      // An IDENTICAL condition already sitting empty adds nothing — the
      // user re-picking the same field gets a fresh row only when the
      // existing ones carry values or a different operator would apply.
      if (!props.modelValue.some((c) => c.key === candidate.key && c.op === candidate.op && c.value === "")) {
        emit("update:modelValue", [...props.modelValue, candidate]);
      }
      closeAddMenu();
    }

    // A declared-fields change under an open menu (a page swaps its
    // field list reactively) must keep the highlight in range and close
    // on an empty menu.
    watch(
      () => props.fields,
      (list) => {
        if (!addMenuOpen.value) return;
        if (list.length === 0) {
          closeAddMenu();
          return;
        }
        if (addHighlight.value >= list.length) addHighlight.value = list.length - 1;
      },
    );

    watch(addHighlight, (i) => {
      if (i < 0) return;
      nextTick(() => {
        document
          .querySelector(`[data-add-index="${i}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
    });

    function onAddTriggerKeydown(e: KeyboardEvent) {
      if (props.disabled) return;
      const count = props.fields.length;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!addMenuOpen.value) openAddMenu();
        else addHighlight.value = (addHighlight.value + 1) % count;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!addMenuOpen.value) openAddMenu();
        else addHighlight.value = (addHighlight.value - 1 + count) % count;
      } else if ((e.key === "Enter" || e.key === " ") && addMenuOpen.value) {
        // With the menu open, Enter/Space CONFIRM the highlighted field;
        // the native button activation (a toggle click) is suppressed.
        e.preventDefault();
        const field = props.fields[addHighlight.value];
        if (field) pickAddable(field);
      } else if (e.key === "Escape" && addMenuOpen.value) {
        // Escape closes ONE layer — the menu, not the host panel: stop
        // the bubble before the host popover's own Escape handler.
        e.preventDefault();
        e.stopPropagation();
        closeAddMenu();
      }
    }

    return () => {
      const label = props.label ?? t("hikari::filterBar.trigger", "Filters");
      return (
        <div class="hk-filter-panel" data-testid="hk-filter-panel" data-active={activeCount.value > 0 || undefined} aria-label={label}>
          {rows.value.map((cond, index) => {
            const field = fieldByKey(cond.key);
            // An undeclared key (the page renamed a field under live
            // state) renders a bare inert row naming the key —
            // removable, not editable.
            const kind = field?.kind ?? "text";
            const ops = field ? operatorsFor(field) : ([cond.op] as HkFilterOperator[]);
            const labelText = field?.label ?? cond.key;
            return (
              <div key={index} class="hk-filter-panel-row" data-kind={kind}>
                <span class="hk-filter-panel-field">{labelText}</span>
                <div class="hk-filter-panel-ops" role="group" aria-label={`${labelText} — ${label}`}>
                  {ops.map((op) => (
                    <button
                      key={op}
                      type="button"
                      class="hk-filter-panel-op"
                      aria-pressed={cond.op === op}
                      aria-label={t(OPERATOR_LABEL[op].key, OPERATOR_LABEL[op].fallback)}
                      title={t(OPERATOR_LABEL[op].key, OPERATOR_LABEL[op].fallback)}
                      disabled={props.disabled || !field}
                      onClick={() => emitCondition(index, { op })}
                    >
                      {OPERATOR_SYMBOL[op]}
                    </button>
                  ))}
                </div>
                <div class="hk-filter-panel-value">
                  <div class="hk-filter-panel-control">
                    {kind === "select" && field ? (
                      <HkPopupSelect
                        modelValue={cond.value}
                        onUpdate:modelValue={(v: string) => emitCondition(index, { value: v })}
                        label={labelText}
                        // The row's left cell already names the field —
                        // the control's own caption above it reads as
                        // duplication (user direction 2026-10-12), and
                        // the compact variant keeps the dense row stock.
                        hideLabel
                        size="sm"
                        disabled={props.disabled}
                        options={selectOptions(field)}
                      />
                    ) : kind === "date" ? (
                      // The calendar picker — never the OS native input
                      // (2026-10-11 direction); the wire format is the
                      // same ISO YYYY-MM-DD the native input spoke.
                      <HkDatePicker
                        modelValue={cond.value || null}
                        onUpdate:modelValue={(v: string | null) =>
                          emitCondition(index, { value: v ?? "" })
                        }
                        size="sm"
                        disabled={props.disabled || !field}
                      />
                    ) : (
                      <HkInput
                        type="text"
                        variant={kind === "number" ? "number" : "text"}
                        modelValue={cond.value}
                        onUpdate:modelValue={(v: string) =>
                          emitCondition(index, {
                            // Belt over the browser's native number filtering:
                            // the stored model keeps a clean number SHAPE only
                            // (sign, digits, one dot), so pages can hand it to
                            // RPC params verbatim.
                            value: kind === "number" ? sanitizeNumberInput(v) : v,
                          })
                        }
                        label={labelText}
                        hideLabel
                        size="sm"
                        placeholder={field?.placeholder ?? ""}
                        disabled={props.disabled || !field}
                      />
                    )}
                  </div>
                  {/* Drop THIS condition (the row leaves the panel; the
                   * page refetches without it). Sibling conditions on
                   * the same field survive — index-targeted removal,
                   * never key-targeted. */}
                  <button
                    type="button"
                    class="hk-filter-panel-remove"
                    aria-label={t("hikari::filterPanel.removeCondition", "Remove condition")}
                    title={t("hikari::filterPanel.removeCondition", "Remove condition")}
                    disabled={props.disabled}
                    onClick={() => {
                      const next = props.modelValue.filter((_, i) => i !== index);
                      emit("update:modelValue", next);
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
          {props.fields.length > 0 && (
            <div class="hk-filter-panel-addrow">
              {/* The ONE growth verb, parked in the operator column so
               * the row grid reads as one aligned axis (user direction
               * 2026-10-12). It opens the field chooser (2026-10-14) —
               * and since 2026-10-15 the chooser offers EVERY declared
               * field: the same column may join repeatedly. */}
              <button
                ref={addBtnRef}
                type="button"
                class="hk-filter-panel-add"
                disabled={props.disabled}
                aria-haspopup="menu"
                aria-expanded={addMenuOpen.value ? "true" : "false"}
                data-state={addMenuOpen.value ? "open" : "closed"}
                onClick={() => (addMenuOpen.value ? closeAddMenu() : openAddMenu())}
                onKeydown={onAddTriggerKeydown}
              >
                <Plus size={14} aria-hidden="true" />
                <span>{t("hikari::filterPanel.addCondition", "Add condition")}</span>
              </button>
              {/* The chooser itself: a popover anchored to the add button
               * (top-start — the button sits at the panel's bottom edge,
               * so the list opens over the panel's own rows; autoFlip
               * drops it below when the viewport says otherwise), a
               * bottom sheet on mobile — the same split as every other
               * popout this panel hosts. */}
              <HkPopover
                modelValue={addMenuOpen.value}
                onUpdate:modelValue={(v: boolean) => (v ? openAddMenu() : closeAddMenu())}
                anchorRef={addBtnRef.value}
                placement="top-start"
                offset={4}
                backdrop={false}
                sheetOnMobile
                title={t("hikari::filterPanel.addCondition", "Add condition")}
                class="hk-filter-add-content"
              >
                <HkScrollContainer class="hk-filter-add-viewport">
                  {/* role=menu lives on the inner list (HkScrollContainer
                   * owns its root's attr surface); items carry menuitem. */}
                  <div
                    class="hk-filter-add-list"
                    role="menu"
                    aria-label={t("hikari::filterPanel.chooseField", "Choose a field to add")}
                  >
                    {props.fields.map((field, i) => (
                      <button
                        key={field.key}
                        type="button"
                        class="hk-filter-add-item"
                        role="menuitem"
                        data-kind={field.kind}
                        data-highlighted={addHighlight.value === i || undefined}
                        data-add-index={i}
                        disabled={props.disabled}
                        onClick={() => pickAddable(field)}
                        onPointerenter={() => { addHighlight.value = i; }}
                      >
                        <span class="hk-filter-add-item-label">{field.label}</span>
                      </button>
                    ))}
                  </div>
                </HkScrollContainer>
              </HkPopover>
            </div>
          )}
        </div>
      );
    };
  },
});
