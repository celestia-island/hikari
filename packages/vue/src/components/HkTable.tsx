import { computed, defineComponent, onBeforeUnmount, onMounted, ref, type PropType } from "vue";

import { useI18n } from "../i18n/context";
import { usePointerReorder } from "../composables/usePointerReorder";
import { attachOverlayScrollbars, type OverlayScrollbarHandle } from "../composables/useOverlayScrollbar";
import "./HkTable.scss";

interface Column {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

export default defineComponent({
  name: "HkTable",
  props: {
    columns: { type: Array as PropType<Column[]>, required: true },
    rows: { type: Array as PropType<Record<string, unknown>[]>, required: true },
    rowKey: { type: String, default: undefined },
    caption: { type: String, default: undefined },
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    bordered: { type: Boolean, default: false },
    striped: { type: Boolean, default: false },
    hover: { type: Boolean, default: false },
    sortable: { type: Boolean, default: false },
    selectable: { type: Boolean, default: false },
    /** Left grip column with pointer drag-to-reorder (and ArrowUp/Down on a
     *  focused handle). The emitted indices are indices into `rows` — the
     *  consumer applies `moveTo(rows, from, to)`. While a column sort is
     *  active the displayed arrangement is derived, so two indices cannot
     *  faithfully encode the visual move: reordering is INERT until the
     *  sort is cleared (the handles render dimmed and refuse presses). */
    draggable: { type: Boolean, default: false },
    emptyText: { type: String, default: "" },
  },
  emits: {
    "update:selectedRows": (_rows: Record<string, unknown>[]) => true,
    reorder: (_fromIndex: number, _toIndex: number) => true,
  },
  setup(props, { emit, slots }) {
    const { t } = useI18n();
    const sortKey = ref<string | null>(null);
    const sortDirection = ref<"asc" | "desc">("asc");
    const selectedRowKeys = ref<Set<string>>(new Set());

    // Wide tables scroll horizontally in the wrapper — attach the shared
    // overlay scrollbar (horizontal track) once on mount.
    const wrapperRef = ref<HTMLElement>();
    // Positioned wrapper containing ONLY the scrolling box — the rail
    // host (the wrapper is the component root; its DOM parent is
    // consumer markup the rail must not span).
    const wrapperHostRef = ref<HTMLElement>();
    let wrapperScrollbar: OverlayScrollbarHandle | null = null;

    onMounted(() => {
      if (!wrapperRef.value) return;
      wrapperScrollbar = attachOverlayScrollbars(wrapperRef.value, {
        axis: "horizontal",
        host: wrapperHostRef.value,
      });
    });

    onBeforeUnmount(() => {
      wrapperScrollbar?.detach();
      wrapperScrollbar = null;
    });

    function getRowKey(row: Record<string, unknown>, index: number): string {
      if (props.rowKey && row[props.rowKey] != null) return String(row[props.rowKey]);
      return String(index);
    }

    /** Click-to-sort is TRI-state: ascending → descending → unsorted. The
     *  third click restores the consumer's own array order, which is what
     *  makes the state reachable again for a `draggable` table (reordering
     *  is inert while an arrangement is derived from a sort — see
     *  `reorderInert`). */
    function toggleSort(key: string) {
      if (sortKey.value !== key) {
        sortKey.value = key;
        sortDirection.value = "asc";
        return;
      }
      if (sortDirection.value === "asc") {
        sortDirection.value = "desc";
        return;
      }
      sortKey.value = null;
      sortDirection.value = "asc";
    }

    const sortedRows = computed(() => {
      if (!sortKey.value) return [...props.rows];
      const dir = sortDirection.value === "asc" ? 1 : -1;
      return [...props.rows].sort((a, b) => {
        const aVal = a[sortKey.value!];
        const bVal = b[sortKey.value!];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    });

    function toggleRow(row: Record<string, unknown>, index: number) {
      const key = getRowKey(row, index);
      const next = new Set(selectedRowKeys.value);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      selectedRowKeys.value = next;
      emit(
        "update:selectedRows",
        sortedRows.value.filter((r, i) => next.has(getRowKey(r, i)))
      );
    }

    function toggleAll() {
      if (selectedRowKeys.value.size === sortedRows.value.length) {
        selectedRowKeys.value = new Set();
        emit("update:selectedRows", []);
      } else {
        const keys = new Set(sortedRows.value.map((r, i) => getRowKey(r, i)));
        selectedRowKeys.value = keys;
        emit("update:selectedRows", [...sortedRows.value]);
      }
    }

    const allChecked = computed(
      () =>
        props.selectable &&
        sortedRows.value.length > 0 &&
        selectedRowKeys.value.size === sortedRows.value.length
    );

    // ── Drag-to-reorder (draggable) ─────────────────────────────────────
    // The strip the reorder engine measures: the body rows in display
    // order, registered by the row `ref` callbacks. A null (row outside
    // the viewport render, a row unmounting mid-gesture) is skipped by the
    // engine, so the strip index space stays the engine's; with a stable
    // list under a held press — the only case a live drag cares about —
    // strip indices are display indices.
    //
    // The registry re-syncs itself on every re-render: Vue re-invokes a
    // function ref on each keyed patch with the element and its NEW index
    // (and never calls an old function ref with null), so a consumer that
    // reorders `rows` after a drop leaves this array in display order
    // without any bookkeeping here. `items()` still filters null/detached
    // nodes, which is what makes a shrinking list safe mid-gesture.
    const rowEls = ref<(HTMLElement | null)[]>([]);

    function setRowEl(index: number, el: Element | null): void {
      rowEls.value[index] = (el as HTMLElement | null) ?? null;
    }

    /** Reordering is meaningful only over the array the consumer owns. A
     *  column sort is an arrangement DERIVED from that array — the two
     *  `reorder` indices could not tell the consumer how to reproduce the
     *  visual move — so a sorted table refuses to drag (dimmed handles,
     *  inert presses) rather than emit an edit that would land somewhere
     *  the user did not drop it. Clicking the sorted header a third time
     *  clears the sort (tri-state), which is the way back to dragging. */
    const reorderInert = computed(() => sortKey.value !== null);

    /** `moveTo` in the consumer's array: the entry at `from` takes `to`'s
     *  place and the entries between shift by one (HkTagInput's drop
     *  semantics — insert-at-target, what dropping a row ON another row
     *  looks like). */
    function onReorderDrop(from: number, to: number): void {
      if (reorderInert.value) return;
      if (from === to || from < 0 || to < 0) return;
      if (from >= props.rows.length || to >= props.rows.length) return;
      emit("reorder", from, to);
    }

    /** The scrollable ancestor a live drag pulls along, resolved on demand
     *  (the engine re-reads it every frame while the pointer rests near an
     *  edge): the nearest ancestor that actually overflows vertically — the
     *  page shell, a modal body, a scroll container — or null when the
     *  table sits fully in view, where there is nothing to scroll. */
    function dragScrollContainer(): HTMLElement | null {
      let el = wrapperHostRef.value?.parentElement ?? null;
      while (el) {
        const overflowY =
          typeof getComputedStyle === "function" ? getComputedStyle(el).overflowY : "";
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    const rowDrag = usePointerReorder({
      items: () => rowEls.value.filter((el) => el != null && el.isConnected),
      axis: "y",
      onDrop: onReorderDrop,
      scrollContainer: dragScrollContainer,
    });

    /** Display index → strip index (nulls and detached nodes skipped —
     *  exactly the filter `items()` applies, so `start`'s index lands on
     *  the pressed row). */
    function stripIndexOf(displayIndex: number): number {
      let strip = 0;
      for (let i = 0; i < displayIndex; i += 1) {
        const el = rowEls.value[i];
        if (el && el.isConnected) strip += 1;
      }
      return rowEls.value[displayIndex]?.isConnected ? strip : -1;
    }

    function onHandlePointerdown(e: PointerEvent, index: number): void {
      if (reorderInert.value) return;
      const strip = stripIndexOf(index);
      if (strip >= 0) rowDrag.start(e, strip);
    }

    /** Keyboard twin of the drop: move one row one slot. Runs on a focused
     *  handle, so plain ArrowUp/Down are unambiguous (no competing cursor
     *  semantics on a button) and are consumed even at the ends, where the
     *  row has nowhere to go. */
    function onHandleKeydown(e: KeyboardEvent, index: number): void {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      if (reorderInert.value) return;
      const delta = e.key === "ArrowUp" ? -1 : 1;
      onReorderDrop(index, index + delta);
    }

    /** The handle's accessible name names the entry AND the action (house
     *  pattern: HkTagInput's reorderLabel) — the first column's value is
     *  the row's identity as far as this generic component can tell. */
    function rowLabel(row: Record<string, unknown>): string {
      const first = props.columns[0]?.key;
      const value = first != null ? row[first] : undefined;
      return value == null ? "" : String(value).trim();
    }

    function handleName(row: Record<string, unknown>): string {
      const label = rowLabel(row);
      if (!label) return t("hikari::table.dragHandle", "Drag to reorder");
      const template = t("hikari::table.dragHandleRow", "Reorder {label}");
      // split/join, not String.replace: a row label carrying `$&` / `$'`
      // would otherwise be expanded as a replacement pattern (house
      // interpolation, HkTagInput/HkAffixPicker).
      const [before, after] = template.split("{label}");
      if (after === undefined) return template;
      return `${before}${label}${after}`;
    }

    /** Insertion cue for the slot the pointer currently resolves to:
     *  `dragOver` is a slot (0..n) over the strip — the line paints on the
     *  TOP edge of the row that would sit below the drop, or the BOTTOM
     *  edge of the last row for the trailing slot. A slot that resolves
     *  back onto the row being dragged paints nothing: the row already
     *  carries its lift, and a "drop here" line on the row in hand reads
     *  as a no-op target. */
    const dropCue = computed<{ index: number; edge: "before" | "after" } | null>(() => {
      if (!rowDrag.dragging.value || rowDrag.dragOver.value < 0) return null;
      const slot = rowDrag.dragOver.value;
      if (slot === rowDrag.dragFrom.value) return null;
      const count = sortedRows.value.length;
      if (slot >= count) return { index: count - 1, edge: "after" };
      return { index: slot, edge: "before" };
    });

    const tableCls = computed(() => [
      "hk-table",
      `hk-table-${props.size}`,
      props.bordered ? "hk-table-bordered" : "",
      props.striped ? "hk-table-striped" : "",
      props.hover ? "hk-table-hover" : "",
      props.draggable ? "hk-table-draggable" : "",
    ]);

    const totalCols = computed(
      () => props.columns.length + (props.selectable ? 1 : 0) + (props.draggable ? 1 : 0)
    );

    return () => {
      return (
      <div ref={wrapperHostRef} class="hk-table-host">
        <div ref={wrapperRef} class="hk-table-wrapper">
        <table class={tableCls.value}>
          {props.caption && <caption class="hk-table-sr-only">{props.caption}</caption>}
          <thead>
            <tr class="hk-table-header-row">
              {props.draggable && (
                <th class="hk-table-header-cell hk-table-drag-col" style={{ width: "36px" }} aria-hidden="true" />
              )}
              {props.selectable && (
                <th class="hk-table-header-cell" style={{ width: "40px" }}>
                  <label class="hk-table-checkbox-label">
                    <input
                      type="checkbox"
                      class="hk-table-checkbox-input"
                      checked={allChecked.value}
                      onChange={toggleAll}
                    />
                    <span
                      class={[
                        "hk-table-checkbox",
                        "hk-table-checkbox-md",
                        allChecked.value ? "hk-table-checkbox-checked" : "",
                      ]}
                    >
                      {allChecked.value && (
                        <svg
                          class="hk-table-checkbox-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </label>
                </th>
              )}
              {props.columns.map((col) => {
                const canSort = props.sortable || col.sortable;
                return (
                  <th
                    key={col.key}
                    class={[
                      "hk-table-header-cell",
                      col.align ? `hk-text-${col.align}` : "",
                      canSort ? "hk-table-header-sortable" : "",
                      canSort && sortKey.value === col.key ? "hk-table-header-sorted" : "",
                    ]}
                    style={{ width: col.width }}
                    onClick={() => canSort && toggleSort(col.key)}
                  >
                    <span class="hk-table-header-label">{col.title}</span>
                    {canSort && sortKey.value === col.key && (
                      <svg
                        class={[
                          "hk-table-sort-icon",
                          sortDirection.value === "desc" ? "hk-table-sort-icon-desc" : "",
                        ]}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody class="hk-table-body">
            {sortedRows.value.length === 0 ? (
              <tr>
                <td colspan={totalCols.value} class="hk-table-empty">
                  {slots.empty ? slots.empty() : (props.emptyText || t("hikari::table.noData", "No data"))}
                </td>
              </tr>
            ) : (
              sortedRows.value.map((row, index) => {
                const rowKey = getRowKey(row, index);
                const dropCueEdge =
                  dropCue.value && dropCue.value.index === index ? dropCue.value.edge : null;
                return (
                  <tr
                    key={rowKey}
                    ref={(el) => setRowEl(index, el as Element | null)}
                    class="hk-table-row"
                    data-dragging={rowDrag.dragging.value && rowDrag.dragFrom.value === index ? "" : undefined}
                    data-drop={dropCueEdge || undefined}
                  >
                    {props.draggable && (
                      <td class="hk-table-cell hk-table-drag-cell">
                        {/* A span, not a <button>: the reorder engine (house
                            rule, HkDraggableList's handle too) treats presses
                            on interactive controls as ACTIVATION, not drag —
                            the grip is a span so a press on it IS the drag
                            gesture. Keyboard stays first-class: focusable,
                            ArrowUp/Down nudges the row (aria-keyshortcuts). */}
                        <span
                          role="button"
                          tabindex={0}
                          class="hk-table-drag-handle"
                          aria-label={handleName(row)}
                          title={handleName(row)}
                          aria-keyshortcuts="ArrowUp ArrowDown"
                          aria-disabled={reorderInert.value || undefined}
                          data-disabled={reorderInert.value || undefined}
                          onPointerdown={(e: PointerEvent) => onHandlePointerdown(e, index)}
                          onKeydown={(e: KeyboardEvent) => onHandleKeydown(e, index)}
                        >
                          <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
                            <circle cx="3.5" cy="3" r="1.2" />
                            <circle cx="8.5" cy="3" r="1.2" />
                            <circle cx="3.5" cy="7" r="1.2" />
                            <circle cx="8.5" cy="7" r="1.2" />
                            <circle cx="3.5" cy="11" r="1.2" />
                            <circle cx="8.5" cy="11" r="1.2" />
                          </svg>
                        </span>
                      </td>
                    )}
                    {props.selectable && (
                      <td class="hk-table-cell" style={{ width: "40px" }}>
                        <label class="hk-table-checkbox-label">
                          <input
                            type="checkbox"
                            class="hk-table-checkbox-input"
                            checked={selectedRowKeys.value.has(rowKey)}
                            onChange={() => toggleRow(row, index)}
                          />
                          <span
                            class={[
                              "hk-table-checkbox",
                              "hk-table-checkbox-md",
                              selectedRowKeys.value.has(rowKey) ? "hk-table-checkbox-checked" : "",
                            ]}
                          >
                            {selectedRowKeys.value.has(rowKey) && (
                              <svg
                                class="hk-table-checkbox-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="3"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                        </label>
                      </td>
                    )}
                    {props.columns.map((col) => (
                      <td
                        key={col.key}
                        class={["hk-table-cell", col.align ? `hk-text-${col.align}` : ""]}
                      >
                        {slots[`cell-${col.key}`]
                          ? slots[`cell-${col.key}`]!({ row, value: row[col.key], index })
                          : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
      );
    };
  },
});
