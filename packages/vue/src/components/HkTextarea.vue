<script setup lang="ts">
defineProps<{
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}>();

defineEmits<{
  "update:modelValue": [value: string];
}>();
</script>

<template>
  <div class="hi-textarea-wrapper" :class="{ 'hi-textarea-wrapper--disabled': disabled }">
    <textarea
      class="hi-textarea"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows ?? 4"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<style lang="scss" scoped>
.hi-textarea-wrapper {
  display: inline-flex;
  width: 100%;
  border-radius: var(--hikari-radius-fui-lg, 8px);
  border: 1px solid var(--hi-color-border, #e0e0e0);
  background-color: var(--hi-color-surface, #ffffff);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.hi-textarea-wrapper:has(.hi-textarea:focus) {
  border-color: var(--hi-color-primary, #1890ff);
  box-shadow: 0 0 0 1px var(--hi-color-primary, #1890ff), 0 0 6px var(--hi-glow-color, rgba(24, 144, 255, 0.25));
}

.hi-textarea-wrapper--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hi-textarea {
  width: 100%;
  min-height: 80px;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
  color: var(--hi-color-text-primary, #333);
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.hi-textarea::placeholder {
  color: var(--hi-color-text-secondary, #6b7280);
  opacity: 0.6;
}

.hi-textarea:disabled {
  cursor: not-allowed;
}
</style>
