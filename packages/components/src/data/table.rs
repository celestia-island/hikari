// hi-components/src/data/table.rs
// Table — mirror of the canonical Vue `HkTable` (column definitions,
// tri-state sort, selection, row-actions column, drag grip column, empty
// state).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTable.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-table*` / `.hk-text-*` class names are
// literal and identical in both forms. DOM contract (mirrors the Vue render
// output):
//
//   div.hk-table-host [host class]
//     div.hk-table-wrapper
//       table.hk-table hk-table-{size} [.hk-table-bordered] [.hk-table-striped]
//             [.hk-table-hover] [.hk-table-draggable] [data-copy-cells]
//         caption.hk-table-sr-only?                 (caption)
//         thead
//           tr.hk-table-header-row
//             th.hk-table-header-cell.hk-table-drag-col   (draggable; width 36px)
//             th.hk-table-header-cell                      (selectable; width 40px)
//               label.hk-table-checkbox-label
//                 input.hk-table-checkbox-input
//                       [type=checkbox] [checked] [aria-checked=mixed]
//                 span.hk-table-checkbox.hk-table-checkbox-md
//                      [.hk-table-checkbox-checked]
//                   span[style="display:contents"]         (✓ svg markup)
//             th.hk-table-header-cell [.hk-text-{align}]
//                 [.hk-table-header-sortable] [.hk-table-header-sorted]
//                 (style: width)
//               span.hk-table-header-label {title}
//               span[style="display:contents"]             (▲ sort svg markup)
//             th.hk-table-header-cell.hk-table-manage-head (manageable; width 36px)
//               span.hk-table-sr-only {Row actions}
//         tbody.hk-table-body
//           tr.hk-table-row                                (key = row key)
//             td.hk-table-cell.hk-table-drag-cell          (draggable)
//               span.hk-table-drag-handle role=button tabindex=0
//                    [aria-label] [title] [aria-keyshortcuts]
//                    [aria-disabled] [data-disabled]
//                 span[style="display:contents"]           (grip svg markup)
//             td.hk-table-cell                             (selectable; width 40px)
//               label.hk-table-checkbox-label …            (same checkbox shape)
//             td.hk-table-cell [.hk-text-{align}] [title={copy hint}] {cell text}
//             td.hk-table-cell.hk-table-manage-cell        (manageable)
//               button.hk-icon-button …                    (⋯ trigger)
//           ── or, with no rows ──
//           tr > td.hk-table-empty colspan={total_columns} {empty content}
//
// State contract (the tairitsu 0.5.22 limit this wave works under, ledger
// L48): Vue keeps `sortKey` / `sortDirection` / `selectedRowKeys` in local
// `ref`s. `use_signal` allocates a fresh signal per render and `use_state`
// shares ONE slot per component type, so BOTH are unavailable here: the three
// values are CONTROLLED props (`sort_column` + `sort_direction`,
// `selected_keys`) and every transition leaves through a callback
// (`on_sort_change`, `on_selected_change`, `on_reorder`, `on_manage`). The
// mirror stores nothing itself.
//
// Deltas vs Vue (documented, not accidental):
//   * NO pagination shell and NO fixed / sticky column or header: the
//     canonical component has neither a pagination prop nor a pager in its
//     markup, and `HkTable.scss` carries no `position: sticky` /
//     fixed-column rule (`.hk-table-wrapper` is `overflow-x: auto` only).
//     Paging stays a separate concern (`data/pagination.rs` here; there is no
//     Vue pager component), and a pinned header is a host-level stylesheet
//     decision — so this file invents no flag for either.
//   * the wrapper's overlay scrollbar is not attached (no scrollbar runtime
//     this wave); the sheet hides the native rail
//     (`.hk-table-wrapper { scrollbar-width: none }`) because Vue mounts the
//     shared overlay scrollbar, so a wide table scrolls with an invisible
//     rail.
//   * `copy_cells` defaults to FALSE (Vue: true). Vue's click-to-copy layer
//     runs the clipboard-with-toast runtime; with no clipboard handle in this
//     wave the honest default is the sheet's opt-out branch (plain selectable
//     text). Setting it true applies Vue's affordance (no-select cells +
//     `cursor: copy`) — the host owns the click handling.
//   * no per-cell slot content (Vue: `slots[\`cell-${key}\`]`): a cell is
//     text ([`TableRow::cells`]); the `title` copy hint is emitted for
//     text cells only, exactly Vue's default branch.
//   * `draggable` mirrors the grip column, the inert-while-sorted rule and
//     the keyboard twin (ArrowUp/ArrowDown on the focused handle emits
//     `reorder`). The POINTER engine (ghost clone, FLIP shift, pointer
//     capture, live strip measurement) is not mirrored — it needs
//     per-instance refs + measurement, which tairitsu 0.5.22 does not expose.
//   * `manageable` is a boolean (render the column) and the per-row verdict
//     rides [`TableRow::manage`]: Vue's gate is `boolean | (row) => boolean |
//     "disabled"`, and a function prop cannot be a `PartialEq` props field.
//   * `HkRowActions` is not mirrored in this wave: the trigger is the
//     mirrored `IconButton` (ghost / 28 / `DotsHorizontal`) — the same button
//     `HkRowActions` renders.
//   * `on_manage` emits the resolved row KEY and `on_selected_change` the
//     selected KEYS (Vue emits row objects, plus the opener element for
//     `manage`).
//   * `TableRow::key` is Vue's `rowKey` read; absent, the DISPLAY index is
//     the identity (Vue's `String(index)` fallback) — so an active sort
//     re-identifies unkeyed rows, exactly like Vue.
//   * a header checkbox reports the third selection state as
//     `aria-checked="mixed"` when only some displayed rows are selected
//     (Vue paints a binary checkbox and has no mixed state).
//
// MIGRATION (this file replaces the legacy `Table`; the exported names
// `Table` / `TableProps` / `TableComponent` and [`TableSize`] are kept so
// `styled.rs` and `prelude.rs` keep resolving):
//   * `data: Vec<Vec<String>>` (positional cell grid) →
//     `rows: Vec<TableRow>` (`TableRow::cells` stays positional and gains the
//     optional row key + the manage verdict).
//   * `columns: Vec<ColumnDef>` → `columns: Vec<TableColumn>` (Vue's
//     `Column`: key / title / width / sortable / align / copyable). A legacy
//     [`ColumnDef`] converts through `From`; its `fixed` / `filterable` /
//     `resizable` / `min_width` / `max_width` fields have no rule in the
//     canonical sheet and are dropped.
//   * `hoverable` → `hover` (Vue's prop name); the legacy `TableAlign` enum is
//     gone — a column carries `Option<ColumnAlign>` and the cell emits Vue's
//     `hk-text-{align}` (NOT the legacy `hk-align-*` names).
//   * `filters: TableFilters` + `on_filter_change` are GONE: `HkTable` has no
//     column filtering (`HkFilterBar` is the filter surface). `TableFilters`
//     disappears with them.
//   * `sort_column` / `sort_direction` keep their names but are now CONTROLLED
//     inputs; `on_sort_change` carries Vue's tri-state cycle
//     (asc → desc → unsorted).
//   * `empty_text` default is Vue's `""` and resolves through i18n
//     (`hikari::table.noData`, "No data") — the legacy literal
//     `"No data available"` is retired.
//   * the legacy `sort_data` comparator parsed cells as `f64` first; the Vue
//     comparator compares the values as they are, so a numeric column must be
//     formatted for lexicographic order (zero padded), exactly like the Vue
//     form.
//   * new on this face: `selectable` + `selected_keys` + `on_selected_change`,
//     `draggable` + `on_reorder`, `manageable` + `on_manage`, `caption`,
//     `copy_cells`, and the `empty` slot.

