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

#[define_props]
pub struct TabPaneProps {
    pub item_key: String,

    pub tab: String,

    #[default(false)]
    pub disabled: bool,

    pub icon: Option<Element>,

    pub children: Element,

    pub class: String,
}

#[define_props]
pub struct TabsProps {
    pub default_active: String,

    pub tab_position: TabPosition,

    #[default(true)]
    pub animated: bool,

    pub class: String,

    pub children: Element,

    pub on_change: Option<EventHandler<String>>,
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
    let item_key = props.item_key.clone();
    let is_active = active_key.get().get() == item_key;

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
            "data-key": item_key.clone(),
            "aria-selected": is_active,
            "aria-disabled": props.disabled,

            if let Some(icon) = props.icon {
                span { class: "hi-tabs-tab-icon", {icon} }
            }

            span { class: "hi-tabs-tab-label", "{props.tab}" }
        }
    };

    let tabpane_el = rsx! {
        div {
            class: tabpane_classes,
            role: "tabpanel",
            "data-key": item_key,
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
