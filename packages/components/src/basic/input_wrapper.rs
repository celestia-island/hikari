// packages/components/src/basic/input_wrapper.rs
// Generic input wrapper component for consistent layout
// Supports left/right icons and buttons using IconButton component
//
// Usage Guidelines:
// 1. All icon elements must use IconButton component
// 2. Pure icon display must have disabled state with default glow
// 3. Multiple icons should use consistent spacing (4px gap)
// 4. Icon sizes: Small(24px), Medium(32px), Large(40px)

use hikari_icons::MdiIcon;
use hikari_palette::classes::{ClassesBuilder, InputWrapperClass, UtilityClass};

use crate::{
    basic::{IconButton, IconButtonProps},
    feedback::{Glow, GlowBlur, GlowColor, GlowIntensity, GlowProps},
    prelude::*,
    styled::StyledComponent,
};

pub struct InputWrapperComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputWrapperSize {
    Small,
    #[default]
    Medium,
    Large,
}

impl InputWrapperSize {
    pub fn icon_button_size(&self) -> crate::basic::IconButtonSize {
        match self {
            InputWrapperSize::Small => crate::basic::IconButtonSize::Small,
            InputWrapperSize::Medium => crate::basic::IconButtonSize::Medium,
            InputWrapperSize::Large => crate::basic::IconButtonSize::Large,
        }
    }
}

#[derive(Clone, PartialEq)]
pub enum InputWrapperItem {
    Button {
        icon: MdiIcon,
        onclick: EventHandler<MouseEvent>,
        disabled: bool,
        icon_color: Option<String>,
    },
    Icon {
        icon: MdiIcon,
    },
    Custom(Element),
}

impl InputWrapperItem {
    pub fn button(icon: MdiIcon, onclick: EventHandler<MouseEvent>) -> Self {
        Self::Button {
            icon,
            onclick,
            disabled: false,
            icon_color: None,
        }
    }

    pub fn button_with_color(
        icon: MdiIcon,
        onclick: EventHandler<MouseEvent>,
        icon_color: String,
    ) -> Self {
        Self::Button {
            icon,
            onclick,
            disabled: false,
            icon_color: Some(icon_color),
        }
    }

    pub fn button_disabled(icon: MdiIcon) -> Self {
        Self::Button {
            icon,
            onclick: EventHandler::new(|_| {}),
            disabled: true,
            icon_color: None,
        }
    }

    pub fn icon(icon: MdiIcon) -> Self {
        Self::Icon { icon }
    }

    pub fn custom(element: Element) -> Self {
        Self::Custom(element)
    }
}

#[define_props]
pub struct InputWrapperProps {
    #[default]
    pub left: Vec<InputWrapperItem>,

    #[default]
    pub right: Vec<InputWrapperItem>,

    #[default]
    pub input: Option<Element>,

    #[default]
    pub size: InputWrapperSize,

    #[default(false)]
    pub disabled: bool,

    #[default]
    pub class: String,

    #[default]
    pub style: String,

    #[default(true)]
    pub glow: bool,

    #[default]
    pub glow_blur: GlowBlur,

    #[default]
    pub glow_intensity: GlowIntensity,

    #[default]
    pub glow_color: GlowColor,
}

///
///
///
///
///
///
///
///
#[component]
pub fn InputWrapper(props: InputWrapperProps) -> Element {
    let wrapper_classes = ClassesBuilder::new()
        .add(InputWrapperClass::Wrapper)
        .add(match props.size {
            InputWrapperSize::Small => InputWrapperClass::SizeSm,
            InputWrapperSize::Medium => InputWrapperClass::SizeMd,
            InputWrapperSize::Large => InputWrapperClass::SizeLg,
        })
        .add_if(InputWrapperClass::Disabled, || props.disabled)
        .add_raw(&props.class)
        .build();

    let icon_button_size = props.size.icon_button_size();

    // Render item as IconButton
    let render_item = move |item: &InputWrapperItem| -> Element {
        match item {
            InputWrapperItem::Button {
                icon,
                onclick,
                disabled,
                icon_color,
            } => {
                let is_disabled = *disabled || props.disabled;
                let onclick_handler = onclick.clone();
                rsx! {
                    IconButton {
                        icon: *icon,
                        size: icon_button_size,
                        variant: crate::basic::IconButtonVariant::Ghost,
                        disabled: is_disabled,
                        glow: true,
                        glow_intensity: GlowIntensity::Soft,
                        glow_blur: GlowBlur::None,
                        glow_color: GlowColor::Ghost,
                        onclick: Some(onclick_handler.clone()),
                        icon_color: icon_color.clone(),
                    }
                }
            }
            InputWrapperItem::Icon { icon } => {
                // Pure icon display - always disabled with default glow
                rsx! {
                    IconButton {
                        icon: *icon,
                        size: icon_button_size,
                        variant: crate::basic::IconButtonVariant::Ghost,
                        disabled: true,
                        glow: true,
                        glow_intensity: GlowIntensity::Soft,
                        glow_blur: GlowBlur::None,
                        glow_color: GlowColor::Ghost,
                    }
                }
            }
            InputWrapperItem::Custom(element) => element.clone(),
        }
    };

    let content = rsx! {
        div { class: wrapper_classes, style: props.style,

            // Left section
            if !props.left.is_empty() {
                div { class: InputWrapperClass::LeftSection.as_class(),
                    for (i , item) in props.left.iter().enumerate() {
                        div {
                            key: i,
                            class: InputWrapperClass::SideItem.as_class(),
                            {render_item(item)}
                        }
                    }
                }
            }

            // Input section
            div { class: InputWrapperClass::InputSection.as_class(),
                if let Some(input) = props.input.as_ref() {
                    {input.clone()}
                }
            }

            // Right section
            if !props.right.is_empty() {
                div { class: InputWrapperClass::RightSection.as_class(),
                    for (i , item) in props.right.iter().enumerate() {
                        div {
                            key: i,
                            class: InputWrapperClass::SideItem.as_class(),
                            {render_item(item)}
                        }
                    }
                }
            }
        }
    };

    // Wrap with glow if enabled
    if props.glow {
        rsx! {
            Glow {
                blur: props.glow_blur,
                color: props.glow_color,
                intensity: props.glow_intensity,
                {content}
            }
        }
    } else {
        content
    }
}

impl StyledComponent for InputWrapperComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/input_wrapper.css"))
    }

    fn name() -> &'static str {
        "input_wrapper"
    }
}
