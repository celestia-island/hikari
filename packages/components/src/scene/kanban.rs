// hi-components/src/scene/kanban.rs
// Kanban — mirror of the canonical Vue `HkKanban`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkKanban.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-kanban*` class names are literal and
// identical in both forms. DOM contract (mirrors the Vue render output):
//
//   div.hk-kanban [host class] [aria-label]
//        data-axis={horizontal|vertical|both} [data-dragging]
//     ── lanes empty: the `empty` slot, no strip ──
//     {empty}
//     ── else ──
//     div.hk-scroll-container.hk-kanban-strip      (the lane strip; see delta)
//          data-axis={axis} [data-dock-tail="true"]
//       div.hk-kanban-lanes                        (style: --hk-kanban-lane-size)
//         section.hk-kanban-lane  (one per lane, `lanes` order)
//              data-lane={laneKey} [data-drop-target]
//           header.hk-kanban-lane-header {laneHeader slot}
//           div.hk-kanban-cards
//             div.hk-kanban-card  (one per card, `cards` order)
//                  data-card={cardKey} data-card-index={i} [draggable="true"]
//               {card slot}
//             div.hk-kanban-lane-tail              (keeps the empty space hittable)
//           {laneFooter slot}
//
// A board is a view of the host's model, never its owner: the mirror renders
// lanes/cards and REPORTS a drop, the host applies it (and may reject it).
// Vue keeps that promise with two internal refs — `dragging` (the card in
// flight) and `dropTarget` (the highlighted lane). Both are CONTROLLED props
// here, because a tairitsu component may not hold state (`use_signal` /
// `use_state` are broken on tairitsu 0.5.22, ledger L48):
//
//   * `dragging: Option<KanbanDrag>` — Vue's `dragging` ref. It drives
//     `data-dragging` on the root and gates every drop path.
//   * `over_lane: Option<String>` — Vue's `dropTarget` ref. It drives the
//     lane's `data-drop-target`, i.e. the board's ONE drop affordance
//     (`.hk-kanban-lane[data-drop-target]`).
//   * `over_index: Option<i64>` — the hit test Vue runs in `dropIndexWithin`
//     (`event.target.closest("[data-card-index]")`). tairitsu's `DragEvent`
//     carries no target node, so the HOST measures it and passes the raw
//     reading down; [`kanban_drop_index`] applies Vue's rules to it
//     unchanged (non-integer / negative / out-of-range -> append).
//
// Deltas vs Vue (documented, not accidental):
//   * MOUSE-FAMILY BINDINGS, not native drag-and-drop. On wasm32-wasip2 the
//     tairitsu browser glue dispatches only the mouse family as typed
//     `MouseEvent`s and routes `drag*` (like `pointer*`) through a data-less
//     generic channel, so a typed `DragEvent` handler never fires on the
//     real target (ledger L67). The chain is re-based on the mouse family,
//     the same paradigm `draggable_list` / `draggable_grid` use: the card's
//     `dragstart` → its `mousedown` (the press is PUBLISHED, not claimed,
//     and `preventDefault` suppresses the native drag-and-drop that would
//     otherwise swallow the mouse events this chain rides on — Vue rides the
//     native DnD, the mirror cannot); the lane's `dragover` → its
//     `mouseenter` (the browser's own hit test, still gated on `draggable &&
//     dragging` exactly like Vue's handler); the lane's `dragleave` → its
//     `mouseleave`; the lane's `drop` → its `mouseup`; and `dragend` → a
//     ROOT-level `mouseup` (a release inside the board but outside every
//     lane still ends the gesture — Vue's `dragend` fires wherever the
//     native drag died). The lane order matches Vue's drop → dragend. The
//     `dragover`/`drop` `preventDefault` calls are NOT ported: they existed
//     to admit a native drop, and there is no native gesture to admit.
//     Declared consequences: a touch screen produces no `mousemove`
//     sequence, so TOUCH dragging is unavailable (a tap still clicks); the
//     mouse has no implicit capture, so a release outside the board never
//     reaches it — the host ends its drag on its own page-level signal.
//   * `draggable` / `laneSize` / `ariaLabel` / `dockTailClearance` keep their
//     Vue prop names (snake_cased); `lanes` + `laneKeyOf` + `cardsOf` +
//     `cardKeyOf` collapse into [`KanbanLane`] / [`KanbanCard`] structs,
//     which is the Rust form of "a keyed lane carrying keyed cards" — Vue's
//     four callbacks exist only because it renders opaque `unknown` values.
//     A blank lane key falls back to `lane-{index}` ([`kanban_lane_key`]):
//     Vue's `laneKeyOf` is required so it has no default, but a lane without
//     an identity could neither be a drop target nor be patch-keyed.
//   * `HScrollContainer` (the overlay-scrollbar viewport the strip is built
//     on) has NO Rust mirror — its sheet is not in the vendor set. The strip
//     therefore renders ONE box carrying both classes the Vue DOM has
//     (`hk-scroll-container hk-kanban-strip`) plus `data-axis` /
//     `data-dock-tail`, and adds an inline `overflow:auto` so the lane axis
//     scrolls (the same substitution `basic/card.rs` documents for the
//     scrollable card body). An inert viewport wrapper was rejected: without
//     the missing sheet it would break `.hk-kanban-lanes { min-height: 100% }`,
//     which is what keeps a lane full-height. The overlay rail, the fade
//     masks and the dock-tail spacer are absent with it, so
//     `dock_tail_clearance` only contributes its `data-dock-tail` marker.
//   * `onDragStart`'s `dataTransfer` side effects (`setData("text/plain",
//     laneKey)`, `effectAllowed = "move"`) cannot be reproduced: the event's
//     `DataTransfer` is a Rust-side snapshot, not the browser's live object.
//     The drop path does not depend on it — the controlled `dragging` prop is
//     the single source of truth for both ends of a move — so the mirror
//     forwards the payload through [`KanbanDrag`] and the host may set the
//     native payload from its own listener.
//   * `onDragLeave`'s containment test (`lane.contains(event.relatedTarget)`)
//     needed the DOM node, which a vnode mirror does not hold — a bubbling
//     `dragleave` fires for every child the pointer crosses. The mouse-family
//     `mouseleave` the mirror binds instead does NOT bubble, so the lane only
//     ever reports a leave that truly exits it: Vue's "a leave that stays
//     inside the lane does not clear" guard is inherent in the event itself
//     here, and [`kanban_is_drop_target`] remains the clearing rule for the
//     controlled `over_lane`.
//   * Vue clears `dragging`/`dropTarget` itself on drop and on drag end. Both
//     are host state here: `on_move` tells the host a move landed and
//     `on_drag_end` tells it the gesture is over — either is the clear signal.
//   * `axis` keeps the three Vue values; `both` scrolls the strip on both
//     axes (the lane axis and the card axis are independent).
//
// No literal UI text is rendered (headers, cards, footers and the empty state
// all arrive through slots), so this component introduces NO
// `hikari_i18n::t` key.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamp chains, index loops and inline tuple types keep the
// port auditable against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::manual_clamp)]
#![allow(clippy::manual_range_contains)]
#![allow(clippy::needless_range_loop)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct KanbanComponent;

