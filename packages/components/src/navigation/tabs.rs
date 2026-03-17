// hi-components/src/navigation/tabs.rs
// Tabs component with Arknights + FUI styling

use crate::prelude::*;

use crate::styled::StyledComponent;

pub struct TabsComponent;
#[derive(Clone, Copy, PartialEq, Eq, Default, Debug)]
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
///
///
///
///
///
///
#[component]
pub fn Tabs(props: TabsProps) -> Element {
    // Create and provide the active key signal for child TabPane components
    let active_key = use_signal(|| props.default_active.clone());
    use_context_provider(|| active_key);

    let position_class = match props.tab_position {
        TabPosition::Top => "hi-tabs-top",
        TabPosition::Right => "hi-tabs-right",
        TabPosition::Bottom => "hi-tabs-bottom",
        TabPosition::Left => "hi-tabs-left",
    };

    let animated_class = if props.animated {
        "hi-tabs-animated"
    } else {
        ""
    };

    rsx! {
        div {
            class: format!("hi-tabs {position_class} {animated_class} {}", props.class),

            div {
                class: "hi-tabs-nav",

                div {
                    class: "hi-tabs-nav-list",
                    role: "tablist",

                    { props.children.clone() }
                }

                div {
                    class: "hi-tabs-ink-bar",
                    style: "transform: translateX(...)",
                }
            }

            div {
                class: "hi-tabs-content",
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

#[component]
pub fn TabPane(props: TabPaneProps) -> Element {
    use hikari_palette::classes::{ClassesBuilder, components::TabsClass};

    let active_key = use_context::<Signal<String>>().expect("TabsContext not found");
    let is_active = active_key.get() == props.item_key;

    let tab_classes = ClassesBuilder::new()
        .add(TabsClass::TabsTab)
        .add_if(TabsClass::TabActive, || is_active)
        .add_if(TabsClass::TabDisabled, || props.disabled)
        .build();

    let tabpane_classes = ClassesBuilder::new()
        .add(TabsClass::TabsTabpane)
        .add_if(TabsClass::TabpaneActive, || is_active)
        .add_if(TabsClass::TabpaneInactive, || !is_active)
        .build();

    let aria_hidden_val = (!is_active).to_string();

    // Tab and TabPane need to be rendered together
    let tab_el = rsx! {
        div {
            class: tab_classes,
            role: "tab",
            "data-key": props.item_key,
            "aria-selected": is_active,
            "aria-disabled": props.disabled,

            if let Some(icon) = props.icon {
                span { class: "hi-tabs-tab-icon", icon }
            }

            span { class: "hi-tabs-tab-label", "{props.tab}" }
        }
    };

    let tabpane_el = rsx! {
        div {
            class: tabpane_classes,
            role: "tabpanel",
            "data-key": props.item_key,
            "aria-hidden": aria_hidden_val,

            {if is_active {
                props.children
            } else {
                VNode::empty()
            }}
        }
    };

    VNode::Fragment(vec![tab_el, tabpane_el])
}
