<script setup lang="ts">
import { ref, onMounted, onUnmounted, type CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    width?: string;
  }>(),
  { width: "280px" },
);

const visible = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);

function toggle() {
  visible.value = !visible.value;
}

function onClickOutside(e: MouseEvent) {
  if (
    triggerRef.value && !triggerRef.value.contains(e.target as Node) &&
    popoverRef.value && !popoverRef.value.contains(e.target as Node)
  ) {
    visible.value = false;
  }
}

onMounted(() => document.addEventListener("click", onClickOutside));
onUnmounted(() => document.removeEventListener("click", onClickOutside));

function positionPopover(): CSSProperties {
  if (!triggerRef.value) return {};
  const rect = triggerRef.value.getBoundingClientRect();
  return {
    position: "fixed",
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    minWidth: props.width,
  };
}
</script>

<template>
  <span
    ref="triggerRef"
    class="hi-popover-trigger"
    @click.stop="toggle"
  >
    <slot name="trigger" />
  </span>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="popoverRef"
      class="hi-popover"
      :style="positionPopover()"
    >
      <div v-if="title" class="hi-popover-title">{{ title }}</div>
      <div class="hi-popover-content">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/popover.scss";

.hi-popover-trigger {
  display: inline-block;
  cursor: pointer;
}
</style>
