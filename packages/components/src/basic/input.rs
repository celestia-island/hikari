// hi-components/src/basic/input.rs
// Input component with Arknights + FUI styling
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (input-vars.scss)
// - Custom: Runtime overrides via text_color, border_color, animation_id

use hikari_palette::classes::{ClassesBuilder, InputClass, TypedClass};

use crate::{
    feedback::{ConditionalGlow, ConditionalGlowProps, GlowBlur, GlowColor, GlowIntensity},
    prelude::*,
    styled::StyledComponent,
};

pub struct InputComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputSize {
    Small,
    #[default]
    Medium,
    Large,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputStatus {
    #[default]
    Default,
    Error,
    Success,
}

impl IntoAttrValue for InputSize {
    fn into_attr_value(self) -> Option<String> {
        Some(match self {
            InputSize::Small => "small".to_string(),
            InputSize::Medium => "medium".to_string(),
            InputSize::Large => "large".to_string(),
        })
    }
}

#[define_props]
pub struct InputProps {
    pub size: InputSize,

    pub disabled: bool,

    pub readonly: bool,

    pub placeholder: Option<String>,

    pub value: Option<String>,

    pub input_type: Option<String>,

    pub autofocus: bool,

    pub class: String,

    pub prefix_icon: Option<Element>,

    pub suffix_icon: Option<Element>,

    pub oninput: Option<EventHandler<String>>,

    pub onfocus: Option<EventHandler<FocusEvent>>,

    pub onblur: Option<EventHandler<FocusEvent>>,

    pub onkeydown: Option<EventHandler<KeyboardEvent>>,

    #[default(true)]
    pub glow: bool,

    pub glow_blur: GlowBlur,

    pub glow_intensity: GlowIntensity,

    pub glow_color: GlowColor,

    pub text_color: Option<String>,

    pub placeholder_color: Option<String>,

    pub border_color: Option<String>,

    pub background_color: Option<String>,

    pub animation_id: Option<String>,

    pub css_vars: Option<Vec<(&'static str, String)>>,

    pub status: InputStatus,
}

///
///
///
///
///
///
///
///
///
///
#[component]
pub fn Input(props: InputProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add_typed(InputClass::InputWrapper)
        .add_typed(match props.size {
            InputSize::Small => InputClass::InputSm,
            InputSize::Medium => InputClass::InputMd,
            InputSize::Large => InputClass::InputLg,
        })
        .add(&props.class)
        .build();

    let input_classes = ClassesBuilder::new()
        .add_typed(InputClass::Input)
        .add_typed_if(InputClass::InputDisabled, props.disabled)
        .add_typed_if(
            InputClass::InputError,
            matches!(props.status, InputStatus::Error),
        )
        .add_typed_if(
            InputClass::InputSuccess,
            matches!(props.status, InputStatus::Success),
        )
        .build();

    let style_attr = crate::utils::build_css_vars_style(
        "--hi-input-radius",
        &[
            crate::utils::CssVarEntry::new(&props.text_color, &["--hi-input-text-color"]),
            crate::utils::CssVarEntry::new(
                &props.placeholder_color,
                &["--hi-input-placeholder-color"],
            ),
            crate::utils::CssVarEntry::new(
                &props.border_color,
                &["--hi-input-border-color", "--hi-input-wrapper-border-color"],
            ),
            crate::utils::CssVarEntry::new(
                &props.background_color,
                &["--hi-input-bg", "--hi-input-wrapper-bg"],
            ),
        ],
        &props.css_vars,
    );

    let input_content = rsx! {
        div {
            class: wrapper_classes,
            style: style_attr,
            "data-animation-id": props.animation_id,

            if let Some(icon) = props.prefix_icon {
                span { class: InputClass::InputPrefix.class_name(), {icon} }
            }

            input {
                class: input_classes,
                r#type: props.input_type.unwrap_or("text".to_string()),
                autofocus: props.autofocus,
                disabled: props.disabled,
                readonly: props.readonly,
                placeholder: props.placeholder.clone(),
                value: props.value,
                "aria-invalid": if matches!(props.status, InputStatus::Error) { Some("true".to_string()) } else { None },
                "aria-label": props.placeholder.clone(),
                oninput: move |e: InputEvent| {
                    if let Some(handler) = props.oninput.as_ref() {
                        handler.call(e.data.clone());
                    }
                },
                onfocus: move |e: FocusEvent| {
                    if let Some(handler) = props.onfocus.as_ref() {
                        handler.call(e);
                    }
                },
                onblur: move |e: FocusEvent| {
                    if let Some(handler) = props.onblur.as_ref() {
                        handler.call(e);
                    }
                },
                onkeydown: move |e: KeyboardEvent| {
                    if let Some(handler) = props.onkeydown.as_ref() {
                        handler.call(e);
                    }
                },
            }

            if let Some(icon) = props.suffix_icon {
                span { class: InputClass::InputSuffix.class_name(), {icon} }
            }
        }
    };

    rsx! {
        ConditionalGlow {
            glow: props.glow,
            blur: props.glow_blur,
            color: props.glow_color,
            intensity: props.glow_intensity,
            {input_content}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::styled::StyledComponent;

    #[test]
    fn test_input_size_default() {
        assert_eq!(InputSize::default(), InputSize::Medium);
    }

    #[test]
    fn test_input_size_distinct() {
        assert_ne!(InputSize::Small, InputSize::Medium);
        assert_ne!(InputSize::Medium, InputSize::Large);
        assert_ne!(InputSize::Small, InputSize::Large);
    }

    #[test]
    fn test_input_status_default() {
        assert_eq!(InputStatus::default(), InputStatus::Default);
    }

    #[test]
    fn test_input_status_distinct() {
        assert_ne!(InputStatus::Default, InputStatus::Error);
        assert_ne!(InputStatus::Error, InputStatus::Success);
        assert_ne!(InputStatus::Default, InputStatus::Success);
    }

    #[test]
    fn test_input_size_into_attr() {
        assert_eq!(InputSize::Small.into_attr_value().as_deref(), Some("small"));
        assert_eq!(
            InputSize::Medium.into_attr_value().as_deref(),
            Some("medium")
        );
        assert_eq!(InputSize::Large.into_attr_value().as_deref(), Some("large"));
    }

    #[test]
    fn test_input_component_name() {
        assert_eq!(InputComponent::name(), "input");
    }
}

impl StyledComponent for InputComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/input.css"))
    }

    fn name() -> &'static str {
        "input"
    }
}
