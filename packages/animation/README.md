# hikari-animation

High-performance, declarative animation system for Dioxus with dynamic values, complex timelines, and smooth transitions.

## Installation

```toml
[dependencies]
hikari-animation = "0.1.0"
```

**Note**: This crate is designed for **WASM targets only** (`target_arch = "wasm32"`).

## Quick Start

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// Static animation
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .apply_with_transition("300ms", "ease-in-out");

// Dynamic animation (mouse following)
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

## Glow Component

The `Glow` component provides a mouse-following glow effect with **component-isolated design**:

### Component-Isolated Features

- ✅ **No Global Side Effects**: Does not use `MutationObserver` to monitor global DOM
- ✅ **Reactive State**: Uses Dioxus hooks (`use_node_ref`, `use_effect`)
- ✅ **Automatic Cleanup**: Dioxus automatically handles cleanup on unmount
- ✅ **High Performance**: Direct CSS variable updates without re-render

### Usage

```rust
use dioxus::prelude::*;
use hikari_animation::Glow;

rsx! {
    Glow {
        color: "rgba(255, 255, 255, 0.3)",
        intensity: 0.5,
        Card {
            "Card with glow effect"
        }
    }
}
```

### Props

- `color: String` - Glow color (default: `"rgba(255, 255, 255, 0.3)"`)
- `intensity: f64` - Glow intensity (default: `0.3`)
- `children: Element` - Child elements

### Performance Characteristics

- Each component independently manages state, no interference between components
- **Zero Re-render on Mouse Move**: CSS variables are updated directly via DOM API
- **Percentage-based Positioning**: Mouse position is calculated as percentage relative to element
- **CSS Hover for Visibility**: Glow shows/hides via CSS `:hover` pseudo-class, no JavaScript needed

### Internal Implementation

The Glow component uses:
- `use_node_ref` for direct DOM access
- `use_effect` to initialize CSS variables on mount
- `onmousemove` handler for mouse tracking with `getBoundingClientRect()`
- Direct CSS variable updates via `element.set_attribute("style", ...)`
- CSS variables (`--glow-x`, `--glow-y`, `--glow-color`, `--glow-intensity`) for dynamic updates

## Documentation

For complete API documentation, easing functions, and performance tips, see [docs.rs](https://docs.rs/hikari-animation)

## Features

- **Type-Safe CSS** - Compile-time checked CSS properties
- **Dynamic Value Computation** - Calculate animation values at runtime from context
- **Multi-Element Control** - Animate multiple DOM elements simultaneously
- **Debounced Updates** - Throttle animation updates for performance
- **30+ Easing Functions** - Natural motion with ease-in-out, bounce, elastic, and more
- **Timeline Control** - Sequence and coordinate complex animations
- **Mouse Spotlight Effects** - Create interactive mouse-following animations
- **Component-Isolated Glow** - Glow component with no global side effects

## License

MIT OR Apache-2.0
