// hi-components/src/data/drag.rs
// DragDropTree — the legacy tree reorder surface (`RenderDragNode` renders one
// recursive node row with its drag handle, ghost and drop line).
//
// L88 DELTA: THIS IS A MOUSE-DRIVEN REORDER, NOT A NATIVE HTML5 DRAG.
// The rows used to carry `draggable="true"` plus `dragstart` / `dragend` /
// `dragover` / `dragleave` / `drop` with `DragEvent` handlers. The tairitsu
// browser glue type-dispatches only the mouse family (plus keyboard, focus and
// `input`/`change`) and routes every `drag*`/`drop` event through
// `onGenericEvent`, whose payload is the type string and a live handle with no
// data, so the `DragEvent` downcast never matched and the whole reorder path
// was inert on a real device (ledger L88).
//
// The gesture never actually needed `DataTransfer`: the state lives in the
// component's own signals (`dragged_key` / `drag_over_key` / `drop_target`), and
// the only `data_transfer` use in this file was a no-op placeholder plus one
// `set_data` call that existed for native-DnD interop. So the reorder is
// REBOUND onto the mouse family, one edge per event:
//
//   dragstart  -> `mousedown` RECORDS the press, `mousemove` ARMS it past
//                 `DRAG_ARM_PX` (Vue's two steps exactly)
//   dragover   -> `mouseenter`  highlight the row under the pointer
//   dragleave  -> `mouseleave`  clear the highlight
//   drop       -> `mouseup`     commit `DropEvent` (left button only; the row
//                               stops propagation so a nested row cannot
//                               commit a second drop — the same guard the old
//                               `ondrop` ran; and only when the release landed
//                               on a DIFFERENT row — see the grammar note)
//   dragend    -> the release edges: the row's own `mouseup` clears the
//                 gesture, the tree root's `mouseup` clears one that landed on
//                 tree padding, and a `mouseenter` reporting `buttons == 0`
//                 while a row is still armed retires a release that happened
//                 OUTSIDE the tree (there is no window-listener seam —
//                 `tairitsu_vdom::DomOps` is element-scoped — so the button
//                 state is the closest reliable signal, the same fallback
//                 `basic/slider.rs` and `scene/kanban.rs` carry).
//
// GRAMMAR — MATCHES THE CANONICAL. Two independent gates, one per Vue rule:
//
//   1. ARMING (`drag_press_armed`): a press only becomes a drag once the pointer
//      has moved past `DRAG_ARM_PX` (5px — `HkDraggableList.tsx:26`, applied at
//      `:227-238`). Until then it is a plain click-in-progress: NO ghost, no
//      drag state, no `prevent_default`, exactly Vue's rule ("a clickable row
//      keeps its tap action and a jittered tap never flashes a ghost"). Arming
//      is when the drag publishes: the ghost rises, `dragged_key` is written and
//      `allow_drag` fires (a notification, at arm time — not on every press).
//      Arming can happen on the row's `mousemove` OR on entering any row, since
//      a fast flick may leave the source row before a move event lands on it;
//      the source key always comes from the pending press, never from the row
//      entered, so a flick cannot arm the wrong node.
//   2. COMMIT (`drag_drop_moves`): a release on the row the press started from is
//      a CLICK, not a reorder — the same `from == to` rejection
//      `layout::header_picker::header_reorder_indices` applies — and it retires
//      the gesture WITHOUT an emit. So press -> move 10px inside the same row ->
//      release is a cancelled drag in both forms, and only that path's ghost is
//      taken down by the release rather than by a commit.
//
// LEAVING THE SURFACE is the `window pointerup` substitute (`drag_leave_action`):
// a pending press is retired outright (nothing was armed), and an armed drag is
// retired unless a drag-over target survived the exit — which is what clears a
// ghost left behind by a release over the OS chrome, where no further event can
// arrive. In the current binding the row's own `mouseleave` clears the highlight
// before the root's handler runs, so an exit from the tree retires the drag; the
// keep-alive branch still encodes the intended precedence for a surface that
// exits with a target still under the pointer.
//
// Declared consequences (nothing faked):
//   * the rows NO LONGER carry the `draggable` attribute: a native drag would
//     steal the gesture from the mouse path (the browser stops delivering
//     `mousemove` once it starts a native drag), so keeping it would break the
//     reorder it used to enable. The `draggable` / `disabled` gate that attribute
//     enforced in the browser is now checked explicitly in the press handler, so
//     an unmarked row still cannot start a gesture;
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

