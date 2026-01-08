<div align="center"><img src="./website/res/icons/logo.png" /></div>
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
    <img src="https://img.shields.io/github/actions/workflow/status/celestia-island/hikari/ci.yml?branch=main"
      alt="CI Status" />
  </a>
  <!-- Built with -->
  <a href="https://sagiegurari.github.io/cargo-make">
    <img src="https://sagiegurari.github.io/cargo-make/assets/badges/cargo-make.svg" alt="Built with cargo-make">
  </a>
  <!-- License -->
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg" alt="License: MIT OR Apache-2.0">
  </a>
  <!-- Rust -->
  <a href="https://www.rust-lang.org/">
    <img src="https://img.shields.io/badge/rust-1.52+-orange.svg" alt="Rust 1.52+">
  </a>
  <!-- Dioxus -->
  <a href="https://dioxuslabs.com/">
    <img src="https://img.shields.io/badge/dioxus-0.7-blue.svg" alt="Dioxus 0.7">
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
    <a href="#examples">
      Examples
    </a>
    <span> | </span>
    <a href="docs/ARCHITECTURE.md">
      Architecture
    </a>
  </h3>
</div>

<br/>

> A modern Rust UI framework blending traditional Chinese aesthetics with futuristic sci-fi design

**Hikari** (光 - "Light") is a comprehensive UI framework built with [Dioxus](https://dioxuslabs.com/), featuring a unique design system inspired by Arknights' clean aesthetics, FUI (Futuristic User Interface) elements, and a rich palette of traditional Chinese colors. The name "Hikari" comes from the rhythm game [Arcaea](https://arcaea.lowiro.com/).

## Vision

Hikari embodies three core design philosophies:

- **Arknights Flat Design** - Clean lines, clear information hierarchy, high contrast, and refined simplicity
- **FUI Sci-Fi Aesthetics** - Subtle glow effects, dynamic indicators, precise borders, and geometric patterns
- **Chinese Traditional Colors** - 500+ authentic historical colors for cultural depth and visual richness

The result is a UI framework that feels both ancient and futuristic, professional yet approachable, with a distinctive visual identity that stands out from conventional component libraries.

## Tech Stack

- **Frontend**: Dioxus 0.7 (WebAssembly)
- **Styling**: Grass (SCSS compiler) + SCSS
- **Server**: Axum 0.8 (optional SSR support)
- **Language**: Rust 1.52+
- **Build System**: Justfile
- **Tooling**: Python 3.11+ (formatting and linting)

## Features

### hikari-palette

- 500+ traditional Chinese colors
- Rich color metadata (hex, RGB, CMYK, historical notes)
- Pre-defined palettes for different design systems
- Type-safe color constants with Chinese names

### hikari-theme

- Theme context and provider
- CSS variables system
- Multiple built-in themes (Primary, FUI Dark, Arknights, Fresh)
- SCSS mixins and utilities
- Responsive design utilities

### hikari-components

- **Layout System**: Layout, Header, Aside, Content, Container, Grid, Row, Col, Section, Spacer
- **Basic Components**: Button, Input, Card, Badge
- **Feedback**: Alert, Toast, Tooltip
- **Navigation**: Menu, Tabs, Breadcrumb
- **Data Display**: Table (modular with pagination, sort, filter, selection)
- **Data Display**: Tree (modular with virtual scroll, drag-drop, collapse)

### hikari-extra-components

- **Node Graph System**: Canvas, nodes, ports, connections, minimap, context menu
- **Advanced Utilities**: Collapsible, DragLayer, ZoomControls
- Perfect for visual editors, workflow builders, and data visualization

### hikari-render-service

- Server-Side Rendering support
- Easy Axum integration
- Static asset serving
- Type-safe router builder
- Production-ready error handling
- Style service with CSS injection

## Quick Start

### Installation

Add Hikari to your `Cargo.toml`:

```toml
[dependencies]
hikari-palette = "0.1.0"
hikari-theme = "0.1.0"
hikari-components = "0.1.0"
```

### Basic Usage

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;
use hikari_components::Button;

fn app() -> Element {
    rsx! {
        ThemeProvider { palette: "arknights".to_string(),
            div { class: "container",
                h1 { "Welcome to Hikari" }
                p { "A fusion of tradition and technology" }

                Button {
                    variant: ButtonVariant::Primary,
                    onclick: |_| println!("Clicked!"),
                    "Get Started"
                }
            }
        }
    }
}
```

### With Chinese Colors

```rust
use hikari_palette::{石青, 朱砂, 藤黄};

fn customize_theme() {
    let primary = 石青;
    let secondary = 朱砂;
    let accent = 藤黄;

    println!("Primary: {} ({})", primary.name, primary.hex);
    // Output: Primary: 石青 (#1759A8)
}
```

## Package Structure

```
hikari/
├── packages/
│   ├── hikari-palette/          # Chinese color system
│   ├── hikari-theme/            # Theme system + SCSS
│   ├── hikari-components/       # Basic components
│   ├── hikari-extra-components/ # Advanced components
│   └── hikari-render-service/   # SSR + style service
│
├── examples/
│   ├── website/                 # Comprehensive website
│   ├── table-demo/              # Table component demo
│   ├── tree-demo/               # Tree component demo
│   ├── node-graph-demo/         # Node graph demo
│   └── ssr-demo/                # SSR example
│
├── docs/
│   ├── ARCHITECTURE.md          # Architecture overview
│   └── CONTRIBUTING.md          # Contributing guidelines
│
├── Cargo.toml                   # Workspace configuration
├── PLAN.md                      # Implementation plan
└── README.md                    # This file
```

## Examples

### Layout Component

```rust
use hikari_components::layout::{Layout, Header, Aside};

rsx! {
    Layout {
        header: rsx! {
            Header {
                h1 { "My Application" }
            }
        },
        aside: rsx! {
            Aside {
                nav {
                    a { "Home" }
                    a { "About" }
                    a { "Contact" }
                }
            }
        },
        main {
            p { "Main content goes here..." }
        }
    }
}
```

### Button Component

```rust
rsx! {
    Button {
        variant: ButtonVariant::Primary,
        size: ButtonSize::Large,
        onclick: |_| println!("Clicked!"),
        "Click Me"
    }

    Button {
        variant: ButtonVariant::Ghost,
        icon: rsx! { Icon { name: "search" } },
        "Search"
    }

    Button {
        variant: ButtonVariant::Danger,
        loading: true,
        "Processing..."
    }
}
```

### Theme Provider

```rust
rsx! {
    ThemeProvider {
        palette: "fui-dark".to_string(),
        // All components automatically use the FUI Dark theme
        Button { "FUI Button" }
    }
}
```

### SSR Integration

```rust
use hikari_render_service::HikariRenderServicePlugin;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let app = HikariRenderServicePlugin::new()
        .add_route("/api/health", health_handler)
        .static_assets("./dist")
        .build()?;

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
```

## Design Philosophy

### Arknights Flat Design

- Clean, sharp lines and edges
- Clear information hierarchy
- High contrast for readability
- Minimalist without being boring

### FUI Sci-Fi Aesthetics

- Subtle glow effects (`box-shadow`, `text-shadow`)
- Dynamic indicators (breathing lights, pulse animations)
- Fine 1px semi-transparent borders
- Geometric patterns (hexagons, grids)

### Animation Principles

- Subtle transitions (150ms ease)
- Functional animations over decorative
- Smooth, natural motion curves
- No jarring or distracting effects

### Chinese Color System

- **Primary Colors**: Stone Cyan (石青), Cinnabar (朱砂), Vine Yellow (藤黄), Indigo (靛蓝)
- **Neutral Colors**: Moon White (月白), Ink Black (墨色), Silk Gray (缟色)
- **Functional Colors**: Scallion Green (葱倩 - success), Goosling Yellow (鹅黄 - warning), Cinnabar (朱砂 - danger)

Each color carries historical significance, adding cultural depth to your applications.

## Development

### Prerequisites

- Rust 1.52+
- Python 3.11+ (for tooling scripts)
- Just (command runner)

### Build Commands

```bash
# Install just
cargo install just

# Build all packages
just build

# Run tests
just test

# Format code
just fmt

# Run linter
just lint

# Start development server
just dev
```

### Package Status

- [x] hikari-palette - Complete
- [x] hikari-theme - Complete
- [x] hikari-components - Basic components complete
- [ ] hikari-extra-components - In progress
- [x] hikari-render-service - Core features complete

See [PLAN.md](PLAN.md) for detailed implementation status.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Contributing Guidelines](docs/CONTRIBUTING.md)
- [hikari-palette Documentation](packages/hikari-palette/README.md)
- [hikari-theme Documentation](packages/hikari-theme/README.md)
- [hikari-components Documentation](packages/hikari-components/README.md)
- [hikari-extra-components Documentation](packages/hikari-extra-components/README.md)
- [hikari-render-service Documentation](packages/hikari-render-service/README.md)

## License

Hikari is dual-licensed under:

- MIT License ([LICENSE-MIT](LICENSE-MIT) or <https://opensource.org/licenses/MIT>)
- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <https://www.apache.org/licenses/LICENSE-2.0>)

You may choose either license for your use.

## Acknowledgments

Inspired by and built upon:

- [Dioxus](https://dioxuslabs.com/) - The Rust UI framework
- [Arknights](https://www.arknights.global/) - Design language inspiration
- [ChineseColors](https://github.com/zhaoolee/ChineseColors) - Traditional color palette
- [tairitsu](https://github.com/TairitsuMC/tairitsu) - Architecture patterns
- [akasha](https://github.com/TairitsuMC/akasha) - Node graph system reference

## Name

"Hikari" (光) means "light" in Japanese, representing:

- Illumination through knowledge and culture
- The fusion of tradition (ancient wisdom) and technology (future innovation)
- Bringing clarity and beauty to user interfaces

Let Hikari illuminate your applications with the perfect blend of tradition and technology.
