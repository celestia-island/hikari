# @celestia-island/hikari

Vue 3 component library sharing SCSS styles with the hikari Rust/WASM renderer.

## Installation

```bash
npm install @celestia-island/hikari
pnpm add @celestia-island/hikari
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

## License

BUSL-1.1
