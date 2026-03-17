// hi-components/src/basic/button.rs
// Button component with Arknights + FUI styling
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (button-vars.scss)
// - Custom: Runtime overrides via icon_color, text_color, animation_id

use crate::prelude::*;
use hikari_palette::classes::{ButtonClass, ClassesBuilder, JustifyContent};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonAnimation {
    #[default]
    None,
    Scale,
    ScaleElevate,
    Ripple,
    IconRotate,
}

pub struct ButtonComponent;

///
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonVariant {
    #[default]
    Primary,
    Secondary,
    Ghost,
    Borderless,
    Danger,
    Success,
}

///
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonSize {
    #[default]
    Medium,
    Small,
    Large,
}

///
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonWidth {
    #[default]
    Auto,
    Width120,
    Width140,
    Width160,
}

#[derive(Clone, PartialEq, Props)]
pub struct ButtonProps {
    #[props(default)]
    pub variant: ButtonVariant,

    #[props(default)]
    pub size: ButtonSize,

    #[props(default)]
    pub width: ButtonWidth,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub loading: bool,

    #[props(default)]
    pub block: bool,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub suffix: Option<Element>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub animation: ButtonAnimation,

    #[props(default = true)]
    pub glow: bool,

    #[props(default)]
    pub glow_blur: GlowBlur,

    #[props(default)]
    pub glow_intensity: GlowIntensity,

    #[props(default)]
    pub glow_color: Option<GlowColor>,

    #[props(default)]
    pub icon_color: Option<String>,

    #[props(default)]
    pub text_color: Option<String>,

    #[props(default)]
    pub background_color: Option<String>,

    #[props(default)]
    pub border_color: Option<String>,

    #[props(default)]
    pub animation_id: Option<String>,

    #[props(default)]
    pub css_vars: Option<Vec<(&'static str, String)>>,

    pub onclick: Option<EventHandler<MouseEvent>>,
}

impl Default for ButtonProps {
    fn default() -> Self {
        Self {
            variant: Default::default(),
            size: Default::default(),
            width: Default::default(),
            disabled: false,
            loading: false,
            block: false,
            icon: None,
            suffix: None,
            children: VNode::empty(),
            class: String::default(),
            animation: Default::default(),
            glow: true,
            glow_blur: Default::default(),
            glow_intensity: crate::feedback::GlowIntensity::Soft,
            glow_color: None,
            icon_color: None,
            text_color: None,
            background_color: None,
            border_color: None,
            animation_id: None,
            css_vars: None,
            onclick: None,
        }
    }
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
pub fn Button(props: ButtonProps) -> Element {
    let variant_class = match props.variant {
        ButtonVariant::Primary => ButtonClass::Primary,
        ButtonVariant::Secondary => ButtonClass::Secondary,
        ButtonVariant::Ghost => ButtonClass::Ghost,
        ButtonVariant::Borderless => ButtonClass::Borderless,
        ButtonVariant::Danger => ButtonClass::Danger,
        ButtonVariant::Success => ButtonClass::Success,
    };

    let size_class = match props.size {
        ButtonSize::Small => ButtonClass::Sm,
        ButtonSize::Medium => ButtonClass::Md,
        ButtonSize::Large => ButtonClass::Lg,
    };

    let width_class = match props.width {
        ButtonWidth::Auto => ButtonClass::WidthAuto,
        ButtonWidth::Width120 => ButtonClass::Width120,
        ButtonWidth::Width140 => ButtonClass::Width140,
        ButtonWidth::Width160 => ButtonClass::Width160,
    };

    let disabled = props.disabled || props.loading;

    let has_both_sides = props.icon.is_some() && props.suffix.is_some();
    let justify_content = if has_both_sides {
        JustifyContent::Between
    } else {
        JustifyContent::Center
    };

    let classes = ClassesBuilder::new()
        .add(ButtonClass::Button)
        .add(variant_class)
        .add(size_class)
        .add(width_class)
        .add_if(ButtonClass::Loading, || props.loading)
        .add_if(ButtonClass::Block, || props.block)
        .add(justify_content)
        .add_if(ButtonClass::SpaceBetween, || has_both_sides)
        .add_raw(&props.class)
        .build();

    let animation_attr = match props.animation {
        ButtonAnimation::None => None,
        ButtonAnimation::Scale => Some("scale"),
        ButtonAnimation::ScaleElevate => Some("scale-elevate"),
        ButtonAnimation::Ripple => Some("ripple"),
        ButtonAnimation::IconRotate => Some("icon-rotate"),
    };

    let mut css_vars_string = String::new();

    // 设置 glow radius 变量，让 Glow wrapper 可以读取
    css_vars_string.push_str("--hi-glow-radius:var(--hi-button-radius);");

    if let Some(color) = &props.icon_color {
        css_vars_string.push_str(&format!("--hi-button-icon-color:{};", color));
        css_vars_string.push_str(&format!("--hi-button-icon-color-active:{};", color));
    }

    if let Some(color) = &props.text_color {
        css_vars_string.push_str(&format!("--hi-button-text-color:{};", color));
        css_vars_string.push_str(&format!("--hi-button-text-color-active:{};", color));
    }

    if let Some(color) = &props.background_color {
        css_vars_string.push_str(&format!("--hi-button-bg:{};", color));
    }

    if let Some(color) = &props.border_color {
        css_vars_string.push_str(&format!("--hi-button-border-color:{};", color));
        css_vars_string.push_str(&format!("--hi-button-border-color-focus:{};", color));
    }

    if let Some(vars) = &props.css_vars {
        for (name, value) in vars {
            css_vars_string.push_str(&format!("{}:{};", name, value));
        }
    }

    let style_attr = Some(css_vars_string);

    let button_content = rsx! {
        button {
            class: "{classes}",
            style: style_attr,
            "data-button-animation": animation_attr,
            "data-animation-id": props.animation_id,
            disabled: disabled,
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler(e);
                }
            },

            if props.loading {
                span { class: "hi-button-spinner", "" }
            }

            if let Some(icon) = props.icon {
                span {
                    class: "hi-button-icon",
                    "data-button-icon": "true",
                    { icon }
                }
            }

            { props.children }

            if let Some(suffix) = props.suffix {
                span {
                    class: "hi-button-suffix",
                    "data-button-suffix": "true",
                    { suffix }
                }
            }
        }
    };

    if props.glow {
        let glow_color = if let Some(color) = props.glow_color {
            color
        } else {
            match props.variant {
                ButtonVariant::Ghost => GlowColor::Ghost,
                ButtonVariant::Borderless => GlowColor::Ghost,
                ButtonVariant::Primary => GlowColor::Primary,
                ButtonVariant::Secondary => GlowColor::Secondary,
                ButtonVariant::Danger => GlowColor::Danger,
                ButtonVariant::Success => GlowColor::Success,
            }
        };

        rsx! {
            Glow {
                blur: props.glow_blur,
                color: glow_color,
                intensity: props.glow_intensity,
                { button_content }
            }
        }
    } else {
        button_content
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