use hikari_i18n::t;

use crate::basic::{IconButton, IconButtonProps, IconButtonSize, IconButtonVariant};
use crate::data::column::{ColumnAlign, ColumnDef};
use crate::data::sort::{SortConfig, SortDirection};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TableComponent;

// ── trusted static SVG markup ─────────────────────────────────────────────
// `rsx!` has no SVG namespace path in this host stack, so every glyph rides
// `dangerous_inner_html` on its own paint-inert `display:contents` host
// (header delta [D]). The classes are byte-identical to the Vue markup so the
// mirrored sheet styles them.
const CHECK_SVG: &str = r#"<svg class="hk-table-checkbox-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>"#;
const SORT_ICON_SVG: &str = r#"<svg class="hk-table-sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>"#;
const SORT_ICON_DESC_SVG: &str = r#"<svg class="hk-table-sort-icon hk-table-sort-icon-desc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>"#;
const DRAG_HANDLE_SVG: &str = r#"<svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true"><circle cx="3.5" cy="3" r="1.2"></circle><circle cx="8.5" cy="3" r="1.2"></circle><circle cx="3.5" cy="7" r="1.2"></circle><circle cx="8.5" cy="7" r="1.2"></circle><circle cx="3.5" cy="11" r="1.2"></circle><circle cx="8.5" cy="11" r="1.2"></circle></svg>"#;

/// The paint-inert host every SVG glyph hangs on (`dangerous_inner_html`
/// suppresses an element's own children, so the markup cannot sit beside a
/// sibling).
fn svg_host(markup: &'static str) -> Element {
    VNode::Element(Box::new(
        VElement::new("span")
            .style("display:contents")
            .dangerous_inner_html(markup),
    ))
}

/// Size step (Vue: `sm | md | lg`, default `md`). The identifiers are the
/// pre-mirror ones (public call sites pass `TableSize::Medium`); the emitted
/// class is Vue's `hk-table-{size}` exactly.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TableSize {
    Small,
    #[default]
    Medium,
    Large,
}

impl TableSize {
    /// The `hk-table-{size}` modifier exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            TableSize::Small => "hk-table-sm",
            TableSize::Medium => "hk-table-md",
            TableSize::Large => "hk-table-lg",
        }
    }
}

/// One column definition (Vue: the `Column` interface).
#[derive(Clone, PartialEq, Debug)]
pub struct TableColumn {
    /// The cell key: Vue reads `row[key]`, the mirror reads the cell at this
    /// column's POSITION (rows are positional, see the header migration).
    pub key: String,

    /// The header label (`hk-table-header-label`).
    pub title: String,

    /// `style="width: …"` on the header cell, verbatim (Vue: `width`).
    pub width: Option<String>,

    /// Click-to-sort eligibility (OR'd with the table-level `sortable`).
    pub sortable: bool,

    /// Cell/header alignment (Vue: `align`, default none). Emitted as the
    /// sheet's `hk-text-{left,center,right}` helper.
    pub align: Option<ColumnAlign>,

    /// Whether a text cell participates in the click-to-copy layer (Vue
    /// default true; only consulted while `TableProps::copy_cells` is on).
    pub copyable: bool,
}

impl Default for TableColumn {
    fn default() -> Self {
        Self {
            key: String::new(),
            title: String::new(),
            width: None,
            sortable: false,
            align: None,
            // Vue's `copyable` default is true, so it cannot be derived.
            copyable: true,
        }
    }
}

impl TableColumn {
    pub fn new(key: impl Into<String>, title: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            title: title.into(),
            ..Default::default()
        }
    }

    pub fn width(mut self, width: impl Into<String>) -> Self {
        self.width = Some(width.into());
        self
    }

    pub fn sortable(mut self, sortable: bool) -> Self {
        self.sortable = sortable;
        self
    }

    pub fn align(mut self, align: ColumnAlign) -> Self {
        self.align = Some(align);
        self
    }

    pub fn copyable(mut self, copyable: bool) -> Self {
        self.copyable = copyable;
        self
    }
}

/// The bridge for a legacy [`ColumnDef`] column: the overlapping fields map
/// one-to-one and the ones the canonical sheet has no rule for are dropped
/// (see the header migration).
impl From<ColumnDef> for TableColumn {
    fn from(column: ColumnDef) -> Self {
        Self {
            key: column.column_key,
            title: column.title,
            width: column.width,
            sortable: column.sortable,
            align: Some(column.align),
            copyable: true,
        }
    }
}

