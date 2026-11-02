// hi-components/src/data/filter_panel.rs
// FilterPanel — mirror of the canonical Vue `HkFilterPanel`: the condition-row
// list inside the header filter affordance, PLUS the filter-condition model
// (field / operator / value) the whole family shares.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkFilterPanel.scss`, vendored under
// `src/styles/vue-mirror/` and listed in `scripts/sync-vue-mirror.py`'s W3
// `DATA_SHEETS`), compiled with `no_hash` so every `.hk-filter-panel*` /
// `.hk-filter-add*` class name is literal and identical in both forms.
//
// DOM contract (mirrors the Vue render output):
//
//   div.hk-filter-panel [data-active] [data-empty] data-testid aria-label
//        (style: position:relative — the chooser layer's containing block)
//     div.hk-filter-panel-row data-kind={text|number|select|date}   (per row)
//       span.hk-filter-panel-field {field label, or the raw key when the page
//                                   renamed a field under live state}
//       div.hk-filter-panel-ops role=group aria-label="{label} — {panel label}"
//         button.hk-filter-panel-op type=button aria-pressed aria-label title
//                [disabled]
//           FilterOperatorIcon (the kind's glyph; see `glyph_operator`)
//       div.hk-filter-panel-value
//         div.hk-filter-panel-control
//           Input | Select | DatePicker          (by the field's kind)
//         button.hk-filter-panel-remove type=button aria-label title [disabled]
//           span[style="display:contents"] > the ✕ svg
//     div.hk-filter-panel-addrow                                   (fields only)
//       button.hk-filter-panel-add type=button aria-haspopup=menu
//              aria-expanded data-state={open|closed} [disabled]
//         span[style="display:contents"] > the + svg
//         span {localized "Add condition"}
//   ── sibling of the panel while the chooser is open ──
//   div.hk-filter-add-content   (style: absolute layer geometry)
//     div.hk-filter-add-list role=menu aria-label
//       button.hk-filter-add-item role=menuitem data-kind data-add-index
//              [data-highlighted] [disabled]
//         span.hk-filter-add-item-label {field label}
//
// State contract (the tairitsu 0.5.22 limit this wave works under, shared with
// `basic::select` / `basic::date_picker`): Vue keeps `addMenuOpen`,
// `addHighlight` and each row control's `open` in local refs. tairitsu has no
// per-instance component state, so they are CONTROLLED props here —
// `add_menu_open` / `add_highlight` in, `on_add_menu_change` out; `open_row` in,
// `on_open_row_change` out. The mirror stores nothing itself.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * no `<Teleport>`: the add-field chooser renders as an absolutely
//     positioned SIBLING of the panel root, so the panel's own
//     `overflow-y:auto` box cannot clip it (Vue teleports it to
//     `document.body` and measures the add button). The host's positioned
//     ancestor places it — the bar / chip / trigger hosts in this family all
//     declare one; a standalone panel needs `position: relative` from its host.
//   * ONE row popup at a time: Vue's per-row `HkPopupSelect` / `HkDatePicker`
//     each own an `open` ref (several rows could technically be open at once);
//     the mirror carries the single `open_row` index. The sheet's outside-click
//     close makes the two observable states agree in practice.
//   * no scroll-into-view on highlight (`document.querySelector` +
//     `scrollIntoView`): tairitsu 0.5.22 has no ref + measurement pairing, and
//     `HkScrollContainer` is not mirrored in this wave (its sheet is not
//     vendored), so the chooser renders its list directly inside
//     `hk-filter-add-content` and the `hk-filter-add-viewport` wrapper is
//     dropped — its only sheet rule styles the scroll container's inner
//     viewport, which the mirror does not render.
//   * `pointerenter` highlighting is attached unconditionally (the rows only
//     exist while the chooser is open), exactly Vue's guarded spread.
//   * Vue's `watch(fields)` reconciliation is a pure helper
//     (`add_menu_reconciled`) the host applies on its next render instead of a
//     watcher.

use hikari_i18n::t;
// The prelude curates the tairitsu event set; `PointerEvent` (the hover
// highlight channel) is not part of it — the same crate-level import
// `basic/select.rs` uses.
use tairitsu_vdom::PointerEvent;

use crate::basic::date_picker::{DatePicker, DatePickerProps, DatePickerSize};
use crate::basic::input::{Input, InputProps, InputSize, InputVariant};
use crate::basic::select::{Select, SelectOption, SelectProps};
use crate::data::filter_operator_icon::{FilterOperatorIcon, FilterOperatorIconProps};
use crate::feedback::popover::{PopoverAlign, PopoverPlacement, PopoverSide};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FilterPanelComponent;

// ── the condition model ──────────────────────────────────────────────────

/// Filter condition operators (Vue: `HkFilterOperator`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum FilterOperator {
    #[default]
    Eq,
    Ne,
    Approx,
    Napprox,
    Lt,
    Lte,
    Gte,
    Gt,
}

/// Declaration order, exactly Vue's union order.
pub const FILTER_OPERATORS: [FilterOperator; 8] = [
    FilterOperator::Eq,
    FilterOperator::Ne,
    FilterOperator::Approx,
    FilterOperator::Napprox,
    FilterOperator::Lt,
    FilterOperator::Lte,
    FilterOperator::Gte,
    FilterOperator::Gt,
];

impl FilterOperator {
    /// The wire token exactly as Vue spells the operator.
    pub fn token(self) -> &'static str {
        match self {
            FilterOperator::Eq => "eq",
            FilterOperator::Ne => "ne",
            FilterOperator::Approx => "approx",
            FilterOperator::Napprox => "napprox",
            FilterOperator::Lt => "lt",
            FilterOperator::Lte => "lte",
            FilterOperator::Gte => "gte",
            FilterOperator::Gt => "gt",
        }
    }

    /// Inverse of [`FilterOperator::token`] (page-owned keys travel as strings).
    pub fn from_token(token: &str) -> Option<Self> {
        FILTER_OPERATORS
            .iter()
            .copied()
            .find(|operator| operator.token() == token)
    }

    /// i18n key of the operator's accessible name (Vue: `OPERATOR_LABEL[op].key`).
    pub fn label_key(self) -> &'static str {
        match self {
            FilterOperator::Eq => "components.hk.filterPanel.op.eq",
            FilterOperator::Ne => "components.hk.filterPanel.op.ne",
            FilterOperator::Approx => "components.hk.filterPanel.op.approx",
            FilterOperator::Napprox => "components.hk.filterPanel.op.napprox",
            FilterOperator::Lt => "components.hk.filterPanel.op.lt",
            FilterOperator::Lte => "components.hk.filterPanel.op.lte",
            FilterOperator::Gte => "components.hk.filterPanel.op.gte",
            FilterOperator::Gt => "components.hk.filterPanel.op.gt",
        }
    }

    /// English fallback of the operator's accessible name.
    pub fn label_fallback(self) -> &'static str {
        match self {
            FilterOperator::Eq => "equals",
            FilterOperator::Ne => "not equals",
            FilterOperator::Approx => "fuzzy match",
            FilterOperator::Napprox => "fuzzy non-match",
            FilterOperator::Lt => "less than",
            FilterOperator::Lte => "at most",
            FilterOperator::Gte => "at least",
            FilterOperator::Gt => "greater than",
        }
    }

    /// The localized name (Vue: `t(OPERATOR_LABEL[op].key, …fallback)`).
    pub fn label(self) -> String {
        t(self.label_key(), self.label_fallback())
    }
}

/// The four field kinds a page can declare (Vue: `HkFilterFieldDef["kind"]`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum FilterFieldKind {
    #[default]
    Text,
    Number,
    Select,
    Date,
}

