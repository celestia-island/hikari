// hi-components/src/scene/draggable_grid.rs
// DraggableGrid — mirror of the canonical Vue `HkDraggableGrid`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDraggableGrid.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-draggable-grid*` class names are literal and identical in both forms.
// DOM contract (mirrors the Vue render output, top to bottom):
//
//   div.hk-draggable-grid [host class]
//        data-dragging=""                       (a drag is in flight; EMPTY value,
//                                                Vue `{s ? "" : undefined}`)
//     div.hk-draggable-grid-row                  (one per `rows` entry, in order)
//          data-cols={max(1, cells.len())}
//          [data-placeholder-row="after"]       (the placeholder appends AFTER this row)
//          (style: --hk-grid-cols:{max(1, cells.len())})
//       div.hk-draggable-grid-cell               (one per cell, `cells` order)
//            [data-locked="true"] [data-dragging="true"]
//            [data-placeholder="before"]
//         span.hk-draggable-grid-handle[data-hidden="true"]?
//           span[style="display:contents"] > <svg 14×14 six-dot grip>
//                                              (the `handle` slot wins over the grip)
//         div.hk-draggable-grid-content
//           {item.content}                       (Vue: slots.cell({item,row,col,locked}))
//     div.hk-draggable-grid-row.hk-draggable-grid-row-phantom[data-cols=1]
//                                              (the append row PAST the last row)
//       div.hk-draggable-grid-cell.hk-draggable-grid-cell-placeholder-target
//
// `data-dragging` is deliberately spelled TWO ways because Vue does: the ROOT
// carries the empty value (Vue writes `s ? "" : undefined`) while a cell's
// source marker carries `"true"` (Vue writes `isSource || undefined`, and the
// runtime serializes a boolean `true` as `"true"`). Both are presence-only to
// the sheet, but normalising them would not be byte-identical.
//
// Prop mapping: `rows` → [`DraggableGridProps::rows`] (each cell is a
// [`DraggableGridItem`] = `{key, content}`), `lockedKeys` → `locked_keys`, the
// `handle` slot → `handle`, the per-cell `cell` slot → each item's `content`.
//
// Controlled state (tairitsu 0.5.22 has no per-instance component state —
// ledger L48: `use_signal` allocates a fresh signal on every render and
// `use_state` shares ONE slot per component TYPE, so a second call in the same
// component panics and every instance shares the first). Vue's `drag`
// shallowRef (`{from, placeholder, grabOffsetX, grabOffsetY}`) becomes the
// controlled pair `dragging_key` + `placeholder`; the lifecycle leaves through
// `on_drag_start` / `on_drag_over` / `on_drop` / `on_drag_end`. Nothing is
// stored here, and the placeholder defaults to the source cell — exactly the
// value Vue writes when it arms a drag — so a host only has to publish what the
// pointer actually moved.
//
// Deltas vs Vue (documented, not accidental):
//   * NO DRAG ENGINE. Pointer capture, the window-level pointermove/pointerup
//     listeners, the `getBoundingClientRect()` probing, the `onceFrame` gate,
//     the cloned-`outerHTML` ghost, the `ancestorZoom` division, the reported
//     transition and the autoscroll window are all measurement / animation
//     APIs the Rust form does not have. The mirror renders the STATE those APIs
//     produce — the dimmed source cell, the `before` / `after` insertion
//     markers, the phantom append row — from props instead.
//   * The press is PUBLISHED, not claimed: `on_drag_start` fires from the
//     cell's `mousedown` (Vue: pointerdown, with `e.button !== 0` filtered, and
//     the mirror keeps that filter) and nothing calls `preventDefault`. Vue's
//     `target.closest("button, a, input, textarea, select, [contenteditable]")`
//     guard needs DOM introspection, so a press on interactive cell content
//     reaches the host as well: a host that must keep those clicks simply does
//     not publish `dragging_key`.
//   * MOUSE events, not pointer events. On wasm32-wasip2 the tairitsu browser
//     glue gives only the mouse family a typed `MouseEvent` payload and routes
//     `pointer*` (with touch/transition/animation) through the generic event
//     channel, so a `PointerEvent` handler never fires on the real target
//     (evidence: `tairitsu/packages/browser-glue/dist/runtime/eventTarget.js`
//     vs `packages/web/src/wit_platform.rs`). VElement's typed mouse bindings
//     are the ones that work, so touch/pen presses are the host's to observe.
//   * `on_drag_over` is the cell's `mouseenter` — the browser's own hit test —
//     instead of a window pointermove plus rect midpoints. The hit test itself
//     stays available as pure arithmetic ([`draggable_grid_row_for`],
//     [`draggable_grid_col_for`]) together with the append-slot and full-row
//     redirect rules ([`draggable_grid_full_row_redirect`]), so a host that
//     measures its own rows can feed real geometry through the same math (and
//     reach the slots a `mouseenter` cannot express: `col == cells.len()`, the
//     phantom row).
//   * The release is observed on the ROOT (`mouseup`) where Vue listens on
//     `window`; a release outside the grid therefore ends the HOST's drag, not
//     this component's. The payload is Vue's `reorder(from, to)` — emitted only
//     when the placeholder moved off the source cell AND lands inside the slot
//     space ([`draggable_grid_address_in_bounds`]: `col == cells.len()` is a
//     row's append slot, `row == rows.len()` the phantom row).
//   * Vue's `GridItem.locked` field is never read (`isLocked` consults
//     `lockedKeys` only), so the dead field is not mirrored.
//   * The ghost (`div.hk-draggable-grid-ghost`: a `position: fixed` clone of the
//     source cell, appended to `<body>` and parked at the source rect) is NOT
//     rendered — cloning and measuring is exactly what is missing. The sheet's
//     ghost rules are still registered with the component, so a host overlay
//     that opts into that class paints identically.
//   * The grip is mounted through `dangerous_inner_html` on its own
//     `style="display:contents"` host (ledger L49: an `rsx!` `svg {}` child is
//     created in the HTML namespace and never paints). `display: contents`
//     keeps the glyph a flex item of the handle exactly as Vue's inline `<svg>`
//     is. The markup is a constant — no consumer string enters it, so no
//     escaper runs.
//   * No i18n: the Vue component renders no user-facing string (the grip is a
//     drawing; the only accessible names in this family are host-owned), so
//     this file adds ZERO `hikari_i18n::t` keys.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DraggableGridComponent;

