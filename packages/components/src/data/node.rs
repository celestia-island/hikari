// hi-components/src/data/node.rs
// TreeNode component for tree data structures

#![expect(clippy::needless_update)]

use hikari_palette::classes::TreeNodeClass;
use tairitsu_hooks::ReactiveSignal;
use tairitsu_style::ClassesBuilder;

use crate::data::{TreeNodeArrow, TreeNodeContent, TreeNodeLabel};
use crate::prelude::*;

#[derive(Clone, PartialEq, Debug)]
pub struct TreeNodeData {
    pub key: String,
    pub label: String,
    pub children: Option<Vec<TreeNodeData>>,
    pub disabled: bool,
}

#[derive(Clone, Default, Props)]
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

    #[props(default)]
    pub expanded_keys: Option<ReactiveSignal<Vec<String>>>,

    #[props(default)]
    pub selected_keys: Option<ReactiveSignal<Vec<String>>>,

    #[props(default)]
    pub on_select: Option<EventHandler<String>>,

    #[props(default)]
    pub on_expand: Option<EventHandler<String>>,
}

#[component]
pub fn TreeNode(props: TreeNodeProps) -> Element {
    let is_expanded_local = use_signal(|| props.expanded);
    let has_children = props.node_children.is_some();

    let is_expanded = if let Some(ref ek) = props.expanded_keys {
        ek.read().contains(&props.node_key)
    } else {
        is_expanded_local.get()
    };

    let is_selected = if let Some(ref sk) = props.selected_keys {
        sk.read().contains(&props.node_key)
    } else {
        props.selected
    };

    let node_classes = ClassesBuilder::new()
        .add_typed(TreeNodeClass::TreeNode)
        .add_typed_if(TreeNodeClass::TreeNodeSelected, is_selected)
        .add_typed_if(TreeNodeClass::TreeNodeDisabled, props.disabled)
        .add_typed_if(TreeNodeClass::TreeNodeParent, has_children)
        .add(&props.class)
        .build();

    let node_key = props.node_key.clone();
    let level = props.level;

    let child_nodes: Vec<Element> = if has_children && is_expanded {
        if let Some(children) = &props.node_children {
            let ek = props.expanded_keys.clone();
            let sk = props.selected_keys.clone();
            let on_select = props.on_select.clone();
            let on_expand = props.on_expand.clone();

            children
                .iter()
                .map(|child| {
                    let child_ek = ek.clone();
                    let child_sk = sk.clone();
                    let child_expanded = child_ek
                        .as_ref()
                        .map(|s| s.read().contains(&child.key))
                        .unwrap_or(false);
                    let child_selected = child_sk
                        .as_ref()
                        .map(|s| s.read().contains(&child.key))
                        .unwrap_or(false);

                    TreeNode(TreeNodeProps {
                        node_key: child.key.clone(),
                        label: child.label.clone(),
                        node_children: child.children.clone(),
                        disabled: child.disabled,
                        expanded: child_expanded,
                        selected: child_selected,
                        level: props.level + 1,
                        expanded_keys: child_ek,
                        selected_keys: child_sk,
                        on_select: on_select.clone(),
                        on_expand: on_expand.clone(),
                        ..TreeNodeProps::default()
                    })
                })
                .collect()
        } else {
            vec![]
        }
    } else {
        vec![]
    };

    let is_expanded_for_click = is_expanded_local.clone();
    let is_expanded_for_arrow = is_expanded_local.clone();
    let is_expanded_for_children = is_expanded_local.clone();
    let key_for_click = props.node_key.clone();
    let key_for_arrow = props.node_key.clone();
    let ek_for_click = props.expanded_keys.clone();
    let sk_for_click = props.selected_keys.clone();
    let on_select_for_click = props.on_select.clone();
    let on_expand_for_click = props.on_expand.clone();
    let ek_for_arrow = props.expanded_keys.clone();
    let on_expand_for_arrow = props.on_expand.clone();

    rsx! {
        li {
            class: node_classes,
            role: "treeitem",
            "data-node-key": node_key,
            "data-level": level,
            aria_expanded: if has_children { is_expanded.to_string() } else { "false".to_string() },
            aria_selected: is_selected.to_string(),
            aria_disabled: props.disabled.to_string(),

            TreeNodeContent {
                level: props.level,
                disabled: props.disabled,
                class: props.class.clone(),
                onclick: EventHandler::new(move |e| {
                    if !props.disabled {
                        if let Some(ref sk) = sk_for_click {
                            sk.set(vec![key_for_click.clone()]);
                        }
                        if let Some(ref handler) = on_select_for_click {
                            handler.call(key_for_click.clone());
                        }

                        if has_children {
                            if let Some(ref ek) = ek_for_click {
                                let mut keys = ek.read();
                                if keys.contains(&key_for_click) {
                                    keys.retain(|k| k != &key_for_click);
                                } else {
                                    keys.push(key_for_click.clone());
                                }
                                ek.set(keys);
                            } else {
                                is_expanded_for_click.set(!is_expanded_for_click.get());
                            }

                            if let Some(ref handler) = on_expand_for_click {
                                handler.call(key_for_click.clone());
                            }
                        }

                        if let Some(handler) = props.onclick.as_ref() {
                            handler.call(e);
                        }
                    }
                }),

                TreeNodeArrow {
                    expanded: is_expanded_for_arrow.get(),
                    disabled: props.disabled,
                    onclick: EventHandler::new(move |e: MouseEvent| {
                        e.stop_propagation();
                        if !props.disabled {
                            if let Some(ref ek) = ek_for_arrow {
                                let mut keys = ek.read();
                                if keys.contains(&key_for_arrow) {
                                    keys.retain(|k| k != &key_for_arrow);
                                } else {
                                    keys.push(key_for_arrow.clone());
                                }
                                ek.set(keys);
                            } else {
                                is_expanded_for_arrow.set(!is_expanded_for_arrow.get());
                            }

                            if let Some(ref handler) = on_expand_for_arrow {
                                handler.call(key_for_arrow.clone());
                            }
                        }
                    }),
                }

                TreeNodeLabel { label: props.label.clone(), icon: props.icon.clone() }
            }

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
