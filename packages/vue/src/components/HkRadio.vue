<script setup lang="ts">
defineProps<{
  modelValue: string | number | null;
  options: { value: string | number; label: string; disabled?: boolean }[];
  disabled?: boolean;
  direction?: "horizontal" | "vertical";
}>();

defineEmits<{
  "update:modelValue": [value: string | number];
}>();
</script>

<template>
  <div class="hi-radio-group" :class="[`hi-radio-group-${direction ?? 'horizontal'}`]">
    <label
      v-for="opt in options"
      :key="opt.value"
      class="hi-radio-label"
    >
      <input
        type="radio"
        :value="opt.value"
        :checked="modelValue === opt.value"
        :disabled="disabled || opt.disabled"
        @change="$emit('update:modelValue', opt.value)"
      />
      <span class="hi-radio-indicator">
        <span class="hi-radio-dot" />
      </span>
      <span class="hi-radio-text">{{ opt.label }}</span>
    </label>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/radio.scss";
</style>
