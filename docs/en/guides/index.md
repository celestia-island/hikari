# Hikari UI Framework

> A modern Rust UI framework built on Tairitsu + Grass + Axum
>
> **Design Style**:  flat design +  sci-fi aesthetics + Traditional Chinese colors
>
> **Name Origin**: "Hikari" (Light) from the rhythm game Arcaea

## What is Hikari?

Hikari is a modern UI framework designed for the Rust ecosystem, combining traditional Chinese color aesthetics with sci-fi interface design. The framework adopts a modular design, providing a complete component library, theme system, and animation system.

## Core Features

### 🎨 Traditional Chinese Color System
- **500+ Traditional Colors**: Complete traditional Chinese color palette
- **Theme System**: Built-in Hikari (light) and Tairitsu (dark) themes
- **Type-Safe**: Compile-time checked color values

### 🧩 Rich Component Library
- **Basic Components**: Button, Input, Card, Badge
- **Feedback Components**: Alert, Toast, Tooltip, Spotlight
- **Navigation Components**: Menu, Tabs, Breadcrumb
- **Data Components**: Table, Tree, Pagination
- **Layout Components**: Layout, Header, Aside, Content, Footer
- **Extra Components**: Collapsible, DragLayer, ZoomControls

### ✨ Powerful Animation System
- **Declarative Animations**: CSS-like fluent API
- **Dynamic Values**: Runtime-computed animation values
- **Easing Functions**: 30+ easing functions
- **Preset Animations**: Fade, slide, scale, etc.

### 🎯 Advanced Features
- **Server-Side Rendering**: Complete SSR support
- **Type Safety**: Full utilization of Rust's type system
- **Responsive Design**: Built-in responsive layout utilities
- **Build System**: Automated SCSS compilation and asset generation

## Quick Start

### Install Dependencies

Add to `Cargo.toml`:

```toml
[dependencies]
hikari-components = "0.1"
hikari-palette = "0.1"
hikari-theme = "0.1"
tairitsu = "0.5"
```

### Basic Usage

```rust
use hikari_components::{ThemeProvider, Button};
use hikari_theme::ThemeProvider;

#[component]
fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            div { class: "hi-flex hi-flex-col hi-gap-4" {
                Button { label: "Click Me" }
                Button { label: "Primary Button", variant: "primary" }
                Button { label: "Secondary Button", variant: "secondary" }
            }
        }
    }
}
```

### Build and Run

```bash
# Development mode
cargo run

# Build
cargo build --release

# Build WASM
trunk build --release
```

## Design Philosophy

###  Flat Design
- Clean lines and clear information hierarchy
- High contrast for readability
- Minimalist yet refined design

###  Sci-Fi Aesthetics
- Subtle glow effects
- Dynamic indicators (breathing lights, pulse animations)
- Fine borders and geometric patterns

### Traditional Chinese Colors
- Primary: 石青 (Cyan/Blue), 朱砂 (Vermilion/Red), 藤黄 (Gamboge/Yellow)
- Neutral: 月白 (Light White), 墨色 (Ink Black), 缟色 (Light Gray)
- Functional: 葱倩 (Success), 鹅黄 (Warning), 朱砂 (Danger)

## Project Structure

```
hikari/
 ├── packages/
 │   ├── hikari-palette/          # Traditional Chinese color palette
 │   ├── hikari-theme/            # Theme system
 │   ├── hikari-animation/        # Animation system
 │   ├── hikari-icons/            # Icon system
 │   ├── hikari-components/       # Component library
 │   ├── hikari-extra-components/ # Extra components library
 │
 └── examples/
     ├── website/                 # Official website
     ├── table-demo/              # Table component demo
     ├── tree-demo/               # Tree component demo
     └── node-graph-demo/         # Node graph demo
```

## Documentation

- [Components](./components/) - UI component usage guide
- [System](./system/) - Core system architecture
- [API Reference](https://docs.rs/hikari-components) - Rust API documentation

## Examples

### Theme Switching

```rust
use hikari_theme::ThemeProvider;

fn App() -> Element {
    let mut theme = use_signal(|| "hikari".to_string());

    rsx! {
        ThemeProvider { palette: "{theme}" } {
            button {
                onclick: move |_| {
                    theme.set(if *theme() == "hikari" {
                        "tairitsu".to_string()
                    } else {
                        "hikari".to_string()
                    });
                },
                "Toggle Theme"
            }
        }
    }
}
```

### Using Animations

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// Static animation
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// Dynamic animation (mouse following)
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](../../en-US/guides/CONTRIBUTING.md) for details.

## License

[MIT License](../../../LICENSE)

## Acknowledgments

- **Tairitsu** - Powerful Rust UI framework
- [Grass](https://github.com/kaj/kaj) - Pure Rust SCSS compiler
- [Element Plus](https://element-plus.org/) - Excellent component library design reference
- [Material UI](https://mui.com/) - Modern UI design inspiration

---

**Hikari** - Minimalism, Technology, Cultural Confidence
