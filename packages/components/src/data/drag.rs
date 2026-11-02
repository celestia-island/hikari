// hi-components/src/data/drag.rs
// DragDropTree — the legacy tree reorder surface (`RenderDragNode` renders one
// recursive node row with its drag handle, ghost and drop line).
//
// L86 DELTA: THIS IS A MOUSE-DRIVEN REORDER, NOT A NATIVE HTML5 DRAG.
// The rows used to carry `draggable="true"` plus `dragstart` / `dragend` /
// `dragover` / `dragleave` / `drop` with `DragEvent` handlers. The tairitsu
// browser glue type-dispatches only the mouse family (plus keyboard, focus and
// `input`/`change`) and routes every `drag*`/`drop` event through
// `onGenericEvent`, whose payload is the type string and a live handle with no
// data, so the `DragEvent` downcast never matched and the whole reorder path
// was inert on a real device (ledger L86).
//
// The gesture never actually needed `DataTransfer`: the state lives in the
// component's own signals (`dragged_key` / `drag_over_key` / `drop_target`), and
// the only `data_transfer` use in this file was a no-op placeholder plus one
// `set_data` call that existed for native-DnD interop. So the reorder is
// REBOUND onto the mouse family, one edge per event:
//
//   dragstart  -> `mousedown`   arm the row (the `allow_drag` gate runs here)
//   dragover   -> `mouseenter`  highlight the row under the pointer
//   dragleave  -> `mouseleave`  clear the highlight
//   drop       -> `mouseup`     commit `DropEvent` (left button only; the row
//                               stops propagation so a nested row cannot
//                               commit a second drop — the same guard the old
//                               `ondrop` ran; and only when the release landed
//                               on a DIFFERENT row — see the grammar delta)
//   dragend    -> the release edges: the row's own `mouseup` clears the
//                 gesture, the tree root's `mouseup` clears one that landed on
//                 tree padding, and a `mouseenter` reporting `buttons == 0`
//                 while a row is still armed retires a release that happened
//                 OUTSIDE the tree (there is no window-listener seam —
//                 `tairitsu_vdom::DomOps` is element-scoped — so the button
//                 state is the closest reliable signal, the same fallback
//                 `basic/slider.rs` and `scene/kanban.rs` carry). The root's
//                 `mouseleave` also clears the highlight so a stale drop line
//                 cannot linger while the pointer is away.
//
// Grammar delta the mouse wire forces: A CLICK MUST NOT COMMIT A DROP. Native
// DnD made `dragstart` require real pointer movement, so a plain press-and-
// release on a row never produced a `drop`; `mousedown` has no such
// precondition, so an armed row released on itself would emit
// `DropEvent{dragged: A, target: A}` on every click. The commit is therefore
// gated by [`drag_drop_moves`] — the same `from == to` rejection
// `layout::header_picker::header_reorder_indices` applies — and a release back
// on the source row retires the gesture WITHOUT an emit (a reorder from an item
// to itself is a no-op in both forms). There is no separate movement threshold:
// reaching another row is the threshold, because the release is resolved by the
// row that receives it.
//
// Declared consequences (nothing faked):
//   * the rows NO LONGER carry the `draggable` attribute: a native drag would
//     steal the gesture from the mouse path (the browser stops delivering
//     `mousemove` once it starts a native drag), so keeping it would break the
//     reorder it used to enable. The `draggable` / `disabled` gate that attribute
//     enforced in the browser is now checked explicitly inside the arm handler,
//     so an unmarked row still cannot start a gesture;
//   * NATIVE DRAG INTEROP IS GONE: dragging a row OUT of the tree into another
//     application (or onto a page-level HTML5 drop target) carried
//     `text/plain` = the item key through `data_transfer.set_data`; the mouse
//     channel has no payload, so that interop is unavailable until the upstream
//     glue types the `drag*` family (or exposes the `DataTransfer` behind the
//     event handle);
//   * the browser's native drag image / `dropEffect` cursor are gone with it —
//     the mirror's own `.hk-drag-ghost` / `.hk-drop-line` markers still paint;
//   * a touch screen produces no `mousemove` sequence, so touch reordering is
//     unavailable.

use hikari_palette::classes::{ClassesBuilder, DragDropTreeClass};

use crate::prelude::*;
use crate::styled::StyledComponent;

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