/// Vue: `MAX_COLS = 3` — the per-row capacity the hit test calls "full".
pub const DRAGGABLE_GRID_MAX_COLS: usize = 3;

const GRID_ROOT: &str = "hk-draggable-grid";
const GRID_ROW: &str = "hk-draggable-grid-row";
const GRID_ROW_PHANTOM: &str = "hk-draggable-grid-row hk-draggable-grid-row-phantom";
const GRID_CELL: &str = "hk-draggable-grid-cell";
const GRID_CELL_TARGET: &str = "hk-draggable-grid-cell hk-draggable-grid-cell-placeholder-target";
const GRID_HANDLE: &str = "hk-draggable-grid-handle";
const GRID_CONTENT: &str = "hk-draggable-grid-content";

/// Vue's `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">`
/// six-dot grip, serialized as the inner markup of its `display:contents` host
/// (see the L49 delta in the header). Same attribute order as the source.
const GRID_GRIP_SVG: &str = concat!(
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

/// One grid cell (Vue: `GridItem` + the `cell` slot's rendered output). Vue's
/// `locked?: boolean` field is intentionally absent: the component only ever
/// reads `lockedKeys`.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DraggableGridItem {
    /// Stable identity — the drag source's key and the cell's patch key.
    pub key: String,

    /// The cell body (Vue: `slots.cell({ item, row, col, locked })`).
    pub content: Element,
}

impl DraggableGridItem {
    pub fn new(key: impl Into<String>, content: Element) -> Self {
        Self {
            key: key.into(),
            content,
        }
    }
}

/// One cell address (Vue: `GridCellAddress`). `col` may point ONE PAST the
/// row's last cell — the hit test's append slot, which is a legal placeholder
/// but not a cell.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct DraggableGridAddress {
    pub row: usize,
    pub col: usize,
}

impl DraggableGridAddress {
    pub fn new(row: usize, col: usize) -> Self {
        Self { row, col }
    }
}

/// The drag-start / drag-end payload (Vue: the `(row, col, item)` a pointerdown
/// resolved to; the key rides along so the host does not re-resolve it).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DraggableGridDrag {
    pub from: DraggableGridAddress,
    pub key: String,
}

/// The drop payload — Vue's `emit("reorder", from, to)`.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DraggableGridDrop {
    pub from: DraggableGridAddress,
    pub to: DraggableGridAddress,
}

// ── pure functions (the index/geometry math the drag engine ran on) ──────

/// Vue: `Math.max(1, cells.length)` — both `data-cols` and the `--hk-grid-cols`
/// property. An EMPTY row still claims one column, so its insertion marker and
/// its `flex-basis` keep the row readable.
pub fn draggable_grid_col_count(cells: usize) -> usize {
    cells.max(1)
}

/// Vue's `isLocked(key)`: membership in `lockedKeys`.
pub fn draggable_grid_is_locked(key: &str, locked_keys: &[String]) -> bool {
    locked_keys.iter().any(|locked| locked == key)
}

/// The row-major linear index of a REAL cell. The grid is ragged, so a host
/// that flattens it for a linear reorder API must not guess the stride; a SLOT
/// address (`col >= cells.len()`) is not a cell and yields `None`.
pub fn draggable_grid_linear_index(
    rows: &[Vec<DraggableGridItem>],
    address: DraggableGridAddress,
) -> Option<usize> {
    let cells = rows.get(address.row)?;
    if address.col >= cells.len() {
        return None;
    }
    Some(rows[..address.row].iter().map(Vec::len).sum::<usize>() + address.col)
}

/// The inverse of [`draggable_grid_linear_index`] over the same ragged rows.
/// An empty row owns no index, so linear index `0` of `[[], [a]]` is `(1, 0)`.
pub fn draggable_grid_address_at(
    rows: &[Vec<DraggableGridItem>],
    linear: usize,
) -> Option<DraggableGridAddress> {
    let mut remaining = linear;
    for (row, cells) in rows.iter().enumerate() {
        if remaining < cells.len() {
            return Some(DraggableGridAddress::new(row, remaining));
        }
        remaining -= cells.len();
    }
    None
}

/// The address of the first cell carrying `key` (row-major): Vue's drag source
/// is a resolved ADDRESS, and the controlled mirror only gets the key.
pub fn draggable_grid_address_of_key(
    rows: &[Vec<DraggableGridItem>],
    key: &str,
) -> Option<DraggableGridAddress> {
    rows.iter().enumerate().find_map(|(row, cells)| {
        cells
            .iter()
            .position(|item| item.key == key)
            .map(|col| DraggableGridAddress::new(row, col))
    })
}