/// The per-row row-actions verdict (Vue: the `manageable` gate's return).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TableManageMode {
    /// The ⋯ trigger renders and activates.
    #[default]
    On,
    /// The trigger renders but refuses activation (read-only rows keep the
    /// affordance where actions would live).
    Disabled,
    /// No trigger at all — Vue renders an empty cell (a row without actions
    /// gets no ⋯, not a dead button).
    Off,
}

impl TableManageMode {
    /// Whether the cell carries the trigger (Vue: `mode !== "off"`).
    pub fn renders_trigger(self) -> bool {
        !matches!(self, TableManageMode::Off)
    }

    /// Whether the rendered trigger refuses activation.
    pub fn is_disabled(self) -> bool {
        matches!(self, TableManageMode::Disabled)
    }
}

/// One data row. `cells` stays POSITIONAL (index-aligned with
/// [`TableProps::columns`]) — the legacy `Vec<Vec<String>>` shape — and gains
/// Vue's row identity plus the manage verdict.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TableRow {
    /// The row identity (Vue: `row[rowKey]`). `None` falls back to the
    /// DISPLAY index, exactly Vue's `String(index)`.
    pub key: Option<String>,

    /// Cell text, index-aligned with `columns`; a short row leaves the
    /// trailing cells empty (the sort comparator treats them as `null`, which
    /// Vue sorts LAST in both directions).
    pub cells: Vec<String>,

    /// This row's row-actions verdict (Vue: the per-row gate result).
    pub manage: TableManageMode,
}

impl TableRow {
    /// Build a row from positional cells (`&str` and `String` both work).
    pub fn new<S: Into<String>>(cells: Vec<S>) -> Self {
        Self {
            cells: cells.into_iter().map(Into::into).collect(),
            ..Default::default()
        }
    }

    pub fn key(mut self, key: impl Into<String>) -> Self {
        self.key = Some(key.into());
        self
    }

    pub fn manage(mut self, manage: TableManageMode) -> Self {
        self.manage = manage;
        self
    }
}

/// The three-way selection state of a key set (the header checkbox's
/// binary `checked` plus the mixed state the sheet has no rule for).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TableSelectionState {
    #[default]
    None,
    Partial,
    All,
}

impl TableSelectionState {
    /// Vue's `allChecked`: every displayed row is selected (and there is at
    /// least one row).
    pub fn is_all(self) -> bool {
        matches!(self, TableSelectionState::All)
    }

    /// The header input's `aria-checked` token: `true` / `mixed` / absent
    /// (Vue emits no state of its own — see the header delta).
    pub fn aria_checked(self) -> Option<&'static str> {
        match self {
            TableSelectionState::All => Some("true"),
            TableSelectionState::Partial => Some("mixed"),
            TableSelectionState::None => None,
        }
    }
}

/// Vue's `reorder(fromIndex, toIndex)` payload.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct TableReorder {
    pub from: usize,
    pub to: usize,
}

// ── pure helpers (the geometry/identity math this component runs on) ──────

/// Vue's `getRowKey(row, index)`.
pub fn table_row_key(row: &TableRow, index: usize) -> String {
    row.key.clone().unwrap_or_else(|| index.to_string())
}

/// The sheet's alignment helper class for a column (Vue emits `hk-text-*`,
/// the legacy `hk-align-*` names are retired).
pub fn table_cell_align_class(align: Option<ColumnAlign>) -> Option<&'static str> {
    match align {
        Some(ColumnAlign::Left) => Some("hk-text-left"),
        Some(ColumnAlign::Center) => Some("hk-text-center"),
        Some(ColumnAlign::Right) => Some("hk-text-right"),
        None => None,
    }
}

/// Vue's `sortedRows` comparator, cell by cell.
///
/// The `null` arms are deliberately NOT direction-flipped (Vue returns `1` /
/// `-1` before it ever multiplies by `dir`), so a missing cell sinks to the
/// bottom in BOTH directions; `SortDirection::None` is "no arrangement" and
/// compares equal because Vue never calls the comparator then.
pub fn table_compare_cells(
    a: Option<&str>,
    b: Option<&str>,
    direction: SortDirection,
) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    match direction {
        SortDirection::None => Ordering::Equal,
        SortDirection::Ascending | SortDirection::Descending => {
            let descending = direction == SortDirection::Descending;
            match (a, b) {
                (None, None) => Ordering::Equal,
                (None, Some(_)) => Ordering::Greater,
                (Some(_), None) => Ordering::Less,
                (Some(a_value), Some(b_value)) => {
                    let ordering = a_value.cmp(b_value);
                    if descending {
                        ordering.reverse()
                    } else {
                        ordering
                    }
                }
            }
        }
    }
}

/// Vue's `sortedRows`: a stable copy of `rows` ordered by the active column
/// (`sort_column` names a [`TableColumn::key`]). An unknown key or an unsorted
/// direction returns the input order untouched.
pub fn table_sorted_rows(
    rows: &[TableRow],
    columns: &[TableColumn],
    sort_column: &str,
    direction: SortDirection,
) -> Vec<TableRow> {
    let mut sorted = rows.to_vec();
    if direction == SortDirection::None {
        return sorted;
    }
    let Some(index) = columns.iter().position(|column| column.key == sort_column) else {
        return sorted;
    };
    sorted.sort_by(|a, b| {
        table_compare_cells(
            a.cells.get(index).map(String::as_str),
            b.cells.get(index).map(String::as_str),
            direction,
        )
    });
    sorted
}

