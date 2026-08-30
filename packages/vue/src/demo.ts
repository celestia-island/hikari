import './demo.scss'
import { createApp } from 'vue'
import { initTheme } from './theme/useTheme'
import * as hikari from './index'

// Mobile UX contract (viewport zoom never refused; tap-highlight lives in
// foundation.scss). Applied at bootstrap before mount, per the hook contract.
hikari.applyViewportPolicy({ allowZoomOut: true })

localStorage.setItem('hikari-theme', 'tokyonight')
initTheme()

const tpl = (window as any).__HIKARI_TPL__
if (tpl) {
  const app = createApp({ template: tpl })
  for (const [name, comp] of Object.entries(hikari)) {
    if (name.startsWith('H') && typeof comp === 'object') {
      app.component(name, comp as any)
    }
  }
  app.mount('#app')
} else {
  import('./DemoApp').then(m => {
    createApp(m.default).mount('#app')
  })
}
