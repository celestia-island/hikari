// hi-components/src/layout/affix_picker.rs
// AffixPicker — mirror of the canonical Vue `HkAffixPicker`: the standardized
// "affix chip + searchable popup list" control. The chip rides the prefix (left)
// or suffix (right) slot of a host field (`Input`'s `prefix` / `suffix`), and one
// canonical popup carries the pinned search head and the option rows.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAffixPicker.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-affix-*` class names are literal and
// identical in both forms. The sheet styles the CHIP and the popup CONTENT; the
// popup's canvas is HkSelectPanel's (`.hk-select-popout-host` /
// `.hk-select-popout` / `.hk-select-popout-pinned` / `.hk-select-popout-body*`,
// painted by the mirrored `HkSelect.scss` that `basic/select.rs` compiles) — the
// same split the Vue component ships, since it mounts `HkMenu`.
//
// TWO CONTENT BANDS (Vue: HkSelectPanel's `default` slot SCROLLS, its
// `pinnedHeader` slot does not). The head — the search field, plus the selected
// TAG LIST in the tag layout — rides the pinned band on both form factors, so a
// long catalog scrolls UNDER it instead of taking it along (2026-11-27 user
// report, phone: "the search box scrolls away with the list"). The rows stay in
// the scrolling default slot. The mirror passes the head as
// `SelectPanelProps::pinned_header`, so the band's DOM is HkSelectPanel's, not
// this file's.
//
// DOM contract:
//
//   ── the chip (Vue: `button.hk-affix-chip`) ──
//   button.hk-affix-chip [chipClass]
//       type="button" [disabled] aria-haspopup="menu"
//       aria-expanded={true|false} [aria-label] [title]
//     ── the host's `chip` element, else the default content ──
//     span.hk-affix-chip-label {label}
//     span[style="display:contents"] > <chevron-down 12 class=hk-affix-chip-caret>
//   ── the popup, while open (HkMenu + HkSelectPanel) ──
//   div.hk-select-popout-host data-side="bottom" data-align={start|end}
//       (style: inline geometry)
//     div.hk-select-popout.is-pinned-header [aria-label={title}]
//         (style: --hk-select-panel-max-height:min(18rem, 45dvh))
//       div.hk-select-popout-pinned                     ← THE PINNED HEAD
//         div.hk-affix-head
//           div.hk-affix-tags role="group" [aria-label] (TAG LAYOUT only, tags present)
//             div.hk-affix-tag-list
//               div.hk-affix-tag [data-active]
//                 button.hk-affix-tag-body type="button" title [aria-label]
//                   span.hk-affix-tag-flag [aria-hidden] {flag}
//                   span.hk-affix-tag-text [data-unset] {value|unset|label}
//                   span.hk-affix-tag-meta {meta}
//                   span.hk-affix-tag-dot [aria-hidden]      (active tag)
//                 button.hk-affix-tag-x type="button" aria-label title
//                   span[style="display:contents"] > <x 11>
//           div.hk-affix-search role="search"           (searchable)
//             <the mirrored `Input`, size sm, search glyph prefix>
//       div.hk-select-popout-body-host
//         div.hk-select-popout-body                    ← THE scroll region
//           ── rows present (or the custom row visible) ──
//           div.hk-affix-scroll                         (width container only)
//             div.hk-affix-list
//               button.hk-affix-row [data-active] [data-checked] [data-disabled]
//                   [aria-pressed={true|false}]         (rows layout only)
//                 span.hk-affix-check [data-on] aria-hidden  (rows layout only;
//                     <check 12> only while checked)
//                 span.hk-affix-row-flag [aria-hidden] {flag}
//                 span.hk-affix-row-label {label}
//                 span.hk-affix-row-meta {meta}
//               div.hk-affix-divider role="separator"
//                   aria-orientation="horizontal"       (rows layout, both groups)
//               button.hk-affix-row data-custom="true"  (the "Use <q>" row)
//           ── nothing to show ──
//           div.hk-affix-empty {emptyText}
//
// THE TWO LAYOUTS (Vue's `layout` prop, `rows` by default; no effect in single
// mode — see [`AffixLayout`]):
//   * `rows` — every option stays a ROW. Selected rows come FIRST in catalog
//     order (and the rest keep catalog order — a check floats a row to the end
//     of the selected run, unchecking returns it to its catalog slot, nothing
//     else ever reorders), `div.hk-affix-divider` separates them only while BOTH
//     groups are non-empty AFTER filtering, and a tap TOGGLES: unchecked →
//     `select`, checked → `remove` (no confirm dialog — `confirm_remove` guards
//     erasing a typed VALUE through the tag ×, not a one-tap reversible check).
//     No `.hk-affix-tag*` node exists in this layout.
//   * `tags` — the value-editor shape (`HkLocalizedInput` passes it): the
//     selected keys render as the pinned TAG LIST above the search, and the rows
//     list only the NOT-yet-selected options; the × keeps the two-step confirm.
//   * single — the pinned head is the search only (no tag list); rows are
//     unchanged and carry NO check cell; `data-active` marks the current value.
//
// Vue prop mapping: `options` → [`AffixPickerProps::options`]
// ([`AffixOption`]), `mode` → [`AffixMode`], `layout` → [`AffixLayout`],
// `selected` (Vue: `string | string[]`) → the [`AffixPickerProps::selected`] key
// list (`Vec<String>`, so both Vue shapes are one field: empty = nothing
// selected), `activeKey` → `active_key`, `side` → [`AffixSide`], `searchable`,
// `allowCustom` → `allow_custom`, `confirmRemove` → `confirm_remove`, `tagValues`
// → `tag_values`, `tagUnsetText` → `tag_unset_text`, `closeOnSelect` →
// `close_on_select`, `disabled`, `title` / `searchPlaceholder` / `emptyText` →
// `title` / `search_placeholder` / `empty_text`, `chipClass` → `chip_class`,
// `chipLabel` → `chip_label`, and the scoped `chip` slot → the plain
// [`AffixPickerProps::chip`] element. Emits: `select` → `on_select`, `remove` →
// `on_remove`, `custom` → `on_custom`, `update:open` → `on_open_change`. Vue's
// internal `open` / `query` refs are the CONTROLLED
// [`AffixPickerProps::open`] / [`AffixPickerProps::query`] plus their
// `on_open_change` / `on_query_change` writers — tairitsu 0.5.22 has no
// per-instance component state (`use_signal` allocates a fresh signal per
// render, `use_state` shares ONE slot per component type), so the host owns both
// values exactly as it owns the selection. Nothing is stored in the component.
//
// Pure surface (tested without a DOM): [`affix_is_subsequence`],
// [`affix_filter_rows`], [`affix_exact_label_match`],
// [`affix_custom_visible`], [`affix_tag_entries`],
// [`affix_resolved_close_on_select`], [`affix_selected_count_label`],
// [`affix_tag_value`], [`affix_enter_action`], [`affix_row_checked`],
// [`affix_row_toggle_removes`], [`affix_selected_run_length`],
// [`affix_divider_visible`], [`affix_row_sequence`] and [`affix_popup_style`].
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `<Teleport>`, no popup-manager z-band, no mobile sheet, no auto-flip
//     and no outside-click close: the popup renders in place with inline
//     geometry (`affix_popup_style`) — the DESKTOP POPOUT shape of both form
//     factors, so the pinned head is always the popout's
//     `.hk-select-popout-pinned` band (a phone-width host never gets Vue's
//     `.hk-select-sheet-pinned`). With an `anchor` rect the chip is the anchor
//     exactly like `basic/select.rs`; without one the surface pins to the
//     nearest positioned ancestor — and because the natural mount is an affix
//     slot inside the field, that ancestor is the field's `.hk-input-box`
//     (`position: relative`), so the popup lands under the field. ONE SCROLLBAR
//     PER WINDOW is preserved and sharpened: `.hk-affix-scroll` / `.hk-affix-list`
//     stay scroll-free and the ONLY scroll region is `.hk-select-popout-body`
//     under the pinned head, capped through `--hk-select-panel-max-height`
//     (`min(18rem, 45dvh)`, Vue's `maxHeight` — a popout measure; the phone
//     sheet's own family ceiling never applies here).
//   * NO `HkMessageBox` CONFIRM: Vue's tag × opens the shared confirm dialog and
//     only its Confirm emits `remove` (the popup deliberately stays open behind
//     it). A global dialog service has no tairitsu analogue in this wave, so the
//     × ALWAYS emits the request edge — `on_remove_request` while
//     `confirm_remove` is true (the host runs its own guard, exactly what Vue's
//     `confirmRemove={false}` delegates), and `on_remove` directly when the host
//     opted out. `confirmHeld` (swallow-close-while-our-dialog-is-up) has nothing
//     to guard, and the dialog's own copy (`removeConfirmTitle` /
//     `removeConfirm`) is the host's. The rows layout's row toggle bypasses
//     the gate entirely, exactly like Vue (it emits `remove` directly).
//   * NO `HkListTransition`: the rows layout's FLIP move (a checked row gliding
//     to the front behind the divider) and the tag list's reveal choreography are
//     Vue-only. The DOM shape is the same — the divider is a SIBLING between the
//     selected run and the rest, inside the keyed list — but a host that wants
//     motion runs the list through `display/list_transition.rs` itself.
//   * NO `isComposing` GUARD: `KeyboardEvent` carries no composition flag, so an
//     Enter pressed mid-IME-composition is handled like any other (the same
//     trade `basic/tag_input.rs` documents).
//   * NO FOCUS MOVE: Vue keeps the chip press from stealing focus
//     (`onMousedown preventDefault`) and cannot refocus the search field here.
//   * The chip's `open` slot scope is not published: the host already passes
//     `open`, and the mirror takes the slot content as one `chip` element.
//   * NO `.hk-menu-slot` BAND WRAPPER: HkMenu wraps its header slot in
//     `div.hk-menu-slot.hk-menu-slot--head`. That wrapper goes with the menu
//     itself (it is a hook with no vendored sheet and no rule of its own in the
//     affix sheet), so the popup content is Vue's `.hk-affix-head` inside the
//     panel's pinned band, verbatim.
//   * The `badge` capsule is not rendered: [`AffixOption`] has no badge field,
//     so Vue's `span.hk-affix-row-badge` / `.hk-affix-tag-badge` (an `HBadge`)
//     never appears. `flag` stays the emoji slot.
//   * The glyphs (chevron-down 12, search 13, x 11, plus 13, check 12) are
//     lucide `lucide-vue-next` nodes rendered through `dangerous_inner_html` on
//     `display:contents` hosts (`rsx!`'s `svg {}` lands in the HTML namespace in
//     this host stack). Markup, 24-unit viewBox, stroke attributes, the
//     `lucide lucide-{name}-icon lucide-{name}` class pair and the automatic
//     `aria-hidden="true"` are the library's own output; the Vue source's `size`
//     becomes the width/height pair.
//   * Every user-visible string resolves through `hikari_i18n` with Vue's own
//     English fallbacks; Vue's `interpolate` helper becomes
//     [`affix_selected_count_label`] (and an inline `{query}` replace for the
//     custom row).

use std::collections::HashMap;

use hikari_i18n::t;

use crate::basic::select::{SelectPanelPlacement, select_popout_style};
use crate::basic::{Input, InputSize};
use crate::feedback::popover::PopoverAnchorRect;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AffixPickerComponent;

/// One pickable entry of the picker's searchable list (Vue: `HkAffixOption`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AffixOption {
    /// Stable identity — the value emitted back to the host.
    pub key: String,

    /// Primary row/tag text (country name, platform, autonym…).
    pub label: String,

    /// Secondary muted text (dial code, locale code, domain…).
    pub meta: Option<String>,

    /// Optional leading glyph (flag emoji or any short symbol).
    pub flag: Option<String>,

    /// Extra haystack for the search filter (aliases, codes, digits).
    pub keywords: Option<String>,

    /// Disabled rows render but cannot be picked.
    pub disabled: bool,
}

