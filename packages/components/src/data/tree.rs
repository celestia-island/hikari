// hi-components/src/data/tree.rs
// Tree component for hierarchical data display

use crate::prelude::*;

use crate::{
    data::node::{TreeNode, TreeNodeData},
    styled::StyledComponent,
};

pub struct TreeComponent;

#[derive(Clone, PartialEq, Props, Default)]
pub struct TreeProps {
    pub data: Vec<TreeNodeData>,

    #[props(default)]
    pub default_expanded_keys: Vec<String>,

    #[props(default)]
    pub default_selected_keys: Vec<String>,

    #[props(default)]
    pub checkable: bool,

    #[props(default)]
    pub show_line: bool,

    #[props(default)]
    pub class: String,

    #[props(default)]
    pub on_select: Option<EventHandler<String>>,

    #[props(default)]
    pub on_expand: Option<EventHandler<String>>,
}

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

    let handle_keydown = move |e: KeyboardEvent| match e.key_code() {
        Key::ArrowUp | Key::ArrowDown | Key::ArrowLeft | Key::ArrowRight => {
            e.prevent_default();
        }
        Key::Enter | Key::Character(_) => {
            e.prevent_default();
        }
        _ => {}
    };

    // Pre-build tree nodes as Vec<Element>
    let tree_nodes: Vec<Element> = build_tree_nodes(
        &props.data,
        &expanded_keys,
        &selected_keys,
        &props.on_select,
        &props.on_expand,
    );

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

                VNode::Fragment(tree_nodes)
            }
        }
    }
}

fn build_tree_nodes(
    nodes: &[TreeNodeData],
    _expanded_keys: &Signal<Vec<String>>,
    _selected_keys: &Signal<Vec<String>>,
    _on_select: &Option<EventHandler<String>>,
    _on_expand: &Option<EventHandler<String>>,
) -> Vec<Element> {
    nodes
        .iter()
        .map(|item| {
            rsx! {
                TreeNode {
                    node_key: item.key.clone(),
                    label: item.label.clone(),
                    node_children: item.children.clone(),
                    disabled: item.disabled,
                    level: 0,
                }
            }
        })
        .collect()
}

impl StyledComponent for TreeComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/tree.css"))
    }

    fn name() -> &'static str {
        "tree"
    }
}
