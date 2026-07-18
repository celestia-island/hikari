<script setup lang="ts">
withDefaults(
  defineProps<{
    width?: string;
    height?: string;
    shape?: "rect" | "circle";
    active?: boolean;
  }>(),
  { width: "100%", height: "16px", shape: "rect", active: true },
);
</script>

<template>
  <div
    class="hi-skeleton"
    :class="[`hi-skeleton-${shape}`, { 'hi-skeleton-active': active }]"
    :style="{ width, height }"
  />
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/skeleton.scss";
</style>