impl FilterFieldKind {
    /// The `data-kind` token exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            FilterFieldKind::Text => "text",
            FilterFieldKind::Number => "number",
            FilterFieldKind::Select => "select",
            FilterFieldKind::Date => "date",
        }
    }

    /// Parse a page-declared kind token.
    pub fn from_token(token: &str) -> Option<Self> {
        match token {
            "text" => Some(FilterFieldKind::Text),
            "number" => Some(FilterFieldKind::Number),
            "select" => Some(FilterFieldKind::Select),
            "date" => Some(FilterFieldKind::Date),
            _ => None,
        }
    }
}

/// One offered value of a `select` field (Vue: `HkPopupSelectOption`).
#[derive(Clone, PartialEq, Eq, Debug, Default)]
pub struct FilterOption {
    pub value: String,
    pub label: String,
}

/// One filterable field a page declares for the panel.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct FilterFieldDef {
    /// Condition key — stable, page-owned (maps to the RPC parameter).
    pub key: String,
    pub label: String,
    pub kind: FilterFieldKind,
    /// `select` kind: the offered values. A leading empty-value "All" row is
    /// prepended by [`select_options_for`] when the page did not include one.
    pub options: Vec<FilterOption>,
    /// Override the kind's default operator set (`Some(vec![])` stays empty —
    /// Vue's `??` only falls through on `undefined`).
    pub operators: Option<Vec<FilterOperator>>,
    pub placeholder: Option<String>,
}

/// One condition: WHICH field, the operator and the (string) value. An EMPTY
/// value filters nothing (pages map absent/empty onto "no filter" at the RPC
/// boundary); the row's own remove button is the UI verb that drops it.
#[derive(Clone, PartialEq, Eq, Debug, Default)]
pub struct FilterCondition {
    pub key: String,
    pub op: FilterOperator,
    pub value: String,
}

/// The panel's state IS the visible row list (Vue: `HkFilterState`): an
/// ORDERED array, so the SAME field may carry MANY conditions.
pub type FilterState = Vec<FilterCondition>;

// ── pure functions (the model, shared by every member of the family) ─────

/// The kind's default operator set (Vue: `DEFAULT_OPERATORS`). TEXT fields
/// speak the FUZZY pair only — the old exact =/≠ for text is gone.
pub fn default_operators(kind: FilterFieldKind) -> &'static [FilterOperator] {
    match kind {
        FilterFieldKind::Text => &[FilterOperator::Approx, FilterOperator::Napprox],
        FilterFieldKind::Number => &[
            FilterOperator::Lt,
            FilterOperator::Lte,
            FilterOperator::Eq,
            FilterOperator::Gte,
            FilterOperator::Gt,
        ],
        FilterFieldKind::Select => &[FilterOperator::Eq, FilterOperator::Ne],
        FilterFieldKind::Date => &[FilterOperator::Gte, FilterOperator::Lte],
    }
}

/// The operators a declared field offers (Vue: `operatorsFor`).
pub fn operators_for(field: &FilterFieldDef) -> Vec<FilterOperator> {
    match field.operators.as_ref() {
        Some(operators) => operators.clone(),
        None => default_operators(field.kind).to_vec(),
    }
}

/// Which ICON the operator renders as (Vue: `glyphOpFor`): fields that speak
/// ONLY the eq/ne pair (select) render the fuzzy pair ≈/≉ — 等于其实是模糊匹配
/// applies to them too. A number's exact = keeps the plain equals icon inside
/// the ordered five.
pub fn glyph_operator(kind: FilterFieldKind, op: FilterOperator) -> FilterOperator {
    match (kind, op) {
        (FilterFieldKind::Select, FilterOperator::Eq) => FilterOperator::Approx,
        (FilterFieldKind::Select, FilterOperator::Ne) => FilterOperator::Napprox,
        _ => op,
    }
}

/// Keep only a legal number shape: optional leading minus, digits, one decimal
/// point. The intermediate fragments "-", "." and "-." survive deliberately —
/// rejecting them mid-keystroke would make typing a negative or a decimal
/// impossible.
pub fn sanitize_number_input(raw: &str) -> String {
    let mut out: String = raw
        .chars()
        .filter(|c| c.is_ascii_digit() || *c == '-' || *c == '.')
        .collect();
    let has_minus = out.starts_with('-');
    out.retain(|c| c != '-');
    if has_minus {
        out.insert(0, '-');
    }
    if let Some(first_dot) = out.find('.') {
        let mut rebuilt = String::from(&out[..first_dot + 1]);
        rebuilt.extend(out[first_dot + 1..].chars().filter(|c| *c != '.'));
        out = rebuilt;
    }
    out
}

/// Operators whose multiple conditions on ONE field combine with OR (Vue:
/// `matchOpsFor`): ≈香蕉 plus ≈苹果 matches rows containing EITHER; select-kind
/// equals joins the OR class; a NUMBER's exact = does not.
pub fn match_operators(kind: FilterFieldKind) -> &'static [FilterOperator] {
    match kind {
        FilterFieldKind::Select => &[FilterOperator::Eq, FilterOperator::Approx],
        _ => &[FilterOperator::Approx],
    }
}

/// Does ONE non-empty condition hold against a concrete raw value? String forms
/// compare case-insensitively for the fuzzy pair; numeric comparisons coerce
/// and are false on non-numbers (Vue: `hkConditionMatches`).
pub fn condition_matches(cond: &FilterCondition, kind: FilterFieldKind, raw: &str) -> bool {
    let hay = raw.to_lowercase();
    let needle = cond.value.to_lowercase();
    match cond.op {
        FilterOperator::Approx => hay.contains(&needle),
        FilterOperator::Napprox => !hay.contains(&needle),
        FilterOperator::Eq => {
            if kind == FilterFieldKind::Number {
                number_pair(raw, &cond.value).is_some_and(|(a, b)| a == b)
            } else {
                hay == needle
            }
        }
        FilterOperator::Ne => {
            let negated = FilterCondition {
                key: cond.key.clone(),
                op: FilterOperator::Eq,
                value: cond.value.clone(),
            };
            !condition_matches(&negated, kind, raw)
        }
        FilterOperator::Lt | FilterOperator::Lte | FilterOperator::Gt | FilterOperator::Gte => {
            match number_pair(raw, &cond.value) {
                Some((a, b)) => match cond.op {
                    FilterOperator::Lt => a < b,
                    FilterOperator::Lte => a <= b,
                    FilterOperator::Gt => a > b,
                    _ => a >= b,
                },
                None => false,
            }
        }
    }
}

/// Both sides as finite numbers, or `None` when either is not a number (Vue's
/// `Number.isFinite` pair).
fn number_pair(raw: &str, needle: &str) -> Option<(f64, f64)> {
    let a: f64 = raw.trim().parse().ok()?;
    let b: f64 = needle.trim().parse().ok()?;
    (a.is_finite() && b.is_finite()).then_some((a, b))
}

/// Combine ALL of one field's conditions against a concrete raw value — the
/// canonical semantics pages (and servers) must mirror (Vue: `hkFieldMatches`):
/// the field's MATCH-class conditions OR-combine; every other condition must
/// hold INDIVIDUALLY (AND). Empty-valued conditions are skipped.
pub fn field_matches(kind: FilterFieldKind, conditions: &[FilterCondition], raw: &str) -> bool {
    let live: Vec<&FilterCondition> = conditions
        .iter()
        .filter(|cond| !cond.value.is_empty())
        .collect();
    let match_ops = match_operators(kind);
    let matchers: Vec<&&FilterCondition> = live
        .iter()
        .filter(|cond| match_ops.contains(&cond.op))
        .collect();
    if !matchers.is_empty()
        && !matchers
            .iter()
            .any(|cond| condition_matches(cond, kind, raw))
    {
        return false;
    }
    for cond in &live {
        if match_ops.contains(&cond.op) {
            continue;
        }
        if !condition_matches(cond, kind, raw) {
            return false;
        }
    }
    true
}

