<script setup lang="ts">
import { ref, computed } from "vue";
import HkInput from "./Input.vue";

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const showPassword = ref(false);

const inputType = computed(() => (showPassword.value ? "text" : "password"));
const toggleIcon = computed(() => (showPassword.value ? "EyeOff" : "Eye"));
</script>

<template>
  <HkInput
    :modelValue="modelValue"
    :type="inputType"
    :placeholder="placeholder ?? 'Enter password'"
    :disabled="disabled"
    :error="error"
    @update:modelValue="emit('update:modelValue', $event)"
  >
    <template #suffix>
      <button type="button" class="hi-password-toggle" @click="showPassword = !showPassword" tabindex="-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hi-password-toggle-icon">
          <template v-if="showPassword">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </template>
          <template v-else>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </template>
        </svg>
      </button>
    </template>
  </HkInput>
</template>

<style lang="scss" scoped>
.hi-password-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--hi-color-text-secondary, #6b7280);
  cursor: pointer;
  flex-shrink: 0;
}

.hi-password-toggle:hover {
  color: var(--hi-color-primary, #1890ff);
}

.hi-password-toggle-icon {
  width: 16px;
  height: 16px;
}
</style>
