// hi-components/src/data/node.rs
// TreeNode component for tree data structures

use dioxus::prelude::*;

use crate::data::{TreeNodeArrow, TreeNodeContent, TreeNodeLabel};

/// Shared data structure for tree nodes
#[derive(Clone, PartialEq, Debug)]
pub struct TreeNodeData {
    /// Unique node identifier
    pub key: String,
    /// Node display text
    pub label: String,
    pub children: Option<Vec<TreeNodeData>>,
    pub disabled: bool,
}

#[derive(Clone, PartialEq, Props, Default)]
pub struct TreeNodeProps {
    /// Unique node identifier
    pub node_key: String,

    /// Node display text
    pub label: String,

    /// Child nodes
    pub node_children: Option<Vec<TreeNodeData>>,

    /// Custom icon
    #[props(default)]
    pub icon: Option<Element>,

    /// Disable interaction
    #[props(default)]
    pub disabled: bool,

    /// Initial expanded state
    #[props(default)]
    pub expanded: bool,

    /// Selected state
    #[props(default)]
    pub selected: bool,

    /// Nesting level for indentation
    #[props(default)]
    pub level: usize,

    /// Custom classes
    #[props(default)]
    pub class: String,

    /// Click handler
    #[props(default)]
    pub onclick: Option<EventHandler<MouseEvent>>,
}

/// TreeNode component - A single tree node that can be expanded/collapsed
///
/// This component is composed of smaller sub-components for better modularity:
/// - [`TreeNodeContent`] - Wraps the content with proper indentation
/// - [`TreeNodeArrow`] - Expand/collapse arrow indicator
/// - [`TreeNodeLabel`] - Text and optional icon display
#[component]
pub fn TreeNode(props: TreeNodeProps) -> Element {
    let mut is_expanded = use_signal(|| props.expanded);
    let has_children = props.node_children.is_some();

    let node_class = format!(
        "hi-tree-node {} {} {} {}",
        if props.selected {
            "hi-tree-node-selected"
        } else {
            ""
        },
        if props.disabled {
            "hi-tree-node-disabled"
        } else {
            ""
        },
        if has_children {
            "hi-tree-node-parent"
        } else {
            ""
        },
        props.class
    );

    rsx! {
        li {
            class: "{node_class}",
            role: "treeitem",
            "data-node-key": "{props.node_key}",
            "data-level": "{props.level}",
            aria_expanded: if has_children { is_expanded().to_string() } else { "false".to_string() },
            aria_selected: props.selected.to_string(),
            aria_disabled: props.disabled.to_string(),

            TreeNodeContent {
                level: props.level,
                disabled: props.disabled,
                class: props.class.clone(),
                onclick: Some(EventHandler::new(move |e| {
                    if !props.disabled {
                        if has_children {
                            is_expanded.set(!is_expanded());
                        }

                        if let Some(handler) = props.onclick.as_ref() {
                            handler.call(e);
                        }
                    }
                })),

                // Expand/collapse arrow
                TreeNodeArrow {
                    expanded: is_expanded(),
                    disabled: props.disabled,
                    onclick: Some(EventHandler::new(move |e: MouseEvent| {
                        e.stop_propagation();
                        if !props.disabled {
                            is_expanded.set(!is_expanded());
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
            if has_children && is_expanded() {
                ul {
                    class: "hi-tree-node-children",
                    role: "group",

                    if let Some(children) = &props.node_children {
                        for child in children {
                            TreeNode {
                                node_key: child.key.clone(),
                                label: child.label.clone(),
                                node_children: child.children.clone(),
                                disabled: child.disabled,
                                level: props.level + 1,
                                ..TreeNodeProps::default()
                            }
                        }
                    }
                }
            }
        }
    }
}
