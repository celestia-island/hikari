<script setup lang="ts">
import { ref, onMounted, onUnmounted, type CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{
    text: string;
    placement?: "top" | "bottom" | "left" | "right";
  }>(),
  { placement: "top" },
);

const visible = ref(false);
const wrapperRef = ref<HTMLElement | null>(null);
const tooltipStyle = ref<CSSProperties>({});

function updatePosition() {
  if (!wrapperRef.value) return;
  const rect = wrapperRef.value.getBoundingClientRect();
  const gap = 8;
  const style: CSSProperties = {};

  switch (props.placement) {
    case "top":
      style.top = `${rect.top - gap}px`;
      style.left = `${rect.left + rect.width / 2}px`;
      style.transform = "translate(-50%, -100%)";
      break;
    case "bottom":
      style.top = `${rect.bottom + gap}px`;
      style.left = `${rect.left + rect.width / 2}px`;
      style.transform = "translate(-50%, 0)";
      break;
    case "left":
      style.top = `${rect.top + rect.height / 2}px`;
      style.left = `${rect.left - gap}px`;
      style.transform = "translate(-100%, -50%)";
      break;
    case "right":
      style.top = `${rect.top + rect.height / 2}px`;
      style.left = `${rect.right + gap}px`;
      style.transform = "translate(0, -50%)";
      break;
  }

  tooltipStyle.value = style;
}

function show() {
  visible.value = true;
  requestAnimationFrame(updatePosition);
}

function hide() {
  visible.value = false;
}
</script>

<template>
  <span
    ref="wrapperRef"
    class="hi-tooltip-wrapper"
    @mouseenter="show"
    @mouseleave="hide"
    @focusin="show"
    @focusout="hide"
  >
    <span class="hi-tooltip-trigger">
      <slot />
    </span>
    <Teleport to="body">
      <div
        v-if="visible"
        class="hi-tooltip"
        :class="[`hi-tooltip-${placement}`, { 'hi-tooltip-visible': visible }]"
        :style="tooltipStyle"
      >
        <div class="hi-tooltip-content">{{ text }}</div>
      </div>
    </Teleport>
  </span>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/tooltip.scss";

.hi-tooltip {
  opacity: 0;
  transform: scale(0.95);
}

.hi-tooltip-visible {
  opacity: 1;
  transform: scale(1);
}
</style>
