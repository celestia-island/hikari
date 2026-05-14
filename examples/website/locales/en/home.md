# Hikari UI Framework

Hikari (光) is a modern Rust UI framework built with:

- **Tairitsu** - Reactive UI framework
- **Grass** - SCSS compiler
- **Axum** - Web server for SSR

## Design Philosophy

Hikari combines:

- **Flat Design** - Clean lines, high contrast
- **Glow Effects** - Subtle luminous touches
- **Named Color Palette** - 660+ colors as type-safe constants

## Quick Start

```bash
cargo new my-app
cd my-app
cargo add hikari-components hikari-theme
```

```rust
use hikari_components::{ThemeProvider, Button};

fn App() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari" } {
            Button { label: "Hello, Hikari!" }
        }
    }
}
```

## Features

- 🎨 660+ Named Colors
- 🌙 Light & Dark Themes
- 🔧 Type-safe Utility Classes
- ✨ Smooth Animations
- 📱 Responsive Components
- 🌐 Built-in i18n Support

## Documentation

Visit [docs.hikari.dev](https://docs.hikari.dev) for full documentation.
