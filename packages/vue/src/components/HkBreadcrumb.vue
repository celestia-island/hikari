<script setup lang="ts">
defineProps<{
  items: { label: string; to?: string }[];
  separator?: string;
  size?: "sm" | "md" | "lg";
}>();
</script>

<template>
  <nav aria-label="Breadcrumb">
    <ol class="hi-breadcrumb" :class="[`hi-breadcrumb-${size ?? 'md'}`]">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="hi-breadcrumb-item"
      >
        <a v-if="item.to" :href="item.to" class="hi-breadcrumb-link">{{ item.label }}</a>
        <span v-else class="hi-breadcrumb-link">{{ item.label }}</span>
        <span v-if="index < items.length - 1" class="hi-breadcrumb-separator">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </li>
    </ol>
  </nav>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/breadcrumb.scss";

.hi-breadcrumb-separator svg {
  width: 14px;
  height: 14px;
  display: block;
}
</style>
