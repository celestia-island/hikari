<template>
  <div class="demo">
    <h1>Hikari Components</h1>

    <section>
      <h2>HButton</h2>
      <div class="row">
        <HButton variant="primary" size="md">Primary</HButton>
        <HButton variant="secondary" size="md">Secondary</HButton>
        <HButton variant="outline" size="md">Outline</HButton>
        <HButton variant="ghost" size="md">Ghost</HButton>
        <HButton variant="danger" size="md">Danger</HButton>
      </div>
      <div class="row">
        <HButton variant="primary" size="sm">Small</HButton>
        <HButton variant="primary" size="md">Medium</HButton>
        <HButton variant="primary" size="lg">Large</HButton>
      </div>
      <div class="row">
        <HButton variant="primary" loading>Loading</HButton>
        <HButton variant="primary" disabled>Disabled</HButton>
      </div>
    </section>

    <section>
      <h2>HTooltip</h2>
      <div class="row">
        <HTooltip text="Tooltip on top" placement="top">
          <HButton variant="outline" size="sm">Top</HButton>
        </HTooltip>
        <HTooltip text="Tooltip on bottom" placement="bottom">
          <HButton variant="outline" size="sm">Bottom</HButton>
        </HTooltip>
        <HTooltip text="Tooltip on left" placement="left">
          <HButton variant="outline" size="sm">Left</HButton>
        </HTooltip>
        <HTooltip text="Tooltip on right" placement="right">
          <HButton variant="outline" size="sm">Right</HButton>
        </HTooltip>
      </div>
    </section>

    <section>
      <h2>HIcons</h2>
      <div class="row icons">
        <span class="icon-grid" v-for="i in sampleIcons" :key="i">
          <HIcon :name="i" :size="24" />
          <small>{{ i }}</small>
        </span>
      </div>
    </section>

    <section>
      <h2>HSpinner</h2>
      <div class="row">
        <HSpinner size="sm" />
        <HSpinner size="md" />
        <HSpinner size="lg" />
        <HSpinner size="xl" />
      </div>
    </section>

    <section>
      <h2>HBadge</h2>
      <div class="row">
        <HBadge>Default</HBadge>
        <HBadge variant="success">Success</HBadge>
        <HBadge variant="warning">Warning</HBadge>
        <HBadge variant="error">Error</HBadge>
      </div>
    </section>

    <section>
      <h2>HInput</h2>
      <div class="row">
        <HInput v-model="inputValue" placeholder="Type something..." />
      </div>
      <p class="input-result" v-if="inputValue">You typed: {{ inputValue }}</p>
    </section>

    <section>
      <h2>HCheckbox</h2>
      <div class="row">
        <HCheckbox v-model="checked">Accept terms</HCheckbox>
      </div>
      <p v-if="checked" class="checked-feedback">✓ Checked!</p>
    </section>

    <section>
      <h2>HSwitch</h2>
      <div class="row">
        <HSwitch v-model="switched" label="Dark mode" />
        <span class="switch-state">{{ switched ? 'ON' : 'OFF' }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  HButton, HTooltip, HIcon, HSpinner, HBadge,
  HInput, HCheckbox, HSwitch,
} from '@celestia-island/hikari'

const inputValue = ref('')
const checked = ref(false)
const switched = ref(false)

const sampleIcons = ['home', 'settings', 'user', 'search', 'bell', 'heart', 'star', 'mail']
</script>
