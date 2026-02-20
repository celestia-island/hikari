// hi-components/src/layout/divider.rs
// Divider component for visual separation

use crate::theme::use_layout_direction;
use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, DividerClass};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerOrientation {
    #[default]
    Horizontal,
    Vertical,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DividerType {
    #[default]
    Solid,
    Dashed,
    Dotted,
}

#[derive(Clone, PartialEq, Props)]
pub struct DividerProps {
    /// Divider text (for labeled dividers)
    #[props(default)]
    pub text: Option<String>,

    /// Divider orientation
    #[props(default)]
    pub orientation: DividerOrientation,

    /// Divider line style
    #[props(default)]
    pub divider_type: DividerType,

    /// Text alignment for horizontal dividers with text (default: center)
    #[props(default = "center".to_string())]
    pub text_align: String,

    /// Override RTL behavior (default: follow theme direction)
    #[props(default)]
    pub rtl: Option<bool>,

    /// Additional CSS classes
    #[props(default)]
    pub class: String,
}

/// Divider component for visual separation
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Divider, DividerOrientation, DividerType};
///
/// fn app() -> Element {
///     rsx! {
///         Divider {}
///         Divider {
///             text: "Section Title".to_string(),
///         }
///         Divider {
///             orientation: DividerOrientation::Vertical,
///             divider_type: DividerType::Dashed,
///         }
///     }
/// }
/// ```
#[component]
pub fn Divider(props: DividerProps) -> Element {
    let layout_direction = use_layout_direction();
    let is_rtl = props.rtl.unwrap_or_else(|| layout_direction.is_rtl());

    let orientation_class = match props.orientation {
        DividerOrientation::Horizontal => DividerClass::Horizontal,
        DividerOrientation::Vertical => DividerClass::Vertical,
    };

    let type_class = match props.divider_type {
        DividerType::Solid => DividerClass::Solid,
        DividerType::Dashed => DividerClass::Dashed,
        DividerType::Dotted => DividerClass::Dotted,
    };

    let mut builder = ClassesBuilder::new()
        .add(DividerClass::Divider)
        .add(orientation_class)
        .add(type_class)
        .add_if(DividerClass::WithText, || props.text.is_some())
        .add_raw(&props.class);

    if is_rtl {
        builder = builder.add_raw("hi-divider-rtl");
    }

    let divider_classes = builder.build();

    let text_align_style = if props.text.is_some() {
        match props.text_align.as_str() {
            "left" => {
                if is_rtl {
                    "text-align: right;"
                } else {
                    "text-align: left;"
                }
            }
            "right" => {
                if is_rtl {
                    "text-align: left;"
                } else {
                    "text-align: right;"
                }
            }
            _ => "text-align: center;",
        }
    } else {
        ""
    };

    rsx! {
        div {
            class: "{divider_classes}",
            style: "{text_align_style}",
            if let Some(label) = props.text {
                span { class: "hi-divider-text", "{label}" }
            }
        }
    }
}

/// Divider component's type wrapper for StyledComponent
pub struct DividerComponent;

impl crate::styled::StyledComponent for DividerComponent {
    fn styles() -> &'static str {
        r#"
.hi-divider {
  width: 100%;
  display: flex;
  align-items: center;
  color: var(--hi-border);
}

.hi-divider-horizontal {
  height: 1px;
  flex-direction: row;
}

.hi-divider-vertical {
  width: 1px;
  min-height: 100%;
  flex-direction: column;
}

.hi-divider-solid {
  border-top: 1px solid var(--hi-border);
}

.hi-divider-dashed {
  border-top: 1px dashed var(--hi-border);
}

.hi-divider-dotted {
  border-top: 1px dotted var(--hi-border);
}

.hi-divider-with-text {
  position: relative;
}

.hi-divider-text {
  background: var(--hi-surface);
  padding: 0 16px;
  font-size: 14px;
  color: var(--hi-text-secondary);
}

[data-theme="dark"] .hi-divider {
  border-color: var(--hi-border);
}

[data-theme="dark"] .hi-divider-text {
  background: var(--hi-background);
  color: var(--hi-text-secondary);
}
"#
    }

    fn name() -> &'static str {
        "divider"
    }
}
