<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: number;
    variant?: "normal" | "active" | "success" | "exception";
    showLabel?: boolean;
    height?: string;
  }>(),
  { variant: "normal", height: "8px" },
);

const clampedValue = computed(() => Math.max(0, Math.min(100, props.value)));

const variantClass = computed(() => {
  if (props.variant === "exception") return "hi-progress-exception";
  if (props.variant === "success") return "hi-progress-success";
  if (props.variant === "active") return "hi-progress-active";
  return "hi-progress-normal";
});
</script>

<template>
  <div class="hi-progress-wrapper">
    <div class="hi-progress-outer">
      <div class="hi-progress-inner" :style="{ height: height }">
        <div
          class="hi-progress-bg"
          :style="{ width: `${clampedValue}%` }"
        />
      </div>
      <span v-if="showLabel" class="hi-progress-text">{{ Math.round(clampedValue) }}%</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/progress.scss";
</style>
