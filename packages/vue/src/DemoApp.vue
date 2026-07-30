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
        <HIconButton icon="search" variant="ghost" size="sm" />
        <HIconButton icon="settings" variant="outline" size="md" />
        <HIconButton icon="heart" variant="primary" size="lg" />
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
        <HTag variant="error">Error</HTag>
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
      <div class="row"><HProgressBar :model-value="65" style="width:200px" /></div>
      <div class="row"><HProgressRing :model-value="75" :size="80" /><HGaugeRing :model-value="45" :size="80" label="CPU" /></div>
    </section>

    <section>
      <h2>HInput / HSearchInput / HNumberInput / HPasswordInput / HTextarea</h2>
      <div class="form-grid">
        <HInput v-model="form.text" placeholder="Text input" />
        <HInput v-model="form.text" placeholder="Disabled" disabled />
        <HSearchInput v-model="form.search" placeholder="Search..." />
        <HNumberInput v-model="form.number" placeholder="Number" />
        <HPasswordInput v-model="form.password" placeholder="Password" />
        <HTextarea v-model="form.textarea" placeholder="Textarea" rows="3" />
      </div>
      <p class="result" v-if="anyForm">Form: {{ anyForm }}</p>
    </section>

    <section>
      <h2>HCheckbox / HSwitch / HRadio</h2>
      <div class="row">
        <HCheckbox v-model="flags.a">Option A</HCheckbox>
        <HCheckbox v-model="flags.b">Option B</HCheckbox>
        <HSwitch v-model="flags.on" label="Toggle" />
        <HRadio v-model="flags.radio" value="x" label="X" />
        <HRadio v-model="flags.radio" value="y" label="Y" />
      </div>
    </section>

    <section>
      <h2>HSelect</h2>
      <div class="row"><HSelect v-model="select.val" :options="select.opts" placeholder="Choose..." style="width:200px" /></div>
    </section>

    <section>
      <h2>HSkeleton / HSkeletonList</h2>
      <div class="row">
        <HSkeleton :width="100" :height="24" />
        <HSkeletonList :rows="3" :width="300" />
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
      <HDivider label="OR" />
      <p style="opacity:0.5;text-align:center;padding:8px 0">Section below divider</p>
    </section>

    <section>
      <h2>HAlert</h2>
      <div class="col"><HAlert>Default info alert</HAlert><HAlert variant="success">Success alert</HAlert><HAlert variant="warning">Warning alert</HAlert><HAlert variant="error">Error alert</HAlert></div>
    </section>

    <section>
      <h2>HEmptyState</h2>
      <HEmptyState icon="inbox" title="No items" description="Nothing to show here yet." />
    </section>

    <section>
      <h2>HCollapse</h2>
      <HCollapse title="Click to expand section">
        <p style="padding:12px">This content is collapsible. It can contain any children.</p>
      </HCollapse>
    </section>

    <section>
      <h2>HTabs / HMorphingTabs</h2>
      <HTabs v-model="tabs.active" :items="tabs.items" />
      <p class="result" style="margin-top:8px">Active tab: {{ tabs.active }}</p>
      <div style="margin-top:12px" />
      <HMorphingTabs v-model="morphTabs.active" :items="morphTabs.items" />
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
      <HTimeline :items="timelineItems" />
    </section>

    <section>
      <h2>HAuthCard</h2>
      <div class="row">
        <HAuthCard title="Sign In" subtitle="Welcome back to celestia.world" />
      </div>
    </section>

    <section class="demo-footer">
      <p>Hikari v0.4.0 — Powered by celestia-island</p>
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
  HTabs, HMorphingTabs, HCard, HTable, HTimeline, HAuthCard,
} from '@celestia-island/hikari'

const totalComponents = 57

const icons = ['home', 'settings', 'user', 'search', 'bell', 'heart', 'star', 'mail', 'download', 'upload', 'trash', 'edit', 'plus', 'check', 'x']

const form = ref({ text: '', search: '', number: 0, password: '', textarea: '' })
const anyForm = computed(() => Object.values(form.value).filter(v => v !== '' && v !== 0).join(', ') || null)
const flags = ref({ a: true, b: false, on: false, radio: 'x' })
const select = ref({ val: '', opts: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }] })
const tabs = ref({ active: 'tab1', items: [{ key: 'tab1', label: 'Overview' }, { key: 'tab2', label: 'Details' }, { key: 'tab3', label: 'Settings' }] })
const morphTabs = ref({ active: 'm1', items: [{ key: 'm1', label: 'Read' }, { key: 'm2', label: 'Write' }, { key: 'm3', label: 'Preview' }] })

const tableCols = [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }]
const tableRows = [{ name: 'Alice', role: 'Admin' }, { name: 'Bob', role: 'Editor' }, { name: 'Charlie', role: 'Viewer' }]
const timelineItems = [
  { title: 'v1.0 Released', description: 'Initial release', time: '2024-01' },
  { title: 'v1.1', description: 'Added dark mode', time: '2024-03' },
  { title: 'v2.0', description: 'Major rewrite', time: '2025-06' },
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
