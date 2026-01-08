# hikari-icons

Type-safe Lucide Icons integration for Dioxus applications with 1000+ pre-generated icons.

## Overview

`hikari-icons` provides:

- **1000+ Lucide Icons** - Complete Lucide icon set (derived from [Lucide](https://lucide.dev))
- **Type-Safe Enum** - Compile-time icon name checking
- **Inline SVG Rendering** - No external requests or icon fonts
- **Zero Runtime Overhead** - Icons embedded at compile time
- **Dioxus Integration** - Seamless component-based usage
- **Convenient Shortcuts** - Helper functions for common icons

## Design Philosophy

This crate uses **embedded SVG content** with **type-safe enumeration**:

```rust
// Type-safe - compile-time checked
rsx! {
    Icon { icon: LucideIcon::Menu, size: 24 }
    Icon { icon: LucideIcon::ChevronRight, class: "w-6 h-6" }
}

// Convenient shortcuts
rsx! {
    shortcuts::ChevronLeft("nav-icon".to_string())
    shortcuts::Settings("settings-icon".to_string())
}
```

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
hikari-icons = "0.1.0"
```

**Default Features**: `embedded` - Icons are embedded at compile time (enabled by default)

## Usage

### Basic Icon Usage

The simplest way to use icons:

```rust
use dioxus::prelude::*;
use hikari_icons::{Icon, LucideIcon};

#[component]
fn MyComponent() -> Element {
    rsx! {
        Icon { icon: LucideIcon::Menu, size: 24 }
        Icon { icon: LucideIcon::ChevronRight, size: 32 }
        Icon { icon: LucideIcon::Home, class: "text-blue-600", size: 20 }
    }
}
```

### Icon with Custom Styling

Apply custom CSS classes and styles:

```rust
rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        class: "text-primary hover:scale-110 transition-transform"
    }

    Icon {
        icon: LucideIcon::Bell,
        size: 32,
        class: "text-red-500"
    }

    Icon {
        icon: LucideIcon::Settings,
        class: "cursor-pointer"
    }
}
```

### Icon Shortcuts

Use convenient shortcuts for frequently used icons:

```rust
use hikari_icons::shortcuts;

#[component]
fn Navbar() -> Element {
    rsx! {
        div { class: "nav",
            shortcuts::ChevronLeft("nav-icon".to_string())
            shortcuts::ChevronRight("nav-icon".to_string())
            shortcuts::Settings("settings-icon".to_string())
            shortcuts::Bell("notification-icon".to_string())
        }
    }
}
```

### Available Shortcuts

| Shortcut | Icon | Description |
|----------|------|-------------|
| `ChevronLeft(class)` | `chevron_left` | Left chevron for navigation |
| `ChevronRight(class)` | `chevron_right` | Right chevron for navigation |
| `ChevronUp(class)` | `chevron_up` | Up chevron |
| `ChevronDown(class)` | `chevron_down` | Down chevron |
| `Bell(class)` | `bell` | Bell/notification icon |
| `User(class)` | `circle_user` | User profile icon |
| `X(class)` | `cross` | X icon for closing |
| `Settings(class)` | `cog` | Settings gear icon |
| `Star(class)` | `circle_star` | Star/favorite icon |
| `Award(class)` | `award` | Award/badge icon |
| `Calendar(class)` | `calendar` | Calendar icon |
| `Clock(class)` | `clock` | Clock/time icon |
| `Book(class)` | `book` | Book icon |
| `Check(class)` | `check` | Checkmark icon |
| `Badge(class)` | `badge` | Alert/badge icon |

### Icon Sizing

Control icon size with the `size` prop:

```rust
rsx! {
    // Small icon (16px)
    Icon { icon: LucideIcon::Search, size: 16 }

    // Default icon (24px)
    Icon { icon: LucideIcon::Menu, size: 24 }

    // Large icon (32px)
    Icon { icon: LucideIcon::Settings, size: 32 }

    // Extra large icon (48px)
    Icon { icon: LucideIcon::Home, size: 48 }
}
```

### Icon Coloring

Apply colors using CSS classes:

```rust
rsx! {
    // Using CSS color classes
    Icon { icon: LucideIcon::Check, class: "text-green-500" }
    Icon { icon: LucideIcon::X, class: "text-red-500" }
    Icon { icon: LucideIcon::AlertCircle, class: "text-yellow-500" }

    // Using Hikari theme colors
    Icon { icon: LucideIcon::Star, class: "text-primary" }
    Icon { icon: LucideIcon::Heart, class: "text-secondary" }
}
```

### Interactive Icons

Combine with Dioxus event handlers:

```rust
use dioxus::prelude::*;

