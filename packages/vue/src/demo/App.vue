<script setup lang="ts">
import { ref } from 'vue';
import { HkButton, HkCard, HkInput, HkModal, HkSidebar, HkTabs } from '../index';

const modalOpen = ref(false);
const inputValue = ref('');
const tabs = [
  { key: 'general', label: 'General' },
  { key: 'models', label: 'Models' },
  { key: 'settings', label: 'Settings' },
];
const activeTab = ref('general');
</script>

<template>
  <div style="display:flex;height:100vh;">
    <HkSidebar>
      <div style="padding:1rem">Hikari Vue</div>
    </HkSidebar>
    <main style="flex:1;padding:2rem;">
      <HkCard>
        <HkTabs v-model="activeTab" :tabs="tabs" />
        <div style="margin-top:1rem;">
          <HkInput v-model="inputValue" placeholder="Type something..." />
          <p style="margin-top:.5rem;">You typed: {{ inputValue }}</p>
        </div>
        <div style="margin-top:1rem;">
          <HkButton @click="modalOpen = true">Open Modal</HkButton>
          <HkButton variant="secondary" style="margin-left:.5rem;">Cancel</HkButton>
        </div>
      </HkCard>
    </main>
    <HkModal :open="modalOpen" title="Demo Modal" @close="modalOpen = false">
      <p>This is a modal dialog.</p>
      <HkButton @click="modalOpen = false">Close</HkButton>
    </HkModal>
  </div>
</template>
