<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
    color?: "primary" | "secondary" | "danger" | "warning" | "info";
    label?: string;
  }>(),
  { size: "md" },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

function toggle() {
  if (!props.disabled) {
    emit("update:modelValue", !props.modelValue);
  }
}
</script>

<template>
  <label class="hi-switch-label" :class="{ 'hi-switch-disabled': disabled }">
    <div
      class="hi-switch"
      :class="[
        `hi-switch-${size}`,
        { 'hi-switch-checked': modelValue },
        color ? `hi-switch-color-${color}` : '',
      ]"
      @click.prevent="toggle"
    >
      <div class="hi-switch-track">
        <div class="hi-switch-thumb">
          <span class="hi-switch-thumb-dot" />
        </div>
      </div>
    </div>
    <span v-if="label" class="hi-switch-text">{{ label }}</span>
  </label>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/switch.scss";
</style>
