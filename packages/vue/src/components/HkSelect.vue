<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, type CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{
    options: { value: string | number; label: string; disabled?: boolean }[];
    modelValue: string | number | null;
    placeholder?: string;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
  }>(),
  { size: "md" },
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();

const open = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue);
  return opt?.label ?? null;
});

function select(value: string | number) {
  emit("update:modelValue", value);
  open.value = false;
}

function toggle() {
  if (!props.disabled) {
    open.value = !open.value;
  }
}

function onClickOutside(e: MouseEvent) {
  if (triggerRef.value && !triggerRef.value.contains(e.target as Node) && dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("click", onClickOutside));
onUnmounted(() => document.removeEventListener("click", onClickOutside));

const dropdownStyle = computed<CSSProperties>(() => {
  if (!triggerRef.value) return {};
  const rect = triggerRef.value.getBoundingClientRect();
  return {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: 1000,
  };
});
</script>

<template>
  <div class="hi-select-root">
    <div
      ref="triggerRef"
      class="hi-select-trigger"
      :class="[`hi-select-${size}`, { 'hi-select-open': open, 'hi-select-disabled': disabled }]"
      @click="toggle"
    >
      <span v-if="selectedLabel" class="hi-select-value">{{ selectedLabel }}</span>
      <span v-else class="hi-select-placeholder">{{ placeholder ?? 'Select...' }}</span>
      <span class="hi-select-arrow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </div>
    <Teleport to="body">
      <div v-if="open" ref="dropdownRef" class="hi-select-dropdown" :style="dropdownStyle">
        <div
          v-for="opt in options"
          :key="opt.value"
          class="hi-select-option"
          :class="{ 'hi-select-option--selected': opt.value === modelValue }"
          @click="select(opt.value)"
        >
          {{ opt.label }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/select.scss";

.hi-select-root {
  position: relative;
  display: inline-block;
  width: 100%;
}

.hi-select-option {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 0.875rem;
  font-size: 0.875rem;
  color: var(--hi-color-text-primary, #333);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.hi-select-option:hover {
  background: var(--hi-color-surface-secondary, rgba(248, 250, 252, 0.5));
}

.hi-select-option--selected {
  color: var(--hi-color-primary, #1890ff);
  font-weight: 500;
}
</style>
