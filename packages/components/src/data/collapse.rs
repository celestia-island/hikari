// hi-components/src/data/collapse.rs
// Animated collapse/expand component for tree nodes

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Collapse component wrapper (for StyledComponent)
pub struct CollapseComponent;

#[derive(Clone, PartialEq, Props)]
pub struct CollapseProps {
    /// Whether collapse is initially expanded
    #[props(default)]
    pub expanded: bool,

    /// Animation duration in milliseconds
    #[props(default)]
    pub duration: u64,

    /// Whether to animate the collapse
    #[props(default)]
    pub animated: bool,

    /// Custom classes
    #[props(default)]
    pub class: String,

    /// Content to collapse/expand
    pub children: Element,

    /// Callback when expand/collapse state changes
    pub on_expand: Option<EventHandler<bool>>,
}

impl Default for CollapseProps {
    fn default() -> Self {
        Self {
            expanded: false,
            duration: 200,
            animated: true,
            class: String::default(),
            children: VNode::empty(),
            on_expand: None,
        }
    }
}

#[component]
pub fn Collapse(props: CollapseProps) -> Element {
    let mut is_expanded = use_signal(|| props.expanded);

    let animation_style = if props.animated {
        format!(
            "transition: max-height {}ms ease-in-out, opacity {}ms ease-in-out;",
            props.duration, props.duration
        )
    } else {
        String::from("")
    };

    // Use a large max-height for expanded state (will be clamped by content height)
    let max_height = if *is_expanded.read() {
        "1000px".to_string()
    } else {
        "0px".to_string()
    };

    let opacity = if *is_expanded.read() { "1" } else { "0" };

    let arrow_rotation = if *is_expanded.read() { "90deg" } else { "0deg" };

    let handle_toggle = move |_| {
        is_expanded.set(!is_expanded());

        if let Some(handler) = props.on_expand.as_ref() {
            handler.call(*is_expanded.read());
        }
    };

    rsx! {
        div {
            class: format!("hi-collapse {}", props.class),

            div {
                class: "hi-collapse-header",
                style: "cursor: pointer; display: flex; align-items: center; gap: 8px;",
                onclick: handle_toggle,

                span {
                    class: "hi-collapse-arrow",
                    style: format!(
                        "display: inline-block; transition: transform {}ms ease-in-out; transform: rotate({});",
                        props.duration, arrow_rotation
                    ),
                    "›"
                }

                span {
                    class: "hi-collapse-header-content",
                    { props.children.clone() }
                }
            }

            div {
                class: "hi-collapse-content",
                class: if *is_expanded.read() { "hi-collapse-expanded" } else { "" },
                style: format!(
                    "max-height: {}; overflow: hidden; opacity: {}; {};",
                    max_height, opacity, animation_style
                ),

                div {
                    class: "hi-collapse-inner",
                    { props.children.clone() }
                }
            }
        }
    }
}

impl StyledComponent for CollapseComponent {
    fn styles() -> &'static str {
        r#"
.hi-collapse {
    display: flex;
    flex-direction: column;
}

.hi-collapse-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0.5rem 0;
    cursor: pointer;
    user-select: none;
}

.hi-collapse-arrow {
    display: inline-block;
    font-size: 0.75rem;
    transition: transform 0.2s ease-in-out;
}

.hi-collapse-header-content {
    flex: 1;
}

.hi-collapse-content {
    overflow: hidden;
    opacity: 0;
    transition: max-height 0.2s ease-in-out, opacity 0.2s ease-in-out;
}

.hi-collapse-content.hi-collapse-expanded {
    opacity: 1;
}

.hi-collapse-inner {
    padding: 0.5rem 0;
}
"#
    }

    fn name() -> &'static str {
        "collapse"
    }
}
