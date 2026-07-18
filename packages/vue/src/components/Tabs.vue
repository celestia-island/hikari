<script setup lang="ts">
import { ref, provide, watch, onMounted } from 'vue';

const props = defineProps<{
  modelValue?: string;
  tabs: { key: string; label: string; disabled?: boolean }[];
}>();

const emit = defineEmits<{ 'update:modelValue': [key: string] }>();

const activeKey = ref(props.modelValue ?? props.tabs[0]?.key ?? '');

watch(() => props.modelValue, (v) => { if (v) activeKey.value = v; });
watch(activeKey, (v) => emit('update:modelValue', v));

provide('activeTab', activeKey);
</script>

<template>
  <div class="hikari-tabs">
    <div class="hikari-tabs__nav">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="hikari-tabs__tab"
        :class="{ 'hikari-tabs__tab--active': activeKey === tab.key }"
        :disabled="tab.disabled"
        @click="activeKey = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="hikari-tabs__content">
      <slot :activeKey="activeKey" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/tabs.scss";
</style>
