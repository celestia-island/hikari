// hi-components/src/basic/button.rs
// Button component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Button component type wrapper (for implementing StyledComponent)
pub struct ButtonComponent;

/// Button visual variants
///
/// Different visual styles for a button component.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonVariant {
    /// Primary button (most prominent, uses primary color)
    #[default]
    Primary,
    /// Secondary button (less prominent)
    Secondary,
    /// Ghost button (transparent background, border only)
    Ghost,
    /// Danger button (uses danger color for destructive actions)
    Danger,
    /// Success button (uses success color for positive actions)
    Success,
}

/// Button size variants
///
/// Different size options for a button component.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonSize {
    /// Medium size (default)
    #[default]
    Medium,
    /// Small size (compact)
    Small,
    /// Large size (prominent)
    Large,
}

#[derive(Clone, PartialEq, Props)]
pub struct ButtonProps {
    #[props(default)]
    pub variant: ButtonVariant,

    #[props(default)]
    pub size: ButtonSize,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub loading: bool,

    #[props(default)]
    pub block: bool,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,

    pub onclick: Option<EventHandler<MouseEvent>>,
}

impl Default for ButtonProps {
    fn default() -> Self {
        Self {
            variant: Default::default(),
            size: Default::default(),
            disabled: false,
            loading: false,
            block: false,
            icon: None,
            children: VNode::empty(),
            class: String::default(),
            onclick: None,
        }
    }
}

/// Button component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Button;
///
/// fn app() -> Element {
///     rsx! {
///         Button { variant: ButtonVariant::Primary, "Click me" }
///         Button { variant: ButtonVariant::Secondary, "Cancel" }
///     }
/// }
/// ```
#[component]
pub fn Button(props: ButtonProps) -> Element {
    let variant_class = match props.variant {
        ButtonVariant::Primary => "hi-button-primary",
        ButtonVariant::Secondary => "hi-button-secondary",
        ButtonVariant::Ghost => "hi-button-ghost",
        ButtonVariant::Danger => "hi-button-danger",
        ButtonVariant::Success => "hi-button-success",
    };

    let size_class = match props.size {
        ButtonSize::Small => "hi-button-sm",
        ButtonSize::Medium => "hi-button-md",
        ButtonSize::Large => "hi-button-lg",
    };

    let disabled = props.disabled || props.loading;
    let loading_class = if props.loading {
        "hi-button-loading"
    } else {
        ""
    };
    let block_class = if props.block {
        "hi-button-block"
    } else {
        ""
    };

    rsx! {
        button {
            class: format!(
                "hi-button {variant_class} {size_class} {loading_class} {block_class} {}",
                props.class
            ),
            disabled: disabled,
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler.call(e);
                }
            },

            if props.loading {
                span { class: "hi-button-spinner", "" }
            }

            if let Some(icon) = props.icon {
                { icon }
            }

            { props.children }
        }
    }
}

impl StyledComponent for ButtonComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/button.css"))
    }

    fn name() -> &'static str {
        "button"
    }
}
