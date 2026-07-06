# hikari-icons

Type-safe Material Design Icons (MDI) integration for Dioxus with 7,447 icons.

## Installation

```toml
[dependencies]
hikari-icons = "0.1.0"
```

## Quick Start

```rust
use dioxus::prelude::*;
use hikari_icons::{Icon, MdiIcon};

rsx! {
    Icon { icon: MdiIcon::Search, size: 24, class: "text-primary" }
    Icon { icon: MdiIcon::MoonWaningCrescent, class: "w-6 h-6" }
}
```

## Documentation

For complete API documentation, icon shortcuts, and dynamic icon usage, see [docs.rs](https://docs.rs/hikari-icons)

## Features

- **7,447 MDI Icons** - Complete Material Design Icons collection
- **Type-Safe Enum** - Compile-time icon name checking
- **Inline SVG Rendering** - No external requests or icon fonts
- **Zero Runtime Overhead** - Icons loaded on-demand
- **Convenient Shortcuts** - Helper functions for common icons

## Dynamic Icons

⚠️ **Important**: When dynamically changing icons (e.g., theme toggle), use a reactive `key` on the wrapper component, not on `Icon` itself. See [documentation](https://docs.rs/hikari-icons) for details.

## License

MIT OR Apache-2.0
