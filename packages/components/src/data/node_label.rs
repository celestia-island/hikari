// hi-components/src/data/node_label.rs
// TreeNodeLabel component - label text for tree nodes

use dioxus::prelude::*;

/// Label text for tree nodes
#[derive(Clone, PartialEq, Props, Default)]
pub struct TreeNodeLabelProps {
    /// Label text to display
    pub label: String,

    /// Optional icon element
    #[props(default)]
    pub icon: Option<Element>,

    /// Custom classes
    #[props(default)]
    pub class: String,
}

/// TreeNodeLabel - The text/icon display for a tree node
#[component]
pub fn TreeNodeLabel(props: TreeNodeLabelProps) -> Element {
    rsx! {
        // Optional icon
        if let Some(icon) = &props.icon {
            span { class: "hi-tree-node-icon", { icon } }
        }

        // Label text
        span {
            class: format!("hi-tree-node-label {}", props.class),
            "{props.label}"
        }
    }
}
