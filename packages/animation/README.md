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

## License

MIT OR Apache-2.0