/// Vue's `toggleSort`: a NEW key starts ascending, the SAME key cycles
/// ascending → descending → unsorted (the third click clears the sort, which
/// is what makes `draggable` reachable again — reordering is inert while an
/// arrangement is derived from a sort).
pub fn table_next_sort(sort_column: &str, direction: SortDirection, clicked: &str) -> SortConfig {
    if clicked != sort_column {
        return SortConfig::new(clicked, SortDirection::Ascending);
    }
    let next = direction.toggle();
    if next == SortDirection::None {
        // Vue sets `sortKey = null`; the mirror's "no key" is the empty string.
        SortConfig::new(String::new(), SortDirection::None)
    } else {
        SortConfig::new(clicked, next)
    }
}

/// The selection state of `all_keys` against `selected`.
pub fn table_selection_state(selected: &[String], all_keys: &[String]) -> TableSelectionState {
    if all_keys.is_empty() {
        return TableSelectionState::None;
    }
    let hits = all_keys
        .iter()
        .filter(|key| selected.iter().any(|chosen| chosen == *key))
        .count();
    if hits == 0 {
        TableSelectionState::None
    } else if hits == all_keys.len() {
        TableSelectionState::All
    } else {
        TableSelectionState::Partial
    }
}

/// Vue's `toggleRow`: flip one key, preserving the Set's insertion order
/// (a re-selected key appends, exactly like `Set.add`).
pub fn table_toggle_row(selected: &[String], key: &str) -> Vec<String> {
    let mut next = selected.to_vec();
    if let Some(position) = next.iter().position(|chosen| chosen == key) {
        next.remove(position);
    } else {
        next.push(key.to_string());
    }
    next
}

/// Vue's `toggleAll`: an all-selected set clears, anything else selects every
/// displayed key.
///
/// Vue compares the set's SIZE against the row count; the mirror asks
/// [`table_selection_state`] instead, so a stale selected key (the controlled
/// prop can hold one) cannot silently invert the toggle.
pub fn table_toggle_all(selected: &[String], all_keys: &[String]) -> Vec<String> {
    if table_selection_state(selected, all_keys).is_all() {
        Vec::new()
    } else {
        all_keys.to_vec()
    }
}

/// Vue's keyboard twin of a drop (`onReorderDrop(index, index ± 1)`): the
/// destination slot, or `None` when the move would leave the strip (Vue's
/// `from === to || from < 0 || to < 0 || from >= len || to >= len` guard).
pub fn table_reorder_target(from: usize, delta: i32, len: usize) -> Option<usize> {
    if from >= len {
        return None;
    }
    let to = from as i64 + i64::from(delta);
    if to < 0 || to >= len as i64 || to as usize == from {
        return None;
    }
    Some(to as usize)
}

/// Vue's `handleName`: the grip's accessible name names the entry (the first
/// column's value) AND the action. The `{label}` placeholder is interpolated by
/// split/join, not `String::replace` — a label carrying `$&` / `$'` must not
/// become a replacement pattern.
pub fn table_drag_handle_label(row: &TableRow, columns: &[TableColumn]) -> String {
    // Vue reads `columns[0].key` out of the row: with positional rows that is
    // the FIRST CELL (and no column means no identity to name).
    let label = if columns.is_empty() {
        String::new()
    } else {
        row.cells
            .first()
            .map(|value| value.trim().to_string())
            .unwrap_or_default()
    };
    if label.is_empty() {
        return t("hikari::table.dragHandle", "Drag to reorder");
    }
    let template = t("hikari::table.dragHandleRow", "Reorder {label}");
    match template.split_once("{label}") {
        Some((before, after)) => format!("{before}{label}{after}"),
        None => template,
    }
}

#[define_props]
pub struct TableProps {
    /// Column definitions (Vue: required `columns`).
    pub columns: Vec<TableColumn>,

    /// Row data (Vue: required `rows`).
    pub rows: Vec<TableRow>,

    /// Accessible caption, rendered as `caption.hk-table-sr-only`.
    pub caption: Option<String>,

    /// Size step (`hk-table-{size}`).
    #[default]
    pub size: TableSize,

    #[default]
    pub bordered: bool,

    #[default]
    pub striped: bool,

    /// Vue's `hover` (the legacy prop was named `hoverable`).
    #[default]
    pub hover: bool,

    /// Every column is click-to-sort (a column's own `sortable` also arms it).
    #[default]
    pub sortable: bool,

    /// Render the leading checkbox column.
    #[default]
    pub selectable: bool,

    /// Render the leading drag grip column (keyboard reorder only — see the
    /// header delta).
    #[default]
    pub draggable: bool,

    /// Vue's copy layer switch; FALSE here because no clipboard runtime is
    /// wired (see the header delta).
    #[default]
    pub copy_cells: bool,

    /// Render the trailing row-actions column (the per-row verdict rides
    /// [`TableRow::manage`]).
    #[default]
    pub manageable: bool,

    /// Empty-state text; `""` falls back to `hikari::table.noData` ("No
    /// data"), exactly Vue's `emptyText || t(…)`.
    #[default]
    pub empty_text: String,

    /// The empty SLOT: wins over `empty_text` (Vue: `slots.empty`).
    pub empty: Option<Element>,

    /// Controlled sort key (Vue: local `sortKey`); `""` is "unsorted".
    #[default]
    pub sort_column: String,

    /// Controlled sort direction (Vue: local `sortDirection`).
    #[default]
    pub sort_direction: SortDirection,

    /// Controlled selected row keys (Vue: local `selectedRowKeys`).
    #[default]
    pub selected_keys: Vec<String>,

    /// Fires with the next sort state; the host owns `sort_column` /
    /// `sort_direction`.
    pub on_sort_change: Option<EventHandler<SortConfig>>,

    /// Fires with the next selected key set (Vue: `update:selectedRows`).
    pub on_selected_change: Option<EventHandler<Vec<String>>>,

    /// Fires with Vue's `reorder(from, to)` payload.
    pub on_reorder: Option<EventHandler<TableReorder>>,

    /// Fires with the resolved row key when a ⋯ trigger is pressed (Vue:
    /// `manage(row, opener)`).
    pub on_manage: Option<EventHandler<String>>,

    /// Appended to `div.hk-table-host` (Vue merges a consumer class onto the
    /// component root).
    #[default]
    pub class: String,
}

