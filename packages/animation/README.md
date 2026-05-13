# hikari-animation

High-performance, declarative animation system for Tairitsu with dynamic values, complex timelines, and smooth transitions.

## Installation

```toml
[dependencies]
hikari-animation = "0.1"
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

- **No Global Side Effects**: Does not use `MutationObserver` to monitor global DOM
- **Reactive State**: Uses Tairitsu hooks (`use_ref`, `use_effect`)
- **Automatic Cleanup**: Tairitsu automatically handles cleanup on unmount
- **High Performance**: Direct CSS variable updates without re-render

### Usage

```rust
use hikari_animation::Glow;

rsx! {
    Glow {
        color: "rgba(255, 255, 255, 0.3)",
        intensity: 0.5,
        // children go here
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

## Documentation

For complete API documentation, easing functions, and performance tips, see [docs.rs](https://docs.rs/hikari-animation)

## Features

- **Type-Safe CSS** - Compile-time checked CSS properties
- **Dynamic Value Computation** - Calculate animation values at runtime from context
- **Multi-Element Control** - Animate multiple DOM elements simultaneously
- **Debounced Updates** - Throttle animation updates for performance
- **8+ Easing Functions** - Natural motion with bezier, bounce, elastic, overshoot and more
- **Timeline Control** - Sequence and coordinate complex animations
- **Mouse Spotlight Effects** - Create interactive mouse-following animations
- **Component-Isolated Glow** - Glow component with no global side effects

## License

MIT OR Apache-2.0
