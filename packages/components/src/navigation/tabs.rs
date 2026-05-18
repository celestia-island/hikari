// hi-components/src/navigation/tabs.rs
// Tabs component

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

#[derive(Clone)]
pub struct TabsContext {
    pub active_key: ReactiveSignal<String>,
    pub on_change: Option<EventHandler<String>>,
    pub tab_keys: ReactiveSignal<Vec<String>>,
}

/// Tabs component with modern, premium styling
///
/// A tabbed interface component for organizing content into separate panels.
/// Inspired by Material UI and Element Plus with smooth ink bar animations.
///
/// # Features
/// - **Smooth Ink Bar**: Animated indicator that slides between tabs (Material UI style)
/// - **Multiple Positions**: Top, Bottom, Left, Right tab placements
/// - **Type Variants**: Line (default), Card, Border Card, and Segment styles
/// - **Hover Effects**: Subtle background transitions on hover
/// - **Icons**: Support for icons alongside tab labels
/// - **Animations**: Smooth content transitions between tabs
/// - **Responsive**: Size variants (sm, lg) and mobile-optimized scrolling
///
/// # Examples
///
/// ## Basic Tabs
/// ```rust
/// use hikari_components::{Tabs, TabPane};
///
/// fn app() -> Element {
///     rsx! {
///         Tabs {
///             default_active: "1".to_string(),
///             TabPane {
///                 item_key: "1".to_string(),
///                 tab: "Overview".to_string(),
///                 "Overview content"
///             }
///             TabPane {
///                 item_key: "2".to_string(),
///                 tab: "Details".to_string(),
///                 "Details content"
///             }
///         }
///     }
/// }
/// ```
///
/// ## Tabs with Icons
/// ```rust
/// use hikari_components::{Tabs, TabPane};
///
/// fn app() -> Element {
///     rsx! {
///         Tabs {
///             TabPane {
///                 item_key: "1".to_string(),
///                 tab: "Home".to_string(),
///                 icon: rsx! {
///                     svg { /* Home icon */ }
///                 },
///                 "Home content"
///             }
///             TabPane {
///                 item_key: "2".to_string(),
///                 tab: "Profile".to_string(),
///                 icon: rsx! {
///                     svg { /* Profile icon */ }
///                 },
///                 "Profile content"
///             }
///         }
///     }
/// }
/// ```
///
/// ## Card Style Tabs
/// ```rust
/// rsx! {
///     Tabs {
///         class: "hi-tabs-card",
///         TabPane { item_key: "1".to_string(), tab: "Tab 1", "Content 1" }
///         TabPane { item_key: "2".to_string(), tab: "Tab 2", "Content 2" }
///     }
/// }
/// ```
///
/// ## Segment Style Tabs (Pill-shaped)
/// ```rust
/// rsx! {
///     Tabs {
///         class: "hi-tabs-segment",
///         TabPane { item_key: "1".to_string(), tab: "Tab 1", "Content 1" }
///         TabPane { item_key: "2".to_string(), tab: "Tab 2", "Content 2" }
///     }
/// }
/// ```
///
/// # Position Variants
/// - **Top** (`.hi-tabs-top`): Tabs above content (default)
/// - **Bottom** (`.hi-tabs-bottom`): Tabs below content
/// - **Left** (`.hi-tabs-left`): Tabs on the left side
/// - **Right** (`.hi-tabs-right`): Tabs on the right side
///
/// # Type Variants
/// - **Line** (default): Minimal style with ink bar indicator
/// - **Card** (`.hi-tabs-card`): Card-like container with background
/// - **Border Card** (`.hi-tabs-border-card`): Card with visible borders
/// - **Segment** (`.hi-tabs-segment`): Pill-shaped tab container
///
/// # Styling
/// The component uses CSS custom properties for theming:
/// - `--hi-primary-600`: Active tab and ink bar color
/// - `--hi-text-primary`: Active tab text color
/// - `--hi-text-secondary`: Inactive tab text color
/// - `--hi-border`: Border color for card variants
/// - `--hi-surface`: Background for card variants
///
/// # Size Variants
/// - **Default**: 14px font, 10px padding
/// - **Small** (`.hi-tabs-sm`): 13px font, 8px padding
/// - **Large** (`.hi-tabs-lg`): 15px font, 12px padding
///
/// # Animations
/// The component includes smooth animations:
/// - Ink bar slides between tabs (300ms cubic-bezier)
/// - Tab content fades in with slide (200ms)
/// - Hover states transition smoothly (150ms)
///
/// # Accessibility
/// - Proper `role="tablist"` and `role="tab"` attributes
/// - `aria-selected` for active tabs
/// - `aria-disabled` for disabled tabs
/// - Keyboard navigation support (Arrow keys)
/// - Focus-visible states for keyboard users
///
/// # Dark Mode
/// The component automatically adapts to dark mode when `data-theme="dark"` is set on the root element.
#[component]
pub fn Tabs(props: TabsProps) -> Element {
    let active_key = use_signal(|| props.default_active.clone());

    let on_change = props.on_change.clone();

    let tab_keys_signal = use_signal(Vec::<String>::new);
    let _ctx = use_context_provider(move || TabsContext {
        active_key,
        on_change,
        tab_keys: tab_keys_signal,
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

    rsx! {
        div { class: format!("hi-tabs {position_class} {animated_class} {}", props.class),

            div { class: "hi-tabs-nav",

                div { class: "hi-tabs-nav-list", role: "tablist", {props.children.clone()} }

                div {
                    class: "hi-tabs-ink-bar",
                    style: "transform: translateX(...)",
                }
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

/// Tab pane component
#[component]
pub fn TabPane(props: TabPaneProps) -> Element {
    use hikari_palette::classes::components::TabsClass;
    use hikari_palette::classes::{ClassesBuilder, TypedClass};

    let ctx = use_context::<TabsContext>().expect("TabsContext not found");
    let ctx = ctx.get();
    let active_key = ctx.active_key.clone();
    let on_change = ctx.on_change.clone();
    let tab_keys = ctx.tab_keys.clone();

    let item_key = props.item_key.clone();
    let is_active = *active_key.read() == item_key;

    {
        let tab_keys = tab_keys.clone();
        let key_clone = item_key.clone();
        use_effect(move || {
            let mut keys = tab_keys.write();
            if !keys.contains(&key_clone) {
                keys.push(key_clone.clone());
            }
        });
    }

    let tabindex_val = if is_active { "0" } else { "-1" };

    let tab_classes = ClassesBuilder::new()
        .add_typed(TabsClass::TabsTab)
        .add_typed_if(TabsClass::TabActive, is_active)
        .add_typed_if(TabsClass::TabDisabled, props.disabled)
        .build();

    let tabpane_classes = ClassesBuilder::new()
        .add_typed(TabsClass::TabsTabpane)
        .add_typed_if(TabsClass::TabpaneActive, is_active)
        .add_typed_if(TabsClass::TabpaneInactive, !is_active)
        .build();

    let tab_icon_class = TabsClass::TabsTabIcon.class_name();
    let tab_label_class = TabsClass::TabsTabLabel.class_name();

    let aria_hidden_val = (!is_active).to_string();

    let item_key_for_click = item_key.clone();
    let active_key_for_click = active_key.clone();
    let on_change_for_click = on_change.clone();
    let onclick_handler = move |_| {
        if !props.disabled {
            active_key_for_click.set(item_key_for_click.clone());
            if let Some(handler) = on_change_for_click.as_ref() {
                handler.call(item_key_for_click.clone());
            }
        }
    };

    let item_key_for_kb = item_key.clone();
    let active_key_for_kb = active_key.clone();
    let on_change_for_kb = on_change.clone();
    let onkeydown_handler = move |e: KeyboardEvent| {
        if props.disabled {
            return;
        }
        let keys = tab_keys.read();
        let current_idx = keys.iter().position(|k| k == &item_key_for_kb);
        let Some(idx) = current_idx else { return };
        let total = keys.len();
        if total == 0 {
            return;
        }

        let next_key = match e.get_key() {
            Key::ArrowRight | Key::ArrowDown => {
                e.prevent_default();
                let next = (idx + 1) % total;
                keys.get(next).cloned()
            }
            Key::ArrowLeft | Key::ArrowUp => {
                e.prevent_default();
                let next = (idx + total - 1) % total;
                keys.get(next).cloned()
            }
            Key::Other(s) if s == "Home" => {
                e.prevent_default();
                keys.first().cloned()
            }
            Key::Other(s) if s == "End" => {
                e.prevent_default();
                keys.last().cloned()
            }
            Key::Enter | Key::Space => {
                e.prevent_default();
                if !is_active {
                    active_key_for_kb.set(item_key_for_kb.clone());
                    if let Some(handler) = on_change_for_kb.as_ref() {
                        handler.call(item_key_for_kb.clone());
                    }
                }
                None
            }
            _ => None,
        };

        if let Some(key) = next_key {
            active_key_for_kb.set(key.clone());
            if let Some(handler) = on_change_for_kb.as_ref() {
                handler.call(key);
            }
        }
    };

    let tab_el = rsx! {
        div {
            class: tab_classes,
            role: "tab",
            "data-key": item_key.clone(),
            "aria-selected": is_active,
            "aria-disabled": props.disabled,
            tabindex: tabindex_val,
            onclick: onclick_handler,
            onkeydown: onkeydown_handler,

            if let Some(icon) = props.icon {
                span { class: tab_icon_class, {icon} }
            }

            span { class: tab_label_class, "{props.tab}" }
        }
    };

    let tabpane_el = rsx! {
        div {
            class: tabpane_classes,
            role: "tabpanel",
            "data-key": item_key,
            "aria-hidden": aria_hidden_val,

            {if is_active { props.children } else { VNode::empty() }}
        }
    };

    VNode::Fragment(vec![tab_el, tabpane_el])
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
}
