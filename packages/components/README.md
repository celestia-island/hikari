# hikari-components

Comprehensive UI component library with Arknights-style design and FUI (Future User Interface) aesthetics.

## Installation

```toml
[dependencies]
hikari-components = "0.1.0"
hikari-theme = "0.1.0"
hikari-palette = "0.1.0"
dioxus = "0.7"
```

## Quick Start

```rust
use dioxus::prelude::*;
use hikari_components::*;
use hikari_theme::ThemeProvider;

fn app() -> Element {
    rsx! {
        ThemeProvider { palette: "arknights".to_string(),
            div { class: "container",
                Button { variant: ButtonVariant::Primary, "Click Me" }
                Card {
                    header: rsx! { h2 { "Card Title" } },
                    "Card content goes here"
                }
            }
        }
    }
}
```

## Documentation

For complete API documentation and component examples, see [docs.rs](https://docs.rs/hikari-components)

## Features

### Component Categories

| Category | Feature | Components |
|----------|----------|-----------|
| Basic | `basic` | Button, Input, Card, Badge |
| Feedback | `feedback` | Alert, Toast, Tooltip |
| Navigation | `navigation` | Menu, Tabs, Breadcrumb |
| Data | `data` | Table, Tree, Pagination |
| Layout | (always) | Layout, Header, Aside, Content |

### Feature Flags

Enable all basic components:
```toml
[dependencies]
hikari-components = { features = ["basic"] }
```

Enable specific components:
```toml
[dependencies]
hikari-components = { features = ["button", "input", "card"] }
```

## License

MIT OR Apache-2.0
