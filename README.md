<div align="center"><img src="./docs/logo_x256.png" width="120" /></div>
<h1 align="center">Hikari</h1>
<div align="center">
 <strong>The Frontend of Everything</strong>
</div>

<br />

<div align="center">
  <a href="https://github.com/celestia-island/hikari/actions">
    <img src="https://img.shields.io/github/actions/workflow/status/celestia-island/hikari/clippy.yml?branch=master" alt="CI" />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg" alt="License" />
  </a>
  <a href="https://github.com/casey/just">
    <img src="https://img.shields.io/badge/built%20with-just-blue" alt="Built with just" />
  </a>
</div>

<div align="center">
  <h3>
    <a href="https://celestia.world">Website</a>
    <span> | </span>
    <a href="#quick-start">Quick Start</a>
    <span> | </span>
    <a href="docs/en/guides/ARCHITECTURE.md">Architecture</a>
  </h3>
</div>

<br/>

> A Rust UI framework built on WASI — not traditional WASM glue, but a first-class WebAssembly Component Model runtime via [Tairitsu](https://github.com/celestia-island/tairitsu).

## Why Hikari?

Most Rust web UI frameworks compile to `wasm32-unknown-unknown` and use JavaScript glue code to bridge Rust and the browser. Hikari takes a different path: it targets **WASI** (`wasm32-wasip2`) through Tairitsu's vdom and hooks runtime, running UI logic inside a WebAssembly Component Model container with type-safe WIT bindings — no JS bridge, no `wasm-bindgen`, no `web-sys` shims.

The result is a component framework where host-guest communication (DOM, events, layout, styling) flows through a proper component interface rather than ad-hoc FFI calls.

## Features

- **WASI-native runtime** — runs inside Tairitsu's component container, not on raw `wasm-bindgen`
- **40+ UI components** — three-layer architecture (basic → data → production)
- **Type-safe SCSS** — compile-time class hashing via `include_scss!` macro
- **Glow effect system** — Arknights-inspired flat design with FUI sci-fi aesthetics
- **Animation engine** — GSAP-inspired state machine with `prefers-reduced-motion` support
- **9-language i18n** — including RTL support, powered by `tairitsu-web`
- **Chinese traditional color palette** — 500+ historical colors as type-safe constants

## Quick Start

### Prerequisites

- Rust 1.82+
- [Tairitsu](https://github.com/celestia-island/tairitsu) checked out as a sibling directory (`../tairitsu`)
- `just` (command runner), Python 3.11+

### Installation

```toml
[dependencies]
hikari-palette = "0.1.10"
hikari-theme = "0.1.10"
hikari-components = "0.1.10"
```

### Build & Run

```bash
cargo install just

just build      # Build workspace
just test       # Run tests
just fmt        # Format code
just clippy     # Lint
just dev        # Start dev server (website demo)
```

### Example

```rust
use tairitsu_macros::rsx;
use tairitsu_vdom::Node;
use hikari_theme::ThemeProvider;
use hikari_components::Button;

fn app() -> Node {
    rsx! {
        <ThemeProvider palette="arknights".to_string()>
            <div class="container">
                <h1>"Welcome to Hikari"</h1>
                <Button variant={ButtonVariant::Primary}>
                    "Get Started"
                </Button>
            </div>
        </ThemeProvider>
    }
}
```

## Workspace Packages

| Package | Description |
| --- | --- |
| `hikari-palette` | 500+ traditional Chinese colors with type-safe constants |
| `hikari-theme` | Theme provider, CSS variables, SCSS mixins |
| `hikari-animation` | State machine animation engine, easing, lifecycle hooks |
| `hikari-components` | 40+ UI components in three layers |
| `hikari-extra-components` | Node graph system, advanced components |
| `hikari-icons` | MDI icon integration with SVG AST rendering |

## Documentation

- [Architecture Overview](docs/en/guides/ARCHITECTURE.md)
- [Contributing Guidelines](docs/en/guides/CONTRIBUTING.md)
- [Migration Guide](docs/en/guides/07-migration-guide.md)
- Multilingual docs under `docs/` (en, zhs, zht, ja, ko, fr, es, ru, ar)

## License

Hikari is dual-licensed under MIT OR Apache-2.0.

## Name

"Hikari" (光) means "light" in Japanese, from the rhythm game [Arcaea](https://arcaea.lowiro.com/).
