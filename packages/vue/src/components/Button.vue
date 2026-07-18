<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
}>();

defineEmits<{
  click: [e: MouseEvent];
}>();
</script>

<template>
  <button
    class="hikari-btn"
    :class="[`hikari-btn--${variant ?? 'primary'}`, `hikari-btn--${size ?? 'md'}`]"
    :disabled="disabled ?? loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="hikari-btn__spinner" />
    <slot />
  </button>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/button.scss";
@use "../../../components/src/styles/components/button-vars.scss";
</style>
