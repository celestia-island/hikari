<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    placeholder?: string;
  }>(),
  { min: undefined, max: undefined, step: 1 },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const inputRef = ref<HTMLInputElement | null>(null);
let holdInterval: ReturnType<typeof setInterval> | null = null;
let holdTimeout: ReturnType<typeof setTimeout> | null = null;

const canDecrement = computed(() => (props.min != null ? props.modelValue > props.min : true));
const canIncrement = computed(() => (props.max != null ? props.modelValue < props.max : true));

function increment() {
  const newVal = props.modelValue + props.step;
  if (props.max != null && newVal > props.max) {
    emit("update:modelValue", props.max);
  } else {
    emit("update:modelValue", newVal);
  }
}

function decrement() {
  const newVal = props.modelValue - props.step;
  if (props.min != null && newVal < props.min) {
    emit("update:modelValue", props.min);
  } else {
    emit("update:modelValue", newVal);
  }
}

function startHold(dir: "up" | "down") {
  holdTimeout = setTimeout(() => {
    holdInterval = setInterval(() => {
      if (dir === "up") increment();
      else decrement();
    }, 50);
  }, 300);
}

function stopHold() {
  if (holdTimeout) clearTimeout(holdTimeout);
  if (holdInterval) clearInterval(holdInterval);
  holdInterval = null;
  holdTimeout = null;
}

onUnmounted(stopHold);
</script>

<template>
  <div class="hi-number-input-wrapper">
    <div class="hi-input-wrapper">
      <div class="hi-input-wrapper-input">
        <input
          ref="inputRef"
          type="number"
          :value="modelValue"
          :min="min"
          :max="max"
          :step="step"
          :disabled="disabled"
          :placeholder="placeholder"
          @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div class="hi-input-wrapper-right" style="flex-direction: column; gap: 1px;">
        <button
          type="button"
          class="hi-number-step-btn"
          :disabled="!canIncrement || disabled"
          @mousedown.prevent="startHold('up')"
          @mouseup.prevent="stopHold"
          @mouseleave.prevent="stopHold"
          @click.prevent="increment()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
        <button
          type="button"
          class="hi-number-step-btn"
          :disabled="!canDecrement || disabled"
          @mousedown.prevent="startHold('down')"
          @mouseup.prevent="stopHold"
          @mouseleave.prevent="stopHold"
          @click.prevent="decrement()"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/input_wrapper.scss";
@use "../../../components/src/styles/components/number_input.scss";

.hi-number-step-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 18px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--hi-color-text-secondary, #6b7280);
  cursor: pointer;
  flex-shrink: 0;
}

.hi-number-step-btn:hover:not(:disabled) {
  color: var(--hi-color-primary, #1890ff);
}

.hi-number-step-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.hi-number-step-btn svg {
  width: 12px;
  height: 12px;
}

.hi-input-wrapper-input input[type="number"] {
  -moz-appearance: textfield;
}

.hi-input-wrapper-input input[type="number"]::-webkit-inner-spin-button,
.hi-input-wrapper-input input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