#[component]
pub fn Table(props: TableProps) -> Element {
    let display_rows = table_sorted_rows(
        &props.rows,
        &props.columns,
        &props.sort_column,
        props.sort_direction,
    );
    let all_keys: Vec<String> = display_rows
        .iter()
        .enumerate()
        .map(|(index, row)| table_row_key(row, index))
        .collect();
    let selection = table_selection_state(&props.selected_keys, &all_keys);
    let total_columns = props.columns.len()
        + usize::from(props.selectable)
        + usize::from(props.draggable)
        + usize::from(props.manageable);

    // Vue: a sorted strip refuses to reorder (the emitted index pair could not
    // reproduce the visual move against a derived arrangement).
    let reorder_inert = !props.sort_column.is_empty();

    let on_sort_change = props.on_sort_change.clone();
    let on_selected_change = props.on_selected_change.clone();
    let on_reorder = props.on_reorder.clone();
    let on_manage = props.on_manage.clone();
    let selected_keys = props.selected_keys.clone();
    let copy_cells = props.copy_cells;

    // ── header ────────────────────────────────────────────────────────────
    let mut header_cells: Vec<Element> = Vec::new();

    if props.draggable {
        header_cells.push(rsx! {
            th {
                class: "hk-table-header-cell hk-table-drag-col",
                style: "width:36px",
                "aria-hidden": "true",
            }
        });
    }

    if props.selectable {
        let header_toggle_selection = on_selected_change.clone();
        let header_selected = selected_keys.clone();
        let header_all_keys = all_keys.clone();
        let all_checked = selection.is_all();
        let mut checkbox_classes = String::from("hk-table-checkbox hk-table-checkbox-md");
        if all_checked {
            checkbox_classes.push_str(" hk-table-checkbox-checked");
        }
        header_cells.push(rsx! {
            th {
                class: "hk-table-header-cell",
                style: "width:40px",
                label {
                    class: "hk-table-checkbox-label",
                    input {
                        "type": "checkbox",
                        class: "hk-table-checkbox-input",
                        checked: all_checked,
                        "aria-checked": selection.aria_checked(),
                        onchange: move |_event: ChangeEvent| {
                            let next = table_toggle_all(&header_selected, &header_all_keys);
                            if let Some(handler) = header_toggle_selection.as_ref() {
                                handler.call(next);
                            }
                        },
                    }
                    span {
                        class: checkbox_classes,
                        if all_checked {
                            {svg_host(CHECK_SVG)}
                        }
                    }
                }
            }
        });
    }

    for column in props.columns.iter() {
        let can_sort = props.sortable || column.sortable;
        let is_sorted = can_sort && props.sort_column == column.key;
        let column_key = column.key.clone();

        let mut header_classes = String::from("hk-table-header-cell");
        if let Some(align) = table_cell_align_class(column.align) {
            header_classes.push(' ');
            header_classes.push_str(align);
        }
        if can_sort {
            header_classes.push_str(" hk-table-header-sortable");
        }
        if is_sorted {
            header_classes.push_str(" hk-table-header-sorted");
        }

        // Vue renders the indicator only while this column OWNS the sort.
        let sort_icon = if is_sorted {
            Some(if props.sort_direction == SortDirection::Descending {
                SORT_ICON_DESC_SVG
            } else {
                SORT_ICON_SVG
            })
        } else {
            None
        };

        let title = column.title.clone();
        let sort_handler = on_sort_change.clone();
        let current_column = props.sort_column.clone();
        let current_direction = props.sort_direction;

        header_cells.push(rsx! {
            th {
                class: header_classes,
                style: column.width.clone(),
                onclick: move |_event: MouseEvent| {
                    if !can_sort {
                        return;
                    }
                    let next = table_next_sort(&current_column, current_direction, &column_key);
                    if let Some(handler) = sort_handler.as_ref() {
                        handler.call(next);
                    }
                },
                span { class: "hk-table-header-label", {title} }
                if let Some(icon) = sort_icon {
                    {svg_host(icon)}
                }
            }
        });
    }

    if props.manageable {
        header_cells.push(rsx! {
            th {
                class: "hk-table-header-cell hk-table-manage-head",
                style: "width:36px",
                span { class: "hk-table-sr-only",
                    {t("hikari::table.rowActions", "Row actions")}
                }
            }
        });
    }

    let header_row = VNode::Element(Box::new(
        VElement::new("tr")
            .class("hk-table-header-row")
            .children(header_cells),
    ));

    // ── body ──────────────────────────────────────────────────────────────
    let mut body_rows: Vec<Element> = Vec::new();

    if display_rows.is_empty() {
        let empty_content: Element = match props.empty.clone() {
            Some(slot) => slot,
            None => {
                let text = if props.empty_text.is_empty() {
                    t("hikari::table.noData", "No data")
                } else {
                    props.empty_text.clone()
                };
                VNode::Text(VText::new(&text))
            }
        };
        body_rows.push(rsx! {
            tr {
                td {
                    class: "hk-table-empty",
                    colspan: total_columns,
                    {empty_content}
                }
            }
        });
    } else {
        for (index, row) in display_rows.iter().enumerate() {
            let row_key = table_row_key(row, index);
            let mut cells: Vec<Element> = Vec::new();

            if props.draggable {
                let handle_label = table_drag_handle_label(row, &props.columns);
                let handle_title = handle_label.clone();
                let reorder_handler = on_reorder.clone();
                let from = index;
                let row_count = display_rows.len();
                cells.push(rsx! {
                    td {
                        class: "hk-table-cell hk-table-drag-cell",
                        span {
                            class: "hk-table-drag-handle",
                            "role": "button",
                            tabindex: 0,
                            "aria-label": handle_label,
                            title: handle_title,
                            "aria-keyshortcuts": "ArrowUp ArrowDown",
                            "aria-disabled": reorder_inert.then_some("true"),
                            "data-disabled": reorder_inert.then_some(""),
                            onkeydown: move |event: KeyboardEvent| {
                                if event.key != "ArrowUp" && event.key != "ArrowDown" {
                                    return;
                                }
                                event.prevent_default();
                                if reorder_inert {
                                    return;
                                }
                                let delta = if event.key == "ArrowUp" { -1 } else { 1 };
                                if let Some(to) = table_reorder_target(from, delta, row_count)
                                    && let Some(handler) = reorder_handler.as_ref()
                                {
                                    handler.call(TableReorder { from, to });
                                }
                            },
                            {svg_host(DRAG_HANDLE_SVG)}
                        }
                    }
                });
            }

            if props.selectable {
                let row_checked = props.selected_keys.iter().any(|key| key == &row_key);
                let toggle_selection = on_selected_change.clone();
                let toggle_selected = selected_keys.clone();
                let toggle_key = row_key.clone();
                let mut checkbox_classes = String::from("hk-table-checkbox hk-table-checkbox-md");
                if row_checked {
                    checkbox_classes.push_str(" hk-table-checkbox-checked");
                }
                cells.push(rsx! {
                    td {
                        class: "hk-table-cell",
                        style: "width:40px",
                        label {
                            class: "hk-table-checkbox-label",
                            input {
                                "type": "checkbox",
                                class: "hk-table-checkbox-input",
                                checked: row_checked,
                                onchange: move |_event: ChangeEvent| {
                                    let next = table_toggle_row(&toggle_selected, &toggle_key);
                                    if let Some(handler) = toggle_selection.as_ref() {
                                        handler.call(next);
                                    }
                                },
                            }
                            span {
                                class: checkbox_classes,
                                if row_checked {
                                    {svg_host(CHECK_SVG)}
                                }
                            }
                        }
                    }
                });
            }

            for (column_index, column) in props.columns.iter().enumerate() {
                let cell_text = row.cells.get(column_index).cloned().unwrap_or_default();
                let mut cell_classes = String::from("hk-table-cell");
                if let Some(align) = table_cell_align_class(column.align) {
                    cell_classes.push(' ');
                    cell_classes.push_str(align);
                }
                let copy_hint = if copy_cells && column.copyable {
                    Some(t("hikari::clipboard.clickToCopy", "Click to copy"))
                } else {
                    None
                };
                cells.push(rsx! {
                    td {
                        class: cell_classes,
                        title: copy_hint,
                        {cell_text}
                    }
                });
            }

            if props.manageable {
                let mode = row.manage;
                let trigger = if mode.renders_trigger() {
                    let manage_handler = on_manage.clone();
                    let manage_key = row_key.clone();
                    let label = t("hikari::table.rowActions", "Row actions");
                    Some(IconButton(IconButtonProps {
                        icon: Some(MdiIcon::DotsHorizontal),
                        variant: IconButtonVariant::Ghost,
                        size: IconButtonSize::S28,
                        disabled: mode.is_disabled(),
                        aria_label: Some(label),
                        onclick: Some(event_handler(move |event: MouseEvent| {
                            event.stop_propagation();
                            if let Some(handler) = manage_handler.as_ref() {
                                handler.call(manage_key.clone());
                            }
                        })),
                        ..Default::default()
                    }))
                } else {
                    None
                };
                cells.push(rsx! {
                    td {
                        class: "hk-table-cell hk-table-manage-cell",
                        if let Some(trigger) = trigger {
                            {trigger}
                        }
                    }
                });
            }

            body_rows.push(VNode::Element(Box::new(
                VElement::new("tr")
                    .class("hk-table-row")
                    .key(row_key.as_str())
                    .children(cells),
            )));
        }
    }

    let body = VNode::Element(Box::new(
        VElement::new("tbody")
            .class("hk-table-body")
            .children(body_rows),
    ));

    // ── shell ─────────────────────────────────────────────────────────────
    let mut table_classes = format!("hk-table {}", props.size.class_name());
    if props.bordered {
        table_classes.push_str(" hk-table-bordered");
    }
    if props.striped {
        table_classes.push_str(" hk-table-striped");
    }
    if props.hover {
        table_classes.push_str(" hk-table-hover");
    }
    if props.draggable {
        table_classes.push_str(" hk-table-draggable");
    }

    let mut host_classes = String::from("hk-table-host");
    if !props.class.is_empty() {
        host_classes.push(' ');
        host_classes.push_str(&props.class);
    }

    let caption = props.caption.clone();

    rsx! {
        div {
            class: host_classes,
            div {
                class: "hk-table-wrapper",
                table {
                    class: table_classes,
                    "data-copy-cells": copy_cells.then_some(""),
                    if let Some(caption) = caption {
                        caption { class: "hk-table-sr-only",
                            {caption}
                        }
                    }
                    {header_row}
                    {body}
                }
            }
        }
    }
}

