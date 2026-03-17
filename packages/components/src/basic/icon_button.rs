// hi-components/src/basic/icon_button.rs
// IconButton component - Square button with icon only
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (icon-button-vars.scss)
// - Custom: Runtime overrides via icon_color, animation_id

use crate::prelude::*;
use hikari_icons::{Icon, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, components::ButtonClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonSize {
    Small,
    Medium,
    #[default]
    Large,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum IconButtonVariant {
    #[default]
    Ghost,
    Primary,
    Secondary,
    Danger,
    Success,
}

///
#[derive(Clone, PartialEq, Props)]
pub struct IconButtonProps {
    pub icon: MdiIcon,

    #[props(default)]
    pub size: IconButtonSize,

    #[props(default)]
    pub variant: IconButtonVariant,

    #[props(default)]
    pub icon_color: Option<String>,

    #[props(default)]
    pub background_color: Option<String>,

    #[props(default)]
    pub border_radius: Option<String>,

    #[props(default)]
    pub animation_id: Option<String>,

    #[props(default)]
    pub css_vars: Option<Vec<(&'static str, String)>>,

    #[props(default = true)]
    pub glow: bool,

    #[props(default = GlowBlur::Medium)]
    pub glow_blur: GlowBlur,

    #[props(default = GlowColor::Primary)]
    pub glow_color: GlowColor,

    #[props(default = GlowIntensity::Soft)]
    pub glow_intensity: GlowIntensity,

    #[props(default = false)]
    pub disabled: bool,

    #[props(default)]
    pub class: String,

    pub onclick: EventHandler<MouseEvent>,
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
pub fn IconButton(props: IconButtonProps) -> Element {
    let icon_size = 14;

    let size_class = match props.size {
        IconButtonSize::Small => Some(ButtonClass::IconButtonSize24),
        IconButtonSize::Medium => Some(ButtonClass::IconButtonSize32),
        IconButtonSize::Large => Some(ButtonClass::IconButtonSize40),
    };

    let variant_class = match props.variant {
        IconButtonVariant::Ghost => ButtonClass::IconButtonGhost,
        IconButtonVariant::Primary => ButtonClass::IconButtonPrimary,
        IconButtonVariant::Secondary => ButtonClass::IconButtonSecondary,
        IconButtonVariant::Danger => ButtonClass::IconButtonDanger,
        IconButtonVariant::Success => ButtonClass::IconButtonSuccess,
    };

    let mut builder = ClassesBuilder::new()
        .add(ButtonClass::Button)
        .add(ButtonClass::IconButton)
        .add(variant_class);

    if let Some(size) = size_class {
        builder = builder.add(size);
    }

    if props.disabled {
        builder = builder.add(ButtonClass::Disabled);
    }

    let button_classes = builder.add_raw(&props.class).build();

    let icon_classes = ClassesBuilder::new()
        .add(ButtonClass::IconButtonIcon)
        .add_if(ButtonClass::IconButtonDisabled, || props.disabled)
        .build();

    let mut css_vars_string = String::new();

    // 设置 glow radius 变量，让 Glow wrapper 可以读取
    css_vars_string.push_str("--hi-glow-radius:var(--hi-icon-button-radius);");

    if let Some(color) = &props.icon_color {
        css_vars_string.push_str(&format!("--hi-icon-button-icon-color:{};", color));
        css_vars_string.push_str(&format!("--hi-icon-button-icon-color-active:{};", color));
    }

    if let Some(color) = &props.background_color {
        css_vars_string.push_str(&format!("--hi-icon-button-bg:{};", color));
    }

    if let Some(radius) = &props.border_radius {
        css_vars_string.push_str(&format!("--hi-icon-button-radius:{};", radius));
    }

    if let Some(vars) = &props.css_vars {
        for (name, value) in vars {
            css_vars_string.push_str(&format!("{}:{};", name, value));
        }
    }

    let style_attr = Some(css_vars_string);

    let glow_color = match props.variant {
        IconButtonVariant::Ghost => props.glow_color,
        IconButtonVariant::Primary => GlowColor::Primary,
        IconButtonVariant::Secondary => GlowColor::Secondary,
        IconButtonVariant::Danger => GlowColor::Danger,
        IconButtonVariant::Success => GlowColor::Success,
    };

    let button_content = rsx! {
        button {
            class: "{button_classes}",
            style: style_attr,
            "data-animation-id": props.animation_id,
            disabled: props.disabled,
            onclick: props.onclick,

            Icon {
                icon: props.icon,
                size: icon_size,
                class: "{icon_classes}",
                color: props.icon_color.clone().unwrap_or_else(|| "inherit".to_string()),
            }
        }
    };

    if props.glow {
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

pub struct IconButtonComponent;

impl StyledComponent for IconButtonComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/icon_button.css"))
    }

    fn name() -> &'static str {
        "icon_button"
    }
}
