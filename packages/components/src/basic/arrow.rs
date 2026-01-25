// hi-components/src/basic/arrow.rs
// Arrow indicator component with rotation support

use crate::StyledComponent;
use dioxus::prelude::*;
use icons::Icon;
use icons::MdiIcon;
use palette::classes::{components::ArrowClass, ClassesBuilder};

/// Arrow component style holder
pub struct ArrowComponent;

/// Arrow direction
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ArrowDirection {
    /// Arrow points right (default)
    #[default]
    Right,
    /// Arrow points left
    Left,
    /// Arrow points up
    Up,
    /// Arrow points down
    Down,
}

/// Arrow indicator component
///
/// Displays a chevron arrow with rotation support.
/// Default state points right, rotates based on direction.
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Arrow, ArrowDirection};
///
/// rsx! {
///     // Default: points right
///     Arrow { direction: ArrowDirection::Right }
///
///     // Rotated: points up
///     Arrow { direction: ArrowDirection::Up }
/// }
/// ```
#[component]
pub fn Arrow(
    /// Arrow direction (controls rotation)
    #[props(default)]
    direction: ArrowDirection,

    /// Arrow size in pixels
    #[props(default = 16)]
    size: u32,

    /// Additional CSS classes
    #[props(default)]
    class: String,
) -> Element {
    // Determine direction class
    let direction_class = match direction {
        ArrowDirection::Right => Some(ArrowClass::ArrowRight),
        ArrowDirection::Left => Some(ArrowClass::ArrowLeft),
        ArrowDirection::Up => Some(ArrowClass::ArrowUp),
        ArrowDirection::Down => Some(ArrowClass::ArrowDown),
    };

    // Determine size class
    let size_class = match size {
        14 => Some(ArrowClass::Size14),
        16 => Some(ArrowClass::Size16),
        20 => Some(ArrowClass::Size20),
        _ => None,
    };

    // Build classes
    let mut builder = ClassesBuilder::new().add(ArrowClass::Arrow);

    // Add direction class
    if let Some(dir) = direction_class {
        builder = builder.add(dir);
    }

    // Add size class
    if let Some(sz) = size_class {
        builder = builder.add(sz);
    }

    // Note: User custom class via &props.class is NOT added here
    // If custom class is needed, use a separate class wrapper or
    // extend ArrowClass with more variants
    let classes = builder.build();

    rsx! {
        span {
            class: "{classes}",
            Icon {
                icon: MdiIcon::ChevronRight,
                size,
            }
        }
    }
}

impl StyledComponent for ArrowComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/arrow.css"))
    }

    fn name() -> &'static str {
        "arrow"
    }
}
