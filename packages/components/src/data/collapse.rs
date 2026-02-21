// hi-components/src/data/collapse.rs
// Animated collapse/expand component for tree nodes

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Collapse component wrapper (for StyledComponent)
pub struct CollapseComponent;

#[derive(Clone, PartialEq, Props, Debug)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collapse_props_default() {
        let props = CollapseProps::default();
        assert!(!props.expanded);
        assert_eq!(props.duration, 200);
        assert!(props.animated);
        assert!(props.class.is_empty());
        assert!(props.on_expand.is_none());
    }

    #[test]
    fn test_collapse_props_expanded() {
        let props = CollapseProps {
            expanded: true,
            ..Default::default()
        };
        assert!(props.expanded);
    }

    #[test]
    fn test_collapse_props_duration() {
        let props1 = CollapseProps {
            duration: 100,
            ..Default::default()
        };

        let props2 = CollapseProps {
            duration: 500,
            ..Default::default()
        };

        assert_eq!(props1.duration, 100);
        assert_eq!(props2.duration, 500);
    }

    #[test]
    fn test_collapse_props_animated() {
        let props1 = CollapseProps {
            animated: false,
            ..Default::default()
        };

        let props2 = CollapseProps {
            animated: true,
            ..Default::default()
        };

        assert!(!props1.animated);
        assert!(props2.animated);
    }

    #[test]
    fn test_collapse_props_class() {
        let props = CollapseProps {
            class: "custom-class".to_string(),
            ..Default::default()
        };
        assert_eq!(props.class, "custom-class");
    }

    #[test]
    fn test_collapse_props_clone() {
        let props = CollapseProps {
            expanded: true,
            duration: 300,
            animated: true,
            class: "test-class".to_string(),
            on_expand: None,
            children: VNode::empty(),
        };

        let cloned = props.clone();
        assert!(cloned.expanded);
        assert_eq!(cloned.duration, 300);
        assert!(cloned.animated);
        assert_eq!(cloned.class, "test-class");
        assert!(cloned.on_expand.is_none());
    }

    #[test]
    fn test_collapse_props_partial_eq() {
        let props1 = CollapseProps {
            expanded: false,
            duration: 200,
            animated: true,
            class: "test".to_string(),
            on_expand: None,
            children: VNode::empty(),
        };

        let props2 = CollapseProps {
            expanded: false,
            duration: 200,
            animated: true,
            class: "test".to_string(),
            on_expand: None,
            children: VNode::empty(),
        };

        assert_eq!(props1, props2);
    }

    #[test]
    fn test_collapse_props_not_equal() {
        let props1 = CollapseProps {
            expanded: false,
            ..Default::default()
        };

        let props2 = CollapseProps {
            expanded: true,
            ..Default::default()
        };

        assert_ne!(props1, props2);
    }

    #[test]
    fn test_collapse_component_name() {
        assert_eq!(CollapseComponent::name(), "collapse");
    }
}
