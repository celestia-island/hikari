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
  <div class="hikari-input-wrapper" :class="{ 'hikari-input-wrapper--error': error }">
    <input
      class="hikari-input"
      :type="type ?? 'text'"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      v-bind="inputAttrs"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="hikari-input__error">{{ error }}</span>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/input.scss";
@use "../../../components/src/styles/components/input-vars.scss";
@use "../../../components/src/styles/components/input_wrapper.scss";
</style>