/// The board root (also the `data-axis` / `data-dragging` carrier).
pub const KANBAN_CLASS: &str = "hk-kanban";

/// The lane strip — Vue's `HScrollContainer` root, kept as a marker class so
/// the substitution above is visible in the DOM.
pub const KANBAN_SCROLL_CONTAINER_CLASS: &str = "hk-scroll-container";

/// The strip's own class (the flex item inside `.hk-kanban`).
pub const KANBAN_STRIP_CLASS: &str = "hk-kanban-strip";

/// The lane row/column container (`--hk-kanban-lane-size` lives here).
pub const KANBAN_LANES_CLASS: &str = "hk-kanban-lanes";

/// One lane (`data-lane` + `data-drop-target`).
pub const KANBAN_LANE_CLASS: &str = "hk-kanban-lane";

/// A lane's header (`laneHeader` slot receiver).
pub const KANBAN_LANE_HEADER_CLASS: &str = "hk-kanban-lane-header";

/// A lane's card scroller (per lane, so a long lane scrolls on its own).
pub const KANBAN_CARDS_CLASS: &str = "hk-kanban-cards";

/// One card (`data-card` + `data-card-index`).
pub const KANBAN_CARD_CLASS: &str = "hk-kanban-card";

/// The tail that keeps a lane's empty space hittable, so a card can be
/// appended to ANY lane — including an empty one.
pub const KANBAN_LANE_TAIL_CLASS: &str = "hk-kanban-lane-tail";

/// Which way a board scrolls (Vue `axis`, default `horizontal`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum KanbanAxis {
    #[default]
    Horizontal,
    Vertical,
    Both,
}

impl KanbanAxis {
    /// The `data-axis` value exactly as Vue emits it.
    pub fn attr(self) -> &'static str {
        match self {
            KanbanAxis::Horizontal => "horizontal",
            KanbanAxis::Vertical => "vertical",
            KanbanAxis::Both => "both",
        }
    }
}

/// One card: its drag identity plus what the `card` slot renders for it
/// (Vue: an opaque `card` value under `cardKeyOf`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct KanbanCard {
    /// Stable card key (Vue: `cardKeyOf(card, cardIndex)`). Blank falls back
    /// to the Vue default `{laneKey}#{cardIndex}`.
    pub key: String,
    /// The `card` slot content for this card.
    pub content: Element,
}

