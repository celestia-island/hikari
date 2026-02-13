// hi-components/src/layout/space.rs
// Space component for adding spacing

use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, SpaceClass};

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SpaceDirection {
    Horizontal,
    Vertical,
    Both,
}

impl Default for SpaceDirection {
    fn default() -> Self {
        Self::Horizontal
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct SpaceProps {
    /// Space size (number of 8px units)
    #[props(default = 1)]
    pub size: u8,

    /// Direction of spacing
    #[props(default)]
    pub direction: SpaceDirection,

    /// Whether to wrap content
    #[props(default = false)]
    pub wrap: bool,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,

    /// Content to display
    pub children: Element,
}

impl Default for SpaceProps {
    fn default() -> Self {
        Self {
            size: 1,
            direction: SpaceDirection::Horizontal,
            wrap: false,
            class: String::new(),
            children: VNode::empty(),
        }
    }
}

/// Space component for adding spacing
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Space, SpaceDirection};
///
/// fn app() -> Element {
///     rsx! {
///         Space {
///             size: 2,
///             div { "Content" }
///         }
///         Space {
///             direction: SpaceDirection::Vertical,
///             size: 1,
///             div { "Content" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Space(props: SpaceProps) -> Element {
    let direction_class = match props.direction {
        SpaceDirection::Horizontal => SpaceClass::Horizontal,
        SpaceDirection::Vertical => SpaceClass::Vertical,
        SpaceDirection::Both => SpaceClass::Vertical, // Both uses vertical styling
    };

    let space_classes = ClassesBuilder::new()
        .add(SpaceClass::Space)
        .add(direction_class)
        .add_if(SpaceClass::Wrap, || props.wrap)
        .add_raw(&props.class)
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
        div {
            class: "{space_classes}",
            style: "{style}",
            if props.wrap {
                div { { props.children } }
            } else {
                { props.children }
            }
        }
    }
}

/// Space component's type wrapper for StyledComponent
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
