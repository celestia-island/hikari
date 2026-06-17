# hikari-extra-components

Framework-agnostic data models for advanced UI components, including node graph systems, drag-drop utilities, zoom controls, and rich media state management.

## Design Philosophy

This package provides **pure Rust data models** — no rendering framework dependency. All state types implement `serde::Serialize` / `serde::Deserialize` and include builder-pattern APIs.

## Relationship to `hikari-components`

While `hikari-components` provides **rendered components** (using `rsx!`, reactive hooks, and `StyledComponent` CSS), this package provides the underlying **data models** that can be used independently:

| Feature | `hikari-components` | `hikari-extra-components` (this package) |
|---------|---------------------|------------------------------------------|
| Rendering | `rsx!` macro + reactive hooks | None — pure data structs |
| Serde | Not derived | `Serialize` / `Deserialize` on all types |
| DOM dependency | Requires Tairitsu | None |
| CSS | `StyledComponent` trait | Exported `const *_STYLES` strings |
| Event handling | `EventHandler<T>` closures | `data-action` attributes for delegation |

**Overlapping domains** — Timeline, DragLayer, UserGuide, ZoomControls, VideoPlayer, RichTextEditor, CodeHighlight — exist in both packages. The `components` versions are rendered UI elements; the `extra` versions are pure state structs.

> **Type disambiguation:** Some types share names (e.g., `GuideStep`, `TimelinePosition`). Import with explicit paths:
> ```rust,ignore
> use hikari_extra_components::extra::TimelineState;  // pure data model
> use hikari_components::display::Timeline;           // rendered component
> ```

## Installation

```toml
[dependencies]
hikari-extra-components = "0.1.0"
hikari-components = "0.1.0"
hikari-theme = "0.1.0"
```

## Quick Start

```rust
use hikari_extra_components::{Collapsible, DragLayer, ZoomControls};

// Collapsible panel
Collapsible {
    title: "Settings".to_string(),
    expanded: true,
    div { "Content" }
}

// Drag layer
DragLayer {
    initial_x: 100.0,
    initial_y: 100.0,
    div { "Drag me" }
}

// Zoom controls
ZoomControls {
    zoom: 1.0,
    on_zoom_change: move |z| println!("Zoom: {}", z)
}
```

## Documentation

For complete API documentation, node graph system, and examples, see [docs.rs](https://docs.rs/hikari-extra-components)

## Features

- **Node Graph System** - Visual node editors with canvas, connections, ports, and minimap
- **Drag Layer** - Advanced drag-drop functionality with boundary constraints
- **Collapsible** - Animated collapsible panels with slide-in/out animations
- **Zoom Controls** - Zoomable containers with keyboard shortcuts and smooth scaling

## Use Cases

- Visual programming language editors
- Workflow automation builders
- Shader editors
- Node-based data flow tools
- Interactive zoomable canvases

## License

MIT OR Apache-2.0