/// Vue's `drag != null` gate, spelled the controlled way: a drag is in flight
/// as soon as the host published a source key that still resolves to a cell of
/// the CURRENT rows. `placeholder` is NOT a second gate — Vue derives it from
/// the source at press time (see [`draggable_grid_placeholder_slot`]).
pub fn draggable_grid_drag_active(from: Option<DraggableGridAddress>) -> bool {
    from.is_some()
}

/// Vue's `drag.placeholder`, resolved: the host's slot while it is one the hit
/// test could have produced, else the SOURCE address — the value Vue
/// initialises on press, before the pointer has moved anywhere.
pub fn draggable_grid_placeholder_slot(
    rows: &[Vec<DraggableGridItem>],
    placeholder: Option<DraggableGridAddress>,
    from: Option<DraggableGridAddress>,
) -> Option<DraggableGridAddress> {
    let from = from?;
    Some(
        placeholder
            .filter(|address| draggable_grid_address_in_bounds(rows, *address))
            .unwrap_or(from),
    )
}

/// Vue: `s.from.row === row && s.from.col === col`.
pub fn draggable_grid_cell_is_source(
    from: Option<DraggableGridAddress>,
    row: usize,
    col: usize,
) -> bool {
    from.is_some_and(|from| from.row == row && from.col == col)
}

/// Vue: `phRow === row && phCol === col && !isSource` — the cell's left-edge
/// insertion marker. The source cell never marks itself.
pub fn draggable_grid_cell_marks_placeholder(
    from: Option<DraggableGridAddress>,
    placeholder: Option<DraggableGridAddress>,
    row: usize,
    col: usize,
) -> bool {
    placeholder.is_some_and(|placeholder| placeholder.row == row && placeholder.col == col)
        && !draggable_grid_cell_is_source(from, row, col)
}

/// Vue's `isPhRowAfter`: the ROW's right-edge marker, drawn while the
/// placeholder sits past the row's last cell (`col >= cells.len()`).
pub fn draggable_grid_placeholder_row_after(
    placeholder: Option<DraggableGridAddress>,
    row: usize,
    cells: usize,
) -> bool {
    placeholder.is_some_and(|placeholder| placeholder.row == row && placeholder.col >= cells)
}

/// Vue's phantom append row: rendered while the placeholder is PAST the last
/// rendered row (the hit test produces exactly `rows.len()` there).
pub fn draggable_grid_phantom_visible(
    placeholder: Option<DraggableGridAddress>,
    row_count: usize,
) -> bool {
    placeholder.is_some_and(|placeholder| placeholder.row >= row_count)
}

/// Vue's full-row redirect: a row at capacity that does NOT contain the source
/// pushes the placeholder to the first slot of the NEXT row — which may be the
/// phantom row when the full row is the last one.
pub fn draggable_grid_full_row_redirect(
    cells: usize,
    row: usize,
    source_row: usize,
) -> Option<DraggableGridAddress> {
    if cells >= DRAGGABLE_GRID_MAX_COLS && row != source_row {
        Some(DraggableGridAddress::new(row + 1, 0))
    } else {
        None
    }
}

/// The slot space the hit test can produce: a real cell, a row's append slot
/// (`col == cells.len()`), or the phantom row (`row == rows.len()` and
/// `col == 0`). A host-supplied placeholder is gated on this before it can
/// become a drop target.
pub fn draggable_grid_address_in_bounds(
    rows: &[Vec<DraggableGridItem>],
    address: DraggableGridAddress,
) -> bool {
    match rows.get(address.row) {
        Some(cells) => address.col <= cells.len(),
        None => address.row == rows.len() && address.col == 0,
    }
}

/// Vue's `reorder` emit guard: a drop exists only when the placeholder moved
/// OFF the source address and lands in the slot space.
pub fn draggable_grid_drop(
    rows: &[Vec<DraggableGridItem>],
    from: Option<DraggableGridAddress>,
    placeholder: Option<DraggableGridAddress>,
) -> Option<DraggableGridDrop> {
    let (from, to) = (from?, placeholder?);
    if from == to || !draggable_grid_address_in_bounds(rows, to) {
        return None;
    }
    Some(DraggableGridDrop { from, to })
}

/// Vue's row walk (`recomputePlaceholder`): the FIRST row whose vertical
/// midpoint lies below the pointer wins; a pointer below every midpoint lands
/// on the last measured row. `None` = no measured row at all (Vue falls back to
/// `s.from.row`); a `None` ENTRY is an unmeasured row, which Vue's
/// `if (!el) continue` skips without touching the pick.
pub fn draggable_grid_row_for(client_y: f64, row_mids: &[Option<f64>]) -> Option<usize> {
    let mut picked: Option<usize> = None;
    for (row, mid) in row_mids.iter().enumerate() {
        let Some(mid) = mid else { continue };
        if client_y < *mid {
            return Some(row);
        }
        picked = Some(row);
    }
    picked
}

