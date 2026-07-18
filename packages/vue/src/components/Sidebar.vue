<script setup lang="ts">
defineProps<{
  width?: string;
  collapsed?: boolean;
}>();
</script>

<template>
  <aside class="hikari-sidebar" :class="{ 'hikari-sidebar--collapsed': collapsed }" :style="{ width: collapsed ? '64px' : width ?? '240px' }">
    <slot />
  </aside>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/sidebar.scss";
</style>
