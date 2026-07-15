// hi-components/src/data/node.rs
// TreeNode component for tree data structures


use hikari_palette::classes::{ClassesBuilder, TreeNodeClass};

use crate::{
    data::{TreeNodeArrow, TreeNodeContent, TreeNodeLabel},
    prelude::*,
};

#[derive(Clone, PartialEq, Debug)]
pub struct TreeNodeData {
    pub key: String,
    pub label: String,
    pub children: Option<Vec<TreeNodeData>>,
    pub disabled: bool,
}

#[define_props]
pub struct TreeNodeProps {
    pub node_key: String,

    pub label: String,

    pub node_children: Option<Vec<TreeNodeData>>,

    #[default]
    pub icon: Option<Element>,

    #[default]
    pub disabled: bool,

    #[default]
    pub expanded: bool,

    #[default]
    pub selected: bool,

    #[default]
    pub level: usize,

    #[default]
    pub class: String,

    #[default]
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

    // Clone signals for use in closures
    let is_expanded_for_click = is_expanded.clone();
    let is_expanded_for_arrow = is_expanded.clone();
    let is_expanded_for_children = is_expanded.clone();

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
                onclick: EventHandler::new(move |e| {
                    if !props.disabled {
                        if has_children {
                            is_expanded_for_click.set(!is_expanded_for_click.get());
                        }

                        if let Some(handler) = props.onclick.as_ref() {
                            handler.call(e);
                        }
                    }
                }),

                // Expand/collapse arrow
                TreeNodeArrow {
                    expanded: is_expanded_for_arrow.get(),
                    disabled: props.disabled,
                    onclick: EventHandler::new(move |e: MouseEvent| {
                        e.stop_propagation();
                        if !props.disabled {
                            is_expanded_for_arrow.set(!is_expanded_for_arrow.get());
                        }
                    }),
                }

                // Node label with optional icon
                TreeNodeLabel { label: props.label.clone(), icon: props.icon.clone() }
            }

            // Render children if expanded
            if has_children && is_expanded_for_children.get() {
                ul {
                    class: "hi-tree-node-children",
                    role: "group",
                    ..child_nodes
                }
            }
        }
    }
}
