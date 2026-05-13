// hi-components/src/basic/input.rs
// Input component with Arknights + FUI styling
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (input-vars.scss)
// - Custom: Runtime overrides via text_color, border_color, animation_id

use hikari_palette::classes::{ClassesBuilder, InputClass, TypedClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity, GlowProps},
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

    let mut css_vars_string = String::new();

    // 设置 glow radius 变量，让 Glow wrapper 可以读取
    css_vars_string.push_str("--hi-glow-radius:var(--hi-input-radius);");

    if let Some(color) = &props.text_color {
        css_vars_string.push_str(&format!("--hi-input-text-color:{};", color));
    }

    if let Some(color) = &props.placeholder_color {
        css_vars_string.push_str(&format!("--hi-input-placeholder-color:{};", color));
    }

    if let Some(color) = &props.border_color {
        css_vars_string.push_str(&format!("--hi-input-border-color:{};", color));
        css_vars_string.push_str(&format!("--hi-input-wrapper-border-color:{};", color));
    }

    if let Some(color) = &props.background_color {
        css_vars_string.push_str(&format!("--hi-input-bg:{};", color));
        css_vars_string.push_str(&format!("--hi-input-wrapper-bg:{};", color));
    }

    if let Some(vars) = &props.css_vars {
        for (name, value) in vars {
            css_vars_string.push_str(&format!("{}:{};", name, value));
        }
    }

    let style_attr = Some(css_vars_string);

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

    if props.glow {
        rsx! {
            Glow {
                blur: props.glow_blur,
                color: props.glow_color,
                intensity: props.glow_intensity,
                {input_content}
            }
        }
    } else {
        input_content
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
