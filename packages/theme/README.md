# hikari-theme

Theme system for Hikari UI applications — theme context, CSS-variable theming, built-in palettes, and SCSS mixins for the Hikari design system.

## Installation

```toml
[dependencies]
hikari-theme = "0.1.0"
hikari-palette = "0.1.0"
```

## Quick Start

```rust
use dioxus::prelude::*;
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

- **ThemeProvider Component** - Context-based theme management for Dioxus apps
- **CSS Variables System** - Dynamic theming via CSS custom properties
- **Multiple Built-in Themes** - Hikari (light) and Tairitsu (dark), plus runtime-registered custom palettes
- **SCSS Mixins & Utilities** - Reusable styling helpers
- **Nested Theme Support** - Local theme override capability

## Supported Themes

| Theme | Type | Primary Color | Secondary Color |
|-------|------|---------------|-----------------|
| `hikari` | Light | 石青 (Cyan/Blue) | 朱砂 (Vermilion/Red) |
| `tairitsu` | Dark | 靛蓝 (Indigo) | 朱砂 (Vermilion) |

## License

Licensed under the [Synthetic Source License (SySL), Version 1.0](../../LICENSE).
