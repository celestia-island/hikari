// hi-components/src/basic/arrow.rs
// Arrow indicator component with rotation support

use hikari_icons::{Icon, IconProps, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, components::ArrowClass};

use crate::{StyledComponent, prelude::*};

pub struct ArrowComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ArrowDirection {
    #[default]
    Right,
    Left,
    Up,
    Down,
}

impl IntoAttrValue for ArrowDirection {
    fn into_attr_value(self) -> Option<String> {
        Some(match self {
            ArrowDirection::Right => "right".to_string(),
            ArrowDirection::Left => "left".to_string(),
            ArrowDirection::Up => "up".to_string(),
            ArrowDirection::Down => "down".to_string(),
        })
    }
}

///
///
///
///
///
#[component]
pub fn Arrow(
    #[props(default)] direction: ArrowDirection,

    #[props(default = 16)] size: u32,

    #[props(default)] class: String,
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
    let mut builder = ClassesBuilder::new().add_typed(ArrowClass::Arrow);

    if let Some(dir) = direction_class {
        builder = builder.add_typed(dir);
    }

    if let Some(sz) = size_class {
        builder = builder.add_typed(sz);
    }

    builder = builder.add(&class);

    let classes = builder.build();

    rsx! {
        span {
            class: classes,
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