/// Whether releasing on `target` actually reorders `dragged`.
///
/// Mirrors `layout::header_picker::header_reorder_indices`, which rejects
/// `from == to`: a release on the row the press started from is a CLICK, not a
/// reorder. Native drag-and-drop enforced this in the browser — `dragstart` only
/// fires after real movement, so a click never produced a `drop` — and a mouse
/// `mousedown` has no such precondition, so the mirror has to state it here.
///
/// Also covers the drag-back-onto-itself case: a reorder from an item to itself
/// is a no-op in both forms.
pub fn drag_drop_moves(dragged: &str, target: &str) -> bool {
    dragged != target
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

    // End-of-gesture edges for the whole surface (Vue's `dragend`, L86 delta):
    // a release that lands on tree PADDING never reaches a row, and a release
    // that leaves the tree never reaches it at all — the root retires the first,
    // and drops the highlight while the pointer is away for the second (the
    // arm survives a leave, so dragging back in still resolves).
    let root_dragged = dragged_key.clone();
    let root_over = drag_over_key.clone();
    let root_target = drop_target.clone();
    // The highlight is cleared from two listeners, so it needs its own clone.
    let root_over_leave = drag_over_key.clone();

    rsx! {
        div { class: format!("hk-drag-drop-tree {}", props.class),
            onmouseup: move |_event: MouseEvent| {
                root_dragged.set(None);
                root_over.set(None);
                root_target.set(None);
            },
            onmouseleave: move |_event: MouseEvent| root_over_leave.set(None),

            if drop_target.read().is_some() {
                div { class: "hk-drop-indicator", id: "drop-indicator" }
            }

            for node in &props.data {
                RenderDragNode {
                    node: node.clone(),
                    depth: 0,
                    draggable: props.draggable,
                    drop_allowed: props.drop_allowed,
                    allow_drag: props.allow_drag.clone(),
                    allow_drop: props.allow_drop.clone(),
                    dragged_key: dragged_key.inner().clone(),
                    drop_target: drop_target.inner().clone(),
                    drag_over_key: drag_over_key.inner().clone(),
                    on_drop: props.on_drop.clone(),
                }
            }
        }
    }
}

#[define_props]
pub struct RenderDragNodeProps {
    #[default(DragTreeNodeData {
        item_key: String::default(),
        title: String::default(),
        node_children: Vec::new(),
        disabled: false,
    })]
    pub node: DragTreeNodeData,

    #[default(0)]
    pub depth: usize,

    #[default(true)]
    pub draggable: bool,

    #[default(true)]
    pub drop_allowed: bool,

    pub allow_drag: Option<EventHandler<(String, bool)>>,
    pub allow_drop: Option<EventHandler<(DropTarget, bool)>>,
    #[default(Signal::new(None))]
    pub dragged_key: Signal<Option<String>>,
    #[default(Signal::new(None))]
    pub drop_target: Signal<Option<DropTarget>>,
    #[default(Signal::new(None))]
    pub drag_over_key: Signal<Option<String>>,
    pub on_drop: Option<EventHandler<DropEvent>>,
}

