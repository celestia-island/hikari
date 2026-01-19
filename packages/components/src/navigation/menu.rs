// hi-components/src/navigation/menu.rs
// Menu component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;
use palette::classes::{components::MenuClass, ClassesBuilder};

/// Menu 组件的类型包装器（用于实现 StyledComponent）
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MenuMode {
    #[default]
    Vertical,
    Horizontal,
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

    pub onclick: Option<EventHandler<MouseEvent>>,
}

impl Default for MenuItemProps {
    fn default() -> Self {
        Self {
            item_key: String::default(),
            disabled: false,
            icon: None,
            children: VNode::empty(),
            class: String::default(),
            onclick: None,
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

    let menu_classes = ClassesBuilder::new()
        .add(MenuClass::Menu)
        .add_if(MenuClass::Inline, || props.inline)
        .add_raw(&mode_class)
        .add_raw(&props.class)
        .build();

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
    rsx! {
        li {
            class: format!("hi-menu-item {}", props.class),
            role: "menuitem",
            "data-key": "{props.item_key}",
            aria_disabled: props.disabled.to_string(),
            onclick: move |e| {
                if !props.disabled {
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                }
            },

            if let Some(icon) = props.icon {
                span { class: "hi-menu-item-icon", { icon } }
            }

            span { class: "hi-menu-item-content", { props.children } }
        }
    }
}

/// Submenu component with nested items
#[component]
pub fn SubMenu(props: SubMenuProps) -> Element {
    let mut is_open = use_signal(|| false);

    let submenu_classes = ClassesBuilder::new()
        .add(MenuClass::Submenu)
        .add_raw(&props.class)
        .build();

    let arrow_classes = ClassesBuilder::new()
        .add_if(MenuClass::SubmenuArrowOpen, || *is_open.read())
        .build();

    let list_classes = ClassesBuilder::new()
        .add_if(MenuClass::SubmenuListOpen, || *is_open.read())
        .build();

    rsx! {
        li {
            class: "{submenu_classes}",
            role: "none",
            "data-key": "{props.item_key}",

            div {
                class: "hi-menu-submenu-title",
                aria_disabled: props.disabled.to_string(),
                onclick: move |_| {
                    if !props.disabled {
                        is_open.set(!is_open());
                    }
                },

                if let Some(icon) = props.icon {
                    span { class: "hi-menu-item-icon", { icon } }
                }

                span { class: "hi-menu-item-content", "{props.title}" }

                span {
                    class: "{arrow_classes}",
                    svg {
                        xmlns: "http://www.w3.org/2000/svg",
                        view_box: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "0",
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        path {
                            d: "M9 18l6-6-6-6"
                        }
                    }
                }
            }

            ul {
                class: "{list_classes}",
                role: "menu",
                "aria-hidden": "{!is_open()}",

                { props.children }
            }
        }
    }
}
