<script setup lang="ts">
defineProps<{
  keys?: string[];
  size?: "sm" | "md";
}>();
</script>

<template>
  <kbd class="hi-kbd" :class="[`hi-kbd-${size ?? 'md'}`]">
    <slot>
      <span v-for="(key, i) in keys" :key="i">
        <span v-if="i > 0" class="hi-kbd-plus">+</span>
        <span class="hi-kbd-key">{{ key }}</span>
      </span>
    </slot>
  </kbd>
</template>

<style lang="scss" scoped>
.hi-kbd {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem 0.375rem;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
  color: var(--hi-color-text-primary, #333);
  background: var(--hi-color-surface, #fff);
  border: 1px solid var(--hi-color-border, #e0e0e0);
  border-radius: 4px;
  box-shadow: 0 1px 0 var(--hi-color-border, #e0e0e0);
  white-space: nowrap;
}

.hi-kbd-sm {
  padding: 0.0625rem 0.25rem;
  font-size: 0.625rem;
}

.hi-kbd-key {
  text-transform: uppercase;
}

.hi-kbd-plus {
  margin: 0 0.125rem;
  color: var(--hi-color-text-secondary, #6b7280);
}
</style>
