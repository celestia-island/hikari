// hi-components/src/data/drag.rs
// Drag and drop component for tree node reordering

#![expect(clippy::needless_update)]

use hikari_palette::classes::{ClassesBuilder, DragDropTreeClass};
use tairitsu_hooks::ReactiveSignal;

use crate::{prelude::*, styled::StyledComponent};

pub struct DragComponent;

#[define_props]
pub struct DragTreeNodeData {
    #[default(String::default())]
    pub item_key: String,

    #[default(String::default())]
    pub title: String,

    #[default(Vec::new())]
    pub node_children: Vec<DragTreeNodeData>,

    #[default(false)]
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

#[define_props]
pub struct DragDropTreeProps {
    pub data: Vec<DragTreeNodeData>,

    #[default(true)]
    pub draggable: bool,

    #[default(true)]
    pub drop_allowed: bool,

    pub allow_drag: Option<EventHandler<(String, bool)>>,
    pub allow_drop: Option<EventHandler<(DropTarget, bool)>>,
    pub on_drop: Option<EventHandler<DropEvent>>,

    pub class: String,
}

#[component]
pub fn DragDropTree(props: DragDropTreeProps) -> Element {
    let dragged_key = use_signal(|| Option::<String>::None);
    let drop_target = use_signal(|| Option::<DropTarget>::None);
    let drag_over_key = use_signal(|| Option::<String>::None);

    rsx! {
        div { class: format!("hi-drag-drop-tree {}", props.class),

            if drop_target.read().is_some() {
                div { class: "hi-drop-indicator", id: "drop-indicator" }
            }

            for node in &props.data {
                RenderDragNode {
                    node: node.clone(),
                    depth: 0,
                    draggable: props.draggable,
                    drop_allowed: props.drop_allowed,
                    allow_drag: props.allow_drag.clone(),
                    allow_drop: props.allow_drop.clone(),
                    dragged_key: Some(dragged_key.clone()),
                    drop_target: Some(drop_target.clone()),
                    drag_over_key: Some(drag_over_key.clone()),
                    on_drop: props.on_drop.clone(),
                }
            }
        }
    }
}

#[derive(Clone, Props)]
pub struct RenderDragNodeProps {
    #[props(default)]
    pub node: DragTreeNodeData,

    #[props(default = 0)]
    pub depth: usize,

    #[props(default = true)]
    pub draggable: bool,

    #[props(default = true)]
    pub drop_allowed: bool,

    #[props(default)]
    pub allow_drag: Option<EventHandler<(String, bool)>>,

    #[props(default)]
    pub allow_drop: Option<EventHandler<(DropTarget, bool)>>,

    #[props(default)]
    pub dragged_key: Option<ReactiveSignal<Option<String>>>,

    #[props(default)]
    pub drop_target: Option<ReactiveSignal<Option<DropTarget>>>,

    #[props(default)]
    pub drag_over_key: Option<ReactiveSignal<Option<String>>>,