/// How many conditions actually filter (Vue: the trigger's corner badge and the
/// panel's `data-active` both read this count).
pub fn active_condition_count(state: &FilterState) -> usize {
    state.iter().filter(|cond| !cond.value.is_empty()).count()
}

/// The offered `select` rows (Vue: `selectOptions`): a page that did not ship
/// its own empty-value row gets a LOCALIZED "All" row prepended, so an
/// empty-seeded select reads as "no filter", not as a dash.
pub fn select_options_for(field: &FilterFieldDef) -> Vec<FilterOption> {
    if field.options.iter().any(|option| option.value.is_empty()) {
        return field.options.clone();
    }
    let mut options = vec![FilterOption {
        value: String::new(),
        label: t("components.hk.filterPanel.all", "All"),
    }];
    options.extend(field.options.iter().cloned());
    options
}

/// The condition a pick of `field` materializes (Vue: `pickAddable`), or `None`
/// when an IDENTICAL empty condition already sits in the panel — re-picking the
/// same field then adds nothing.
pub fn pick_addable(state: &FilterState, field: &FilterFieldDef) -> Option<FilterCondition> {
    let op = *operators_for(field).first()?;
    let candidate = FilterCondition {
        key: field.key.clone(),
        op,
        value: String::new(),
    };
    let duplicate = state
        .iter()
        .any(|cond| cond.key == candidate.key && cond.op == candidate.op && cond.value.is_empty());
    (!duplicate).then_some(candidate)
}

/// The next state after a pick: the candidate appended, or the SAME state when
/// the panel already carries the identical empty row.
pub fn state_with_picked_field(state: &FilterState, field: &FilterFieldDef) -> FilterState {
    match pick_addable(state, field) {
        Some(candidate) => {
            let mut next = state.clone();
            next.push(candidate);
            next
        }
        None => state.clone(),
    }
}

/// Index-targeted patch of one row's value (Vue: `emitCondition(index, {value})`).
pub fn condition_with_value(state: &FilterState, index: usize, value: String) -> FilterState {
    patch_condition(state, index, |cond| cond.value = value)
}

/// Index-targeted patch of one row's operator.
pub fn condition_with_operator(
    state: &FilterState,
    index: usize,
    op: FilterOperator,
) -> FilterState {
    patch_condition(state, index, |cond| cond.op = op)
}

/// Drop THIS condition by index — sibling conditions on the same field survive
/// (Vue's index-targeted removal, never key-targeted).
pub fn condition_removed(state: &FilterState, index: usize) -> FilterState {
    state
        .iter()
        .enumerate()
        .filter(|(i, _)| *i != index)
        .map(|(_, cond)| cond.clone())
        .collect()
}

fn patch_condition(
    state: &FilterState,
    index: usize,
    patch: impl FnOnce(&mut FilterCondition),
) -> FilterState {
    let mut patch = Some(patch);
    state
        .iter()
        .enumerate()
        .map(|(i, cond)| {
            let mut next = cond.clone();
            if i == index
                && let Some(patch) = patch.take()
            {
                patch(&mut next);
            }
            next
        })
        .collect()
}

// ── the add-condition chooser's state machine ────────────────────────────

/// The chooser's transient state (Vue: the `addMenuOpen` + `addHighlight` refs).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct AddMenuState {
    pub open: bool,
    /// Highlighted row; `-1` means "none".
    pub highlight: i32,
}

/// What one key press does to the chooser (Vue: `onAddTriggerKeydown`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct AddMenuTransition {
    pub state: AddMenuState,
    /// The field index to append (`Enter`/`Space` on an open menu).
    pub pick: Option<usize>,
    pub prevent_default: bool,
    /// Only Escape stops the bubble — it closes ONE layer, not the host panel.
    pub stop_propagation: bool,
}

/// Opening the chooser seeds the highlight on the first field (`-1` when the
/// page declared none).
pub fn add_menu_opened(field_count: usize) -> AddMenuState {
    AddMenuState {
        open: true,
        highlight: if field_count > 0 { 0 } else { -1 },
    }
}

/// Vue's `watch(fields)`: an open chooser closes on an empty menu and clamps an
/// out-of-range highlight back into range.
pub fn add_menu_reconciled(state: AddMenuState, field_count: usize) -> AddMenuState {
    if !state.open {
        return state;
    }
    if field_count == 0 {
        return AddMenuState::default();
    }
    if state.highlight >= field_count as i32 {
        return AddMenuState {
            open: true,
            highlight: field_count as i32 - 1,
        };
    }
    state
}

/// One key on the add button, re-expressed in controlled terms. Focus stays on
/// the trigger; arrows move the highlight, Enter/Space confirm it, Escape closes
/// one layer. Enter/Space on a CLOSED menu is left to the native button
/// activation (`prevent_default: false`), exactly Vue.
pub fn add_menu_key(state: AddMenuState, key: &str, field_count: usize) -> AddMenuTransition {
    let count = field_count as i32;
    let idle = AddMenuTransition {
        state,
        pick: None,
        prevent_default: false,
        stop_propagation: false,
    };
    match key {
        "ArrowDown" | "ArrowUp" => {
            let next = if !state.open {
                add_menu_opened(field_count)
            } else if count == 0 {
                state
            } else if key == "ArrowDown" {
                AddMenuState {
                    open: true,
                    highlight: (state.highlight + 1).rem_euclid(count),
                }
            } else {
                AddMenuState {
                    open: true,
                    highlight: (state.highlight - 1).rem_euclid(count),
                }
            };
            AddMenuTransition {
                state: next,
                pick: None,
                prevent_default: true,
                stop_propagation: false,
            }
        }
        "Enter" | " " => {
            if !state.open {
                return idle;
            }
            let pick = (state.highlight >= 0 && state.highlight < count)
                .then_some(state.highlight as usize);
            AddMenuTransition {
                state: AddMenuState::default(),
                pick,
                prevent_default: true,
                stop_propagation: false,
            }
        }
        "Escape" => {
            if !state.open {
                return idle;
            }
            AddMenuTransition {
                state: AddMenuState::default(),
                pick: None,
                prevent_default: true,
                stop_propagation: true,
            }
        }
        _ => idle,
    }
}

// ── the family's shared popup geometry ───────────────────────────────────

/// The inline geometry that pins a popup LAYER to its trigger.
///
/// Vue hands every filter popout to `HkPopover`, which measures the anchor and
/// writes `position: fixed` coordinates. The mirror has no Teleport and no
/// measurement (the delta `feedback::popover` documents), so the layer is
/// `position: absolute` against the HOST's positioned ancestor and every arm is
/// expressed in percentages instead of pixels: no panel box is needed on either
/// axis.
pub fn filter_popup_layer_style(placement: PopoverPlacement, offset: f64) -> String {
    let (side, align) = placement.side_align();
    let mut style = String::from("position:absolute;z-index:30");
    match side {
        PopoverSide::Bottom => style.push_str(&format!(";top:calc(100% + {offset}px)")),
        PopoverSide::Top => style.push_str(&format!(";bottom:calc(100% + {offset}px)")),
        PopoverSide::Left | PopoverSide::Right => {
            let edge = if side == PopoverSide::Left {
                "right"
            } else {
                "left"
            };
            style.push_str(&format!(";{edge}:calc(100% + {offset}px)"));
            match align {
                PopoverAlign::Start => style.push_str(";top:0"),
                PopoverAlign::Center => style.push_str(";top:50%;transform:translateY(-50%)"),
                PopoverAlign::End => style.push_str(";bottom:0"),
            }
            return style;
        }
    }
    match align {
        PopoverAlign::Start => style.push_str(";left:0"),
        PopoverAlign::Center => style.push_str(";left:50%;transform:translateX(-50%)"),
        PopoverAlign::End => style.push_str(";right:0"),
    }
    style
}

