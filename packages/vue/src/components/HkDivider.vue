<script setup lang="ts">
defineProps<{
  orientation?: "horizontal" | "vertical";
  text?: string;
  spacing?: string;
}>();
</script>

<template>
  <div
    class="hi-divider"
    :class="[`hi-divider-${orientation ?? 'horizontal'}`, { 'hi-divider-with-text': !!text }]"
    :style="{ margin: spacing }"
  >
    <span class="hi-divider-line" />
    <span v-if="text" class="hi-divider-text">{{ text }}</span>
    <span v-if="text" class="hi-divider-line" />
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/divider.scss";
</style>
