# Icons System

Icon management and rendering system, integrated with Material Design Icons (MDI).

## Overview

`hikari-icons` provides:

- **1000+ Icons** - Complete Material Design Icons (MDI) collection
- **Type Safe** - Enum-based icon names
- **SVG Rendering** - Client-side and server-side rendering
- **Runtime Loading** - On-demand icon SVG loading

## Icon Component

### Basic Usage

```rust
use hikari_icons::{Icon, MdiIcon};

rsx! {
    Icon {
        icon: MdiIcon::Magnify,
        size: 24,
        color: "var(--hi-color-primary)"
    }
}
```

### Available Icons

```rust
pub enum MdiIcon {
    // Navigation
    Home,
    Menu,
    Magnify,
    Cog,
    ChevronDown,
    ChevronLeft,
    ChevronRight,

    // Actions
    Pencil,
    Delete,
    Check,
    Close,
    Plus,
    Minus,

    // Status
    AlertCircleOutline,
    CheckCircleOutline,
    InformationOutline,
    AlertOutline,

    // ... 1000+ icons
}
```

### Props

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `icon` | `MdiIcon` | - | Icon type |
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
    icon: MdiIcon,
    size: Option<u32>,
    color: Option<&str>,
    class: Option<String>,
    style: Option<String>
) -> Element
```

### MdiIcon

```rust
pub enum MdiIcon {
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
