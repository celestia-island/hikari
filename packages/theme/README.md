# hikari-theme

Theme system for Hikari UI applications with Arknights-inspired aesthetics and FUI design principles.

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
- **Multiple Built-in Themes** - Hikari (light), Tairitsu (dark), Arknights, Fresh
- **SCSS Mixins & Utilities** - Reusable styling helpers
- **Nested Theme Support** - Local theme override capability

## Supported Themes

| Theme | Type | Primary Color | Secondary Color |
|-------|------|---------------|-----------------|
| `hikari` | Light | 石青 (Cyan/Blue) | 朱砂 (Vermilion/Red) |
| `tairitsu` | Dark | 靛蓝 (Indigo) | 朱砂 (Vermilion) |
| `arknights` | Light | 石青 (Cyan/Blue) | 朱砂 (Vermilion) |
| `fresh` | Light | 月白 (Light White) | 葱倩 (Green) |

## License

MIT OR Apache-2.0