/// Vue's `mode`: `single` closes on pick and shows the active mark on the
/// selected row; `multi` keeps the popup open for batch toggles.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AffixMode {
    #[default]
    Single,
    Multi,
}

/// Vue's `layout` (default `Rows`) — how a MULTI picker presents its selection.
/// No effect in single mode ([`AffixLayout::tag_layout`] gates every branch).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AffixLayout {
    /// Every option stays a row: checked rows wear the leading check, float to
    /// the top in catalog order behind a divider, and a tap toggles them.
    #[default]
    Rows,
    /// The value-editor shape (`HkLocalizedInput`): selected keys as the pinned
    /// tag list above the search; rows list only the remaining options.
    Tags,
}

/// Which affix edge the chip rides — it steers the popup's anchor alignment
/// only (`bottom-start` vs `bottom-end`), never the chip's own visuals.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AffixSide {
    #[default]
    Prefix,
    Suffix,
}

impl AffixSide {
    /// The popup placement this side resolves to (Vue: `side === "suffix" ?
    /// "bottom-end" : "bottom-start"`).
    pub fn placement(self) -> SelectPanelPlacement {
        match self {
            AffixSide::Prefix => SelectPanelPlacement::BottomStart,
            AffixSide::Suffix => SelectPanelPlacement::BottomEnd,
        }
    }

    /// The popout host's `data-align` token.
    pub fn align_token(self) -> &'static str {
        match self {
            AffixSide::Prefix => "start",
            AffixSide::Suffix => "end",
        }
    }
}

/// What the search field's Enter resolved to (Vue: `onSearchEnter`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AffixEnterAction {
    /// Pick the row at this index of the rendered (already ranked) rows —
    /// `0` for the plain top match, a later index when the rows layout
    /// skips past its selected-first run (2026-11-27 R6 guard).
    PickRow(usize),
    /// Fire the custom row with the typed query.
    UseCustom,
    /// Nothing to pick — the key is consumed without an effect.
    None,
}

/// True when every character of `query` appears in `text` in the same order —
/// gaps allowed ("中国" finds 中华人民共和国). Callers lowercase both sides
/// first, matching the substring pass (Vue: `isSubsequence`; the walk is
/// character-level, which is identical to Vue's per-code-unit walk for BMP text
/// and correct for astral text where Vue's is not).
pub fn affix_is_subsequence(query: &str, text: &str) -> bool {
    let needle: Vec<char> = query.chars().collect();
    if needle.is_empty() {
        return true;
    }
    let mut matched = 0usize;
    for ch in text.chars() {
        if ch == needle[matched] {
            matched += 1;
            if matched == needle.len() {
                return true;
            }
        }
    }
    false
}

/// Vue's `tagLayout` computed: the tag list is the `tags` layout of a MULTI
/// picker and nothing else, so the two layouts can never half-apply (single
/// mode ignores `layout` entirely).
pub fn affix_tag_layout(mode: AffixMode, layout: AffixLayout) -> bool {
    mode == AffixMode::Multi && layout == AffixLayout::Tags
}

impl AffixLayout {
    /// [`affix_tag_layout`] — the one flag every branch keys off.
    pub fn tag_layout(self, mode: AffixMode) -> bool {
        affix_tag_layout(mode, self)
    }
}

/// Vue's `isSelected`: a key is in the controlled selection.
fn affix_is_selected(selected: &[String], key: &str) -> bool {
    selected.iter().any(|selected| selected == key)
}

/// Vue's `filteredRows`: the pick list in RENDER order, before the rank pass.
///
/// The tag layout hides already-selected keys (they live in the tag list
/// instead); the rows layout and single mode keep every option. Filtering is
/// TWO-PASS over ONE field at a time (never across concatenated fields, which
/// produces noise): an exact case-folded substring first, then the in-order
/// subsequence fallback so a renamed or CJK-composed label is still found by its
/// short form. A query filters, it never re-sorts.
pub fn affix_filter_rows(
    options: &[AffixOption],
    selected: &[String],
    mode: AffixMode,
    query: &str,
) -> Vec<AffixOption> {
    affix_filter_rows_for(options, selected, mode, AffixLayout::Tags, query)
}

/// Vue's `filteredRows` for an explicit [`AffixLayout`] — the full surface.
/// [`affix_filter_rows`] is the same function with the pre-`layout` default
/// (`Tags`), kept because that is what a plain "hide the selected keys" call
/// means.
pub fn affix_filter_rows_for(
    options: &[AffixOption],
    selected: &[String],
    mode: AffixMode,
    layout: AffixLayout,
    query: &str,
) -> Vec<AffixOption> {
    let q = query.trim().to_lowercase();
    let tag_layout = affix_tag_layout(mode, layout);
    let matched: Vec<AffixOption> = options
        .iter()
        .filter(|option| !tag_layout || !affix_is_selected(selected, &option.key))
        .filter(|option| {
            if q.is_empty() {
                return true;
            }
            let label = option.label.to_lowercase();
            let key = option.key.to_lowercase();
            let meta = option.meta.as_ref().map(|meta| meta.to_lowercase());
            let keywords = option
                .keywords
                .as_ref()
                .map(|keywords| keywords.to_lowercase());
            // Pass 1 — exact substring, one field at a time.
            if label.contains(&q) || key.contains(&q) {
                return true;
            }
            if meta.as_ref().is_some_and(|meta| meta.contains(&q)) {
                return true;
            }
            if keywords
                .as_ref()
                .is_some_and(|keywords| keywords.contains(&q))
            {
                return true;
            }
            // Pass 2 — in-order subsequence, again per field.
            if affix_is_subsequence(&q, &label) || affix_is_subsequence(&q, &key) {
                return true;
            }
            if meta
                .as_ref()
                .is_some_and(|meta| affix_is_subsequence(&q, meta))
            {
                return true;
            }
            keywords
                .as_ref()
                .is_some_and(|keywords| affix_is_subsequence(&q, keywords))
        })
        .cloned()
        .collect();
    // The rows layout ranks SELECTED FIRST — both groups in catalog order, so
    // a check floats a row to the end of the selected run and nothing else ever
    // reorders. A list with no selected row keeps its catalog order verbatim.
    if tag_layout || mode != AffixMode::Multi {
        return matched;
    }
    let mut ranked: Vec<AffixOption> = Vec::with_capacity(matched.len());
    ranked.extend(
        matched
            .iter()
            .filter(|option| affix_is_selected(selected, &option.key))
            .cloned(),
    );
    if ranked.is_empty() {
        return matched;
    }
    ranked.extend(
        matched
            .into_iter()
            .filter(|option| !affix_is_selected(selected, &option.key)),
    );
    ranked
}

/// Vue's `selectedRunLength`: the length of the SELECTED run at the head of the
/// rows (rows layout of a multi picker; 0 everywhere else), and therefore where
/// the divider goes.
pub fn affix_selected_run_length(rows: &[AffixOption], selected: &[String]) -> usize {
    rows.iter()
        .take_while(|option| affix_is_selected(selected, &option.key))
        .count()
}

/// Vue's `dividerVisible`: the selected/unselected boundary renders only while
/// BOTH groups are visible — an all-selected or all-unselected list has no
/// boundary to draw.
pub fn affix_divider_visible(rows: &[AffixOption], selected: &[String]) -> bool {
    let run = affix_selected_run_length(rows, selected);
    run > 0 && run < rows.len()
}

/// One child of the rows list, in render order: an option row or the divider at
/// the selected/unselected boundary. Vue pushes the divider while iterating the
/// rows, so it lands BETWEEN two siblings — the DOM shape this enum keeps.
#[derive(Clone, PartialEq, Debug)]
pub enum AffixRowSlot {
    /// A `button.hk-affix-row` for this catalog option.
    Row(AffixOption),
    /// `div.hk-affix-divider role="separator" aria-orientation="horizontal"`.
    Divider,
}

/// Vue's `rowNodes()` (minus the trailing custom row, which the caller appends
/// after every option like Vue's `customVisible` arm): the rows with the divider
/// inserted at index [`affix_selected_run_length`] when it is visible.
pub fn affix_row_sequence(rows: &[AffixOption], selected: &[String]) -> Vec<AffixRowSlot> {
    let divider_at = if affix_divider_visible(rows, selected) {
        Some(affix_selected_run_length(rows, selected))
    } else {
        None
    };
    let mut slots: Vec<AffixRowSlot> =
        Vec::with_capacity(rows.len() + usize::from(divider_at.is_some()));
    for (index, option) in rows.iter().enumerate() {
        if divider_at == Some(index) {
            slots.push(AffixRowSlot::Divider);
        }
        slots.push(AffixRowSlot::Row(option.clone()));
    }
    slots
}

/// Vue's `checkable`: only the rows layout renders the leading check column —
/// the one layout where a row IS the selection. Single mode keeps its checked
/// FACE on the active row and no glyph column.
pub fn affix_rows_checkable(mode: AffixMode, layout: AffixLayout) -> bool {
    mode == AffixMode::Multi && !affix_tag_layout(mode, layout)
}

/// One row's `data-checked` / `aria-pressed` state (false when the row carries
/// no check column at all).
pub fn affix_row_checked(
    mode: AffixMode,
    layout: AffixLayout,
    selected: &[String],
    key: &str,
) -> bool {
    affix_rows_checkable(mode, layout) && affix_is_selected(selected, key)
}

/// Vue's `pick(option)`: single mode and the tag layout ADD (`select`); the rows
/// layout TOGGLES, so a checked row leaves through `remove`. `true` = this tap
/// removes.
pub fn affix_row_toggle_removes(
    mode: AffixMode,
    layout: AffixLayout,
    selected: &[String],
    key: &str,
) -> bool {
    mode == AffixMode::Multi && !affix_tag_layout(mode, layout) && affix_is_selected(selected, key)
}

/// Vue's `exactMatch`: an exact case-folded label match suppresses the custom
/// row while the user is simply re-typing an existing entry.
pub fn affix_exact_label_match(options: &[AffixOption], query: &str) -> bool {
    let q = query.trim().to_lowercase();
    !q.is_empty()
        && options
            .iter()
            .any(|option| option.label.to_lowercase() == q)
}

/// Vue's `customVisible`: the free-text row needs `allowCustom`, a non-empty
/// query and NO exact label match.
pub fn affix_custom_visible(allow_custom: bool, query: &str, exact_match: bool) -> bool {
    allow_custom && !query.trim().is_empty() && !exact_match
}

/// Vue's `tagEntries`: selected keys in HOST order; a key missing from the
/// catalog degrades to its raw key as the label.
pub fn affix_tag_entries(options: &[AffixOption], selected: &[String]) -> Vec<AffixOption> {
    selected
        .iter()
        .map(
            |key| match options.iter().find(|option| &option.key == key) {
                Some(option) => option.clone(),
                None => AffixOption {
                    key: key.clone(),
                    label: key.clone(),
                    ..Default::default()
                },
            },
        )
        .collect()
}

/// Vue's `resolvedCloseOnSelect`: the host's explicit override, else "single
/// pickers close, multi pickers stay open".
pub fn affix_resolved_close_on_select(close_on_select: Option<bool>, mode: AffixMode) -> bool {
    close_on_select.unwrap_or(mode == AffixMode::Single)
}

/// Vue's `interpolate(…, { count })` on the selected-count template — the
/// bundle's `{count}` placeholder is replaced verbatim.
pub fn affix_selected_count_label(template: &str, count: usize) -> String {
    template.replace("{count}", &count.to_string())
}

