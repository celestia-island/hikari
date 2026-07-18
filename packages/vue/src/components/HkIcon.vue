<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Component } from "vue";

const props = withDefaults(
  defineProps<{
    icon: string;
    size?: 16 | 20 | 24 | 32 | 40 | 48 | 64;
    color?: "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "muted";
  }>(),
  { size: 20 },
);

const iconComponent = ref<Component | null>(null);

function pascalCase(str: string): string {
  const camel = str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

async function loadIcon(name: string) {
  try {
    const mod = await import("lucide-vue-next");
    const icons = mod as Record<string, Component>;
    const pName = pascalCase(name);
    if (icons[pName]) {
      iconComponent.value = icons[pName];
    } else if (icons[name]) {
      iconComponent.value = icons[name];
    }
  } catch {
    iconComponent.value = null;
  }
}

watch(() => props.icon, (name) => loadIcon(name), { immediate: true });
</script>

<template>
  <span
    class="hikari-icon"
    :class="[
      `hikari-icon-${size}`,
      color ? `hikari-icon-${color}` : '',
    ]"
  >
    <component v-if="iconComponent" :is="iconComponent" />
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
    </svg>
  </span>
</template>

<style lang="scss" scoped>
@use "../../../components/src/styles/components/icon.scss";
</style>
