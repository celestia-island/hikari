// hi-components/src/data/node_label.rs
// TreeNodeLabel component - label text for tree nodes

use crate::prelude::*;

#[define_props]
pub struct TreeNodeLabelProps {
    pub label: String,

    #[default]
    pub icon: Option<Element>,

    #[default]
    pub class: String,
}

#[component]
pub fn TreeNodeLabel(props: TreeNodeLabelProps) -> Element {
    // Build icon and label separately, then combine
    let icon_el = if let Some(icon) = &props.icon {
        rsx! {
            span { class: "hi-tree-node-icon", {icon.clone()} }
        }
    } else {
        VNode::empty()
    };

    let label_el = rsx! {
        span { class: format!("hi-tree-node-label {}", props.class), "{props.label}" }
    };

    VNode::Fragment(vec![icon_el, label_el])
}
