<script setup lang="ts">
defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<template>
  <div class="hi-empty-state">
    <div v-if="$slots.icon" class="hi-empty-state-icon">
      <slot name="icon" />
    </div>
    <h4 v-if="title" class="hi-empty-state-title">{{ title }}</h4>
    <p v-if="description" class="hi-empty-state-description">{{ description }}</p>
    <div v-if="$slots.action" class="hi-empty-state-action">
      <slot name="action" />
    </div>
    <slot />
  </div>
</template>

<style lang="scss" scoped>
.hi-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  text-align: center;
  min-height: 200px;
}

.hi-empty-state-icon {
  color: var(--hi-color-text-secondary, #9ca3af);
  opacity: 0.5;
  margin-bottom: 1rem;
}

.hi-empty-state-icon :deep(svg) {
  width: 4rem;
  height: 4rem;
}

.hi-empty-state-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--hi-color-text-primary, #333);
}

.hi-empty-state-description {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  color: var(--hi-color-text-secondary, #6b7280);
}

.hi-empty-state-action {
  margin-top: 0.5rem;
}
</style>
