# @celestia-island/hikari

Vue 3 component library sharing SCSS styles with the hikari Rust/WASM renderer.

## Installation

```bash
npm install @celestia-island/hikari
pnpm add @celestia-island/hikari
```

## Build Requirements

This package is a **source distribution**: the tarball ships the TypeScript,
TSX and SCSS sources under `src/`, and your build pipeline compiles them like
first-party code. Nothing is pre-bundled, so consuming projects must provide:

| Requirement | Why |
| --- | --- |
| `vue` (peer dependency) | Components are written for Vue 3 and import Vue at runtime. |
| TypeScript-aware bundler | Component and composable entry points resolve to `.ts`/`.tsx` sources (`main`/`types` → `src/index.ts`). |
| Vue JSX support | Components are written as `.tsx` render functions, not SFCs — enable `@vitejs/plugin-vue-jsx` (or your bundler's equivalent). |
| `sass` in your toolchain | Styling is distributed as SCSS; `@celestia-island/hikari/styles` resolves to an `.scss` aggregate your bundler compiles. Install `sass` as a devDependency of the consuming project. |

Minimal Vite configuration:

```ts
// vite.config.ts
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

export default {
  plugins: [vue(), vueJsx()],
}
```

## Usage

Import styles once in your app entry point:

```ts
// main.ts
import "@celestia-island/hikari/styles";
import { createApp } from "vue";
import App from "./App.vue";

createApp(App).mount("#app");
```

Use components in your templates:

```vue
<script setup lang="ts">
import { HkButton, HkCard, HkInput } from "@celestia-island/hikari";
</script>

<template>
  <HkCard>
    <HkInput v-model="text" placeholder="Type..." />
    <HkButton variant="primary">Submit</HkButton>
  </HkCard>
</template>
```

## Components

- **HkButton** — primary/secondary/danger/ghost variants
- **HkCard** — hoverable card container
- **HkInput** — text input with v-model
- **HkModal** — teleported dialog
- **HkSidebar** — collapsible sidebar
- **HkTabs** — tab navigation
- **HkToast** — toast notifications
- **HkAvatar** — image/fallback avatar
- And more...

## Development

`packages/vue` is its own pnpm workspace. After `corepack pnpm install`:

```bash
pnpm test        # Vitest suite (colocated *.test.ts(x), happy-dom)
pnpm test:watch  # Vitest in watch mode
pnpm lint        # vue-tsc --noEmit type check
```

## License

Licensed under the [Synthetic Source License (SySL), Version 1.0](../../LICENSE).
