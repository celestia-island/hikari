// hi-components/src/basic/button.rs
// Button component with Arknights + FUI styling
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (button-vars.scss)
// - Custom: Runtime overrides via icon_color, text_color, animation_id

use hikari_palette::classes::{ButtonClass, ClassesBuilder, JustifyContent};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity, GlowProps},
    prelude::*,
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

/// Button variant determining visual style
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

/// Button size preset
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonSize {
    #[default]
    Medium,
    Small,
    Large,
}

/// Button width preset
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ButtonWidth {
    #[default]
    Auto,
    Width120,
    Width140,
    Width160,
}

#[define_props]
pub struct ButtonProps {
    pub variant: ButtonVariant,
    pub size: ButtonSize,
    pub width: ButtonWidth,
    pub disabled: bool,
    pub loading: bool,
    pub block: bool,
    pub icon: Option<Element>,
    pub suffix: Option<Element>,
    pub children: Element,
    pub class: String,
    pub animation: ButtonAnimation,
    #[default(true)]
    pub glow: bool,
    pub glow_blur: GlowBlur,
    pub glow_intensity: GlowIntensity,
    pub glow_color: Option<GlowColor>,
    pub icon_color: Option<String>,
    pub text_color: Option<String>,
    pub background_color: Option<String>,
    pub border_color: Option<String>,
    pub animation_id: Option<String>,
    pub css_vars: Option<Vec<(&'static str, String)>>,
    pub onclick: Option<EventHandler<MouseEvent>>,
}

/// Button component
///
/// A clickable button with support for icons, loading states, animations, and glow effects.
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
        .add_typed(ButtonClass::Button)
        .add_typed(variant_class)
        .add_typed(size_class)
        .add_typed(width_class)
        .add_typed_if(ButtonClass::Loading, props.loading)
        .add_typed_if(ButtonClass::Block, props.block)
        .add_typed(justify_content)
        .add_typed_if(ButtonClass::SpaceBetween, has_both_sides)
        .add(&props.class)
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
            class: classes,
            style: style_attr,
            "data-button-animation": animation_attr,
            "data-animation-id": props.animation_id,
            disabled,
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler(e);
                }
            },

            if props.loading {
                span { class: "hi-button-spinner", "" }
            }

            if let Some(icon) = props.icon {
                span { class: "hi-button-icon", "data-button-icon": "true", {icon} }
            }

            {props.children}

            if let Some(suffix) = props.suffix {
                span { class: "hi-button-suffix", "data-button-suffix": "true", {suffix} }
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
                {button_content}
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
