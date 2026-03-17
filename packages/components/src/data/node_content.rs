// hi-components/src/data/node_content.rs
// TreeNodeContent component - content wrapper for tree nodes

use crate::prelude::*;

#[derive(Clone, PartialEq, Props)]
pub struct TreeNodeContentProps {
    pub level: usize,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub class: String,

    pub onclick: EventHandler<MouseEvent>,

    children: Element,
}

impl Default for TreeNodeContentProps {
    fn default() -> Self {
        Self {
            level: 0,
            disabled: false,
            class: String::new(),
            onclick: EventHandler::new(|_| {}),
            children: VNode::empty(),
        }
    }
}

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
            class: full_class,
            style: indentation_style,
            onclick: move |e| {
                if !props.disabled {
                    props.onclick.call(e);
                }
            },
            {props.children}
        }
    }
}
