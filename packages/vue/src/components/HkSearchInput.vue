<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  search: [value: string];
  clear: [];
}>();

const inputRef = ref<HTMLInputElement | null>(null);

function onInput(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  emit("update:modelValue", val);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter") {
    emit("search", props.modelValue);
  }
}

function clear() {
  emit("update:modelValue", "");
  emit("clear");
  inputRef.value?.focus();
}
</script>

<template>
  <div class="hi-search-wrapper">
    <div class="hi-search-input-wrapper">
      <div class="hi-input-wrapper">
        <div class="hi-input-wrapper-left">
          <span class="hi-input-wrapper-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px; color: var(--hi-color-text-secondary, #6b7280);">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
        </div>
        <div class="hi-input-wrapper-input">
          <input
            ref="inputRef"
            type="search"
            :value="modelValue"
            :placeholder="placeholder ?? 'Search...'"
            :disabled="disabled"
            @input="onInput"
            @keydown="onKeydown"
          />
        </div>
        <div v-if="modelValue" class="hi-input-wrapper-right">
          <button type="button" class="hi-search-clear" @click="clear" tabindex="-1">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/search.scss";
@use "../../../components/src/styles/components/input_wrapper.scss";

.hi-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--hi-color-text-secondary, #6b7280);
  cursor: pointer;
  flex-shrink: 0;
}

.hi-search-clear:hover {
  color: var(--hi-color-primary, #1890ff);
}
</style>
