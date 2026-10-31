import './demo.scss'
import { createApp, type Component } from 'vue'
import { initTheme } from './theme/useTheme'
import { asIndexable, type HostWindow } from './utils/typing'
import * as hikari from './index'

/** The docs harness injects this global before the demo bundle runs (see the
 *  demo html shell); a normal page never has it. */
interface DemoGlobals {
  __HIKARI_TPL__?: string
}

// Mobile UX contract (viewport zoom never refused; the tap-highlight reset
// lives in the canonical host reset, styles/reset.scss). Applied at
// bootstrap before mount, per the hook contract.
hikari.applyViewportPolicy({ allowZoomOut: true })

localStorage.setItem('hikari-theme', 'default')
initTheme()

const tpl = (window as HostWindow<DemoGlobals>).__HIKARI_TPL__
if (tpl) {
  const app = createApp({ template: tpl })
  for (const [name, value] of Object.entries(asIndexable(hikari))) {
    // The namespace also carries utilities, constants and types; the
    // H-prefixed object entries are the `defineComponent` results, which is
    // the set a template-first demo needs registered globally.
    if (name.startsWith('H') && typeof value === 'object' && value !== null) {
      app.component(name, value as Component)
    }
  }
  app.mount('#app')
} else {
  import('./DemoApp').then(m => {
    createApp(m.default).mount('#app')
  })
}