    #[props(default)]
    pub on_drop: Option<EventHandler<DropEvent>>,
}

impl Default for RenderDragNodeProps {
    fn default() -> Self {
        Self {
            node: DragTreeNodeData {
                item_key: String::default(),
                title: String::default(),
                node_children: Vec::new(),
                disabled: false,
            },
            depth: 0,
            draggable: true,
            drop_allowed: true,
            allow_drag: None,
            allow_drop: None,
            dragged_key: None,
            drop_target: None,
            drag_over_key: None,
            on_drop: None,
        }
    }
}

#[component]
fn RenderDragNode(props: RenderDragNodeProps) -> Element {
    let item_key_1 = props.node.item_key.clone();
    let item_key_2 = props.node.item_key.clone();
    let item_key_3 = props.node.item_key.clone();
    let item_key_4 = props.node.item_key.clone();
    let disabled = props.node.disabled;
    let node_title = props.node.title.clone();

    let is_dragging = props.dragged_key.as_ref().unwrap().read().as_ref() == Some(&item_key_1);

    let is_drag_over = props.drag_over_key.as_ref().unwrap().read().as_ref() == Some(&item_key_1);

    let drag_node_classes = ClassesBuilder::new()
        .add(DragDropTreeClass::DragNode)
        .add_if(DragDropTreeClass::Dragging, || is_dragging)
        .add_if(DragDropTreeClass::DragOver, || is_drag_over)
        .add_if(DragDropTreeClass::NodeDisabled, || disabled)
        .build();

    let dragged_key_for_start = props.dragged_key.clone().unwrap();
    let allow_drag_for_start = props.allow_drag.clone();
    let ondragstart = move |mut e: DragEvent| {
        e.prevent_default();

        let key = item_key_2.clone();
        let can_drag = if let Some(handler) = allow_drag_for_start.as_ref() {
            handler.call((key.clone(), true));
            true
        } else {
            true
        };

        if can_drag {
            dragged_key_for_start.set(Some(key.clone()));

            if let Some(ref mut data_transfer) = e.data_transfer {
                data_transfer.set_data("text/plain", &key);
            }
        }
    };

    let dragged_key_for_end = props.dragged_key.clone().unwrap();
    let drag_over_key_for_end = props.drag_over_key.clone().unwrap();
    let drop_target_for_end = props.drop_target.clone().unwrap();
    let ondragend = move |_: DragEvent| {
        dragged_key_for_end.set(None);
        drag_over_key_for_end.set(None);
        drop_target_for_end.set(None);
    };

    let dragged_key_for_over = props.dragged_key.clone().unwrap();
    let drag_over_key_for_over = props.drag_over_key.clone().unwrap();
    let ondragover = move |e: DragEvent| {
        e.prevent_default();
        e.stop_propagation();

        if dragged_key_for_over.read().is_some() && props.drop_allowed {
            let key = item_key_3.clone();
            drag_over_key_for_over.set(Some(key));

            if let Some(data_transfer) = &e.data_transfer {
                // Note: drop_effect uses builder pattern, skip for now
                let _ = data_transfer;
            }
        }
    };

    let drag_over_key_for_leave = props.drag_over_key.clone().unwrap();
    let ondragleave = move |_: DragEvent| {
        drag_over_key_for_leave.set(None);
    };

    let dragged_key_for_drop = props.dragged_key.clone().unwrap();
    let drag_over_key_for_drop = props.drag_over_key.clone().unwrap();
    let drop_target_for_drop = props.drop_target.clone().unwrap();
    let allow_drop_for_drop = props.allow_drop.clone();
    let on_drop_for_drop = props.on_drop.clone();
    let ondrop = move |e: DragEvent| {
        e.prevent_default();
        e.stop_propagation();

        if let Some(dragged) = dragged_key_for_drop.read().clone() {
            let position = DropPosition::Inside;
            let key = item_key_4.clone();

            let drop_target_info = DropTarget {
                target_key: key.clone(),
                position,
            };

            let can_drop = if let Some(handler) = allow_drop_for_drop.as_ref() {
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

                if let Some(handler) = on_drop_for_drop.as_ref() {
                    handler.call(drop_event);
                }
            }

            drag_over_key_for_drop.set(None);
            drop_target_for_drop.set(None);
        }
    };

    rsx! {
        div {
            class: drag_node_classes,
            draggable: props.draggable && !disabled,
            ondragstart,
            ondragend,
            ondragover,
            ondragleave,
            ondrop,

            div { class: "hi-drag-handle",

                if props.draggable && !props.node.disabled {
                    span { class: "hi-drag-handle-icon", "⋮⋮" }
                }

                div { class: "hi-node-content", "{node_title}" }

                if is_dragging {
                    div { class: "hi-drag-ghost", key: "drag-ghost" }
                }
            }

            if is_drag_over && props.drop_allowed {
                div { class: "hi-drop-line", key: "drop-line" }
            }

            if !props.node.node_children.is_empty() {
                div { class: "hi-node-children",

                    for child in &props.node.node_children {
                        RenderDragNode {
                            node: child.clone(),
                            depth: props.depth + 1,
                            draggable: props.draggable,
                            drop_allowed: props.drop_allowed,
                            allow_drag: props.allow_drag.clone(),
                            allow_drop: props.allow_drop.clone(),
                            dragged_key: Some(props.dragged_key.clone().unwrap()),
                            drop_target: Some(props.drop_target.clone().unwrap()),
                            drag_over_key: Some(props.drag_over_key.clone().unwrap()),
                            on_drop: props.on_drop.clone(),
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
