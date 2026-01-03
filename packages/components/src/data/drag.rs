// hikari-components/src/data/drag.rs
// Drag and drop component for tree node reordering

use dioxus::prelude::*;

use crate::styled::StyledComponent;

/// Drag component wrapper (for StyledComponent)
pub struct DragComponent;

#[derive(Clone, PartialEq, Props, Default)]
pub struct DragTreeNodeData {
    #[props(default)]
    pub item_key: String,

    #[props(default)]
    pub title: String,

    #[props(default)]
    pub node_children: Vec<DragTreeNodeData>,

    #[props(default)]
    pub disabled: bool,
}

#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum DropPosition {
    #[default]
    Before,
    After,
    Inside,
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct DropTarget {
    pub target_key: String,
    pub position: DropPosition,
}

#[derive(Clone, PartialEq, Debug, Default)]
pub struct DropEvent {
    pub dragged_key: String,
    pub target_key: String,
    pub position: DropPosition,
}

#[derive(Clone, PartialEq, Props)]
pub struct DragDropTreeProps {
    #[props(default)]
    pub data: Vec<DragTreeNodeData>,

    #[props(default)]
    pub draggable: bool,

    #[props(default)]
    pub drop_allowed: bool,

    pub allow_drag: Option<EventHandler<(String, bool)>>,
    pub allow_drop: Option<EventHandler<(DropTarget, bool)>>,
    pub on_drop: Option<EventHandler<DropEvent>>,

    #[props(default)]
    pub class: String,
}

impl Default for DragDropTreeProps {
    fn default() -> Self {
        Self {
            data: Vec::default(),
            draggable: true,
            drop_allowed: true,
            allow_drag: None,
            allow_drop: None,
            on_drop: None,
            class: String::default(),
        }
    }
}

#[component]
pub fn DragDropTree(props: DragDropTreeProps) -> Element {
    let dragged_key = use_signal(|| Option::<String>::None);
    let drop_target = use_signal(|| Option::<DropTarget>::None);
    let drag_over_key = use_signal(|| Option::<String>::None);

    rsx! {
        div {
            class: format!("hikari-drag-drop-tree {}", props.class),

            if drop_target.read().is_some() {
                div {
                    class: "hikari-drop-indicator",
                    style: "position: fixed; height: 2px; background: #4fd1c5; box-shadow: 0 0 8px rgba(79, 209, 197, 0.8); pointer-events: none; z-index: 1000; display: none;",
                    id: "drop-indicator",
                }
            }

            for node in &props.data {
                RenderDragNode {
                    node: node.clone(),
                    depth: 0,
                    draggable: props.draggable,
                    drop_allowed: props.drop_allowed,
                    allow_drag: props.allow_drag,
                    allow_drop: props.allow_drop,
                    dragged_key: dragged_key,
                    drop_target: drop_target,
                    drag_over_key: drag_over_key,
                    on_drop: props.on_drop,
                }
            }
        }
    }
}

#[derive(Clone, PartialEq, Props)]
pub struct RenderDragNodeProps {
    pub node: DragTreeNodeData,
    pub depth: usize,
    pub draggable: bool,
    pub drop_allowed: bool,
    pub allow_drag: Option<EventHandler<(String, bool)>>,
    pub allow_drop: Option<EventHandler<(DropTarget, bool)>>,
    pub dragged_key: Signal<Option<String>>,
    pub drop_target: Signal<Option<DropTarget>>,
    pub drag_over_key: Signal<Option<String>>,
    pub on_drop: Option<EventHandler<DropEvent>>,
}