/// The tag's value-driven primary text (Vue: `(tagValues?.[key] ?? "").trim()`).
/// A missing map or a missing key both resolve to the empty string, which the
/// tag renders as the italic "Not set" placeholder.
pub fn affix_tag_value(tag_values: Option<&HashMap<String, String>>, key: &str) -> String {
    tag_values
        .and_then(|values| values.get(key))
        .map(|value| value.trim().to_string())
        .unwrap_or_default()
}

/// Whether the search query carries a real (non-whitespace) filter — Vue:
/// `const q = query.value.trim(); if (!q) return;` (`onSearchEnter`). A
/// WHITESPACE-ONLY field is a no-op, exactly like an empty one (2026-11-27
/// R8: the raw `!query.is_empty()` let a blank Enter commit a row).
/// Extracted as a named predicate so the tests assert its BEHAVIOR — a
/// bare substring pin had no polarity (an inverted capture kept the
/// substring and passed) and a literal denylist could not see equivalent
/// spellings (R9).
pub fn affix_query_present(query: &str) -> bool {
    !query.trim().is_empty()
}

/// Vue's `onSearchEnter` (post-2026-11-27-R6): Enter is an ADD gesture,
/// never a blind toggle. An EMPTY query is a no-op — with the rows layout
/// ranking checked rows first, a naive top match would make a bare Enter
/// un-check (i.e. REMOVE, unconfirmed) the very row the user is looking at
/// (the same hazard `HkTagInput.commitQuery` guards). With a query, the
/// rows layout commits the first row the query can still ADD (skipping the
/// selected run); single mode and the tag layout keep the plain top match
/// (their rows are never selected-first). The custom row is the exit when
/// nothing is addable and the typed text is not an exact catalog label.
pub fn affix_enter_action(
    rows: &[AffixOption],
    custom_visible: bool,
    query_present: bool,
    selected: &[String],
    rows_layout: bool,
) -> AffixEnterAction {
    if !query_present {
        return AffixEnterAction::None;
    }
    if rows_layout {
        if let Some(index) = rows
            .iter()
            .position(|o| !o.disabled && !selected.iter().any(|key| key == &o.key))
        {
            return AffixEnterAction::PickRow(index);
        }
        return if custom_visible {
            AffixEnterAction::UseCustom
        } else {
            AffixEnterAction::None
        };
    }
    if let Some(index) = rows.iter().position(|o| !o.disabled) {
        return AffixEnterAction::PickRow(index);
    }
    if custom_visible {
        return AffixEnterAction::UseCustom;
    }
    AffixEnterAction::None
}

/// The inline geometry of the `position: fixed` popout host.
///
/// With an anchor rect this IS `basic::select::select_popout_style` with
/// `match_anchor_width = false` (Vue: `matchAnchorWidth={false}` — the popup
/// hugs its own designed measure). WITHOUT one the surface pins to the nearest
/// POSITIONED ancestor: the natural mount is an affix slot inside the field, so
/// that ancestor is the field's `.hk-input-box` (`position: relative`), and the
/// popup lands under the field it belongs to. Neither arm measures the panel.
pub fn affix_popup_style(
    side: AffixSide,
    anchor: Option<PopoverAnchorRect>,
    offset: f64,
) -> String {
    match anchor {
        Some(anchor) => select_popout_style(side.placement(), anchor, offset, false),
        None => match side {
            AffixSide::Prefix => {
                format!("position:absolute;top:calc(100% + {offset}px);left:0")
            }
            AffixSide::Suffix => {
                format!("position:absolute;top:calc(100% + {offset}px);right:0")
            }
        },
    }
}

/// Vue's presence-only marker attribute: `data-*` carries `"true"` while the
/// flag is on and is ABSENT otherwise (a serialized `="false"` reads as a value
/// to a `[data-active]` / `[data-disabled]` / `[data-unset]` selector).
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// One lucide glyph, serialized exactly as `lucide-vue-next` renders it:
/// `lucide` + the host's class + the `lucide-{name}-icon` / `lucide-{name}`
/// pair, the 24-unit viewBox, the stroke attribute set and the automatic
/// `aria-hidden="true"` the library adds when no a11y prop is passed.
fn lucide_icon_svg(name: &str, size: u32, body: &str, class: Option<&str>) -> String {
    let classes = match class {
        Some(class) => format!("lucide {class} lucide-{name}-icon lucide-{name}"),
        None => format!("lucide lucide-{name}-icon lucide-{name}"),
    };
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" \
         viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" \
         stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"{classes}\" \
         aria-hidden=\"true\">{body}</svg>"
    )
}

/// lucide `chevron-down`'s path (`<ChevronDown size={12} class="hk-affix-chip-caret" />`).
const LUCIDE_CHEVRON_DOWN_BODY: &str = r#"<path d="m6 9 6 6 6-6"></path>"#;
/// lucide `x`'s two paths (the tag's delete affordance, `<X size={11} />`).
const LUCIDE_X_BODY: &str = r#"<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>"#;
/// lucide `plus`'s two paths (the custom row's growth mark, `<Plus size={13} />`).
const LUCIDE_PLUS_BODY: &str = r#"<path d="M5 12h14"></path><path d="M12 5v14"></path>"#;
/// lucide `check`'s path (the rows layout's checked cell, `<Check size={12} />`).
const LUCIDE_CHECK_BODY: &str = r#"<path d="M20 6 9 17l-5-5"></path>"#;
/// lucide `search`'s path + circle (the search field's prefix glyph).
const LUCIDE_SEARCH_BODY: &str =
    r#"<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>"#;

/// Vue's `maxHeight` on the popup surface (`min(18rem, 45dvh)` — the HkTagInput
/// measure, so the family reads consistently). It bounds the ONE scroll region
/// instead of letting it stretch to the shared panel's 36rem ceiling; the
/// popup's own designed measure (13–19rem wide) is unchanged — the cap bounds
/// HEIGHT only.
pub const AFFIX_PICKER_MAX_HEIGHT: &str = "min(18rem, 45dvh)";

/// A glyph mounted through `dangerous_inner_html` on its own
/// `style="display:contents"` host (the crate-wide SVG rule: an rsx `svg {}`
/// child would be an HTML element, and the host must not add a box).
fn glyph_host(markup: String) -> Element {
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: markup,
        }
    }
}

/// The controlled event wiring every layer shares (Vue: `setup(props, { emit })`
/// plus the local refs the mirror promotes to props).
#[derive(Clone)]
struct AffixPickerWiring {
    confirm_remove: bool,
    mode: AffixMode,
    layout: AffixLayout,
    disabled: bool,
    open: bool,
    query: String,
    /// The controlled selection — the rows layout's toggle reads it (Vue closes
    /// over `selectedKeys`), the tag path does not.
    selected: Vec<String>,
    /// Vue's `resolvedCloseOnSelect`.
    close_on_select: bool,
    on_open_change: Option<EventHandler<bool>>,
    on_query_change: Option<EventHandler<String>>,
    on_select: Option<EventHandler<String>>,
    on_remove: Option<EventHandler<String>>,
    on_remove_request: Option<EventHandler<String>>,
    on_custom: Option<EventHandler<String>>,
}

impl AffixPickerWiring {
    fn request_open(&self, open: bool) {
        if let Some(handler) = self.on_open_change.as_ref() {
            handler.call(open);
        }
    }

    fn set_query(&self, query: String) {
        if let Some(handler) = self.on_query_change.as_ref() {
            handler.call(query);
        }
    }

    /// Vue's `toggle()`: a disabled chip never opens.
    fn toggle(&self) {
        if !self.disabled {
            self.request_open(!self.open);
        }
    }

    /// Vue's `pick(option)`: single mode and the tag layout ADD (`select`); the
    /// rows layout TOGGLES, so a checked row leaves through the same `remove`
    /// event the tag × fires — minus the confirm dialog (`confirm_remove` guards
    /// erasing a typed VALUE in the tag layout; unchecking a row is one
    /// reversible tap). Close-on-select follows the resolved flag on both edges.
    fn pick(&self, key: &str, option_disabled: bool) {
        if option_disabled {
            return;
        }
        if affix_row_toggle_removes(self.mode, self.layout, &self.selected, key) {
            if let Some(handler) = self.on_remove.as_ref() {
                handler.call(key.to_string());
            }
        } else if let Some(handler) = self.on_select.as_ref() {
            handler.call(key.to_string());
        }
        if self.close_on_select {
            self.request_open(false);
        }
    }

    /// Vue's `requestRemove(tag)`: the × NEVER erases anything on its own. With
    /// the confirm gate on, the request edge leaves the component and the host
    /// opens its own dialog (Vue's `HkMessageBox.confirm`, which the host now
    /// owns); with it off — or with no request channel wired — `remove` fires
    /// directly, exactly what Vue's `confirmRemove={false}` delegates.
    fn request_remove(&self, key: &str) {
        if self.confirm_remove {
            // The gate is on: the × only ASKS. A host that forgot the request
            // channel gets no deletion rather than an unguarded one.
            if let Some(handler) = self.on_remove_request.as_ref() {
                handler.call(key.to_string());
            }
            return;
        }
        if let Some(handler) = self.on_remove.as_ref() {
            handler.call(key.to_string());
        }
    }

    /// Vue's `useCustom()`: emit the trimmed query, close a single picker and
    /// clear the query in multi mode.
    fn use_custom(&self) {
        let query = self.query.trim().to_string();
        if query.is_empty() {
            return;
        }
        if let Some(handler) = self.on_custom.as_ref() {
            handler.call(query);
        }
        if self.mode == AffixMode::Single {
            self.request_open(false);
        } else {
            self.set_query(String::new());
        }
    }

    /// Vue's `onSearchEnter`: Enter picks through the pure action table.
    fn search_key(
        &self,
        event: KeyboardEvent,
        rows: &[AffixOption],
        custom_visible: bool,
        query_present: bool,
        selected: &[String],
        rows_layout: bool,
    ) {
        if event.key.as_str() != "Enter" {
            return;
        }
        event.prevent_default();
        match affix_enter_action(rows, custom_visible, query_present, selected, rows_layout) {
            AffixEnterAction::PickRow(index) => {
                if let Some(row) = rows.get(index) {
                    self.pick(&row.key, row.disabled);
                }
            }
            AffixEnterAction::UseCustom => self.use_custom(),
            AffixEnterAction::None => {}
        }
    }
}

/// The "Remove — {label}" naming Vue builds for the tag × (also the tag's
/// `aria-label` / `title`).
fn affix_remove_label(remove_label: &str, label: &str) -> String {
    format!("{remove_label} — {label}")
}

#[define_props]
pub struct AffixPickerProps {
    /// The full catalog of pickable entries (Vue marks it required; a Rust
    /// props struct must be `Default`-constructible, so it defaults empty).
    pub options: Vec<AffixOption>,

    /// `single` closes on pick and marks the active row; `multi` keeps the
    /// popup open for batch toggles (Vue default `single`).
    pub mode: AffixMode,

    /// How a MULTI picker presents its selection (Vue `layout`, default
    /// [`AffixLayout::Rows`]). No effect in single mode.
    pub layout: AffixLayout,

    /// Selected key(s), in HOST order (Vue: a string in single mode, an array in
    /// multi). Empty means "nothing selected" in both modes.
    pub selected: Vec<String>,

    /// The entry currently being acted on (edited language, active platform) —
    /// marks its tag with the active dot.
    pub active_key: Option<String>,

    /// Which affix edge the chip rides (only steers the popup anchor).
    pub side: AffixSide,

    /// Show the filter field (Vue default true).
    #[default(true)]
    pub searchable: bool,

    /// Offer the "Use <query>" row for free-text entries (Vue default false).
    #[default]
    pub allow_custom: bool,

    /// Gate tag deletion behind the host's confirm message box (Vue default
    /// true). See the header deltas: the dialog itself is the host's, so this
    /// flag selects `on_remove_request` (true) or `on_remove` (false).
    #[default(true)]
    pub confirm_remove: bool,

