// hikari-components/src/navigation/tabs.rs
// Tabs component with Arknights + FUI styling

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Tabs 组件的类型包装器（用于实现 StyledComponent）
pub struct TabsComponent;

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TabPosition {
    #[default]
    Top,
    Right,
    Bottom,
    Left,
}

#[derive(Clone, PartialEq, Props)]
pub struct TabPaneProps {
    #[props(default)]
    pub item_key: String,

    #[props(default)]
    pub tab: String,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,
}

impl Default for TabPaneProps {
    fn default() -> Self {
        Self {
            item_key: String::default(),
            tab: String::default(),
            disabled: false,
            icon: None,
            children: VNode::empty(),
            class: String::default(),
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct TabsProps {
    #[props(default)]
    pub default_active: String,

    #[props(default)]
    pub tab_position: TabPosition,

    #[props(default)]
    pub animated: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub children: Element,

    pub on_change: Option<EventHandler<String>>,
}

impl Default for TabsProps {
    fn default() -> Self {
        Self {
            default_active: String::default(),
            tab_position: Default::default(),
            animated: true,
            class: String::default(),
            children: VNode::empty(),
            on_change: None,
        }
    }
}

/// Tabs component with Arknights + FUI styling
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_components::{Tabs, TabPane};
///
/// fn app() -> Element {
///     rsx! {
///         Tabs {
///             default_active: "1",
///             TabPane { item_key: "1".to_string(), tab: "Tab 1", "Content 1" }
///             TabPane { item_key: "2".to_string(), tab: "Tab 2", "Content 2" }
///         }
///     }
/// }
/// ```
#[component]
pub fn Tabs(props: TabsProps) -> Element {
    let _active_key = use_signal(|| props.default_active.clone());
    let _tabs = use_context::<Signal<Vec<Vec<String>>>>();

    let position_class = match props.tab_position {
        TabPosition::Top => "hikari-tabs-top",
        TabPosition::Right => "hikari-tabs-right",
        TabPosition::Bottom => "hikari-tabs-bottom",
        TabPosition::Left => "hikari-tabs-left",
    };

    let animated_class = if props.animated {
        "hikari-tabs-animated"
    } else {
        ""
    };

    rsx! {
        div {
            class: format!("hikari-tabs {position_class} {animated_class} {}", props.class),

            div {
                class: "hikari-tabs-nav",

                div {
                    class: "hikari-tabs-nav-list",
                    role: "tablist",

                    { props.children.clone() }
                }

                div {
                    class: "hikari-tabs-ink-bar",
                    style: "transform: translateX(...)",
                }
            }

            div {
                class: "hikari-tabs-content",
                role: "tabpanel",

                { props.children }
            }
        }
    }
}

impl StyledComponent for TabsComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/tabs.css"))
    }

    fn name() -> &'static str {
        "tabs"
    }
}

/// Tab pane component
#[component]
pub fn TabPane(props: TabPaneProps) -> Element {
    let active_key = use_context::<Signal<String>>();
    let is_active = active_key() == props.item_key;

    rsx! {
        div {
            class: format!(
                "hikari-tabs-tab {} {}",
                if is_active { "hikari-tabs-tab-active" } else { "" },
                if props.disabled { "hikari-tabs-tab-disabled" } else { "" }
            ),
            role: "tab",
            "data-key": "{props.item_key}",
            "aria-selected": "{is_active}",
            "aria-disabled": "{props.disabled}",

            if let Some(icon) = props.icon {
                span { class: "hikari-tabs-tab-icon", { icon } }
            }

            span { class: "hikari-tabs-tab-label", "{props.tab}" }
        }

        div {
            class: format!(
                "hikari-tabs-tabpane {}",
                if is_active { "hikari-tabs-tabpane-active" } else { "hikari-tabs-tabpane-inactive" }
            ),
            role: "tabpanel",
            "data-key": "{props.item_key}",
            "aria-hidden": "{!is_active}",

            if is_active {
                { props.children }
            }
        }
    }
}
