import { computed, defineComponent, ref, type PropType } from "vue";

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
  },
  emits: {
    "update:selectedRows": (_rows: Record<string, unknown>[]) => true,
  },
  setup(props, { emit, slots }) {
    const sortKey = ref<string | null>(null);
    const sortDirection = ref<"asc" | "desc">("asc");
    const selectedRowKeys = ref<Set<string>>(new Set());

    function getRowKey(row: Record<string, unknown>, index: number): string {
      if (props.rowKey && row[props.rowKey] != null) return String(row[props.rowKey]);
      return String(index);
    }

    function toggleSort(key: string) {
      if (sortKey.value === key) {
        sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
      } else {
        sortKey.value = key;
        sortDirection.value = "asc";
      }
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

    const tableCls = computed(() => [
      "hk-table",
      `hk-table--${props.size}`,
      props.bordered ? "hk-table--bordered" : "",
      props.striped ? "hk-table--striped" : "",
      props.hover ? "hk-table--hover" : "",
    ]);

    const totalCols = computed(() => props.columns.length + (props.selectable ? 1 : 0));

    return () => (
      <div class="hk-table-wrapper">
        <table class={tableCls.value}>
          {props.caption && <caption class="sr-only">{props.caption}</caption>}
          <thead>
            <tr class="hk-table-header-row">
              {props.selectable && (
                <th class="hk-table-header-cell" style={{ width: "40px" }}>
                  <label class="hk-checkbox-label">
                    <input
                      type="checkbox"
                      class="hk-checkbox-input"
                      checked={allChecked.value}
                      onChange={toggleAll}
                    />
                    <span
                      class={[
                        "hk-checkbox",
                        "hk-checkbox--md",
                        allChecked.value ? "hk-checkbox--checked" : "",
                      ]}
                    >
                      {allChecked.value && (
                        <svg
                          class="hk-checkbox-icon"
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
                      col.align ? `hk-text--${col.align}` : "",
                      canSort ? "hk-table-header--sortable" : "",
                      canSort && sortKey.value === col.key ? "hk-table-header--sorted" : "",
                    ]}
                    style={{ width: col.width }}
                    onClick={() => canSort && toggleSort(col.key)}
                  >
                    <span class="hk-table-header-label">{col.title}</span>
                    {canSort && sortKey.value === col.key && (
                      <svg
                        class={[
                          "hk-table-sort-icon",
                          sortDirection.value === "desc" ? "hk-table-sort-icon--desc" : "",
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
                  {slots.empty ? slots.empty() : "No data"}
                </td>
              </tr>
            ) : (
              sortedRows.value.map((row, index) => {
                const rowKey = getRowKey(row, index);
                return (
                  <tr key={rowKey} class="hk-table-row">
                    {props.selectable && (
                      <td class="hk-table-cell" style={{ width: "40px" }}>
                        <label class="hk-checkbox-label">
                          <input
                            type="checkbox"
                            class="hk-checkbox-input"
                            checked={selectedRowKeys.value.has(rowKey)}
                            onChange={() => toggleRow(row, index)}
                          />
                          <span
                            class={[
                              "hk-checkbox",
                              "hk-checkbox--md",
                              selectedRowKeys.value.has(rowKey) ? "hk-checkbox--checked" : "",
                            ]}
                          >
                            {selectedRowKeys.value.has(rowKey) && (
                              <svg
                                class="hk-checkbox-icon"
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
                        class={["hk-table-cell", col.align ? `hk-text--${col.align}` : ""]}
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
    );
  },
});
