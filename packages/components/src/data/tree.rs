// hi-components/src/data/tree.rs
// Tree component for hierarchical data display

use hikari_palette::classes::{ClassesBuilder, TreeClassNew};

use crate::{
    data::node::{TreeNode, TreeNodeData, TreeNodeProps},
    prelude::*,
    styled::StyledComponent,
};

pub struct TreeComponent;

#[define_props]
pub struct TreeProps {
    pub data: Vec<TreeNodeData>,

    #[default]
    pub default_expanded_keys: Vec<String>,

    #[default]
    pub default_selected_keys: Vec<String>,

    #[default]
    pub checkable: bool,

    #[default]
    pub show_line: bool,

    #[default]
    pub class: String,

    #[default]
    pub on_select: Option<EventHandler<String>>,

    #[default]
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

    let handle_keydown = move |e: KeyboardEvent| match e.get_key() {
        Key::ArrowUp | Key::ArrowDown | Key::ArrowLeft | Key::ArrowRight => {
            e.prevent_default();
        }
        Key::Enter | Key::Character(_) => {
            e.prevent_default();
        }
        _ => {}
    };

    // Build tree nodes by calling TreeNode function directly with props struct
    let tree_nodes: Vec<Element> = props
        .data
        .iter()
        .map(|item| {
            TreeNode(TreeNodeProps {
                node_key: item.key.clone(),
                label: item.label.clone(),
                node_children: item.children.clone(),
                disabled: item.disabled,
                expanded: expanded_keys.read().contains(&item.key),
                selected: selected_keys.read().contains(&item.key),
                level: 0,
                ..TreeNodeProps::default()
            })
        })
        .collect();

    // Use TreeClassNew for tree container classes
    let container_classes = ClassesBuilder::new()
        .add(TreeClassNew::TreeContainer)
        .add_raw(&props.class)
        .build();

    let tree_classes = ClassesBuilder::new()
        .add(TreeClassNew::Tree)
        .add_raw(line_class)
        .build();

    rsx! {
        div {
            class: container_classes,
            tabindex: 0,
            role: "tree",
            aria_multiselectable: "false",
            onkeydown: handle_keydown,

            ul { class: tree_classes, role: "treegroup", ..tree_nodes }
        }
    }
}

impl StyledComponent for TreeComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/components/tree.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "tree"
    }
}