impl StyledComponent for TableComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-table*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTable.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "table"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn columns() -> Vec<TableColumn> {
        vec![
            TableColumn::new("name", "Name"),
            TableColumn::new("age", "Age").sortable(true),
        ]
    }

    fn rows() -> Vec<TableRow> {
        vec![
            TableRow::new(vec!["Ada", "36"]).key("r1"),
            TableRow::new(vec!["Grace", "45"]).key("r2"),
            TableRow::new(vec!["Alan", "31"]).key("r3"),
        ]
    }

    #[test]
    fn table_size_classes_match_the_vue_modifiers() {
        assert_eq!(TableSize::Small.class_name(), "hk-table-sm");
        assert_eq!(TableSize::Medium.class_name(), "hk-table-md");
        assert_eq!(TableSize::Large.class_name(), "hk-table-lg");
    }

    #[test]
    fn table_align_classes_match_the_vue_helpers() {
        // Vue emits the `hk-text-*` helpers (NOT the legacy `hk-align-*`).
        assert_eq!(
            table_cell_align_class(Some(ColumnAlign::Left)),
            Some("hk-text-left")
        );
        assert_eq!(
            table_cell_align_class(Some(ColumnAlign::Center)),
            Some("hk-text-center")
        );
        assert_eq!(
            table_cell_align_class(Some(ColumnAlign::Right)),
            Some("hk-text-right")
        );
        assert_eq!(table_cell_align_class(None), None);
    }

    #[test]
    fn table_props_defaults_match_the_vue_props() {
        let props = TableProps::default();
        assert!(props.columns.is_empty());
        assert!(props.rows.is_empty());
        assert_eq!(props.caption, None);
        assert_eq!(props.size, TableSize::Medium);
        assert!(!props.bordered);
        assert!(!props.striped);
        assert!(!props.hover);
        assert!(!props.sortable);
        assert!(!props.selectable);
        assert!(!props.draggable);
        // Documented delta: Vue defaults `copyCells` to true; the mirror has
        // no clipboard runtime, so the opt-out branch is the default.
        assert!(!props.copy_cells);
        assert!(!props.manageable);
        assert_eq!(props.empty_text, "");
        assert!(props.empty.is_none());
        assert_eq!(props.sort_column, "");
        assert_eq!(props.sort_direction, SortDirection::None);
        assert!(props.selected_keys.is_empty());
        assert_eq!(props.class, "");
        assert!(props.on_sort_change.is_none());
        assert!(props.on_selected_change.is_none());
        assert!(props.on_reorder.is_none());
        assert!(props.on_manage.is_none());
    }

    #[test]
    fn table_column_defaults_match_the_vue_column() {
        let column = TableColumn::default();
        assert_eq!(column.key, "");
        assert_eq!(column.title, "");
        assert_eq!(column.width, None);
        assert!(!column.sortable);
        // Vue's `align` is optional and `copyable` defaults to true.
        assert_eq!(column.align, None);
        assert!(column.copyable);

        let legacy = ColumnDef::new("email", "E-mail")
            .sortable(true)
            .width("12rem");
        let bridged = TableColumn::from(legacy);
        assert_eq!(bridged.key, "email");
        assert_eq!(bridged.title, "E-mail");
        assert_eq!(bridged.width.as_deref(), Some("12rem"));
        assert!(bridged.sortable);
        assert!(bridged.copyable);
    }

    #[test]
    fn table_compare_cells_matches_the_vue_comparator() {
        use std::cmp::Ordering;
        // Ascending / descending flip the value comparison…
        assert_eq!(
            table_compare_cells(Some("Ada"), Some("Grace"), SortDirection::Ascending),
            Ordering::Less
        );
        assert_eq!(
            table_compare_cells(Some("Ada"), Some("Grace"), SortDirection::Descending),
            Ordering::Greater
        );
        // …but a missing cell sinks in BOTH directions (Vue returns the null
        // arm before it multiplies by `dir`).
        assert_eq!(
            table_compare_cells(None, Some("Ada"), SortDirection::Ascending),
            Ordering::Greater
        );
        assert_eq!(
            table_compare_cells(None, Some("Ada"), SortDirection::Descending),
            Ordering::Greater
        );
        assert_eq!(
            table_compare_cells(Some("Ada"), None, SortDirection::Descending),
            Ordering::Less
        );
        assert_eq!(
            table_compare_cells(None, None, SortDirection::Ascending),
            Ordering::Equal
        );
        // Unsorted never compares.
        assert_eq!(
            table_compare_cells(Some("a"), Some("b"), SortDirection::None),
            Ordering::Equal
        );
    }

    #[test]
    fn table_sorted_rows_orders_by_the_active_column() {
        let columns = columns();
        let ascending = table_sorted_rows(&rows(), &columns, "age", SortDirection::Ascending);
        assert_eq!(
            ascending
                .iter()
                .map(|row| row.cells[0].as_str())
                .collect::<Vec<_>>(),
            vec!["Alan", "Ada", "Grace"]
        );
        let descending = table_sorted_rows(&rows(), &columns, "age", SortDirection::Descending);
        assert_eq!(
            descending
                .iter()
                .map(|row| row.cells[0].as_str())
                .collect::<Vec<_>>(),
            vec!["Grace", "Ada", "Alan"]
        );
        // No active sort / unknown column → the consumer's own order.
        assert_eq!(
            table_sorted_rows(&rows(), &columns, "", SortDirection::None),
            rows()
        );
        assert_eq!(
            table_sorted_rows(&rows(), &columns, "missing", SortDirection::Ascending),
            rows()
        );
    }

    #[test]
    fn table_sorted_rows_sinks_short_rows_and_keeps_ties_stable() {
        let columns = columns();
        let short = vec![
            TableRow::new(vec!["b", "2"]),
            TableRow::new(vec!["missing"]),
            TableRow::new(vec!["a"]),
        ];
        let sorted = table_sorted_rows(&short, &columns, "age", SortDirection::Descending);
        // Both short rows carry no age cell: they keep their relative order and
        // land last in a descending sort too.
        assert_eq!(sorted[0].cells[0], "b");
        assert_eq!(sorted[1].cells[0], "missing");
        assert_eq!(sorted[2].cells[0], "a");
    }

    #[test]
    fn table_next_sort_cycles_like_the_vue_tri_state() {
        // A new key starts ascending.
        let first = table_next_sort("", SortDirection::None, "age");
        assert_eq!(first.column, "age");
        assert_eq!(first.direction, SortDirection::Ascending);
        // The same key walks ascending → descending → unsorted.
        let second = table_next_sort("age", SortDirection::Ascending, "age");
        assert_eq!(second.column, "age");
        assert_eq!(second.direction, SortDirection::Descending);
        let third = table_next_sort("age", SortDirection::Descending, "age");
        assert_eq!(third.column, "");
        assert_eq!(third.direction, SortDirection::None);
        // A different key restarts at ascending.
        let other = table_next_sort("age", SortDirection::Descending, "name");
        assert_eq!(other.column, "name");
        assert_eq!(other.direction, SortDirection::Ascending);
    }

    #[test]
    fn table_selection_state_is_three_way() {
        let all = vec!["a".to_string(), "b".to_string()];
        assert_eq!(table_selection_state(&[], &all), TableSelectionState::None);
        assert_eq!(
            table_selection_state(&["a".to_string()], &all),
            TableSelectionState::Partial
        );
        assert_eq!(
            table_selection_state(&["a".to_string(), "b".to_string()], &all),
            TableSelectionState::All
        );
        // No displayed rows is not "all selected".
        assert_eq!(table_selection_state(&[], &[]), TableSelectionState::None);
        // The header input's a11y token for each state.
        assert_eq!(TableSelectionState::None.aria_checked(), None);
        assert_eq!(TableSelectionState::Partial.aria_checked(), Some("mixed"));
        assert_eq!(TableSelectionState::All.aria_checked(), Some("true"));
    }

    #[test]
    fn table_toggles_follow_the_vue_set_semantics() {
        let all = vec!["a".to_string(), "b".to_string()];
        assert_eq!(
            table_toggle_row(&[], "a"),
            vec!["a".to_string()],
            "a fresh key appends"
        );
        assert_eq!(
            table_toggle_row(&["a".to_string(), "b".to_string()], "a"),
            vec!["b".to_string()],
            "a selected key is removed"
        );
        // toggleAll: partial → everything, all → cleared.
        assert_eq!(table_toggle_all(&["a".to_string()], &all), all);
        assert!(table_toggle_all(&all, &all).is_empty());
        // A stale key cannot invert the toggle (see the helper's note).
        assert_eq!(table_toggle_all(&["stale".to_string()], &all), all);
    }

    #[test]
    fn table_reorder_target_is_bounded() {
        assert_eq!(table_reorder_target(0, 1, 3), Some(1));
        assert_eq!(table_reorder_target(2, -1, 3), Some(1));
        // Both ends refuse to move — and the pressed row must exist at all.
        assert_eq!(table_reorder_target(0, -1, 3), None);
        assert_eq!(table_reorder_target(2, 1, 3), None);
        assert_eq!(table_reorder_target(3, -1, 3), None);
        assert_eq!(table_reorder_target(0, 0, 3), None);
        assert_eq!(table_reorder_target(0, 1, 0), None);
    }

    #[test]
    fn table_row_key_and_drag_handle_label_follow_vue() {
        let columns = columns();
        let keyed = TableRow::new(vec!["Ada", "36"]).key("r1");
        assert_eq!(table_row_key(&keyed, 7), "r1");
        let unkeyed = TableRow::new(vec!["Ada", "36"]);
        assert_eq!(table_row_key(&unkeyed, 7), "7");

        // The grip names the row by its first column value.
        assert_eq!(table_drag_handle_label(&keyed, &columns), "Reorder Ada");
        // A blank / missing first cell falls back to the bare action name.
        let blank = TableRow::new(vec!["  ", "1"]);
        assert_eq!(table_drag_handle_label(&blank, &columns), "Drag to reorder");
        assert_eq!(
            table_drag_handle_label(&TableRow::new(Vec::<String>::new()), &columns),
            "Drag to reorder"
        );
    }

    #[test]
    fn table_styles_come_from_the_canonical_vue_sheet() {
        let css = TableComponent::styles();
        assert!(
            css.contains(".hk-table-host")
                && css.contains(".hk-table-wrapper")
                && css.contains(".hk-table-header-cell")
                && css.contains(".hk-table-row")
                && css.contains(".hk-table-empty")
                && css.contains(".hk-text-center"),
            "table css must carry the vue frame, header, row and helper classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored table sheet"
        );
        // The retired legacy sheet's token family must not come back.
        assert!(
            !css.contains("--hi-table-"),
            "legacy --hi-table-* vars are retired"
        );
    }

    #[test]
    fn table_renders_the_header_and_a_data_row() {
        let html = Table(TableProps {
            columns: columns(),
            rows: rows(),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "class=\"hk-table-host\"",
            "class=\"hk-table-wrapper\"",
            "class=\"hk-table hk-table-md\"",
            "class=\"hk-table-header-row\"",
            "hk-table-header-cell",
            "hk-table-header-label",
            ">Name<",
            "class=\"hk-table-body\"",
            "class=\"hk-table-row\"",
            "hk-table-cell",
            ">Ada<",
            ">36<",
            ">Grace<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // No pager / no sticky chrome / no empty row on a populated table.
        assert!(!html.contains("hk-table-empty"), "{html}");
        assert!(!html.contains("sticky"), "{html}");
        // The sort indicator only rides the sorted column.
        assert!(!html.contains("hk-table-sort-icon"), "{html}");
    }

    #[test]
    fn table_renders_selection_manage_and_the_empty_state() {
        let html = Table(TableProps {
            columns: columns(),
            rows: rows(),
            selectable: true,
            manageable: true,
            draggable: true,
            selected_keys: vec!["r1".to_string()],
            sort_column: "age".to_string(),
            sort_direction: SortDirection::Descending,
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "hk-table-drag-col",
            "hk-table-drag-cell",
            "hk-table-drag-handle",
            "aria-keyshortcuts=\"ArrowUp ArrowDown\"",
            "hk-table-checkbox-input",
            "checked=\"checked\"",
            "hk-table-checkbox-checked",
            // One of three rows selected → the mixed header state.
            "aria-checked=\"mixed\"",
            "hk-table-manage-head",
            "hk-table-manage-cell",
            // The ⋯ trigger is the mirrored IconButton.
            "hk-icon-button hk-icon-button-28 hk-icon-button-ghost",
            "aria-label=\"Row actions\"",
            // The active descending sort rotates the indicator.
            "hk-table-sort-icon hk-table-sort-icon-desc",
            "hk-table-header-sorted",
            // A sorted strip dims the grip (reordering is inert).
            "data-disabled=\"\"",
            "aria-disabled=\"true\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }

        // Empty state: the whole column span, i18n fallback text.
        let empty = Table(TableProps {
            columns: columns(),
            selectable: true,
            manageable: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(empty.contains("hk-table-empty"), "{empty}");
        assert!(empty.contains("colspan=\"4\""), "{empty}");
        assert!(empty.contains(">No data<"), "{empty}");
        assert!(!empty.contains("hk-table-row"), "{empty}");
    }
}
