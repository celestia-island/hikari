// hi-components/src/data/tree.rs
// Tree component for hierarchical data display

use dioxus::prelude::*;

use crate::{
    data::node::{TreeNode, TreeNodeData, TreeNodeProps},
    styled::StyledComponent,
};

/// Tree component wrapper (for StyledComponent)
pub struct TreeComponent;

#[derive(Clone, PartialEq, Props, Default)]
pub struct TreeProps {
    /// Tree data structure
    pub data: Vec<TreeNodeData>,

    /// Initially expanded node keys
    #[props(default)]
    pub default_expanded_keys: Vec<String>,

    /// Initially selected node keys
    #[props(default)]
    pub default_selected_keys: Vec<String>,

    /// Show checkboxes
    #[props(default)]
    pub checkable: bool,

    /// Show connecting lines
    #[props(default)]
    pub show_line: bool,

    /// Custom classes
    #[props(default)]
    pub class: String,

    /// Selection handler
    #[props(default)]
    pub on_select: Option<EventHandler<String>>,

    /// Expand handler
    #[props(default)]
    pub on_expand: Option<EventHandler<String>>,
}

/// Tree component - Container managing multiple tree nodes
#[component]
pub fn Tree(props: TreeProps) -> Element {
    let expanded_keys = use_signal(|| props.default_expanded_keys.clone());
    let selected_keys = use_signal(|| props.default_selected_keys.clone());
    let mut _focused_key = use_signal(String::new);

    let line_class = if props.show_line {
        "hi-tree-show-line"
    } else {
        ""
    };

    let is_expanded = move |key: &str| expanded_keys().contains(&key.to_string());

    let handle_keydown = move |e: KeyboardEvent| match e.key() {
        Key::ArrowUp | Key::ArrowDown | Key::ArrowLeft | Key::ArrowRight => {
            e.prevent_default();
        }
        Key::Enter | Key::Character(_) => {
            e.prevent_default();
        }
        _ => {}
    };

    rsx! {
        div {
            class: format!("hi-tree-container {}", props.class),
            tabindex: 0,
            role: "tree",
            aria_multiselectable: "false",
            onkeydown: handle_keydown,

            ul {
                class: format!("hi-tree {line_class}"),
                role: "treegroup",

                {render_tree_nodes(
                    &props.data,
                    0,
                    &is_expanded,
                    expanded_keys,
                    selected_keys,
                    &props.on_expand,
                    &props.on_select
                )}
            }
        }
    }
}

/// Recursive function to render tree nodes
fn render_tree_nodes(
    nodes: &[TreeNodeData],
    level: usize,
    is_expanded: &impl Fn(&str) -> bool,
    expanded_keys: Signal<Vec<String>>,
    selected_keys: Signal<Vec<String>>,
    on_expand: &Option<EventHandler<String>>,
    on_select: &Option<EventHandler<String>>,
) -> Element {
    let nodes_vec = nodes.to_vec();
    rsx! {
        for item in nodes_vec {
            TreeNode {
                node_key: item.key.clone(),
                label: item.label.clone(),
                node_children: item.children.clone(),
                disabled: item.disabled,
                expanded: is_expanded(&item.key),
                selected: false,
                level: level,
                onclick: {
                    let item_key = item.key.clone();
                    let item_children = item.children.clone();
                    let item_disabled = item.disabled;
                    let mut expanded_keys_sig = expanded_keys;
                    let mut selected_keys_sig = selected_keys;
                    let on_select_cb = on_select.as_ref().map(|h| *h);
                    let on_expand_cb = on_expand.as_ref().map(|h| *h);

                    Some(EventHandler::new(move |_e| {
                        if !item_disabled {
                            let id_clone = item_key.clone();
                            selected_keys_sig.set(vec![id_clone.clone()]);

                            if let Some(handler) = on_select_cb.as_ref() {
                                handler.call(id_clone.clone());
                            }

                            if item_children.is_some() {
                                let id_inner = id_clone.clone();
                                let current = expanded_keys_sig.read().clone();
                                let new_keys: Vec<_> = if current.contains(&id_inner) {
                                    current.into_iter().filter(|k| k != &id_inner).collect()
                                } else {
                                    let mut keys = current;
                                    keys.push(id_inner);
                                    keys
                                };
                                expanded_keys_sig.set(new_keys);

                                if let Some(handler) = on_expand_cb.as_ref() {
                                    handler.call(id_clone);
                                }
                            }
                        }
                    }))
                },

                ..TreeNodeProps::default()
            }
        }
    }
}

impl StyledComponent for TreeComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/tree.css"))
    }

    fn name() -> &'static str {
        "tree"
    }
}
