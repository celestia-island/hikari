# Hikari Animation System - API Documentation

## Overview

The Hikari Animation System provides a comprehensive set of tools for creating dynamic, interactive animations in Rust web applications. It integrates seamlessly with the Tairitsu VDOM framework and supports CSS variable animations, event-driven animations, and continuous animations.

## Files Created/Modified

### Core Animation Module
- **`/mnt/sdb1/hikari/examples/website/src/animation.rs`**
  - Core animation integration module
  - Provides `AnimationId` enum for predefined animations
  - Provides `AnimationConfig` for custom animation configuration
  - Event handlers for hover, focus, and mouse move animations
  - Helper functions for common animation patterns

### UI Components Module
- **`/mnt/sdb1/hikari/examples/website/src/ui.rs`**
  - `Button` component with animation support
  - `Input` component with animation support
  - `Card` component with animation support
  - Convenience functions for common animated components
  - Type-safe variant and size enums

### Animation Examples Page
- **`/mnt/sdb1/hikari/examples/website/src/pages/animations.rs`**
  - Interactive demonstrations of all animation types
  - Hover animations (scale, glow, lift, shine)
  - Focus animations (pulse, glow, border)
  - State transition animations (press scale, press glow)
  - Continuous animations (breathing, pulse, shimmer)
  - Complete animated form example
  - Code examples for Rust, HTML, and CSS

### Static Assets
- **`/mnt/sdb1/hikari/examples/website/public/styles/animations.css`**
  - CSS styles for all animation presets
  - Demo layout styles (grids, rows, forms)
  - Page section styles

- **`/mnt/sdb1/hikari/examples/website/public/js/animations.js`**
  - JavaScript runtime for event-driven animations
  - Mutation observer for dynamic content
  - Global `HikariAnimations` API

### Configuration Updates
- **`/mnt/sdb1/hikari/examples/website/Cargo.toml`**
  - Added `hikari-animation` dependency
  - Added `/animations` route
  - Added animations.css to head

- **`/mnt/sdb1/hikari/examples/website/index.html`**
  - Added animations.css stylesheet link
  - Added animations.js script tag

- **`/mnt/sdb1/hikari/examples/website/src/lib.rs`**
  - Added `animation` and `ui` modules

- **`/mnt/sdb1/hikari/examples/website/src/pages/mod.rs`**
  - Added `animations` module

- **`/mnt/sdb1/hikari/examples/website/src/app.rs`**
  - Added animations page to main app routing

- **`/mnt/sdb1/hikari/examples/website/src/components/mod.rs`**
  - Added "Animation Demo" link to sidebar navigation

## Animation API Surface

### AnimationId Enum

Defines predefined animation presets:

```rust
pub enum AnimationId {
    // Hover animations
    HoverScale,   // Subtle grow effect
    HoverGlow,    // Glow intensifies
    HoverLift,    // Element lifts up
    HoverShine,   // Sweeping light effect

    // Focus animations
    FocusPulse,   // Subtle pulse
    FocusGlow,    // Blue glow appears
    FocusBorder,  // Border animates

    // State transitions
    PressScale,   // Shrink on press
    PressGlow,    // Glow intensifies

    // Continuous animations
    Breathing,    // Subtle breathe effect
    Pulse,        // Continuous pulse
    Shimmer,      // Continuous shimmer

    // Custom (uses data-animation-config attribute)
    Custom,
}
```

### AnimationConfig Struct

Configuration for custom animations:

```rust
pub struct AnimationConfig {
    pub duration_ms: u32,           // Animation duration
    pub easing: &'static str,        // CSS easing function
    pub delay_ms: u32,               // Start delay
    pub infinite: bool,              // Loop animation
    pub custom_vars: HashMap<String, String>,  // Custom CSS vars
}
```

### UI Components API

#### Button Component

