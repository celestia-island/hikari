// hi-components/src/layout/space.rs
// Space component for adding spacing

use hikari_palette::classes::{ClassesBuilder, SpaceClass};

use crate::prelude::*;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SpaceDirection {
    #[default]
    Horizontal,
    Vertical,
    Both,
}

#[define_props]
pub struct SpaceProps {
    #[default(1)]
    pub size: u8,

    #[default]
    pub direction: SpaceDirection,

    #[default(false)]
    pub wrap: bool,

    #[default]
    pub class: String,

    pub children: Element,
}

///
///
///
#[component]
pub fn Space(props: SpaceProps) -> Element {
    let direction_class = match props.direction {
        SpaceDirection::Horizontal => SpaceClass::Horizontal,
        SpaceDirection::Vertical => SpaceClass::Vertical,
        SpaceDirection::Both => SpaceClass::Vertical, // Both uses vertical styling
    };

    let space_classes = ClassesBuilder::new()
        .add_typed(SpaceClass::Space)
        .add_typed(direction_class)
        .add_typed_if(SpaceClass::Wrap, props.wrap)
        .add(&props.class)
        .build();

    let size_px = props.size * 8;

    let style = match props.direction {
        SpaceDirection::Horizontal => {
            format!("width: {}px;", size_px)
        }
        SpaceDirection::Vertical => {
            format!("height: {}px;", size_px)
        }
        SpaceDirection::Both => {
            format!("width: {}px; height: {}px;", size_px, size_px)
        }
    };

    rsx! {
        div { class: space_classes, style,
            if props.wrap {
                div { {props.children} }
            } else {
                {props.children}
            }
        }
    }
}

pub struct SpaceComponent;

impl crate::styled::StyledComponent for SpaceComponent {
    fn styles() -> &'static str {
        r#"
.hi-space {
  display: inline-flex;
}

.hi-space-wrap {
  display: flex;
}

.hi-space-horizontal {
  display: inline-flex;
}

.hi-space-vertical {
  display: inline-flex;
  flex-direction: column;
}

.hi-space-both {
  display: inline-flex;
  flex-direction: column;
}
"#
    }

    fn name() -> &'static str {
        "space"
    }
}
