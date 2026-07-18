<script setup lang="ts">
import { watch, ref } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    placement?: "left" | "right" | "top" | "bottom";
    width?: string;
    title?: string;
  }>(),
  { placement: "right", width: "400px" },
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  close: [];
}>();

const visible = ref(props.open);

watch(() => props.open, (val) => {
  visible.value = val;
});

function close() {
  visible.value = false;
  emit("update:open", false);
  emit("close");
}

function onMaskClick() {
  close();
}

const isHorizontal = () => props.placement === "left" || props.placement === "right";
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="hi-drawer-mask hi-drawer-mask-visible" @click="onMaskClick" />
    <div
      v-if="visible"
      class="hi-drawer"
      :class="[`hi-drawer-${placement}`, 'hi-drawer-open']"
      :style="isHorizontal() ? { width: width } : { height: width }"
    >
      <div v-if="title" class="hi-drawer-header">
        <h3 class="hi-drawer-title">{{ title }}</h3>
        <button class="hi-drawer-close" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="hi-drawer-body">
        <slot />
      </div>
      <div v-if="$slots.footer" class="hi-drawer-footer">
        <slot name="footer" />
      </div>
    </div>
  </Teleport>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/drawer.scss";

.hi-drawer-close svg {
  width: 16px;
  height: 16px;
  display: block;
}
</style>
