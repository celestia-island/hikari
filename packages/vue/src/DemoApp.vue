<template>
  <div class="demo">
    <header class="demo-header">
      <h1>Hikari</h1>
      <p class="subtitle">Vue 3 Component Library — {{ totalComponents }} components</p>
    </header>

    <section>
      <h2>HButton</h2>
      <div class="row">
        <HButton variant="primary" size="sm">Primary</HButton>
        <HButton variant="secondary" size="sm">Secondary</HButton>
        <HButton variant="outline" size="sm">Outline</HButton>
        <HButton variant="ghost" size="sm">Ghost</HButton>
        <HButton variant="danger" size="sm">Danger</HButton>
      </div>
      <div class="row">
        <HButton variant="primary" size="sm">Sm</HButton>
        <HButton variant="primary" size="md">Md</HButton>
        <HButton variant="primary" size="lg">Lg</HButton>
      </div>
      <div class="row">
        <HButton variant="primary" loading>Loading</HButton>
        <HButton variant="primary" disabled>Disabled</HButton>
        <HButton variant="primary" shortcut="⌘K">Shortcut</HButton>
      </div>
    </section>

    <section>
      <h2>HIconButton</h2>
      <div class="row">
        <HIconButton icon="search" variant="ghost" :size="16" />
        <HIconButton icon="settings" variant="secondary" :size="24" />
        <HIconButton icon="heart" variant="primary" :size="40" />
      </div>
    </section>

    <section>
      <h2>HTooltip</h2>
      <div class="row">
        <HTooltip text="Top placement" placement="top"><HButton variant="outline" size="sm">Top</HButton></HTooltip>
        <HTooltip text="Bottom placement" placement="bottom"><HButton variant="outline" size="sm">Bottom</HButton></HTooltip>
        <HTooltip text="Left placement" placement="left"><HButton variant="outline" size="sm">Left</HButton></HTooltip>
        <HTooltip text="Right placement" placement="right"><HButton variant="outline" size="sm">Right</HButton></HTooltip>
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
      <h2>HTag</h2>
      <div class="row">
        <HTag>Default</HTag>
        <HTag variant="success">Success</HTag>
        <HTag variant="warning">Warning</HTag>
        <HTag variant="danger">Danger</HTag>
        <HTag closable @close="() => {}">Closable</HTag>
      </div>
    </section>

    <section>
      <h2>HIcons</h2>
      <div class="row icons">
        <span class="icon-grid" v-for="i in icons" :key="i"><HIcon :name="i" :size="24" /><small>{{ i }}</small></span>
      </div>
    </section>

    <section>
      <h2>HSpinner</h2>
      <div class="row"><HSpinner size="xs" /><HSpinner size="sm" /><HSpinner size="md" /><HSpinner size="lg" /><HSpinner size="xl" /></div>
    </section>

    <section>
      <h2>HProgressBar / HProgressRing / HGaugeRing</h2>
      <div class="row"><HProgressBar :value="65" style="width:200px" /></div>
      <div class="row"><HProgressRing :value="75" :size="80" /><HGaugeRing :rings="gaugeRings" :size="80" center-label="CPU" /></div>
    </section>

    <section>
      <h2>HInput / HSearchInput / HNumberInput / HPasswordInput / HTextarea</h2>
      <div class="form-grid">
        <HInput v-model="form.text" placeholder="Text input" />
        <HInput v-model="form.text" placeholder="Disabled" disabled />
        <HSearchInput v-model="form.search" placeholder="Search..." />
        <HNumberInput v-model="form.number" placeholder="Number" />
        <HPasswordInput v-model="form.password" placeholder="Password" />
        <HTextarea v-model="form.textarea" placeholder="Textarea" :rows="3" />
      </div>
      <p class="result" v-if="anyForm">Form: {{ anyForm }}</p>
    </section>

    <section>
      <h2>HCheckbox / HSwitch / HRadio</h2>
      <div class="row">
        <HCheckbox v-model="flags.a">Option A</HCheckbox>
        <HCheckbox v-model="flags.b">Option B</HCheckbox>
        <HSwitch v-model="flags.on" label="Toggle" />
        <HRadio v-model="flags.radio" :options="radioOpts" />
      </div>
    </section>

    <section>
      <h2>HSelect</h2>
      <div class="row"><HSelect v-model="select.val" :options="select.opts" placeholder="Choose..." style="width:200px" /></div>
    </section>

    <section>
      <h2>HSkeleton / HSkeletonList</h2>
      <div class="row">
        <HSkeleton width="100px" height="24px" />
        <HSkeletonList :count="3" style="width:300px" />
      </div>
    </section>

    <section>
      <h2>HAvatar</h2>
      <div class="row">
        <HAvatar name="John Doe" size="sm" />
        <HAvatar name="Jane Smith" size="md" />
        <HAvatar name="Admin" size="lg" />
      </div>
    </section>

    <section>
      <h2>HKbd</h2>
      <div class="row"><HKbd keys="⌘" /><HKbd keys="⌥" /><HKbd keys="⇧" /><HKbd keys="⌃" /><HKbd keys="K" /><span> = open command palette</span></div>
    </section>

    <section>
      <h2>HDivider</h2>
      <HDivider />
      <p style="opacity:0.5;text-align:center;padding:8px 0">Section above divider</p>
      <HDivider />
      <p style="opacity:0.5;text-align:center;padding:8px 0">Section below divider</p>
    </section>

    <section>
      <h2>HAlert</h2>
      <div class="col"><HAlert message="Default info alert" /><HAlert variant="success" message="Success alert" /><HAlert variant="warning" message="Warning alert" /><HAlert variant="error" message="Error alert" /></div>
    </section>

    <section>
      <h2>HEmptyState</h2>
      <HEmptyState title="No items" description="Nothing to show here yet.">
        <template #icon><HIcon name="inbox" :size="48" /></template>
      </HEmptyState>
    </section>

    <section>
      <h2>HCollapse</h2>
      <HCollapse title="Click to expand section">
        <p style="padding:12px">This content is collapsible. It can contain any children.</p>
      </HCollapse>
    </section>

    <section>
      <h2>HTabs / HMorphingTabs</h2>
      <HTabs v-model="tabs.active" :tabs="tabs.items" />
      <p class="result" style="margin-top:8px">Active tab: {{ tabs.active }}</p>
      <div style="margin-top:12px" />
      <HMorphingTabs v-model="morphTabs.active" :tabs="morphTabs.items" />
    </section>

    <section>
      <h2>HCard</h2>
      <div class="row">
        <HCard style="padding:20px;flex:1">
          <h4>Card title</h4>
          <p style="font-size:0.75rem;opacity:0.7">Card body content goes here.</p>
        </HCard>
        <HCard style="padding:20px;flex:1" hover>
          <h4>Hoverable card</h4>
          <p style="font-size:0.75rem;opacity:0.7">Hover me for effect.</p>
        </HCard>
      </div>
    </section>

    <section>
      <h2>HTable</h2>
      <HTable :columns="tableCols" :rows="tableRows" style="max-height:200px" />
    </section>

    <section>
      <h2>HTimeline</h2>
      <HTimeline :steps="timelineSteps" current-key="v2" />
    </section>

    <section class="demo-footer">
      <p>Hikari v0.4.3 — Powered by celestia-island</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  HButton, HIconButton, HTooltip, HBadge, HTag, HIcon, HSpinner,
  HProgressBar, HProgressRing, HGaugeRing,
  HInput, HSearchInput, HNumberInput, HPasswordInput, HTextarea,
  HCheckbox, HSwitch, HRadio, HSelect,
  HSkeleton, HSkeletonList, HAvatar, HKbd, HDivider,
  HAlert, HEmptyState, HCollapse,
  HTabs, HMorphingTabs, HCard, HTable, HTimeline,
} from '@celestia-island/hikari'

