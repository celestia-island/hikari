<script setup lang="ts">
import { ref } from 'vue';

export interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const toasts = ref<ToastItem[]>([]);
let nextId = 0;

function show(message: string, type: ToastItem['type'] = 'info', duration = 3000) {
  const id = nextId++;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, duration);
}

defineExpose({ show });
</script>

<template>
  <div class="hikari-toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="hikari-toast"
      :class="`hikari-toast--${toast.type}`"
    >
      {{ toast.message }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/toast.scss";
</style>
