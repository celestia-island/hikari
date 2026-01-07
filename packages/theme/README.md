# hikari-theme

A comprehensive theme system for Hikari applications, providing theme context, CSS variables, SCSS utilities, and multiple built-in themes.

## Overview

`hikari-theme` provides:

- **ThemeProvider Component** - Context-based theme management for Dioxus apps
- **CSS Variables System** - Dynamic theming via CSS custom properties
- **Multiple Built-in Themes** - Primary, FUI Dark, Arknights, and Fresh themes
- **SCSS Mixins & Utilities** - Reusable styling helpers
- **Responsive Design Utilities** - Mobile-first responsive design tools
- **Type-Safe Theme Switching** - Easy theme transitions in Rust

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
hikari-theme = "0.1.0"
hikari-palette = "0.1.0"
```

## Quick Start

### Basic Usage

```rust
use dioxus::prelude::*;
use hikari_theme::ThemeProvider;
use hikari_components::Button;

fn app() -> Element {
    rsx! {
        ThemeProvider { palette: "arknights".to_string(),
            div { class: "container",
                h1 { "Welcome to Hikari" }
                Button { variant: ButtonVariant::Primary, "Click Me" }
            }
        }
    }
}
```

## Themes

### Available Themes

#### Primary Theme
The default Hikari theme with balanced traditional Chinese colors.

```rust
ThemeProvider { palette: "primary".to_string(), children }
```

**Colors**: Stone Cyan primary, Cinnabar secondary, clean dark backgrounds

#### FUI Dark Theme
Futuristic sci-fi theme with glowing accents and deep blacks.

```rust
ThemeProvider { palette: "fui-dark".to_string(), children }
```

**Colors**: Purple/violet accents, deep navy backgrounds, cyan highlights

#### Arknights Theme
Inspired by Arknights' clean flat design.

```rust
ThemeProvider { palette: "arknights".to_string(), children }
```

**Colors**: Cyan primary, red secondary, high contrast

#### Fresh Theme
Light theme with clean, refreshing colors.

```rust
ThemeProvider { palette: "fresh".to_string(), children }
```

**Colors**: White backgrounds, green primary, soft shadows

## CSS Variables

### Color Variables

Each theme defines the following CSS variables:

```css
--hi-color-primary          /* Primary brand color */
--hi-color-secondary        /* Secondary accent color */
--hi-color-accent           /* Highlight color */
--hi-color-success          /* Success state color */
--hi-color-warning          /* Warning state color */
--hi-color-danger           /* Error/danger color */
--hi-color-background       /* Main background */
--hi-color-surface          /* Card/surface background */
--hi-color-border           /* Border/divider color */
--hi-color-text-primary     /* Primary text color */
--hi-color-text-secondary   /* Secondary text color */
```

### Usage in CSS

```css
.my-component {
    background-color: var(--hi-color-surface);
    color: var(--hi-color-text-primary);
    border: 1px solid var(--hi-color-border);
}

.my-component:hover {
    background-color: var(--hi-color-primary);
}
```

### SCSS Variables

Sass variables for compile-time theming:

```scss
// Typography
$hikari-font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
$hikari-font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', ...;

// Font sizes
$hikari-font-size-xs: 0.75rem;
$hikari-font-size-sm: 0.875rem;
$hikari-font-size-base: 1rem;
$hikari-font-size-lg: 1.125rem;
$hikari-font-size-xl: 1.25rem;
$hikari-font-size-2xl: 1.5rem;
$hikari-font-size-3xl: 1.875rem;

// Spacing
$hikari-spacing-xs: 0.25rem;
$hikari-spacing-sm: 0.5rem;
$hikari-spacing-md: 1rem;
$hikari-spacing-lg: 1.5rem;
$hikari-spacing-xl: 2rem;
$hikari-spacing-2xl: 3rem;

// Border radius
$hikari-radius-sm: 0.25rem;
$hikari-radius-md: 0.5rem;
$hikari-radius-lg: 0.75rem;
$hikari-radius-xl: 1rem;
$hikari-radius-full: 9999px;

// Shadows
$hikari-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
$hikari-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
$hikari-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
$hikari-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);

// Transitions
$hikari-transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
$hikari-transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
$hikari-transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

## SCSS Mixins

### Border Radius Mixin

```scss
.my-component {
    @include hikari-radius-md;
}
```

### Flexbox Mixins

```scss
.container {
    @include hikari-flex-center;
}

.row {
    @include hikari-flex-row;
}

.column {
    @include hikari-flex-column;
}
```

### Typography Mixins

```scss
h1 {
    @include hikari-text-xl;
    @include hikari-font-bold;
}

.subtitle {
    @include hikari-text-sm;
    @include hikari-text-secondary;
}
```

## Theme Switching

### Dynamic Theme Switching

