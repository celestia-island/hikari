import { createApp, type Component } from 'vue'
import { initTheme } from './theme/useTheme'
import { asIndexable, type HostWindow } from './utils/typing'
import * as hikari from './index'
import './demo.scss'

/** The docs harness injects this global before the render bundle runs (see
 *  render.html); a normal page never has it. */
interface RenderGlobals {
  __TEMPLATE__?: string
}

localStorage.setItem('hikari-theme', 'default')
initTheme()

const tpl = new URLSearchParams(location.search).get('tpl') || (window as HostWindow<RenderGlobals>).__TEMPLATE__ || '<div style="padding:1rem;color:var(--color-text-secondary)">No template provided</div>'

const app = createApp({ template: tpl })
// Register all hikari components globally
for (const [name, value] of Object.entries(asIndexable(hikari))) {
  // The namespace also carries utilities, constants and types; the H-prefixed
  // object entries are the `defineComponent` results.
  if (name.startsWith('H') && typeof value === 'object' && value !== null) {
    app.component(name, value as Component)
  }
}
app.mount('#app')