impl KanbanCard {
    pub fn new(key: impl Into<String>, content: Element) -> Self {
        Self {
            key: key.into(),
            content,
        }
    }
}

/// One lane: its key, its cards in display order, and the two slot receivers
/// (Vue: `laneHeader` / `laneFooter`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct KanbanLane {
    /// Stable lane key — the header's identity and the drop target (Vue:
    /// `laneKeyOf(lane, laneIndex)`).
    pub key: String,
    pub cards: Vec<KanbanCard>,
    /// The `laneHeader` slot (a plain label, a card, or a control cluster).
    pub header: Element,
    /// The `laneFooter` slot, appended after the card scroller.
    pub footer: Element,
}

impl KanbanLane {
    pub fn new(key: impl Into<String>, cards: Vec<KanbanCard>) -> Self {
        Self {
            key: key.into(),
            cards,
            header: empty_vnode(),
            footer: empty_vnode(),
        }
    }
}

/// The card in flight — Vue's `dragging` ref: both ends of the eventual move
/// plus the card identity (for the `move` payload).
#[derive(Clone, PartialEq, Eq, Debug, Default)]
pub struct KanbanDrag {
    pub lane_key: String,
    pub index: usize,
    pub card_key: String,
}

/// A resolved move — Vue's `move` emit payload (`KanbanMove`). `to_index` is
/// in the TARGET lane's coordinates, as the index to insert at AFTER the card
/// left its source lane (so moving a card to the end of its own lane is
/// `to_index == cards_len - 1` on the shortened list).
#[derive(Clone, PartialEq, Eq, Debug, Default)]
pub struct KanbanMove {
    pub card_key: String,
    pub from_lane_key: String,
    pub from_index: usize,
    pub to_lane_key: String,
    pub to_index: usize,
}

/// The board's complete class list: `hk-kanban` plus the host class appended
/// last (Vue merges the parent's `class` onto the single root element).
pub fn kanban_classes(class: &str) -> String {
    let mut classes = String::from(KANBAN_CLASS);
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

/// The strip's class list in the Vue DOM's order: `HScrollContainer`'s own
/// class first, the board-provided `hk-kanban-strip` second.
pub fn kanban_strip_classes() -> String {
    format!("{} {}", KANBAN_SCROLL_CONTAINER_CLASS, KANBAN_STRIP_CLASS)
}

/// Vue's lane identity fallback: a blank key reads as unset and derives
/// `lane-{index}` (see the header delta) so every lane stays addressable.
pub fn kanban_lane_key(key: &str, index: usize) -> String {
    if key.is_empty() {
        format!("lane-{index}")
    } else {
        key.to_string()
    }
}

/// Vue's card identity: `cardKeyOf?.(card, cardIndex) ?? "{laneKey}#{cardIndex}"`.
/// A blank key reads as unset and derives the same default.
pub fn kanban_card_key(key: &str, lane_key: &str, index: usize) -> String {
    if key.is_empty() {
        format!("{lane_key}#{index}")
    } else {
        key.to_string()
    }
}

/// `laneSize` -> the one custom property the sheet reads
/// (`--hk-kanban-lane-size`), or `None` when the host passed nothing. Vue's
/// `props.laneSize ? {...} : undefined` treats a blank string as unset too.
pub fn kanban_lane_style(lane_size: Option<&str>) -> Option<String> {
    match lane_size {
        Some(size) if !size.is_empty() => Some(format!("--hk-kanban-lane-size:{size}")),
        _ => None,
    }
}

/// The `data-dragging` marker: a PRESENCE attribute while a card is in flight
/// (Vue: `data-dragging={dragging.value ? "" : undefined}`), so a `[data-dragging]`
/// selector distinguishes dragging from idle.
pub fn kanban_dragging_attr(dragging: Option<&KanbanDrag>) -> Option<&'static str> {
    dragging.map(|_| "")
}

/// Whether this lane is the highlighted drop target (Vue:
/// `dropTarget.value === laneKey`, which also covers the directive's
/// `undefined` idle state).
pub fn kanban_is_drop_target(over_lane: Option<&str>, lane_key: &str) -> bool {
    matches!(over_lane, Some(lane) if lane == lane_key)
}

/// The lane's `data-drop-target` PRESENCE attribute.
pub fn kanban_drop_target_attr(over_lane: Option<&str>, lane_key: &str) -> Option<&'static str> {
    if kanban_is_drop_target(over_lane, lane_key) {
        Some("")
    } else {
        None
    }
}