#[component]
fn RenderDragNode(props: RenderDragNodeProps) -> Element {
    let item_key_1 = props.node.item_key.clone();
    let item_key_2 = props.node.item_key.clone();
    let item_key_3 = props.node.item_key.clone();
    let item_key_4 = props.node.item_key.clone();
    let disabled = props.node.disabled;
    let node_title = props.node.title.clone();

    let is_dragging = props.dragged_key.read().as_ref() == Some(&item_key_1);

    let is_drag_over = props.drag_over_key.read().as_ref() == Some(&item_key_1);

    let drag_node_classes = ClassesBuilder::new()
        .add(DragDropTreeClass::DragNode)
        .add_if(DragDropTreeClass::Dragging, || is_dragging)
        .add_if(DragDropTreeClass::DragOver, || is_drag_over)
        .add_if(DragDropTreeClass::NodeDisabled, || disabled)
        .build();

    // `dragstart` -> `mousedown`: arm the row. The press is PUBLISHED, not
    // claimed (no capture on this wire), so the release is resolved by the row's
    // own `mouseup` or retired from the button state (L86 delta in the header).
    // `prevent_default` keeps the press from starting a text selection, which is
    // what the drag handle needs.
    let draggable = props.draggable;
    let dragged_key_for_start = props.dragged_key.clone();
    let allow_drag_for_start = props.allow_drag.clone();
    let on_arm = move |event: MouseEvent| {
        // The element-level `draggable` attribute used to keep a non-draggable or
        // disabled row from ever starting a gesture (the browser simply fired no
        // `dragstart`). With the attribute gone the same gate has to be explicit,
        // or every call into an unmarked row would arm a reorder.
        if !draggable || disabled {
            return;
        }
        event.prevent_default();

        let key = item_key_2.clone();
        // `allow_drag` is a NOTIFICATION, not a veto: its handler returns unit,
        // so it cannot decline the gesture (the old code computed a `can_drag`
        // that was `true` on both branches). The arm is gated on `draggable` /
        // `disabled` above; a host that must refuse a row keeps `draggable` false
        // for it.
        if let Some(handler) = allow_drag_for_start.as_ref() {
            handler.call((key.clone(), true));
        }
        dragged_key_for_start.set(Some(key));
    };

    // `dragover` -> `mouseenter`: highlight the row under the pointer, once
    // (the old `dragover` repeated this on every frame). A row entered with NO
    // button held while a drag is still armed means the release happened
    // outside the tree, where no listener could see it — retire the gesture
    // instead of highlighting, so a stale drop line can never survive.
    let dragged_key_for_over = props.dragged_key.clone();
    let drag_over_key_for_over = props.drag_over_key.clone();
    let drop_target_for_over = props.drop_target.clone();
    let on_drag_over = move |event: MouseEvent| {
        if dragged_key_for_over.read().is_none() {
            return;
        }
        if event.buttons == 0 {
            dragged_key_for_over.set(None);
            drag_over_key_for_over.set(None);
            drop_target_for_over.set(None);
            return;
        }
        if props.drop_allowed {
            let key = item_key_3.clone();
            if drag_over_key_for_over.read().as_ref() != Some(&key) {
                drag_over_key_for_over.set(Some(key));
            }
        }
    };

    // `dragleave` -> `mouseleave` (non-bubbling in both forms, so a nested row
    // does not clear its ancestors' highlight).
    let drag_over_key_for_leave = props.drag_over_key.clone();
    let on_drag_leave = move |_: MouseEvent| {
        drag_over_key_for_leave.set(None);
    };

    let dragged_key_for_drop = props.dragged_key.clone();
    let drag_over_key_for_drop = props.drag_over_key.clone();
    let drop_target_for_drop = props.drop_target.clone();
    let allow_drop_for_drop = props.allow_drop.clone();
    let on_drop_for_drop = props.on_drop.clone();
    // `drop` -> `mouseup`: commit on release. Only the primary button commits
    // (a `mouseup` also fires for the others, which `drop` never did), and the
    // row stops propagation so a nested row cannot commit a second drop — the
    // same guard the old `ondrop` ran. The release also retires the whole
    // gesture, which is what `dragend` used to do after a successful drop.
    //
    // A release on the row the press started from is a CLICK, not a reorder:
    // native DnD required real movement before `dragstart`, `mousedown` does not,
    // so [`drag_drop_moves`] restores that precondition. The gesture is retired
    // either way — only the emit is suppressed.
    let on_drag_drop = move |event: MouseEvent| {
        event.stop_propagation();
        if event.button != 0 {
            return;
        }

        if let Some(dragged) = dragged_key_for_drop.read().clone() {
            let key = item_key_4.clone();
            let moved = drag_drop_moves(&dragged, &key);

            if moved {
                let position = DropPosition::Inside;
                let drop_target_info = DropTarget {
                    target_key: key.clone(),
                    position,
                };

                // `allow_drop` is a NOTIFICATION, not a veto: its handler returns
                // unit, so it cannot decline the drop (the old code computed a
                // `can_drop` that was `true` on both paths). A host that must
                // refuse a target refuses the `on_drop` itself.
                if let Some(handler) = allow_drop_for_drop.as_ref() {
                    handler.call((drop_target_info, true));
                }

                let drop_event = DropEvent {
                    dragged_key: dragged,
                    target_key: key,
                    position: DropPosition::Inside,
                };

                if let Some(handler) = on_drop_for_drop.as_ref() {
                    handler.call(drop_event);
                }
            }

            dragged_key_for_drop.set(None);
            drag_over_key_for_drop.set(None);
            drop_target_for_drop.set(None);
        }
    };

    rsx! {
        div {
            class: drag_node_classes,
            // NO `draggable` attribute: a native drag would steal the gesture
            // from the mouse path (see the header delta).
            onmousedown: on_arm,
            onmouseenter: on_drag_over,
            onmouseleave: on_drag_leave,
            onmouseup: on_drag_drop,

            div { class: "hk-drag-handle",

                if props.draggable && !props.node.disabled {
                    span { class: "hk-drag-handle-icon", "⋮⋮" }
                }

                div { class: "hk-node-content", "{node_title}" }

                if is_dragging {
                    div { class: "hk-drag-ghost", key: "drag-ghost" }
                }
            }

            if is_drag_over && props.drop_allowed {
                div { class: "hk-drop-line", key: "drop-line" }
            }

            if !props.node.node_children.is_empty() {
                div { class: "hk-node-children",

                    for child in &props.node.node_children {
                        RenderDragNode {
                            node: child.clone(),
                            depth: props.depth + 1,
                            draggable: props.draggable,
                            drop_allowed: props.drop_allowed,
                            allow_drag: props.allow_drag.clone(),
                            allow_drop: props.allow_drop.clone(),
                            dragged_key: props.dragged_key.clone(),
                            drop_target: props.drop_target.clone(),
                            drag_over_key: props.drag_over_key.clone(),
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
        tairitsu_macros::scss! { file: "src/styles/components/drag.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "drag"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> Vec<DragTreeNodeData> {
        vec![DragTreeNodeData {
            item_key: "alpha".to_string(),
            title: "Alpha".to_string(),
            node_children: vec![DragTreeNodeData {
                item_key: "beta".to_string(),
                title: "Beta".to_string(),
                node_children: Vec::new(),
                disabled: false,
            }],
            disabled: false,
        }]
    }

    fn render() -> String {
        DragDropTree(DragDropTreeProps {
            data: sample(),
            ..Default::default()
        })
        .render_to_html()
    }

    #[test]
    fn drag_tree_renders_its_handle_and_the_recursive_rows() {
        let html = render();
        assert!(html.contains("hk-drag-drop-tree"), "{html}");
        assert!(html.contains("hk-drag-handle"), "{html}");
        assert!(html.contains("hk-drag-handle-icon"), "{html}");
        assert!(html.contains("Alpha"), "the root row must paint: {html}");
        assert!(html.contains("Beta"), "the child row must paint: {html}");
    }

    #[test]
    fn drag_tree_rows_carry_no_native_draggable_attribute() {
        // L86: the reorder is MOUSE-driven. A native HTML5 drag would steal the
        // gesture — once the browser starts one it stops delivering
        // `mousemove`, so the mouse path would go dead exactly where the old
        // `drag*` bindings were. The attribute therefore has to stay absent;
        // this guards a well-meaning "restore the drop zone" edit.
        let html = render();
        assert!(
            !html.contains("draggable"),
            "rows must not opt into native drag-and-drop: {html}"
        );
    }

    #[test]
    fn a_click_on_a_row_commits_no_drop() {
        // The click sequence: press row A (arm -> dragged = A), no movement, release
        // on row A. Native DnD never fired `drop` here because `dragstart` needs
        // real movement; `mousedown` + `mouseup` alone do not, so the commit has
        // to reject the self-target. This is the predicate the drop handler gates
        // on, so a regression in the grammar shows up here.
        assert!(
            !drag_drop_moves("alpha", "alpha"),
            "a press-and-release on the same row is a CLICK, not a reorder"
        );
    }

    #[test]
    fn a_release_on_another_row_commits_the_drop() {
        assert!(drag_drop_moves("alpha", "beta"));
        assert!(drag_drop_moves("beta", "alpha"));
        // Nested rows are different keys, so a child -> parent drop stays a
        // reorder (that is how a node becomes a child of another).
        assert!(drag_drop_moves("beta", "alpha"));
    }

    #[test]
    fn the_drop_rule_matches_the_header_picker_reorder_rule() {
        use crate::layout::header_picker::header_reorder_indices;
        // Same `from == to` rejection, expressed for string keys here and for
        // indices there — keep the two grammars in step.
        assert_eq!(header_reorder_indices(1, 1, 3), None);
        assert!(!drag_drop_moves("k", "k"));
        assert_eq!(header_reorder_indices(0, 1, 3), Some((0, 1)));
        assert!(drag_drop_moves("k0", "k1"));
    }
}
