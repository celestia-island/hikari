<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  title?: string;
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const isOpen = ref(props.open ?? false);

watch(() => props.open, (val) => {
  if (val != null) isOpen.value = val;
});

function toggle() {
  isOpen.value = !isOpen.value;
  emit("update:open", isOpen.value);
}
</script>

<template>
  <div class="hi-collapse">
    <div class="hi-collapse-header" @click="toggle">
      <span class="hi-collapse-arrow" :style="{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
      <div class="hi-collapse-header-content">
        <slot name="title">
          <span v-if="title">{{ title }}</span>
        </slot>
      </div>
    </div>
    <div
      class="hi-collapse-content"
      :class="{ 'hi-collapse-expanded': isOpen }"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/collapse.scss";

.hi-collapse-arrow svg {
  width: 16px;
  height: 16px;
  display: block;
}
</style>
