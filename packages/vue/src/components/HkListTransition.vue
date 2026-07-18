<script setup lang="ts">
defineProps<{
  name?: string;
  tag?: string;
}>();
</script>

<template>
  <TransitionGroup
    :name="name ?? 'hi-list'"
    :tag="tag ?? 'div'"
    move-class="hi-list-move"
    enter-active-class="hi-list-enter-active"
    leave-active-class="hi-list-leave-active"
    enter-from-class="hi-list-enter-from"
    leave-to-class="hi-list-leave-to"
  >
    <slot />
  </TransitionGroup>
</template>

<style scoped>
.hi-list-move,
.hi-list-enter-active,
.hi-list-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.hi-list-enter-from,
.hi-list-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.hi-list-leave-active {
  position: absolute;
}
</style>