/// The add-chooser's layer geometry: anchored to the panel's bottom-left (Vue:
/// the add button's `top-start` placement, offset 4) and lifted over the rows.
pub fn add_menu_layer_style() -> &'static str {
    "position:absolute;left:0;bottom:0;z-index:32"
}

// ── the component ────────────────────────────────────────────────────────

#[define_props]
pub struct FilterPanelProps {
    /// The page's declared fields (Vue: `fields`, required).
    pub fields: Vec<FilterFieldDef>,

    /// The visible row list — the single source of truth (Vue: `modelValue`).
    pub model_value: FilterState,

    #[default]
    pub disabled: bool,

    /// Panel aria-label (Vue: `label`, defaulting to the localized "Filters").
    pub label: Option<String>,

    // ── controlled state (Vue keeps these in local refs) ──────────────────
    /// The add-condition chooser's visibility (Vue: the local `addMenuOpen`).
    #[default]
    pub add_menu_open: bool,

    /// The chooser's highlighted row (Vue: the local `addHighlight`).
    #[default(-1)]
    pub add_highlight: i32,

    /// The row whose popup control is open (Vue: each row control's local
    /// `open`; the mirror carries one index — see the header delta).
    pub open_row: Option<u32>,

    // ── events ───────────────────────────────────────────────────────────
    /// Fires with the next state (Vue: `update:modelValue`).
    pub on_value_change: Option<EventHandler<FilterState>>,

    /// Fires with the next chooser state (Vue: the `addMenuOpen` /
    /// `addHighlight` ref writes).
    pub on_add_menu_change: Option<EventHandler<AddMenuState>>,

    /// Fires with the row whose popup should open (`None` = close them all).
    pub on_open_row_change: Option<EventHandler<Option<u32>>>,
}

/// The controlled wiring every row shares; bundled so each row's closures are
/// built from one value instead of cloning six fields per row.
struct PanelWiring {
    state: FilterState,
    on_value_change: Option<EventHandler<FilterState>>,
    on_open_row_change: Option<EventHandler<Option<u32>>>,
}

fn field_by_key<'a>(fields: &'a [FilterFieldDef], key: &str) -> Option<&'a FilterFieldDef> {
    fields.iter().find(|field| field.key == key)
}

/// The ✕ affordance's glyph (lucide `X` at `size={14}`, verbatim lucide path
/// data — the same markup Vue's `<X size={14} />` renders).
pub(crate) const CLOSE_GLYPH_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>"#;

/// The growth verb's glyph (lucide `Plus` at `size={14}`).
pub(crate) const PLUS_GLYPH_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>"#;

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an rsx `svg {}`
/// child would be an HTML element, and the host must not add a box).
pub(crate) fn glyph_host(markup: &'static str) -> Element {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

#[component]
pub fn FilterPanel(props: FilterPanelProps) -> Element {
    let label = props
        .label
        .clone()
        .unwrap_or_else(|| t("components.hk.filterBar.trigger", "Filters"));
    let active = active_condition_count(&props.model_value);
    let empty = props.model_value.is_empty();
    let wiring = PanelWiring {
        state: props.model_value.clone(),
        on_value_change: props.on_value_change.clone(),
        on_open_row_change: props.on_open_row_change.clone(),
    };

    let mut root = VElement::new("div")
        .class("hk-filter-panel")
        .attr("data-testid", "hk-filter-panel")
        .attr("aria-label", label.clone())
        // The add-chooser layer is absolutely positioned and the sheet keeps the
        // panel unpositioned, so the containing block is declared inline.
        .style("position:relative");
    if active > 0 {
        root = root.attr("data-active", "");
    }
    if empty {
        root = root.attr("data-empty", "");
    }

    for index in 0..props.model_value.len() {
        root = root.child(panel_row(&props, &wiring, index, &label));
    }

    if !props.fields.is_empty() {
        root = root.child(add_row(&props));
    }

    let root = VNode::Element(Box::new(root));

    // The chooser is the panel's SIBLING, not its child: the panel's own
    // `overflow-y: auto` box would clip an absolutely positioned layer (Vue
    // teleports it out for the same reason — see the header delta).
    if props.add_menu_open && !props.fields.is_empty() {
        return VNode::Fragment(vec![root, add_menu_layer(&props)]);
    }
    root
}

/// One condition row.
fn panel_row(
    props: &FilterPanelProps,
    wiring: &PanelWiring,
    index: usize,
    panel_label: &str,
) -> VNode {
    let cond = &props.model_value[index];
    let field = field_by_key(&props.fields, &cond.key);
    // An undeclared key (the page renamed a field under live state) renders a
    // bare inert row naming the key — removable, not editable.
    let kind = field
        .map(|field| field.kind)
        .unwrap_or(FilterFieldKind::Text);
    let ops = match field {
        Some(field) => operators_for(field),
        None => vec![cond.op],
    };
    let label_text = field
        .map(|field| field.label.clone())
        .unwrap_or_else(|| cond.key.clone());
    let inert = props.disabled || field.is_none();

    let mut ops_group = VElement::new("div")
        .class("hk-filter-panel-ops")
        .attr("role", "group")
        .attr("aria-label", format!("{label_text} — {panel_label}"));
    for op in &ops {
        let glyph = glyph_operator(kind, *op);
        let pressed = cond.op == *op;
        let on_value_change = wiring.on_value_change.clone();
        let state = wiring.state.clone();
        let op = *op;
        let mut button = VElement::new("button")
            .class("hk-filter-panel-op")
            .attr("type", "button")
            .attr("aria-pressed", if pressed { "true" } else { "false" })
            .attr("aria-label", glyph.label())
            .attr("title", glyph.label())
            .on_click(move |_event: MouseEvent| {
                if let Some(handler) = on_value_change.as_ref() {
                    handler.call(condition_with_operator(&state, index, op));
                }
            })
            .child(FilterOperatorIcon(FilterOperatorIconProps {
                op: glyph,
                ..Default::default()
            }));
        if inert {
            button = button.attr("disabled", "");
        }
        ops_group = ops_group.child(VNode::Element(Box::new(button)));
    }

    let remove_label = t(
        "components.hk.filterPanel.removeCondition",
        "Remove condition",
    );
    let on_value_change = wiring.on_value_change.clone();
    let state = wiring.state.clone();
    let mut remove = VElement::new("button")
        .class("hk-filter-panel-remove")
        .attr("type", "button")
        .attr("aria-label", remove_label.clone())
        .attr("title", remove_label)
        .on_click(move |_event: MouseEvent| {
            if let Some(handler) = on_value_change.as_ref() {
                handler.call(condition_removed(&state, index));
            }
        })
        .child(glyph_host(CLOSE_GLYPH_SVG));
    if props.disabled {
        remove = remove.attr("disabled", "");
    }

    let value_cell = VElement::new("div")
        .class("hk-filter-panel-value")
        .child(rsx! {
            div {
                class: "hk-filter-panel-control",
                {value_control(props, wiring, index, field, kind, &label_text)}
            }
        })
        .child(VNode::Element(Box::new(remove)));

    VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-filter-panel-row")
            .attr("data-kind", kind.token())
            .child(rsx! {
                span { class: "hk-filter-panel-field", "{label_text}" }
            })
            .child(VNode::Element(Box::new(ops_group)))
            .child(VNode::Element(Box::new(value_cell))),
    ))
}

