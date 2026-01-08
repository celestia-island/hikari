# System Architecture Overview

The Hikari framework adopts a modular design, consisting of multiple independent packages, each responsible for specific functional domains.

## Core Systems

### 1. Palette System (hikari-palette)

Rust implementation of the traditional Chinese color system.

**Responsibilities**:
- Provides 500+ traditional Chinese color definitions
- Theme palette management
- Utility class generator
- Opacity and color blending

**Core Features**:
```rust
use hikari_palette::{ChineseColor, opacity};

// Use traditional colors
let red = ChineseColor::Cinnabar;
let blue = ChineseColor::Azurite;

// Opacity handling
let semi_red = opacity(red, 0.5);

// Theme system
let theme = Hikari::default();
println!("Primary: {}", theme.primary.hex());
```

**Design Philosophy**:
- **Cultural Confidence**: Using traditional color names
- **Type Safety**: Compile-time color value checking
- **High Performance**: Zero-cost abstractions

### 2. Theme System (hikari-theme)

Theme context and style injection system.

**Responsibilities**:
- Theme provider component
- Theme context management
- CSS variable generation
- Theme switching

**Core Features**:
```rust
use hikari_theme::ThemeProvider;

rsx! {
    ThemeProvider { palette: "hikari" } {
        // Application content
        App {}
    }
}
```

