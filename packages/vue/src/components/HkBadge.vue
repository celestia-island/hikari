<script setup lang="ts">
defineProps<{
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md" | "lg";
  dot?: boolean;
}>();
</script>

<template>
  <span
    class="hi-badge"
    :class="[
      variant ? `hi-badge-${variant}` : '',
      size ? `hi-badge-${size}` : '',
      { 'hi-badge-dot': dot },
    ]"
  >
    <span v-if="dot" class="hi-badge-dot-inner" />
    <slot v-else />
  </span>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/badge.scss";
</style>
