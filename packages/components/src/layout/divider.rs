// hi-components/src/layout/divider.rs
// Divider component for visual separation

use dioxus::prelude::*;
use palette::classes::ClassesBuilder;

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
    let divider_classes = ClassesBuilder::new()
        .add_raw("hi-divider")
        .add_raw(match props.orientation {
            DividerOrientation::Horizontal => "hi-divider-horizontal",
            DividerOrientation::Vertical => "hi-divider-vertical",
        })
        .add_raw(match props.divider_type {
            DividerType::Solid => "hi-divider-solid",
            DividerType::Dashed => "hi-divider-dashed",
            DividerType::Dotted => "hi-divider-dotted",
        })
        .add_raw(if props.text.is_some() {
            "hi-divider-with-text"
        } else {
            ""
        })
        .add_raw(&props.class)
        .build();

    rsx! {
        div {
            class: "{divider_classes}",
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
