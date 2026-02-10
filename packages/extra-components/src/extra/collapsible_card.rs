// extra-components/src/extra/collapsible_card.rs
// CollapsibleCard - Collapsible wrapper for Card components

use dioxus::prelude::*;

use crate::collapsible::{Collapsible, CollapsiblePosition};

/// Collapsible card component that wraps a Card with collapsible behavior
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use extra_components::CollapsibleCard;
/// use hikari_components::{Card, CardHeader};
///
/// fn app() -> Element {
///     rsx! {
///         CollapsibleCard {
///             title: "Collapsible Card".to_string(),
///             position: CollapsiblePosition::Right,
///             expanded: true,
///             Card {
///                 CardHeader {
///                     title: Some("Card Title".to_string())
///                 }
///                 div { "Content" }
///             }
///         }
///     }
/// }
/// ```
#[derive(Clone, PartialEq, Props)]
pub struct CollapsibleCardProps {
    /// Title displayed in the header
    pub title: String,

    /// Whether the panel is expanded
    #[props(default)]
    pub expanded: bool,

    /// Whether the panel can be collapsed
    #[props(default)]
    pub collapsible: bool,

    /// Position of the panel
    #[props(default)]
    pub position: CollapsiblePosition,

    /// Width of the panel (default: 300px)
    #[props(default = "400".to_string())]
    pub width: String,

    /// Callback when collapse state changes
    pub on_change: Option<EventHandler<bool>>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,
}

impl Default for CollapsibleCardProps {
    fn default() -> Self {
        Self {
            title: String::default(),
            expanded: false,
            collapsible: true,
            position: Default::default(),
            width: "400".to_string(),
            on_change: None,
            children: VNode::empty(),
            class: String::default(),
        }
    }
}

#[component]
pub fn CollapsibleCard(props: CollapsibleCardProps) -> Element {
    rsx! {
        Collapsible {
            title: props.title,
            expanded: props.expanded,
            collapsible: props.collapsible,
            position: props.position,
            width: props.width,
            on_change: props.on_change,
            class: props.class,
            { props.children }
        }
    }
}
