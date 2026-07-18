<script setup lang="ts">
defineProps<{
  icon: string;
  variant?: "ghost" | "primary" | "secondary" | "danger" | "success";
  size?: 16 | 24 | 32 | 36 | 40;
  disabled?: boolean;
}>();

defineEmits<{
  click: [e: MouseEvent];
}>();
</script>

<template>
  <button
    class="hi-icon-button"
    :class="[
      `hi-icon-button-${size ?? 32}`,
      `hi-icon-button-${variant ?? 'ghost'}`,
    ]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <span class="hi-icon-button-icon">
      <slot name="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </slot>
    </span>
  </button>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/icon_button.scss";
@use "../../../components/src/styles/components/icon-button-vars.scss";
</style>
