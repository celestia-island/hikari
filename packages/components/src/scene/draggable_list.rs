// hi-components/src/scene/draggable_list.rs
// DraggableList — mirror of the canonical Vue `HkDraggableList`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDraggableList.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-draggable-list*` class names are literal and identical in both forms.
// DOM contract (mirrors the Vue render output, top to bottom):
//
//   div.hk-draggable-list [host class]
//        role="list" [aria-label={label}]
//        data-dragging=""                       (a drag is in flight; EMPTY value)
//        [data-all-locked="true"]               (EVERY row is locked: the sheet
//                                                collapses the grip lane)
//     div.hk-draggable-list-item                 (one per `items` entry, in order)
//          role="listitem"
//          [data-locked="true"] [data-dragging="true"]
//          [data-placeholder="before"|"after"]
//       span.hk-draggable-list-handle[data-hidden="true"]?
//         span[style="display:contents"] > <svg 14×14 six-dot grip>
//                                            (the `handle` slot wins over the grip)
//       div.hk-draggable-list-content
//         {item.content}                     (Vue: slots.item({item,index,locked}))
//       div.hk-draggable-list-actions        (only for an item with `actions`)
//         {item.actions}                     (Vue: slots.actions({item,index,locked}))
//
// `data-dragging` is deliberately spelled TWO ways because Vue does: the ROOT
// carries the empty value (Vue writes `s ? "" : undefined`) while a row's
// source marker carries `"true"` (Vue writes `isSource || undefined`, and the
// runtime serializes a boolean `true` as `"true"`).
//
// Prop mapping: `items` → [`DraggableListProps::items`] (each row is a
// [`DraggableListItem`] = `{key, content, actions}`), `lockedKeys` →
// `locked_keys`, `label` → `label` (Vue's `aria-label`), the `handle` slot →
// `handle`, the per-row `item` slot → each item's `content`, the `actions` slot
// → each item's `actions`.
//
// Controlled state (tairitsu 0.5.22 has no per-instance component state —
// ledger L48). Vue's `drag` shallowRef (`{fromIndex, placeholderIndex, originX,
// originY, grabOffsetX, grabOffsetY}`) becomes the controlled pair
// `dragging_index` + `placeholder_index` (the placeholder defaults to the source
// row, exactly the value Vue writes when it arms a drag); the lifecycle leaves
// through
// `on_drag_start` / `on_drag_over` / `on_drop` / `on_drag_end`. Nothing is
// stored here — not even the press bookkeeping Vue keeps OUTSIDE its reactive
// state (`press`, `swallowClickAt`), which is why those two rules ship as pure
// predicates instead (see the deltas).
//
// Deltas vs Vue (documented, not accidental):
//   * NO DRAG ENGINE. Pointer capture, the window-level pointermove/pointerup
//     listeners, the `getBoundingClientRect()` midpoints, the `onceFrame` gate,
//     the cloned-`outerHTML` ghost, the `ancestorZoom` division, the reported
//     transition and the autoscroll window are measurement / animation APIs the
//     Rust form does not have. The mirror renders the STATE they produce — the
//     dimmed source row, the `before` / `after` insertion marker — from props.
//   * The press is PUBLISHED, not claimed: `on_drag_start` fires from the row's
//     `mousedown` (Vue: pointerdown with `e.button !== 0` filtered — the mirror
//     keeps that filter) and nothing calls `preventDefault`, so a plain tap
//     keeps its native click semantics exactly as Vue's unarmed press does.
//     Vue's `target.closest("button, a, input, textarea, select,
//     [contenteditable]")` guard needs DOM introspection; a host that must keep
//     those clicks simply does not publish `dragging_index`.
//   * MOUSE events, not pointer events. On wasm32-wasip2 the tairitsu browser
//     glue gives only the mouse family a typed `MouseEvent` payload and routes
//     `pointer*` (with touch/transition/animation) through the generic event
//     channel, so a `PointerEvent` handler never fires on the real target
//     (evidence: `tairitsu/packages/browser-glue/dist/runtime/eventTarget.js`
//     vs `packages/web/src/wit_platform.rs`). Touch/pen presses are therefore
//     the host's to observe.
//   * Vue's press-to-drag arm (`ARM_PX = 5`, a hysteresis so a clickable row
//     keeps its tap action and a jittered tap never flashes a ghost) needs the
//     press ORIGIN held across events — per-instance state the mirror does not
//     have. [`draggable_list_armed`] is the rule itself, so a host that watches
//     its own pointermove (on its row content) publishes `dragging_index` only
//     once the pointer crossed the threshold, and the resulting DOM matches
//     Vue's frame for frame.
//   * Vue's capture-phase click guard (`SWALLOW_CLICK_MS = 300`: the click a
//     finished drag leaves behind must not also activate the row it was
//     dropped on) is bound imperatively on the root and needs a timestamp
//     captured at release. [`draggable_list_swallow_click`] is the predicate;
//     the HOST owns the timestamp (`on_drop` / `on_drag_end` mark the moment)
//     because a mirror-side registry would be shared by every instance.
//   * `on_drag_over` is the row's `mouseenter` — the browser's own hit test —
//     instead of a window pointermove plus rect midpoints. The walk itself
//     stays available as pure arithmetic
//     ([`draggable_list_placeholder_for`]), including its "skip the source row,
//     skip locked rows, skip unmeasured rows" chain, so a host that measures
//     its own rows reproduces Vue's placeholder index exactly. Vue's trailing
//     `if (target === fromIndex && fallback !== fromIndex)` correction is NOT
//     ported: every eligible row assigns `target` on the way through the loop,
//     so `target === fromIndex` implies `fallback === fromIndex` — the arm is
//     unreachable in Vue as well.
//   * The release is observed on the ROOT (`mouseup`) where Vue listens on
//     `window`; a release outside the list therefore ends the HOST's drag, not
//     this component's. The payload is Vue's `reorder(fromIndex, toIndex)`,
//     emitted only when the placeholder moved off the source row and is still a
//     legal row index (see [`draggable_list_drop`] — a host-supplied index is
//     not trusted the way Vue's internal one could be).
//   * The `actions` lane is per ITEM (`DraggableListItem::actions`) where Vue's
//     `slots.actions` is one component-level slot rendered on EVERY row: a host
//     that fills every item reproduces Vue's DOM byte for byte, one that fills
//     none renders Vue's no-slot DOM, and the mixed case — impossible in Vue —
//     renders the lane only where it was given.
//   * The ghost (`div.hk-draggable-list-ghost`) is NOT rendered: cloning and
//     measuring is exactly what is missing. The sheet's ghost rules are still
//     registered with the component, so a host overlay that opts into that
//     class paints identically.
//   * The grip is mounted through `dangerous_inner_html` on its own
//     `style="display:contents"` host (ledger L49: an `rsx!` `svg {}` child is
//     created in the HTML namespace and never paints). `display: contents`
//     keeps the glyph a flex item of the handle exactly as Vue's inline `<svg>`
//     is. The markup is a constant — no consumer string enters it, so no
//     escaper runs.
//   * No i18n: the component renders no user-facing string (the grip is a
//     drawing, and the only accessible name is the host's `label`), so this file
//     adds ZERO `hikari_i18n::t` keys.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DraggableListComponent;