/// The card's `draggable` attribute: `"true"` only while the board is
/// draggable (Vue: `draggable={props.draggable || undefined}`), so the sheet's
/// `.hk-kanban-card[draggable="true"] { cursor: grab }` rule matches exactly
/// the boards that can drag.
pub fn kanban_card_draggable(draggable: bool) -> Option<&'static str> {
    if draggable { Some("true") } else { None }
}

/// Where a drop lands inside a lane — Vue's `dropIndexWithin` verbatim:
/// the integer the hit test read when it is a valid card index, else the end
/// of the lane (`cardCount`). `None` is Vue's `NaN` (the pointer was over the
/// header, the footer, a gap, or the tail — the whole lane is one target).
pub fn kanban_drop_index(raw: Option<i64>, card_count: usize) -> usize {
    match raw {
        Some(index) if index >= 0 && (index as usize) < card_count => index as usize,
        _ => card_count,
    }
}

/// Vue's `onDrop` resolution, minus the state writes: a drop on the card the
/// drag started from is NOT a move (the host must not have to filter that
/// itself), and a drop with no card in flight resolves to nothing.
pub fn kanban_resolve_move(
    dragging: Option<&KanbanDrag>,
    to_lane_key: &str,
    over_index: Option<i64>,
    card_count: usize,
) -> Option<KanbanMove> {
    let drag = dragging?;
    let to_index = kanban_drop_index(over_index, card_count);
    if drag.lane_key == to_lane_key && drag.index == to_index {
        return None;
    }
    Some(KanbanMove {
        card_key: drag.card_key.clone(),
        from_lane_key: drag.lane_key.clone(),
        from_index: drag.index,
        to_lane_key: to_lane_key.to_string(),
        to_index,
    })
}

/// True when a slot carries nothing to render (a vnode mirror cannot ask Vue's
/// `slots.x` for presence): the empty fragment, `empty_vnode()`'s blank text,
/// and fragments of those.
fn kanban_slot_is_empty(node: &VNode) -> bool {
    match node {
        VNode::Fragment(nodes) => nodes.iter().all(kanban_slot_is_empty),
        VNode::Text(text) => text.text.is_empty(),
        VNode::Element(_) | VNode::DynamicText(_) => false,
    }
}

#[define_props]
pub struct KanbanProps {
    /// The lanes, in display order (Vue `lanes`, required).
    pub lanes: Vec<KanbanLane>,

    /// Which way the board scrolls (Vue `axis`).
    #[default]
    pub axis: KanbanAxis,

    /// CSS width (horizontal / both) or height (vertical) of one lane
    /// (Vue `laneSize`; omitted when unset).
    pub lane_size: Option<String>,

    /// Whether cards can be dragged between lanes (Vue `draggable`).
    #[default]
    pub draggable: bool,

    /// Accessible name for the board region (Vue `ariaLabel`).
    pub aria_label: Option<String>,

    /// Spend the shell-published `--hk-scroll-tail-bottom` as an in-flow tail
    /// spacer (Vue `dockTailClearance`). Without the scroll-container sheet
    /// this only contributes its `data-dock-tail` marker (see the header).
    #[default]
    pub dock_tail_clearance: bool,

    /// The card in flight — CONTROLLED (Vue's internal `dragging` ref).
    pub dragging: Option<KanbanDrag>,

    /// The lane the pointer is over — CONTROLLED (Vue's internal `dropTarget`
    /// ref). Drives `data-drop-target`.
    pub over_lane: Option<String>,

    /// The raw landing index the host's hit test read inside `over_lane`
    /// (Vue: `dropIndexWithin`'s `data-card-index` reading). `None` = "not over
    /// a card", i.e. Vue's `NaN`, which appends.
    pub over_index: Option<i64>,

    /// What to render when there are no lanes (Vue's `empty` slot). The strip
    /// is not rendered at all in that case.
    pub empty: Option<Element>,

    /// Extra class appended to the board root (Vue's attribute fallthrough).
    #[default]
    pub class: String,

    /// Fired when a card drag starts (Vue: `onDragStart` writing `dragging`).
    pub on_card_drag_start: Option<EventHandler<KanbanDrag>>,

    /// Fired when a lane becomes a candidate target (Vue: `onDragOver`
    /// assigning `dropTarget`); only while `draggable` AND a card is in flight.
    pub on_lane_drag_over: Option<EventHandler<String>>,

    /// Fired when the pointer leaves a lane (Vue: `onDragLeave` clearing
    /// `dropTarget`).
    pub on_lane_drag_leave: Option<EventHandler<String>>,

    /// Fired with the resolved move (Vue: the `move` emit). Absent = the drop
    /// is accepted visually but never reported.
    pub on_move: Option<EventHandler<KanbanMove>>,

