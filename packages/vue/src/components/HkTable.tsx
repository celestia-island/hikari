import { computed, defineComponent, ref, type PropType } from "vue";
import "../../../components/src/styles/components/table.scss";
import "../../../components/src/styles/components/checkbox.scss";

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
    size: { type: String as PropType<"sm" | "md" | "lg">, default: "md" },
    bordered: { type: Boolean, default: false },
    striped: { type: Boolean, default: false },
    hover: { type: Boolean, default: false },
    sortable: { type: Boolean, default: false },
    selectable: { type: Boolean, default: false },
  },
  emits: {
    "update:selectedRows": (_rows: Record<string, unknown>[]) => true,
  },
  setup(props, { emit, slots }) {
    const sortKey = ref<string | null>(null);
    const sortDirection = ref<"asc" | "desc">("asc");
    const selectedRows = ref<Set<number>>(new Set());

    function toggleSort(key: string) {
      if (sortKey.value === key) {
        sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
      } else {
        sortKey.value = key;
        sortDirection.value = "asc";
      }
    }

    const sortedRows = computed(() => {
      if (!sortKey.value) return props.rows;
      const dir = sortDirection.value === "asc" ? 1 : -1;
      return [...props.rows].sort((a, b) => {
        const aVal = a[sortKey.value!];
        const bVal = b[sortKey.value!];
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return -1 * dir;
        if (aVal > bVal) return 1 * dir;
        return 0;
      });
    });

    function toggleRow(index: number) {
      const next = new Set(selectedRows.value);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      selectedRows.value = next;
      emit("update:selectedRows", sortedRows.value.filter((_, i) => next.has(i)));
    }

    function toggleAll() {
      if (selectedRows.value.size === sortedRows.value.length) {
        selectedRows.value = new Set();
        emit("update:selectedRows", []);
      } else {
        selectedRows.value = new Set(sortedRows.value.map((_, i) => i));
        emit("update:selectedRows", [...sortedRows.value]);
      }
    }

    const tableCls = computed(() => [
      "hi-table",
      `hi-table-${props.size}`,
      props.bordered ? "hi-table-bordered" : "",
      props.striped ? "hi-table-striped" : "",
      props.hover ? "hi-table-hover" : "",
    ]);

    const allChecked = computed(() => props.selectable && selectedRows.value.size === props.rows.length && props.rows.length > 0);

    return () => (
      <div class="hi-table-wrapper">
        <table class={tableCls.value}>
          <thead>
            <tr class="hi-table-header-row">
              {props.selectable && (
                <th class="hi-table-header-cell" style={{ width: "40px" }}>
                  <label class="hi-checkbox-label">
                    <input type="checkbox" class="hi-checkbox-input" checked={allChecked.value} onChange={toggleAll} />
                    <span class={["hi-checkbox", "hi-checkbox-md", allChecked.value ? "hi-checkbox-checked" : ""]}>
                      {allChecked.value && (
                        <svg class="hi-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                  </label>
                </th>
              )}
              {props.columns.map((col) => (
                <th
                  key={col.key}
                  class={[
                    "hi-table-header-cell",
                    col.align ? `hi-text-${col.align}` : "",
                    props.sortable || col.sortable ? "hi-table-sortable" : "",
                  ]}
                  style={{ width: col.width }}
                  onClick={() => (props.sortable || col.sortable) && toggleSort(col.key)}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody class="hi-table-body">
            {sortedRows.value.length === 0 ? (
              <tr>
                <td colspan={props.columns.length + (props.selectable ? 1 : 0)} class="hi-table-empty">
                  <div class="hi-table-empty-content">No data</div>
                </td>
              </tr>
            ) : (
              sortedRows.value.map((row, index) => (
                <tr key={index} class="hi-table-row">
                  {props.selectable && (
                    <td class="hi-table-cell" style={{ width: "40px" }}>
                      <label class="hi-checkbox-label">
                        <input type="checkbox" class="hi-checkbox-input" checked={selectedRows.value.has(index)} onChange={() => toggleRow(index)} />
                        <span class={["hi-checkbox", "hi-checkbox-md", selectedRows.value.has(index) ? "hi-checkbox-checked" : ""]}>
                          {selectedRows.value.has(index) && (
                            <svg class="hi-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                      </label>
                    </td>
                  )}
                  {props.columns.map((col) => (
                    <td key={col.key} class={["hi-table-cell", col.align ? `hi-text-${col.align}` : ""]}>
                      {slots[`cell-${col.key}`] ? slots[`cell-${col.key}`]!({ row, value: row[col.key], index }) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  },
});
