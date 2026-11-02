// hi-components/src/data/selection_grid.rs
// SelectionGrid — mirror of the canonical Vue `HkSelectionGrid`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSelectionGrid.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-selection-grid*` class names are literal and identical in both forms.
// DOM contract (mirrors Vue one-to-one):
//
//   div.hk-selection-grid  data-layout={grid|list} [data-edge]
//     h4.hk-selection-grid-title?                              (group_title)
//     div.hk-selection-grid-grid  [data-cols={2|3|4} | data-fluid]
//         [data-dense]  (style: --hk-selection-grid-item-min in fluid mode)
//       div.hk-selection-grid-item  role="button" tabindex="0"
//           aria-selected={true|false} [data-selected]
//         div.hk-selection-grid-check                   (always drawn; the
//           div[style="display:contents"]>svg           sheet fades it in when
//                                                       selected — 14px Check)
//         div.hk-selection-grid-content
//           div.hk-selection-grid-header
//             div.hk-icon.hk-selection-grid-icon?       (16px item icon)
//             span.hk-selection-grid-name
//             span.hk-selection-grid-badge [data-variant]?
//           p.hk-selection-grid-desc?
//         div.hk-selection-grid-actions?                (item.actions)
//           button.hk-selection-grid-action  type=button title=… aria-label=…
//               [disabled]
//             div.hk-icon?                              (14px action icon)
//     p.hk-selection-grid-hint?                                (hint)
//
// Selection STATE is a pure function of the controlled props — no signal, no
// local state: `selection_grid_is_selected` answers the per-item question and
// `selection_grid_next_selection` is the set operation a host applies in
// `on_select` (a single-mode click REPLACES the id set, so exactly one option
// can ever be selected; a multi-mode click toggles its id). The id-set
// primitives (`selection_has_id` / `selection_toggle_id` /
// `selection_single_id`) are shared with the sibling `SelectionWaterfall`
// mirror.
//
// Layout math is pure and unit-tested instead of painted: the sheet owns the
// track template, so the mirror carries the same rules as data —
// `selection_grid_fluid_columns` (the `repeat(auto-fill, minmax(min(floor,
// 100%), 1fr))` derivation), `selection_grid_breakpoint_columns` (the
// `max-width: 640px` / `max-width: 420px` folds), `selection_grid_rows` (the
// row count of a flat, row-major list) and `selection_grid_gap_px` (the sheet's
// two gaps).
//
// NOTE on the wave brief's "cross-column duration conversion": neither this
// component nor `HkSelectionWaterfall` has a time axis — no duration / span
// prop exists in either Vue source — so there is no duration math to mirror.
// The cross-column math they DO have is the breakpoint fold + adaptive track
// derivation above and the waterfall's wrap-overflow rule. Recorded here so the
// omission reads as a documented delta, not an oversight.
//
// The SVG rides `dangerous_inner_html` (ledger L49: an rsx `svg {}` builds an
// HTML-namespace node that never paints) on its OWN `display:contents` host,
// so the parser puts the nodes in the SVG namespace and the cell keeps any
// sibling content (the progress-ring R2 S0 finding).
//
// Deltas vs Vue (documented): item / action icons are typed `MdiIcon`s (Vue
// takes components) rendered 16px / 14px through the mirrored `Icon`; the
// `select` / `action` emits carry ids (`EventHandler<String>` /
// `SelectionGridActionEvent`) instead of the item and action objects, like the
// sibling `Selection` / `Tree` mirrors; an empty `items` list renders the
// empty vnode (Vue returns `null`).

use hikari_icons::MdiIcon;

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SelectionGridComponent;

/// The sheet's normal grid gap in px
/// (`.hk-selection-grid-grid { gap: var(--space-8, 0.5rem) }`).
pub const SELECTION_GRID_GAP_PX: f64 = 8.0;

/// The sheet's `[data-dense]` gap in px (`var(--space-6, 0.375rem)`).
pub const SELECTION_GRID_GAP_DENSE_PX: f64 = 6.0;