use std::cell::RefCell;

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

/// Vue's press-to-drag ARM DISTANCE (`HkDraggableList.tsx:26`, applied at
/// `:227-238`): a plain click must never start a drag, so the ghost only rises
/// once the pointer has moved past this many px. Vue's own comment: "a plain
/// click on a row (or its handle) never starts a drag … so a clickable row keeps
/// its tap action and a jittered tap never flashes a ghost".
pub const DRAG_ARM_PX: f64 = 5.0;

/// Whether a press that started at (`from_x`, `from_y`) has crossed
/// [`DRAG_ARM_PX`] by (`to_x`, `to_y`).
///
/// Mirrors Vue's `Math.hypot(...) <= ARM_PX` early return, so arming needs
/// STRICTLY more than 5px: a 5px jitter is still a click.
pub fn drag_press_armed(from_x: i32, from_y: i32, to_x: i32, to_y: i32) -> bool {
    let dx = f64::from(to_x - from_x);
    let dy = f64::from(to_y - from_y);
    dx.hypot(dy) > DRAG_ARM_PX
}

/// What a pointer leaving the drag surface does to the gesture in flight.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum DragLeaveAction {
    /// Nothing to retire: leave the state alone.
    Keep,
    /// Retire the gesture — the pending press, the arm and the ghost.
    Retire,
}

/// The `window pointerup` substitute for [`DragLeaveAction`].
///
/// Vue ends a drag on a document-level `pointerup`; a component here has no
/// document/window seam (`tairitsu_vdom::DomOps` is element-scoped), so leaving
/// the surface is the closest edge. Two cases:
///
/// * a PENDING press (nothing armed yet) is retired outright — no drag was ever
///   published, so nothing is abandoned;
/// * an ARMED drag is retired only when no drag-over target survived the exit.
///   That is what kills a ghost left behind when the release happened over the
///   OS chrome (no further event will ever arrive), while a drag that still has
///   a target keeps going.
pub fn drag_leave_action(
    pending_press: bool,
    armed: bool,
    drag_over: Option<&str>,
) -> DragLeaveAction {
    if pending_press || (armed && drag_over.is_none()) {
        DragLeaveAction::Retire
    } else {
        DragLeaveAction::Keep
    }
}

thread_local! {
    /// The press that has not yet crossed [`DRAG_ARM_PX`]: `(source key, origin
    /// x, origin y)`.
    ///
    /// Non-reactive by design: Vue keeps the same thing in a local `press`
    /// object, and it has to outlive the re-render a signal write would trigger,
    /// so a module cell is the house pattern here (the same shape as
    /// `scene/board.rs`'s press latch and `basic/slider.rs`'s drag flag).
    static PENDING_PRESS: RefCell<Option<(String, i32, i32)>> = const { RefCell::new(None) };
}

/// Record a press that may still become a drag.
fn pending_press_begin(key: String, x: i32, y: i32) {
    PENDING_PRESS.with(|slot| *slot.borrow_mut() = Some((key, x, y)));
}

/// Read the pending press without consuming it.
fn pending_press_peek() -> Option<(String, i32, i32)> {
    PENDING_PRESS.with(|slot| slot.borrow().clone())
}

/// Drop the pending press (armed, released, or retired by a leave).
fn pending_press_clear() {
    PENDING_PRESS.with(|slot| *slot.borrow_mut() = None);
}

