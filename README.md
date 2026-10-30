<div align="center"><img src="https://raw.githubusercontent.com/celestia-island/docs.celestia.world/master/res/logo/hikari.png" /></div>
<h1 align="center">Hikari</h1>
<div align="center">
  <strong>
    The Frontend of Everything
  </strong>
</div>

<br />

<div align="center">
  <!-- CI status -->
  <a href="https://github.com/celestia-island/hikari/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/celestia-island/hikari/ci.yml"
      alt="CI Status" />
  </a>
  <!-- Built with tairitsu -->
  <a href="https://github.com/celestia-island/tairitsu">
    <img src="https://img.shields.io/badge/tairitsu-0.5-blue.svg" alt="Built on tairitsu">
  </a>
  <!-- License -->
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-SySL%201.0-blue" alt="License: SySL">
  </a>
  <!-- Rust -->
  <a href="https://www.rust-lang.org/">
    <img src="https://img.shields.io/badge/rust-1.85-orange.svg" alt="Rust 1.85">
  </a>
  <!-- crates.io -->
  <a href="https://crates.io/crates/hikari-components">
    <img src="https://img.shields.io/badge/crates.io-0.4-orange.svg" alt="crates.io">
  </a>
  <!-- docs.rs -->
  <a href="https://docs.rs/hikari-components">
    <img src="https://docs.rs/hikari-components/badge.svg" alt="docs.rs" />
  </a>
</div>

<div align="center">
  <h3>
    <a href="https://celestia.world">
      Website
    </a>
    <span> | </span>
    <a href="#quick-start">
      Quick Start
    </a>
    <span> | </span>
    <a href="docs/en/">
      Documentation
    </a>
    <span> | </span>
    <a href="docs/en/guides/ARCHITECTURE.md">
      Architecture
    </a>
  </h3>
</div>

<br/>

> One design system, two runtimes — production-grade UI components for Vue 3 and Rust/WASM

