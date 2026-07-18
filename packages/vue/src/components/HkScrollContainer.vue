<script setup lang="ts">
withDefaults(
  defineProps<{
    maxHeight?: string;
    scrollbar?: boolean;
  }>(),
  { maxHeight: "100%", scrollbar: true },
);
</script>

<template>
  <div
    class="hi-scroll-container"
    :style="{ maxHeight, overflow: 'auto' }"
  >
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.hi-scroll-container {
  overflow: auto;
  scroll-behavior: smooth;
}

.hi-scroll-container::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.hi-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.hi-scroll-container::-webkit-scrollbar-thumb {
  background: var(--hi-scrollbar-thumb, rgba(148, 163, 184, 0.6));
  border-radius: 3px;
}

.hi-scroll-container::-webkit-scrollbar-thumb:hover {
  background: var(--hi-scrollbar-thumb-hover, rgba(203, 213, 225, 0.8));
}
</style>
