<script setup lang="ts">
import { computed, useAttrs } from 'vue';

const props = defineProps<{
  modelValue: string | number;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const attrs = useAttrs();
const inputAttrs = computed(() => {
  const { class: _, ...rest } = attrs;
  return rest;
});
</script>

<template>
  <div class="hi-input-wrapper" :class="{ 'hi-input-wrapper--error': error }">
    <div v-if="$slots.prefix" class="hi-input-wrapper-left">
      <span class="hi-input-wrapper-item">
        <slot name="prefix" />
      </span>
    </div>
    <div class="hi-input-wrapper-input">
      <input
        :type="type ?? 'text'"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        v-bind="inputAttrs"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <div v-if="$slots.suffix" class="hi-input-wrapper-right">
      <span class="hi-input-wrapper-item">
        <slot name="suffix" />
      </span>
    </div>
  </div>
  <span v-if="error" class="hikari-input__error">{{ error }}</span>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/input.scss";
@use "../../../components/src/styles/components/input-vars.scss";
@use "../../../components/src/styles/components/input_wrapper.scss";

.hikari-input__error {
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: var(--hi-color-danger, #ef4444);
}
</style>
