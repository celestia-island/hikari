<script setup lang="ts">
import HkModal from "./Modal.vue";

defineProps<{
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}>();

defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <HkModal :open="open" :title="title ?? 'Confirm'" @close="$emit('cancel')">
    <p style="margin: 0 0 1.5rem; color: var(--hi-color-text-primary, #333);">{{ message }}</p>
    <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
      <button
        class="hikari-btn hikari-btn--secondary hikari-btn--md"
        @click="$emit('cancel')"
      >
        {{ cancelText ?? 'Cancel' }}
      </button>
      <button
        class="hikari-btn hikari-btn--primary hikari-btn--md"
        @click="$emit('confirm')"
      >
        {{ confirmText ?? 'Confirm' }}
      </button>
    </div>
  </HkModal>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/button.scss";
@use "../../../components/src/styles/components/button-vars.scss";
@use "../../../components/src/styles/components/modal.scss";
@use "../../../components/src/styles/components/modal-vars.scss";
</style>