```rust
pub struct Button {
    element: VElement,
}

impl Button {
    pub fn new() -> Self;
    pub fn text(self, text: impl Into<String>) -> Self;
    pub fn variant(self, variant: ButtonVariant) -> Self;
    pub fn size(self, size: ButtonSize) -> Self;
    pub fn disabled(self, disabled: bool) -> Self;
    pub fn animation(self, animation: AnimationId) -> Self;
    pub fn class(self, class: impl Into<String>) -> Self;
    pub fn attr(self, name: impl Into<String>, value: impl Into<String>) -> Self;
    pub fn build(self) -> VNode;
}
```

**Button Variants:**
- `Primary` - Default primary action style
- `Secondary` - Secondary action style
- `Danger` - Destructive action style
- `Ghost` - Minimal style

**Button Sizes:**
- `Small` - Compact size
- `Medium` - Default size
- `Large` - Large size

#### Input Component

```rust
pub struct Input {
    element: VElement,
}

impl Input {
    pub fn new() -> Self;
    pub fn input_type(self, input_type: InputType) -> Self;
    pub fn placeholder(self, placeholder: impl Into<String>) -> Self;
    pub fn value(self, value: impl Into<String>) -> Self;
    pub fn disabled(self, disabled: bool) -> Self;
    pub fn error(self, error: bool) -> Self;
    pub fn animation(self, animation: AnimationId) -> Self;
    pub fn class(self, class: impl Into<String>) -> Self;
    pub fn attr(self, name: impl Into<String>, value: impl Into<String>) -> Self;
    pub fn build(self) -> VNode;
}
```

**Input Types:**
- `Text` - Default text input
- `Password` - Password field
- `Email` - Email validation
- `Number` - Numeric input
- `Search` - Search field
- `Tel` - Telephone number
- `Url` - URL input

#### Card Component

```rust
pub struct Card {
    element: VElement,
}

impl Card {
    pub fn new() -> Self;
    pub fn clickable(self, href: impl Into<String>) -> Self;
    pub fn animation(self, animation: AnimationId) -> Self;
    pub fn title(self, title: impl Into<String>) -> Self;
    pub fn body(self, content: impl Into<String>) -> Self;
    pub fn child(self, child: VNode) -> Self;
    pub fn class(self, class: impl Into<String>) -> Self;
    pub fn attr(self, name: impl Into<String>, value: impl Into<String>) -> Self;
    pub fn build(self) -> VNode;
}
```

### Convenience Functions

Quick-create animated components:

```rust
pub fn button_hover_scale(text: impl Into<String>) -> VNode;
pub fn button_hover_glow(text: impl Into<String>) -> VNode;
pub fn input_focus_glow(placeholder: impl Into<String>) -> VNode;
pub fn card_hover_lift(title: impl Into<String>, body: impl Into<String>) -> VNode;
```

### Animation Helper Functions

```rust
// Apply glow animation to an element
pub fn apply_glow_animation(element: &HtmlElement);

// Apply hover scale animation to an element
pub fn apply_hover_scale(element: &HtmlElement);

// Apply focus glow animation to an element
pub fn apply_focus_glow(element: &HtmlElement);

// Initialize animations for elements with data-animation attributes
pub fn init_animations();

// Get animation attributes for a VElement
pub fn animation_attrs(animation_id: AnimationId) -> Vec<(&'static str, String)>;

// Get animation attributes with custom config
pub fn animation_attrs_with_config(
    animation_id: AnimationId,
    config: &AnimationConfig,
) -> Vec<(&'static str, String)>;
```

## Usage Examples

### Creating an Animated Button

```rust
use crate::ui::{Button, AnimationId, ButtonVariant};

let button = Button::new()
    .text("Click Me")
    .variant(ButtonVariant::Primary)
    .animation(AnimationId::HoverScale)
    .build();
```

### Creating an Animated Input

```rust
use crate::ui::{Input, AnimationId};

let input = Input::new()
    .placeholder("Enter your email")
    .input_type(InputType::Email)
    .animation(AnimationId::FocusGlow)
    .build();
```