/// Vue: `ARM_PX = 5` — how far the pointer must travel before a press becomes a
/// drag.
pub const DRAGGABLE_LIST_ARM_PX: f64 = 5.0;

/// Vue: `SWALLOW_CLICK_MS = 300` — how long after a drop the release click still
/// belongs to the drag.
pub const DRAGGABLE_LIST_SWALLOW_CLICK_MS: f64 = 300.0;

const LIST_ROOT: &str = "hk-draggable-list";
const LIST_ITEM: &str = "hk-draggable-list-item";
const LIST_HANDLE: &str = "hk-draggable-list-handle";
const LIST_CONTENT: &str = "hk-draggable-list-content";
const LIST_ACTIONS: &str = "hk-draggable-list-actions";

/// Vue's `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">`
/// six-dot grip (the same drawing the grid uses), serialized as the inner markup
/// of its `display:contents` host.
const LIST_GRIP_SVG: &str = concat!(
    r#"<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">"#,
    r#"<circle cx="4" cy="3" r="1.2"/>"#,
    r#"<circle cx="4" cy="7" r="1.2"/>"#,
    r#"<circle cx="4" cy="11" r="1.2"/>"#,
    r#"<circle cx="10" cy="3" r="1.2"/>"#,
    r#"<circle cx="10" cy="7" r="1.2"/>"#,
    r#"<circle cx="10" cy="11" r="1.2"/>"#,
    r#"</svg>"#,
);

// ── shapes ───────────────────────────────────────────────────────────────

/// One row (Vue: `DragListItem` + the `item` slot's output, plus the optional
/// `actions` lane). Vue's `locked?: boolean` field is intentionally absent: the
/// component only ever reads `lockedKeys`.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DraggableListItem {
    /// Stable identity — the row's patch key and the payload the host keys its
    /// model by.
    pub key: String,

    /// The row body (Vue: `slots.item({ item, index, locked })`).
    pub content: Element,

    /// The right-pinned actions lane (Vue: `slots.actions({ item, index,
    /// locked })`). `None` renders no lane at all.
    pub actions: Option<Element>,
}

impl DraggableListItem {
    pub fn new(key: impl Into<String>, content: Element) -> Self {
        Self {
            key: key.into(),
            content,
            actions: None,
        }
    }

    /// Attach the trailing actions lane (Vue: the `actions` slot).
    pub fn with_actions(mut self, actions: Element) -> Self {
        self.actions = Some(actions);
        self
    }
}

