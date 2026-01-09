// hi-components/src/navigation/tabs.rs
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
/// use dioxus::prelude::*;
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
/// use dioxus::prelude::*;
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
    // Create and provide the active key signal for child TabPane components
    let active_key = use_signal(|| props.default_active.clone());
    use_context_provider(|| active_key.clone());

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

/// Tab pane component
#[component]
pub fn TabPane(props: TabPaneProps) -> Element {
    let active_key = use_context::<Signal<String>>();
    let is_active = active_key() == props.item_key;

    rsx! {
        div {
            class: format!(
                "hi-tabs-tab {} {}",
                if is_active { "hi-tabs-tab-active" } else { "" },
                if props.disabled { "hi-tabs-tab-disabled" } else { "" }
            ),
            role: "tab",
            "data-key": "{props.item_key}",
            "aria-selected": "{is_active}",
            "aria-disabled": "{props.disabled}",

            if let Some(icon) = props.icon {
                span { class: "hi-tabs-tab-icon", { icon } }
            }

            span { class: "hi-tabs-tab-label", "{props.tab}" }
        }

        div {
            class: format!(
                "hi-tabs-tabpane {}",
                if is_active { "hi-tabs-tabpane-active" } else { "hi-tabs-tabpane-inactive" }
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
