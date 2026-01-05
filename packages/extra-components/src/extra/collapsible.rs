// hi-extra-components/src/collapsible.rs
// Collapsible panel component with slide-in/out animation

use dioxus::prelude::*;

/// Position of the collapsible panel
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CollapsiblePosition {
    #[default]
    Left,
    Right,
}

#[derive(Clone, PartialEq, Props)]
pub struct CollapsibleProps {
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
    #[props(default = "300".to_string())]
    pub width: String,

    /// Callback when collapse state changes
    pub on_change: Option<EventHandler<bool>>,

    #[props(default)]
    pub children: Element,

    #[props(default)]
    pub class: String,
}

impl Default for CollapsibleProps {
    fn default() -> Self {
        Self {
            title: String::default(),
            expanded: false,
            collapsible: true,
            position: Default::default(),
            width: "300".to_string(),
            on_change: None,
            children: VNode::empty(),
            class: String::default(),
        }
    }
}

/// Collapsible panel component with slide-in/out animation
///
/// # Examples
///
/// ```rust
/// use dioxus::prelude::*;
/// use hikari_extra_components::Collapsible;
///
/// fn app() -> Element {
///     rsx! {
///         Collapsible {
///             title: "Settings Panel".to_string(),
///             position: CollapsiblePosition::Right,
///             expanded: true,
///             "Settings content goes here"
///         }
///     }
/// }
/// ```
#[component]
pub fn Collapsible(props: CollapsibleProps) -> Element {
    let mut expanded = use_signal(|| props.expanded);

    let position_class = match props.position {
        CollapsiblePosition::Left => "hi-collapsible-left",
        CollapsiblePosition::Right => "hi-collapsible-right",
    };

    let toggle_collapse = move |_| {
        if props.collapsible {
            let new_state = !expanded();
            expanded.set(new_state);
            if let Some(handler) = props.on_change.as_ref() {
                handler.call(new_state);
            }
        }
    };

    rsx! {
        div {
            class: format!(
                "hi-collapsible {position_class} {} {}",
                if expanded() { "hi-collapsible-expanded" } else { "hi-collapsible-collapsed" },
                props.class
            ),
            style: format!("width: {}px", props.width),

            // Header
            div {
                class: "hi-collapsible-header",
                onclick: toggle_collapse,

                h3 {
                    class: "hi-collapsible-title",
                    "{props.title}"
                }

                if props.collapsible {
                    button {
                        class: "hi-collapsible-toggle",
                        "aria-label": if expanded() { "Collapse" } else { "Expand" },
                        "aria-expanded": "{expanded()}",
                        dangerous_inner_html: if expanded() {
                            "&#9662;" // Down arrow
                        } else {
                            "&#9656;" // Right arrow
                        }
                    }
                }
            }

            // Content area
            div {
                class: "hi-collapsible-content",
                "aria-hidden": "{!expanded()}",
                { props.children }
            }
        }
    }
}