/// Arm the drag once the press has crossed [`DRAG_ARM_PX`] — the canonical
/// "only now does the drag publish, the ghost rise, and the gesture claim its
/// defaults" step (`HkDraggableList.tsx:227-238`). Until then the press stays a
/// plain click-in-progress.
///
/// Called from BOTH the row's `mousemove` and its `mouseenter`: a fast flick can
/// leave the source row before any move event lands on it, so entering another
/// row must be able to arm too. The source key always comes from the pending
/// press, never from the row the pointer entered, which is what keeps a flick
/// across rows from arming the wrong node.
fn drag_try_arm(
    event: &MouseEvent,
    dragged_key: &Signal<Option<String>>,
    allow_drag: &Option<EventHandler<(String, bool)>>,
) {
    let Some((key, from_x, from_y)) = pending_press_peek() else {
        return;
    };
    if !drag_press_armed(from_x, from_y, event.client_x, event.client_y) {
        return;
    }
    pending_press_clear();
    // Deferred until now, exactly like Vue: before the threshold the press keeps
    // its native semantics (no selection claim, no drag).
    event.prevent_default();
    // `allow_drag` is a NOTIFICATION, not a veto: its handler returns unit, so it
    // cannot decline the gesture (the old `can_drag` local was `true` on both
    // branches). It fires here, at ARM time — "a drag started" — not on every
    // press. A host that must refuse a row keeps `draggable` false for it.
    if let Some(handler) = allow_drag.as_ref() {
        handler.call((key.clone(), true));
    }
    dragged_key.set(Some(key));
}