#[component]
fn IconButton() -> Element {
    rsx! {
        button {
            class: "icon-button",
            onclick: move |_| println!("Settings clicked!"),
            Icon {
                icon: LucideIcon::Settings,
                size: 24,
                class: "hover:rotate-90 transition-transform"
            }
        }
    }
}
```

### Dynamic Icons

Use signals to switch icons dynamically:

```rust
use dioxus::prelude::*;

#[component]
fn ToggleButton() -> Element {
    let mut is_open = use_signal(|| false);

    rsx! {
        button {
            onclick: move |_| is_open.toggle(),
            Icon {
                icon: if is_open() {
                    LucideIcon::ChevronUp
                } else {
                    LucideIcon::ChevronDown
                },
                size: 24
            }
        }
    }
}
```

## Available Icons

### Icon Categories

#### Navigation Icons
- `Menu`, `Home`, `Search`
- `ChevronLeft`, `ChevronRight`, `ChevronUp`, `ChevronDown`
- `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`
- `CornerUpLeft`, `CornerUpRight`

#### Action Icons
- `Edit`, `Trash`, `Check`, `X`, `Plus`, `Minus`
- `Copy`, `Cut`, `Paste`
- `Undo`, `Redo`
- `ZoomIn`, `ZoomOut`

#### Status Icons
- `AlertCircle`, `AlertTriangle`, `Info`, `CheckCircle`
- `XCircle`, `Loader`, `RefreshCw`

#### UI Icons
- `Settings`, `Bell`, `User`, `Lock`, `Unlock`
- `Eye`, `EyeOff`, `Calendar`, `Clock`
- `MapPin`, `Navigation`

#### File Icons
- `File`, `FileText`, `Image`, `Music`, `Video`
- `Folder`, `FolderOpen`, `Archive`
- `Download`, `Upload`, `Share`

#### Social Icons
- `Mail`, `MessageCircle`, `Send`
- `Github`, `Twitter`, `Linkedin`

#### And 900+ more...

See [lucide.dev/icons](https://lucide.dev/icons/) for the complete list.

## Icon Enumeration

Icons are represented as an enum for type safety:

```rust
pub enum LucideIcon {
    // Navigation
    menu,
    home,
    search,
    chevron_left,
    chevron_right,
    chevron_up,
    chevron_down,

    // Actions
    edit,
    trash,
    check,
    x,
    plus,
    minus,

    // Status
    alert_circle,
    check_circle,
    info,

    // ... 1000+ more variants
}
```

### Enum Naming Convention

Icon names use **snake_case** to match Rust naming conventions:

| Lucide Name | Rust Enum |
|-------------|-----------|
| `chevron-left` | `chevron_left` |
| `arrow-right` | `arrow_right` |
| `zoom-in` | `zoom_in` |
| `file-text` | `file_text` |

## API Reference

### `Icon` Component

```rust
#[component]
pub fn Icon(
    icon: LucideIcon,
    #[props(default)] class: String,
    #[props(default = 24)] size: u32,
) -> Element
```

**Props**:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `LucideIcon` | (required) | The icon to render |
| `class` | `String` | `""` | CSS classes to apply |
| `size` | `u32` | `24` | Icon size in pixels |

**Example**:
```rust
rsx! {
    Icon {
        icon: LucideIcon::Menu,
        class: "nav-icon".to_string(),
        size: 32
    }
}
```

### `LucideIcon` Enum

Type-safe enumeration of all available icons:

```rust
pub enum LucideIcon {
    // 1000+ icon variants
}
```

**Methods**:

```rust
impl LucideIcon {
    /// Convert icon to string name
    pub fn to_string(&self) -> String {
        // Returns kebab-case name (e.g., "chevron-left")
    }
}
```

### `IconExt` Trait

Extension trait for getting SVG content:

```rust
pub trait IconExt {
    /// Get the SVG content for this icon
    fn get_svg(&self) -> &'static str;
}

