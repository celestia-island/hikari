<script setup lang="ts">
import { onErrorCaptured, ref } from "vue";
import { AlertTriangle, Copy, RefreshCw } from "lucide-vue-next";
import { useClipboard } from "../runtime/useClipboard";

const props = withDefaults(
  defineProps<{
    name?: string;
  }>(),
  { name: "unknown" },
);

const clipboard = useClipboard();
const error = ref<string | null>(null);

onErrorCaptured((err) => {
  const msg =
    err instanceof Error
      ? `${err.name}: ${err.message}\n\n${err.stack || ""}`
      : String(err);
  console.error(`[ErrorBoundary:${props.name}]`, msg);
  error.value = msg;
  return false;
});

function retry() {
  error.value = null;
}

function copyError() {
  clipboard.copy(error.value!);
}
</script>

<template>
  <slot v-if="error === null" />
  <div v-else class="hk-error-boundary">
    <div class="hk-error-boundary__card">
      <div class="hk-error-boundary__header">
        <AlertTriangle :size="16" class="hk-error-boundary__icon" />
        <span class="hk-error-boundary__label">Component Error</span>
        <span v-if="name !== 'unknown'" class="hk-error-boundary__tag">{{ name }}</span>
      </div>
      <div class="hk-error-boundary__msg">
        {{ error }}
      </div>
      <div class="hk-error-boundary__actions">
        <button class="hk-error-boundary__btn hk-error-boundary__btn--ghost" @click="copyError">
          <Copy :size="12" />
          Copy
        </button>
        <button class="hk-error-boundary__btn hk-error-boundary__btn--outline" @click="retry">
          <RefreshCw :size="12" />
          Retry
        </button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hk-error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.hk-error-boundary__card {
  max-width: 480px;
  width: 100%;
  background: var(--hi-color-bg-elevated, #fff);
  border: 1px solid var(--hi-color-border, #e2e8f0);
  border-radius: 8px;
  padding: 1.25rem;
}

.hk-error-boundary__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.hk-error-boundary__icon {
  color: var(--hi-color-error, #ef4444);
  flex-shrink: 0;
}

.hk-error-boundary__label {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--hi-color-text-primary, #1e293b);
}

.hk-error-boundary__tag {
  font-size: 0.75rem;
  color: var(--hi-color-text-tertiary, #94a3b8);
  background: var(--hi-color-bg-subtle, #f1f5f9);
  border-radius: 4px;
  padding: 0 0.375rem;
  line-height: 1.4;
}

.hk-error-boundary__msg {
  font-size: 0.8125rem;
  font-family: ui-monospace, monospace;
  color: var(--hi-color-text-secondary, #475569);
  line-height: 1.5;
  white-space: pre-wrap;
  max-height: 160px;
  overflow-y: auto;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: var(--hi-color-bg-subtle, #f8fafc);
  border-radius: 4px;
}

.hk-error-boundary__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.hk-error-boundary__btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  line-height: 1.4;

  &--ghost {
    background: transparent;
    color: var(--hi-color-text-secondary, #64748b);

    &:hover {
      background: var(--hi-color-bg-subtle, #f1f5f9);
    }
  }

  &--outline {
    background: transparent;
    color: var(--hi-color-text-primary, #1e293b);
    border: 1px solid var(--hi-color-border, #e2e8f0);

    &:hover {
      background: var(--hi-color-bg-subtle, #f1f5f9);
    }
  }
}
</style>
