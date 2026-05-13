# hikari-extra-components

Advanced components for complex interaction scenarios, including node graph systems, drag-drop utilities, and zoom controls.

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
