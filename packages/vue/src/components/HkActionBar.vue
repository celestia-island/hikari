<script setup lang="ts">
defineProps<{
  gap?: string;
}>();
</script>

<template>
  <div class="hi-action-bar" :style="{ gap: gap ?? '0.5rem' }">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.hi-action-bar {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
}

.hi-action-bar > :not(.hi-action-bar__separator) + :not(.hi-action-bar__separator) {
  margin-left: 0;
}

.hi-action-bar__separator {
  width: 1px;
  height: 1.25rem;
  background: var(--hi-color-border, #e0e0e0);
  flex-shrink: 0;
}
</style>
