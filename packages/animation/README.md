# hikari-animation

A high-performance, declarative animation system for Dioxus applications with support for dynamic values, complex timelines, and smooth transitions.

## Overview

`hikari-animation` provides:

- **Type-Safe CSS Manipulation** - Compile-time checked CSS properties
- **Dynamic Value Computation** - Calculate animation values at runtime from context
- **Multi-Element Control** - Animate multiple DOM elements simultaneously
- **Debounced Updates** - Throttle animation updates for performance
- **30+ Easing Functions** - Natural motion with ease-in-out, bounce, elastic, and more
- **Timeline Control** - Sequence and coordinate complex animations
- **Mouse Spotlight Effects** - Create interactive mouse-following animations
- **WASM Optimized** - Designed specifically for WebAssembly targets

## Design Philosophy

This crate uses a **fluent builder pattern** combined with **runtime context** for powerful, declarative animations:

```rust
// Static values - simple and direct
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "200px")
    .apply();

// Dynamic values - computed at runtime
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        format!("translate({}px, {}px)", ctx.mouse_x(), ctx.mouse_y())
    })
    .apply_with_transition("300ms", "ease-in-out");
```

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
hikari-animation = "0.1.0"
```

**Note**: This crate is designed for **WASM targets only** (`target_arch = "wasm32"`).

## Usage

### Basic Static Animation

The simplest form of animation uses static CSS values:

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

fn example(button_element: web_sys::HtmlElement) {
    let mut elements = HashMap::new();
    elements.insert("button".to_string(), button_element.into());

    AnimationBuilder::new(&elements)
        .add_style("button", CssProperty::Width, "200px")
        .add_style("button", CssProperty::Opacity, "0.8")
        .apply();
}
```

### Dynamic Animation (Mouse Following)

Compute animation values at runtime using the `AnimationContext`:

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

fn example(button_element: web_sys::HtmlElement) {
    let mut elements = HashMap::new();
    elements.insert("button".to_string(), button_element.into());

    AnimationBuilder::new(&elements)
        .add_style_dynamic("button", CssProperty::Transform, |ctx| {
            let x = ctx.mouse_x();
            let y = ctx.mouse_y();
            format!("translate({}px, {}px)", x, y)
        })
        .apply_with_transition("300ms", "ease-in-out");
}
```

### Mouse Spotlight Effect

Create interactive spotlight effects that follow the mouse:

```rust
use hikari_animation::spotlight::SpotlightEffect;
use std::collections::HashMap;

fn example(button_element: web_sys::HtmlElement) {
    let mut elements = HashMap::new();
    elements.insert("button".to_string(), button_element.into());

    let mut spotlight = SpotlightEffect::new(&elements, "button");
    spotlight.enable();
    // Spotlight follows mouse automatically
}
```

### Animation with Transitions

Apply smooth CSS transitions to animations:

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .add_style("button", CssProperty::Height, "100px")
    .add_class("button", "hi-flex")
    .apply_with_transition("300ms", "ease-out");
```

### Debounced Animations

For performance-critical scenarios, throttle rapid updates:

```rust
use hikari_animation::AnimationBuilderDebounced;
use hikari_animation::style::CssProperty;

fn example(button_element: web_sys::HtmlElement) {
    let mut elements = HashMap::new();
    elements.insert("button".to_string(), button_element.into());

    let mut debounced = AnimationBuilderDebounced::new(&elements, 500);

    // These rapid updates will be debounced
    debounced.add_style("button", CssProperty::Opacity, "0.5");
    debounced.add_style("button", CssProperty::Transform, "scale(1.1)");
    // Only the last state will be applied after 500ms

    // Or flush immediately
    debounced.flush();
}
```

### Animation Presets

Use pre-built animation presets for common effects:

```rust
use hikari_animation::presets::*;
use hikari_animation::AnimationBuilder;
use std::collections::HashMap;

fn example(button_element: web_sys::HtmlElement) {
    let mut elements = HashMap::new();
    elements.insert("button".to_string(), button_element.into());

    // Fade in animation (500ms)
    fade_in::AnimationBuilder::new(&elements, "button", 500).apply();

    // Slide in from left (300ms)
    slide_in::AnimationBuilder::left(&elements, "button", 300).apply();

    // Scale animation (400ms)
    scale::AnimationBuilder::up(&elements, "button", 400).apply();
}
```

### Easing Functions

Choose from 30+ easing functions for natural motion:

