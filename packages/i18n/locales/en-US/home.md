# Hikari UI Framework

Hikari (光) is a modern Rust UI framework built with:

- **Dioxus 0.7** - Reactive UI framework
- **Grass** - SCSS compiler
- **Axum** - Web server for SSR

## Design Philosophy

Hikari combines:

- **Arknights Aesthetics** - Clean lines, high contrast
- **FUI (Future User Interface)** - Glow effects, dynamic indicators
- **Traditional Chinese Colors** - 500+ authentic color names

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

- 🎨 500+ Traditional Chinese Colors
- 🌙 Light & Dark Themes
- 🔧 Type-safe Utility Classes
- ✨ Smooth Animations
- 📱 Responsive Components
- 🌐 Built-in i18n Support

## Documentation

Visit [docs.hikari.dev](https://docs.hikari.dev) for full documentation.
