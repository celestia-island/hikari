// hi-components/src/data/node.rs
// TreeNode component for tree data structures

use crate::prelude::*;
use hikari_palette::classes::{ClassesBuilder, TreeNodeClass};

use crate::data::{TreeNodeArrow, TreeNodeContent, TreeNodeLabel};

#[derive(Clone, PartialEq, Debug)]
pub struct TreeNodeData {
    pub key: String,
    pub label: String,
    pub children: Option<Vec<TreeNodeData>>,
    pub disabled: bool,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct TreeNodeProps {
    pub node_key: String,

    pub label: String,

    pub node_children: Option<Vec<TreeNodeData>>,

    #[props(default)]
    pub icon: Option<Element>,

    #[props(default)]
    pub disabled: bool,

    #[props(default)]
    pub expanded: bool,

    #[props(default)]
    pub selected: bool,

    #[props(default)]
    pub level: usize,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub onclick: Option<EventHandler<MouseEvent>>,
}

///
#[component]
pub fn TreeNode(props: TreeNodeProps) -> Element {
    let mut is_expanded = use_signal(|| props.expanded);
    let has_children = props.node_children.is_some();

    let node_classes = ClassesBuilder::new()
        .add(TreeNodeClass::TreeNode)
        .add_if(TreeNodeClass::TreeNodeSelected, || props.selected)
        .add_if(TreeNodeClass::TreeNodeDisabled, || props.disabled)
        .add_if(TreeNodeClass::TreeNodeParent, || has_children)
        .add_raw(&props.class)
        .build();

    let node_key = props.node_key.clone();
    let level = props.level;

    // Pre-build child nodes as Vec<Element> to avoid let statements in for loop
    let child_nodes: Vec<Element> = if has_children && is_expanded.get() {
        if let Some(children) = &props.node_children {
            children
                .iter()
                .map(|child| {
                    rsx! {
                        TreeNode {
                            node_key: child.key.clone(),
                            label: child.label.clone(),
                            node_children: child.children.clone(),
                            disabled: child.disabled,
                            level: props.level + 1,
                        }
                    }
                })
                .collect()
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    rsx! {
        li {
            class: node_classes,
            role: "treeitem",
            "data-node-key": node_key,
            "data-level": level,
            aria_expanded: if has_children { is_expanded.get().to_string() } else { "false".to_string() },
            aria_selected: props.selected.to_string(),
            aria_disabled: props.disabled.to_string(),

            TreeNodeContent {
                level: props.level,
                disabled: props.disabled,
                class: props.class.clone(),
                onclick: Some(EventHandler::new(move |e| {
                    if !props.disabled {
                        if has_children {
                            is_expanded.set(!is_expanded.get());
                        }

                        if let Some(handler) = props.onclick.as_ref() {
                            handler.call(e);
                        }
                    }
                })),

                // Expand/collapse arrow
                TreeNodeArrow {
                    expanded: is_expanded.get(),
                    disabled: props.disabled,
                    onclick: Some(EventHandler::new(move |e: MouseEvent| {
                        e.stop_propagation();
                        if !props.disabled {
                            is_expanded.set(!is_expanded.get());
                        }
                    }))
                }

                // Node label with optional icon
                TreeNodeLabel {
                    label: props.label.clone(),
                    icon: props.icon.clone(),
                }
            }

            // Render children if expanded
            if has_children && is_expanded.get() {
                ul {
                    class: "hi-tree-node-children",
                    role: "group",

                    ..child_nodes
                }
            }
        }
    }
}
