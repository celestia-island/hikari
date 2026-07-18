<script setup lang="ts">
defineProps<{
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}>();
</script>

<template>
  <div class="hikari-card" :class="[`hikari-card--${padding ?? 'md'}`, { 'hikari-card--hoverable': hoverable }]">
    <slot />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/card.scss";
@use "../../../components/src/styles/components/card-vars.scss";
</style>
