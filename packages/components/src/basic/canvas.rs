// packages/components/src/basic/canvas.rs
// Canvas component with requestAnimationFrame integration

use crate::{prelude::*, styled::StyledComponent};

pub struct CanvasComponent;

#[derive(Clone, Copy, Default, PartialEq)]
pub enum CanvasMode {
    #[default]
    Once,
    Loop,
}

#[component]
pub fn Canvas(
    width: u32,
    height: u32,
    #[props(default)] class: String,
    #[props(default)] style: String,
) -> Element {
    let class_str = if class.is_empty() {
        "hk-canvas".to_string()
    } else {
        format!("hk-canvas {}", class)
    };

    rsx! {
        canvas {
            class: class_str,
            style,
            width,
            height,
        }
    }
}

impl StyledComponent for CanvasComponent {
    fn styles() -> &'static str {
        r#"
.hk-canvas {
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
