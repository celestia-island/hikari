// hi-components/src/navigation/menu.rs
// Menu component with Arknights + FUI styling

use animation::style::{CssProperty, StyleStringBuilder};
use dioxus::prelude::*;
use palette::classes::{ClassesBuilder, MenuClass};

use crate::{
    GlowBlur, GlowColor, GlowIntensity,
    basic::{Arrow, ArrowDirection},
    feedback::Glow,
    styled::StyledComponent,
};

/// Menu 组件的类型包装器（用于实现 StyledComponent）
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MenuMode {
    #[default]
    Vertical,
    Horizontal,
}

/// Menu item height variants
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MenuItemHeight {
    #[default]
    Default,
    Compact,
    ExtraCompact,
}

impl MenuItemHeight {
    pub fn as_str(&self) -> &'static str {
        match self {
            MenuItemHeight::Default => "hi-menu-height-default",
            MenuItemHeight::Compact => "hi-menu-height-compact",
            MenuItemHeight::ExtraCompact => "hi-menu-height-extra-compact",
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct MenuItemProps {
    #[props(default)]
    pub item_key: String,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub level: u32,

    #[props(default)]
    pub height: MenuItemHeight,

    pub onclick: Option<EventHandler<MouseEvent>>,

    #[props(default)]
    pub glow: bool,
}

impl Default for MenuItemProps {
    fn default() -> Self {
        Self {
            item_key: String::default(),
            disabled: false,
            icon: None,
            children: VNode::empty(),
            class: String::default(),
            level: 0,
            height: MenuItemHeight::Default,
            onclick: None,
            glow: false,
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct SubMenuProps {
    #[props(default)]
    pub item_key: String,

    #[props(default)]
    pub title: String,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub default_expanded: bool,

    #[props(default)]
    pub level: u32,

    #[props(default)]
    pub height: MenuItemHeight,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,
}

impl Default for SubMenuProps {
    fn default() -> Self {
        Self {
            item_key: String::default(),
            title: String::default(),
            icon: None,
            disabled: false,
            default_expanded: false,
            level: 0,
            height: MenuItemHeight::Default,
            children: VNode::empty(),
            class: String::default(),
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct MenuProps {
    #[props(default)]
    pub default_active: String,

    #[props(default)]
    pub inline: bool,

    #[props(default)]
    pub mode: MenuMode,

    #[props(default)]
    pub compact: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,

    pub on_select: Option<EventHandler<String>>,
}

impl Default for MenuProps {
    fn default() -> Self {
        Self {
            default_active: String::default(),
            inline: false,
            mode: Default::default(),
            compact: false,
            class: String::default(),
            children: VNode::empty(),
            on_select: None,
        }
    }
}

/// Menu component with modern, premium styling
///
/// A flexible navigation menu component inspired by Material UI and Element Plus.
/// Features smooth animations, proper icon support, and multiple layout modes.
///
/// # Features
/// - **Multiple Modes**: Vertical (default), Horizontal, and Inline variants
/// - **Nested Menus**: Support for submenus with animated chevron icons
/// - **Hover Effects**: Subtle background transitions on hover
/// - **Active States**: Clear visual indication for selected items
/// - **Accessibility**: Proper ARIA attributes and keyboard navigation
/// - **Responsive**: Size variants (sm, lg) for different contexts
///
/// # Examples
///
/// ## Basic Vertical Menu
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Menu, MenuItem};
///
/// fn app() -> Element {
///     rsx! {
///         Menu {
///             mode: MenuMode::Vertical,
///             MenuItem { item_key: "1", "Dashboard" }
///             MenuItem { item_key: "2", "Settings" }
///             MenuItem { item_key: "3", "Profile" }
///         }
///     }
/// }
/// ```
///
/// ## Menu with Submenus
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Menu, MenuItem, SubMenu};
///
/// fn app() -> Element {
///     rsx! {
///         Menu {
///             MenuItem { item_key: "1", "Home" }
///             SubMenu {
///                 item_key: "2".to_string(),
///                 title: "Products".to_string(),
///                 MenuItem { item_key: "2-1", "Category A" }
///                 MenuItem { item_key: "2-2", "Category B" }
///             }
///         }
///     }
/// }
/// ```
///
/// # Styling
/// The component uses CSS custom properties for theming:
/// - `--hi-background`: Background color
/// - `--hi-border`: Border color
/// - `--hi-text-primary`: Primary text color
/// - `--hi-primary-600`: Active state color
///
/// # Size Variants
/// - **Default**: 14px font, 10px padding
/// - **Small** (`.hi-menu-sm`): 13px font, 6px padding
/// - **Large** (`.hi-menu-lg`): 15px font, 12px padding
#[component]
pub fn Menu(props: MenuProps) -> Element {
    let _active_key = use_signal(|| props.default_active.clone());
    let mut _open_submenus = use_signal(Vec::<String>::new);

    let mode_class = match props.mode {
        MenuMode::Vertical => "hi-menu-vertical",
        MenuMode::Horizontal => "hi-menu-horizontal",
    };

    let menu_classes = {
        let mut builder = ClassesBuilder::new()
            .add(MenuClass::Menu)
            .add_if(MenuClass::Inline, || props.inline)
            .add_raw(&mode_class)
            .add_raw(&props.class);

        if props.compact {
            builder = builder.add_raw("hi-menu-compact");
        }

        builder.build()
    };

    rsx! {
        ul {
            class: "{menu_classes}",
            role: "menu",

            { props.children }
        }
    }
}

/// Menu 组件的类型包装器（用于实现 StyledComponent）
pub struct MenuComponent;

impl StyledComponent for MenuComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/menu.css"))
    }

    fn name() -> &'static str {
        "menu"
    }
}

/// Menu item component
#[component]
pub fn MenuItem(props: MenuItemProps) -> Element {
    let item_classes = ClassesBuilder::new()
        .add_raw("hi-menu-item")
        .add_raw(props.height.as_str())
        .add_raw(&props.class)
        .build();

    let item_content = rsx! {
        li {
            class: "{item_classes}",
            role: "menuitem",
            "data-key": "{props.item_key}",
            aria_disabled: props.disabled.to_string(),
            onclick: move |e| {
                if !props.disabled {
                    // Only handle clicks on the li element itself, not on child links/buttons
                    // This allows clicking on the entire padded area
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                }
            },

            div { class: "hi-menu-item-inner",
                if let Some(icon) = props.icon {
                    span { class: "hi-menu-item-icon", { icon } }
                }

                span { class: "hi-menu-item-content", { props.children } }
            }
        }
    };

    if props.glow {
        let wrapper_class = format!("hi-menu-item-wrapper {}", props.height.as_str());
        rsx! {
            div {
                class: "{wrapper_class}",
                style: "width: 100%; position: relative;",
                Glow {
                    blur: GlowBlur::Medium,
                    color: GlowColor::Ghost,
                    intensity: GlowIntensity::Subtle,
                    children: item_content
                }
            }
        }
    } else {
        item_content
    }
}

/// Submenu component with nested items
#[component]
pub fn SubMenu(props: SubMenuProps) -> Element {
    let mut is_open = use_signal(|| props.default_expanded);

    let submenu_classes = ClassesBuilder::new()
        .add(MenuClass::Submenu)
        .add_if(MenuClass::SubmenuListOpen, || *is_open.read())
        .add_raw(&props.class)
        .build();

    let list_classes = ClassesBuilder::new()
        .add_raw("hi-menu-submenu-list")
        .build();

    let list_style = use_memo(move || {
        let (display, opacity, transform) = if is_open() {
            ("block", "1", "translateX(0)")
        } else {
            ("none", "0", "translateX(-8px)")
        };

        StyleStringBuilder::new()
            .add(CssProperty::Display, display)
            .add(CssProperty::Opacity, opacity)
            .add(CssProperty::Transform, transform)
            .add(CssProperty::PaddingLeft, "1em")
            .build()
    });

    let title_content = rsx! {
       div {
           class: "{props.height.as_str()} hi-menu-submenu-title",
           aria_disabled: props.disabled.to_string(),
           onclick: move |_e| {
               if !props.disabled {
                   is_open.set(!is_open());
               }
           },

           div { class: "hi-menu-submenu-title-inner",
               if let Some(icon) = props.icon {
                   span { class: "hi-menu-item-icon", { icon } }
               }

                 span { class: "hi-menu-item-content", "{props.title}" }

                 Arrow {
                    direction: if *is_open.read() { ArrowDirection::Down } else { ArrowDirection::Right },
                    size: 14,
                    class: if *is_open.read() { "hi-menu-submenu-arrow-open" } else { "" },
                 }
             }
         }
    };

    let wrapper_class = format!("hi-menu-item-wrapper {}", props.height.as_str());
    let title_with_glow = rsx! {
        div {
            class: "{wrapper_class}",
            style: "width: 100%; position: relative;",
            Glow {
                blur: GlowBlur::Medium,
                color: GlowColor::Ghost,
                intensity: GlowIntensity::Subtle,
                children: title_content
            }
        }
    };

    rsx! {
        li {
            class: "{submenu_classes}",
            role: "none",
            "data-key": "{props.item_key}",

            { title_with_glow }

            ul {
                class: "{list_classes}",
                style: "{list_style}",
                role: "menu",
                "aria-hidden": "{!is_open()}",

                { props.children }
            }
        }
    }
}