    /// Fired when the drag gesture ends (Vue: `onDragEnd`, which clears both
    /// internal refs — both are host state here). Only fires while a card is
    /// in flight (the controlled `dragging` prop), exactly like Vue's
    /// `dragend`; the root-level `mouseup` fallback reports a release that
    /// landed outside every lane too (header delta).
    pub on_drag_end: Option<EventHandler<()>>,
}

#[component]
pub fn Kanban(props: KanbanProps) -> Element {
    let axis = props.axis;
    let draggable = props.draggable;
    let dragging = props.dragging.clone();
    let has_dragging = dragging.is_some();
    let over_lane = props.over_lane.clone();
    let over_index = props.over_index;

    let mut root = VElement::new("div")
        .class(kanban_classes(&props.class))
        .attr("data-axis", axis.attr())
        .attr_opt("data-dragging", kanban_dragging_attr(dragging.as_ref()))
        .attr_opt("aria-label", props.aria_label.clone());

    // Vue: `lanes.length === 0 ? slots.empty?.() ?? null : <strip>`.
    if props.lanes.is_empty() {
        return VNode::Element(Box::new(
            root.child(props.empty.clone().unwrap_or_else(empty_vnode)),
        ));
    }

    let on_move = props.on_move.clone();

    let mut lane_nodes: Vec<VNode> = Vec::with_capacity(props.lanes.len());
    for (lane_index, lane) in props.lanes.iter().enumerate() {
        let lane_key = kanban_lane_key(&lane.key, lane_index);
        let card_count = lane.cards.len();

        let mut cards: Vec<VNode> = Vec::with_capacity(card_count + 1);
        for (card_index, card) in lane.cards.iter().enumerate() {
            let card_key = kanban_card_key(&card.key, &lane_key, card_index);

            let mut card_el = VElement::new("div")
                .class(KANBAN_CARD_CLASS)
                .attr("data-card", card_key.clone())
                .attr("data-card-index", card_index)
                .attr_opt("draggable", kanban_card_draggable(draggable))
                .key(&card_key)
                .child(card.content.clone());

            // Vue: `onDragstart` arms `dragging` for every non-draggable board
            // too, but then early-returns; only a draggable board reports.
            // Mouse family (L67): the press is PUBLISHED from `mousedown`,
            // and `preventDefault` keeps the browser from starting the native
            // drag-and-drop that would swallow the mouse events the rest of
            // the chain rides on (Vue rides that native gesture instead).
            let start_handler = props.on_card_drag_start.clone();
            let start_payload = KanbanDrag {
                lane_key: lane_key.clone(),
                index: card_index,
                card_key: card_key.clone(),
            };
            card_el = card_el.on_mousedown(move |event: MouseEvent| {
                if !draggable {
                    return;
                }
                event.prevent_default();
                if let Some(handler) = start_handler.as_ref() {
                    handler.call(start_payload.clone());
                }
            });

            cards.push(VNode::Element(Box::new(card_el)));
        }
        // The tail keeps the lane's empty space hittable (the lane owns the
        // drop, so a card can be appended to any lane).
        cards.push(VNode::Element(Box::new(
            VElement::new("div").class(KANBAN_LANE_TAIL_CLASS),
        )));

        let header = VElement::new("header")
            .class(KANBAN_LANE_HEADER_CLASS)
            .child(lane.header.clone());
        let cards_box = VElement::new("div")
            .class(KANBAN_CARDS_CLASS)
            .children(cards);

        let mut section = VElement::new("section")
            .class(KANBAN_LANE_CLASS)
            .attr("data-lane", lane_key.clone())
            .attr_opt(
                "data-drop-target",
                kanban_drop_target_attr(over_lane.as_deref(), &lane_key),
            )
            .key(&lane_key)
            .child(VNode::Element(Box::new(header)))
            .child(VNode::Element(Box::new(cards_box)));

        // Vue: `onDragOver` is gated on `draggable && dragging` and calls
        // `preventDefault()` — that is what makes the lane a legal target in
        // NATIVE drag-and-drop. The mouse-family `mouseenter` (L67) needs no
        // such admission (there is no native gesture to admit), so only the
        // gate survives: the lane under the pointer becomes the target.
        let over_handler = props.on_lane_drag_over.clone();
        let over_key = lane_key.clone();
        section = section.on_mouseenter(move |_event: MouseEvent| {
            if !draggable || !has_dragging {
                return;
            }
            if let Some(handler) = over_handler.as_ref() {
                handler.call(over_key.clone());
            }
        });

        // Vue: `onDragLeave` clears the target unless the pointer merely moved
        // into a child of the same lane. `mouseleave` does not bubble, so the
        // lane only reports a leave that truly exits it (see the header
        // delta) — the containment guard is inherent in the event.
        let leave_handler = props.on_lane_drag_leave.clone();
        let leave_key = lane_key.clone();
        section = section.on_mouseleave(move |_event: MouseEvent| {
            if let Some(handler) = leave_handler.as_ref() {
                handler.call(leave_key.clone());
            }
        });

        // Vue: `onDrop` resolves the landing index, clears both refs and emits
        // `move` unless the drop is a no-op. Mouse family (L67): the drop is
        // the lane's `mouseup` (a release over the lane); the root-level
        // `mouseup` below reports the gesture's end right after it, Vue's
        // own drop → dragend order. Vue's `preventDefault` admitted a native
        // drop — nothing native to admit here.
        let drop_dragging = dragging.clone();
        let drop_handler = on_move.clone();
        let drop_key = lane_key.clone();
        section = section.on_mouseup(move |_event: MouseEvent| {
            if !draggable || drop_dragging.is_none() {
                return;
            }
            let resolved =
                kanban_resolve_move(drop_dragging.as_ref(), &drop_key, over_index, card_count);
            if let Some(resolved) = resolved {
                if let Some(handler) = drop_handler.as_ref() {
                    handler.call(resolved);
                }
            }
        });

        // Vue renders the footer slot as a direct child of the lane, and
        // nothing at all when the slot is absent.
        if !kanban_slot_is_empty(&lane.footer) {
            section = section.child(lane.footer.clone());
        }

        lane_nodes.push(VNode::Element(Box::new(section)));
    }

    let lanes_box = VElement::new("div")
        .class(KANBAN_LANES_CLASS)
        .style(kanban_lane_style(props.lane_size.as_deref()))
        .children(lane_nodes);

    // The strip substitutes the unmirrored `HScrollContainer` (see the header):
    // both of the classes the Vue DOM carries, the same `data-axis` /
    // `data-dock-tail` markers, and an inline `overflow:auto` for the scroll
    // contract the missing sheet would have owned.
    let strip = VElement::new("div")
        .class(kanban_strip_classes())
        .attr("data-axis", axis.attr())
        .attr_opt(
            "data-dock-tail",
            props.dock_tail_clearance.then_some("true"),
        )
        .style("overflow:auto")
        .child(VNode::Element(Box::new(lanes_box)));

    root = root.child(VNode::Element(Box::new(strip)));

    // Vue: `onDragEnd` clears BOTH internal refs; here it is the host's clear
    // signal (the drag can also end outside any lane). Bound as the
    // ROOT-level `mouseup` fallback (L67): a lane's `mouseup` bubbles here
    // right after its drop — Vue's own drop → dragend order — and a release
    // inside the board but outside every lane still ends the gesture. Gated
    // on the controlled `dragging` prop, like Vue's `dragend` only fires for
    // an armed drag.
    let end_handler = props.on_drag_end.clone();
    root = root.on_mouseup(move |_event: MouseEvent| {
        if !has_dragging {
            return;
        }
        if let Some(handler) = end_handler.as_ref() {
            handler.call(());
        }
    });
    VNode::Element(Box::new(root))
}