### Creating an Animated Card

```rust
use crate::ui::{Card, AnimationId};

let card = Card::new()
    .title("My Card")
    .body("Card content here")
    .animation(AnimationId::HoverLift)
    .build();
```

### Using Convenience Functions

```rust
use crate::ui;

// Quick hover scale button
let button = ui::button_hover_scale("Hover Me");

// Quick focus glow input
let input = ui::input_focus_glow("Focus me...");

// Quick hover lift card
let card = ui::card_hover_lift("Title", "Content");
```

### HTML Usage (with data attributes)

```html
<!-- Button with hover scale -->
<button class="hi-btn hi-btn--primary"
        data-animation="hover-scale">
    Hover Me
</button>

<!-- Input with focus glow -->
<input class="hi-input"
       placeholder="Focus me..."
       data-animation="focus-glow" />

<!-- Card with hover lift -->
<div class="card"
     data-animation="hover-lift">
    <h3 class="card__title">Title</h3>
    <p class="card__body">Content</p>
</div>
```

### CSS Usage (with classes)

```css
/* Apply animation via CSS class */
.hikari-anim--hover-scale:hover {
    transform: scale(1.05);
}

.hikari-anim--breathing {
    animation: breathing 3s ease-in-out infinite;
}
```

### JavaScript API

The animation system exposes a global `HikariAnimations` object:

```javascript
// Initialize animations for a specific element
HikariAnimations.init(element);

// Initialize all animations
HikariAnimations.initAll();

// Initialize specific animation types
HikariAnimations.initGlow(element);
HikariAnimations.initHoverScale(element);
HikariAnimations.initFocusGlow(element);

// Cleanup animations
HikariAnimations.cleanup(element);
HikariAnimations.cleanupAll();
```

## Integration with Tairitsu Event System

The animation system integrates with Tairitsu's event system through:

1. **DOM Event Listeners**: JavaScript event listeners handle mouse and focus events
2. **CSS Variables**: Dynamic CSS variables updated via JavaScript
3. **Mutation Observer**: Automatically initializes animations for dynamically added content
4. **data-* Attributes**: Declarative animation configuration via HTML attributes

## CSS Variable Animations

The system supports CSS variable animations for advanced effects:

```rust
// Set custom CSS variables via AnimationConfig
let config = AnimationConfig::new()
    .with_custom_var("glow-intensity", "0.8")
    .with_custom_var("glow-spread", "30px")
    .with_duration(500);

let button = Button::new()
    .animation(AnimationId::Custom)
    .attr("data-animation-config", &config.to_css_style())
    .build();
```

## Glow Effects Integration

The animation system integrates with existing Hikari glow effects:

- `--glow-x`: Horizontal position (0-100%)
- `--glow-y`: Vertical position (0-100%)
- `--glow-color`: Glow color (any CSS color value)
- `--glow-intensity`: Glow opacity (0.0-1.0)
- `--glow-spread`: Blur radius (px)

## Performance Considerations

1. **Throttling**: Mouse move animations are throttled to ~60fps (16ms)
2. **Value Caching**: AnimationBuilder caches values to avoid unnecessary DOM updates
3. **RequestAnimationFrame**: Continuous animations use requestAnimationFrame for smooth updates
4. **CSS Transitions**: Prefer CSS transitions for simple animations over JavaScript

## Browser Compatibility

- Modern browsers with ES6+ support
- CSS custom properties (CSS variables)
- requestAnimationFrame API
- MutationObserver API

## Future Enhancements

Potential additions to the animation system:

1. **Spring Physics**: Integrate with hikari-animation's spring solver
2. **Gesture Animations**: Touch-based gesture animations
3. **Scroll Animations**: Parallax and scroll-triggered animations
4. **Layout Animations**: FLIP animations for layout changes
5. **Animation Sequencing**: Timeline-based animation sequencing
