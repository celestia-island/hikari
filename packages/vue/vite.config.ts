import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), vueJsx()],
  base: '/',
  test: {
    environment: 'happy-dom',
  },
  resolve: {
    alias: {
      '@celestia-island/hikari': resolve(__dirname, 'src'),
      // Cross-package contract tests import packages/default_theme sources,
      // whose peer deps (lucide-vue-next) resolve against THIS package's
      // install — the alias pins them to the same physical copy the vue
      // package itself uses, so module identity stays one instance.
      'lucide-vue-next': resolve(__dirname, 'node_modules/lucide-vue-next'),
      'vue': 'vue/dist/vue.esm-bundler.js',
    },
  },
  build: {
    outDir: resolve(__dirname, '../../target/docs'),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        render: resolve(__dirname, 'render.html'),
      },
      output: {
        manualChunks: undefined,
        assetFileNames: 'assets/[name].[ext]',
        entryFileNames: 'assets/[name].js',
      },
    },
  },
})
