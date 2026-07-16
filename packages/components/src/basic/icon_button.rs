// hi-components/src/basic/icon_button.rs
// IconButton component - Square button with icon only
// Three-layer CSS variable system:
// - Layer1: Foundation variables (foundation.scss)
// - Layer2: Component variables (icon-button-vars.scss)
// - Custom: Runtime overrides via icon_color, animation_id


use hikari_icons::{Icon, IconProps, MdiIcon};
use hikari_palette::classes::{ClassesBuilder, components::ButtonClass};

use crate::{
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity, GlowProps},
    prelude::*,
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

// Implement IntoAttrValue for use as HTML attributes
impl IntoAttrValue for IconButtonSize {
    fn into_attr_value(self) -> Option<String> {
        Some(match self {
            IconButtonSize::Small => "small".to_string(),
            IconButtonSize::Medium => "medium".to_string(),
            IconButtonSize::Large => "large".to_string(),
        })
    }
}

impl IntoAttrValue for IconButtonVariant {
    fn into_attr_value(self) -> Option<String> {
        Some(match self {
            IconButtonVariant::Ghost => "ghost".to_string(),
            IconButtonVariant::Primary => "primary".to_string(),
            IconButtonVariant::Secondary => "secondary".to_string(),
            IconButtonVariant::Danger => "danger".to_string(),
            IconButtonVariant::Success => "success".to_string(),
        })
    }
}

/// Props for the IconButton component
#[define_props]
pub struct IconButtonProps {
    #[default(MdiIcon::Help)]
    pub icon: MdiIcon,

    pub size: IconButtonSize,

    pub variant: IconButtonVariant,

    pub icon_color: Option<String>,

    pub background_color: Option<String>,

    pub border_radius: Option<String>,

    pub animation_id: Option<String>,

    pub css_vars: Option<Vec<(&'static str, String)>>,

    #[default(true)]
    pub glow: bool,

    pub glow_blur: GlowBlur,

    pub glow_color: GlowColor,

    pub glow_intensity: GlowIntensity,

    #[default(false)]
    pub disabled: bool,

    #[default(String::new())]
    pub class: String,

    pub onclick: Option<EventHandler<MouseEvent>>,
}

/// Icon button component
///
/// A square button that displays only an icon. Supports different sizes, variants,
/// and glow effects.
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
            class: button_classes,
            style: style_attr,
            "data-animation-id": props.animation_id,
            disabled: props.disabled,
            onclick: move |e| {
                if let Some(handler) = props.onclick.as_ref() {
                    handler(e);
                }
            },
            Icon {
                icon: props.icon,
                size: icon_size,
                class: icon_classes,
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
                {button_content}
            }
        }
    } else {
        button_content
    }
}

pub struct IconButtonComponent;

impl StyledComponent for IconButtonComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/components/icon_button.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "icon_button"
    }
}
