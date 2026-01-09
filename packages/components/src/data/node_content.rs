// hi-components/src/data/node_content.rs
// TreeNodeContent component - content wrapper for tree nodes

use dioxus::prelude::*;

/// Content wrapper for tree nodes
#[derive(Clone, PartialEq, Props)]
pub struct TreeNodeContentProps {
    /// Indentation level (0-based)
    pub level: usize,

    /// Whether the node is disabled
    #[props(default)]
    pub disabled: bool,

    /// Custom classes
    #[props(default)]
    pub class: String,

    /// Click handler
    #[props(default)]
    pub onclick: Option<EventHandler<MouseEvent>>,

    /// Child elements (arrow, icon, label)
    children: Element,
}

/// TreeNodeContent - Wraps the visual content of a tree node with proper indentation
#[component]
pub fn TreeNodeContent(props: TreeNodeContentProps) -> Element {
    let indentation_style = format!("padding-left: {}px;", props.level * 24);

    let classes = if props.disabled {
        "hi-tree-node-content hi-tree-node-disabled"
    } else {
        "hi-tree-node-content"
    };

    let full_class = if props.class.is_empty() {
        classes.to_string()
    } else {
        format!("{} {}", classes, props.class)
    };

    rsx! {
        div {
            class: "{full_class}",
            style: "{indentation_style}",
            onclick: move |e| {
                if !props.disabled {
                    if let Some(handler) = props.onclick.as_ref() {
                        handler.call(e);
                    }
                }
            },
            { props.children }
        }
    }
}