/// The COMMIT step of a release, extracted so it can be driven without a DOM.
///
/// This is the code the row's `mouseup` handler runs, not a predicate standing in
/// for it: it reads the armed key, applies [`drag_drop_moves`], fires
/// `allow_drop` / `on_drop`, and retires the gesture either way. Keeping the
/// DECISION in here (rather than `let moved = …` in the closure) is deliberate —
/// a test can then prove the handler's use of the rule, which a test of the
/// predicate alone cannot.
///
/// Returns the emitted [`DropEvent`], if any, so a caller (a test) can assert on
/// it; the component ignores the value.
pub fn drag_commit_drop(
    dragged_key: &Signal<Option<String>>,
    drag_over_key: &Signal<Option<String>>,
    drop_target: &Signal<Option<DropTarget>>,
    target_key: &str,
    allow_drop: &Option<EventHandler<(DropTarget, bool)>>,
    on_drop: &Option<EventHandler<DropEvent>>,
) -> Option<DropEvent> {
    pending_press_clear();

    let dragged = dragged_key.read()?;
    let mut emitted = None;

    // A release on the row the press started from is a CLICK, not a reorder.
    if drag_drop_moves(&dragged, target_key) {
        let position = DropPosition::Inside;
        let target = DropTarget {
            target_key: target_key.to_string(),
            position,
        };

        // `allow_drop` is a NOTIFICATION, not a veto: its handler returns unit, so
        // it cannot decline the drop (the old code computed a `can_drop` that was
        // `true` on both paths). A host that must refuse a target refuses the
        // `on_drop` itself.
        if let Some(handler) = allow_drop.as_ref() {
            handler.call((target, true));
        }

        let event = DropEvent {
            dragged_key: dragged,
            target_key: target_key.to_string(),
            position,
        };
        if let Some(handler) = on_drop.as_ref() {
            handler.call(event.clone());
        }
        emitted = Some(event);
    }

    // Retired either way: a cancelled drag must take its ghost down.
    dragged_key.set(None);
    drag_over_key.set(None);
    drop_target.set(None);
    emitted
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

    // End-of-gesture edges for the whole surface (Vue's `dragend`, L88 delta):
    // a release that lands on tree PADDING never reaches a row, and a release
    // that leaves the tree never reaches it at all — the root retires the first,
    // and drops the highlight while the pointer is away for the second (the
    // arm survives a leave, so dragging back in still resolves).
    let root_dragged = dragged_key.clone();
    let root_over = drag_over_key.clone();
    let root_target = drop_target.clone();
    // The leave handler both reads and clears the state, so it needs its own
    // clones (it has to read `drag_over_key` BEFORE dropping the highlight).
    let root_over_leave = drag_over_key.clone();
    let root_dragged_leave = dragged_key.clone();
    let root_target_leave = drop_target.clone();

    rsx! {
        div { class: format!("hk-drag-drop-tree {}", props.class),
            onmouseup: move |_event: MouseEvent| {
                pending_press_clear();
                root_dragged.set(None);
                root_over.set(None);
                root_target.set(None);
            },
            // Vue ends a drag on its window `pointerup`; the closest edge a
            // component owns is leaving the surface. A PENDING press is retired
            // outright (nothing was armed, so nothing is abandoned) and an ARMED
            // drag is retired unless a drag-over target survived the exit — see
            // [`drag_leave_action`]. That is what clears a ghost left behind by a
            // release over the OS chrome, where no further event will ever come.
            onmouseleave: move |_event: MouseEvent| {
                let action = drag_leave_action(
                    pending_press_peek().is_some(),
                    root_dragged_leave.read().is_some(),
                    root_over_leave.read().as_deref(),
                );
                root_over_leave.set(None);
                if action == DragLeaveAction::Retire {
                    pending_press_clear();
                    root_dragged_leave.set(None);
                    root_target_leave.set(None);
                }
            },

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

    // `dragstart` -> `mousedown` records the PRESS + `mousemove` arms it past
    // `DRAG_ARM_PX` (Vue's two steps exactly: pointerdown stores the press,
    // pointermove publishes the drag). Before the threshold this is a plain
    // click-in-progress: no ghost, no drag state, no `prevent_default`.
    let draggable = props.draggable;
    let on_press = move |event: MouseEvent| {
        // The element-level `draggable` attribute used to keep a non-draggable or
        // disabled row from ever starting a gesture (the browser simply fired no
        // `dragstart`). With the attribute gone the same gate has to be explicit,
        // or every call into an unmarked row would arm a reorder.
        if !draggable || disabled {
            return;
        }
        pending_press_begin(item_key_2.clone(), event.client_x, event.client_y);
    };

    // The arming edge (Vue's window `pointermove`). A press only becomes a drag
    // once it has crossed the threshold, which is also when the ghost rises.
    let dragged_key_for_move = props.dragged_key.clone();
    let allow_drag_for_move = props.allow_drag.clone();
    let on_move = move |event: MouseEvent| {
        drag_try_arm(&event, &dragged_key_for_move, &allow_drag_for_move);
    };

    // `dragover` -> `mouseenter`: highlight the row under the pointer, once
    // (the old `dragover` repeated this on every frame). A row entered with NO
    // button held while a drag is still armed means the release happened
    // outside the tree, where no listener could see it — retire the gesture
    // instead of highlighting, so a stale drop line can never survive.
    let dragged_key_for_over = props.dragged_key.clone();
    let allow_drag_for_over = props.allow_drag.clone();
    let drag_over_key_for_over = props.drag_over_key.clone();
    let drop_target_for_over = props.drop_target.clone();
    let on_drag_over = move |event: MouseEvent| {
        // A fast flick can leave the source row before any move event lands on
        // it, so entering another row may also arm — from the PENDING key.
        drag_try_arm(&event, &dragged_key_for_over, &allow_drag_for_over);
        if dragged_key_for_over.read().is_none() {
            return;
        }
        if event.buttons == 0 {
            pending_press_clear();
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
        drag_commit_drop(
            &dragged_key_for_drop,
            &drag_over_key_for_drop,
            &drop_target_for_drop,
            &item_key_4,
            &allow_drop_for_drop,
            &on_drop_for_drop,
        );
    };

    rsx! {
        div {
            class: drag_node_classes,
            // NO `draggable` attribute: a native drag would steal the gesture
            // from the mouse path (see the header delta).
            onmousedown: on_press,
            onmousemove: on_move,
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
        // L88: the reorder is MOUSE-driven. A native HTML5 drag would steal the
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

    /// Records what the component emits, so a test can assert on the handler's
    /// real output rather than on a predicate standing in for it.
    #[derive(Clone, Default)]
    struct Emitted {
        drops: std::rc::Rc<std::cell::RefCell<Vec<DropEvent>>>,
        allows: std::rc::Rc<std::cell::RefCell<Vec<DropTarget>>>,
    }

    /// The two handlers a commit step takes, aliased to keep the helper's
    /// signature readable (and `clippy::type_complexity` quiet).
    type DropHandler = Option<EventHandler<DropEvent>>;
    type AllowDropHandler = Option<EventHandler<(DropTarget, bool)>>;

    fn emitted() -> (Emitted, DropHandler, AllowDropHandler) {
        let sink = Emitted::default();
        let drops = sink.clone();
        let on_drop = EventHandler::new(move |event: DropEvent| {
            drops.drops.borrow_mut().push(event);
        });
        let allows = sink.clone();
        let allow_drop = EventHandler::new(move |(target, _ok): (DropTarget, bool)| {
            allows.allows.borrow_mut().push(target);
        });
        (sink, Some(on_drop), Some(allow_drop))
    }

    #[test]
    fn a_click_never_commits_a_drop_through_the_handler() {
        // THE HANDLER, not the predicate: this drives `drag_commit_drop`, the
        // exact step the row's `mouseup` runs. Short-circuiting its gate
        // (`drag_drop_moves` -> `true`) has to red THIS test — a predicate-only
        // test would stay green, which is how the click-commits-drop-to-self
        // regression class got in once already.
        let (sink, on_drop, allow_drop) = emitted();
        let dragged = Signal::new(Some("alpha".to_string()));
        let over = Signal::new(Some("alpha".to_string()));
        let target = Signal::new(None::<DropTarget>);

        let out = drag_commit_drop(&dragged, &over, &target, "alpha", &allow_drop, &on_drop);

        assert!(
            out.is_none(),
            "a click on the source row must commit nothing"
        );
        assert!(
            sink.drops.borrow().is_empty(),
            "the host must not receive a DropEvent: {:?}",
            sink.drops.borrow()
        );
        assert!(
            sink.allows.borrow().is_empty(),
            "`allow_drop` must not fire for a cancelled drag"
        );
        // The gesture is retired either way (this is what takes the ghost down).
        assert!(dragged.read().is_none(), "the arm must be cleared");
        assert!(over.read().is_none(), "the highlight must be cleared");
    }

    #[test]
    fn a_release_on_another_row_commits_through_the_handler() {
        // Positive control for the same step: the gate must still let a real
        // reorder through, with the canonical payload.
        let (sink, on_drop, allow_drop) = emitted();
        let dragged = Signal::new(Some("alpha".to_string()));
        let over = Signal::new(Some("beta".to_string()));
        let target = Signal::new(None::<DropTarget>);

        let out = drag_commit_drop(&dragged, &over, &target, "beta", &allow_drop, &on_drop);

        let event = out.expect("a drag onto another row must commit");
        assert_eq!(event.dragged_key, "alpha");
        assert_eq!(event.target_key, "beta");
        assert_eq!(event.position, DropPosition::Inside);
        assert_eq!(sink.drops.borrow().len(), 1, "the host receives it once");
        assert_eq!(sink.allows.borrow().len(), 1, "allow_drop fires once");
        assert!(dragged.read().is_none(), "the arm retires after the commit");
    }

    #[test]
    fn a_sub_threshold_press_switches_no_ghost_on() {
        // The ARM STEP the row's `mousemove` runs, driven directly. Forcing
        // `drag_press_armed` to `true` has to red THIS test: a click must leave
        // `dragged_key` untouched, which is what keeps the ghost off.
        pending_press_clear();
        pending_press_begin("alpha".to_string(), 10, 10);
        let dragged = Signal::new(None::<String>);

        // 3px of jitter: still a click.
        drag_try_arm(
            &MouseEvent::new().client_x(12).client_y(13),
            &dragged,
            &None,
        );
        assert!(
            dragged.read().is_none(),
            "a click must not arm the drag, so no ghost can paint"
        );

        // The paint side of the same state: an unarmed node renders no ghost.
        let html = RenderDragNode(RenderDragNodeProps {
            node: DragTreeNodeData {
                item_key: "alpha".to_string(),
                title: "Alpha".to_string(),
                node_children: Vec::new(),
                disabled: false,
            },
            dragged_key: dragged.clone(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-drag-ghost"), "{html}");
        assert!(!html.contains("hk-drag-node-dragging"), "{html}");

        // 10px: past `DRAG_ARM_PX`, so the same press becomes a drag.
        drag_try_arm(
            &MouseEvent::new().client_x(20).client_y(10),
            &dragged,
            &None,
        );
        assert_eq!(
            dragged.read(),
            Some("alpha".to_string()),
            "past the threshold the drag publishes"
        );
        pending_press_clear();
    }

    #[test]
    fn arming_notifies_allow_drag_once_with_the_source_key() {
        // Arm-time notification (canonical shape): the host hears "a drag began",
        // with the PENDING key — never the row the pointer happened to enter.
        pending_press_clear();
        pending_press_begin("alpha".to_string(), 0, 0);
        let dragged = Signal::new(None::<String>);
        let seen = std::rc::Rc::new(std::cell::RefCell::new(Vec::<String>::new()));
        let sink = seen.clone();
        let allow_drag = EventHandler::new(move |(key, _ok): (String, bool)| {
            sink.borrow_mut().push(key);
        });

        // Sub-threshold: no notification at all.
        drag_try_arm(
            &MouseEvent::new().client_x(0).client_y(2),
            &dragged,
            &Some(allow_drag.clone()),
        );
        assert!(seen.borrow().is_empty(), "a click must not notify the host");

        drag_try_arm(
            &MouseEvent::new().client_x(9).client_y(0),
            &dragged,
            &Some(allow_drag),
        );
        assert_eq!(seen.borrow().as_slice(), ["alpha".to_string()]);
        assert_eq!(dragged.read(), Some("alpha".to_string()));
        pending_press_clear();
    }

    #[test]
    fn the_arm_threshold_matches_the_canonical_arm_px() {
        // Vue: `Math.hypot(dx, dy) <= ARM_PX` returns early, so arming needs
        // STRICTLY more than 5px. A click (no movement) and a 5px jitter are
        // both still clicks — the ghost must not rise for either.
        assert_eq!(DRAG_ARM_PX, 5.0);
        assert!(!drag_press_armed(0, 0, 0, 0), "a click never arms");
        assert!(!drag_press_armed(10, 10, 10, 10), "no movement never arms");
        assert!(
            !drag_press_armed(0, 0, 0, 5),
            "exactly ARM_PX is still a click"
        );
        assert!(!drag_press_armed(0, 0, 3, 4), "hypot == 5 is still a click");
        assert!(drag_press_armed(0, 0, 0, 6), "past the threshold arms");
        assert!(drag_press_armed(0, 0, 4, 4), "hypot 5.66 arms");
        // Negative coordinates are the same distance.
        assert!(!drag_press_armed(0, 0, -3, -4));
        assert!(drag_press_armed(0, 0, -4, -4));
    }

    #[test]
    fn releasing_outside_the_tree_retires_the_armed_ghost() {
        // Press, drag past the threshold, then the release happens over the OS
        // chrome: no `mouseup` and no later drag-over will ever arrive, so the
        // leave edge has to retire the drag or the ghost stays up for good.
        assert_eq!(
            drag_leave_action(false, true, None),
            DragLeaveAction::Retire
        );
    }

    #[test]
    fn exiting_with_a_drag_over_target_keeps_the_drag_alive() {
        // The keep-alive branch: a surface that exits with a target still under
        // the pointer keeps the drag, so a brief exit is not a cancel.
        assert_eq!(
            drag_leave_action(false, true, Some("beta")),
            DragLeaveAction::Keep
        );
    }

    #[test]
    fn leaving_with_only_a_pending_press_retires_it() {
        // Nothing was armed, so nothing is abandoned — but the press must not
        // survive the exit and arm later.
        assert_eq!(
            drag_leave_action(true, false, None),
            DragLeaveAction::Retire
        );
        // Nothing in flight at all: leaving is a no-op.
        assert_eq!(drag_leave_action(false, false, None), DragLeaveAction::Keep);
    }

    #[test]
    fn a_press_that_never_armed_paints_no_ghost() {
        // The paint side of the arm threshold: the ghost and `.is-dragging` are
        // driven purely by `dragged_key`, which only the ARM step writes — so a
        // click, which never arms, can never raise them.
        let idle = RenderDragNode(RenderDragNodeProps {
            node: DragTreeNodeData {
                item_key: "alpha".to_string(),
                title: "Alpha".to_string(),
                node_children: Vec::new(),
                disabled: false,
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(!idle.contains("hk-drag-ghost"), "{idle}");
        assert!(!idle.contains("hk-drag-node-dragging"), "{idle}");

        // And once a drag IS armed, the same node paints it.
        let armed = RenderDragNode(RenderDragNodeProps {
            node: DragTreeNodeData {
                item_key: "alpha".to_string(),
                title: "Alpha".to_string(),
                node_children: Vec::new(),
                disabled: false,
            },
            dragged_key: Signal::new(Some("alpha".to_string())),
            ..Default::default()
        })
        .render_to_html();
        assert!(armed.contains("hk-drag-ghost"), "{armed}");
        assert!(armed.contains("hk-drag-node-dragging"), "{armed}");
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
