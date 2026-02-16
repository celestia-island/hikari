// packages/components/src/basic/canvas.rs
// Canvas component with requestAnimationFrame integration

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Canvas component type wrapper (for StyledComponent)
pub struct CanvasComponent;

/// Canvas render mode
#[derive(Clone, Copy, Default, PartialEq)]
pub enum CanvasMode {
    /// Draw once after mount (default)
    #[default]
    Once,
    /// Continuous animation loop
    Loop,
}

/// Canvas component with requestAnimationFrame integration
///
/// Provides a 2D canvas element. Use the onmounted event to get
/// the canvas reference and draw on it.
#[component]
pub fn Canvas(
    /// Canvas width in pixels
    width: u32,
    /// Canvas height in pixels
    height: u32,
    /// CSS class
    #[props(default)]
    class: String,
    /// Inline styles
    #[props(default)]
    style: String,
) -> Element {
    let class_str = if class.is_empty() {
        "hi-canvas".to_string()
    } else {
        format!("hi-canvas {}", class)
    };

    rsx! {
        canvas {
            class: "{class_str}",
            style: "{style}",
            width: "{width}",
            height: "{height}",
        }
    }
}

impl StyledComponent for CanvasComponent {
    fn styles() -> &'static str {
        r#"
.hi-canvas {
    display: block;
    border-radius: 4px;
    background-color: transparent;
}
"#
    }

    fn name() -> &'static str {
        "canvas"
    }
}