/// Vue `SelectionGridCols` (2 | 3 | 4; default 2).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SelectionGridColumns {
    #[default]
    Two,
    Three,
    Four,
}

impl SelectionGridColumns {
    /// The count the fixed contract means.
    pub fn count(self) -> usize {
        match self {
            SelectionGridColumns::Two => 2,
            SelectionGridColumns::Three => 3,
            SelectionGridColumns::Four => 4,
        }
    }

    /// The `data-cols` token the sheet keys its track templates on.
    pub fn data_cols(self) -> &'static str {
        match self {
            SelectionGridColumns::Two => "2",
            SelectionGridColumns::Three => "3",
            SelectionGridColumns::Four => "4",
        }
    }
}

/// Vue `layout` prop (`grid` | `list`; default `grid`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SelectionGridLayout {
    #[default]
    Grid,
    List,
}

impl SelectionGridLayout {
    /// The `data-layout` token the sheet's list dress keys on.
    pub fn data_layout(self) -> &'static str {
        match self {
            SelectionGridLayout::Grid => "grid",
            SelectionGridLayout::List => "list",
        }
    }
}

/// One trailing icon button of an option (Vue: `SelectionGridAction`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SelectionGridAction {
    pub id: String,
    /// The glyph rendered inside the button (Vue: a component).
    pub icon: Option<MdiIcon>,
    /// Accessible name — the button's `title` and `aria-label`.
    pub label: String,
    pub disabled: bool,
}

/// One option of the grid (Vue: `SelectionGridItem`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SelectionGridItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub badge: Option<String>,
    /// The badge's `data-variant` (Vue: `badgeVariant`, absent for the plain
    /// treatment the sheet's base rule paints).
    pub badge_variant: Option<String>,
    pub icon: Option<MdiIcon>,
    /// Trailing icon buttons, rendered before the check cell's corner.
    pub actions: Vec<SelectionGridAction>,
}

/// The `action` emit payload (Vue emits `(item, action)`).
#[derive(Clone, PartialEq, Eq, Debug, Default)]
pub struct SelectionGridActionEvent {
    pub item_id: String,
    pub action_id: String,
}

/// The sheet's grid gap for a density (`--space-8` / `--space-6`, both read
/// from the sheet's own `var()` fallbacks so the math matches a host without
/// the token layer).
pub fn selection_grid_gap_px(dense: bool) -> f64 {
    if dense {
        SELECTION_GRID_GAP_DENSE_PX
    } else {
        SELECTION_GRID_GAP_PX
    }
}

/// Vue's usable-floor probe: `minItemWidth` only puts the grid in fluid mode
/// when it is `Some` AND finite AND positive — `0`, negative, `NaN` and the
/// infinities all fall back to the fixed `columns` contract.
pub fn selection_grid_floor(min_item_width: Option<f64>) -> Option<f64> {
    match min_item_width {
        Some(floor) if floor.is_finite() && floor > 0.0 => Some(floor),
        _ => None,
    }
}

/// Whether the grid is in adaptive-floor mode (Vue: `fluid`).
pub fn selection_grid_is_fluid(min_item_width: Option<f64>) -> bool {
    selection_grid_floor(min_item_width).is_some()
}

/// The inline `--hk-selection-grid-item-min` style, emitted only in fluid mode
/// (Vue: `style={fluid ? {"--hk-selection-grid-item-min": …} : undefined}`).
pub fn selection_grid_item_min_style(min_item_width: Option<f64>) -> Option<String> {
    let floor = selection_grid_floor(min_item_width)?;
    Some(format!("--hk-selection-grid-item-min:{floor}px"))
}

