// hi-components/src/data/node_label.rs
// TreeNodeLabel component - label text for tree nodes

use crate::prelude::*;

#[derive(Clone, PartialEq, Props, Default)]
pub struct TreeNodeLabelProps {
    pub label: String,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub class: String,
}

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
