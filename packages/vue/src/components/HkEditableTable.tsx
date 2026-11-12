// AI-generated: developed with the DeepSeek Harness agent (model DeepSeek V4.1 Flash); human-directed.
import { computed, defineComponent, useId, type PropType } from "vue";
import { Plus, Trash2 } from "lucide-vue-next";

import { useI18n } from "../i18n/context";
import HkIconButton from "./HkIconButton";
import HkTable from "./HkTable";
import "./HkEditableTable.scss";

/** One editable grid column. Mirrors HkTable's column shape for the fields a
 *  host edits (`width` / `align` / the screen-reader-only `headerLabel` for
 *  a glyph column); sorting, dragging and selection stay HkTable's own
 *  opt-in features and are deliberately not re-exposed here. */
export interface HkEditableColumn {
  key: string;
  title: string;
  width?: string;
  align?: "left" | "center" | "right";
  headerLabel?: string;
}

/** Payload handed to `cell-<key>` / `edit-<key>`. */
export interface HkEditableCellSlotProps {
  row: Record<string, unknown>;
  value: unknown;
  /** Display position (0-based) — the index `update`-style handlers and the
   *  host's own row lookup use. */
  index: number;
  /** The row's validation message, or `null` when the row is clean. */
  error: string | null;
  /** Id of the rendered error line for this row — bind it to the editor's
   *  `aria-describedby` so screen readers read the message with the field. */
  errorId: string | null;
  disabled: boolean;
}

/** Payload handed to `row-error`. */
export interface HkEditableRowErrorSlotProps {
  row: Record<string, unknown>;
  index: number;
  error: string;
}

/** The synthetic trailing column that hosts the row's remove affordance
 *  (and the row-invalid marker). Prefixed so it cannot collide with a host
 *  column key. */
const ACTIONS_KEY = "__hkEditableActions";

/**
 * HkEditableTable — a generic inline-editable table shell.
 *
 * ## Composition, not a second table
 *
 * The grid itself IS `HkTable`: header row, dense cell rhythm, row hover,
 * section bands, scroll-progress registration and every a11y/structure
 * decision stay in that one component. This shell adds only the editable
 * layer — which slot renders a cell, where the remove affordance lives, the
 * per-row validation lines and the add-row band — so a change to the table
 * internals reaches editable grids for free instead of forking them.
 *
 * ## Slot contract
 *
 *  - `cell-<key>` — the DISPLAY of a host column (`key` from `columns`).
 *    Receives {@link HkEditableCellSlotProps}. Omitted: the shell renders
 *    `row[key]` as text (HkTable's own default).
 *  - `edit-<key>` — the EDITOR for a host column: a host-owned input (any
 *    element). Receives the same payload. An editor is chosen over the
 *    display slot while the table is enabled; with `disabled` set the shell
 *    falls back to `cell-<key>` (display), so a disabled grid is a readable
 *    read-only grid without the host re-slotting anything.
 *  - `row-error` — one invalid row's message line. Receives
 *    {@link HkEditableRowErrorSlotProps}. Omitted: a localized
 *    "Row N: message" line. The shell owns WHERE the lines render (a band
 *    under the grid) and their ids (`errorId`), not their wording.
 *
 * ## Controlled — the host owns the data
 *
 * The shell never mutates `rows` and never mutates a row object. It emits
 * intent (`add`, `remove(row, index)`) and the host applies it to its own
 * reactive array; validation is a pure `validate(row, rows)` callback the
 * shell calls per row (never cached across changes: the array identity is
 * the truth). That is why editing a cell is the HOST's editor emitting to
 * the host — the shell only supplies the place and the a11y wiring.
 *
 * `canAdd` and `canRemove` render their affordances locally, inside the
 * component: no page chrome is required, and a grid with no handlers simply
 * shows no add band. `copyCells` is off for the whole grid — cells hold
 * live editors, so the click-to-copy layer would steal focus and the drag
 * selection the editors need.
 */
