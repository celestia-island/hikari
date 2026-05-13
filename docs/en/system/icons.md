# Icons System

Icon management and rendering system, integrated with Lucide Icons.

## Overview

`hikari-icons` provides:

- **1000+ Icons** - Complete Lucide Icons collection
- **Type Safe** - Enum-based icon names
- **SVG Rendering** - Client-side and server-side rendering
- **Runtime Loading** - On-demand icon SVG loading

## Icon Component

### Basic Usage

```rust
use dioxus::prelude::*;
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### Available Icons

```rust
pub enum LucideIcon {
    // Navigation
    Home,
    Menu,
    Search,
    Settings,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // Actions
    Edit,
    Trash,
    Check,
    X,
    Plus,
    Minus,

    // Status
    AlertCircle,
    CheckCircle,
    Info,
    AlertTriangle,

    // ... 1000+ icons
}
```

### Props

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `icon` | `LucideIcon` | - | Icon type |
| `size` | `u32` | `24` | Icon size |
| `color` | `&str` | - | Color |

## Runtime Loading

### Client-side Rendering

```rust
use hikari_icons::runtime;

// Asynchronously load icon SVG
async fn load_icon(name: &str) -> Result<String, Error> {
    runtime::load_icon(name).await
}
```

### Server-side Rendering

```rust
use hikari_icons::server;

// Server-side render icon
fn render_icon(name: &str) -> String {
    server::render_icon(name)
}
```

## API Reference

### Icon

```rust
#[component]
pub fn Icon(
    icon: LucideIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### LucideIcon

```rust
pub enum LucideIcon {
    // 1000+ icon variants
}
```

### runtime

```rust
pub mod runtime {
    pub async fn load_icon(name: &str) -> Result<String, Error>;
}
```

### server

```rust
pub mod server {
    pub fn render_icon(name: &str) -> String;
}
```

## Integration with Other Systems

- **Components** - Icons used in Button, Input, and other components
- **Render-service** - Static icon file service
- **Theme** - Icon colors inherit from theme

## Related Systems

- [Components](../components/) - Components using icons
- [Render-service](./render-service.md) - Icon file service
- [Palette](./palette.md) - Icon colors
