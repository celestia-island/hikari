// hikari-components/src/navigation/menu.rs
// Menu component with Arknights + FUI styling

use dioxus::prelude::*;

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

/// Menu component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::Menu;
///
/// fn app() -> Element {
///     rsx! {
///         Menu {
///             mode: MenuMode::Vertical,
///             MenuItem { item_key: "1", "Item 1" }
///             MenuItem { item_key: "2", "Item 2" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Menu(props: MenuProps) -> Element {
    let _active_key = use_signal(|| props.default_active.clone());
    let mut _open_submenus = use_signal(Vec::<String>::new);

    let mode_class = match props.mode {
        MenuMode::Vertical => "hikari-menu-vertical",
        MenuMode::Horizontal => "hikari-menu-horizontal",
    };
    let inline_class = if props.inline {
        "hikari-menu-inline"
    } else {
        ""
    };

    rsx! {
        ul {
            class: format!("hikari-menu {mode_class} {inline_class} {}", props.class),
            role: "menu",

            { props.children }
        }
    }
}

/// Menu item component
#[component]
pub fn MenuItem(props: MenuItemProps) -> Element {
    rsx! {
        li {
            class: format!("hikari-menu-item {}", props.class),
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
                span { class: "hikari-menu-item-icon", { icon } }
            }

            span { class: "hikari-menu-item-content", { props.children } }
        }
    }
}

/// Submenu component with nested items
#[component]
pub fn SubMenu(props: SubMenuProps) -> Element {
    let mut is_open = use_signal(|| false);

    rsx! {
        li {
            class: format!("hikari-menu-submenu {}", props.class),
            role: "none",
            "data-key": "{props.item_key}",

            div {
                class: "hikari-menu-submenu-title",
                aria_disabled: props.disabled.to_string(),
                onclick: move |_| {
                    if !props.disabled {
                        is_open.set(!is_open());
                    }
                },

                if let Some(icon) = props.icon {
                    span { class: "hikari-menu-item-icon", { icon } }
                }

                span { class: "hikari-menu-item-content", "{props.title}" }

                span {
                    class: format!("hikari-menu-submenu-arrow {}", if is_open() { "open" } else { "" }),
                    "›"
                }
            }

            ul {
                class: format!("hikari-menu-submenu-list {}", if is_open() { "open" } else { "" }),
                role: "menu",
                "aria-hidden": "{!is_open()}",

                { props.children }
            }
        }
    }
}