export default defineComponent({
  name: "HkEditableTable",
  props: {
    columns: {
      type: Array as PropType<HkEditableColumn[]>,
      required: true,
    },
    /** The host's rows. Never mutated here. */
    rows: {
      type: Array as PropType<Record<string, unknown>[]>,
      default: () => [] as Record<string, unknown>[],
    },
    /** Row identity field (row keys + error-line keys). */
    rowKey: { type: String, required: true },
    /** Pure row validator: returns the row's message, or `null` when valid. */
    validate: {
      type: Function as PropType<
        (row: Record<string, unknown>, rows: Record<string, unknown>[]) => string | null
      >,
      default: undefined,
    },
    /** Render the add-row band and emit `add` on press. */
    canAdd: { type: Boolean, default: false },
    /** Per-row remove gate: provided → the trailing actions column renders
     *  and each row gets a remove button unless the gate returns false. */
    canRemove: {
      type: Function as PropType<(row: Record<string, unknown>) => boolean>,
      default: undefined,
    },
    /** Add affordance label; localized default. */
    addLabel: { type: String, default: undefined },
    /** Text for an empty grid; localized default. */
    emptyText: { type: String, default: undefined },
    /** Table caption (screen-reader only, HkTable's contract). */
    caption: { type: String, default: undefined },
    /** Read-only mode: editors fall back to display slots and every
     *  affordance is inert. */
    disabled: { type: Boolean, default: false },
  },
  emits: {
    /** The host appends a row to its own array. */
    add: () => true,
    /** The host removes `row` (at `index`) from its own array. */
    remove: (_row: Record<string, unknown>, _index: number) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const baseId = `hk-editable-table-${useId()}`;

    const addLabel = computed(() => props.addLabel ?? t("hikari::editableTable.addRow", "Add row"));
    const removeLabel = computed(() => t("hikari::editableTable.removeRow", "Remove row"));
    const rowActionsLabel = computed(() => t("hikari::editableTable.rowActions", "Row actions"));
    const emptyText = computed(
      () => props.emptyText ?? t("hikari::editableTable.empty", "No rows yet"),
    );
    const rowLabel = computed(() => t("hikari::editableTable.rowLabel", "Row {n}"));

    /** One message per row (index-aligned; `null` = clean). Recomputed on
     *  every render so a host that mutates its rows in place (a v-model on a
     *  nested field) still gets fresh validation. */
    const rowErrors = computed<(string | null)[]>(() => {
      const validate = props.validate;
      const rows = props.rows ?? [];
      if (!validate) return rows.map(() => null);
      return rows.map((row) => {
        const message = validate(row, rows);
        return typeof message === "string" && message !== "" ? message : null;
      });
    });

    const errorIdFor = (index: number) => `${baseId}-row-${index}-error`;

    const errorEntries = computed(() =>
      (props.rows ?? [])
        .map((row, index) => ({ row, index, error: rowErrors.value[index] }))
        .filter((entry): entry is { row: Record<string, unknown>; index: number; error: string } =>
          entry.error !== null,
        ),
    );

    const rowIdentity = (row: Record<string, unknown>, index: number): string =>
      String(row?.[props.rowKey] ?? index);

    /** HkTable's column list + the shell's trailing actions column. */
    const tableColumns = computed(() => {
      const columns = props.columns.map((column) => ({
        key: column.key,
        title: column.title,
        width: column.width,
        align: column.align,
        headerLabel: column.headerLabel,
      }));
      if (props.canRemove) {
        columns.push({
          key: ACTIONS_KEY,
          title: "",
          width: "48px",
          align: "right" as const,
          headerLabel: rowActionsLabel.value,
        });
      }
      return columns;
    });

    /** HkTable's cell slots, derived from the host's `cell-<key>` /
     *  `edit-<key>` slots. A column with neither keeps HkTable's own
     *  `row[key]` text rendering.
     *
     *  A plain FUNCTION, not a computed: slot PRESENCE is read from the
     *  parent's slots object, which Vue does not track reactively — a cached
     *  map would keep rendering yesterday's conditional slot after the host
     *  drops it. Rebuilding per render is a handful of property reads. */
    function buildTableSlots(): Record<string, (payload: unknown) => unknown> {
      const out: Record<string, (payload: unknown) => unknown> = {};
      for (const column of props.columns) {
        const display = slots[`cell-${column.key}`];
        const editor = slots[`edit-${column.key}`];
        if (!display && !editor) continue;
        out[`cell-${column.key}`] = (payload: unknown) => {
          const source = payload as { row: Record<string, unknown>; value: unknown; index: number };
          const error = rowErrors.value[source.index] ?? null;
          const cellProps: HkEditableCellSlotProps = {
            row: source.row,
            value: source.value,
            index: source.index,
            error,
            errorId: error ? errorIdFor(source.index) : null,
            disabled: props.disabled,
          };
          if (!props.disabled && editor) return editor(cellProps);
          if (display) return display(cellProps);
          return source.value;
        };
      }
      if (props.canRemove) {
        out[`cell-${ACTIONS_KEY}`] = (payload: unknown) => {
          const source = payload as { row: Record<string, unknown>; index: number };
          const removable = props.canRemove ? props.canRemove(source.row) !== false : false;
          const invalid = rowErrors.value[source.index] !== null;
          return (
            <div class="hk-editable-table-actions" data-row-invalid={invalid ? "" : undefined}>
              <HkIconButton
                variant="ghost"
                size={28}
                disabled={props.disabled || !removable}
                aria-label={`${removeLabel.value} ${source.index + 1}`}
                onClick={(event: MouseEvent) => {
                  // Never reach HkTable's row handlers / the cell copy layer.
                  event.stopPropagation();
                  emit("remove", source.row, source.index);
                }}
              >
                <Trash2 size={14} aria-hidden="true" />
              </HkIconButton>
            </div>
          );
        };
      }
      return out;
    }

    return () => {
      // A BARE IDENTIFIER, hoisted out of the JSX children position: an
      // inline conditional/member expression as children lands in a child
      // array, where the plain object is no longer normalized to slots and
      // every cell silently falls back to text (HkSectionCard's trap).
      const cellSlots = buildTableSlots();
      const errorRows = errorEntries.value;
      return (
        <div class="hk-editable-table" data-disabled={props.disabled ? "" : undefined}>
          <HkTable
            columns={tableColumns.value}
            rows={props.rows}
            rowKey={props.rowKey}
            caption={props.caption}
            emptyText={emptyText.value}
            copyCells={false}
          >
            {cellSlots}
          </HkTable>
          {errorRows.length > 0 && (
            <div class="hk-editable-table-errors" aria-live="polite">
              <ul class="hk-editable-table-error-list">
                {errorRows.map((entry) => (
                  <li
                    key={rowIdentity(entry.row, entry.index)}
                    id={errorIdFor(entry.index)}
                    class="hk-editable-table-error"
                    data-row-index={entry.index}
                  >
                    {slots["row-error"]
                      ? slots["row-error"]({
                          row: entry.row,
                          index: entry.index,
                          error: entry.error,
                        })
                      : `${rowLabel.value.replace("{n}", String(entry.index + 1))}: ${entry.error}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {props.canAdd && (
            <div class="hk-editable-table-footer">
              <button
                type="button"
                class="hk-editable-table-add"
                disabled={props.disabled}
                onClick={() => emit("add")}
              >
                <Plus size={14} aria-hidden="true" />
                <span>{addLabel.value}</span>
              </button>
            </div>
          )}
        </div>
      );
    };
  },
});
