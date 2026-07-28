import './demo.scss'
import { createApp } from 'vue'
import { initTheme } from './theme/useTheme'
import * as hikari from './index'

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
  import('./DemoApp.vue').then(m => {
    createApp(m.default).mount('#app')
  })
}