#[component]
fn RenderDragNode(mut props: RenderDragNodeProps) -> Element {
    let item_key_1 = props.node.item_key.clone();
    let item_key_2 = props.node.item_key.clone();
    let item_key_3 = props.node.item_key.clone();
    let item_key_4 = props.node.item_key.clone();
    let disabled = props.node.disabled;

    let is_dragging = props.dragged_key.read().as_ref() == Some(&item_key_1);

    let is_drag_over = props.drag_over_key.read().as_ref() == Some(&item_key_1);

    rsx! {
        div {
            class: format!(
                "hikari-drag-node {} {} {}",
                if is_dragging { "hikari-dragging" } else { "" },
                if is_drag_over { "hikari-drag-over" } else { "" },
                if disabled { "hikari-node-disabled" } else { "" }
            ),
            style: format!("padding-left: {}px;", props.depth * 24),
            draggable: props.draggable && !disabled,
            "data-key": "{item_key_1}",

            ondragstart: move |e: DragEvent| {
                e.prevent_default();

                let key = item_key_2.clone();
                let can_drag = if let Some(handler) = props.allow_drag.as_ref() {
                    handler.call((key.clone(), true));
                    true
                } else {
                    true
                };

                if can_drag {
                    props.dragged_key.set(Some(key.clone()));

                    let data_transfer = e.data_transfer();
                    let _ = data_transfer.set_data("text/plain", &key);
                    data_transfer.set_effect_allowed("move");
                }
            },

            ondragend: move |_: DragEvent| {
                props.dragged_key.set(None);
                props.drag_over_key.set(None);
                props.drop_target.set(None);
            },

            ondragover: move |e: DragEvent| {
                e.prevent_default();
                e.stop_propagation();

                if props.dragged_key.read().is_some() && props.drop_allowed {
                    let key = item_key_3.clone();
                    props.drag_over_key.set(Some(key));

                    let data_transfer = e.data_transfer();
                    data_transfer.set_drop_effect("move");
                }
            },

            ondragleave: move |_: DragEvent| {
                props.drag_over_key.set(None);
            },

            ondrop: move |e: DragEvent| {
                e.prevent_default();
                e.stop_propagation();

                if let Some(dragged) = props.dragged_key.read().clone() {
                    let position = DropPosition::Inside;
                    let key = item_key_4.clone();

                    let drop_target_info = DropTarget {
                        target_key: key.clone(),
                        position,
                    };

                    let can_drop = if let Some(handler) = props.allow_drop.as_ref() {
                        handler.call((drop_target_info.clone(), true));
                        true
                    } else {
                        true
                    };

                    if can_drop {
                        let drop_event = DropEvent {
                            dragged_key: dragged,
                            target_key: key.clone(),
                            position,
                        };

                        if let Some(handler) = props.on_drop.as_ref() {
                            handler.call(drop_event);
                        }
                    }

                    props.drag_over_key.set(None);
                    props.drop_target.set(None);
                }
            },

            div {
                class: "hikari-drag-handle",
                style: "display: flex; align-items: center; gap: 8px; padding: 8px; cursor: move;",

                if props.draggable && !props.node.disabled {
                    span {
                        class: "hikari-drag-handle-icon",
                        style: "color: #a0aec0; font-size: 12px;",
                        "⋮⋮"
                    }
                }

                div {
                    class: "hikari-node-content",
                    style: "flex: 1;",
                    "{props.node.title}"
                }

                if is_dragging {
                    div {
                        class: "hikari-drag-ghost",
                        style: "position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(79, 209, 197, 0.1); border: 1px dashed #4fd1c5; pointer-events: none;",
                    }
                }
            }

            if is_drag_over && props.drop_allowed {
                div {
                    class: "hikari-drop-line",
                    style: "height: 2px; background: #4fd1c5; box-shadow: 0 0 8px rgba(79, 209, 197, 0.8); margin: 4px 0;",
                }
            }

            if !props.node.node_children.is_empty() {
                div {
                    class: "hikari-node-children",
                    style: "margin-left: 24px;",

                    for child in &props.node.node_children {
                        RenderDragNode {
                            node: child.clone(),
                            depth: props.depth + 1,
                            draggable: props.draggable,
                            drop_allowed: props.drop_allowed,
                            allow_drag: props.allow_drag,
                            allow_drop: props.allow_drop,
                            dragged_key: props.dragged_key,
                            drop_target: props.drop_target,
                            drag_over_key: props.drag_over_key,
                            on_drop: props.on_drop,
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for DragComponent {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/drag.css"))
    }

    fn name() -> &'static str {
        "drag"
    }
}
