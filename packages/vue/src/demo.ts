import './demo.scss'
import { createApp } from 'vue'
import { initTheme } from './theme/useTheme'

localStorage.setItem('hikari-theme', 'tokyonight')
initTheme()

import App from './DemoApp.vue'
createApp(App).mount('#app')