impl IconExt for LucideIcon {
    fn get_svg(&self) -> &'static str {
        // Returns inline SVG string
    }
}
```

**Usage**:
```rust
let svg = LucideIcon::Menu.get_svg();
// Returns: r#"<svg xmlns="http://www.w3.org/2000/svg" ...>"#
```

## Build System

### Icon Generation

Icons are generated at build time from Lucide icon set:

1. **Fetch Icons** - Download from Lucide GitHub/GitHub API
2. **Generate Enum** - Create `LucideIcon` enum with all variants
3. **Embed SVGs** - Embed SVG content as static strings
4. **Build Helpers** - Generate helper functions and shortcuts

### Feature Flags

```toml
[features]
default = ["embedded"]
embedded = []  # Icons embedded at compile time (default)
```

**`embedded`** (default):
- Icons are embedded in the binary
- No runtime loading
- Slightly larger binary size
- Faster rendering

**Without `embedded`** (future):
- Icons loaded at runtime
- Smaller binary size
- Requires icon files at runtime

## SVG Structure

Generated SVG icons have this structure:

```html
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- Icon paths -->
  <path d="..." />
  <!-- Additional paths/shapes -->
  <circle cx="12" cy="12" r="10" />
</svg>
```

### SVG Attributes

| Attribute | Value | Description |
|-----------|-------|-------------|
| `width` | `size` | Icon width (from prop) |
| `height` | `size` | Icon height (from prop) |
| `viewBox` | `0 0 24 24` | SVG coordinate system |
| `fill` | `none` | No fill (stroke only) |
| `stroke` | `currentColor` | Inherits text color |
| `stroke-width` | `2` | Stroke thickness |
| `stroke-linecap` | `round` | Rounded line caps |
| `stroke-linejoin` | `round` | Rounded line joins |

## Styling Guidelines

### Icon Colors

Use `currentColor` to inherit text color:

```rust
rsx! {
    // Inherits parent text color
    span { class: "text-blue-500",
        Icon { icon: LucideIcon::Search }
    }

    // Explicit color class
    Icon {
        icon: LucideIcon::Heart,
        class: "text-red-500"
    }
}
```

### Icon Spacing

Use utility classes for spacing:

```rust
rsx! {
    div { class: "flex items-center gap-2",
        Icon { icon: LucideIcon::Search, size: 20 }
        span { "Search" }
    }
}
```

### Icon Animations

Apply CSS transitions for smooth effects:

```rust
rsx! {
    Icon {
        icon: LucideIcon::Settings,
        class: "hover:rotate-90 transition-transform duration-300"
    }

    Icon {
        icon: LucideIcon::Heart,
        class: "hover:scale-110 transition-transform"
    }
}
```

## Best Practices

### DO ✅

- Use semantic icons that match their purpose
- Provide appropriate `size` for different contexts
- Use `currentColor` for flexible coloring
- Add hover states for interactive icons
- Include appropriate ARIA labels for accessibility

```rust
rsx! {
    button {
        "aria-label": "Settings",
        Icon {
            icon: LucideIcon::Settings,
            class: "hover:rotate-90"
        }
    }
}
```

### DON'T ❌

- Don't use overly large icons (>48px) - consider using images instead
- Don't mix different icon styles in the same UI
- Don't forget accessibility labels for standalone icon buttons
- Don't use icons without considering their cultural meanings

## Performance

### Binary Size Impact

- **With embedded icons**: ~500KB increase in binary size
- **Runtime**: Zero overhead (already in memory)
- **Rendering**: Minimal (inline SVG is very fast)

### Optimization Tips

1. **Use selective icons** - Only import what you need (future feature)
2. **Compress binaries** - Use `upx` or similar for production
3. **Cache icons** - Browser caches inline SVG content automatically

## Accessibility

### ARIA Labels

Always provide ARIA labels for standalone icon buttons:

```rust
rsx! {
    button {
        "aria-label": "Close",
        Icon { icon: LucideIcon::X }
    }

    button {
        "aria-label": "Toggle menu",
        Icon { icon: LucideIcon::Menu }
    }
}
```

### Icon + Text

When icons accompany text, hide decorative icons:

```rust
rsx! {
    button {
        span { "aria-hidden": "true",
            Icon { icon: LucideIcon::Search }
        }
        span { "Search" }
    }
}
```

## Integration with Dioxus

The `Icon` component integrates seamlessly with Dioxus:

```rust
use dioxus::prelude::*;
use hikari_icons::{Icon, LucideIcon};

#[component]
fn AppBar() -> Element {
    rsx! {
        div { class: "app-bar",
            div { class: "logo",
                Icon { icon: LucideIcon::Menu, size: 24 }
                span { "My App" }
            }
            div { class: "actions",
                Icon { icon: LucideIcon::Search, size: 24 }
                Icon { icon: LucideIcon::Settings, size: 24 }
            }
        }
    }
}
```

## License

MIT OR Apache-2.0

## Acknowledgments

- [Lucide](https://lucide.dev) - Beautiful & consistent icon toolkit
- [Dioxus](https://dioxuslabs.com/) - Portable, performant, and ergonomic framework for Rust
