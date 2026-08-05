import { createApp } from 'vue'
import { initTheme } from './theme/useTheme'
import * as hikari from './index'
import './demo.scss'

localStorage.setItem('hikari-theme', 'tokyonight')
initTheme()

const tpl = new URLSearchParams(location.search).get('tpl') || (window as any).__TEMPLATE__ || '<div style="padding:1rem;color:var(--color-text-secondary)">No template provided</div>'

const app = createApp({ template: tpl })
// Register all hikari components globally
for (const [name, comp] of Object.entries(hikari)) {
  if (name.startsWith('H') && typeof comp === 'object') {
    app.component(name, comp as any)
  }
}
app.mount('#app')