```rust
use dioxus::prelude::*;

fn app() -> Element {
    let mut theme = use_signal(|| "primary".to_string());

    rsx! {
        ThemeProvider { palette: theme(),
            div {
                button {
                    onclick: move |_| theme.set("fui-dark".to_string()),
                    "Switch to FUI Dark"
                }
                button {
                    onclick: move |_| theme.set("arknights".to_string()),
                    "Switch to Arknights"
                }
            }
        }
    }
}
```

### Persistent Theme Preference

```rust
use dioxus::prelude::*;
use gloo::storage::LocalStorage;

fn app() -> Element {
    let mut theme = use_signal(|| {
        LocalStorage::get("theme").unwrap_or_else(|_| "primary".to_string())
    });

    use_effect(move || {
        let _ = LocalStorage::set("theme", theme());
        async move {}
    });

    rsx! {
        ThemeProvider { palette: theme(),
            // Your app content
        }
    }
}
```

## Custom Styling

### Using Hikari Variables

```css
/* In your custom CSS */
.custom-button {
    background-color: var(--hi-color-primary);
    color: var(--hi-color-text-primary);
    padding: var(--hi-spacing-sm) var(--hi-spacing-md);
    border-radius: var(--hi-radius-md);
    transition: all var(--hi-transition-fast);
    font-family: var(--hi-font-family-sans);
    font-size: var(--hi-font-size-base);
}

.custom-button:hover {
    background-color: var(--hi-color-secondary);
    box-shadow: var(--hi-shadow-md);
}
```

### SCSS Integration

```scss
// In your SCSS file
@import '~hikari-theme/styles/variables.scss';
@import '~hikari-theme/styles/mixins.scss';

.my-component {
    background: var(--hi-color-surface);
    padding: $hikari-spacing-md;
    border-radius: $hikari-radius-lg;
    @include hikari-transition-base;
}
```

## Responsive Design

### Breakpoint System

```scss
// Breakpoints (defined in variables.scss)
$hikari-breakpoint-sm: 640px;
$hikari-breakpoint-md: 768px;
$hikari-breakpoint-lg: 1024px;
$hikari-breakpoint-xl: 1280px;
```

### Responsive Mixins

```scss
.container {
    padding: $hikari-spacing-sm;

    @include hikari-media-md {
        padding: $hikari-spacing-md;
    }

    @include hikari-media-lg {
        padding: $hikari-spacing-xl;
    }
}
```

## Component Styling Guide

### Button Styling Example

```css
.hikari-button {
    background-color: var(--hi-color-primary);
    color: var(--hi-color-text-primary);
    border: none;
    padding: 0.5rem 1rem;
    border-radius: var(--hi-radius-md);
    cursor: pointer;
    transition: all var(--hi-transition-fast);
    font-family: var(--hi-font-family-sans);
    font-weight: 500;
}

.hikari-button:hover {
    background-color: var(--hi-color-secondary);
    box-shadow: var(--hi-shadow-md);
    transform: translateY(-1px);
}

.hikari-button:active {
    transform: translateY(0);
}

.hikari-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
```

### Card Styling Example

```css
.hikari-card {
    background-color: var(--hi-color-surface);
    border: 1px solid var(--hi-color-border);
    border-radius: var(--hi-radius-lg);
    padding: var(--hi-spacing-lg);
    box-shadow: var(--hi-shadow-sm);
    transition: box-shadow var(--hi-transition-base);
}

.hikari-card:hover {
    box-shadow: var(--hi-shadow-lg);
}
```

## Animation System

### Transition Utilities

```css
.fade-in {
    animation: hikari-fade-in var(--hi-transition-base);
}

.slide-up {
    animation: hikari-slide-up var(--hi-transition-base);
}
```

### FUI Glow Effects

```css
.fui-glow {
    box-shadow:
        0 0 10px var(--hi-color-primary),
        0 0 20px var(--hi-color-primary);
}

.fui-text-glow {
    text-shadow:
        0 0 10px var(--hi-color-primary),
        0 0 20px var(--hi-color-primary);
}
```

## Best Practices

1. **Use CSS Variables** - Always prefer `var(--hi-*)` over hardcoded colors
2. **Semantic Naming** - Use semantic color variables (primary, success) over specific colors
3. **Spacing Scale** - Stick to the predefined spacing scale for consistency
4. **Responsive First** - Design mobile-first, enhance for larger screens
5. **Performance** - Use `will-change` and `transform` for animations (not `top`/`left`)

## API Reference

### ThemeProvider Component

```rust
#[component]
pub fn ThemeProvider(props: ThemeProviderProps) -> Element
```

**Props:**
- `palette: String` - Theme name ("primary", "fui-dark", "arknights", "fresh")
- `children: Element` - Child components

## Examples

See the [examples](../../examples/) directory for complete working examples:
- `demo-app/` - Comprehensive theme showcase
- `ssr-demo/` - Server-side rendering with theming

## License

MIT OR Apache-2.0