/// The track count the sheet's fluid template resolves to for a content width:
/// `repeat(auto-fill, minmax(min(floor, 100%), 1fr))` lays as many
/// `floor`-wide tracks as fit with `gap` between them, i.e.
/// `floor((width + gap) / (floor + gap))`, clamped to at least one track.
///
/// `None` when no usable floor exists (the fixed `columns` contract owns the
/// template then) or when the width is not a usable length — a host that has
/// not measured the column yet should keep the track count it already had.
pub fn selection_grid_fluid_columns(
    min_item_width: Option<f64>,
    available_width: f64,
    gap: f64,
) -> Option<usize> {
    let floor = selection_grid_floor(min_item_width)?;
    if !available_width.is_finite() || available_width <= 0.0 {
        return None;
    }
    let gap = if gap.is_finite() { gap.max(0.0) } else { 0.0 };
    let tracks = ((available_width + gap) / (floor + gap)).floor();
    Some(tracks.max(1.0) as usize)
}

/// The viewport's first breakpoint: below it the sheet folds every count to a
/// single column (`@media (max-width: 420px)`).
pub const SELECTION_GRID_STACK_BREAKPOINT_PX: f64 = 420.0;

/// The viewport's second breakpoint: below it 3- and 4-column grids fold to two
/// (`@media (max-width: 640px)`).
pub const SELECTION_GRID_FOLD_BREAKPOINT_PX: f64 = 640.0;

/// The fixed-mode track count at a viewport width — the sheet's own
/// breakpoints as data: `max-width: 640px` folds 3 and 4 columns to 2, and
/// `max-width: 420px` folds every count to 1. An unmeasured (non-finite or
/// non-positive) viewport applies no breakpoint, so the `columns` contract
/// stands. Fluid mode owns its own template — use
/// [`selection_grid_fluid_columns`] there.
pub fn selection_grid_breakpoint_columns(
    columns: SelectionGridColumns,
    viewport_width: f64,
) -> usize {
    let fixed = columns.count();
    if !viewport_width.is_finite() || viewport_width <= 0.0 {
        return fixed;
    }
    if viewport_width <= SELECTION_GRID_STACK_BREAKPOINT_PX {
        1
    } else if viewport_width <= SELECTION_GRID_FOLD_BREAKPOINT_PX {
        fixed.min(2)
    } else {
        fixed
    }
}

/// Rows a flat, row-major option list occupies: `ceil(count / columns)`. An
/// empty list has no rows; a zero-column grid has none either.
pub fn selection_grid_rows(item_count: usize, columns: usize) -> usize {
    if columns == 0 {
        0
    } else {
        item_count.div_ceil(columns)
    }
}

/// Is `id` part of an id set (the multi-select question).
pub fn selection_has_id(ids: &[String], id: &str) -> bool {
    ids.iter().any(|candidate| candidate == id)
}

/// Toggle `id` in a copy of the set: present → removed (order preserved),
/// absent → appended. The multi-select click semantics.
pub fn selection_toggle_id(ids: &[String], id: &str) -> Vec<String> {
    let mut next: Vec<String> = ids
        .iter()
        .filter(|candidate| candidate.as_str() != id)
        .cloned()
        .collect();
    if next.len() == ids.len() {
        next.push(id.to_string());
    }
    next
}

/// The single-mode reading of an id set: the id only counts when the list
/// holds EXACTLY one. `HkSelectionWaterfall`'s single mode is defined that way
/// (`selectedIds.length === 1 && selectedIds[0] === id`), so a stray multi-id
/// array selects nothing there instead of lighting up several pills.
pub fn selection_single_id(ids: &[String]) -> Option<&str> {
    if ids.len() == 1 {
        Some(ids[0].as_str())
    } else {
        None
    }
}

/// Whether one option is drawn as selected — the Vue rule verbatim: multi mode
/// reads the id SET, single mode reads the one `selected_id`.
pub fn selection_grid_is_selected(
    multi: bool,
    selected_id: Option<&str>,
    selected_ids: &[String],
    item_id: &str,
) -> bool {
    if multi {
        selection_has_id(selected_ids, item_id)
    } else {
        selected_id == Some(item_id)
    }
}