    /// Per-key value text replacing the tag list's primary label (multi mode).
    /// Provided = value-driven tags; undefined = the autonym-label tags. Does not
    /// affect the pick rows.
    pub tag_values: Option<HashMap<String, String>>,

    /// Text shown (italic) for a tag whose `tag_values` entry is empty; defaulted
    /// from the i18n bundle.
    pub tag_unset_text: Option<String>,

    /// Override the default close-on-pick (Vue: `single` true, `multi` false).
    pub close_on_select: Option<bool>,

    #[default]
    pub disabled: bool,

    /// Popup / chip aria labels; defaulted from the i18n bundle.
    pub title: Option<String>,

    pub search_placeholder: Option<String>,

    pub empty_text: Option<String>,

    /// Extra class on the chip button (host field styling hooks).
    pub chip_class: Option<String>,

    /// Accessible name of the chip button (defaults to its content).
    pub chip_label: Option<String>,

    /// The chip's inner content (Vue's scoped `chip` slot; the mirror takes the
    /// element, the open state is the `open` prop the host already owns).
    pub chip: Option<Element>,

    // ── controlled state (Vue keeps both in local refs) ──────────────────
    /// Popup visibility (Vue: the local `open`).
    pub open: bool,

    /// The live filter text (Vue: the local `query`).
    #[default]
    pub query: String,

    /// The chip rect to anchor against (`feedback::popover::
    /// anchor_rect_from_element_id` measures one by id). Without it the popup
    /// pins to the field's positioned box.
    pub anchor: Option<PopoverAnchorRect>,

    /// Gap between the chip and the popup, in px (Vue: HkMenu's `offset`
    /// default 6).
    #[default(6.0)]
    pub offset: f64,

    /// Fires with the desired open state (Vue: `update:open`).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the desired filter text (the Rust-side writer for Vue's local
    /// `query` ref).
    pub on_query_change: Option<EventHandler<String>>,

    /// Fires when a row or tag body was picked (Vue: `select`).
    pub on_select: Option<EventHandler<String>>,

    /// Fires when the host's own confirm accepted the deletion (Vue: `remove`).
    pub on_remove: Option<EventHandler<String>>,

    /// Fires when a tag's × asked to delete WITHOUT confirming — the host opens
    /// its dialog here (Vue: `HkMessageBox.confirm`, which the host now owns).
    pub on_remove_request: Option<EventHandler<String>>,

    /// Fires with the typed text when the "Use <query>" row is taken (Vue:
    /// `custom`).
    pub on_custom: Option<EventHandler<String>>,
}

#[component]
pub fn AffixPicker(props: AffixPickerProps) -> Element {
    let options = props.options.clone();
    let mode = props.mode;
    let layout = props.layout;
    let selected = props.selected.clone();
    let disabled = props.disabled;
    let is_open = props.open;
    let query = props.query.clone();

    // ── resolved strings (Vue's `??` fallbacks, i18n-backed) ─────────────
    let title = props
        .title
        .clone()
        .unwrap_or_else(|| t("components.hk.affixPicker.title", "Options"));
    let search_placeholder = props
        .search_placeholder
        .clone()
        .unwrap_or_else(|| t("components.hk.affixPicker.search", "Search"));
    let empty_text = props
        .empty_text
        .clone()
        .unwrap_or_else(|| t("components.hk.affixPicker.empty", "No matches"));
    let remove_label = t("components.hk.affixPicker.remove", "Remove");
    let switch_label = t("components.hk.affixPicker.switchTo", "Switch to");
    let unset_text = props
        .tag_unset_text
        .clone()
        .unwrap_or_else(|| t("components.hk.affixPicker.unset", "Not set"));
    let tags_group_label = t("components.hk.affixPicker.selected", "Selected");
    let count_template = t(
        "components.hk.affixPicker.selectedCount",
        "{count} selected",
    );
    let custom_template = t("components.hk.affixPicker.useCustom", "Use \"{query}\"");

    // ── the pure algebra ─────────────────────────────────────────────────
    // Vue's `tagLayout` flag first: every layout branch keys off it, so the two
    // layouts can never half-apply.
    let tag_layout = affix_tag_layout(mode, layout);
    let rows = affix_filter_rows_for(&options, &selected, mode, layout, &query);
    let checkable = affix_rows_checkable(mode, layout);
    let exact_match = affix_exact_label_match(&options, &query);
    let custom_visible = affix_custom_visible(props.allow_custom, &query, exact_match);
    let close_on_select = affix_resolved_close_on_select(props.close_on_select, mode);
    let value_driven = props.tag_values.is_some();
    let tag_entries = affix_tag_entries(&options, &selected);
    let tag_active_keys: Vec<String> = match mode {
        AffixMode::Single => selected.clone(),
        AffixMode::Multi => props.active_key.iter().cloned().collect(),
    };

    // Vue: the chip reads the selected option's label, else the raw key; multi
    // reads the "{count} selected" template.
    let chip_text = match mode {
        AffixMode::Single => {
            let key = selected.first().cloned().unwrap_or_default();
            match options.iter().find(|option| option.key == key) {
                Some(option) => option.label.clone(),
                None => key,
            }
        }
        AffixMode::Multi => affix_selected_count_label(&count_template, selected.len()),
    };
    let aria_expanded = if is_open { "true" } else { "false" };

    let wiring = AffixPickerWiring {
        confirm_remove: props.confirm_remove,
        mode,
        layout,
        disabled,
        open: is_open,
        query: query.clone(),
        selected: selected.clone(),
        close_on_select,
        on_open_change: props.on_open_change.clone(),
        on_query_change: props.on_query_change.clone(),
        on_select: props.on_select.clone(),
        on_remove: props.on_remove.clone(),
        // The confirm gate selects the request channel: wired only when the host
        // asked for the two-step interaction.
        on_remove_request: if props.confirm_remove {
            props.on_remove_request.clone()
        } else {
            None
        },
        on_custom: props.on_custom.clone(),
    };

    // ── the chip ──────────────────────────────────────────────────────────
    let mut chip_classes = String::from("hk-affix-chip");
    if let Some(class) = props.chip_class.as_ref().filter(|class| !class.is_empty()) {
        chip_classes.push(' ');
        chip_classes.push_str(class);
    }
    let chip_click = {
        let click_wiring = wiring.clone();
        move |event: MouseEvent| {
            // Vue: preventDefault + stopPropagation, so the host field never
            // reads the chip press as a field press.
            event.prevent_default();
            event.stop_propagation();
            click_wiring.toggle();
        }
    };
    let chip_mousedown = move |event: MouseEvent| event.prevent_default();
    let chip_content = match props.chip.clone() {
        Some(chip) => chip,
        // Vue's default slot content: the label span plus the caret glyph. Two
        // siblings, so they are collected into one fragment child.
        None => VNode::Fragment(vec![
            rsx! {
                span { class: "hk-affix-chip-label", {chip_text} }
            },
            glyph_host(lucide_icon_svg(
                "chevron-down",
                12,
                LUCIDE_CHEVRON_DOWN_BODY,
                Some("hk-affix-chip-caret"),
            )),
        ]),
    };
    let chip_aria_label = props.chip_label.clone();
    let chip_title = props.chip_label.clone();

    let chip = rsx! {
        button {
            "type": "button",
            class: chip_classes,
            disabled: marker_attr(disabled),
            "aria-haspopup": "menu",
            "aria-expanded": aria_expanded,
            "aria-label": chip_aria_label,
            title: chip_title,
            onmousedown: chip_mousedown,
            onclick: chip_click,
            {chip_content}
        }
    };

    // ── the popup, while open ─────────────────────────────────────────────
    let layer = if is_open {
        // The pinned head carries the search and — TAG LAYOUT ONLY — the
        // selected tag list; the rows live in the scrolling body below it.
        let tags = if tag_layout && !tag_entries.is_empty() {
            let mut tag_nodes: Vec<VNode> = Vec::with_capacity(tag_entries.len());
            for entry in &tag_entries {
                let key = entry.key.clone();
                let label = entry.label.clone();
                let flag = entry.flag.clone();
                let meta = entry.meta.clone();
                let value = affix_tag_value(props.tag_values.as_ref(), &key);
                let unset = value_driven && value.is_empty();
                // Vue: `${label}${meta ? ` (${meta})` : ""}${valueDriven ? `: ${value || unsetText}` : ""}`
                let meta_suffix = match meta.as_ref() {
                    Some(meta) => format!(" ({meta})"),
                    None => String::new(),
                };
                let value_suffix = if value_driven {
                    format!(
                        ": {}",
                        if value.is_empty() {
                            unset_text.clone()
                        } else {
                            value.clone()
                        }
                    )
                } else {
                    String::new()
                };
                let tag_title = format!("{label}{meta_suffix}{value_suffix}");
                let tag_text = if value_driven {
                    if value.is_empty() {
                        unset_text.clone()
                    } else {
                        value
                    }
                } else {
                    label.clone()
                };
                let body_label = format!("{switch_label} {label}");
                let remove_tag_label = affix_remove_label(&remove_label, &label);
                let is_active = tag_active_keys.contains(&key);
                let body_wiring = wiring.clone();
                let body_key = entry.key.clone();
                let body_disabled = entry.disabled;
                let remove_wiring = wiring.clone();
                let remove_key = entry.key.clone();
                tag_nodes.push(rsx! {
                    div {
                        class: "hk-affix-tag",
                        "data-active": marker_attr(is_active),
                        button {
                            "type": "button",
                            class: "hk-affix-tag-body",
                            title: tag_title,
                            "aria-label": body_label,
                            onclick: move |event: MouseEvent| {
                                event.stop_propagation();
                                body_wiring.pick(&body_key, body_disabled);
                            },
                            if let Some(flag) = flag {
                                span {
                                    class: "hk-affix-tag-flag",
                                    "aria-hidden": "true",
                                    {flag}
                                }
                            }
                            span {
                                class: "hk-affix-tag-text",
                                "data-unset": marker_attr(unset),
                                {tag_text}
                            }
                            if let Some(meta) = meta {
                                span { class: "hk-affix-tag-meta", {meta} }
                            }
                            if is_active {
                                span { class: "hk-affix-tag-dot", "aria-hidden": "true" }
                            }
                        }
                        button {
                            "type": "button",
                            class: "hk-affix-tag-x",
                            "aria-label": remove_tag_label.clone(),
                            title: remove_tag_label,
                            onclick: move |event: MouseEvent| {
                                event.stop_propagation();
                                remove_wiring.request_remove(&remove_key);
                            },
                            onmousedown: move |event: MouseEvent| event.prevent_default(),
                            {glyph_host(lucide_icon_svg("x", 11, LUCIDE_X_BODY, None))}
                        }
                    }
                });
            }
            let tag_nodes = VNode::Fragment(tag_nodes);
            Some(rsx! {
                div {
                    class: "hk-affix-tags",
                    "role": "group",
                    "aria-label": tags_group_label,
                    // Vue: `HkListTransition tag="div" class="hk-affix-tag-list"`;
                    // the mirror keeps the ordered list without the FLIP/leave
                    // choreography (see the header deltas).
                    div { class: "hk-affix-tag-list",
                        {tag_nodes}
                    }
                }
            })
        } else {
            None
        };

        // The search field is the mirrored `Input` — Vue nests `HkInput` the
        // same way (size sm, search glyph prefix, Enter resolves the list).
        let search = if props.searchable {
            let oninput_wiring = wiring.clone();
            let key_wiring = wiring.clone();
            let key_rows = rows.clone();
            let key_selected = selected.clone();
            // Vue trims before judging "empty" (`const q = query.value.trim()`)
            // — a whitespace-only field must be a no-op too (R8).
            let key_query_present = affix_query_present(&query);
            // Vue: `!tagLayout && mode === "multi"` — the only layout whose
            // Enter must skip the selected-first run.
            let key_rows_layout = !tag_layout && mode == AffixMode::Multi;
            let placeholder = search_placeholder.clone();
            Some(rsx! {
                div {
                    class: "hk-affix-search",
                    "role": "search",
                    Input {
                        model_value: query.clone(),
                        size: InputSize::Small,
                        placeholder: Some(placeholder.clone()),
                        // Vue passes `aria-label={searchPlaceholder}`; the mirrored
                        // Input publishes exactly that without printing a caption.
                        label: Some(placeholder),
                        hide_label: true,
                        autocomplete: Some("off".to_string()),
                        prefix_icon: Some(glyph_host(lucide_icon_svg(
                            "search",
                            13,
                            LUCIDE_SEARCH_BODY,
                            None,
                        ))),
                        oninput: Some(event_handler(move |value: String| {
                            oninput_wiring.set_query(value);
                        })),
                        onkeydown: Some(event_handler(move |event: KeyboardEvent| {
                            key_wiring.search_key(
                                event,
                                &key_rows,
                                custom_visible,
                                key_query_present,
                                &key_selected,
                                key_rows_layout,
                            );
                        })),
                    }
                }
            })
        } else {
            None
        };

        // ── rows (the optional divider, and the custom row last) ──────────
        // Vue's `rowNodes()`: rows in RENDER order (the rows layout ranks the
        // selected run first), the divider inserted as a SIBLING at the
        // selected/unselected boundary, the custom row after everything.
        let row_slots = affix_row_sequence(&rows, &selected);
        let mut row_nodes: Vec<VNode> = Vec::with_capacity(row_slots.len() + 1);
        for slot in row_slots {
            let option = match slot {
                AffixRowSlot::Divider => {
                    // The menu family's one divider grammar; a keyed child of
                    // Vue's list transition, here a plain sibling.
                    row_nodes.push(rsx! {
                        div {
                            class: "hk-affix-divider",
                            "role": "separator",
                            "aria-orientation": "horizontal",
                        }
                    });
                    continue;
                }
                AffixRowSlot::Row(option) => option,
            };
            // Single mode keeps its checked FACE on the active row and no glyph
            // column; the rows layout IS the selection, so it wears both.
            let is_active = mode == AffixMode::Single && selected.contains(&option.key);
            let is_checked = checkable && selected.contains(&option.key);
            let row_disabled = option.disabled;
            let label = option.label.clone();
            let meta = option.meta.clone();
            let flag = option.flag.clone();
            let key = option.key.clone();
            let row_wiring = wiring.clone();
            row_nodes.push(rsx! {
                button {
                    "type": "button",
                    class: "hk-affix-row",
                    "data-active": marker_attr(is_active),
                    "data-checked": marker_attr(is_checked),
                    "data-disabled": marker_attr(row_disabled),
                    // APG toggle-button state: published in the rows layout
                    // only (`checkable`), where a row is a check on the list.
                    "aria-pressed": checkable.then_some(if is_checked { "true" } else { "false" }),
                    onclick: move |event: MouseEvent| {
                        event.stop_propagation();
                        row_wiring.pick(&key, row_disabled);
                    },
                    if checkable {
                        // The reserved icon cell: on every row, filled only
                        // while checked, so labels line up either way.
                        span {
                            class: "hk-affix-check",
                            "data-on": marker_attr(is_checked),
                            "aria-hidden": "true",
                            if is_checked {
                                {glyph_host(lucide_icon_svg(
                                    "check",
                                    12,
                                    LUCIDE_CHECK_BODY,
                                    None,
                                ))}
                            }
                        }
                    }
                    if let Some(flag) = flag {
                        span {
                            class: "hk-affix-row-flag",
                            "aria-hidden": "true",
                            {flag}
                        }
                    }
                    span { class: "hk-affix-row-label", {label} }
                    if let Some(meta) = meta {
                        span { class: "hk-affix-row-meta", {meta} }
                    }
                }
            });
        }
        if custom_visible {
            let custom_label = custom_template.replace("{query}", query.trim());
            let custom_wiring = wiring.clone();
            row_nodes.push(rsx! {
                button {
                    "type": "button",
                    class: "hk-affix-row",
                    "data-custom": "true",
                    onclick: move |event: MouseEvent| {
                        event.stop_propagation();
                        custom_wiring.use_custom();
                    },
                    {glyph_host(lucide_icon_svg(
                        "plus",
                        13,
                        LUCIDE_PLUS_BODY,
                        Some("hk-affix-row-flag"),
                    ))}
                    span { class: "hk-affix-row-label", {custom_label} }
                }
            });
        }

        let body = if row_nodes.is_empty() {
            // Vue: only the empty state renders — `.hk-affix-scroll` and the
            // list do not exist without rows.
            rsx! {
                div { class: "hk-affix-empty", {empty_text} }
            }
        } else {
            let row_nodes = VNode::Fragment(row_nodes);
            // `.hk-affix-scroll` is a WIDTH container only — no max-height and
            // no overflow anywhere below the panel's scrolling body (ONE
            // SCROLLBAR PER WINDOW).
            rsx! {
                div {
                    class: "hk-affix-scroll",
                    div { class: "hk-affix-list",
                        {row_nodes}
                    }
                }
            }
        };

        let host_style = affix_popup_style(props.side, props.anchor, props.offset);
        // Vue: the `maxHeight` prop lands on the popout — the box the sheet
        // caps, whose BODY scrolls under the pinned head.
        let panel_style = format!("--hk-select-panel-max-height:{}", AFFIX_PICKER_MAX_HEIGHT);
        let key_wiring = wiring.clone();
        let panel_keydown = move |event: KeyboardEvent| {
            if event.key.as_str() == "Escape" {
                event.prevent_default();
                event.stop_propagation();
                key_wiring.request_open(false);
            }
        };
        // The PINNED head: the tag list (tag layout only) and the search field,
        // outside the scroll region on both form factors. An unsearchable,
        // tag-less picker (single + `searchable={false}`) pins nothing at all
        // and renders the header-less popout shape, exactly as before the slot
        // existed.
        let has_head = tags.is_some() || search.is_some();
        let head = rsx! {
            div {
                class: "hk-affix-head",
                if let Some(tags) = tags {
                    {tags}
                }
                if let Some(search) = search {
                    {search}
                }
            }
        };
        Some(if has_head {
            rsx! {
                div {
                    class: "hk-select-popout-host",
                    "data-side": "bottom",
                    "data-align": props.side.align_token(),
                    style: host_style,
                    div {
                        class: "hk-select-popout is-pinned-header",
                        "aria-label": title,
                        style: panel_style,
                        onkeydown: panel_keydown,
                        div { class: "hk-select-popout-pinned", {head} }
                        div {
                            class: "hk-select-popout-body-host",
                            div { class: "hk-select-popout-body",
                                {body}
                            }
                        }
                    }
                }
            }
        } else {
            rsx! {
                div {
                    class: "hk-select-popout-host",
                    "data-side": "bottom",
                    "data-align": props.side.align_token(),
                    style: host_style,
                    div {
                        class: "hk-select-popout",
                        "aria-label": title,
                        style: panel_style,
                        onkeydown: panel_keydown,
                        {body}
                    }
                }
            }
        })
    } else {
        None
    };

    // ── the chip and the popup are siblings in Vue's fragment ─────────────
    let mut layer_children: Vec<VNode> = Vec::with_capacity(2);
    layer_children.push(chip);
    if let Some(layer) = layer {
        layer_children.push(layer);
    }
    rsx! {
        {VNode::Fragment(layer_children)}
    }
}

