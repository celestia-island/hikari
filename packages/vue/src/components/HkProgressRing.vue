<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: number;
    size?: number;
    strokeWidth?: number;
    variant?: "normal" | "success" | "exception";
    showLabel?: boolean;
  }>(),
  { size: 120, strokeWidth: 8, variant: "normal" },
);

const clampedValue = computed(() => Math.max(0, Math.min(100, props.value)));

const radius = computed(() => (props.size - props.strokeWidth) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const dashOffset = computed(() => circumference.value * (1 - clampedValue.value / 100));

const variantClass = computed(() => {
  if (props.variant === "exception") return "hi-progress-exception";
  if (props.variant === "success") return "hi-progress-success";
  return "hi-progress-normal";
});

const textSize = computed(() => Math.round(props.size / 5));
</script>

<template>
  <div class="hi-progress-circle-wrapper" :class="variantClass" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg class="hi-progress-circle" :width="size" :height="size">
      <circle
        class="hi-progress-circle-trail"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
      />
      <circle
        class="hi-progress-circle-path"
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="none"
        :stroke-width="strokeWidth"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="dashOffset"
        stroke-linecap="round"
      />
    </svg>
    <span v-if="showLabel" class="hi-progress-circle-text" :style="{ fontSize: `${textSize}px` }">
      {{ Math.round(clampedValue) }}%
    </span>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/progress.scss";
</style>
