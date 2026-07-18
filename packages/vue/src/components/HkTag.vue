<script setup lang="ts">
withDefaults(
  defineProps<{
    color?: string;
    size?: "sm" | "md" | "lg";
    closable?: boolean;
  }>(),
  { size: "md" },
);

defineEmits<{
  close: [];
}>();
</script>

<template>
  <span class="hi-tag" :class="[`hi-tag-${size}`]">
    <slot />
    <button
      v-if="closable"
      type="button"
      class="hi-tag-close"
      @click="$emit('close')"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </span>
</template>

<style lang="scss" scoped>
.hi-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.5;
  color: var(--hi-color-text-primary, #333);
  background: var(--hi-color-surface, #fff);
  border: 1px solid var(--hi-color-border, #e0e0e0);
  border-radius: 4px;
  white-space: nowrap;
}

.hi-tag-sm {
  padding: 0.0625rem 0.375rem;
  font-size: 0.625rem;
}

.hi-tag-lg {
  padding: 0.25rem 0.625rem;
  font-size: 0.875rem;
}

.hi-tag-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  margin: 0 -0.125rem 0 0;
  background: transparent;
  border: none;
  color: var(--hi-color-text-secondary, #6b7280);
  cursor: pointer;
  border-radius: 2px;
}

.hi-tag-close:hover {
  color: var(--hi-color-danger, #ef4444);
  background: rgba(0, 0, 0, 0.05);
}

.hi-tag-close svg {
  width: 10px;
  height: 10px;
}
</style>
