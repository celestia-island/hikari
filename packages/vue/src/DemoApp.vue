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
      <h2>HSelectPanel</h2>
      <div class="row">
        <span style="align-self:center;color:var(--color-muted, gray)">custom trigger + checkbox rows:</span>
        <span ref="panelAnchor" style="display:inline-flex">
          <HButton @click="panel.open = !panel.open">Filter ▲</HButton>
        </span>
        <HSelectPanel
          :open="panel.open"
          @update:open="(v: boolean) => panel.open = v"
          :anchor-ref="panelAnchor ?? null"
          title="Filters"
          placement="top-start"
        >
          <HCheckbox
            v-for="opt in panel.opts"
            :key="opt.key"
            :model-value="panel.checked.includes(opt.key)"
            @update:model-value="(v: boolean) => togglePanelOpt(opt.key, v)"
          >{{ opt.label }}</HCheckbox>
        </HSelectPanel>
      </div>
    </section>

    <section>
      <h2>HLocalizedInput</h2>
      <div class="row" style="max-width:420px">
        <HLocalizedInput
          :model-value="localizedInput.value"
          @update:model-value="(v: string) => localizedInput.value = v"
          :source-lang="localizedInput.lang"
          :translations="localizedInput.translations"
          @update:translations="(v: Record<string, string>) => localizedInput.translations = v"
          :locale-options="localeOptions"
          label="Localized title"
          placeholder="Localized text..."
        />
      </div>
      <p class="result">Translations: {{ JSON.stringify(localizedInput.translations) }}</p>
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
      <h2>HExpansionPanel</h2>
      <HExpansionPanel title="Electrical power" subtitle="9 colors">
        <p style="padding:12px">Material Design 3 expansion panel — animated body, aria-expanded header.</p>
      </HExpansionPanel>
      <div style="height:8px" />
      <HExpansionPanel title="Disabled panel" subtitle="cannot toggle" :disabled="true">
        <p style="padding:12px">Never opens.</p>
      </HExpansionPanel>
    </section>

    <section>
      <h2>HTabs (pill / underline / segmented)</h2>
      <HTabs v-model="tabs.active" :tabs="tabs.items" />
      <p class="result" style="margin-top:8px">Active tab: {{ tabs.active }}</p>
      <div style="margin-top:12px" />
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
      <h3>Narrow host → auto window (prev / current / next, edges fade)</h3>
      <div style="max-width:280px;padding:8px;border:1px dashed var(--hi-color-border, #888);border-radius:8px">
        <HTimeline :steps="wizardSteps" current-key="vendor" />
      </div>
      <h3>collapse="always" at the first step</h3>
      <div style="max-width:280px;padding:8px;border:1px dashed var(--hi-color-border, #888);border-radius:8px">
        <HTimeline :steps="wizardSteps" current-key="type" collapse="always" />
      </div>
    </section>

    <section>
      <h2>HMediaSlider</h2>
      <div class="row" style="width:min(420px,100%)">
        <HMediaSlider v-model:ratio="mediaSliderRatio" :buffered="0.85" />
        <span style="font-size:0.7rem;opacity:0.6">{{ Math.round(mediaSliderRatio * 100) }}%</span>
      </div>
    </section>

    <section>
      <h2>HMediaPlayer (audio)</h2>
      <HMediaPlayer type="audio" :src="demoAudioSrc" style="max-width:560px" />
    </section>

    <section>
      <h2>HImageViewer</h2>
      <HImageViewer :src="demoImageSrc" alt="Hikari demo image" />
    </section>

    <section>
      <h2>HZoomToolbar / HMinimap</h2>
      <div style="position:relative;height:200px;border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.35)">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.75rem;opacity:0.5">
          Host surface — zoom {{ zoomState.zoom.toFixed(2) }}x, pan ({{ Math.round(zoomState.panX) }}, {{ Math.round(zoomState.panY) }})
        </div>
        <HZoomToolbar
          :zoom="zoomState.zoom"
          :can-zoom-in="zoomState.canIn"
          :can-zoom-out="zoomState.canOut"
          :is-zoomed="zoomState.zoomed"
          @zoom-in="zoomIn"
          @zoom-out="zoomOut"
          @reset="zoomReset"
        />
        <HMinimap
          :boxes="zoomBoxes"
          :hub-pos="zoomHub"
          :zoom="zoomState.zoom"
          :pan-x="zoomState.panX"
          :pan-y="zoomState.panY"
          :viewport-width="800"
          :viewport-height="200"
          :content-bounds="zoomContent"
          :zoom-percent="Math.round(zoomState.zoom * 100)"
          :can-zoom-in="zoomState.canIn"
          :can-zoom-out="zoomState.canOut"
          show-reset
          @pan-delta="panBy"
        />
      </div>
    </section>

    <section>
      <h2>HTrendChart</h2>
      <HTrendChart :pens="trendPens" height="260px" style="max-width:760px" />
    </section>

    <section class="demo-footer">
      <p>Hikari v0.4.5 — Powered by celestia-island</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  HButton, HIconButton, HTooltip, HBadge, HTag, HIcon, HSpinner,
  HProgressBar, HProgressRing, HGaugeRing,
  HInput, HSearchInput, HNumberInput, HPasswordInput, HTextarea,
  HCheckbox, HSwitch, HRadio, HSelect, HSelectPanel,
  HLocalizedInput,
  HSkeleton, HSkeletonList, HAvatar, HKbd, HDivider,
  HAlert, HEmptyState, HExpansionPanel,
  HTabs, HCard, HTable, HTimeline,
  HMediaSlider, HMediaPlayer, HImageViewer,
  HZoomToolbar, HMinimap, HTrendChart,
  type TrendPen, type MinimapBox,
} from '@celestia-island/hikari'