```rust
use hikari_animation::easing::{EasingFunction, ease_in_out_cubic};

let t = 0.5; // Progress value [0, 1]
let eased = ease_in_out_cubic(t);
```

Available easing functions:

#### Linear
- `linear` - No easing

#### Quadratic
- `ease_in_quad` - Accelerating from zero velocity
- `ease_out_quad` - Decelerating to zero velocity
- `ease_in_out_quad` - Acceleration then deceleration

#### Cubic
- `ease_in_cubic` - Accelerating from zero velocity
- `ease_out_cubic` - Decelerating to zero velocity
- `ease_in_out_cubic` - Acceleration then deceleration

#### Quartic
- `ease_in_quart` - Accelerating from zero velocity
- `ease_out_quart` - Decelerating to zero velocity
- `ease_in_out_quart` - Acceleration then deceleration

#### Quintic
- `ease_in_quint` - Accelerating from zero velocity
- `ease_out_quint` - Decelerating to zero velocity
- `ease_in_out_quint` - Acceleration then deceleration

#### Elastic
- `ease_out_elastic` - Elastic deceleration
- `ease_in_out_elastic` - Elastic acceleration then deceleration

#### Bounce
- `ease_out_bounce` - Bounce deceleration
- `ease_in_out_bounce` - Bounce acceleration then deceleration

## AnimationContext

The `AnimationContext` provides runtime data for dynamic animations:

### Available Methods

| Method | Description |
|--------|-------------|
| `mouse_x()` | Mouse X position relative to viewport |
| `mouse_y()` | Mouse Y position relative to viewport |
| `element_width()` | Element width in pixels |
| `element_height()` | Element height in pixels |
| `element_x()` | Element X position |
| `element_y()` | Element Y position |
| `scroll_x()` | Horizontal scroll position |
| `scroll_y()` | Vertical scroll position |
| `distance_from_center()` | Distance from element center |
| `angle_from_center()` | Angle from element center in radians |
| `get_state(&str)` | Get custom state value |
| `set_state(&str, value)` | Set custom state value |

### Dynamic Value Example

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

fn example(icon_element: web_sys::HtmlElement) {
    let mut elements = HashMap::new();
    elements.insert("icon".to_string(), icon_element.into());

    AnimationBuilder::new(&elements)
        .add_style_dynamic("icon", CssProperty::Transform, |ctx| {
            // Calculate scale based on distance from center
            let scale = 1.0 + (ctx.distance_from_center() / 500.0).min(0.3);

            // Get angle from center
            let angle = ctx.angle_from_center();

            format!("scale({}) rotate({}rad)", scale, angle)
        })
        .apply_with_transition("150ms", "ease-out");
}
```

## Style Builder

For lower-level style manipulation, use the `StyleBuilder` directly:

```rust
use hikari_animation::style::{StyleBuilder, CssProperty};

fn example(element: web_sys::HtmlElement) {
    StyleBuilder::new(&element)
        .add(CssProperty::Width, "100px")
        .add(CssProperty::Height, "100px")
        .add(CssProperty::BackgroundColor, "red")
        .apply();
}
```

## CSS Properties

Type-safe CSS properties available in `CssProperty` enum:

### Layout
- `Width`, `Height`, `MinWidth`, `MaxWidth`, `MinHeight`, `MaxHeight`
- `Margin`, `MarginTop`, `MarginRight`, `MarginBottom`, `MarginLeft`
- `Padding`, `PaddingTop`, `PaddingRight`, `PaddingBottom`, `PaddingLeft`

### Display
- `Display`, `Visibility`, `Opacity`
- `Position`, `Top`, `Right`, `Bottom`, `Left`
- `ZIndex`

### Typography
- `FontSize`, `FontWeight`, `LineHeight`, `LetterSpacing`
- `Color`, `TextAlign`

### Visual
- `BackgroundColor`, `BorderColor`
- `BorderRadius`, `BorderWidth`
- `BoxShadow`

### Transform
- `Transform` - For 2D/3D transforms

## Performance Considerations

### Best Practices

1. **Use Debounced Animations** for frequently updating values (scroll, mouse move)
2. **Prefer CSS Transitions** over JavaScript animations for simple state changes
3. **Batch DOM Reads and Writes** to minimize reflows
4. **Use `requestAnimationFrame`** (via timer module) for frame-based animations
5. **Avoid Layout Thrashing** - read all values before writing

### Performance Tips

```rust
// ❌ BAD - Causes layout thrashing
element.set_width("100px");
let height = element.get_height(); // Forces reflow
element.set_height("200px");