/// The drag-start / drag-end payload (Vue: the `(index, item)` a pointerdown
/// resolved to; the key rides along so the host does not re-resolve it).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DraggableListDrag {
    pub from: usize,
    pub key: String,
}

/// The drop payload — Vue's `emit("reorder", fromIndex, toIndex)`.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DraggableListDrop {
    pub from: usize,
    pub to: usize,
}

// ── pure functions (the index math the drag engine ran on) ───────────────

/// Vue's `isLocked(key)`: membership in `lockedKeys`.
pub fn draggable_list_is_locked(key: &str, locked_keys: &[String]) -> bool {
    locked_keys.iter().any(|locked| locked == key)
}

/// Vue's `allLocked` root marker — `items.length > 0 && items.every(isLocked)`.
/// An EMPTY list is not all-locked: there is no lane to collapse.
pub fn draggable_list_all_locked(items: &[DraggableListItem], locked_keys: &[String]) -> bool {
    !items.is_empty()
        && items
            .iter()
            .all(|item| draggable_list_is_locked(&item.key, locked_keys))
}

/// Vue's `drag != null` gate, spelled the controlled way: a drag is in flight
/// as soon as the host published a source index that still addresses a row of
/// the CURRENT list. `placeholder_index` is NOT a second gate — Vue derives it
/// from the source at press time (see [`draggable_list_placeholder_row`]).
pub fn draggable_list_drag_active(from: Option<usize>, len: usize) -> bool {
    from.is_some_and(|from| from < len)
}

/// Vue's `drag.placeholderIndex`, resolved: the host's row while it still
/// addresses the CURRENT list, else the SOURCE index — the value Vue
/// initialises on press, before the pointer has moved anywhere.
pub fn draggable_list_placeholder_row(
    placeholder: Option<usize>,
    from: Option<usize>,
    len: usize,
) -> Option<usize> {
    let from = from.filter(|from| *from < len)?;
    Some(placeholder.filter(|index| *index < len).unwrap_or(from))
}

/// Vue: `s.fromIndex === index`.
pub fn draggable_list_row_is_source(from: Option<usize>, index: usize) -> bool {
    from.is_some_and(|from| from == index)
}

/// Vue's `placeholderDir` for one row: only the row UNDER the placeholder, and
/// never the source row, draws an edge — `before` while the placeholder sits
/// above the source, `after` while it sits below (the row the item will
/// occupy once the move applies).
pub fn draggable_list_placeholder_dir(
    from: Option<usize>,
    placeholder: Option<usize>,
    index: usize,
) -> Option<&'static str> {
    let from = from?;
    let placeholder = placeholder?;
    if placeholder != index || from == index {
        return None;
    }
    Some(if placeholder < from {
        "before"
    } else {
        "after"
    })
}

/// Vue's `recomputePlaceholder` row walk: the first eligible row whose vertical
/// midpoint lies below the pointer wins, otherwise the LAST eligible row does
/// (Vue assigns `target = i` on the way through). A row is ineligible when it is
/// the source row, locked, or unmeasured — `mids` carries `None` for the last
/// case, and a row missing from `locked` counts as dead exactly like Vue's
/// `!item` / `!el` skips.
pub fn draggable_list_placeholder_for(
    client_y: f64,
    mids: &[Option<f64>],
    from_index: usize,
    locked: &[bool],
) -> usize {
    let mut target = from_index;
    for (index, mid) in mids.iter().enumerate() {
        if index == from_index {
            continue;
        }
        if locked.get(index).copied().unwrap_or(true) {
            continue;
        }
        let Some(mid) = mid else { continue };
        target = index;
        if client_y < *mid {
            break;
        }
    }
    target
}

/// Vue's `reorder` emit guard: a drop exists only when the placeholder moved
/// off the source row AND both indices still address the current list (a
/// host-supplied index is not the trusted internal state Vue's was).
pub fn draggable_list_drop(
    from: Option<usize>,
    placeholder: Option<usize>,
    len: usize,
) -> Option<DraggableListDrop> {
    let (from, to) = (from?, placeholder?);
    if from == to || from >= len || to >= len {
        return None;
    }
    Some(DraggableListDrop { from, to })
}

/// The row ORDER Vue's `reorder(fromIndex, toIndex)` implies: the moved row is
/// removed from `from` and inserted at `to` (its own final index), every other
/// row keeping its relative order. Returns the original indices in their new
/// positions — the host re-derives nothing.
pub fn draggable_list_reordered(len: usize, from: usize, to: usize) -> Option<Vec<usize>> {
    if len == 0 || from >= len || to >= len {
        return None;
    }
    let mut order: Vec<usize> = (0..len).collect();
    let moved = order.remove(from);
    order.insert(to, moved);
    Some(order)
}

/// Vue's press-to-drag arm: a press becomes a drag only once the pointer is
/// FARTHER than `ARM_PX` from where it went down (`Math.hypot`), so a jittered
/// tap never flashes a ghost. The exact boundary stays a click.
pub fn draggable_list_armed(dx: f64, dy: f64) -> bool {
    dx.hypot(dy) > DRAGGABLE_LIST_ARM_PX
}