const totalComponents = 64

const icons = ['home', 'settings', 'user', 'search', 'bell', 'heart', 'star', 'mail', 'download', 'upload', 'trash', 'edit', 'plus', 'check', 'x']

const form = ref({ text: '', search: '', number: 0, password: '', textarea: '' })
const anyForm = computed(() => Object.values(form.value).filter(v => v !== '' && v !== 0).join(', ') || null)
const flags = ref({ a: true, b: false, on: false, radio: 'x' })
const radioOpts = [{ value: 'x', label: 'X' }, { value: 'y', label: 'Y' }]
const gaugeRings = [{ pct: 45, color: 'rgb(var(--color-primary, 122 162 247))', trackColor: 'rgba(122, 162, 247, 0.15)' }]
const select = ref({ val: '', opts: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }] })
const localizedInput = ref({
  value: '工厂总览',
  lang: 'zh-Hans',
  translations: { en: 'Plant overview', 'zh-Hans': '工厂总览' } as Record<string, string>,
})
const localeOptions = [
  { code: 'en', label: 'English' },
  { code: 'zh-Hans', label: '简体中文' },
  { code: 'ja', label: '日本語' },
]
const panelAnchor = ref<HTMLElement | null>(null)
const panel = ref({
  open: false,
  checked: ['a'] as string[],
  opts: [
    { key: 'a', label: 'Recent' },
    { key: 'b', label: 'Starred' },
    { key: 'c', label: 'Archived' },
  ],
})
function togglePanelOpt(key: string, v: boolean) {
  panel.value.checked = v
    ? [...panel.value.checked, key]
    : panel.value.checked.filter((k) => k !== key)
}
const tabs = ref({ active: 'tab1', items: [{ key: 'tab1', label: 'Overview' }, { key: 'tab2', label: 'Details' }, { key: 'tab3', label: 'Settings' }] })

const tableCols = [{ key: 'name', title: 'Name' }, { key: 'role', title: 'Role' }]
const tableRows = [{ name: 'Alice', role: 'Admin' }, { name: 'Bob', role: 'Editor' }, { name: 'Charlie', role: 'Viewer' }]
const timelineSteps = [
  { key: 'v1', label: 'v1.0 Released' },
  { key: 'v11', label: 'v1.1' },
  { key: 'v2', label: 'v2.0' },
]
const wizardSteps = [
  { key: 'type', label: 'Type' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'apiKey', label: 'API key' },
  { key: 'models', label: 'Models' },
]