/// The id set a click produces, i.e. the set operation a host applies in
/// `on_select` (`active_ids` is the caller's canonical set: `selected_ids` in
/// multi mode, `vec![selected_id]` in single mode). Single mode REPLACES the
/// set — exactly one option stays selected, and re-clicking it keeps it
/// selected (Vue's single mode has no deselect). Multi mode toggles.
pub fn selection_grid_next_selection(
    multi: bool,
    active_ids: &[String],
    item_id: &str,
) -> Vec<String> {
    if multi {
        selection_toggle_id(active_ids, item_id)
    } else {
        vec![item_id.to_string()]
    }
}

/// The lucide `Check` glyph Vue renders inside the selection cells
/// (`<Check size={14} />` / `{10}`) as SVG markup.
pub fn selection_check_svg(size: u32) -> String {
    format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="{size}" height="{size}" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>"#
    )
}

/// The `display:contents` host that mounts [`selection_check_svg`] through
/// `dangerous_inner_html` (see the header note). `tag` keeps the host legal in
/// its parent's content model — a `div` in the grid's block check cell, a
/// `span` inside the waterfall's inline pill.
pub fn selection_check_host(tag: &str, size: u32) -> VNode {
    VNode::Element(Box::new(
        VElement::new(tag)
            .style("display:contents")
            .dangerous_inner_html(selection_check_svg(size)),
    ))
}

#[define_props]
pub struct SelectionGridProps {
    /// The options (required upstream; an empty list renders nothing).
    #[default]
    pub items: Vec<SelectionGridItem>,

    /// The single-select id (Vue: `selectedId`, default `undefined`).
    pub selected_id: Option<String>,

    /// The multi-select ids (Vue: `selectedIds`, default `[]`).
    #[default]
    pub selected_ids: Vec<String>,

    /// Multi-select mode (default false).
    #[default]
    pub multi: bool,

    /// The fixed column contract (default 2; ignored in fluid mode).
    #[default]
    pub columns: SelectionGridColumns,

    /// Adaptive floor in px: when usable the column count derives from the
    /// available width instead of `columns` (Vue: `minItemWidth`).
    pub min_item_width: Option<f64>,

    pub group_title: Option<String>,

    pub hint: Option<String>,

    /// Tighter cells and gap (`data-dense`).
    #[default]
    pub dense: bool,

    /// `grid` cards or `list` full-width rows (`data-layout`).
    #[default]
    pub layout: SelectionGridLayout,

    /// Draw the thickened leading edge on the selected option (`data-edge`).
    #[default]
    pub selected_edge: bool,

    /// Fired with the clicked option's id (Vue emits the item object).
    pub on_select: Option<EventHandler<String>>,

    /// Fired with the option id + the action id (Vue emits both objects).
    pub on_action: Option<EventHandler<SelectionGridActionEvent>>,
}