impl StyledComponent for AffixPickerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-affix-*` names literal so this CSS matches Vue). The popup's
        // canvas (`.hk-select-popout*`) comes from the mirrored `HkSelect.scss`
        // that `basic/select.rs` compiles — the split the Vue component ships by
        // mounting `HkMenu`.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAffixPicker.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "affix-picker"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn catalog() -> Vec<AffixOption> {
        vec![
            AffixOption {
                key: "cn".to_string(),
                label: "中华人民共和国".to_string(),
                meta: Some("+86".to_string()),
                flag: Some("🇨🇳".to_string()),
                keywords: Some("china prc".to_string()),
                disabled: false,
            },
            AffixOption {
                key: "jp".to_string(),
                label: "Japan".to_string(),
                meta: Some("+81".to_string()),
                flag: Some("🇯🇵".to_string()),
                keywords: Some("nippon".to_string()),
                disabled: false,
            },
            AffixOption {
                key: "zz".to_string(),
                label: "Reserved".to_string(),
                meta: None,
                flag: None,
                keywords: None,
                disabled: true,
            },
        ]
    }

    /// One balanced `{…}` declaration block following `selector` in the
    /// COMPILED css (a naive `[^}]*` would stop at a nested block's first `}`).
    fn css_block<'a>(css: &'a str, selector: &str) -> &'a str {
        let at = css
            .find(selector)
            .unwrap_or_else(|| panic!("{selector} rule exists"));
        let open = css[at..]
            .find('{')
            .map(|offset| at + offset)
            .unwrap_or_else(|| panic!("{selector} opens a block"));
        let mut depth = 0usize;
        for (offset, ch) in css[open..].char_indices() {
            match ch {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        return &css[open..=open + offset];
                    }
                }
                _ => {}
            }
        }
        panic!("{selector} block is unterminated");
    }

    fn anchor() -> PopoverAnchorRect {
        PopoverAnchorRect {
            x: 100.0,
            y: 50.0,
            width: 40.0,
            height: 20.0,
        }
    }

    fn keys(rows: &[AffixOption]) -> Vec<&str> {
        rows.iter().map(|row| row.key.as_str()).collect()
    }

    #[test]
    fn affix_subsequence_walks_characters_in_order() {
        // The short form finds the composed label (中国 in 中华人民共和国).
        assert!(affix_is_subsequence("中国", "中华人民共和国"));
        assert!(affix_is_subsequence("cn", "china"));
        // Out of order is not a subsequence.
        assert!(!affix_is_subsequence("nc", "cn"));
        // An empty query matches everything (Vue's `i === query.length` at once).
        assert!(affix_is_subsequence("", "anything"));
        assert!(!affix_is_subsequence("xyz", "cn"));
    }

    #[test]
    fn affix_filter_is_two_pass_over_one_field_at_a_time() {
        // Empty query = the whole base list.
        assert_eq!(
            keys(&affix_filter_rows(&catalog(), &[], AffixMode::Single, "")),
            vec!["cn", "jp", "zz"]
        );
        // Substring on the label, on `meta` and on `keywords` each hit alone.
        assert_eq!(
            keys(&affix_filter_rows(
                &catalog(),
                &[],
                AffixMode::Single,
                "japan"
            )),
            vec!["jp"]
        );
        assert_eq!(
            keys(&affix_filter_rows(
                &catalog(),
                &[],
                AffixMode::Single,
                "+86"
            )),
            vec!["cn"]
        );
        assert_eq!(
            keys(&affix_filter_rows(
                &catalog(),
                &[],
                AffixMode::Single,
                "NIPPON"
            )),
            vec!["jp"]
        );
        // The subsequence fallback fills in the CJK short form.
        assert_eq!(
            keys(&affix_filter_rows(
                &catalog(),
                &[],
                AffixMode::Single,
                "中国"
            )),
            vec!["cn"]
        );
        // Multi hides the already-selected keys in the TAG layout (they live in
        // the tag list). The default (`Rows`) keeps them as checked rows — see
        // `affix_rows_layout_ranks_selected_first`.
        let selected = vec!["cn".to_string()];
        assert_eq!(
            keys(&affix_filter_rows(
                &catalog(),
                &selected,
                AffixMode::Multi,
                ""
            )),
            vec!["jp", "zz"]
        );
        assert_eq!(
            keys(&affix_filter_rows_for(
                &catalog(),
                &selected,
                AffixMode::Multi,
                AffixLayout::Rows,
                ""
            )),
            vec!["cn", "jp", "zz"]
        );
        // Single always shows everything, selected or not.
        assert_eq!(
            keys(&affix_filter_rows(
                &catalog(),
                &selected,
                AffixMode::Single,
                "japan"
            )),
            vec!["jp"]
        );
        // A query filters, it never reorders: "r" hits China's keywords and
        // Reserved's label, and the catalog's order survives.
        assert_eq!(
            keys(&affix_filter_rows(&catalog(), &[], AffixMode::Single, "r")),
            vec!["cn", "zz"]
        );
    }

    #[test]
    fn affix_tag_entries_degrade_to_the_raw_key() {
        let entries = affix_tag_entries(&catalog(), &["jp".to_string(), "ghost".to_string()]);
        assert_eq!(keys(&entries), vec!["jp", "ghost"]);
        // The catalog entry keeps its meta/flag; an unknown key becomes
        // `{ key, label: key }` (Vue's `?? { key, label: key }`).
        assert_eq!(entries[0].meta.as_deref(), Some("+81"));
        assert_eq!(entries[1].label, "ghost");
        assert!(entries[1].meta.is_none() && entries[1].flag.is_none());
        // Host order is preserved, never the catalog's.
        let reversed = affix_tag_entries(&catalog(), &["zz".to_string(), "cn".to_string()]);
        assert_eq!(keys(&reversed), vec!["zz", "cn"]);
    }

    #[test]
    fn affix_custom_row_needs_a_query_and_no_exact_match() {
        let catalog = catalog();
        assert!(!affix_custom_visible(false, "xx", false));
        assert!(!affix_custom_visible(true, "  ", false));
        assert!(!affix_custom_visible(true, "Japan", true));
        assert!(affix_custom_visible(true, "Japan", false));
        // An exact label match is detected case-insensitively and trimmed.
        assert!(affix_exact_label_match(&catalog, "  japan "));
        assert!(!affix_exact_label_match(&catalog, "japa"));
        assert!(!affix_exact_label_match(&catalog, "   "));
    }

    #[test]
    fn affix_close_on_select_follows_the_mode_and_the_override() {
        assert!(affix_resolved_close_on_select(None, AffixMode::Single));
        assert!(!affix_resolved_close_on_select(None, AffixMode::Multi));
        // An explicit override wins in both directions.
        assert!(!affix_resolved_close_on_select(
            Some(false),
            AffixMode::Single
        ));
        assert!(affix_resolved_close_on_select(Some(true), AffixMode::Multi));
    }

    #[test]
    fn affix_count_and_remove_labels_interpolate_like_vue() {
        assert_eq!(
            affix_selected_count_label("{count} selected", 2),
            "2 selected"
        );
        assert_eq!(
            affix_selected_count_label("已选 {count} 项", 0),
            "已选 0 项"
        );
        // A template without the placeholder survives untouched.
        assert_eq!(affix_selected_count_label("Selected", 3), "Selected");
        assert_eq!(affix_remove_label("Remove", "China"), "Remove — China");
    }

    #[test]
    fn affix_tag_values_trim_and_default_to_empty() {
        let mut values = HashMap::new();
        values.insert("cn".to_string(), "  中国话  ".to_string());
        values.insert("jp".to_string(), "   ".to_string());
        assert_eq!(affix_tag_value(Some(&values), "cn"), "中国话");
        // A whitespace-only value renders the italic "Not set" state.
        assert_eq!(affix_tag_value(Some(&values), "jp"), "");
        // A missing key or a missing map both resolve to empty.
        assert_eq!(affix_tag_value(Some(&values), "zz"), "");
        assert_eq!(affix_tag_value(None, "cn"), "");
    }

    #[test]
    fn affix_enter_takes_the_first_row_then_the_custom_row() {
        let rows = affix_filter_rows(&catalog(), &[], AffixMode::Single, "japan");
        assert_eq!(
            affix_enter_action(&rows, true, true, &[], false),
            AffixEnterAction::PickRow(0)
        );
        // A disabled first row falls through to the custom row.
        let rows = affix_filter_rows(&catalog(), &[], AffixMode::Single, "reserved");
        assert_eq!(
            affix_enter_action(&rows, true, true, &[], false),
            AffixEnterAction::UseCustom
        );
        // Nothing to pick and no custom row: the key is consumed with no effect.
        assert_eq!(
            affix_enter_action(&rows, false, true, &[], false),
            AffixEnterAction::None
        );
        assert_eq!(
            affix_enter_action(&[], false, true, &[], false),
            AffixEnterAction::None
        );
        // An EMPTY query is a no-op in every layout — the R6 blind-remove guard.
        assert_eq!(
            affix_enter_action(&rows, true, false, &[], false),
            AffixEnterAction::None
        );
        assert_eq!(
            affix_enter_action(&rows, true, false, &[], true),
            AffixEnterAction::None
        );
    }

    #[test]
    fn affix_enter_in_the_rows_layout_is_an_add_gesture_never_a_blind_remove() {
        // The 2026-11-27-R6 guard, Rust side: the rows layout ranks CHECKED
        // rows first, so a naive top match made a bare Enter un-check (=
        // unconfirmed REMOVE) the very row the user was looking at.
        let catalog = catalog();
        // "8" matches the +86 rows (cn, cn-main) and +81 (jp); jp is checked,
        // so the ranked order opens with the checked jp.
        let selected = vec!["jp".to_string()];
        let rows = affix_filter_rows_for(
            &catalog,
            &selected,
            AffixMode::Multi,
            AffixLayout::Rows,
            "8",
        );
        assert_eq!(rows[0].key, "jp", "the checked row sorts first");
        let action = affix_enter_action(&rows, false, true, &selected, true);
        let index = match action {
            AffixEnterAction::PickRow(index) => index,
            other => panic!("expected a pick, got {other:?}"),
        };
        assert_ne!(rows[index].key, "jp", "never the checked row");
        assert_eq!(
            rows[index].key, "cn",
            "the first ADDABLE match in ranked order"
        );
        // A query matching ONLY checked rows: nothing addable, no custom row
        // (exact match) → the key is consumed with no effect.
        let selected_all = vec!["cn".to_string(), "cn-main".to_string()];
        let rows = affix_filter_rows_for(
            &catalog,
            &selected_all,
            AffixMode::Multi,
            AffixLayout::Rows,
            "86",
        );
        assert_eq!(
            affix_enter_action(&rows, false, true, &selected_all, true),
            AffixEnterAction::None
        );
        // A WHITESPACE-ONLY query must be a no-op too (R8). The emptiness
        // rule lives in the named predicate, so these assert its BEHAVIOR:
        // polarity-checked, spelling-independent — a substring pin had no
        // polarity (an inverted capture kept the substring and passed) and
        // a literal denylist could not see equivalent spellings (R9).
        assert!(!affix_query_present(""), "empty → absent");
        assert!(!affix_query_present("   "), "whitespace-only → absent");
        assert!(affix_query_present("8"), "a real filter → present");
        assert!(affix_query_present("  8  "), "padded filter → present");
        // And the ENTER path consumes it: an absent filter is a no-op.
        assert_eq!(
            affix_enter_action(
                &rows,
                false,
                affix_query_present("   "),
                &selected_all,
                true
            ),
            AffixEnterAction::None
        );
        // Defense-in-depth (documentary, not load-bearing — the behavior
        // asserts above are that): the capture site must route through the
        // predicate. Read only the non-test half so the pin cannot match
        // its own file's test body.
        use std::fs::read_to_string;
        let source = read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/src/layout/affix_picker.rs"
        ))
        .expect("read the mirror source");
        let non_test = source
            .split("#[cfg(test)]")
            .next()
            .expect("the non-test half exists");
        assert!(
            non_test.contains("affix_query_present(&query)"),
            "the capture site must judge emptiness through affix_query_present"
        );
    }

    #[test]
    fn affix_popup_geometry_anchors_to_the_chip() {
        assert_eq!(
            affix_popup_style(AffixSide::Prefix, Some(anchor()), 6.0),
            "left:100px;top:76px"
        );
        assert_eq!(
            affix_popup_style(AffixSide::Suffix, Some(anchor()), 6.0),
            "left:140px;top:76px;transform:translateX(-100%)"
        );
        // Unmeasured: an absolute edge pin against the field's positioned box.
        assert_eq!(
            affix_popup_style(AffixSide::Prefix, None, 6.0),
            "position:absolute;top:calc(100% + 6px);left:0"
        );
        assert_eq!(
            affix_popup_style(AffixSide::Suffix, None, 6.0),
            "position:absolute;top:calc(100% + 6px);right:0"
        );
        // The side steers the host's align token (Vue's placement resolution).
        assert_eq!(AffixSide::Prefix.align_token(), "start");
        assert_eq!(AffixSide::Suffix.align_token(), "end");
        assert_eq!(
            AffixSide::Prefix.placement(),
            SelectPanelPlacement::BottomStart
        );
        assert_eq!(
            AffixSide::Suffix.placement(),
            SelectPanelPlacement::BottomEnd
        );
    }

    #[test]
    fn affix_picker_defaults_match_the_vue_props() {
        let props = AffixPickerProps::default();
        assert!(props.options.is_empty());
        assert_eq!(props.mode, AffixMode::Single);
        // Vue's `layout` default is "rows".
        assert_eq!(props.layout, AffixLayout::Rows);
        assert!(props.selected.is_empty());
        assert!(props.active_key.is_none());
        assert_eq!(props.side, AffixSide::Prefix);
        assert!(props.searchable);
        assert!(!props.allow_custom);
        assert!(props.confirm_remove);
        assert!(props.tag_values.is_none());
        assert!(props.tag_unset_text.is_none());
        assert!(props.close_on_select.is_none());
        assert!(!props.disabled);
        assert!(props.title.is_none());
        assert!(props.search_placeholder.is_none());
        assert!(props.empty_text.is_none());
        assert!(props.chip_class.is_none());
        assert!(props.chip_label.is_none());
        assert!(props.chip.is_none());
        assert!(!props.open);
        assert_eq!(props.query, "");
        assert!(props.anchor.is_none());
        assert_eq!(props.offset, 6.0);
        assert!(props.on_open_change.is_none());
        assert!(props.on_query_change.is_none());
        assert!(props.on_select.is_none());
        assert!(props.on_remove.is_none());
        assert!(props.on_remove_request.is_none());
        assert!(props.on_custom.is_none());
    }

    #[test]
    fn affix_picker_renders_the_closed_chip_contract() {
        let html = AffixPicker(AffixPickerProps {
            options: catalog(),
            selected: vec!["jp".to_string()],
            ..Default::default()
        })
        .render_to_html();

        // Vue's chip: the selected option's label, the disclosure aria and the
        // caret class the sheet rotates on `aria-expanded`.
        assert!(html.contains(r#"class="hk-affix-chip""#), "{html}");
        assert!(html.contains(r#"aria-haspopup="menu""#), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        assert!(
            html.contains(r#"class="hk-affix-chip-label">Japan<"#),
            "{html}"
        );
        assert!(
            html.contains("lucide hk-affix-chip-caret lucide-chevron-down-icon"),
            "{html}"
        );
        // Closed: no popup and no search field at all.
        assert!(!html.contains("hk-select-popout"), "{html}");
        assert!(!html.contains("hk-affix-search"), "{html}");
        assert!(!html.contains("hk-affix-row"), "{html}");
        // No falsy marker attributes (only presence markers, never `="false"`).
        assert!(!html.contains(r#"data-active="false""#), "{html}");
    }

    #[test]
    fn affix_picker_renders_the_open_tag_layout_panel_contract() {
        let mut tag_values = HashMap::new();
        tag_values.insert("cn".to_string(), "中国话".to_string());
        tag_values.insert("jp".to_string(), "   ".to_string());
        let html = AffixPicker(AffixPickerProps {
            options: catalog(),
            mode: AffixMode::Multi,
            // The value-editor shape (HkLocalizedInput): the pre-`layout`
            // behaviour this test pinned before the rows layout existed.
            layout: AffixLayout::Tags,
            selected: vec!["cn".to_string(), "jp".to_string(), "gone".to_string()],
            active_key: Some("jp".to_string()),
            open: true,
            // "res" matches Reserved's label without BEING an exact label, so
            // the free-text row stays visible (Vue: `customVisible`).
            query: "res".to_string(),
            allow_custom: true,
            tag_values: Some(tag_values),
            side: AffixSide::Suffix,
            anchor: Some(anchor()),
            ..Default::default()
        })
        .render_to_html();

        // The popup surface: suffix side → bottom-end, anchored geometry, the
        // single-scroll cap on the popout, and the pinned-header column.
        assert!(html.contains(r#"class="hk-select-popout-host""#), "{html}");
        assert!(html.contains(r#"data-side="bottom""#), "{html}");
        assert!(html.contains(r#"data-align="end""#), "{html}");
        assert!(
            html.contains(r#"style="left:140px;top:76px;transform:translateX(-100%)""#),
            "{html}"
        );
        assert!(
            html.contains("--hk-select-panel-max-height:min(18rem, 45dvh)"),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-select-popout is-pinned-header""#),
            "{html}"
        );
        // The head is PINNED: `.hk-select-popout-pinned > .hk-affix-head`, and
        // the rows live in `.hk-select-popout-body`.
        assert!(
            html.contains(r#"class="hk-select-popout-pinned"><div class="hk-affix-head""#),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-select-popout-pinned""#),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-select-popout-body-host""#),
            "{html}"
        );
        let pinned_at = html.find("hk-select-popout-pinned").expect("pinned band");
        let head_at = html.find(r#"class="hk-affix-head""#).expect("head");
        let body_at = html.find("hk-select-popout-body").expect("body");
        let scroll_at = html.find(r#"class="hk-affix-scroll""#).expect("rows");
        assert!(pinned_at < head_at, "{html}");
        assert!(head_at < body_at, "the head is outside the body: {html}");
        assert!(body_at < scroll_at, "the rows are in the body: {html}");
        // The head: the tag group publishes Vue's group role/label, then search.
        assert!(html.contains(r#"class="hk-affix-tags""#), "{html}");
        assert!(html.contains(r#"role="group""#), "{html}");
        assert!(html.contains(r#"aria-label="Selected""#), "{html}");
        assert!(html.contains(r#"class="hk-affix-tag-list""#), "{html}");
        assert!(html.contains(r#"class="hk-affix-search""#), "{html}");
        assert!(html.contains(r#"role="search""#), "{html}");
        // BOTH live in the pinned band — never in the scrolling body.
        let body_subtree = html.split(r#"class="hk-select-popout-body""#).nth(1);
        assert!(
            !body_subtree
                .unwrap_or_default()
                .contains(r#"class="hk-affix-tags""#)
                && !body_subtree
                    .unwrap_or_default()
                    .contains(r#"class="hk-affix-search""#),
            "tags and search must not scroll with the rows: {html}"
        );
        // The search field renders through the mirrored Input.
        assert!(html.contains(r#"class="hk-input-wrapper""#), "{html}");
        assert!(html.contains(r#"class="hk-input-element""#), "{html}");
        // Tags: host order, value-driven text, the italic unset state, the
        // active dot on the active key, and the raw key for a missing entry.
        assert_eq!(html.matches(r#"class="hk-affix-tag""#).count(), 3, "{html}");
        assert!(html.contains("中国话"), "{html}");
        assert!(html.contains(r#"data-unset="true""#), "{html}");
        assert!(html.contains("Not set"), "{html}");
        assert_eq!(
            html.matches(r#"class="hk-affix-tag-dot""#).count(),
            1,
            "{html}"
        );
        assert!(html.contains(r#"aria-label="Switch to Japan""#), "{html}");
        assert!(html.contains(r#"aria-label="Remove — Japan""#), "{html}");
        // Rows: the tag layout hides the selected keys (cn/jp/gone live in the
        // tag list) and "res" keeps only the disabled Reserved row; the custom
        // row comes LAST, exactly Vue's slot order.
        assert_eq!(html.matches(r#"class="hk-affix-row""#).count(), 2, "{html}");
        assert!(html.contains(r#"data-custom="true""#), "{html}");
        assert!(
            html.contains(r#"class="hk-affix-row-label">Use "res"<"#),
            "{html}"
        );
        assert!(
            html.contains("lucide hk-affix-row-flag lucide-plus-icon"),
            "{html}"
        );
        // The catalog row keeps its data faces (the disabled one included) —
        // and the tag layout draws NO check column and NO divider.
        assert!(html.contains(r#"data-disabled="true""#), "{html}");
        assert!(
            html.contains(r#"class="hk-affix-row-label">Reserved<"#),
            "{html}"
        );
        assert!(!html.contains("hk-affix-check"), "{html}");
        assert!(!html.contains("hk-affix-divider"), "{html}");
        assert!(!html.contains(r#"aria-pressed="#), "{html}");
        // The scroll band is the width container only.
        assert!(html.contains(r#"class="hk-affix-scroll""#), "{html}");
        assert!(html.contains(r#"class="hk-affix-list""#), "{html}");
    }

    #[test]
    fn affix_picker_renders_the_rows_layout_with_checked_rows() {
        // The multi DEFAULT since 2026-11-27: every option stays a row, checked
        // rows rank first, the boundary divider separates them, and nothing is
        // built in front of the search for the selection (no tag list).
        let html = AffixPicker(AffixPickerProps {
            options: catalog(),
            mode: AffixMode::Multi,
            selected: vec!["jp".to_string()],
            open: true,
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains(r#"class="hk-select-popout is-pinned-header""#),
            "{html}"
        );
        // The search is still pinned, and there is NO tag list at all.
        assert!(
            html.contains(r#"class="hk-select-popout-pinned""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-affix-search""#), "{html}");
        assert!(!html.contains("hk-affix-tags"), "{html}");
        assert!(!html.contains("hk-affix-tag "), "{html}");
        // Every catalog option is a row — the SELECTED one included.
        assert_eq!(html.matches(r#"class="hk-affix-row""#).count(), 3, "{html}");
        // The checked row leads: catalog order cn < jp < zz, so the selected
        // run (jp) floats to the head and the rest keeps catalog order.
        let jp_at = html
            .find(r#"class="hk-affix-row-label">Japan"#)
            .expect("jp row");
        let cn_at = html
            .find(r#"class="hk-affix-row-label">中华人民共和国"#)
            .expect("cn row");
        assert!(jp_at < cn_at, "the checked row ranks first: {html}");
        // The divider sits BETWEEN the two runs, as a sibling. (The checked
        // row's `hk-affix-check` cell also matches a naive `hk-affix-divider`
        // search, so anchor on the class attribute.)
        let divider_at = html
            .find(r#"class="hk-affix-divider""#)
            .expect("the boundary divider renders");
        assert!(jp_at < divider_at && divider_at < cn_at, "{html}");
        assert!(html.contains(r#"role="separator""#), "{html}");
        assert!(html.contains(r#"aria-orientation="horizontal""#), "{html}");
        // The check column: one per row, filled only on the checked row.
        assert_eq!(
            html.matches(r#"class="hk-affix-check""#).count(),
            3,
            "{html}"
        );
        assert_eq!(html.matches(r#"data-on="true""#).count(), 1, "{html}");
        assert_eq!(
            html.matches("lucide hk-affix-check").count()
                + html.matches("lucide lucide-check-icon").count(),
            1,
            "exactly one check glyph: {html}"
        );
        // `aria-pressed` on EVERY row (APG toggle), `data-checked` on one only.
        assert_eq!(html.matches(r#"aria-pressed="true""#).count(), 1, "{html}");
        assert_eq!(html.matches(r#"aria-pressed="false""#).count(), 2, "{html}");
        assert_eq!(html.matches(r#"data-checked="true""#).count(), 1, "{html}");
        // Single mode's marker is NOT used in the rows layout.
        assert!(!html.contains(r#"data-active="#), "{html}");
        assert!(!html.contains(r#"data-checked="false""#), "{html}");
    }

    #[test]
    fn affix_picker_renders_the_empty_state_without_a_list() {
        let html = AffixPicker(AffixPickerProps {
            options: catalog(),
            open: true,
            query: "nothing matches this".to_string(),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-affix-empty""#), "{html}");
        assert!(html.contains("No matches"), "{html}");
        // Vue renders neither the scroll band nor the list when no row exists.
        assert!(!html.contains("hk-affix-scroll"), "{html}");
        assert!(!html.contains("hk-affix-list"), "{html}");
        assert!(!html.contains("hk-affix-row"), "{html}");
        // The PINNED head survives an empty list: the search never scrolls
        // away with rows that are not there.
        assert!(
            html.contains(r#"class="hk-select-popout-pinned""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-affix-search""#), "{html}");
        assert!(html.contains(r#"class="hk-select-popout-body""#), "{html}");
    }

    #[test]
    fn affix_single_mode_keeps_no_check_cell_and_pins_the_search() {
        // Single mode: `layout` has no effect, rows keep catalog order and the
        // `data-active` marker, and no check column / divider exists.
        let html = AffixPicker(AffixPickerProps {
            options: catalog(),
            mode: AffixMode::Single,
            layout: AffixLayout::Tags,
            selected: vec!["jp".to_string()],
            open: true,
            ..Default::default()
        })
        .render_to_html();

        assert_eq!(html.matches(r#"class="hk-affix-row""#).count(), 3, "{html}");
        assert!(html.contains(r#"data-active="true""#), "{html}");
        assert!(!html.contains("hk-affix-check"), "{html}");
        assert!(!html.contains(r#"class="hk-affix-divider""#), "{html}");
        assert!(!html.contains(r#"aria-pressed="#), "{html}");
        // `layout="tags"` is inert here: no tag list for a single picker.
        assert!(!html.contains("hk-affix-tags"), "{html}");
        // Rows keep catalog order (the active row is not floated).
        let cn_at = html
            .find(r#"class="hk-affix-row-label">中华人民共和国"#)
            .expect("cn row");
        let jp_at = html
            .find(r#"class="hk-affix-row-label">Japan"#)
            .expect("jp row");
        assert!(cn_at < jp_at, "{html}");
        // The search is pinned exactly like the multi layouts.
        assert!(
            html.contains(r#"class="hk-select-popout is-pinned-header""#),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-select-popout-pinned""#),
            "{html}"
        );
    }

    #[test]
    fn affix_unsearchable_single_picker_renders_the_headerless_popout() {
        // Nothing to pin (no search, no tag list) → the pre-slot shape, so a
        // host that turned the field off is not paying for an empty band.
        let html = AffixPicker(AffixPickerProps {
            options: catalog(),
            open: true,
            searchable: false,
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-select-popout""#), "{html}");
        assert!(!html.contains("is-pinned-header"), "{html}");
        assert!(!html.contains("hk-select-popout-pinned"), "{html}");
        assert!(!html.contains("hk-select-popout-body"), "{html}");
        assert!(html.contains("--hk-select-panel-max-height"), "{html}");
        assert!(html.contains(r#"class="hk-affix-row""#), "{html}");
    }

    #[test]
    fn affix_rows_layout_ranks_selected_first_in_catalog_order() {
        let catalog = catalog();
        let selected = vec!["zz".to_string(), "cn".to_string()];
        // Catalog order cn < jp < zz: the selected run keeps it (cn, zz) and the
        // rest keeps it too — never the selection order.
        assert_eq!(
            keys(&affix_filter_rows_for(
                &catalog,
                &selected,
                AffixMode::Multi,
                AffixLayout::Rows,
                ""
            )),
            vec!["cn", "zz", "jp"]
        );
        // A single check floats to the END of the selected run …
        assert_eq!(
            keys(&affix_filter_rows_for(
                &catalog,
                &["cn".to_string()],
                AffixMode::Multi,
                AffixLayout::Rows,
                ""
            )),
            vec!["cn", "jp", "zz"]
        );
        // … and nothing checked leaves the catalog order untouched.
        assert_eq!(
            keys(&affix_filter_rows_for(
                &catalog,
                &[],
                AffixMode::Multi,
                AffixLayout::Rows,
                ""
            )),
            vec!["cn", "jp", "zz"]
        );
        // A query filters WITHIN the groups: "r" hits China's keywords and
        // Reserved's label, and the rank still applies.
        assert_eq!(
            keys(&affix_filter_rows_for(
                &catalog,
                &selected,
                AffixMode::Multi,
                AffixLayout::Rows,
                "r"
            )),
            vec!["cn", "zz"]
        );
        // The tag layout and single mode never rank.
        assert_eq!(
            keys(&affix_filter_rows_for(
                &catalog,
                &selected,
                AffixMode::Multi,
                AffixLayout::Tags,
                ""
            )),
            vec!["jp"]
        );
        assert_eq!(
            keys(&affix_filter_rows_for(
                &catalog,
                &selected,
                AffixMode::Single,
                AffixLayout::Rows,
                ""
            )),
            vec!["cn", "jp", "zz"]
        );
    }

    #[test]
    fn affix_divider_sits_on_the_boundary_only_between_two_groups() {
        let catalog = catalog();
        let selected = vec!["cn".to_string()];
        let rows =
            affix_filter_rows_for(&catalog, &selected, AffixMode::Multi, AffixLayout::Rows, "");
        assert_eq!(affix_selected_run_length(&rows, &selected), 1);
        assert!(affix_divider_visible(&rows, &selected));
        let sequence = affix_row_sequence(&rows, &selected);
        // The divider lands BETWEEN two siblings, at index == the run length.
        assert_eq!(
            sequence
                .iter()
                .map(|slot| match slot {
                    AffixRowSlot::Divider => "|".to_string(),
                    AffixRowSlot::Row(option) => option.key.clone(),
                })
                .collect::<Vec<_>>(),
            vec!["cn", "|", "jp", "zz"]
        );
        // Nothing checked → no boundary, and no slot at all.
        let none = affix_row_sequence(&rows, &[]);
        assert_eq!(none.len(), 3);
        assert!(none.iter().all(|slot| matches!(slot, AffixRowSlot::Row(_))));
        assert!(!affix_divider_visible(&rows, &[]));
        // EVERYTHING checked → likewise (an all-selected list has no boundary).
        let all: Vec<String> = catalog.iter().map(|option| option.key.clone()).collect();
        let all_rows =
            affix_filter_rows_for(&catalog, &all, AffixMode::Multi, AffixLayout::Rows, "");
        assert_eq!(affix_selected_run_length(&all_rows, &all), 3);
        assert!(!affix_divider_visible(&all_rows, &all));
        // A FILTERED list that holds only unchecked options draws none either
        // (Vue ranks the FILTERED rows).
        let one = affix_filter_rows_for(
            &catalog,
            &selected,
            AffixMode::Multi,
            AffixLayout::Rows,
            "japan",
        );
        assert_eq!(keys(&one), vec!["jp"]);
        assert!(!affix_divider_visible(&one, &selected));
    }

    #[test]
    fn affix_rows_layout_toggles_between_select_and_remove() {
        // Pure view of Vue's `pick()`: the rows layout TOGGLES, everything else
        // adds.
        assert!(affix_rows_checkable(AffixMode::Multi, AffixLayout::Rows));
        assert!(!affix_rows_checkable(AffixMode::Multi, AffixLayout::Tags));
        assert!(!affix_rows_checkable(AffixMode::Single, AffixLayout::Rows));
        let selected = vec!["cn".to_string()];
        assert!(affix_row_checked(
            AffixMode::Multi,
            AffixLayout::Rows,
            &selected,
            "cn"
        ));
        assert!(!affix_row_checked(
            AffixMode::Multi,
            AffixLayout::Rows,
            &selected,
            "jp"
        ));
        // Unchecked → `select`; checked → `remove` (the tag layout adds).
        assert!(affix_row_toggle_removes(
            AffixMode::Multi,
            AffixLayout::Rows,
            &selected,
            "cn"
        ));
        assert!(!affix_row_toggle_removes(
            AffixMode::Multi,
            AffixLayout::Rows,
            &selected,
            "jp"
        ));
        assert!(!affix_row_toggle_removes(
            AffixMode::Multi,
            AffixLayout::Tags,
            &selected,
            "cn"
        ));
        assert!(affix_tag_layout(AffixMode::Multi, AffixLayout::Tags));
        assert!(!affix_tag_layout(AffixMode::Single, AffixLayout::Tags));
        assert!(!affix_tag_layout(AffixMode::Multi, AffixLayout::Rows));
        assert!(AffixLayout::Tags.tag_layout(AffixMode::Multi));
    }

    #[test]
    fn affix_row_pick_emits_select_then_remove_across_layouts() {
        use std::cell::RefCell;
        use std::rc::Rc;

        let log: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let select_log = Rc::clone(&log);
        let remove_log = Rc::clone(&log);
        let wiring = AffixPickerWiring {
            confirm_remove: true,
            mode: AffixMode::Multi,
            layout: AffixLayout::Rows,
            disabled: false,
            open: true,
            query: String::new(),
            selected: vec!["cn".to_string()],
            close_on_select: false,
            on_open_change: None,
            on_query_change: None,
            on_select: Some(EventHandler::new(move |key: String| {
                select_log.borrow_mut().push(format!("select:{key}"));
            })),
            on_remove: Some(EventHandler::new(move |key: String| {
                remove_log.borrow_mut().push(format!("remove:{key}"));
            })),
            on_remove_request: None,
            on_custom: None,
        };
        // Unchecked row → `select`.
        wiring.pick("jp", false);
        // Checked row → `remove`, even with the confirm gate ON: unchecking a
        // row is a one-tap reversible act, never a dialog.
        wiring.pick("cn", false);
        // A disabled row emits nothing.
        wiring.pick("zz", true);
        assert_eq!(
            log.borrow().as_slice(),
            ["select:jp".to_string(), "remove:cn".to_string()]
        );
        // The tag layout ADDs on both edges (its × owns the removal path).
        log.borrow_mut().clear();
        let tag_wiring = AffixPickerWiring {
            layout: AffixLayout::Tags,
            ..wiring.clone()
        };
        tag_wiring.pick("cn", false);
        tag_wiring.pick("jp", false);
        assert_eq!(
            log.borrow().as_slice(),
            ["select:cn".to_string(), "select:jp".to_string()]
        );
    }

    #[test]
    fn affix_confirm_gate_never_deletes_locally() {
        // Pure-function view of the gate: the wiring's request_remove only
        // reaches `on_remove` when the gate is OFF.
        let removed = std::rc::Rc::new(std::cell::Cell::new(0usize));
        let requested = std::rc::Rc::new(std::cell::Cell::new(0usize));
        let removed_clone = std::rc::Rc::clone(&removed);
        let wiring = AffixPickerWiring {
            confirm_remove: true,
            mode: AffixMode::Multi,
            layout: AffixLayout::Rows,
            disabled: false,
            open: true,
            query: String::new(),
            selected: Vec::new(),
            close_on_select: false,
            on_open_change: None,
            on_query_change: None,
            on_select: None,
            on_remove: Some(EventHandler::new(move |_key: String| {
                removed_clone.set(removed_clone.get() + 1);
            })),
            on_remove_request: None,
            on_custom: None,
        };
        wiring.request_remove("cn");
        assert_eq!(
            removed.get(),
            0,
            "the confirm gate must block the direct removal"
        );
        let _ = requested;

        // With the request channel wired the edge goes there.
        let removed_clone = std::rc::Rc::clone(&removed);
        let requested_clone2 = std::rc::Rc::clone(&requested);
        let wiring = AffixPickerWiring {
            on_remove: Some(EventHandler::new(move |_key: String| {
                removed_clone.set(removed_clone.get() + 1);
            })),
            on_remove_request: Some(EventHandler::new(move |_key: String| {
                requested_clone2.set(requested_clone2.get() + 1);
            })),
            ..wiring
        };
        wiring.request_remove("cn");
        assert_eq!(requested.get(), 1, "the request edge must fire");
        assert_eq!(removed.get(), 0, "and still nothing may be deleted");
    }

    #[test]
    fn affix_picker_styles_come_from_the_canonical_vue_sheet() {
        let css = AffixPickerComponent::styles();
        assert!(
            css.contains(".hk-affix-chip")
                && css.contains(".hk-affix-tag")
                && css.contains(".hk-affix-row")
                && css.contains(".hk-affix-empty"),
            "affix picker css must carry the vue chip, tag, row and empty classes"
        );
        // The 2026-11-27 grammar: the pinned head, the rows layout's check cell
        // and its selected/unselected divider.
        for selector in [".hk-affix-head", ".hk-affix-search", ".hk-affix-check"] {
            assert!(css.contains(selector), "the sheet is missing {selector}");
        }
        assert!(
            css.contains(".hk-affix-divider"),
            "the rows layout's divider has no rule in the sheet"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored affix picker sheet"
        );
        // ONE SCROLLBAR PER WINDOW: the width container and the row list never
        // become scroll regions of their own — the hosting panel's
        // `.hk-select-popout-body` owns the only scrollbar, capped through
        // `--hk-select-panel-max-height` on the popout.
        for selector in [".hk-affix-scroll", ".hk-affix-list"] {
            let block = css_block(css, selector);
            assert!(
                !block.contains("overflow") && !block.contains("max-height"),
                "{selector} must not own a scroll region: {block}"
            );
        }
        assert_eq!(AffixPickerComponent::name(), "affix-picker");
    }

    /// Wave B2 hybrid decision, PINNED: the tag × keeps its own
    /// `onmousedown` prevent-default (tapping × must not steal focus or start
    /// a text selection in the picker), which HkIconButton does not carry —
    /// so it deliberately stays a BARE button styled through the standard
    /// channel vars. Migrating it onto HkIconButton changes a mouse
    /// contract; the dedicated pin guards the Chrome group.
    #[test]
    fn affix_tag_close_stays_a_bare_button_by_contract() {
        let html = AffixPicker(AffixPickerProps {
            options: catalog(),
            selected: vec!["jp".to_string()],
            mode: AffixMode::Multi,
            // The tag layout is the only one that renders a tag × at all.
            layout: AffixLayout::Tags,
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"class="hk-affix-tag-x""#), "{html}");
        assert!(!html.contains("hk-icon-button"), "{html}");
        // The mouse contract lives in the SOURCE (events are wired at
        // runtime, not serialized): tapping × must not steal focus or start
        // a selection — the onmousedown prevent-default the standard
        // component does not carry.
        // Count-based, NOT contains-based: this test's own needle below
        // contributes one literal occurrence, so a healthy file holds
        // EXACTLY TWO (render wiring + this test). A plain contains() is
        // tautologically true — the hollow-pin bug a review round caught.
        let src = include_str!("affix_picker.rs");
        let needle = "onmousedown: move |event: MouseEvent| event.prevent_default()";
        assert_eq!(
            src.matches(needle).count(),
            2,
            "the x's prevent-default must stay wired exactly once"
        );
    }
}
