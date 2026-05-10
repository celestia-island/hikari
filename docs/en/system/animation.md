# Animation System

High-performance declarative animation system supporting static values, dynamic values, complex timelines, and 30+ easing functions.

## Table of Contents

- [Overview](#overview)
- [Core Features](#core-features)
- [AnimationBuilder](#animationbuilder)
- [Tween](#tween)
- [Easing](#easing)
- [Timeline](#timeline)
- [Presets](#presets)
- [Spotlight](#spotlight)
- [Context](#context)
- [Style](#style)
- [Usage Examples](#usage-examples)

## Overview

`hikari-animation` provides a complete animation solution:

- **Declarative API**: CSS-like fluent syntax
- **Dynamic Values**: Runtime-computed animation values (like mouse following)
- **High Performance**: WASM optimized, debounced updates, requestAnimationFrame
- **Type Safe**: Compile-time checked CSS properties
- **Rich Presets**: Fade, slide, scale and other common animations

## Core Features

### 1. AnimationBuilder

Advanced animation builder supporting:

- **Multi-element Control**: Control multiple DOM elements simultaneously
- **Dynamic Values**: Real-time computation based on AnimationContext
- **Auto Transitions**: Intelligent transition management
- **Type Safety**: CssProperty enum prevents typos

### 2. Tween System

Interpolation animation system:

- **Value Interpolation**: Smooth numeric transitions
- **Custom Easing**: 30+ built-in easing functions
- **Time Control**: Duration and delay control
- **Loop Iteration**: Support for looping playback

### 3. Easing Functions

Rich easing function library:

- **Basic**: Linear, EaseIn, EaseOut, EaseInOut
- **Sine**: Sine easing
- **Quad**: Quadratic easing
- **Cubic**: Cubic easing
- **Quart**: Quartic easing
- **Quint**: Quintic easing
- **Expo**: Exponential easing
- **Circ**: Circular easing
- **Back**: Back/overshoot effect
- **Elastic**: Elastic effect
- **Bounce**: Bounce effect

### 4. Timeline

Timeline control:

- **Sequential Animation**: Play multiple animations in sequence
- **Parallel Animation**: Play multiple animations simultaneously
- **Delayed Execution**: Precise timing control
- **Animation Groups**: Organize complex animation sequences

### 5. Presets

Preset animation library:

- **Fade**: Fade in/out
- **Slide**: Slide in/out
- **Scale**: Scale animation
- **Rotate**: Rotation animation
- **Flip**: Flip animation
- **Zoom**: Zoom in/out

### 6. Spotlight

Spotlight effect:

- **Mouse Following**: Glow effect follows mouse cursor
- **Gradient Lighting**: Smooth radial gradients
- **Performance**: Debounced updates, throttled repaints
- **Auto Init**: Scan and initialize spotlight elements

## AnimationBuilder

### Basic Usage

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// Create element mapping
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// Apply static styles
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### Dynamic Value Animation

```rust
// Mouse following effect
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### Multi-element Animation

```rust
// Control multiple elements simultaneously
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### Transition Animation

```rust
// Animation with transition
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// Custom transition properties
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Transform, "rotate(90deg)")
    .apply_with_transition("500ms", "cubic-bezier(0.68, -0.55, 0.265, 1.55)");
```

### API Reference

```rust
impl AnimationBuilder {
    pub fn new(elements: &HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
}
```

## Tween

Interpolation between values over time.

### Basic Tween

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // ms
    .easing(ease::EaseOut)
    .build();
```

### Tween with Callbacks

```rust
let tween = TweenBuilder::new()
    .from(0.0)
    .to(1.0)
    .duration(500)
    .on_update(|value| {
        println!("Current value: {}", value);
    })
    .on_complete(|| {
        println!("Animation complete!");
    })
    .build();
```

### Chained Tweens

```rust
let mut timeline = Timeline::new();

timeline.push(
    TweenBuilder::new()
        .from(0.0)
        .to(100.0)
        .duration(300)
        .build()
);

timeline.push(
    TweenBuilder::new()
        .from(100.0)
        .to(0.0)
        .duration(300)
        .delay(200)
        .build()
);

timeline.play();
```

## Easing

Easing functions control the rate of animation.

### Basic Easing

```rust
use hikari_animation::easing;

// Linear - no easing
linear(0.5); // 0.5

// Ease In - starts slow, ends fast
ease_in(0.5); // 0.25

// Ease Out - starts fast, ends slow
ease_out(0.5); // 0.75

// Ease In Out - slow at both ends
ease_in_out(0.5); // 0.5
```

### Advanced Easing

```rust
// Back - overshoots slightly
back_out(0.5); // 1.2

// Elastic - oscillates
elastic_out(0.5); // 1.0

// Bounce - bounces at end
bounce_out(0.5); // 0.75
```

### All Easing Functions

```rust
// Basic
pub fn linear(t: f64) -> f64;
pub fn ease_in(t: f64) -> f64;
pub fn ease_out(t: f64) -> f64;
pub fn ease_in_out(t: f64) -> f64;

// Sine
pub fn sine_in(t: f64) -> f64;
pub fn sine_out(t: f64) -> f64;
pub fn sine_in_out(t: f64) -> f64;

// Quad
pub fn quad_in(t: f64) -> f64;
pub fn quad_out(t: f64) -> f64;
pub fn quad_in_out(t: f64) -> f64;

// Cubic
pub fn cubic_in(t: f64) -> f64;
pub fn cubic_out(t: f64) -> f64;
pub fn cubic_in_out(t: f64) -> f64;

// Quart
pub fn quart_in(t: f64) -> f64;
pub fn quart_out(t: f64) -> f64;
pub fn quart_in_out(t: f64) -> f64;

// Quint
pub fn quint_in(t: f64) -> f64;
pub fn quint_out(t: f64) -> f64;
pub fn quint_in_out(t: f64) -> f64;

// Expo
pub fn expo_in(t: f64) -> f64;
pub fn expo_out(t: f64) -> f64;
pub fn expo_in_out(t: f64) -> f64;

// Circ
pub fn circ_in(t: f64) -> f64;
pub fn circ_out(t: f64) -> f64;
pub fn circ_in_out(t: f64) -> f64;

// Back
pub fn back_in(t: f64) -> f64;
pub fn back_out(t: f64) -> f64;
pub fn back_in_out(t: f64) -> f64;

// Elastic
pub fn elastic_in(t: f64) -> f64;
pub fn elastic_out(t: f64) -> f64;
pub fn elastic_in_out(t: f64) -> f64;

// Bounce
pub fn bounce_in(t: f64) -> f64;
pub fn bounce_out(t: f64) -> f64;
pub fn bounce_in_out(t: f64) -> f64;
```

## Timeline

Control animation sequences and timing.

### Sequential Animations

```rust
use hikari_animation::Timeline;

let mut timeline = Timeline::new();

// Add animations in sequence
timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0")
        .build()
);

timeline.add(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "1")
        .with_delay(200)
        .build()
);

timeline.play();
```

### Parallel Animations

```rust
let mut timeline = Timeline::new();

// Play animations simultaneously
timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Transform, "translateX(100px)")
        .build()
);

timeline.add_parallel(
    AnimationBuilder::new(&elements)
        .add_style("box", CssProperty::Opacity, "0.5")
        .build()
);

timeline.play();
```

### Timeline Control

```rust
let timeline = Timeline::new();

// Control playback
timeline.play();      // Start playback
timeline.pause();     // Pause playback
timeline.reverse();   // Reverse playback
timeline.seek(0.5);   // Seek to 50%

// Control speed
timeline.set_speed(2.0);  // 2x speed
timeline.set_speed(0.5);  // 0.5x speed

// Loop control
timeline.set_loop(true);
timeline.set_repeat_count(3);
```

## Presets

Pre-built animation presets.

### Fade Animations

```rust
use hikari_animation::presets;

// Fade in
presets::fade_in(&elements, "box", 300);

// Fade out
presets::fade_out(&elements, "box", 300);

// Fade to specific opacity
presets::fade_to(&elements, "box", 0.5, 300);
```

### Slide Animations

```rust
// Slide in from left
presets::slide_in_left(&elements, "box", 300);

// Slide in from right
presets::slide_in_right(&elements, "box", 300);

// Slide out to left
presets::slide_out_left(&elements, "box", 300);

// Slide in from top
presets::slide_in_top(&elements, "box", 300);
```

### Scale Animations

```rust
// Scale up
presets::scale_up(&elements, "box", 1.5, 300);

// Scale down
presets::scale_down(&elements, "box", 0.8, 300);

// Pulse
presets::pulse(&elements, "box", 300);
```

### Rotate Animations

```rust
// Rotate clockwise
presets::rotate_cw(&elements, "box", 90, 500);

// Rotate counter-clockwise
presets::rotate_ccw(&elements, "box", 90, 500);

// Flip
presets::flip_x(&elements, "box", 500);
presets::flip_y(&elements, "box", 500);
```

### Custom Presets

```rust
use hikari_animation::presets::PresetBuilder;

let custom_preset = PresetBuilder::new()
    .duration(500)
    .easing("ease-out")
    .add_keyframe(0.0, vec![
        (CssProperty::Opacity, "0"),
        (CssProperty::Transform, "translateY(-20px)")
    ])
    .add_keyframe(1.0, vec![
        (CssProperty::Opacity, "1"),
        (CssProperty::Transform, "translateY(0)")
    ])
    .build();

custom_preset.apply(&elements, "element");
```

## Spotlight

Mouse-following glow effect for elements.

### Basic Spotlight

```rust
use hikari_animation::spotlight;

// Initialize spotlight on all buttons
spotlight::init();

// Or initialize on specific elements
spotlight::init_selector(".hi-button");
```

### Custom Spotlight

```rust
spotlight::Config {
    size: 200,              // Spotlight size in px
    opacity: 0.15,          // Opacity (0-1)
    color: "#00A0E9",       // Glow color
    blur: 20,              // Blur radius in px
    transition: "150ms"     // Transition speed
}.init();
```

### Spotlight in Components

```rust
rsx! {
    Button {
        label: "Hover Me",
        class: "hi-spotlight",  // Enable spotlight
        "Data: spot-{spot_id}"   // Unique identifier
    }
}
```

### Disable Spotlight

```rust
// Disable on specific elements
spotlight::disable_selector(".no-spotlight");

// Disable all
spotlight::disable_all();
```

## Context

Animation context provides runtime information.

### Mouse Position

```rust
AnimationBuilder::new(&elements)
    .add_style_dynamic("target", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply();
```

### Time-based Animation

```rust
.add_style_dynamic("clock", CssProperty::Transform, |ctx| {
    let time = ctx.elapsed_time();
    let angle = (time.as_millis() % 1000) as f64 / 1000.0 * 360.0;
    format!("rotate({}deg)", angle)
})
```

### Scroll Position

```rust
.add_style_dynamic("header", CssProperty::Background, |ctx| {
    let scroll_y = ctx.scroll_y();
    let opacity = (scroll_y / 100.0).min(1.0);
    format!("rgba(0, 160, 233, {})", opacity)
})
```

## Style

Type-safe CSS property manipulation.

### CssProperty Enum

```rust
use hikari_animation::style::CssProperty;

// Color properties
CssProperty::Color
CssProperty::BackgroundColor
CssProperty::BorderColor

// Layout properties
CssProperty::Width
CssProperty::Height
CssProperty::Margin
CssProperty::Padding

// Transform properties
CssProperty::Transform
CssProperty::Translate
CssProperty::Scale
CssProperty::Rotate

// Effect properties
CssProperty::Opacity
CssProperty::BoxShadow
CssProperty::Filter
```

### Style Manipulation

```rust
// Set single property
builder.add_style("element", CssProperty::Color, "#00A0E9");

// Set transform
builder.add_style("element", CssProperty::Transform, "translate(10px, 20px)");

// Set opacity
builder.add_style("element", CssProperty::Opacity, "0.5");

// Complex transform
builder.add_style("element", CssProperty::Transform,
    "perspective(1000px) rotateX(45deg) translateZ(50px)");
```

### Custom CSS Properties

```rust
// Custom property
builder.add_style("element", CssProperty::Custom("--my-var"), "value");

// And use it
builder.add_style("element", CssProperty::Color, "var(--my-var)");
```

## Usage Examples

### Button Hover Effect

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

#[component]
fn AnimatedButton() -> Element {
    let elements = use_signal(|| {
        let mut map = HashMap::new();
        map.insert("btn".to_string(), get_button_element());
        map
    });

    rsx! {
        button {
            class: "hi-button hi-spotlight",
            onmouseenter: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1.05)")
                    .add_style("btn", CssProperty::BoxShadow, "0 8px 16px rgba(0, 160, 233, 0.3)")
                    .apply_with_transition("200ms", "ease-out");
            },
            onmouseleave: move |_| {
                AnimationBuilder::new(&elements())
                    .add_style("btn", CssProperty::Transform, "scale(1)")
                    .add_style("btn", CssProperty::BoxShadow, "none")
                    .apply_with_transition("200ms", "ease-out");
            },
            "Hover Me"
        }
    }
}
```

### Loading Animation

```rust
#[component]
fn LoadingSpinner() -> Element {
    let elements = use_signal(|| HashMap::new());

    use_effect(move || {
        let elements = elements.clone();
        async move {
            loop {
                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(0deg)")
                    .build();

                AnimationBuilder::new(&elements())
                    .add_style("spinner", CssProperty::Transform, "rotate(360deg)")
                    .apply_with_transition("1000ms", "linear");

                tokio::time::sleep(Duration::from_millis(1000)).await;
            }
        }
    });

    rsx! {
        div {
            id: "spinner",
            style: "width: 40px; height: 40px; border: 4px solid var(--hi-color-primary); border-top-color: transparent; border-radius: 50%;"
        }
    }
}
```

### Parallax Scroll

```rust
#[component]
fn ParallaxSection() -> Element {
    let scroll_y = use_signal(|| 0.0);

    rsx! {
        div {
            onscroll: move |e| {
                scroll_y.set(e.scroll_y());

                AnimationBuilder::new(&elements())
                    .add_style_dynamic("bg", CssProperty::Transform, |ctx| {
                        let y = ctx.scroll_y() * 0.5;
                        format!("translateY({}px)", y)
                    })
                    .apply_with_transition("100ms", "ease-out");
            },
            div {
                id: "bg",
                style: "position: fixed; width: 100%; height: 100%; background: url(bg.jpg);"
            },
            div {
                style: "position: relative; z-index: 1;",
                "Content"
            }
        }
    }
}
```

### Animated Counter

```rust
#[component]
fn AnimatedCounter() -> Element {
    let mut count = use_signal(|| 0);

    use_effect(move || {
        let target = 1000;
        let duration = 2000; // 2 seconds
        let steps = 60;
        let step_value = target as f64 / steps as f64;
        let step_duration = duration / steps;

        async move {
            for i in 0..=steps {
                count.set((i as f64 * step_value) as i32);
                tokio::time::sleep(Duration::from_millis(step_duration)).await;
            }
        }
    });

    rsx! {
        div {
            class: "counter",
            "{count()}"
        }
    }
}
```

## Performance Optimization

### Debounce Updates

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilder automatically debounces updates
AnimationBuilder::new(&elements)
    .add_style_dynamic("element", CssProperty::Transform, |ctx| {
        // This is debounced - won't update on every mousemove
        let x = ctx.mouse_x();
        format!("translateX({}px)", x)
    })
    .apply_with_transition("100ms", "ease-out");
```

### RequestAnimationFrame

The animation system uses `requestAnimationFrame` for smooth 60fps animations:

```rust
// Automatic RAF integration
AnimationBuilder::new(&elements)
    .add_style("anim", CssProperty::Opacity, "1")
    .apply_with_transition("1000ms", "ease");
```

### GPU Acceleration

Use transform and opacity for GPU-accelerated animations:

```rust
// ✅ Good - GPU accelerated
builder.add_style("element", CssProperty::Transform, "translateX(100px)");
builder.add_style("element", CssProperty::Opacity, "0.5");

// ❌ Avoid - triggers layout
builder.add_style("element", CssProperty::Width, "100px");
builder.add_style("element", CssProperty::Margin, "10px");
```

### Will-change Hint

```css
/* Hint to browser for optimization */
.animated-element {
    will-change: transform, opacity;
}
```

## API Reference

### AnimationBuilder

```rust
pub struct AnimationBuilder<'a> {
    elements: &'a HashMap<String, Element>,
}

impl<'a> AnimationBuilder<'a> {
    pub fn new(elements: &'a HashMap<String, Element>) -> Self;

    pub fn add_style(self, element: &str, property: CssProperty, value: &str) -> Self;
    pub fn add_style_dynamic<F>(self, element: &str, property: CssProperty, f: F) -> Self
    where
        F: Fn(&AnimationContext) -> String + 'static;

    pub fn add_class(self, element: &str, class: &str) -> Self;
    pub fn remove_class(self, element: &str, class: &str) -> Self;

    pub fn apply(self);
    pub fn apply_with_transition(self, duration: &str, easing: &str);
    pub fn apply_with_custom_transition(self, transition: &str);
}
```

### AnimationContext

```rust
pub struct AnimationContext<'a> {
    pub mouse_x: f64,
    pub mouse_y: f64,
    pub scroll_x: f64,
    pub scroll_y: f64,
    pub elapsed_time: Duration,
    pub window_width: f64,
    pub window_height: f64,
}

impl<'a> AnimationContext<'a> {
    pub fn mouse_x(&self) -> f64;
    pub fn mouse_y(&self) -> f64;
    pub fn scroll_x(&self) -> f64;
    pub fn scroll_y(&self) -> f64;
    pub fn elapsed_time(&self) -> Duration;
}
```

### Timeline

```rust
pub struct Timeline {
    // internal
}

impl Timeline {
    pub fn new() -> Self;

    pub fn add(&mut self, animation: Animation) -> &mut Self;
    pub fn add_parallel(&mut self, animation: Animation) -> &mut Self;

    pub fn play(&mut self);
    pub fn pause(&mut self);
    pub fn stop(&mut self);
    pub fn reverse(&mut self);
    pub fn seek(&mut self, progress: f64);

    pub fn set_speed(&mut self, speed: f64);
    pub fn set_loop(&mut self, loop: bool);
    pub fn set_repeat_count(&mut self, count: usize);
}
```

## Best Practices

### 1. Use Transitions Sparingly

```rust
// ✅ Good - Only on user interaction
button {
    onmouseenter: move |_| {
        builder.apply_with_transition("200ms", "ease");
    }
}

// ❌ Avoid - Continuous animation
loop {
    builder.apply_with_transition("16ms", "linear"); // 60fps, heavy!
}
```

### 2. Prefer Transform over Layout

```rust
// ✅ Good - GPU accelerated
builder.add_style("el", CssProperty::Transform, "translateX(100px)");

// ❌ Avoid - Layout thrashing
builder.add_style("el", CssProperty::Margin, "100px");
```

### 3. Use Appropriate Easing

```rust
// Natural feel
"ease-out"      // Decelerate
"ease-in-out"   // Accelerate then decelerate

// Mechanical feel
"linear"        // Constant speed

// Playful
"elastic-out"   // Bounces
"bounce-out"    // Bounces at end
```

### 4. Respect Reduced Motion

```rust
use_effect(move || {
    let prefers_reduced_motion = window()
        .match_media("(prefers-motion: reduce)")
        .ok()
        .and_then(|m| m.matches());

    if prefers_reduced_motion.unwrap_or(false) {
        // Use simpler animations
        builder.apply_with_transition("0ms", "linear");
    } else {
        // Full animation
        builder.apply_with_transition("300ms", "ease-out");
    }
});
```

## Related Systems

- [Theme System](./theme.md) - CSS variables for animations
- [Components](../components/) - Animated UI components
- [Palette System](./palette.md) - Color definitions