/// The row's value control, by the field's kind — the mirrored Input (text /
/// number), Select (select) or DatePicker (date), each on its controlled event
/// surface.
fn value_control(
    props: &FilterPanelProps,
    wiring: &PanelWiring,
    index: usize,
    field: Option<&FilterFieldDef>,
    kind: FilterFieldKind,
    label_text: &str,
) -> VNode {
    let cond = &props.model_value[index];
    let row_open = props.open_row == Some(index as u32);
    let inert = props.disabled || field.is_none();
    let row = index as u32;

    let on_value_change = wiring.on_value_change.clone();
    let on_open_row_change = wiring.on_open_row_change.clone();
    let state = wiring.state.clone();

    match kind {
        FilterFieldKind::Select if field.is_some() => {
            let field = field.expect("the select arm requires a declared field");
            let options: Vec<SelectOption> = select_options_for(field)
                .into_iter()
                .map(|option| SelectOption {
                    value: option.value,
                    label: option.label,
                    disabled: false,
                })
                .collect();
            let open_handler = on_open_row_change.clone();
            Select(SelectProps {
                model_value: cond.value.clone(),
                // The row's left cell already names the field — the control's
                // own caption would read as duplication (Vue passes `hideLabel`).
                label: None,
                panel_title: Some(label_text.to_string()),
                options,
                open: row_open,
                disabled: inert,
                on_value_change: Some(EventHandler::new(move |value: String| {
                    if let Some(handler) = on_value_change.as_ref() {
                        handler.call(condition_with_value(&state, index, value));
                    }
                })),
                on_open_change: Some(EventHandler::new(move |open: bool| {
                    if let Some(handler) = open_handler.as_ref() {
                        handler.call(open.then_some(row));
                    }
                })),
                ..Default::default()
            })
        }
        FilterFieldKind::Date => {
            let open_handler = on_open_row_change.clone();
            DatePicker(DatePickerProps {
                model_value: (!cond.value.is_empty()).then(|| cond.value.clone()),
                size: DatePickerSize::Sm,
                disabled: inert,
                open: row_open,
                on_value_change: Some(EventHandler::new(move |value: Option<String>| {
                    if let Some(handler) = on_value_change.as_ref() {
                        handler.call(condition_with_value(
                            &state,
                            index,
                            value.unwrap_or_default(),
                        ));
                    }
                })),
                on_open_change: Some(EventHandler::new(move |open: bool| {
                    if let Some(handler) = open_handler.as_ref() {
                        handler.call(open.then_some(row));
                    }
                })),
                ..Default::default()
            })
        }
        _ => {
            let numeric = kind == FilterFieldKind::Number;
            Input(InputProps {
                model_value: cond.value.clone(),
                variant: if numeric {
                    InputVariant::Number
                } else {
                    InputVariant::Text
                },
                size: InputSize::Small,
                label: Some(label_text.to_string()),
                hide_label: true,
                placeholder: field.and_then(|field| field.placeholder.clone()),
                disabled: inert,
                oninput: Some(EventHandler::new(move |value: String| {
                    // Belt over the browser's native number filtering: the
                    // stored model keeps a clean number SHAPE only.
                    let value = if numeric {
                        sanitize_number_input(&value)
                    } else {
                        value
                    };
                    if let Some(handler) = on_value_change.as_ref() {
                        handler.call(condition_with_value(&state, index, value));
                    }
                })),
                ..Default::default()
            })
        }
    }
}

/// The pick edge: append the field's condition (Vue: `pickAddable` →
/// `update:modelValue`) and close the chooser (Vue: `closeAddMenu`).
fn commit_field_pick(
    state: &FilterState,
    field: &FilterFieldDef,
    on_value_change: &Option<EventHandler<FilterState>>,
    on_add_menu_change: &Option<EventHandler<AddMenuState>>,
) {
    if let Some(handler) = on_value_change.as_ref() {
        let next = state_with_picked_field(state, field);
        if next != *state {
            handler.call(next);
        }
    }
    if let Some(handler) = on_add_menu_change.as_ref() {
        handler.call(AddMenuState::default());
    }
}

/// The trailing add row: the ONE growth verb, parked in the operator column.
fn add_row(props: &FilterPanelProps) -> VNode {
    let menu_label = t("components.hk.filterPanel.addCondition", "Add condition");
    let state = AddMenuState {
        open: props.add_menu_open,
        highlight: props.add_highlight,
    };
    let field_count = props.fields.len();
    let disabled = props.disabled;

    let click_menu = props.on_add_menu_change.clone();
    let key_menu = props.on_add_menu_change.clone();
    let key_value = props.on_value_change.clone();
    let fields = props.fields.clone();
    let values = props.model_value.clone();

    let mut add = VElement::new("button")
        .class("hk-filter-panel-add")
        .attr("type", "button")
        .attr("aria-haspopup", "menu")
        .attr(
            "aria-expanded",
            if props.add_menu_open { "true" } else { "false" },
        )
        .attr(
            "data-state",
            if props.add_menu_open {
                "open"
            } else {
                "closed"
            },
        )
        .on_click(move |_event: MouseEvent| {
            if let Some(handler) = click_menu.as_ref() {
                handler.call(if state.open {
                    AddMenuState::default()
                } else {
                    add_menu_opened(field_count)
                });
            }
        })
        .on_keydown(move |event: KeyboardEvent| {
            if disabled {
                return;
            }
            let transition = add_menu_key(state, event.key.as_str(), field_count);
            if !transition.prevent_default {
                return;
            }
            event.prevent_default();
            if transition.stop_propagation {
                event.stop_propagation();
            }
            if let Some(index) = transition.pick
                && let Some(field) = fields.get(index)
            {
                commit_field_pick(&values, field, &key_value, &key_menu);
                return;
            }
            if let Some(handler) = key_menu.as_ref() {
                handler.call(transition.state);
            }
        })
        .child(glyph_host(PLUS_GLYPH_SVG))
        .child(rsx! {
            span { "{menu_label}" }
        });
    if props.disabled {
        add = add.attr("disabled", "");
    }

    VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-filter-panel-addrow")
            .child(VNode::Element(Box::new(add))),
    ))
}

/// The field chooser: an absolutely positioned layer listing EVERY declared
/// field (the same column may join repeatedly).
fn add_menu_layer(props: &FilterPanelProps) -> VNode {
    let choose_label = t(
        "components.hk.filterPanel.chooseField",
        "Choose a field to add",
    );
    let mut list = VElement::new("div")
        .class("hk-filter-add-list")
        .attr("role", "menu")
        .attr("aria-label", choose_label);

    for (index, field) in props.fields.iter().enumerate() {
        let highlighted = props.add_highlight == index as i32;
        let picked = field.clone();
        let values = props.model_value.clone();
        let click_value = props.on_value_change.clone();
        let click_menu = props.on_add_menu_change.clone();
        let hover_menu = props.on_add_menu_change.clone();

        let mut item = VElement::new("button")
            .class("hk-filter-add-item")
            .attr("type", "button")
            .attr("role", "menuitem")
            .attr("data-kind", field.kind.token())
            .attr("data-add-index", index.to_string())
            // Vue's `data-highlighted={addHighlight === i || undefined}` — a
            // PRESENCE attribute, so unhighlighted rows carry none at all.
            .on_click(move |_event: MouseEvent| {
                commit_field_pick(&values, &picked, &click_value, &click_menu);
            })
            .on_pointerenter(move |_event: PointerEvent| {
                if let Some(handler) = hover_menu.as_ref() {
                    handler.call(AddMenuState {
                        open: true,
                        highlight: index as i32,
                    });
                }
            })
            .child(rsx! {
                span { class: "hk-filter-add-item-label", {VNode::Text(VText::new(field.label.as_str()))} }
            });
        if highlighted {
            item = item.attr("data-highlighted", "");
        }
        if props.disabled {
            item = item.attr("disabled", "");
        }
        list = list.child(VNode::Element(Box::new(item)));
    }

    VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-filter-add-content")
            .style(add_menu_layer_style())
            .child(VNode::Element(Box::new(list))),
    ))
}

