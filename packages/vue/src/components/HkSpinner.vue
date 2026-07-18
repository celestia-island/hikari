<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: "sm" | "md" | "lg";
    label?: string;
  }>(),
  { size: "md" },
);
</script>

<template>
  <div class="hi-spin" :class="[`hi-spin-${size}`]">
    <span class="hi-spin-spinner" />
    <span v-if="label" class="hi-spin-tip">{{ label }}</span>
    <slot v-else />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/spin.scss";
</style>
