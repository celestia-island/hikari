// packages/components/src/basic/input_wrapper.rs
// Generic input wrapper component for consistent layout
// Supports left/right icons and buttons using IconButton component
//
// Usage Guidelines:
// 1. All icon elements must use IconButton component
// 2. Pure icon display must have disabled state with default glow
// 3. Multiple icons should use consistent spacing (4px gap)
// 4. Icon sizes: Small(24px), Medium(32px), Large(40px)

use dioxus::prelude::*;
use icons::MdiIcon;
use palette::classes::{ClassesBuilder, InputWrapperClass, UtilityClass};

use crate::{
    basic::IconButton,
    feedback::{GlowBlur, GlowColor, GlowIntensity},
    styled::StyledComponent,
};

pub struct InputWrapperComponent;

/// Size variants for InputWrapper
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InputWrapperSize {
    /// 32px height, 24px icons
    Small,
    /// 40px height, 32px icons (default)
    #[default]
    Medium,
    /// 48px height, 40px icons
    Large,
}

impl InputWrapperSize {
    /// Get corresponding icon button size
    pub fn icon_button_size(&self) -> crate::basic::IconButtonSize {
        match self {
            InputWrapperSize::Small => crate::basic::IconButtonSize::Small,
            InputWrapperSize::Medium => crate::basic::IconButtonSize::Medium,
            InputWrapperSize::Large => crate::basic::IconButtonSize::Large,
        }
    }
}

/// Wrapper item - can be icon button or pure icon display
#[derive(Clone, PartialEq)]
pub enum InputWrapperItem {
    /// Interactive icon button
    Button {
        icon: MdiIcon,
        onclick: EventHandler<MouseEvent>,
        disabled: bool,
    },
    /// Pure icon display (decorative, always disabled)
    Icon {
        icon: MdiIcon,
    },
}

impl InputWrapperItem {
    /// Create a button item
    pub fn button(icon: MdiIcon, onclick: EventHandler<MouseEvent>) -> Self {
        Self::Button {
            icon,
            onclick,
            disabled: false,
        }
    }

    /// Create a disabled button item
    pub fn button_disabled(icon: MdiIcon) -> Self {
        Self::Button {
            icon,
            onclick: EventHandler::new(|_| {}),
            disabled: true,
        }
    }

    /// Create a pure icon display item
    pub fn icon(icon: MdiIcon) -> Self {
        Self::Icon { icon }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct InputWrapperProps {
    /// Left side items (icon buttons or pure icons)
    #[props(default)]
    pub left: Vec<InputWrapperItem>,

    /// Right side items (icon buttons or pure icons)
    #[props(default)]
    pub right: Vec<InputWrapperItem>,

    /// Main input element
    pub input: Element,

    #[props(default)]
    pub size: InputWrapperSize,

    #[props(default = false)]
    pub disabled: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub style: String,

    /// Enable glow effect on wrapper
    #[props(default = true)]
    pub glow: bool,

    /// Glow blur intensity
    #[props(default)]
    pub glow_blur: GlowBlur,

    /// Glow intensity
    #[props(default)]
    pub glow_intensity: GlowIntensity,

    /// Glow color mode
    #[props(default)]
    pub glow_color: GlowColor,
}

/// Generic input wrapper for consistent layout
///
/// Layout structure:
/// ```
/// [Left Items] [Input Field] [Right Items]
/// ```
///
/// # Design Guidelines
///
/// ## Icon Usage
/// - All icons must use `InputWrapperItem::Button` or `InputWrapperItem::Icon`
/// - Pure icon display (`Icon`) is always disabled with default glow
/// - Interactive buttons use `Button` with onclick handler
///
/// ## Layout Rules
/// - Items are arranged horizontally with 4px gap
/// - All items are vertically centered
/// - Input field takes remaining space
///
/// ## Size Mapping
/// | Wrapper Size | Icon Button Size | Container Height |
/// |--------------|------------------|------------------|
/// | Small        | 24px             | 32px             |
/// | Medium       | 32px             | 40px             |
/// | Large        | 40px             | 48px             |
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{InputWrapper, InputWrapperItem};
/// use icons::MdiIcon;
///
/// fn app() -> Element {
///     rsx! {
///         InputWrapper {
///             left: vec![
///                 // Pure icon display (decorative)
///                 InputWrapperItem::icon(MdiIcon::Magnify)
///             ],
///             right: vec![
///                 // Interactive button
///                 InputWrapperItem::button(
///                     MdiIcon::Close,
///                     EventHandler::new(|_| println!("Clear"))
///                 )
///             ],
///             input: rsx! { input { value: "Search..." } },
///         }
///     }
/// }
/// ```
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
            InputWrapperItem::Button { icon, onclick, disabled } => {
                rsx! {
                    IconButton {
                        icon: *icon,
                        size: icon_button_size,
                        variant: crate::basic::IconButtonVariant::Ghost,
                        disabled: *disabled || props.disabled,
                        glow: true,
                        glow_intensity: GlowIntensity::Soft,
                        glow_blur: GlowBlur::None,
                        glow_color: GlowColor::Ghost,
                        onclick: onclick.clone(),
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
                        onclick: EventHandler::new(|_| {}),
                    }
                }
            }
        }
    };

    let content = rsx! {
        div {
            class: "{wrapper_classes}",
            style: "{props.style}",

            // Left section
            if !props.left.is_empty() {
                div {
                    class: "{InputWrapperClass::LeftSection.as_class()}",
                    for (i, item) in props.left.iter().enumerate() {
                        div {
                            key: "{i}",
                            class: "{InputWrapperClass::SideItem.as_class()}",
                            { render_item(item) }
                        }
                    }
                }
            }

            // Input section
            div {
                class: "{InputWrapperClass::InputSection.as_class()}",
                { props.input }
            }

            // Right section
            if !props.right.is_empty() {
                div {
                    class: "{InputWrapperClass::RightSection.as_class()}",
                    for (i, item) in props.right.iter().enumerate() {
                        div {
                            key: "{i}",
                            class: "{InputWrapperClass::SideItem.as_class()}",
                            { render_item(item) }
                        }
                    }
                }
            }
        }
    };

    // Wrap with glow if enabled
    if props.glow {
        rsx! {
            crate::feedback::Glow {
                blur: props.glow_blur,
                color: props.glow_color,
                intensity: props.glow_intensity,
                { content }
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