impl StyledComponent for FilterPanelComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-filter-panel*` / `.hk-filter-add*` names literal so this CSS
        // matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkFilterPanel.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "filter-panel"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn text_field(key: &str) -> FilterFieldDef {
        FilterFieldDef {
            key: key.to_string(),
            label: key.to_uppercase(),
            kind: FilterFieldKind::Text,
            ..Default::default()
        }
    }

    fn select_field(key: &str, values: &[&str]) -> FilterFieldDef {
        FilterFieldDef {
            key: key.to_string(),
            label: key.to_uppercase(),
            kind: FilterFieldKind::Select,
            options: values
                .iter()
                .map(|value| FilterOption {
                    value: value.to_string(),
                    label: value.to_uppercase(),
                })
                .collect(),
            ..Default::default()
        }
    }

    fn cond(key: &str, op: FilterOperator, value: &str) -> FilterCondition {
        FilterCondition {
            key: key.to_string(),
            op,
            value: value.to_string(),
        }
    }

    #[test]
    fn filter_panel_defaults_match_the_vue_props() {
        let props = FilterPanelProps::default();
        assert!(props.fields.is_empty());
        assert!(props.model_value.is_empty());
        assert!(!props.disabled);
        assert_eq!(props.label, None);
        // Vue's local refs, mirrored as controlled props.
        assert!(!props.add_menu_open);
        assert_eq!(props.add_highlight, -1);
        assert_eq!(props.open_row, None);
        assert!(props.on_value_change.is_none());
        assert!(props.on_add_menu_change.is_none());
        assert!(props.on_open_row_change.is_none());
        // A page starts with NO conditions — the default list is always empty.
        assert_eq!(active_condition_count(&props.model_value), 0);
    }

    #[test]
    fn filter_panel_operator_sets_match_the_kind_table() {
        // Vue: DEFAULT_OPERATORS — text speaks the fuzzy pair only.
        assert_eq!(
            default_operators(FilterFieldKind::Text),
            &[FilterOperator::Approx, FilterOperator::Napprox]
        );
        assert_eq!(
            default_operators(FilterFieldKind::Number),
            &[
                FilterOperator::Lt,
                FilterOperator::Lte,
                FilterOperator::Eq,
                FilterOperator::Gte,
                FilterOperator::Gt
            ]
        );
        assert_eq!(
            default_operators(FilterFieldKind::Select),
            &[FilterOperator::Eq, FilterOperator::Ne]
        );
        assert_eq!(
            default_operators(FilterFieldKind::Date),
            &[FilterOperator::Gte, FilterOperator::Lte]
        );

        // An explicit override wins; an explicit EMPTY list stays empty.
        let mut field = text_field("name");
        field.operators = Some(vec![FilterOperator::Gt]);
        assert_eq!(operators_for(&field), vec![FilterOperator::Gt]);
        field.operators = Some(Vec::new());
        assert!(operators_for(&field).is_empty());
    }

    #[test]
    fn filter_panel_operator_tokens_and_labels_match_vue() {
        assert_eq!(FilterOperator::Eq.token(), "eq");
        assert_eq!(FilterOperator::Napprox.token(), "napprox");
        assert_eq!(FilterOperator::Gt.token(), "gt");
        for operator in FILTER_OPERATORS {
            assert_eq!(FilterOperator::from_token(operator.token()), Some(operator));
            assert!(
                operator
                    .label_key()
                    .starts_with("components.hk.filterPanel.op.")
            );
            assert!(!operator.label_fallback().is_empty());
        }
        assert_eq!(FilterOperator::from_token("nope"), None);
        assert_eq!(FilterFieldKind::Number.token(), "number");
        assert_eq!(
            FilterFieldKind::from_token("date"),
            Some(FilterFieldKind::Date)
        );
        assert_eq!(FilterFieldKind::from_token("bool"), None);
    }

    #[test]
    fn filter_panel_glyph_operator_maps_select_equals_to_the_fuzzy_pair() {
        // Vue: glyphOpFor — select renders ≈/≉ for eq/ne; a number's exact =
        // keeps the plain equals glyph inside the ordered five.
        assert_eq!(
            glyph_operator(FilterFieldKind::Select, FilterOperator::Eq),
            FilterOperator::Approx
        );
        assert_eq!(
            glyph_operator(FilterFieldKind::Select, FilterOperator::Ne),
            FilterOperator::Napprox
        );
        assert_eq!(
            glyph_operator(FilterFieldKind::Number, FilterOperator::Eq),
            FilterOperator::Eq
        );
        assert_eq!(
            glyph_operator(FilterFieldKind::Text, FilterOperator::Napprox),
            FilterOperator::Napprox
        );
    }

    #[test]
    fn filter_panel_sanitize_number_input_keeps_intermediate_fragments() {
        assert_eq!(sanitize_number_input("12a3"), "123");
        assert_eq!(sanitize_number_input("-12.5"), "-12.5");
        assert_eq!(sanitize_number_input("1.2.3"), "1.23");
        assert_eq!(sanitize_number_input("1-2-3"), "123");
        assert_eq!(sanitize_number_input("-1-2"), "-12");
        // The intermediate fragments survive on purpose.
        assert_eq!(sanitize_number_input("-"), "-");
        assert_eq!(sanitize_number_input("."), ".");
        assert_eq!(sanitize_number_input("-."), "-.");
        assert_eq!(sanitize_number_input("abc"), "");
    }

    #[test]
    fn filter_panel_condition_matching_follows_the_vue_semantics() {
        let contains = cond("name", FilterOperator::Approx, "香蕉");
        // Case-insensitive for the fuzzy pair.
        assert!(condition_matches(
            &contains,
            FilterFieldKind::Text,
            "香蕉牛奶"
        ));
        assert!(!condition_matches(
            &contains,
            FilterFieldKind::Text,
            "苹果牛奶"
        ));
        let not_contains = cond("name", FilterOperator::Napprox, "香蕉");
        assert!(condition_matches(
            &not_contains,
            FilterFieldKind::Text,
            "苹果牛奶"
        ));
        assert!(!condition_matches(
            &not_contains,
            FilterFieldKind::Text,
            "香蕉牛奶"
        ));

        // Exact equality: caseless for text, numeric for numbers.
        let equals = cond("name", FilterOperator::Eq, "Milk");
        assert!(condition_matches(&equals, FilterFieldKind::Text, "milk"));
        assert!(!condition_matches(&equals, FilterFieldKind::Text, "milky"));
        let numeric = cond("count", FilterOperator::Eq, "10");
        assert!(condition_matches(&numeric, FilterFieldKind::Number, "10"));
        assert!(condition_matches(&numeric, FilterFieldKind::Number, "10.0"));
        assert!(!condition_matches(&numeric, FilterFieldKind::Number, "ten"));
        // ≠ is the negation of =.
        let not_equals = cond("count", FilterOperator::Ne, "10");
        assert!(!condition_matches(
            &not_equals,
            FilterFieldKind::Number,
            "10"
        ));
        assert!(condition_matches(
            &not_equals,
            FilterFieldKind::Number,
            "11"
        ));

        // The ordered four coerce and are false on non-numbers.
        assert!(condition_matches(
            &cond("count", FilterOperator::Lt, "50"),
            FilterFieldKind::Number,
            "10"
        ));
        assert!(condition_matches(
            &cond("count", FilterOperator::Lte, "10"),
            FilterFieldKind::Number,
            "10"
        ));
        assert!(condition_matches(
            &cond("count", FilterOperator::Gte, "10"),
            FilterFieldKind::Number,
            "10"
        ));
        assert!(condition_matches(
            &cond("count", FilterOperator::Gt, "9"),
            FilterFieldKind::Number,
            "10"
        ));
        assert!(!condition_matches(
            &cond("count", FilterOperator::Gt, "50"),
            FilterFieldKind::Number,
            "10"
        ));
        assert!(!condition_matches(
            &cond("count", FilterOperator::Gt, "50"),
            FilterFieldKind::Number,
            "ten"
        ));
    }

    #[test]
    fn filter_panel_field_matching_or_combines_the_match_class() {
        let text = FilterFieldKind::Text;
        // Two fuzzy conditions OR together: either fruit passes.
        let either = vec![
            cond("name", FilterOperator::Approx, "香蕉"),
            cond("name", FilterOperator::Approx, "苹果"),
        ];
        assert!(field_matches(text, &either, "香蕉牛奶"));
        assert!(field_matches(text, &either, "苹果醋"));
        assert!(!field_matches(text, &either, "葡萄汁"));

        // A band (≥10 AND ≤50) restricts the range — ordered ops are AND.
        let number = FilterFieldKind::Number;
        let band = vec![
            cond("count", FilterOperator::Gte, "10"),
            cond("count", FilterOperator::Lte, "50"),
        ];
        assert!(field_matches(number, &band, "10"));
        assert!(field_matches(number, &band, "50"));
        assert!(!field_matches(number, &band, "9"));
        assert!(!field_matches(number, &band, "51"));

        // Empty values filter nothing; an empty list matches everything.
        assert!(field_matches(text, &[], "anything"));
        assert!(field_matches(
            text,
            &[cond("name", FilterOperator::Approx, "")],
            "anything"
        ));

        // A select's equals joins the OR class; an exclusion stays AND.
        let select = FilterFieldKind::Select;
        let any_of = vec![
            cond("provider", FilterOperator::Eq, "openai"),
            cond("provider", FilterOperator::Eq, "deepseek"),
        ];
        assert!(field_matches(select, &any_of, "DeepSeek"));
        assert!(!field_matches(select, &any_of, "anthropic"));
        let excluded = vec![
            cond("provider", FilterOperator::Eq, "openai"),
            cond("provider", FilterOperator::Eq, "deepseek"),
            cond("provider", FilterOperator::Ne, "demo"),
        ];
        assert!(field_matches(select, &excluded, "openai"));
        assert!(!field_matches(select, &excluded, "demo"));
    }

    #[test]
    fn filter_panel_active_count_ignores_empty_values() {
        let state = vec![
            cond("a", FilterOperator::Approx, "x"),
            cond("b", FilterOperator::Eq, ""),
            cond("c", FilterOperator::Gt, "3"),
        ];
        assert_eq!(active_condition_count(&state), 2);
        assert_eq!(active_condition_count(&Vec::new()), 0);
    }

    #[test]
    fn filter_panel_select_options_prepend_the_all_row_once() {
        let field = select_field("provider", &["openai", "deepseek"]);
        let options = select_options_for(&field);
        assert_eq!(options.len(), 3);
        assert_eq!(options[0].value, "");
        assert_eq!(options[1].value, "openai");
        // A page that already ships its own empty row keeps it (no duplicate).
        let mut own = select_field("provider", &["", "openai"]);
        own.options[0].label = "All providers".to_string();
        let options = select_options_for(&own);
        assert_eq!(options.len(), 2);
        assert_eq!(options[0].label, "All providers");
    }

    #[test]
    fn filter_panel_pick_addable_refuses_a_duplicate_empty_row() {
        let field = text_field("name");
        // The candidate takes the field's FIRST operator.
        let picked = pick_addable(&Vec::new(), &field).expect("first pick materializes a row");
        assert_eq!(picked.op, FilterOperator::Approx);
        assert_eq!(picked.value, "");
        // Re-picking the same field while the identical empty row sits there
        // adds nothing.
        assert_eq!(pick_addable(&vec![picked.clone()], &field), None);
        assert_eq!(state_with_picked_field(&vec![picked], &field).len(), 1);
        // A valued row does not block a fresh empty one.
        let valued = vec![cond("name", FilterOperator::Approx, "香蕉")];
        assert!(pick_addable(&valued, &field).is_some());
        assert_eq!(state_with_picked_field(&valued, &field).len(), 2);
        // A field with NO operators cannot be picked at all.
        let mut bare = text_field("name");
        bare.operators = Some(Vec::new());
        assert_eq!(pick_addable(&Vec::new(), &bare), None);
    }

    #[test]
    fn filter_panel_add_menu_keyboard_machine_matches_vue() {
        let closed = AddMenuState::default();
        // ArrowDown on a closed menu opens it on the first field.
        let opened = add_menu_key(closed, "ArrowDown", 3);
        assert_eq!(
            opened.state,
            AddMenuState {
                open: true,
                highlight: 0
            }
        );
        assert!(opened.prevent_default);
        assert_eq!(opened.pick, None);

        // Arrows wrap around the declared list.
        let second = add_menu_key(opened.state, "ArrowDown", 3);
        assert_eq!(second.state.highlight, 1);
        let wrapped = add_menu_key(
            AddMenuState {
                open: true,
                highlight: 2,
            },
            "ArrowDown",
            3,
        );
        assert_eq!(wrapped.state.highlight, 0);
        let backwards = add_menu_key(
            AddMenuState {
                open: true,
                highlight: 0,
            },
            "ArrowUp",
            3,
        );
        assert_eq!(backwards.state.highlight, 2);

        // Enter/Space confirm the highlight and close the menu.
        let confirmed = add_menu_key(
            AddMenuState {
                open: true,
                highlight: 1,
            },
            "Enter",
            3,
        );
        assert_eq!(confirmed.pick, Some(1));
        assert_eq!(confirmed.state, AddMenuState::default());
        assert!(confirmed.prevent_default);
        let space = add_menu_key(
            AddMenuState {
                open: true,
                highlight: 2,
            },
            " ",
            3,
        );
        assert_eq!(space.pick, Some(2));

        // Escape closes ONE layer: it consumes the key AND stops the bubble.
        let escaped = add_menu_key(
            AddMenuState {
                open: true,
                highlight: 1,
            },
            "Escape",
            3,
        );
        assert_eq!(escaped.state, AddMenuState::default());
        assert!(escaped.prevent_default);
        assert!(escaped.stop_propagation);

        // An unhandled key, and Enter/Space/Escape on a CLOSED menu, fall
        // through to the native button activation.
        for (key, state) in [
            ("Enter", closed),
            (" ", closed),
            ("Escape", closed),
            (
                "Tab",
                AddMenuState {
                    open: true,
                    highlight: 0,
                },
            ),
        ] {
            let transition = add_menu_key(state, key, 3);
            assert!(!transition.prevent_default, "{key} must not be consumed");
            assert_eq!(transition.pick, None);
            assert_eq!(transition.state, state);
        }
    }

    #[test]
    fn filter_panel_add_menu_reconcile_closes_and_clamps() {
        // A closed chooser is untouched.
        assert_eq!(
            add_menu_reconciled(
                AddMenuState {
                    open: false,
                    highlight: 2
                },
                1
            ),
            AddMenuState {
                open: false,
                highlight: 2
            }
        );
        // An empty declared-fields list closes the menu.
        assert_eq!(
            add_menu_reconciled(
                AddMenuState {
                    open: true,
                    highlight: 0
                },
                0
            ),
            AddMenuState::default()
        );
        // An out-of-range highlight clamps to the last row.
        assert_eq!(
            add_menu_reconciled(
                AddMenuState {
                    open: true,
                    highlight: 4
                },
                2
            ),
            AddMenuState {
                open: true,
                highlight: 1
            }
        );
        // An in-range highlight survives.
        assert_eq!(
            add_menu_reconciled(
                AddMenuState {
                    open: true,
                    highlight: 1
                },
                2
            ),
            AddMenuState {
                open: true,
                highlight: 1
            }
        );
        // Opening seeds the first row, and `-1` when nothing is declared.
        assert_eq!(add_menu_opened(2).highlight, 0);
        assert_eq!(
            add_menu_opened(0),
            AddMenuState {
                open: true,
                highlight: -1
            }
        );
    }

    #[test]
    fn filter_panel_state_patches_are_index_targeted() {
        let state = vec![
            cond("name", FilterOperator::Approx, "香蕉"),
            cond("name", FilterOperator::Approx, "苹果"),
        ];
        // Valuing one row leaves the sibling alone.
        let valued = condition_with_value(&state, 1, "葡萄".to_string());
        assert_eq!(valued[0].value, "香蕉");
        assert_eq!(valued[1].value, "葡萄");
        // Same for the operator.
        let retargeted = condition_with_operator(&state, 0, FilterOperator::Napprox);
        assert_eq!(retargeted[0].op, FilterOperator::Napprox);
        assert_eq!(retargeted[1].op, FilterOperator::Approx);
        // Removal is index-targeted, never key-targeted.
        let removed = condition_removed(&state, 0);
        assert_eq!(removed.len(), 1);
        assert_eq!(removed[0].value, "苹果");
        // An out-of-range index is a no-op on values, a full-length no-op on
        // removal.
        assert_eq!(condition_with_value(&state, 9, "x".to_string()), state);
        assert_eq!(condition_removed(&state, 9).len(), state.len());
    }

    #[test]
    fn filter_panel_popup_geometry_anchors_to_the_trigger() {
        let style = filter_popup_layer_style(PopoverPlacement::BottomStart, 6.0);
        assert!(style.contains("position:absolute"));
        assert!(style.contains("top:calc(100% + 6px)"));
        assert!(style.contains("left:0"));
        // The centre arm pulls the panel back by a percentage (no width needed).
        let centered = filter_popup_layer_style(PopoverPlacement::Bottom, 6.0);
        assert!(centered.contains("left:50%"));
        assert!(centered.contains("translateX(-50%)"));
        // The end arm anchors the far edge.
        let end = filter_popup_layer_style(PopoverPlacement::TopEnd, 4.0);
        assert!(end.contains("bottom:calc(100% + 4px)"));
        assert!(end.contains("right:0"));
        // Side placements sit beside the anchor.
        let left = filter_popup_layer_style(PopoverPlacement::LeftStart, 6.0);
        assert!(left.contains("right:calc(100% + 6px)"));
        assert!(left.contains("top:0"));
        // The chooser layer rides over the rows.
        assert!(add_menu_layer_style().contains("position:absolute"));
    }

    #[test]
    fn filter_panel_styles_come_from_the_canonical_vue_sheet() {
        let css = FilterPanelComponent::styles();
        for class in [
            ".hk-filter-panel",
            ".hk-filter-panel-row",
            ".hk-filter-panel-field",
            ".hk-filter-panel-ops",
            ".hk-filter-panel-op",
            ".hk-filter-panel-value",
            ".hk-filter-panel-control",
            ".hk-filter-panel-remove",
            ".hk-filter-panel-add",
            ".hk-filter-panel-addrow",
            ".hk-filter-add-content",
            ".hk-filter-add-list",
            ".hk-filter-add-item",
        ] {
            assert!(
                css.contains(class),
                "filter-panel css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored filter-panel sheet"
        );
        // The one-grid anatomy the 2026-10-12 direction pinned.
        assert!(css.contains("display: grid"), "{css}");
        assert!(css.contains("display: contents"), "{css}");
    }

    #[test]
    fn filter_panel_render_contract() {
        let fields = vec![text_field("name"), select_field("provider", &["openai"])];
        let state = vec![
            cond("name", FilterOperator::Approx, "香蕉"),
            cond("provider", FilterOperator::Eq, ""),
        ];
        let html = FilterPanel(FilterPanelProps {
            fields,
            model_value: state,
            label: Some("Ledger filters".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The panel root: test id, label, active marker (one valued row).
            "class=\"hk-filter-panel\"",
            "data-testid=\"hk-filter-panel\"",
            "aria-label=\"Ledger filters\"",
            "data-active",
            // Two rows, typed by their field's kind.
            "hk-filter-panel-row",
            "data-kind=\"text\"",
            "data-kind=\"select\"",
            // The operator column is a labelled group of toggle buttons.
            "hk-filter-panel-ops",
            "role=\"group\"",
            "hk-filter-panel-op",
            "aria-pressed=\"true\"",
            // The value cell embeds the mirrored controls.
            "hk-filter-panel-value",
            "hk-filter-panel-control",
            "hk-filter-panel-remove",
            // The growth verb + its glyph host.
            "hk-filter-panel-addrow",
            "hk-filter-panel-add",
            "aria-haspopup=\"menu\"",
            "aria-expanded=\"false\"",
            "display:contents",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The empty-value condition still owns a row (rows ARE the state).
        assert_eq!(html.matches("hk-filter-panel-row").count(), 2, "{html}");
        // The chooser is closed: none of its layer renders.
        assert!(!html.contains("hk-filter-add-content"), "{html}");
        assert!(!html.contains("hk-filter-add-item"), "{html}");
    }

    #[test]
    fn filter_panel_render_marks_the_empty_panel_and_opens_the_chooser() {
        let html = FilterPanel(FilterPanelProps {
            fields: vec![text_field("name")],
            add_menu_open: true,
            add_highlight: 0,
            ..Default::default()
        })
        .render_to_html();
        // No rows yet: the empty marker collapses the panel to the add verb.
        assert!(html.contains("data-empty"), "{html}");
        assert!(!html.contains("hk-filter-panel-row"), "{html}");
        // The chooser is the panel's SIBLING layer, absolutely positioned.
        assert!(html.contains("hk-filter-add-content"), "{html}");
        assert!(html.contains("position:absolute"), "{html}");
        assert!(html.contains("role=\"menu\""), "{html}");
        assert!(html.contains("hk-filter-add-item"), "{html}");
        assert!(html.contains("data-highlighted"), "{html}");
        assert!(html.contains("data-kind=\"text\""), "{html}");
        // Open-state disclosure on the add verb.
        assert!(html.contains("data-state=\"open\""), "{html}");
        assert!(html.contains("aria-expanded=\"true\""), "{html}");
    }

    #[test]
    fn filter_panel_render_keeps_undeclared_keys_as_inert_rows() {
        let html = FilterPanel(FilterPanelProps {
            fields: vec![text_field("name")],
            model_value: vec![cond("legacy_key", FilterOperator::Approx, "x")],
            ..Default::default()
        })
        .render_to_html();
        // The row names the raw key and cannot change its operator or value.
        assert!(html.contains("legacy_key"), "{html}");
        assert!(html.contains("disabled"), "{html}");
        // The undeclared key offers only its current operator (the trailing
        // quote pins the button's own class, not the plural GROUP class).
        assert_eq!(html.matches("hk-filter-panel-op\"").count(), 1, "{html}");
    }
}