#[component]
pub fn SelectionGrid(props: SelectionGridProps) -> Element {
    // Vue renders `null` for an empty list; an empty vnode is that nothing.
    if props.items.is_empty() {
        return empty_vnode();
    }

    let fluid = selection_grid_is_fluid(props.min_item_width);

    let mut grid = VElement::new("div").class("hk-selection-grid-grid");
    if fluid {
        // Fluid mode owns the track template (auto-fill with the floor), so the
        // `data-cols` hooks — and their narrow-viewport overrides — stay out.
        grid = grid.attr("data-fluid", "");
        if let Some(style) = selection_grid_item_min_style(props.min_item_width) {
            grid = grid.style(style);
        }
    } else {
        grid = grid.attr("data-cols", props.columns.data_cols());
    }
    if props.dense {
        grid = grid.attr("data-dense", "");
    }

    let mut cells: Vec<VNode> = Vec::with_capacity(props.items.len());
    for item in &props.items {
        let is_selected = selection_grid_is_selected(
            props.multi,
            props.selected_id.as_deref(),
            &props.selected_ids,
            &item.id,
        );

        let mut cell = VElement::new("div")
            .key(item.id.as_str())
            .class("hk-selection-grid-item")
            .attr("role", "button")
            .attr("tabindex", "0")
            .attr("aria-selected", if is_selected { "true" } else { "false" });
        if is_selected {
            cell = cell.attr("data-selected", "");
        }

        // The check cell is always in the tree (the sheet fades it in); only
        // the glyph is conditional.
        let mut check_cell = VElement::new("div").class("hk-selection-grid-check");
        if is_selected {
            check_cell = check_cell.child(selection_check_host("div", 14));
        }
        cell = cell.child(VNode::Element(Box::new(check_cell)));

        let mut header = VElement::new("div").class("hk-selection-grid-header");
        if let Some(icon) = item.icon {
            header = header.child(rsx! {
                Icon { icon, size: 16, class: "hk-selection-grid-icon".to_string() }
            });
        }
        header = header.child(rsx! {
            span { class: "hk-selection-grid-name", {item.title.clone()} }
        });
        if let Some(badge) = &item.badge {
            header = header.child(rsx! {
                span {
                    class: "hk-selection-grid-badge",
                    "data-variant": item.badge_variant.clone(),
                    {badge.clone()}
                }
            });
        }
        let mut content = VElement::new("div")
            .class("hk-selection-grid-content")
            .child(VNode::Element(Box::new(header)));
        if let Some(description) = &item.description {
            content = content.child(rsx! {
                p { class: "hk-selection-grid-desc", {description.clone()} }
            });
        }
        cell = cell.child(VNode::Element(Box::new(content)));

        if !item.actions.is_empty() {
            let mut actions = VElement::new("div").class("hk-selection-grid-actions");
            for action in &item.actions {
                let icon_markup = match action.icon {
                    Some(icon) => rsx! { Icon { icon, size: 14 } },
                    None => empty_vnode(),
                };
                let emit_action = props.on_action.clone();
                let payload = SelectionGridActionEvent {
                    item_id: item.id.clone(),
                    action_id: action.id.clone(),
                };
                let disabled = action.disabled;
                actions = actions.child(rsx! {
                    button {
                        class: "hk-selection-grid-action",
                        "type": "button",
                        title: action.label.clone(),
                        "aria-label": action.label.clone(),
                        disabled: action.disabled,
                        onclick: move |event: MouseEvent| {
                            // An action is never a selection: without this the
                            // row's own click handler fires too.
                            event.stop_propagation();
                            if disabled {
                                return;
                            }
                            if let Some(handler) = &emit_action {
                                handler.call(payload.clone());
                            }
                        },
                        {icon_markup}
                    }
                });
            }
            cell = cell.child(VNode::Element(Box::new(actions)));
        }

        let select = props.on_select.clone();
        let select_id = item.id.clone();
        cell = cell.on_click(move |_: MouseEvent| {
            if let Some(handler) = &select {
                handler.call(select_id.clone());
            }
        });
        let select = props.on_select.clone();
        let select_id = item.id.clone();
        cell = cell.on_keydown(move |event: KeyboardEvent| {
            if event.key != "Enter" && event.key != " " {
                return;
            }
            event.prevent_default();
            if let Some(handler) = &select {
                handler.call(select_id.clone());
            }
        });

        cells.push(VNode::Element(Box::new(cell)));
    }
    grid = grid.children(cells);

    let mut root = VElement::new("div")
        .class("hk-selection-grid")
        .attr("data-layout", props.layout.data_layout());
    if props.selected_edge {
        root = root.attr("data-edge", "");
    }
    if let Some(title) = &props.group_title {
        root = root.child(rsx! {
            h4 { class: "hk-selection-grid-title", {title.clone()} }
        });
    }
    root = root.child(VNode::Element(Box::new(grid)));
    if let Some(hint) = &props.hint {
        root = root.child(rsx! {
            p { class: "hk-selection-grid-hint", {hint.clone()} }
        });
    }
    VNode::Element(Box::new(root))
}