const totalComponents = 56

const icons = ['home', 'settings', 'user', 'search', 'bell', 'heart', 'star', 'mail', 'download', 'upload', 'trash', 'edit', 'plus', 'check', 'x']

const form = ref({ text: '', search: '', number: 0, password: '', textarea: '' })
const anyForm = computed(() => Object.values(form.value).filter(v => v !== '' && v !== 0).join(', ') || null)
const flags = ref({ a: true, b: false, on: false, radio: 'x' })
const radioOpts = [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]
const gaugeRings = [{ pct: 45, color: 'rgb(var(--color-primary, 122 162 247))', trackColor: 'rgba(122, 162, 247, 0.15)' }]
const select = ref({ val: '', opts: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }] })
const tabs = ref({ active: 'tab1', items: [{ key: 'tab1', label: 'Overview' }, { key: 'tab2', label: 'Details' }, { key: 'tab3', label: 'Settings' }] })
const morphTabs = ref({ active: 'm1', items: [{ key: 'm1', label: 'Read' }, { key: 'm2', label: 'Write' }, { key: 'm3', label: 'Preview' }] })

const tableCols = [{ key: 'name', title: 'Name' }, { key: 'role', title: 'Role' }]
const tableRows = [{ name: 'Alice', role: 'Admin' }, { name: 'Bob', role: 'Editor' }, { name: 'Charlie', role: 'Viewer' }]
const timelineSteps = [
  { key: 'v1', label: 'v1.0 Released' },
  { key: 'v11', label: 'v1.1' },
  { key: 'v2', label: 'v2.0' },
]
</script>

<style lang="scss" scoped>
.demo-header { text-align: center; margin-bottom: 3rem; }
.demo-header h1 { font-size: 2.5rem; margin-bottom: 0.25rem; }
.subtitle { font-size: 0.875rem; opacity: 0.5; }
h2 { font-size: 1.1rem; margin: 2.5rem 0 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-faint, rgba(255,255,255,0.1)); }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.col { display: flex; flex-direction: column; gap: 8px; }
.icons { gap: 20px; }
.icon-grid { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; }
.icon-grid small { font-size: 0.6rem; opacity: 0.4; }
.form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; max-width: 600px; }
.result { font-size: 0.75rem; opacity: 0.6; margin-top: 8px; }
.demo-footer { text-align: center; margin-top: 4rem; padding: 2rem 0; font-size: 0.75rem; opacity: 0.35; }
</style>