// ✅ GOOD - Batch reads then writes
let width = element.get_width();
let height = element.get_height();
element.set_width("100px");
element.set_height("200px");
```

### When to Use Debounced Animations

- Scroll position updates
- Mouse move events (for non-critical effects)
- Resize handlers
- Rapid state changes

```rust
// Good for scroll effects
let mut debounced = AnimationBuilderDebounced::new(&elements, 16); // ~60fps

window.on_scroll(move |_| {
    debounced.add_style_dynamic("header", CssProperty::Transform, |ctx| {
        format!("translateY({}px)", ctx.scroll_y())
    });
});
```

## Architecture

### Core Modules

- **`builder`** - Fluent builder API for creating animations
- **`context`** - Runtime context providing element dimensions, mouse position
- **`style`** - Type-safe CSS property manipulation with `StyleBuilder`
- **`easing`** - Easing functions for natural motion
- **`tween`** - Interpolation system for smooth value transitions
- **`timeline`** - Timeline-based animation sequencing
- **`presets`** - Pre-built animation presets (fade, slide, scale)
- **`spotlight`** - Spotlight effect for mouse-following animations
- **`hooks`** - React hooks for animation lifecycle management
- **`events`** - Animation event system
- **`timer`** - High-precision timer for frame-based animations
- **`core`** - Core animation primitives and utilities

## API Reference

### `AnimationBuilder`

```rust
impl AnimationBuilder {
    pub fn new(elements: &HashMap<String, web_sys::Element>) -> Self;

    pub fn add_style(&mut self, id: &str, property: CssProperty, value: &str) -> &mut Self;

    pub fn add_style_dynamic(&mut self, id: &str, property: CssProperty, f: impl Fn(&AnimationContext) -> String + 'static) -> &mut Self;

    pub fn add_class(&mut self, id: &str, class: &str) -> &mut Self;

    pub fn remove_class(&mut self, id: &str, class: &str) -> &mut Self;

    pub fn apply(&self);

    pub fn apply_with_transition(&self, duration: &str, easing: &str);
}
```

### `AnimationBuilderDebounced`

```rust
impl AnimationBuilderDebounced {
    pub fn new(elements: &HashMap<String, web_sys::Element>, debounce_ms: u64) -> Self;

    pub fn add_style(&mut self, id: &str, property: CssProperty, value: &str);

    pub fn add_style_dynamic(&mut self, id: &str, property: CssProperty, f: impl Fn(&AnimationContext) -> String + 'static);

    pub fn flush(&mut self);
}
```

### `StyleBuilder`

```rust
impl StyleBuilder {
    pub fn new(element: &web_sys::HtmlElement) -> Self;

    pub fn add(&mut self, property: CssProperty, value: &str) -> &mut Self;

    pub fn apply(&self);
}
```

### `AnimationContext`

```rust
impl AnimationContext {
    pub fn mouse_x(&self) -> f64;
    pub fn mouse_y(&self) -> f64;
    pub fn element_width(&self) -> f64;
    pub fn element_height(&self) -> f64;
    pub fn distance_from_center(&self) -> f64;
    pub fn angle_from_center(&self) -> f64;
    pub fn scroll_x(&self) -> f64;
    pub fn scroll_y(&self) -> f64;
}
```

## Platform Support

This animation system is designed for **WASM targets only**:

- ✅ **WASM32** - Fully supported
- ❌ **Native** - Not supported (intentionally)

The crate uses `#[cfg(target_arch = "wasm32")]` to ensure it only compiles for WASM targets.

## Integration with Dioxus

The animation system integrates seamlessly with Dioxus components:

```rust
use dioxus::prelude::*;
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

#[component]
fn AnimatedButton() -> Element {
    let mut elements = use_signal(|| HashMap::new());

    // On mount, set up element references
    use_effect(move || {
        // Get button element and store in elements map
        // ...
    });

    rsx! {
        button {
            onmouseover: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("button", CssProperty::Transform, "scale(1.1)")
                    .apply_with_transition("200ms", "ease-out");
            },
            onmouseout: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("button", CssProperty::Transform, "scale(1.0)")
                    .apply_with_transition("200ms", "ease-out");
            },
            "Hover me!"
        }
    }
}
```

## License

MIT OR Apache-2.0

## Acknowledgments

Inspired by modern animation libraries and the need for type-safe, performant animations in Rust WASM applications.