/// Vue's cell walk inside ONE row: the first measured cell whose horizontal
/// midpoint lies past the pointer, else the row's APPEND SLOT
/// (`cell_mids.len()` — one past the last cell). `skip_col` is the source cell,
/// passed only while the source row IS this row (Vue's `sourceInThisRow`
/// conjunction). A `None` entry is an unmeasured cell and is skipped.
pub fn draggable_grid_col_for(
    client_x: f64,
    cell_mids: &[Option<f64>],
    skip_col: Option<usize>,
) -> usize {
    for (col, mid) in cell_mids.iter().enumerate() {
        if skip_col == Some(col) {
            continue;
        }
        let Some(mid) = mid else { continue };
        if client_x < *mid {
            return col;
        }
    }
    cell_mids.len()
}

// ── marker spellings (Vue's two presence conventions) ────────────────────

/// Vue's `flag || undefined`: `data-*` carries `"true"` while the flag is on
/// and is genuinely ABSENT otherwise (`data-locked={locked || undefined}`).
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
/// button or a locked cell starts nothing. Returns what it published.
fn grid_press(
    pressed: DraggableGridAddress,
    key: &str,
    locked: bool,
    button: i16,
    handler: &Option<EventHandler<DraggableGridDrag>>,
) -> Option<DraggableGridDrag> {
    if locked || button != 0 {
        return None;
    }
    let payload = DraggableGridDrag {
        from: pressed,
        key: key.to_string(),
    };
    if let Some(handler) = handler {
        handler.call(payload.clone());
    }
    Some(payload)
}