const mediaSliderRatio = ref(0.42)

function makeSilentWav(seconds = 2, sampleRate = 8000): string {
  const frames = seconds * sampleRate
  const bytes = 44 + frames
  const buf = new Uint8Array(bytes)
  const v = new DataView(buf.buffer)
  v.setUint32(0, 0x52494646, false) // "RIFF"
  v.setUint32(4, bytes - 8, true)
  v.setUint32(8, 0x57415645, false) // "WAVE"
  v.setUint32(12, 0x666d7420, false) // "fmt "
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate, true)
  v.setUint16(32, 1, true)
  v.setUint16(34, 8, true)
  v.setUint32(36, 0x64617461, false) // "data"
  v.setUint32(40, frames, true)
  return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...buf))
}
const demoAudioSrc = makeSilentWav()

const demoImageSrc =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
    <rect width="1600" height="900" fill="#1b2333"/>
    <g stroke="#2c3a55" stroke-width="1">
      ${Array.from({ length: 15 }, (_, i) => `<line x1="${i * 110}" y1="0" x2="${i * 110}" y2="900"/>`).join('')}
      ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 110}" x2="1600" y2="${i * 110}"/>`).join('')}
    </g>
    <circle cx="800" cy="450" r="180" fill="rgba(122,162,247,0.35)" stroke="#7aa2f7" stroke-width="3"/>
    <circle cx="800" cy="450" r="90" fill="rgba(122,162,247,0.2)" stroke="#7aa2f7" stroke-width="2" stroke-dasharray="6 4"/>
    <circle cx="800" cy="450" r="12" fill="#f7768e"/>
    <text x="800" y="700" fill="#9aa5ce" font-family="monospace" font-size="28" text-anchor="middle">Hikari — zoom / pan demo</text>
  </svg>`)

const zoomState = ref({ zoom: 1.6, panX: -40, panY: -18, canIn: true, canOut: true, zoomed: true })
const zoomBoxes: MinimapBox[] = [
  { id: 'a', bounds: { x: 60, y: 40, w: 200, h: 90 }, color: 'rgb(var(--color-info, 59 130 246))' },
  { id: 'b', bounds: { x: 340, y: 40, w: 200, h: 90 }, color: 'rgb(var(--color-success, 34 197 94))' },
  { id: 'c', bounds: { x: 200, y: 160, w: 200, h: 90 }, color: 'rgb(var(--color-warning, 245 158 11))' },
]
const zoomHub = { x: 300, y: 210 }
const zoomContent = { x: 0, y: 0, w: 600, h: 300 }
function zoomIn() {
  zoomState.value.zoom = Math.min(8, zoomState.value.zoom * 1.2)
  syncZoom()
}
function zoomOut() {
  zoomState.value.zoom = Math.max(1, zoomState.value.zoom / 1.2)
  syncZoom()
}
function zoomReset() {
  zoomState.value.zoom = 1
  zoomState.value.panX = 0
  zoomState.value.panY = 0
  syncZoom()
}
function panBy(dx: number, dy: number) {
  zoomState.value.panX += dx
  zoomState.value.panY += dy
  syncZoom()
}
function syncZoom() {
  const z = zoomState.value
  z.zoomed = z.zoom > 1
  z.canIn = z.zoom < 8
  z.canOut = z.zoom > 1
}

const now = Date.now()
const trendPens: TrendPen[] = [
  {
    label: 'CPU',
    thresholds: { h: 70, l: 15 },
    data: Array.from({ length: 40 }, (_, i) => ({
      time: now - (40 - i) * 15_000,
      value: 30 + Math.sin(i / 3) * 18 + (i % 7) * 2,
    })),
  },
  {
    label: 'Memory',
    thresholds: { hh: 90 },
    data: Array.from({ length: 40 }, (_, i) => ({
      time: now - (40 - i) * 15_000,
      value: 48 + Math.cos(i / 4) * 10,
    })),
  },
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
