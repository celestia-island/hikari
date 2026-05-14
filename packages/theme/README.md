# hikari-theme

Theme system for Hikari UI applications with glow effects and flat design aesthetics.

## Installation

```toml
[dependencies]
hikari-theme = "0.1"
hikari-palette = "0.1"
```

## Quick Start

```rust
use hikari_theme::ThemeProvider;

fn app() -> Element {
    rsx! {
        ThemeProvider { palette: "hikari".to_string(),
            div { class: "container",
                h1 { "Welcome to Hikari" }
                div { "Your app content" }
            }
        }
    }
}
```

## Documentation

For complete API documentation, theme customization, and nested theming, see [docs.rs](https://docs.rs/hikari-theme)

## Features

- **ThemeProvider Component** - Context-based theme management
- **CSS Variables System** - Dynamic theming via CSS custom properties
- **Built-in Themes** - Hikari (light) and Tairitsu (dark)
- **SCSS Mixins & Utilities** - Reusable styling helpers
- **Nested Theme Support** - Local theme override capability

## Supported Themes

| Theme | Type | Primary Color | Secondary Color |
|-------|------|---------------|-----------------|
| `hikari` | Light | 粉红 (Pink) | 苍翠 (Green) |
| `tairitsu` | Dark | 鷃蓝 (Navy Blue) | 姜黄 (Gold) |

## License

MIT OR Apache-2.0
