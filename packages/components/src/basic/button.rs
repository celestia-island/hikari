// hikari-components/src/basic/button.rs
// Button component with Arknights + FUI styling

use dioxus::prelude::*;
use crate::styled::StyledComponent;

/// Button 组件的类型包装器（用于实现 StyledComponent）
pub struct ButtonComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonVariant {
    #[default]
    Primary,
    Secondary,
    Ghost,
    Danger,
    Success,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonSize {
    #[default]
    Medium,
    Small,
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
        ButtonVariant::Primary => "hikari-button-primary",
        ButtonVariant::Secondary => "hikari-button-secondary",
        ButtonVariant::Ghost => "hikari-button-ghost",
        ButtonVariant::Danger => "hikari-button-danger",
        ButtonVariant::Success => "hikari-button-success",
    };

    let size_class = match props.size {
        ButtonSize::Small => "hikari-button-sm",
        ButtonSize::Medium => "hikari-button-md",
        ButtonSize::Large => "hikari-button-lg",
    };

    let disabled = props.disabled || props.loading;
    let loading_class = if props.loading {
        "hikari-button-loading"
    } else {
        ""
    };
    let block_class = if props.block {
        "hikari-button-block"
    } else {
        ""
    };

    rsx! {
        button {
            class: format!(
                "hikari-button {variant_class} {size_class} {loading_class} {block_class} {}",
                props.class
            ),
            disabled: disabled,
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler.call(e);
                }
            },

            if props.loading {
                span { class: "hikari-button-spinner", "" }
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
