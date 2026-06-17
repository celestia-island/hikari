// hi-components/src/navigation/tabs.rs
// Tabs component

use hikari_palette::classes::components::TabsClass;
use hikari_palette::classes::{ClassesBuilder, TypedClass};
use tairitsu_hooks::ReactiveSignal;

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

#[derive(Debug, Clone, PartialEq)]
pub struct TabInfo {
    pub key: String,
    pub label: String,
    pub disabled: bool,
    pub icon: Option<Element>,
}

#[derive(Clone)]
pub struct TabsContext {
    pub active_key: ReactiveSignal<String>,
    pub on_change: Option<EventHandler<String>>,
    pub tab_keys: ReactiveSignal<Vec<String>>,
    pub tab_data: ReactiveSignal<Vec<TabInfo>>,
}

#[component]
pub fn Tabs(props: TabsProps) -> Element {
    let active_key = use_signal(|| props.default_active.clone());
    let on_change = props.on_change.clone();
    let on_change_for_ctx = on_change.clone();

    let tab_data_signal = use_signal(Vec::<TabInfo>::new);
    let tab_data_for_ctx = tab_data_signal.clone();
    let active_key_for_ctx = active_key.clone();
    let tab_keys_signal = use_signal(Vec::<String>::new);
    use_context_provider(move || TabsContext {
        active_key: active_key_for_ctx,
        on_change: on_change_for_ctx,
        tab_keys: tab_keys_signal,
        tab_data: tab_data_for_ctx,
    });

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

    let ak = active_key.read();
    let data = tab_data_signal.read();
    let mut nav_headers: Vec<Element> = Vec::with_capacity(data.len());
    for info in data.iter() {
        let is_active = *ak == info.key;
        let tabindex_val = if is_active { "0" } else { "-1" };

        let tab_classes = ClassesBuilder::new()
            .add_typed(TabsClass::TabsTab)
            .add_typed_if(TabsClass::TabActive, is_active)
            .add_typed_if(TabsClass::TabDisabled, info.disabled)
            .build();

        let key = info.key.clone();
        let is_disabled = info.disabled;
        let icon = info.icon.clone();
        let label = info.label.clone();
        let ak_clone = active_key.clone();
        let oc = on_change.clone();
        let onclick_handler = move |_| {
            if !is_disabled {
                ak_clone.set(key.clone());
                if let Some(ref handler) = oc {
                    handler.call(key.clone());
                }
            }
        };

        let tab_icon_class = TabsClass::TabsTabIcon.class_name();
        let tab_label_class = TabsClass::TabsTabLabel.class_name();

        nav_headers.push(rsx! {
            div {
                class: tab_classes,
                role: "tab",
                "data-key": info.key.clone(),
                "aria-selected": is_active,
                "aria-disabled": info.disabled,
                tabindex: tabindex_val,
                onclick: onclick_handler,
                if let Some(ic) = icon {
                    span { class: tab_icon_class, {ic} }
                }
                span { class: tab_label_class, "{label}" }
            }
        });
    }
    let ink_bar_style = match data.iter().position(|t| *ak == t.key) {
        Some(i) => format!("transform: translateX({}px)", i as f64 * 100.0),
        None => "display: none".to_string(),
    };
    drop(data);
    drop(ak);

    rsx! {
        div { class: format!("hi-tabs {position_class} {animated_class} {}", props.class),
            div { class: "hi-tabs-nav",
                div { class: "hi-tabs-nav-list", role: "tablist", {VNode::Fragment(nav_headers)} }
                div { class: "hi-tabs-ink-bar", style: ink_bar_style }
            }
            div { class: "hi-tabs-content", role: "tabpanel", {props.children} }
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
    let Some(ctx) = use_context::<TabsContext>() else {
        return tairitsu_vdom::empty_vnode();
    };
    let ctx = ctx.get();

    let item_key = props.item_key.clone();
    let is_active = {
        let ak = ctx.active_key.read();
        *ak == item_key
    };

    // Register tab in context on mount
    let info = TabInfo {
        key: item_key.clone(),
        label: props.tab.clone(),
        disabled: props.disabled,
        icon: props.icon.clone(),
    };
    let tab_data = ctx.tab_data.clone();
    use_effect(move || {
        let mut data = tab_data.write();
        if !data.iter().any(|t| t.key == info.key) {
            data.push(info.clone());
        }
    });

    let tabpane_classes = ClassesBuilder::new()
        .add_typed(TabsClass::TabsTabpane)
        .add_typed_if(TabsClass::TabpaneActive, is_active)
        .add_typed_if(TabsClass::TabpaneInactive, !is_active)
        .build();

    rsx! {
        div {
            class: tabpane_classes,
            role: "tabpanel",
            "data-key": props.item_key.clone(),
            "aria-hidden": (!is_active).to_string(),
            {if is_active { props.children } else { VNode::empty() }}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::styled::StyledComponent;

    #[test]
    fn test_tab_position_default() {
        assert_eq!(TabPosition::default(), TabPosition::Top);
    }

    #[test]
    fn test_tab_position_distinct() {
        let positions = [
            TabPosition::Top,
            TabPosition::Right,
            TabPosition::Bottom,
            TabPosition::Left,
        ];
        for (i, a) in positions.iter().enumerate() {
            for (j, b) in positions.iter().enumerate() {
                if i != j {
                    assert_ne!(a, b);
                }
            }
        }
    }

    #[test]
    fn test_tabs_component_name() {
        assert_eq!(TabsComponent::name(), "tabs");
    }

    #[test]
    fn test_tab_info_defaults() {
        let info = TabInfo {
            key: "test".to_string(),
            label: "Test".to_string(),
            disabled: false,
            icon: None,
        };
        assert_eq!(info.key, "test");
        assert_eq!(info.label, "Test");
        assert!(!info.disabled);
        assert!(info.icon.is_none());
    }

    #[test]
    fn test_tab_info_clone() {
        let info = TabInfo {
            key: "k1".to_string(),
            label: "Tab 1".to_string(),
            disabled: true,
            icon: None,
        };
        let cloned = info.clone();
        assert_eq!(cloned.key, "k1");
        assert_eq!(cloned.label, "Tab 1");
        assert!(cloned.disabled);
    }

    #[test]
    fn test_tab_info_equality_by_key() {
        let a = TabInfo {
            key: "x".to_string(),
            label: "X".to_string(),
            disabled: false,
            icon: None,
        };
        let b = TabInfo {
            key: "x".to_string(),
            label: "Y".to_string(),
            disabled: true,
            icon: None,
        };
        // TabInfo uses derived PartialEq which compares ALL fields
        assert_ne!(a, b);
    }
}
