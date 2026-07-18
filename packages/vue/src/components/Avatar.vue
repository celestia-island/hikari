<script setup lang="ts">
defineProps<{ src?: string; name?: string; size?: 'sm' | 'md' | 'lg' }>();
</script>
<template>
  <div class="hikari-avatar" :class="[`hikari-avatar--${size ?? 'md'}`]">
    <img v-if="src" :src="src" :alt="name" />
    <span v-else class="hikari-avatar__fallback">{{ name?.charAt(0)?.toUpperCase() ?? '?' }}</span>
  </div>
</template>
<style lang="scss" scoped>
@use "../../../components/src/styles/components/avatar.scss";
</style>
