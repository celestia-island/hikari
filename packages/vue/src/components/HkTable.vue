<script setup lang="ts">
import { ref, computed } from "vue";

interface Column {
  key: string;
  title: string;
  width?: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

const props = defineProps<{
  columns: Column[];
  rows: Record<string, unknown>[];
  size?: "sm" | "md" | "lg";
  bordered?: boolean;
  striped?: boolean;
  hover?: boolean;
  sortable?: boolean;
  selectable?: boolean;
}>();

const emit = defineEmits<{
  "update:selectedRows": [rows: Record<string, unknown>[]];
}>();

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
</script>

<template>
  <div class="hi-table-wrapper">
    <table
      class="hi-table"
      :class="[
        `hi-table-${size ?? 'md'}`,
        { 'hi-table-bordered': bordered, 'hi-table-striped': striped, 'hi-table-hover': hover },
      ]"
    >
      <thead>
        <tr class="hi-table-header-row">
          <th v-if="selectable" class="hi-table-header-cell" style="width: 40px;">
            <label class="hi-checkbox-label">
              <input type="checkbox" class="hi-checkbox-input" :checked="selectedRows.size === rows.length && rows.length > 0" @change="toggleAll" />
              <span class="hi-checkbox hi-checkbox-md" :class="{ 'hi-checkbox-checked': selectedRows.size === rows.length && rows.length > 0 }">
                <svg v-if="selectedRows.size === rows.length && rows.length > 0" class="hi-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </label>
          </th>
          <th
            v-for="col in columns"
            :key="col.key"
            class="hi-table-header-cell"
            :class="[
              col.align ? `hi-text-${col.align}` : '',
              { 'hi-table-sortable': sortable || col.sortable },
            ]"
            :style="{ width: col.width }"
            @click="(sortable || col.sortable) && toggleSort(col.key)"
          >
            {{ col.title }}
          </th>
        </tr>
      </thead>
      <tbody class="hi-table-body">
        <tr
          v-for="(row, index) in sortedRows"
          :key="index"
          class="hi-table-row"
        >
          <td v-if="selectable" class="hi-table-cell" style="width: 40px;">
            <label class="hi-checkbox-label">
              <input type="checkbox" class="hi-checkbox-input" :checked="selectedRows.has(index)" @change="toggleRow(index)" />
              <span class="hi-checkbox hi-checkbox-md" :class="{ 'hi-checkbox-checked': selectedRows.has(index) }">
                <svg v-if="selectedRows.has(index)" class="hi-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            </label>
          </td>
          <td
            v-for="col in columns"
            :key="col.key"
            class="hi-table-cell"
            :class="col.align ? `hi-text-${col.align}` : ''"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]" :index="index">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
        <tr v-if="sortedRows.length === 0">
          <td :colspan="columns.length + (selectable ? 1 : 0)" class="hi-table-empty">
            <div class="hi-table-empty-content">No data</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/table.scss";
@use "../../../components/src/styles/components/checkbox.scss";
</style>
