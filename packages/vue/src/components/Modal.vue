<script setup lang="ts">
defineProps<{
  open: boolean;
  title?: string;
  width?: string;
}>();

defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="hikari-modal-overlay" @click.self="$emit('close')">
      <div class="hikari-modal" :style="{ width: width ?? '520px' }">
        <div v-if="title" class="hikari-modal__header">
          <h3>{{ title }}</h3>
          <button class="hikari-modal__close" @click="$emit('close')">&times;</button>
        </div>
        <div class="hikari-modal__body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/modal.scss";
@use "../../../components/src/styles/components/modal-vars.scss";
</style>