impl StyledComponent for KanbanComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkKanban.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "kanban"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn card(key: &str) -> KanbanCard {
        KanbanCard::new(
            key,
            rsx! {
                span { "{key}" }
            },
        )
    }

    fn lane(key: &str, cards: Vec<KanbanCard>) -> KanbanLane {
        KanbanLane::new(key, cards)
    }

    #[test]
    fn kanban_defaults_match_the_vue_props() {
        let props = KanbanProps::default();
        assert!(props.lanes.is_empty());
        assert_eq!(props.axis, KanbanAxis::Horizontal);
        assert!(props.lane_size.is_none());
        assert!(!props.draggable);
        assert!(props.aria_label.is_none());
        assert!(!props.dock_tail_clearance);
        // Both internal Vue refs start empty (`ref(null)`).
        assert!(props.dragging.is_none());
        assert!(props.over_lane.is_none());
        assert!(props.over_index.is_none());
        assert!(props.empty.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_card_drag_start.is_none());
        assert!(props.on_lane_drag_over.is_none());
        assert!(props.on_lane_drag_leave.is_none());
        assert!(props.on_move.is_none());
        assert!(props.on_drag_end.is_none());
    }

    #[test]
    fn kanban_class_names_and_axis_values_match_the_vue_sheet() {
        for (axis, value) in [
            (KanbanAxis::Horizontal, "horizontal"),
            (KanbanAxis::Vertical, "vertical"),
            (KanbanAxis::Both, "both"),
        ] {
            assert_eq!(axis.attr(), value);
        }
        assert_eq!(kanban_classes(""), "hk-kanban");
        assert_eq!(kanban_classes("host"), "hk-kanban host");
        assert_eq!(
            kanban_strip_classes(),
            "hk-scroll-container hk-kanban-strip"
        );
        assert_eq!(
            [
                KANBAN_CLASS,
                KANBAN_STRIP_CLASS,
                KANBAN_LANES_CLASS,
                KANBAN_LANE_CLASS,
                KANBAN_LANE_HEADER_CLASS,
                KANBAN_CARDS_CLASS,
                KANBAN_CARD_CLASS,
                KANBAN_LANE_TAIL_CLASS,
            ],
            [
                "hk-kanban",
                "hk-kanban-strip",
                "hk-kanban-lanes",
                "hk-kanban-lane",
                "hk-kanban-lane-header",
                "hk-kanban-cards",
                "hk-kanban-card",
                "hk-kanban-lane-tail",
            ]
        );
    }

    #[test]
    fn kanban_card_and_lane_keys_follow_the_vue_defaults() {
        // Vue: `cardKeyOf?.(...) ?? `${laneKey}#${cardIndex}``.
        assert_eq!(kanban_card_key("", "todo", 0), "todo#0");
        assert_eq!(kanban_card_key("", "todo", 3), "todo#3");
        // A provided key always wins.
        assert_eq!(kanban_card_key("c-42", "todo", 3), "c-42");
        // The lane has no Vue default (its key is required): a blank key
        // derives a stable positional one.
        assert_eq!(kanban_lane_key("", 2), "lane-2");
        assert_eq!(kanban_lane_key("todo", 2), "todo");
    }

    #[test]
    fn kanban_drop_index_appends_outside_the_card_band() {
        // A valid card index is used as-is.
        assert_eq!(kanban_drop_index(Some(0), 3), 0);
        assert_eq!(kanban_drop_index(Some(2), 3), 2);
        // The end of the lane: no card under the pointer, or an index past it.
        assert_eq!(kanban_drop_index(None, 3), 3);
        assert_eq!(kanban_drop_index(Some(3), 3), 3);
        assert_eq!(kanban_drop_index(Some(99), 3), 3);
        // Negative readings are junk, not a wrap-around.
        assert_eq!(kanban_drop_index(Some(-1), 3), 3);
        // An empty lane only ever accepts the append.
        assert_eq!(kanban_drop_index(Some(0), 0), 0);
        assert_eq!(kanban_drop_index(None, 0), 0);
    }

    #[test]
    fn kanban_resolve_move_reports_real_moves_only() {
        let drag = KanbanDrag {
            lane_key: "todo".to_string(),
            index: 1,
            card_key: "todo#1".to_string(),
        };
        // Dropping the card back where it started is not a move.
        assert_eq!(kanban_resolve_move(Some(&drag), "todo", Some(1), 3), None);
        // Same lane, different index: a reorder.
        assert_eq!(
            kanban_resolve_move(Some(&drag), "todo", Some(0), 3),
            Some(KanbanMove {
                card_key: "todo#1".to_string(),
                from_lane_key: "todo".to_string(),
                from_index: 1,
                to_lane_key: "todo".to_string(),
                to_index: 0,
            })
        );
        // Another lane, appended at its end (no card under the pointer).
        assert_eq!(
            kanban_resolve_move(Some(&drag), "doing", None, 2),
            Some(KanbanMove {
                card_key: "todo#1".to_string(),
                from_lane_key: "todo".to_string(),
                from_index: 1,
                to_lane_key: "doing".to_string(),
                to_index: 2,
            })
        );
        // No card in flight: nothing to resolve.
        assert_eq!(kanban_resolve_move(None, "doing", Some(0), 2), None);
    }

    #[test]
    fn kanban_lane_size_and_markers_are_the_vue_attribute_table() {
        assert_eq!(
            kanban_lane_style(Some("18rem")),
            Some("--hk-kanban-lane-size:18rem".to_string())
        );
        // Vue treats a blank `laneSize` as unset.
        assert_eq!(kanban_lane_style(Some("")), None);
        assert_eq!(kanban_lane_style(None), None);

        let drag = KanbanDrag::default();
        assert_eq!(kanban_dragging_attr(Some(&drag)), Some(""));
        assert_eq!(kanban_dragging_attr(None), None);
        assert_eq!(kanban_card_draggable(true), Some("true"));
        assert_eq!(kanban_card_draggable(false), None);
        assert!(kanban_is_drop_target(Some("todo"), "todo"));
        assert!(!kanban_is_drop_target(Some("todo"), "doing"));
        assert!(!kanban_is_drop_target(None, "todo"));
        assert_eq!(kanban_drop_target_attr(Some("todo"), "todo"), Some(""));
        assert_eq!(kanban_drop_target_attr(Some("todo"), "doing"), None);
    }

    #[test]
    fn kanban_renders_long_boards() {
        let lanes = vec![
            KanbanLane {
                key: "todo".to_string(),
                cards: vec![card(""), card("")],
                header: rsx! {
                    span { class: "lane-title", "Todo" }
                },
                footer: rsx! {
                    span { class: "lane-footer", "footer" }
                },
            },
            KanbanLane {
                key: "doing".to_string(),
                cards: vec![card("wip")],
                header: empty_vnode(),
                footer: empty_vnode(),
            },
        ];

        let html = Kanban(KanbanProps {
            lanes,
            axis: KanbanAxis::Vertical,
            lane_size: Some("12rem".to_string()),
            draggable: true,
            aria_label: Some("nodes".to_string()),
            dock_tail_clearance: true,
            dragging: Some(KanbanDrag {
                lane_key: "todo".to_string(),
                index: 0,
                card_key: "todo#0".to_string(),
            }),
            over_lane: Some("doing".to_string()),
            over_index: Some(0),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-kanban""#,
            r#"data-axis="vertical""#,
            r#"data-dragging=""#,
            r#"aria-label="nodes""#,
            r#"class="hk-scroll-container hk-kanban-strip""#,
            r#"data-dock-tail="true""#,
            "--hk-kanban-lane-size:12rem",
            r#"class="hk-kanban-lanes""#,
            r#"data-lane="todo""#,
            r#"data-lane="doing""#,
            r#"data-card="todo#0""#,
            r#"data-card="todo#1""#,
            r#"data-card="wip""#,
            r#"data-card-index="0""#,
            r#"data-card-index="1""#,
            r#"draggable="true""#,
            r#"class="hk-kanban-lane-header""#,
            r#"class="hk-kanban-cards""#,
            r#"class="hk-kanban-card""#,
            r#"class="hk-kanban-lane-tail""#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Only the lane under the pointer carries the drop affordance.
        assert_eq!(html.matches("data-drop-target").count(), 1, "{html}");
        // The tail trails the cards of every lane (one per lane).
        assert_eq!(html.matches("hk-kanban-lane-tail").count(), 2, "{html}");
        // A lane without a footer renders no footer slot at all, while the
        // lane that has one keeps it after the card scroller.
        assert_eq!(html.matches("lane-footer").count(), 1, "{html}");
        let cards_at = html.find(r#"class="hk-kanban-cards""#).expect("cards");
        let footer_at = html.find("lane-footer").expect("footer");
        let tail_at = html.find("hk-kanban-lane-tail").expect("tail");
        assert!(cards_at < tail_at && tail_at < footer_at, "{html}");
    }

    #[test]
    fn kanban_empty_board_renders_the_empty_slot_without_a_strip() {
        let html = Kanban(KanbanProps {
            empty: Some(rsx! {
                p { class: "hk-kanban-empty", "no lanes" }
            }),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-kanban"), "{html}");
        assert!(html.contains("hk-kanban-empty"), "{html}");
        assert!(!html.contains("hk-kanban-strip"), "{html}");
        assert!(!html.contains("hk-kanban-lane"), "{html}");
        // No `draggable` box and no drop target on an idle board.
        assert!(!html.contains("data-dragging"), "{html}");
        assert!(!html.contains("data-drop-target"), "{html}");

        // Without an empty slot the board is just the bare root, like Vue's
        // `slots.empty?.() ?? null`.
        let bare = Kanban(KanbanProps::default()).render_to_html();
        assert_eq!(bare.matches("<div").count(), 1, "{bare}");
    }

    #[test]
    fn kanban_draggable_board_marks_its_cards() {
        let html = Kanban(KanbanProps {
            lanes: vec![lane("todo", vec![card("")])],
            draggable: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"draggable="true""#), "{html}");
        // A read-only board keeps the cards undraggable.
        let read_only = Kanban(KanbanProps {
            lanes: vec![lane("todo", vec![card("")])],
            ..Default::default()
        })
        .render_to_html();
        assert!(!read_only.contains("draggable"), "{read_only}");
        // The default axis is horizontal, in both attribute slots.
        assert_eq!(
            read_only.matches(r#"data-axis="horizontal""#).count(),
            2,
            "{read_only}"
        );
    }

    #[test]
    fn kanban_styles_come_from_the_canonical_vue_sheet() {
        let css = KanbanComponent::styles();
        for class in [
            ".hk-kanban",
            ".hk-kanban-strip",
            ".hk-kanban-lanes",
            ".hk-kanban-lane",
            ".hk-kanban-lane-header",
            ".hk-kanban-cards",
            ".hk-kanban-card",
            ".hk-kanban-lane-tail",
            "--hk-kanban-lane-size",
        ] {
            assert!(css.contains(class), "kanban css must carry {class:?}");
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored kanban sheet"
        );
        assert_eq!(KanbanComponent::name(), "kanban");
    }
}
