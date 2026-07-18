<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}>();

defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>

<template>
  <label class="hi-checkbox-label" :class="{ 'hi-checkbox-disabled': disabled }">
    <input
      type="checkbox"
      class="hi-checkbox-input"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span
      class="hi-checkbox"
      :class="[`hi-checkbox-${size ?? 'md'}`, { 'hi-checkbox-checked': modelValue }]"
    >
      <svg v-if="modelValue" class="hi-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
    <span v-if="label" class="hi-checkbox-text">{{ label }}</span>
  </label>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/checkbox.scss";
</style>