**Supported Themes**:
- **Hikari (Light)** - Light theme
  - Primary: Azurite (#00A0E9)
  - Secondary: Cinnabar (#E94B35)
  - Accent: Vine Yellow (#F8B62D)

- **Tairitsu** - Dark theme
  - Primary: Indigo (#1a237e)
  - Secondary: Cinnabar (#E94B35)
  - Accent: Goose Yellow (#FFF176)

### 3. Animation System (hikari-animation)

High-performance declarative animation system.

**Responsibilities**:
- Animation builder
- Animation context
- Easing functions
- Preset animations

**Core Features**:
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

**Architecture Components**:
- **builder** - Animation builder API
- **context** - Runtime animation context
- **style** - Type-safe CSS operations
- **easing** - 30+ easing functions
- **tween** - Interpolation system
- **timeline** - Timeline control
- **presets** - Preset animations (fade, slide, scale)
- **spotlight** - Spotlight effect

**Performance Features**:
- WASM optimization
- Debounced updates
- requestAnimationFrame integration
- Minimized reflows and repaints

### 4. Icon System (hikari-icons)

Icon management and rendering system.

**Responsibilities**:
- Icon enum definitions
- SVG content generation
- Icon size variants
- Lucide Icons integration

**Core Features**:
```rust
use hikari_icons::{Icon, LucideIcon};

rsx! {
    Icon {
        icon: LucideIcon::Search,
        size: 24,
        color: "var(--hi-primary)"
    }
}
```

**Icon Sources**:
- Lucide Icons (1000+ icons)
- Extensible custom icons
- Multiple size support

### 5. Component Library (hikari-components)

Complete UI component library.

**Responsibilities**:
- Basic UI components
- Layout components
- Style registry
- Responsive hooks

**Component Categories**:

1. **Basic Components** (feature: "basic")
   - Button, Input, Card, Badge

2. **Feedback Components** (feature: "feedback")
   - Alert, Toast, Tooltip, Spotlight

3. **Navigation Components** (feature: "navigation")
   - Menu, Tabs, Breadcrumb

4. **Layout Components** (always available)
   - Layout, Header, Aside, Content, Footer

5. **Data Components** (feature: "data")
   - Table, Tree, Pagination

**Modular Design**:
```
hikari-components/
 ├── basic/          # Basic components
 ├── feedback/       # Feedback components
 ├── navigation/     # Navigation components
 ├── layout/         # Layout components
 ├── data/           # Data components
 ├── hooks.rs        # React hooks
 ├── styled.rs       # Style traits
 └── theme_provider.rs  # Theme provider
```

**Style System**:
- SCSS source
- Type-safe utility classes
- Component-level style isolation
- CSS variable integration

### 6. Build System (hikari-builder)

Compile-time code generation and SCSS compilation.

**Responsibilities**:
- SCSS compilation (using Grass)
- Component discovery
- Code generation
- Resource bundling

**Build Process**:
```
1. Find workspace root directory
   ↓
2. Scan SCSS files
   ↓
3. Generate Rust constants
   ↓
4. Compile SCSS Bundle
   ↓
5. Output to public/
```

**Usage**:
```rust
// build.rs
fn main() {
    hikari_builder::build().expect("Build failed");
}
```

**Generated Files**:
- `packages/builder/src/generated/components.rs` - Component constants
- `public/styles/bundle.css` - Compiled CSS

### 7. Render Service (hikari-render-service)

Server-side rendering and static asset serving.

**Responsibilities**:
- HTML template rendering
- Style registry
- Router builder
- Static asset service
- Axum integration

**Core Features**:
```rust
use hikari_render_service::HikariRenderServicePlugin;

let app = HikariRenderServicePlugin::new()
    .component_style_registry(registry)
    .static_assets("./dist", "/static")
    .add_route("/api/health", get(health_check))
    .build()?;
```

**Architecture Modules**:
- **html** - HTML service
- **registry** - Style registry
- **router** - Router builder
- **static_files** - Static file service
- **styles_service** - Style injection
- **plugin** - Plugin system

### 8. Extra Components Library (hikari-extra-components)

Advanced UI components for complex interaction scenarios.

**Responsibilities**:
- Advanced utility components
- Drag and zoom interactions
- Collapsible panels
- Animation integration

**Core Components**:

1. **Collapsible** - Collapsible panel
   - Left/right slide in/out animation
   - Configurable width
   - Expanded state callback

2. **DragLayer** - Drag layer
   - Boundary constraints
   - Drag event callbacks
   - Custom z-index

3. **ZoomControls** - Zoom controls
   - Keyboard shortcut support
   - Configurable zoom range
   - Multiple positioning options

**Core Features**:
```rust
use hikari_extra_components::{Collapsible, DragLayer, ZoomControls};

// Collapsible panel
Collapsible {
    title: "Settings".to_string(),
    expanded: true,
    position: CollapsiblePosition::Right,
    div { "Content" }
}

// Drag layer
DragLayer {
    initial_x: 100.0,
    initial_y: 100.0,
    constraints: DragConstraints {
        min_x: Some(0.0),
        max_x: Some(500.0),
        ..Default::default()
    },
    div { "Drag me" }
}

// Zoom controls
ZoomControls {
    zoom: 1.0,
    on_zoom_change: move |z| println!("Zoom: {}", z)
}
```

## Architecture Principles

### 1. Modular Design

Each package is independent and can be used separately:

```toml
# Use only palette
[dependencies]
hikari-palette = "0.1"

# Use components and theme
[dependencies]
hikari-components = "0.1"
hikari-theme = "0.1"

# Use animation system
[dependencies]
hikari-animation = "0.1"
```

### 2. Layered Architecture

```
┌─────────────────────────────────────┐
│      Application Layer (examples/)   │
├─────────────────────────────────────┤
│    Component Layer (hikari-components)│
├─────────────────────────────────────┤
│  System Layer (theme, animation, icons)│
├─────────────────────────────────────┤
│   Foundation Layer (palette, builder) │
└─────────────────────────────────────┘
```

### 3. Unidirectional Data Flow

```
User Action → Event Handler → State Update → UI Re-render
```

### 4. Type Safety

All APIs are type-safe:
- Compile-time checking
- IDE autocompletion
- Refactoring safety

### 5. Performance First

- WASM optimization
- Virtual scrolling
- Debouncing/throttling
- Minimized DOM manipulation

## Build Process

### Development Mode
```bash
cargo run
```

### Production Build
```bash
# 1. Build Rust code
cargo build --release

# 2. Build system automatically compiles SCSS
# 3. Generate CSS bundle
# 4. Bundle static assets
```

### WASM Build
```bash
trunk build --release
```

## Dependencies

```
hikari-components
  ├── hikari-palette
  ├── hikari-theme
  ├── hikari-animation
  └── hikari-icons

hikari-extra-components
  ├── hikari-palette
  ├── hikari-theme
  └── hikari-animation

hikari-render-service
  ├── hikari-components
  └── axum

hikari-builder
  └── grass (SCSS compiler)
```

## Extensibility

### Adding Custom Components

```rust
use hikari_components::{StyledComponent, StyleRegistry};

pub struct MyComponent;

impl StyledComponent for MyComponent {
    fn register_styles(registry: &mut StyleRegistry) {
        registry.register("my-component", include_str!("my-component.scss"));
    }
}
```

### Adding Custom Themes

```rust
use hikari_palette::ThemePalette;

struct CustomTheme;

impl CustomTheme {
    pub fn palette() -> ThemePalette {
        ThemePalette {
            primary: "#FF0000",
            secondary: "#00FF00",
            // ...
        }
    }
}
```

### Adding Custom Animation Presets

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};

pub fn fade_in(
    builder: AnimationBuilder,
    element: &str,
    duration: u32,
) -> AnimationBuilder {
    builder
        .add_style(element, CssProperty::Opacity, "0")
        .add_style(element, CssProperty::Opacity, "1")
        .apply_with_transition(&format!("{}ms", duration), "ease-out")
}
```

## Performance Optimization

### 1. CSS Optimization
- SCSS compiled to optimized CSS
- Remove unused styles (tree-shaking)
- Minify production CSS

### 2. WASM Optimization
- `wasm-opt` optimization
- Lazy WASM module loading
- Linear memory optimization

### 3. Runtime Optimization
- Virtual scrolling (large data lists)
- Debounced animation updates
- requestAnimationFrame

### 4. Build Optimization
- Parallel compilation
- Incremental compilation
- Binary caching

## Testing Strategy

### Unit Tests
Each module has complete unit tests:

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_color_conversion() {
        let color = ChineseColor::Cinnabar;
        assert_eq!(color.hex(), "#E94B35");
    }
}
```

### Integration Tests
Example applications in `examples/` serve as integration tests

### Visual Regression Testing
Use Percy or similar tools for UI snapshot testing

## Next Steps

- Read [Component Documentation](../components/) for specific components
- View [API Documentation](https://docs.rs/hikari-components) for API details
- Browse [Example Code](../../examples/) to learn best practices
