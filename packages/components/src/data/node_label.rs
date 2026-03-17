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
    // Build icon and label separately, then combine
    let icon_el = if let Some(icon) = &props.icon {
        rsx! { span { class: "hi-tree-node-icon", {icon} } }
    } else {
        VNode::empty()
    };

    let label_el = rsx! {
        span {
            class: format!("hi-tree-node-label {}", props.class),
            "{props.label}"
        }
    };

    VNode::Fragment(vec![icon_el, label_el])
}