**Hikari** (光, "light") is a next-generation UI library built around a single design system that ships to two first-class runtimes: the `hikari-*` crates for Rust/WASM (on the [tairitsu](https://github.com/celestia-island/tairitsu) framework — `tairitsu-vdom`, `tairitsu-hooks`, `tairitsu-macros`, `tairitsu-style` ^0.5.18) and `@celestia-island/hikari` for Vue 3. Both runtimes share the same SCSS design core, theming model, and motion vocabulary, so a product keeps one visual language whether it renders in a Vue application or a Rust/WASM target. The same core is designed to grow further — toward powering standalone applications beyond the browser.

## Vision

Hikari is built for the next generation of application interfaces:

- **One design system, two runtimes** - The same components, tokens, and themes render in Vue 3 (TypeScript) and Rust/WASM alike, driven by a shared SCSS core
- **Production-grade components** - Layout, forms, data-heavy tables and trees, feedback, navigation, i18n, and iconography — themable at runtime through CSS variables, with light/dark and custom presets
- **Type-safe and fast end to end** - Compile-time stylesheets and checked color tokens on the Rust side, first-class TypeScript on the Vue side
- **Beyond the browser** - Optional SSR via Axum today, and a design core intended to extend to standalone application UIs

The result is a UI library that scales with your architecture: start in either ecosystem, and carry the same visual language everywhere the product goes next.

## Packages

| Package | Description |
| --- | --- |
| `hikari-palette` | Color catalog: curated collections and themed palettes with rich metadata and type-safe constants |
| `hikari-theme` | Theme context/provider, CSS variables, built-in themes, SCSS mixins |
| `hikari-animation` | Animation engine (Tween, Motion, States) used by components |
| `hikari-components` | Core UI components: layout, buttons, inputs, table, tree, feedback, navigation |
| `hikari-icons` | Icon set with compile-time discovery (auto-discovers used icons) |
| `hikari-builder` | Build-time ClassesBuilder system |
| `hikari-i18n` | Locale resources |
| `@celestia-island/hikari` | Vue 3 port (`packages/vue`), sharing the same SCSS design system |

The Rust crates are published to [crates.io](https://crates.io/search?q=hikari) (current 0.4.x) with docs on [docs.rs](https://docs.rs/hikari-components).

## Tech Stack

- **Framework**: [tairitsu](https://github.com/celestia-island/tairitsu) — tairitsu-vdom/hooks/macros/style ^0.5.18 (compiles to `wasm32` / WASI)
- **Styling**: SCSS compiled via `grass` + `scss!` compile-time stylesheets
- **Server**: Axum 0.8 (optional SSR support)
- **Language**: Rust 1.85 (edition 2024)
- **Web port**: Vue 3 (TypeScript, `packages/vue`, npm package `@celestia-island/hikari`)
- **Build System**: Justfile

## Quick Start

### Rust (tairitsu)

Add the crates to your `Cargo.toml`:

```toml
[dependencies]
tairitsu-vdom = "^0.5.18"
tairitsu-hooks = "^0.5.18"
tairitsu-macros = "^0.5.18"
hikari-palette = "^0.4"
hikari-theme = "^0.4"
hikari-animation = "^0.4"
hikari-icons = "^0.4"
hikari-i18n = "^0.4"
hikari-components = { version = "^0.4", features = ["basic", "feedback", "navigation", "layout", "data"] }
```

or with `cargo add`:

```bash
cargo add tairitsu-vdom@^0.5.18 tairitsu-hooks@^0.5.18 tairitsu-macros@^0.5.18
cargo add hikari-palette@^0.4 hikari-theme@^0.4 hikari-animation@^0.4 hikari-icons@^0.4 hikari-i18n@^0.4
cargo add hikari-components@^0.4
```

Component features are organized in groups — `basic`, `feedback`, `navigation`, `layout`, `data`, `display`, `entry`, `production` — each enabling a set of individual component features (e.g. `button`, `table`, `tree`, `toast`). The default feature set covers all groups.

Basic usage:

```rust
use tairitsu_macros::{component, rsx};
use tairitsu_vdom::VNode;
use hikari_theme::ThemeProvider;
use hikari_components::*;

#[component]
fn App() -> VNode {
    rsx! {
        ThemeProvider { initial_palette: "hikari".to_string(),
            div { class: "container",
                Button { variant: ButtonVariant::Primary, "Get Started" }
            }
        }
    }
}
```

> Note: `hikari-components` and the tairitsu crates are published on crates.io. Local development can point the tairitsu crates at working copies via `[patch.crates-io]` in `~/.cargo/config.toml`.

### Vue 3

The Vue port ships as `@celestia-island/hikari` (`packages/vue`), published to the npm registry as a **source distribution**: the package contains the TypeScript and SCSS sources, and consumer build pipelines (Vite + vue-tsc + sass) compile them like first-party code — no build step happens on publish. Depend on it from the registry:

```json
// package.json
{
  "dependencies": {
    "@celestia-island/hikari": "^*"
  }
}
```

The package exposes these subpaths:

| Specifier | Resolves to |
| --- | --- |
| `@celestia-island/hikari` | `src/index.ts` — all `Hk*` components, composables, `initTheme` |
| `@celestia-island/hikari/runtime` | `src/runtime/index.ts` |
| `@celestia-island/hikari/styles` | `src/styles/index.scss` — full SCSS aggregate (monorepo/dev use) |
| `@celestia-island/hikari/styles/*` | `src/styles/*` — e.g. `styles/admin-tokens.scss`, `styles/theme/base.scss` |
| `@celestia-island/hikari/components/*` | `src/components/*` — e.g. `components/HkSelectionGrid` |
| `@celestia-island/hikari/plugins` | `src/plugins/index.ts` |

Import the styles once in your app entry point (or the granular `styles/*` subpaths if you assemble your own bundle), then use the `Hk*` components (HkButton, HkCard, HkInput, HkModal, ...) in your templates:

```ts
import "@celestia-island/hikari/styles";
```

For local development against an upstream working copy, use `celestia-devtools link-npm-siblings` — it overlays `node_modules` with symlinks to sibling checkouts (tracked in `node_modules/.celestia-linked-siblings.json`, revert with `--remove`). No `link:` dependencies, no workspace-member manifests, and CI/production always resolve the pure registry package.

### Theme initialization

Components consume the theme through CSS variables (`--color-*`, `--hi-*`). Call `initTheme()` once at app startup to inject the active preset (the single `default` preset — pink/paper in light mode, black-blue in dark) with light/dark mode and custom-theme support:

```ts
import { initTheme } from "@celestia-island/hikari";

initTheme();
```

Components render correctly even without `initTheme()` — `packages/vue/src/tokens.scss` ships a static default light theme, and `initTheme()` overrides it at runtime via inline styles. For runtime theme/mode switching (e.g. a `HkThemeToggle`), use `useTheme()`:

```ts
import { useTheme } from "@celestia-island/hikari";

const { currentTheme, currentMode, setTheme, setMode, toggleMode } = useTheme();
```

**Mode is carried by the `data-mode` attribute** (`"light"` / `"dark"`) on `<html>`: `applyTheme()` writes it in the same pass that injects the channel variables, and `theme.scss` derives `color-scheme` from it. Components that need a mode-specific value key off that attribute (`[data-mode="dark"] .my-rule`) rather than `light-dark()` — a stylesheet using that CSS function cannot be safely minified down to older engine floors (the minifier rewrites it into an undeclared custom-property pair), which is why the library's own SCSS avoids it. A host that replaces the preset table wholesale must still set `html[data-mode]` (booting through `initTheme()` does that for you) or the dark arms will not engage.

## Documentation

The full documentation lives under `docs/` in 9 languages:

- [English](docs/en/) · [简体中文](docs/zh-Hans/) · [繁體中文](docs/zh-Hant/) · [日本語](docs/ja/) · [한국어](docs/ko/)
- [Español](docs/es/) · [Français](docs/fr/) · [Русский](docs/ru/) · [العربية](docs/ar/)

Live component pages from the docs (rendered by the hikari components
themselves):

<p align="center">
  <img src="res/readme-components-button.png" alt="hikari buttons — flat design with glow accents" width="45%" />
  <img src="res/readme-components-form.png" alt="hikari form controls — inputs and selection" width="45%" />
</p>

Key pages:

- [Architecture Overview](docs/en/guides/ARCHITECTURE.md)
- [Contributing Guidelines](docs/en/guides/CONTRIBUTING.md)
- [Design Overview](docs/en/design/overview.md)
- [System Overview](docs/en/system/overview.md)

Package-level docs:

- [hikari-palette](packages/palette/README.md)
- [hikari-theme](packages/theme/README.md)
- [hikari-animation](packages/animation/README.md)
- [hikari-components](packages/components/README.md)
- [hikari-icons](packages/icons/README.md)
- [hikari-vue (@celestia-island/hikari)](packages/vue/README.md)

## Development

### Prerequisites

- Rust 1.85+ (edition 2024)
- `just` (command runner) — `cargo install just`
- Node.js + pnpm (for the Vue port)

### Build Commands

```bash
# Build all packages (release)
just build

# Build for development
just build-dev

# Run tests
just test

# Format code
just fmt

# Run clippy lints
just clippy

# Start the development server
just dev
```

## Contributing

We welcome contributions! Please see the [Contributing guide](docs/en/guides/CONTRIBUTING.md) for guidelines.

## License

Hikari is licensed under the [Synthetic Source License (SySL), Version 1.0](./LICENSE).

## Acknowledgments

Inspired by and built upon:

- [Tairitsu](https://github.com/celestia-island/tairitsu) - The full-stack Rust framework the native runtime is built on
- [ChineseColors](https://github.com/zhaoolee/ChineseColors) - Color data source for one palette collection
- [akasha](https://github.com/TairitsuMC/akasha) - Node graph system reference

## Name

"Hikari" (光) means "light" in Japanese. The name comes from the rhythm game [Arcaea](https://arcaea.lowiro.com/). It stands for clarity and precision in interface design — one visual language that follows your product across every runtime it runs on.