impl StyledComponent for SelectionGridComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSelectionGrid.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "selection-grid"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str) -> SelectionGridItem {
        SelectionGridItem {
            id: id.to_string(),
            title: format!("Option {id}"),
            ..Default::default()
        }
    }

    fn ids(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|id| id.to_string()).collect()
    }

    #[test]
    fn selection_grid_defaults_match_the_vue_props() {
        let props = SelectionGridProps::default();
        assert!(props.items.is_empty());
        assert!(props.selected_id.is_none());
        assert!(props.selected_ids.is_empty());
        assert!(!props.multi);
        assert_eq!(props.columns, SelectionGridColumns::Two);
        assert!(props.min_item_width.is_none());
        assert!(props.group_title.is_none());
        assert!(props.hint.is_none());
        assert!(!props.dense);
        assert_eq!(props.layout, SelectionGridLayout::Grid);
        assert!(!props.selected_edge);
        assert!(props.on_select.is_none());
        assert!(props.on_action.is_none());
    }

    #[test]
    fn selection_grid_tokens_match_the_vue_class_and_data_attributes() {
        assert_eq!(SelectionGridColumns::Two.data_cols(), "2");
        assert_eq!(SelectionGridColumns::Three.data_cols(), "3");
        assert_eq!(SelectionGridColumns::Four.data_cols(), "4");
        assert_eq!(SelectionGridColumns::Four.count(), 4);
        assert_eq!(SelectionGridLayout::Grid.data_layout(), "grid");
        assert_eq!(SelectionGridLayout::List.data_layout(), "list");
        assert_eq!(selection_grid_gap_px(false), SELECTION_GRID_GAP_PX);
        assert_eq!(selection_grid_gap_px(true), SELECTION_GRID_GAP_DENSE_PX);
    }

    #[test]
    fn selection_grid_floor_ignores_unusable_values() {
        assert!(!selection_grid_is_fluid(None));
        assert!(!selection_grid_is_fluid(Some(0.0)));
        assert!(!selection_grid_is_fluid(Some(-240.0)));
        assert!(!selection_grid_is_fluid(Some(f64::NAN)));
        assert!(!selection_grid_is_fluid(Some(f64::INFINITY)));
        assert_eq!(selection_grid_item_min_style(None), None);
        assert_eq!(selection_grid_item_min_style(Some(0.0)), None);
        assert!(selection_grid_is_fluid(Some(240.0)));
        assert_eq!(
            selection_grid_item_min_style(Some(240.0)).as_deref(),
            Some("--hk-selection-grid-item-min:240px")
        );
    }

    #[test]
    fn selection_grid_fluid_columns_follow_the_auto_fill_rule() {
        // No usable floor: the fixed many-columns contract owns the template.
        assert_eq!(
            selection_grid_fluid_columns(None, 896.0, SELECTION_GRID_GAP_PX),
            None
        );
        assert_eq!(
            selection_grid_fluid_columns(Some(0.0), 896.0, SELECTION_GRID_GAP_PX),
            None
        );
        // The documented host: an 896px modal lays three 240px options.
        assert_eq!(
            selection_grid_fluid_columns(Some(240.0), 896.0, SELECTION_GRID_GAP_PX),
            Some(3)
        );
        // Narrow hosts step down: two, then one, and a lone track never
        // overflows below one floor of space.
        assert_eq!(
            selection_grid_fluid_columns(Some(240.0), 500.0, SELECTION_GRID_GAP_PX),
            Some(2)
        );
        assert_eq!(
            selection_grid_fluid_columns(Some(240.0), 100.0, SELECTION_GRID_GAP_PX),
            Some(1)
        );
        // An unmeasured (or degenerate) width keeps whatever the host had.
        assert_eq!(
            selection_grid_fluid_columns(Some(240.0), 0.0, SELECTION_GRID_GAP_PX),
            None
        );
        assert_eq!(
            selection_grid_fluid_columns(Some(240.0), f64::NAN, SELECTION_GRID_GAP_PX),
            None
        );
    }

    #[test]
    fn selection_grid_breakpoint_fold_matches_the_sheet() {
        // Wide hosts keep the `columns` contract.
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Four, 900.0),
            4
        );
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Three, 900.0),
            3
        );
        // `max-width: 640px` folds 3 and 4 to two; two stays two.
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Four, 640.0),
            2
        );
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Four, 600.0),
            2
        );
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Two, 600.0),
            2
        );
        // `max-width: 420px` stacks every count.
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Four, 420.0),
            1
        );
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Two, 400.0),
            1
        );
        // An unmeasured viewport applies no breakpoint.
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Three, f64::NAN),
            3
        );
        assert_eq!(
            selection_grid_breakpoint_columns(SelectionGridColumns::Three, 0.0),
            3
        );
    }

    #[test]
    fn selection_grid_rows_ceil_the_flat_list() {
        // The empty set has no rows.
        assert_eq!(selection_grid_rows(0, 2), 0);
        assert_eq!(selection_grid_rows(4, 2), 2);
        assert_eq!(selection_grid_rows(5, 2), 3);
        assert_eq!(selection_grid_rows(3, 3), 1);
        // A zero-column grid cannot lay anything out.
        assert_eq!(selection_grid_rows(5, 0), 0);
    }

    #[test]
    fn selection_id_set_operations_cover_the_empty_and_full_sets() {
        // Empty set: the first click selects.
        assert!(!selection_has_id(&[], "a"));
        assert_eq!(selection_toggle_id(&[], "a"), ids(&["a"]));
        // Full set: toggling a member removes exactly that member, order kept.
        let all = ids(&["a", "b", "c"]);
        assert!(selection_has_id(&all, "b"));
        assert_eq!(selection_toggle_id(&all, "b"), ids(&["a", "c"]));
        // Toggling it back re-appends at the end, like Vue's `[...ids, id]`.
        // Vue: `[...ids, id]` appends, so re-adding lands at the END.
        assert_eq!(
            selection_toggle_id(&ids(&["a", "c"]), "b"),
            ids(&["a", "c", "b"])
        );
        // The single-mode reading only trusts a one-element list.
        assert_eq!(selection_single_id(&[]), None);
        assert_eq!(selection_single_id(&all), None);
        assert_eq!(selection_single_id(&ids(&["a"])), Some("a"));
    }

    #[test]
    fn selection_grid_single_mode_is_mutually_exclusive() {
        // Single mode reads `selected_id` only, so the whole set can never
        // light up more than one option.
        assert!(selection_grid_is_selected(false, Some("a"), &[], "a"));
        assert!(!selection_grid_is_selected(
            false,
            Some("a"),
            &ids(&["b"]),
            "b"
        ));
        assert!(!selection_grid_is_selected(false, None, &ids(&["a"]), "a"));
        // Clicking another option REPLACES the selection …
        assert_eq!(
            selection_grid_next_selection(false, &ids(&["a"]), "b"),
            ids(&["b"])
        );
        // … and re-clicking the selected one keeps it (no deselect upstream).
        assert_eq!(
            selection_grid_next_selection(false, &ids(&["a"]), "a"),
            ids(&["a"])
        );
    }

    #[test]
    fn selection_grid_multi_mode_selects_the_listed_ids_and_toggles() {
        // Empty set: nothing is selected.
        assert!(!selection_grid_is_selected(true, None, &[], "a"));
        // All selected: every listed id answers true.
        let all = ids(&["a", "b"]);
        assert!(selection_grid_is_selected(true, None, &all, "a"));
        assert!(selection_grid_is_selected(true, None, &all, "b"));
        // A click appends, a second click on it removes.
        assert_eq!(
            selection_grid_next_selection(true, &ids(&["a"]), "b"),
            ids(&["a", "b"])
        );
        assert_eq!(selection_grid_next_selection(true, &all, "a"), ids(&["b"]));
    }

    #[test]
    fn selection_check_svg_carries_the_lucide_glyph() {
        let svg = selection_check_svg(14);
        assert!(svg.starts_with(r#"<svg"#));
        assert!(svg.contains(r#"width="14""#) && svg.contains(r#"height="14""#));
        assert!(svg.contains(r#"stroke="currentColor""#));
        assert!(svg.contains(r#"d="M20 6 9 17l-5-5""#));
    }

    #[test]
    fn selection_grid_renders_the_vue_dom() {
        let html = SelectionGrid(SelectionGridProps {
            group_title: Some("Pick one".to_string()),
            hint: Some("Choose a target".to_string()),
            items: vec![
                SelectionGridItem {
                    badge: Some("new".to_string()),
                    badge_variant: Some("primary".to_string()),
                    description: Some("the first option".to_string()),
                    icon: Some(MdiIcon::Help),
                    actions: vec![SelectionGridAction {
                        id: "remove".to_string(),
                        icon: Some(MdiIcon::Close),
                        label: "Remove".to_string(),
                        disabled: true,
                    }],
                    ..item("a")
                },
                item("b"),
            ],
            selected_id: Some("b".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "hk-selection-grid",
            "hk-selection-grid-title",
            "hk-selection-grid-grid",
            "hk-selection-grid-item",
            "hk-selection-grid-check",
            "hk-selection-grid-content",
            "hk-selection-grid-header",
            "hk-selection-grid-icon",
            "hk-selection-grid-name",
            "hk-selection-grid-badge",
            "hk-selection-grid-desc",
            "hk-selection-grid-actions",
            "hk-selection-grid-action",
            "hk-selection-grid-hint",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(html.contains(r#"data-layout="grid""#), "{html}");
        assert!(html.contains(r#"data-cols="2""#), "{html}");
        assert!(!html.contains("data-fluid"), "{html}");
        assert!(html.contains(r#"role="button""#), "{html}");
        assert!(html.contains(r#"tabindex="0""#), "{html}");
        assert!(html.contains(r#"data-variant="primary""#), "{html}");
        assert!(html.contains(r#"aria-label="Remove""#), "{html}");
        assert!(html.contains(r#"disabled="disabled""#), "{html}");
        // The check glyph is mounted as SVG markup (innerHTML namespace path).
        assert!(
            html.contains("<svg") && html.contains(r#"stroke-width="2""#),
            "{html}"
        );
        // Single mode + `selected_id = b`: exactly one option is selected.
        assert_eq!(html.matches(r#"aria-selected="true""#).count(), 1, "{html}");
        assert_eq!(html.matches("data-selected=\"\"").count(), 1, "{html}");
    }

    #[test]
    fn selection_grid_multi_mode_renders_every_listed_option_as_selected() {
        let html = SelectionGrid(SelectionGridProps {
            items: vec![item("a"), item("b"), item("c")],
            multi: true,
            selected_ids: ids(&["a", "c"]),
            selected_edge: true,
            layout: SelectionGridLayout::List,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-layout="list""#), "{html}");
        assert!(html.contains("data-edge=\"\""), "{html}");
        assert_eq!(html.matches(r#"aria-selected="true""#).count(), 2, "{html}");
        assert_eq!(html.matches("data-selected=\"\"").count(), 2, "{html}");
    }

    #[test]
    fn selection_grid_fluid_mode_swaps_data_cols_for_the_floor() {
        let html = SelectionGrid(SelectionGridProps {
            items: vec![item("a")],
            min_item_width: Some(240.0),
            dense: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("data-fluid=\"\""), "{html}");
        assert!(html.contains("data-dense=\"\""), "{html}");
        assert!(
            html.contains("--hk-selection-grid-item-min:240px"),
            "{html}"
        );
        assert!(!html.contains("data-cols"), "{html}");
    }

    #[test]
    fn selection_grid_empty_list_renders_nothing() {
        let html = SelectionGrid(SelectionGridProps::default()).render_to_html();
        assert!(
            html.is_empty(),
            "an empty grid renders the empty vnode: {html}"
        );
    }

    #[test]
    fn selection_grid_registers_under_its_vue_name() {
        // The style registry key both forms bundle the sheet under.
        assert_eq!(SelectionGridComponent::name(), "selection-grid");
    }

    #[test]
    fn selection_grid_styles_come_from_the_canonical_vue_sheet() {
        let css = SelectionGridComponent::styles();
        assert!(
            css.contains(".hk-selection-grid") && css.contains(".hk-selection-grid-item"),
            "selection grid css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored selection grid sheet"
        );
    }
}
