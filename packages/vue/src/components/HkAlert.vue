<script setup lang="ts">
import { ref } from "vue";

const props = withDefaults(
  defineProps<{
    variant?: "info" | "success" | "warning" | "error";
    title?: string;
    closable?: boolean;
    banner?: boolean;
    size?: "sm" | "md" | "lg";
  }>(),
  { variant: "info", size: "md" },
);

defineEmits<{
  close: [];
}>();

const closed = ref(false);
</script>

<template>
  <div
    v-if="!closed"
    class="hi-alert"
    :class="[
      `hi-alert-${variant}`,
      `hi-alert-${size}`,
      { 'hi-alert-banner': banner, 'hi-alert-no-title': !title },
    ]"
  >
    <span class="hi-alert-icon">
      <svg v-if="variant === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <svg v-else-if="variant === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <svg v-else-if="variant === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </span>
    <div class="hi-alert-content">
      <p v-if="title" class="hi-alert-title">{{ title }}</p>
      <p class="hi-alert-description"><slot /></p>
    </div>
    <button v-if="closable" class="hi-alert-close" @click="closed = true; $emit('close')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/alert.scss";
</style>