/// Vue's `recomputePlaceholder` "changed" branch: publish the cell the pointer
/// entered — never the source cell, never a locked one, never while no drag is
/// in flight.
fn grid_over(
    over: DraggableGridAddress,
    active: bool,
    source: bool,
    locked: bool,
    handler: &Option<EventHandler<DraggableGridAddress>>,
) -> Option<DraggableGridAddress> {
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
fn grid_release(
    drop_payload: Option<DraggableGridDrop>,
    end_payload: Option<DraggableGridDrag>,
    on_drop: &Option<EventHandler<DraggableGridDrop>>,
    on_drag_end: &Option<EventHandler<DraggableGridDrag>>,
) -> (Option<DraggableGridDrop>, Option<DraggableGridDrag>) {
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
pub struct DraggableGridProps {
    /// The rows of cells, in render order (Vue: `rows`, required).
    #[default]
    pub rows: Vec<Vec<DraggableGridItem>>,

    /// Cell keys that may not start a drag (Vue: `lockedKeys`).
    #[default]
    pub locked_keys: Vec<String>,

    /// CONTROLLED: the key of the cell being dragged (Vue: `drag.from`).
    /// Resolved to an address through `rows`; an unknown key renders the
    /// settled DOM, exactly like Vue's `drag === null`.
    pub dragging_key: Option<String>,

    /// CONTROLLED: the placeholder slot (Vue: `drag.placeholder`). Optional —
    /// while the host has not published one, the source address stands in, the
    /// value Vue initialises on press.
    pub placeholder: Option<DraggableGridAddress>,

    /// Custom grip glyph (Vue: the `handle` slot, one glyph for every row).
    pub handle: Option<Element>,

    /// Extra class appended to the root (Vue merges the fallthrough class).
    #[default]
    pub class: String,

    /// Fires when a press starts a drag candidate (Vue: `onPointerDown`).
    pub on_drag_start: Option<EventHandler<DraggableGridDrag>>,

    /// Fires with the cell the pointer entered (Vue: the recomputed
    /// placeholder).
    pub on_drag_over: Option<EventHandler<DraggableGridAddress>>,

    /// Fires with Vue's `reorder(from, to)` payload when the drop is real.
    pub on_drop: Option<EventHandler<DraggableGridDrop>>,

    /// Fires when a drag is released (Vue: `drag.value = null`).
    pub on_drag_end: Option<EventHandler<DraggableGridDrag>>,
}

#[component]
pub fn DraggableGrid(props: DraggableGridProps) -> Element {
    let from = props
        .dragging_key
        .as_deref()
        .and_then(|key| draggable_grid_address_of_key(&props.rows, key));
    let active = draggable_grid_drag_active(from);
    // Vue's `drag` is ONE object whose `placeholder` starts at the source
    // address: a host that has not published a slot yet paints Vue's unmoved
    // state, and a slot outside the slot space never marks a cell.
    let placeholder = draggable_grid_placeholder_slot(&props.rows, props.placeholder, from);

    let drop_payload = draggable_grid_drop(&props.rows, from, placeholder);
    let end_payload = if active {
        from.map(|from| DraggableGridDrag {
            from,
            key: props.dragging_key.clone().unwrap_or_default(),
        })
    } else {
        None
    };

    let mut row_nodes: Vec<VNode> = Vec::with_capacity(props.rows.len() + 1);
    for (row, cells) in props.rows.iter().enumerate() {
        let cols = draggable_grid_col_count(cells.len());
        let row_after = draggable_grid_placeholder_row_after(placeholder, row, cells.len());

        let mut cell_nodes: Vec<VNode> = Vec::with_capacity(cells.len());
        for (col, item) in cells.iter().enumerate() {
            let locked = draggable_grid_is_locked(&item.key, &props.locked_keys);
            let source = draggable_grid_cell_is_source(from, row, col);
            let ph_before = draggable_grid_cell_marks_placeholder(from, placeholder, row, col);

            let handle = VElement::new("span")
                .class(GRID_HANDLE)
                .attr("data-hidden", marker_attr(locked))
                .child(match props.handle.as_ref() {
                    Some(slot) => slot.clone(),
                    None => grip_host(GRID_GRIP_SVG),
                });
            let content = VElement::new("div")
                .class(GRID_CONTENT)
                .child(item.content.clone());

            let mut cell = VElement::new("div")
                .class(GRID_CELL)
                .attr("data-locked", marker_attr(locked))
                .attr("data-dragging", marker_attr(source))
                .attr("data-placeholder", ph_before.then_some("before"))
                .key(&item.key)
                .child(VNode::Element(Box::new(handle)))
                .child(VNode::Element(Box::new(content)));

            // The handle is a CHILD of the cell in Vue, and its own pointerdown
            // only stops propagation before calling the same entry point — so
            // one binding on the cell is what the browser actually observes.
            let press_handler = props.on_drag_start.clone();
            let press_key = item.key.clone();
            cell = cell.on_mousedown(move |event: MouseEvent| {
                let _ = grid_press(
                    DraggableGridAddress::new(row, col),
                    &press_key,
                    locked,
                    event.button,
                    &press_handler,
                );
            });

            let over_handler = props.on_drag_over.clone();
            if active && !locked && !source {
                cell = cell.on_mouseenter(move |_event: MouseEvent| {
                    let _ = grid_over(
                        DraggableGridAddress::new(row, col),
                        active,
                        source,
                        locked,
                        &over_handler,
                    );
                });
            }

            cell_nodes.push(VNode::Element(Box::new(cell)));
        }

        let row_key = row.to_string();
        let row_el = VElement::new("div")
            .class(GRID_ROW)
            .attr("data-cols", cols)
            .attr("data-placeholder-row", row_after.then_some("after"))
            .with_css_var("--hk-grid-cols", &cols.to_string())
            .key(&row_key)
            .children(cell_nodes);
        row_nodes.push(VNode::Element(Box::new(row_el)));
    }

    // The phantom append row: the hit test redirects past the last row when it
    // is full, and this is the box the placeholder then lands in.
    if draggable_grid_phantom_visible(placeholder, props.rows.len()) {
        row_nodes.push(rsx! {
            div {
                class: GRID_ROW_PHANTOM,
                "data-cols": "1",
                div { class: GRID_CELL_TARGET }
            }
        });
    }

    let root_classes = if props.class.is_empty() {
        GRID_ROOT.to_string()
    } else {
        format!("{GRID_ROOT} {}", props.class)
    };
    let mut root = VElement::new("div")
        .class(root_classes)
        .attr("data-dragging", empty_marker_attr(active))
        .children(row_nodes);

    // Vue binds its release on `window`; a root-level `mouseup` sees every
    // release inside the surface (see the header delta for the rest).
    let release_drop = props.on_drop.clone();
    let release_end = props.on_drag_end.clone();
    root = root.on_mouseup(move |_event: MouseEvent| {
        let _ = grid_release(
            drop_payload.clone(),
            end_payload.clone(),
            &release_drop,
            &release_end,
        );
    });

    VNode::Element(Box::new(root))
}

impl StyledComponent for DraggableGridComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDraggableGrid.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "draggable-grid"
    }
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::rc::Rc;

    use super::*;

    fn cell(key: &str) -> DraggableGridItem {
        DraggableGridItem::new(
            key,
            rsx! {
                span { class: "body", "{key}" }
            },
        )
    }

    fn grid_rows() -> Vec<Vec<DraggableGridItem>> {
        vec![vec![cell("a"), cell("b"), cell("c")], vec![cell("d")]]
    }

    fn at(row: usize, col: usize) -> Option<DraggableGridAddress> {
        Some(DraggableGridAddress::new(row, col))
    }

    fn locked() -> Vec<String> {
        vec!["b".to_string()]
    }

    #[test]
    fn draggable_grid_defaults_match_the_vue_props() {
        let props = DraggableGridProps::default();
        assert!(props.rows.is_empty());
        assert!(props.locked_keys.is_empty());
        assert!(props.dragging_key.is_none());
        assert!(props.placeholder.is_none());
        assert!(props.handle.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_drag_start.is_none());
        assert!(props.on_drag_over.is_none());
        assert!(props.on_drop.is_none());
        assert!(props.on_drag_end.is_none());
        // Vue's `MAX_COLS` is 3; the mirror keeps the same capacity constant.
        assert_eq!(DRAGGABLE_GRID_MAX_COLS, 3);
    }

    #[test]
    fn draggable_grid_linear_index_round_trips_over_ragged_rows() {
        let rows = grid_rows();
        // Row-major: 0,1,2 across the first row, 3 for the lone cell after it.
        assert_eq!(
            draggable_grid_linear_index(&rows, DraggableGridAddress::new(0, 0)),
            Some(0)
        );
        assert_eq!(
            draggable_grid_linear_index(&rows, DraggableGridAddress::new(0, 2)),
            Some(2)
        );
        assert_eq!(
            draggable_grid_linear_index(&rows, DraggableGridAddress::new(1, 0)),
            Some(3)
        );
        // The append slot (col == cells.len()) is not a cell ...
        assert_eq!(
            draggable_grid_linear_index(&rows, DraggableGridAddress::new(1, 1)),
            None
        );
        // ... and neither is a row past the last one.
        assert_eq!(
            draggable_grid_linear_index(&rows, DraggableGridAddress::new(2, 0)),
            None
        );
        // The inverse agrees, and an empty grid owns no index at all.
        for linear in 0..4 {
            let address = draggable_grid_address_at(&rows, linear).expect("address");
            assert_eq!(draggable_grid_linear_index(&rows, address), Some(linear));
        }
        assert_eq!(draggable_grid_address_at(&rows, 4), None);
        assert_eq!(draggable_grid_address_at(&[], 0), None);
        // An empty row occupies no linear index: `[[], [a]]` starts at row 1.
        let sparse = vec![Vec::new(), vec![cell("a")]];
        assert_eq!(
            draggable_grid_address_at(&sparse, 0),
            Some(DraggableGridAddress::new(1, 0))
        );
    }

    #[test]
    fn draggable_grid_resolves_the_source_key_and_locks() {
        let rows = grid_rows();
        assert_eq!(
            draggable_grid_address_of_key(&rows, "c"),
            Some(DraggableGridAddress::new(0, 2))
        );
        assert_eq!(
            draggable_grid_address_of_key(&rows, "d"),
            Some(DraggableGridAddress::new(1, 0))
        );
        // An unknown (or empty) key resolves to nothing — the settled arm.
        assert_eq!(draggable_grid_address_of_key(&rows, "zzz"), None);
        assert_eq!(draggable_grid_address_of_key(&rows, ""), None);
        // Vue's `lockedKeys.includes(key)`.
        assert!(draggable_grid_is_locked("b", &locked()));
        assert!(!draggable_grid_is_locked("a", &locked()));
        assert!(!draggable_grid_is_locked("", &[]));
    }

    #[test]
    fn draggable_grid_drag_gate_follows_the_resolved_source() {
        // The source key IS the gate: Vue's `drag` object exists from press on.
        assert!(draggable_grid_drag_active(at(0, 0)));
        assert!(!draggable_grid_drag_active(None));
    }

    #[test]
    fn draggable_grid_placeholder_defaults_to_the_source() {
        let rows = grid_rows();
        // An unpublished slot is the source cell — Vue's value on press.
        assert_eq!(
            draggable_grid_placeholder_slot(&rows, None, at(0, 0)),
            at(0, 0)
        );
        // A legal slot (a cell, an append slot, the phantom row) is honoured.
        assert_eq!(
            draggable_grid_placeholder_slot(&rows, at(0, 2), at(0, 0)),
            at(0, 2)
        );
        assert_eq!(
            draggable_grid_placeholder_slot(&rows, at(1, 1), at(0, 0)),
            at(1, 1)
        );
        assert_eq!(
            draggable_grid_placeholder_slot(&rows, at(2, 0), at(0, 0)),
            at(2, 0)
        );
        // A slot the hit test could not produce falls back to the source, so a
        // stale host value never paints a marker or a phantom row.
        assert_eq!(
            draggable_grid_placeholder_slot(&rows, at(1, 2), at(0, 0)),
            at(0, 0)
        );
        assert_eq!(
            draggable_grid_placeholder_slot(&rows, at(9, 0), at(0, 0)),
            at(0, 0)
        );
        // No source, no placeholder (no drag at all).
        assert_eq!(draggable_grid_placeholder_slot(&rows, at(0, 1), None), None);
    }

    #[test]
    fn draggable_grid_markers_follow_the_placeholder() {
        let from = at(0, 0);
        // The source cell marks ITSELF, never the insertion marker.
        assert!(draggable_grid_cell_is_source(from, 0, 0));
        assert!(!draggable_grid_cell_is_source(from, 0, 1));
        assert!(!draggable_grid_cell_marks_placeholder(from, from, 0, 0));
        assert!(draggable_grid_cell_marks_placeholder(from, at(0, 1), 0, 1));
        assert!(!draggable_grid_cell_marks_placeholder(from, at(0, 1), 0, 2));
        // No drag → no source, no marker.
        assert!(!draggable_grid_cell_is_source(None, 0, 0));
        assert!(!draggable_grid_cell_marks_placeholder(None, None, 0, 0));
        // The row's right-edge marker needs the APPEND slot, not a real cell.
        assert!(!draggable_grid_placeholder_row_after(at(0, 0), 0, 3));
        assert!(draggable_grid_placeholder_row_after(at(0, 3), 0, 3));
        assert!(!draggable_grid_placeholder_row_after(
            Some(DraggableGridAddress::new(0, 3)),
            1,
            1
        ));
        // The phantom row starts AT the row count.
        assert!(!draggable_grid_phantom_visible(at(1, 0), 2));
        assert!(draggable_grid_phantom_visible(at(2, 0), 2));
        assert!(draggable_grid_phantom_visible(at(3, 0), 2));
        assert!(!draggable_grid_phantom_visible(None, 0));
    }

    #[test]
    fn draggable_grid_full_row_redirects_to_the_next_row_head() {
        // A full row the source is NOT in pushes to the next row's first slot.
        assert_eq!(
            draggable_grid_full_row_redirect(3, 0, 1),
            Some(DraggableGridAddress::new(1, 0))
        );
        // Room left in the row: no redirect (the cell walk decides).
        assert_eq!(draggable_grid_full_row_redirect(2, 0, 1), None);
        // The row holding the source is never "full" for its own cell.
        assert_eq!(draggable_grid_full_row_redirect(3, 0, 0), None);
        // Past capacity still redirects (Vue only tests `>= MAX_COLS`).
        assert_eq!(
            draggable_grid_full_row_redirect(4, 2, 0),
            Some(DraggableGridAddress::new(3, 0))
        );
    }

    #[test]
    fn draggable_grid_drop_only_when_the_slot_actually_moved() {
        let rows = grid_rows();
        // Same address: Vue emits nothing (the `sameAddress` guard).
        assert_eq!(draggable_grid_drop(&rows, at(0, 0), at(0, 0)), None);
        // A real move between cells.
        assert_eq!(
            draggable_grid_drop(&rows, at(0, 0), at(0, 2)),
            Some(DraggableGridDrop {
                from: DraggableGridAddress::new(0, 0),
                to: DraggableGridAddress::new(0, 2),
            })
        );
        // The row's append slot and the phantom row are legal targets.
        assert!(draggable_grid_drop(&rows, at(0, 0), at(1, 1)).is_some());
        assert!(draggable_grid_drop(&rows, at(0, 0), at(2, 0)).is_some());
        // Out of the slot space: nothing is emitted for a nonsense address.
        assert_eq!(draggable_grid_drop(&rows, at(0, 0), at(1, 2)), None);
        assert_eq!(draggable_grid_drop(&rows, at(0, 0), at(3, 0)), None);
        // A half-published drag has no target at all.
        assert_eq!(draggable_grid_drop(&rows, at(0, 0), None), None);
        assert_eq!(draggable_grid_drop(&rows, None, at(0, 1)), None);
        // An empty grid owns exactly one legal slot: its phantom row.
        assert!(draggable_grid_address_in_bounds(
            &[],
            DraggableGridAddress::new(0, 0)
        ));
        assert!(!draggable_grid_address_in_bounds(
            &[],
            DraggableGridAddress::new(0, 1)
        ));
        assert!(!draggable_grid_address_in_bounds(
            &[],
            DraggableGridAddress::new(1, 0)
        ));
        // Empty row: col 0 is its append slot.
        let address = at(0, 0).expect("(0,0) is a valid address");
        assert!(draggable_grid_address_in_bounds(&[Vec::new()], address));
    }

    #[test]
    fn draggable_grid_hit_test_walks_like_vue() {
        // No measured row at all: Vue keeps `s.from.row`.
        assert_eq!(draggable_grid_row_for(100.0, &[]), None);
        assert_eq!(draggable_grid_row_for(100.0, &[None, None]), None);
        // Above the first midpoint → that row; below all → the last measured.
        assert_eq!(
            draggable_grid_row_for(0.0, &[Some(50.0), Some(150.0)]),
            Some(0)
        );
        assert_eq!(
            draggable_grid_row_for(90.0, &[Some(50.0), Some(150.0)]),
            Some(1)
        );
        assert_eq!(
            draggable_grid_row_for(900.0, &[Some(50.0), Some(150.0)]),
            Some(1)
        );
        // An unmeasured row is skipped without touching the pick, but it can
        // still be the LAST measured row's neighbour: the walk continues.
        assert_eq!(
            draggable_grid_row_for(90.0, &[Some(50.0), None, Some(150.0)]),
            Some(2)
        );
        assert_eq!(draggable_grid_row_for(90.0, &[Some(50.0), None]), Some(0));

        // The cell walk: first midpoint past the pointer, else the append slot.
        let mids = [Some(40.0), Some(80.0), Some(120.0)];
        assert_eq!(draggable_grid_col_for(10.0, &mids, None), 0);
        assert_eq!(draggable_grid_col_for(60.0, &mids, None), 1);
        assert_eq!(draggable_grid_col_for(140.0, &mids, None), 3);
        // The source cell is skipped, so the walk continues past its midpoint.
        assert_eq!(draggable_grid_col_for(10.0, &mids, Some(0)), 1);
        // An unmeasured cell is skipped, not returned.
        assert_eq!(draggable_grid_col_for(10.0, &[None, Some(80.0)], None), 1);
        assert_eq!(draggable_grid_col_for(100.0, &[None, None], None), 2);
    }

    #[test]
    fn draggable_grid_emits_through_the_live_handlers() {
        let seen: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));

        let start_log = Rc::clone(&seen);
        let on_start = Some(EventHandler::new(move |payload: DraggableGridDrag| {
            start_log
                .borrow_mut()
                .push(format!("start:{}@{}", payload.key, payload.from.col));
        }));
        // A locked cell never starts, and neither does a secondary button.
        assert_eq!(
            grid_press(DraggableGridAddress::new(0, 1), "b", true, 0, &on_start),
            None
        );
        assert_eq!(
            grid_press(DraggableGridAddress::new(0, 1), "b", false, 2, &on_start),
            None
        );
        let pressed = grid_press(DraggableGridAddress::new(0, 1), "b", false, 0, &on_start);
        assert!(pressed.is_some());

        let over_log = Rc::clone(&seen);
        let on_over = Some(EventHandler::new(move |payload: DraggableGridAddress| {
            over_log.borrow_mut().push(format!("over:{}", payload.col));
        }));
        // No drag / the source cell / a locked cell publish nothing.
        assert_eq!(
            grid_over(
                DraggableGridAddress::new(0, 2),
                false,
                false,
                false,
                &on_over
            ),
            None
        );
        assert_eq!(
            grid_over(DraggableGridAddress::new(0, 2), true, true, false, &on_over),
            None
        );
        assert_eq!(
            grid_over(DraggableGridAddress::new(0, 2), true, false, true, &on_over),
            None
        );
        assert_eq!(
            grid_over(
                DraggableGridAddress::new(0, 2),
                true,
                false,
                false,
                &on_over
            ),
            at(0, 2)
        );

        let drop_log = Rc::clone(&seen);
        let end_log = Rc::clone(&seen);
        let on_drop = Some(EventHandler::new(move |payload: DraggableGridDrop| {
            drop_log
                .borrow_mut()
                .push(format!("drop:{}>{}", payload.from.row, payload.to.col));
        }));
        let on_end = Some(EventHandler::new(move |payload: DraggableGridDrag| {
            end_log.borrow_mut().push(format!("end:{}", payload.key));
        }));
        let (dropped, ended) = grid_release(
            Some(DraggableGridDrop {
                from: DraggableGridAddress::new(0, 0),
                to: DraggableGridAddress::new(1, 0),
            }),
            Some(DraggableGridDrag {
                from: DraggableGridAddress::new(0, 0),
                key: "a".to_string(),
            }),
            &on_drop,
            &on_end,
        );
        assert!(dropped.is_some() && ended.is_some());
        // A release with nothing in flight is silent.
        grid_release(None, None, &on_drop, &on_end);

        assert_eq!(
            seen.borrow().clone(),
            vec![
                "start:b@1".to_string(),
                "over:2".to_string(),
                "drop:0>0".to_string(),
                "end:a".to_string(),
            ]
        );
    }

    #[test]
    fn draggable_grid_renders_the_vue_dom_contract() {
        let html = DraggableGrid(DraggableGridProps {
            rows: grid_rows(),
            locked_keys: locked(),
            dragging_key: Some("a".to_string()),
            // The append slot of the LAST row: the phantom row must appear.
            placeholder: at(2, 0),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-draggable-grid""#,
            // The root marker is the EMPTY spelling (Vue `s ? "" : undefined`).
            r#"data-dragging="""#,
            r#"class="hk-draggable-grid-row""#,
            r#"data-cols="3""#,
            r#"data-cols="1""#,
            "--hk-grid-cols:3",
            r#"class="hk-draggable-grid-cell""#,
            // A cell's source marker is the "true" spelling.
            r#"data-dragging="true""#,
            r#"data-locked="true""#,
            r#"class="hk-draggable-grid-handle""#,
            r#"data-hidden="true""#,
            r#"class="hk-draggable-grid-content""#,
            "hk-draggable-grid-row-phantom",
            "hk-draggable-grid-cell-placeholder-target",
            r#"style="display:contents""#,
            r#"<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">"#,
            r#"<circle cx="10" cy="11" r="1.2"/>"#,
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The source cell is the FIRST cell of the first row, in order.
        let first_cell = html.find("data-dragging=\"true\"").expect("source cell");
        let second_row = html.find("data-cols=\"1\"").expect("row two");
        assert!(first_cell < second_row, "cells before rows: {html}");
        // The phantom row renders AFTER every real row.
        let phantom = html
            .find("hk-draggable-grid-row-phantom")
            .expect("phantom row");
        assert!(second_row < phantom, "phantom must trail: {html}");

        // A settled grid carries none of the drag markers.
        let settled = DraggableGrid(DraggableGridProps {
            rows: grid_rows(),
            locked_keys: locked(),
            ..Default::default()
        })
        .render_to_html();
        assert!(!settled.contains(r#"data-dragging="""#), "{settled}");
        assert!(!settled.contains(r#"data-dragging="true""#), "{settled}");
        assert!(!settled.contains("data-placeholder"), "{settled}");
        assert!(!settled.contains("phantom"), "{settled}");
        // Locked-ness survives without a drag: the grip stays reserved.
        assert!(settled.contains(r#"data-hidden="true""#), "{settled}");
        assert!(settled.contains(r#"data-locked="true""#), "{settled}");

        // The insertion markers themselves, and the empty-row column count.
        let marked = DraggableGrid(DraggableGridProps {
            rows: vec![vec![cell("a")], Vec::new()],
            dragging_key: Some("a".to_string()),
            placeholder: at(0, 1),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            marked.contains(r#"data-placeholder-row="after""#),
            "{marked}"
        );
        assert!(!marked.contains(r#"data-placeholder="before""#), "{marked}");
        // An empty row still claims one column (Vue's `Math.max(1, len)`).
        assert!(marked.contains("--hk-grid-cols:1"), "{marked}");
        // No phantom row when the placeholder is not past the last row.
        assert!(!marked.contains("phantom"), "{marked}");

        let before = DraggableGrid(DraggableGridProps {
            rows: vec![vec![cell("a"), cell("b")]],
            dragging_key: Some("a".to_string()),
            placeholder: at(0, 1),
            ..Default::default()
        })
        .render_to_html();
        assert!(before.contains(r#"data-placeholder="before""#), "{before}");
        assert!(!before.contains("data-placeholder-row"), "{before}");
        assert!(before.contains(r#"data-dragging="true""#), "{before}");
    }

    #[test]
    fn draggable_grid_styles_come_from_the_canonical_vue_sheet() {
        let css = DraggableGridComponent::styles();
        assert!(
            css.contains(".hk-draggable-grid")
                && css.contains(".hk-draggable-grid-row-phantom")
                && css.contains(".hk-draggable-grid-ghost")
                && css.contains("--hk-grid-cols"),
            "draggable grid css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored draggable grid sheet"
        );
    }
}