/// Vue's capture-phase click guard: a click arriving within
/// `SWALLOW_CLICK_MS` of the release belongs to the finished drag and must be
/// swallowed. `elapsed_ms` is measured by the host from the drop; a NaN reading
/// swallows nothing.
pub fn draggable_list_swallow_click(elapsed_ms: f64) -> bool {
    elapsed_ms <= DRAGGABLE_LIST_SWALLOW_CLICK_MS
}

// ── marker spellings (Vue's two presence conventions) ────────────────────

/// Vue's `flag || undefined`: `data-*` carries `"true"` while the flag is on
/// and is genuinely ABSENT otherwise.
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// Vue's `cond ? "" : undefined`: the attribute is PRESENT with an empty value
/// (`data-dragging={s ? "" : undefined}` on the root).
fn empty_marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("") } else { None }
}

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an `rsx!` `svg {}`
/// child would be an HTML element, and the host must not add a box).
fn grip_host(markup: &str) -> VNode {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

// ── the emit path (Vue's four lifecycle points, without a DOM) ──────────

/// Vue's `onPointerDown` up to (but excluding) the state write: a secondary
/// button or a locked row starts nothing. Returns what it published.
fn list_press(
    from: usize,
    key: &str,
    locked: bool,
    button: i16,
    handler: &Option<EventHandler<DraggableListDrag>>,
) -> Option<DraggableListDrag> {
    if locked || button != 0 {
        return None;
    }
    let payload = DraggableListDrag {
        from,
        key: key.to_string(),
    };
    if let Some(handler) = handler {
        handler.call(payload.clone());
    }
    Some(payload)
}

/// Vue's `recomputePlaceholder` "changed" branch: publish the row the pointer
/// entered — never the source row, never a locked one, never while no drag is in
/// flight.
fn list_over(
    over: usize,
    active: bool,
    source: bool,
    locked: bool,
    handler: &Option<EventHandler<usize>>,
) -> Option<usize> {
    if !active || source || locked {
        return None;
    }
    if let Some(handler) = handler {
        handler.call(over);
    }
    Some(over)
}

/// Vue's `onPointerUp` tail: the `reorder` emit, then the drag-end
/// notification (that order — Vue emits before it clears its state). Returns
/// both payloads it emitted, for the tests.
fn list_release(
    drop_payload: Option<DraggableListDrop>,
    end_payload: Option<DraggableListDrag>,
    on_drop: &Option<EventHandler<DraggableListDrop>>,
    on_drag_end: &Option<EventHandler<DraggableListDrag>>,
) -> (Option<DraggableListDrop>, Option<DraggableListDrag>) {
    if let (Some(payload), Some(handler)) = (drop_payload.clone(), on_drop) {
        handler.call(payload);
    }
    if let (Some(payload), Some(handler)) = (end_payload.clone(), on_drag_end) {
        handler.call(payload);
    }
    (drop_payload, end_payload)
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct DraggableListProps {
    /// The rows, in render order (Vue: `items`, required).
    #[default]
    pub items: Vec<DraggableListItem>,

    /// Row keys that may not be dragged (Vue: `lockedKeys`).
    #[default]
    pub locked_keys: Vec<String>,

    /// The list's accessible name (Vue: `aria-label` on the `role="list"` root;
    /// `""` renders no attribute — Vue's `props.label || undefined`).
    pub label: Option<String>,

    /// CONTROLLED: the source row index (Vue: `drag.fromIndex`).
    pub dragging_index: Option<usize>,

    /// CONTROLLED: the placeholder row index (Vue: `drag.placeholderIndex`).
    /// Optional — while the host has not published one, the source row stands
    /// in, the value Vue initialises on press.
    pub placeholder_index: Option<usize>,

    /// Custom grip glyph (Vue: the `handle` slot, one glyph for every row).
    pub handle: Option<Element>,

    /// Extra class appended to the root (Vue merges the fallthrough class).
    #[default]
    pub class: String,

    /// Fires when a press starts a drag candidate (Vue: `onPointerDown`).
    pub on_drag_start: Option<EventHandler<DraggableListDrag>>,

    /// Fires with the row index the pointer entered (Vue: the recomputed
    /// placeholder).
    pub on_drag_over: Option<EventHandler<usize>>,

    /// Fires with Vue's `reorder(fromIndex, toIndex)` payload when the drop is
    /// real.
    pub on_drop: Option<EventHandler<DraggableListDrop>>,

    /// Fires when a drag is released (Vue: `drag.value = null`).
    pub on_drag_end: Option<EventHandler<DraggableListDrag>>,
}

#[component]
pub fn DraggableList(props: DraggableListProps) -> Element {
    let len = props.items.len();
    let from = props.dragging_index.filter(|index| *index < len);
    let active = draggable_list_drag_active(from, len);
    // Vue's `drag` is ONE object whose `placeholderIndex` starts at the source
    // row: a host that has not published a slot yet paints Vue's unmoved state,
    // and a stale index never marks a row.
    let placeholder = draggable_list_placeholder_row(props.placeholder_index, from, len);

    let all_locked = draggable_list_all_locked(&props.items, &props.locked_keys);
    let drop_payload = draggable_list_drop(from, placeholder, len);
    let end_payload = from.map(|from| DraggableListDrag {
        from,
        key: props
            .items
            .get(from)
            .map(|item| item.key.clone())
            .unwrap_or_default(),
    });

    let mut item_nodes: Vec<VNode> = Vec::with_capacity(len);
    for (index, item) in props.items.iter().enumerate() {
        let locked = draggable_list_is_locked(&item.key, &props.locked_keys);
        let source = draggable_list_row_is_source(from, index);
        let dir = draggable_list_placeholder_dir(from, placeholder, index);

        let handle = VElement::new("span")
            .class(LIST_HANDLE)
            .attr("data-hidden", marker_attr(locked))
            .child(match props.handle.as_ref() {
                Some(slot) => slot.clone(),
                None => grip_host(LIST_GRIP_SVG),
            });
        let content = VElement::new("div")
            .class(LIST_CONTENT)
            .child(item.content.clone());

        let mut row = VElement::new("div")
            .class(LIST_ITEM)
            .attr("role", "listitem")
            .attr("data-locked", marker_attr(locked))
            .attr("data-dragging", marker_attr(source))
            .attr("data-placeholder", dir)
            .key(&item.key)
            .child(VNode::Element(Box::new(handle)))
            .child(VNode::Element(Box::new(content)));

        // The actions lane is a SIBLING of the content lane (never a child), so
        // the content lane's `> :only-child` fill keeps stretching single-root
        // rows even with actions attached.
        if let Some(actions) = item.actions.as_ref() {
            row = row.child(VNode::Element(Box::new(
                VElement::new("div")
                    .class(LIST_ACTIONS)
                    .child(actions.clone()),
            )));
        }

        // The handle is a CHILD of the row in Vue, and its own pointerdown only
        // stops propagation before calling the same entry point — so one
        // binding on the row is what the browser actually observes.
        let press_handler = props.on_drag_start.clone();
        let press_key = item.key.clone();
        row = row.on_mousedown(move |event: MouseEvent| {
            let _ = list_press(index, &press_key, locked, event.button, &press_handler);
        });

        let over_handler = props.on_drag_over.clone();
        if active && !locked && !source {
            row = row.on_mouseenter(move |_event: MouseEvent| {
                let _ = list_over(index, active, source, locked, &over_handler);
            });
        }

        item_nodes.push(VNode::Element(Box::new(row)));
    }

    let root_classes = if props.class.is_empty() {
        LIST_ROOT.to_string()
    } else {
        format!("{LIST_ROOT} {}", props.class)
    };
    // Vue writes `aria-label={props.label || undefined}`: an empty name is
    // ABSENT, not an empty attribute.
    let label = props.label.clone().filter(|label| !label.is_empty());
    let mut root = VElement::new("div")
        .class(root_classes)
        .attr("role", "list")
        .attr("aria-label", label)
        .attr("data-dragging", empty_marker_attr(active))
        .attr("data-all-locked", marker_attr(all_locked))
        .children(item_nodes);

    // Vue binds its release on `window`; a root-level `mouseup` sees every
    // release inside the surface (see the header delta for the rest).
    let release_drop = props.on_drop.clone();
    let release_end = props.on_drag_end.clone();
    root = root.on_mouseup(move |_event: MouseEvent| {
        let _ = list_release(
            drop_payload.clone(),
            end_payload.clone(),
            &release_drop,
            &release_end,
        );
    });

    VNode::Element(Box::new(root))
}

impl StyledComponent for DraggableListComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDraggableList.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "draggable-list"
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::rc::Rc;

    use super::*;

    fn row(key: &str) -> DraggableListItem {
        DraggableListItem::new(
            key,
            rsx! {
                span { class: "body", "{key}" }
            },
        )
    }

    fn list_items() -> Vec<DraggableListItem> {
        vec![row("a"), row("b"), row("c")]
    }

    fn locked_keys() -> Vec<String> {
        vec!["b".to_string()]
    }

    #[test]
    fn draggable_list_defaults_match_the_vue_props() {
        let props = DraggableListProps::default();
        assert!(props.items.is_empty());
        assert!(props.locked_keys.is_empty());
        assert!(props.label.is_none());
        assert!(props.dragging_index.is_none());
        assert!(props.placeholder_index.is_none());
        assert!(props.handle.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_drag_start.is_none());
        assert!(props.on_drag_over.is_none());
        assert!(props.on_drop.is_none());
        assert!(props.on_drag_end.is_none());
        // Vue's two timing constants, unchanged.
        assert_eq!(DRAGGABLE_LIST_ARM_PX, 5.0);
        assert_eq!(DRAGGABLE_LIST_SWALLOW_CLICK_MS, 300.0);
    }

    #[test]
    fn draggable_list_locks_cover_mixed_and_all_locked_lists() {
        assert!(draggable_list_is_locked("b", &locked_keys()));
        assert!(!draggable_list_is_locked("a", &locked_keys()));
        // The root marker needs EVERY row locked AND a non-empty list.
        assert!(!draggable_list_all_locked(&list_items(), &locked_keys()));
        // Every row locked is exactly the collapse case.
        assert!(draggable_list_all_locked(
            &list_items(),
            &["a".to_string(), "b".to_string(), "c".to_string()]
        ));
        let all = vec!["a".to_string(), "b".to_string(), "c".to_string()];
        assert!(draggable_list_all_locked(&list_items(), &all));
        // An empty list is not "all locked": there is no lane to collapse.
        assert!(!draggable_list_all_locked(&[], &all));
        assert!(!draggable_list_all_locked(&[], &[]));
    }

    #[test]
    fn draggable_list_drag_gate_tracks_the_source_index() {
        assert!(draggable_list_drag_active(Some(0), 3));
        assert!(draggable_list_drag_active(Some(2), 3));
        // No source → no drag.
        assert!(!draggable_list_drag_active(None, 3));
        // A stale index past the list is not a drag either.
        assert!(!draggable_list_drag_active(Some(3), 3));
        // The empty list can never carry one.
        assert!(!draggable_list_drag_active(Some(0), 0));
    }

    #[test]
    fn draggable_list_placeholder_defaults_to_the_source_row() {
        // An unpublished slot is the source row — Vue's value on press.
        assert_eq!(draggable_list_placeholder_row(None, Some(1), 3), Some(1));
        // A legal slot is honoured, above and below the source.
        assert_eq!(draggable_list_placeholder_row(Some(0), Some(2), 3), Some(0));
        assert_eq!(draggable_list_placeholder_row(Some(2), Some(0), 3), Some(2));
        // A stale slot falls back to the source, so it never marks a row.
        assert_eq!(draggable_list_placeholder_row(Some(3), Some(1), 3), Some(1));
        // No source (or a stale one), no placeholder: no drag at all.
        assert_eq!(draggable_list_placeholder_row(Some(1), None, 3), None);
        assert_eq!(draggable_list_placeholder_row(Some(1), Some(9), 3), None);
        assert_eq!(draggable_list_placeholder_row(None, None, 0), None);
    }

    #[test]
    fn draggable_list_markers_name_the_gap_side() {
        let from = Some(1);
        // Moving UP: the row under the placeholder marks its TOP edge.
        assert_eq!(
            draggable_list_placeholder_dir(from, Some(0), 0),
            Some("before")
        );
        // Moving DOWN: the row under the placeholder marks its BOTTOM edge.
        assert_eq!(
            draggable_list_placeholder_dir(from, Some(2), 2),
            Some("after")
        );
        // The source row never marks itself, and untouched rows mark nothing.
        assert_eq!(draggable_list_placeholder_dir(from, Some(1), 1), None);
        assert_eq!(draggable_list_placeholder_dir(from, Some(2), 0), None);
        // No drag → no marker.
        assert_eq!(draggable_list_placeholder_dir(None, Some(0), 0), None);
        assert_eq!(draggable_list_placeholder_dir(from, None, 0), None);
        // The source row's own flag.
        assert!(draggable_list_row_is_source(from, 1));
        assert!(!draggable_list_row_is_source(from, 0));
        assert!(!draggable_list_row_is_source(None, 0));
    }

    #[test]
    fn draggable_list_placeholder_scan_skips_source_locked_and_unmeasured() {
        // Empty list: Vue keeps `fromIndex`.
        assert_eq!(draggable_list_placeholder_for(0.0, &[], 0, &[]), 0);
        // A single-row list can only stay on the source row.
        assert_eq!(
            draggable_list_placeholder_for(0.0, &[Some(10.0)], 0, &[false]),
            0
        );
        // Above the first midpoint → the first eligible row ...
        let mids = [Some(40.0), Some(80.0), Some(120.0)];
        assert_eq!(
            draggable_list_placeholder_for(0.0, &mids, 1, &[false, false, false]),
            0
        );
        // ... past the second midpoint (source row skipped, so the eligible
        // rows are 1 and 2) → the NEXT eligible row, exactly Vue's scan.
        assert_eq!(
            draggable_list_placeholder_for(90.0, &mids, 0, &[false, false, false]),
            2
        );
        // ... below every midpoint → the LAST eligible row.
        assert_eq!(
            draggable_list_placeholder_for(900.0, &mids, 0, &[false, false, false]),
            2
        );
        // A locked row is skipped in both directions.
        assert_eq!(
            draggable_list_placeholder_for(90.0, &mids, 0, &[false, true, false]),
            2
        );
        assert_eq!(
            draggable_list_placeholder_for(0.0, &mids, 1, &[true, false, false]),
            2
        );
        // An unmeasured row is skipped (Vue's `if (!el) continue`) ...
        assert_eq!(
            draggable_list_placeholder_for(
                90.0,
                &[Some(40.0), None, Some(120.0)],
                0,
                &[false, false, false]
            ),
            2
        );
        // ... and a row missing from `locked` counts as dead, like Vue's `!item`.
        assert_eq!(draggable_list_placeholder_for(90.0, &mids, 0, &[false]), 0);
    }

    #[test]
    fn draggable_list_drop_guards_bounds_and_noops() {
        // Same row: Vue's `placeholderIndex !== fromIndex` guard.
        assert_eq!(draggable_list_drop(Some(0), Some(0), 3), None);
        assert_eq!(
            draggable_list_drop(Some(0), Some(2), 3),
            Some(DraggableListDrop { from: 0, to: 2 })
        );
        // An index the list no longer has is dropped, not emitted.
        assert_eq!(draggable_list_drop(Some(0), Some(3), 3), None);
        assert_eq!(draggable_list_drop(Some(3), Some(0), 3), None);
        assert_eq!(draggable_list_drop(Some(0), Some(0), 0), None);
        // A half-published drag has no target at all.
        assert_eq!(draggable_list_drop(None, Some(1), 3), None);
        assert_eq!(draggable_list_drop(Some(1), None, 3), None);
    }

    #[test]
    fn draggable_list_reordered_applies_vues_move() {
        // Moving a row DOWN lands it at `to`; the rows above keep their order.
        assert_eq!(draggable_list_reordered(4, 0, 2), Some(vec![1, 2, 0, 3]));
        // Moving UP shifts the rows it passed to the right.
        assert_eq!(draggable_list_reordered(4, 2, 0), Some(vec![2, 0, 1, 3]));
        // A no-op move is the identity permutation.
        assert_eq!(draggable_list_reordered(3, 1, 1), Some(vec![0, 1, 2]));
        // Single row: nothing to reorder, but the move is still well-defined.
        assert_eq!(draggable_list_reordered(1, 0, 0), Some(vec![0]));
        // Empty list / out-of-range indices: no permutation exists.
        assert_eq!(draggable_list_reordered(0, 0, 0), None);
        assert_eq!(draggable_list_reordered(3, 0, 3), None);
        assert_eq!(draggable_list_reordered(3, 3, 0), None);
        // The last row can move to the head and back.
        assert_eq!(draggable_list_reordered(3, 2, 0), Some(vec![2, 0, 1]));
    }

    #[test]
    fn draggable_list_arm_and_click_swallow_thresholds() {
        // The threshold is EXCLUSIVE: the boundary is still a click.
        assert!(!draggable_list_armed(0.0, 0.0));
        assert!(!draggable_list_armed(5.0, 0.0));
        assert!(!draggable_list_armed(3.0, 4.0));
        assert!(draggable_list_armed(0.0, 5.1));
        assert!(draggable_list_armed(-6.0, 0.0));
        assert!(draggable_list_armed(4.0, 4.0));
        // The click guard INCLUDES its boundary, like Vue's `> SWALLOW` guard.
        assert!(draggable_list_swallow_click(0.0));
        assert!(draggable_list_swallow_click(299.0));
        assert!(draggable_list_swallow_click(300.0));
        assert!(!draggable_list_swallow_click(300.5));
        // A nonsense reading swallows nothing (Vue's guard falls through too).
        assert!(!draggable_list_swallow_click(f64::NAN));
    }

    #[test]
    fn draggable_list_emits_through_the_live_handlers() {
        let seen: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));

        let start_log = Rc::clone(&seen);
        let on_start = Some(EventHandler::new(move |payload: DraggableListDrag| {
            start_log
                .borrow_mut()
                .push(format!("start:{}@{}", payload.key, payload.from));
        }));
        // A locked row never starts, and neither does a secondary button.
        assert_eq!(list_press(0, "a", true, 0, &on_start), None);
        assert_eq!(list_press(0, "a", false, 1, &on_start), None);
        assert!(list_press(0, "a", false, 0, &on_start).is_some());

        let over_log = Rc::clone(&seen);
        let on_over = Some(EventHandler::new(move |index: usize| {
            over_log.borrow_mut().push(format!("over:{index}"));
        }));
        // No drag / the source row / a locked row publish nothing.
        assert_eq!(list_over(2, false, false, false, &on_over), None);
        assert_eq!(list_over(2, true, true, false, &on_over), None);
        assert_eq!(list_over(2, true, false, true, &on_over), None);
        assert_eq!(list_over(2, true, false, false, &on_over), Some(2));

        let drop_log = Rc::clone(&seen);
        let end_log = Rc::clone(&seen);
        let on_drop = Some(EventHandler::new(move |payload: DraggableListDrop| {
            drop_log
                .borrow_mut()
                .push(format!("drop:{}>{}", payload.from, payload.to));
        }));
        let on_end = Some(EventHandler::new(move |payload: DraggableListDrag| {
            end_log.borrow_mut().push(format!("end:{}", payload.key));
        }));
        let (dropped, ended) = list_release(
            Some(DraggableListDrop { from: 0, to: 2 }),
            Some(DraggableListDrag {
                from: 0,
                key: "a".to_string(),
            }),
            &on_drop,
            &on_end,
        );
        assert!(dropped.is_some() && ended.is_some());
        // A release with nothing in flight is silent.
        list_release(None, None, &on_drop, &on_end);

        assert_eq!(
            seen.borrow().clone(),
            vec![
                "start:a@0".to_string(),
                "over:2".to_string(),
                "drop:0>2".to_string(),
                "end:a".to_string(),
            ]
        );
    }

    #[test]
    fn draggable_list_renders_the_vue_dom_contract() {
        let html = DraggableList(DraggableListProps {
            items: vec![
                row("a"),
                row("b").with_actions(rsx! {
                    button { class: "act", "x" }
                }),
                row("c"),
            ],
            locked_keys: locked_keys(),
            label: Some("Factors".to_string()),
            dragging_index: Some(0),
            placeholder_index: Some(2),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-draggable-list""#,
            r#"role="list""#,
            r#"aria-label="Factors""#,
            // The root marker is the EMPTY spelling (Vue `s ? "" : undefined`).
            r#"data-dragging="""#,
            r#"class="hk-draggable-list-item""#,
            r#"role="listitem""#,
            // A row's source marker is the "true" spelling.
            r#"data-dragging="true""#,
            r#"data-locked="true""#,
            r#"class="hk-draggable-list-handle""#,
            r#"data-hidden="true""#,
            r#"class="hk-draggable-list-content""#,
            r#"class="hk-draggable-list-actions""#,
            r#"style="display:contents""#,
            r#"<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">"#,
            r#"<circle cx="10" cy="11" r="1.2"/>"#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The placeholder row (index 2, below the source) marks its BOTTOM edge.
        assert!(html.contains(r#"data-placeholder="after""#), "{html}");
        assert_eq!(html.matches(r#"role="listitem""#).count(), 3, "{html}");
        // Rows render in `items` order.
        let first = html.find(">a<").expect("row a");
        let second = html.find(">b<").expect("row b");
        let third = html.find(">c<").expect("row c");
        assert!(first < second && second < third, "row order: {html}");
        // The actions lane is a SIBLING of the content lane, never its child.
        let content_at = html
            .find(r#"class="hk-draggable-list-content""#)
            .expect("content lane");
        let actions_at = html
            .find(r#"class="hk-draggable-list-actions""#)
            .expect("actions lane");
        let content_close = html[content_at..].find("</div>").expect("content close");
        assert!(
            content_at + content_close < actions_at,
            "actions must trail the content lane: {html}"
        );

        // A settled list carries none of the drag markers.
        let settled = DraggableList(DraggableListProps {
            items: list_items(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!settled.contains(r#"data-dragging="""#), "{settled}");
        assert!(!settled.contains(r#"data-dragging="true""#), "{settled}");
        assert!(!settled.contains("data-placeholder"), "{settled}");
        // No label → no aria-label; no actions → no lane.
        assert!(!settled.contains("aria-label"), "{settled}");
        assert!(!settled.contains("hk-draggable-list-actions"), "{settled}");
        assert_eq!(settled.matches("hk-draggable-list-item").count(), 3);

        // An all-locked list marks the root so the sheet collapses the lane.
        let all_locked = DraggableList(DraggableListProps {
            items: list_items(),
            locked_keys: vec!["a".to_string(), "b".to_string(), "c".to_string()],
            label: Some("".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            all_locked.contains(r#"data-all-locked="true""#),
            "{all_locked}"
        );
        // An empty label is absent, exactly like Vue's `|| undefined`.
        assert!(!all_locked.contains("aria-label"), "{all_locked}");

        // Moving UP marks the TOP edge of the row above the source.
        let upward = DraggableList(DraggableListProps {
            items: list_items(),
            dragging_index: Some(2),
            placeholder_index: Some(0),
            ..Default::default()
        })
        .render_to_html();
        assert!(upward.contains(r#"data-placeholder="before""#), "{upward}");
        assert!(!upward.contains(r#"data-placeholder="after""#), "{upward}");
        assert!(!upward.contains("data-all-locked"), "{upward}");
    }

    #[test]
    fn draggable_list_styles_come_from_the_canonical_vue_sheet() {
        let css = DraggableListComponent::styles();
        assert!(
            css.contains(".hk-draggable-list")
                && css.contains(".hk-draggable-list-handle")
                && css.contains(".hk-draggable-list-actions")
                && css.contains(".hk-draggable-list-ghost")
                && css.contains(r#"[data-all-locked]"#),
            "draggable list css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored draggable list sheet"
        );
    }
}
