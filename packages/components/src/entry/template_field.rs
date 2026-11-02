// hi-components/src/entry/template_field.rs
// TemplateField — mirror of the canonical Vue `HkTemplateField`: the editing
// half of the fill-template surfaces. A single-line rich input for values
// that mix literal text with `{{ token }}` placeholders: the value renders as
// text runs plus one inline chip per token, typing `{{` opens the vocabulary
// panel, and clicking a chip opens the chip editor (swap the placeholder,
// read what it fills from, or remove it). The model is and stays the plain
// `{{ token }}` string — chips are a RENDERING of the value, never a second
// data format, and serialization is byte-exact so a round-trip through this
// field never rewrites stored values.
//
// The stylesheet is the SAME sheet the Vue library ships and the read-only
// `TemplateText` mirror already compiles (`packages/vue/src/components/
// HkTemplateField.scss` — Vue ships no HkTemplateText.scss; the text renderer
// imports the field's sheet), vendored under `src/styles/vue-mirror/` and
// guarded by `tests/vue_mirror_drift_tests.rs`, compiled with `no_hash` so
// the `.hk-template-field*` / `.hk-tpl-*` class names are literal and
// identical in both forms. REGISTRY NOTE: this sheet is shared by
// `TemplateTextComponent` (registered as "template-text") and this component
// (registered as "template-field"); `css_bundle` concatenates per
// registration name, so an assembler that registers BOTH carries the sheet's
// bytes twice — register the sheet under ONE name (see the wave receipt).
//
// DOM contract (mirrors the Vue render output):
//
//   div.hk-template-field [data-disabled]
//     label.hk-template-field-label [for=id]              (label)
//     div.hk-template-field-box [.hk-template-field-box-error]
//       div.hk-template-field-edit
//           id role="textbox" aria-multiline="false" aria-haspopup="menu"
//           [aria-expanded] [aria-owns] [aria-activedescendant]
//           contenteditable={true|false} spellcheck="false" data-ph={placeholder}
//         ── per parsed segment, in source order ──
//         {the verbatim text run}
//         span.hk-tpl-chip contenteditable="false"
//             data-token data-raw                          {display spelling}
//     p.hk-template-field-hint                             (hint && !error)
//     p.hk-template-field-error                            (error)
//     ── the vocabulary panel, while suggest_open (Vue: HkMenu popup) ──
//     div.hk-select-popout-host data-side="bottom" data-align="start" [style]
//       div.hk-select-popout [aria-label]
//           style="--hk-select-panel-max-height:min(18rem, 45dvh)"
//         div#{panelRowsId}.hk-tpl-rows                    (rows present)
//           div.hk-tpl-group role="group" aria-label={label}   (grouped run)
//             div.hk-tpl-group-label aria-hidden="true" {label}
//             button.hk-tpl-row role="menuitem" id [data-active]
//               span.hk-tpl-row-name {display}
//               [span.hk-tpl-row-desc {description}]
//         | p.hk-tpl-rows-empty                            (no rows)
//     ── the chip editor, while editor_open (Vue: HkPopover body) ──
//     div.hk-tpl-editor
//       div.hk-tpl-editor-current
//         span.hk-tpl-chip data-static="" {display of editor_token}
//         [span.hk-tpl-editor-desc {description}]
//       div.hk-tpl-editor-search                           (the mirrored Input)
//       div.hk-tpl-editor-scroll
//         div.hk-tpl-editor-rows role="listbox" aria-label
//           div.hk-tpl-group … button.hk-tpl-row role="option"
//               [aria-selected] [data-active]              (the edited token)
//           [p.hk-tpl-rows-empty]
//       div.hk-tpl-editor-footer
//         button.hk-btn…ghost sm (trash-2 14 + Remove)
//
// GRAMMAR REUSE: the template mini-grammar is the SAME public surface the
// `TemplateText` mirror already ports from `templateGrammar.ts`
// (`basic/template_text.rs`: [`parse_template`], [`serialize_template`],
// [`format_token_display`], [`TemplateSegment`], [`TemplateTokenDef`] — all
// `pub`), so this component REFERENCES them instead of porting a second
// copy; the two halves of the surface can never drift. The two-pass filter
// fallback reuses `basic/tag_input.rs`'s public [`tag_is_subsequence`] — the
// HkAffixPicker fuzzy convention the Vue component shares.
//
// STATE CONTRACT (ledger L48): tairitsu 0.5.22 has no per-instance component
// state (`use_signal` allocates a fresh signal per render, `use_state` shares
// ONE slot per component type), so every Vue local ref is a CONTROLLED prop
// plus a writer callback — `suggestOpen`/`suggestQuery`/`suggestActive`/
// `triggerRange` → `suggest_open`/`suggest_query`/`suggest_active`/
// `trigger` (+ `on_suggest_*`), `editorOpen`/`editorChip`/`editorToken`/
// `editorQuery` → `editor_open`/`editor_chip`/`editor_token`/`editor_query`
// (+ `on_editor_*`). The chip editor addresses its chip by TOKEN-SEGMENT
// INDEX (Vue holds the DOM element). The value pipeline is
// `onupdate_model_value` (Vue `update:modelValue`) + `oncaret` (the
// serialized offset editing resumes at — the caret half of Vue's machinery).
//
// OFFSET DELTA: Vue's caret/trigger arithmetic runs on JS string indices
// (UTF-16 code units); this algebra is CHAR-based end to end (the grammar
// port [`parse_template`] walks chars), so every offset this module emits is
// a char offset. A host crossing from JS indices must convert (surrogate
// pairs are the only divergence).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO CONTENTEDITABLE ENGINE: the Selection/Range/beforeinput APIs Vue's
//     deterministic editing intercepts do not exist in tairitsu 0.5.22, so
//     TYPING IS HOST-DRIVEN: the editable renders Vue's exact markup, and
//     every text edit is resolved by the host through the pure algebra
//     ([`template_field_insert`], [`template_field_delete`],
//     [`template_field_pick`]) and written back through `model_value` +
//     `oncaret`. The editable's raw `oninput` forwards untouched for hosts
//     that wire their own normalization; Vue's plain-text paste interception
//     has no analogue (no clipboard in this stack — the `share_bar.rs`
//     precedent).
//   * ZERO-WIDTH TEXT NODES: Vue parks an empty text node after every chip
//     (a caret home Chromium's engine accepts). An empty text node
//     serializes to nothing, so the mirror simply omits them.
//   * NO FOCUS MACHINERY: the editor's focus latch / reclaim /
//     pending-reclaim dance (real-browser R1/R3 findings) has no focus API to
//     ride; both surfaces' opens/closes fire the state edges only.
//   * NO TELEPORT, SHEET, AUTO-FLIP, OUTSIDE-CLICK or WIDTH MATCH: both
//     surfaces render IN PLACE (the `tag_input.rs` / `affix_picker.rs`
//     pattern). The vocabulary panel carries HkMenu's popout chrome
//     (`.hk-select-popout-host` / `.hk-select-popout`) with inline geometry —
//     below-first, `bottom-start`, user direction 2026-10-10 — plus the
//     popout's Escape-close edge (`admin_header.rs`'s mirror of HkMenu);
//     `matchAnchorWidth` needs measurement and is dropped (the popout sizes
//     to content). The chip editor renders the popover's FORM body; a host
//     mounting it inside a real `.hk-popover-panel` gets the sheet's
//     `:not(.hk-is-sheet)` rows cap for free.
//   * NO OVERLAY SCROLLBARS: the editor rows viewport keeps the sheet's
//     native-mechanics-hidden rule; the shared overlay scrollbar
//     (`attachOverlayScrollbars`) is host chrome.
//   * NO `useId`: the caller passes `id` (it names the editable and seeds
//     the panel-rows / row ids); without it no ids are emitted, so
//     `aria-owns` / `aria-activedescendant` stay absent rather than dangle.
//   * NO `isComposing` GUARD: `KeyboardEvent` carries no composition flag
//     (the same trade `tag_input.rs` documents).
//   * NO IME `composing` DEFERRAL: same cause — normalization is host-side.
//   * VALIDATION + DIRTY CHECK are a Rust-side pure surface
//     ([`template_field_validate`], [`template_field_is_dirty`]): Vue only
//     displays host-supplied `error` text; the mirror ships the checks a
//     host needs to produce one and the echo-guard gate for parent writes.
//   * `groupLabel` (a Vue FUNCTION prop) is `Option<Rc<dyn Fn(&str) ->
//     String>>` — the `data/cell.rs` `render` precedent; `None` passes the
//     group key through verbatim, exactly Vue's default.
//   * i18n NAMESPACE: Vue reads `hikari::templateField.*`; the Rust bundle
//     resolves `components.hk.<component>.<key>`
//     (`packages/i18n/src/locales/*/components.toml`), so the mirror reads
//     `components.hk.templateField.*` — five keys new in this wave (see the
//     receipt); until they land the English defaults compiled here are used.
//   * `submitOnEnter` → `submit_on_enter` — the same contract `Input`
//     documents (Enter with no active suggestion row).

#![allow(clippy::type_complexity)]
#![allow(clippy::redundant_clone)]
use std::rc::Rc;

use hikari_i18n::t;

use crate::basic::{
    Button, ButtonProps, ButtonSize, ButtonVariant, Input, TemplateSegment, TemplateTokenDef,
    format_token_display, is_template_whitespace, parse_template, serialize_template,
    tag_is_subsequence,
};
use crate::feedback::popover::{PopoverAnchorRect, PopoverPlacement, popover_position_style};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TemplateFieldComponent;

/// The live `{{ query` autocomplete trigger (Vue: the `OPEN_TRIGGER_RE`
/// match). `start`/`end` are CHAR offsets into the value; `end` is always
/// the caret the trigger was detected at; `query` is the typed identifier so
/// far ("" for a bare `{{ `).
#[derive(Clone, PartialEq, Debug)]
pub struct TemplateFieldTrigger {
    pub start: usize,
    pub end: usize,
    pub query: String,
}

/// The serialized-offset span of the live `{{ query` trigger, matched against
/// the value's prefix up to the caret (Vue: `OPEN_TRIGGER_RE` =
/// `/\{\{\s*([A-Za-z0-9_]*)$/`). Identifiers only — anything else (a filter
/// pipe, a space inside the braces) drops out of trigger state and the panel
/// closes. Char offsets; see the header's offset delta.
pub fn template_field_open_trigger(before_caret: &str) -> Option<TemplateFieldTrigger> {
    let chars: Vec<char> = before_caret.chars().collect();
    // Walk back from the caret: optional identifier characters, optional
    // grammar whitespace, then the two literal braces.
    let mut ident_end = chars.len();
    while ident_end > 0 && template_field_is_ident_char(chars[ident_end - 1]) {
        ident_end -= 1;
    }
    let query_start = ident_end;
    let mut braces = ident_end;
    while braces > 0 && is_template_whitespace(chars[braces - 1]) {
        braces -= 1;
    }
    if braces >= 2 && chars[braces - 1] == '{' && chars[braces - 2] == '{' {
        Some(TemplateFieldTrigger {
            start: braces - 2,
            end: chars.len(),
            query: chars[query_start..].iter().collect(),
        })
    } else {
        None
    }
}

/// `[A-Za-z0-9_]` — the identifier class the grammar allows inside the braces
/// (the same class `template_text.rs`'s private matcher walks; restated here
/// because that one is crate-private to its module).
pub fn template_field_is_ident_char(ch: char) -> bool {
    ch.is_ascii_alphanumeric() || ch == '_'
}

/// Vue's `filterTokens`: the HkAffixPicker TWO-PASS vocabulary filter — an
/// exact (case-folded) substring over one field at a time for precision
/// (name, label, description), then an in-order character subsequence
/// fallback with gaps allowed ("md5e" still finds md5_email). An empty (or
/// whitespace-only) query returns the vocabulary verbatim.
pub fn template_field_filter_tokens(
    defs: &[TemplateTokenDef],
    query: &str,
) -> Vec<TemplateTokenDef> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return defs.to_vec();
    }
    let fields = |def: &TemplateTokenDef| {
        [
            def.name.to_lowercase(),
            def.label.clone().unwrap_or_default().to_lowercase(),
            def.description.clone().unwrap_or_default().to_lowercase(),
        ]
    };
    let substring: Vec<TemplateTokenDef> = defs
        .iter()
        .filter(|def| fields(def).iter().any(|field| field.contains(&q)))
        .cloned()
        .collect();
    if !substring.is_empty() {
        return substring;
    }
    defs.iter()
        .filter(|def| {
            fields(def)
                .iter()
                .any(|field| tag_is_subsequence(&q, field))
        })
        .cloned()
        .collect()
}

/// One vocabulary row, carrying its index in the FILTERED list — the payload
/// Vue hands its `renderRow` callback (`{def, index}`): row ids and the
/// keyboard cursor address that index.
#[derive(Clone, PartialEq, Debug)]
pub struct TemplateFieldRowEntry {
    pub index: usize,
    pub def: TemplateTokenDef,
}

/// One rendered band of vocabulary rows (Vue: `renderGroupedRows`' runs).
/// `Some(label)` is a labeled `role="group"` wrapper; `None` is a BARE run
/// (rows outside any group — a leading ungrouped stretch, exactly Vue).
#[derive(Clone, PartialEq, Debug)]
pub struct TemplateFieldRowGroup {
    pub label: Option<String>,
    pub entries: Vec<TemplateFieldRowEntry>,
}

/// Vue's `renderGroupedRows` grouping rule: a token WITH a `group` opens a
/// labeled band when the RESOLVED label differs from the currently open one
/// (two keys that map to one label stay in one band); a token WITHOUT a
/// group is not a section of its own — it continues under the previous
/// heading's band, and a leading ungrouped stretch renders bare. Give every
/// token a group when the sections must be airtight (Vue's prop doc).
pub fn template_field_group_rows(
    defs: &[TemplateTokenDef],
    group_label: Option<&dyn Fn(&str) -> String>,
) -> Vec<TemplateFieldRowGroup> {
    let mut groups: Vec<TemplateFieldRowGroup> = Vec::new();
    for (index, def) in defs.iter().cloned().enumerate() {
        if let Some(group) = def.group.clone() {
            let label = match group_label {
                Some(resolve) => resolve(&group),
                None => group,
            };
            let same_band = groups
                .last()
                .is_some_and(|run| run.label.as_deref() == Some(label.as_str()));
            if !same_band {
                groups.push(TemplateFieldRowGroup {
                    label: Some(label),
                    entries: Vec::new(),
                });
            }
        }
        match groups.last_mut() {
            Some(run) => run.entries.push(TemplateFieldRowEntry { index, def }),
            None => groups.push(TemplateFieldRowGroup {
                label: None,
                entries: vec![TemplateFieldRowEntry { index, def }],
            }),
        }
    }
    groups
}

/// Vue's `pickSuggestion`: the chosen token's canonical spelling replaces the
/// open trigger span (or APPENDS at the end when no trigger is live), and the
/// caret lands right after the inserted chip. Offsets are clamped defensively
/// (the host owns the span and may hold one from a stale value).
pub fn template_field_pick(
    value: &str,
    trigger: Option<&TemplateFieldTrigger>,
    token: &str,
) -> (String, usize) {
    let raw = format_token_display(token);
    let raw_width = raw.chars().count();
    let mut chars: Vec<char> = value.chars().collect();
    let caret = match trigger {
        Some(trigger) => {
            let start = trigger.start.min(chars.len());
            let end = trigger.end.clamp(start, chars.len());
            chars.splice(start..end, raw.chars());
            start + raw_width
        }
        None => {
            chars.extend(raw.chars());
            chars.len()
        }
    };
    (chars.into_iter().collect(), caret)
}

/// Vue's `insertAtCaret`: splice `text` in at the caret (a range selection
/// needs the Selection API — see the header), caret right after it.
pub fn template_field_insert(value: &str, caret: usize, text: &str) -> (String, usize) {
    let mut chars: Vec<char> = value.chars().collect();
    let at = caret.min(chars.len());
    let width = text.chars().count();
    chars.splice(at..at, text.chars());
    (chars.into_iter().collect(), at + width)
}

/// Vue's `deleteDirection` (single caret; a range selection needs the
/// Selection API — see the header). A caret hugging a chip edge takes the
/// WHOLE chip (the atomic edit: backward at the chip's end edge, forward at
/// its start edge); anything else deletes one character. `None` when there is
/// nothing to delete (Vue returns silently).
pub fn template_field_delete(value: &str, caret: usize, forward: bool) -> Option<(String, usize)> {
    let mut chars: Vec<char> = value.chars().collect();
    let at = caret.min(chars.len());
    if !forward && at == 0 {
        return None;
    }
    if forward && at == chars.len() {
        return None;
    }
    // Chip edges: walk the parsed segments with their serialized widths — a
    // caret exactly at a chip boundary removes the chip.
    let mut cursor = 0usize;
    for segment in parse_template(value) {
        let width = segment.raw().chars().count();
        if matches!(segment, TemplateSegment::Token { .. }) {
            let hit = if forward {
                at == cursor
            } else {
                at == cursor + width
            };
            if hit {
                chars.drain(cursor..cursor + width);
                return Some((chars.into_iter().collect(), cursor));
            }
        }
        cursor += width;
    }
    let remove_at = if forward { at } else { at - 1 };
    if remove_at >= chars.len() {
        return None;
    }
    chars.remove(remove_at);
    Some((chars.into_iter().collect(), remove_at))
}

/// Vue's `applyChipToken`: swap chip `chip`'s token for `token` (its raw
/// becomes the canonical spelling of the new name), keeping its position.
/// Editing resumes right AFTER the swapped chip — the running caret total is
/// frozen at the chip (the Vue R3 finding). `None` when the chip index is out
/// of range.
pub fn template_field_apply_token(
    value: &str,
    chip: usize,
    token: &str,
) -> Option<(String, usize)> {
    let raw = format_token_display(token);
    let raw_width = raw.chars().count();
    let mut segments = parse_template(value);
    let mut seen = 0usize;
    let mut caret = 0usize;
    let mut caret_after_chip: Option<usize> = None;
    for segment in &mut segments {
        let width = segment.raw().chars().count();
        match segment {
            TemplateSegment::Text(text) => caret += text.chars().count(),
            TemplateSegment::Token {
                token: name,
                raw: seg_raw,
            } => {
                if seen == chip {
                    *name = token.to_string();
                    *seg_raw = raw.clone();
                    caret += raw_width;
                    caret_after_chip = Some(caret);
                } else {
                    caret += width;
                }
                seen += 1;
            }
        }
    }
    caret_after_chip.map(|caret| (serialize_template(&segments), caret))
}

/// Vue's `removeChip`: drop chip `chip` entirely; editing resumes WHERE it
/// was (the caret frozen before the dropped raw). `None` when the chip index
/// is out of range.
pub fn template_field_remove_chip(value: &str, chip: usize) -> Option<(String, usize)> {
    let mut kept: Vec<TemplateSegment> = Vec::new();
    let mut seen = 0usize;
    let mut caret = 0usize;
    let mut caret_at_chip: Option<usize> = None;
    for segment in parse_template(value) {
        match segment {
            TemplateSegment::Text(text) => {
                caret += text.chars().count();
                kept.push(TemplateSegment::Text(text));
            }
            TemplateSegment::Token { token, raw } => {
                if seen == chip {
                    caret_at_chip = Some(caret);
                } else {
                    caret += raw.chars().count();
                    kept.push(TemplateSegment::Token { token, raw });
                }
                seen += 1;
            }
        }
    }
    caret_at_chip.map(|caret| (serialize_template(&kept), caret))
}

/// The field's validation report (a Rust-side surface; Vue displays
/// host-supplied error text only): the vocabulary the panel offers is the
/// field's own alphabet, so a value is well-formed exactly when every parsed
/// token is in it.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TemplateFieldValidation {
    /// How many token segments the value carries.
    pub token_count: usize,
    /// Token names the vocabulary does NOT carry, in first-appearance order,
    /// deduplicated.
    pub unknown_tokens: Vec<String>,
}

/// See [`TemplateFieldValidation`].
pub fn template_field_validate(
    value: &str,
    tokens: &[TemplateTokenDef],
) -> TemplateFieldValidation {
    let segments = parse_template(value);
    let mut unknown_tokens: Vec<String> = Vec::new();
    let mut token_count = 0usize;
    for segment in &segments {
        if let TemplateSegment::Token { token, .. } = segment {
            token_count += 1;
            if !tokens.iter().any(|def| &def.name == token)
                && !unknown_tokens.iter().any(|known| known == token)
            {
                unknown_tokens.push(token.clone());
            }
        }
    }
    TemplateFieldValidation {
        token_count,
        unknown_tokens,
    }
}

/// Vue's echo-guard gate (`v !== lastEmitted.value`): true when the incoming
/// model value differs from the field's last emission — an EXTERNAL write the
/// chips must be rebuilt for. A parent echoing the field's own emission back
/// is NOT dirty (the rebuild would churn the surface under the caret for
/// nothing; the host skips it so the caret mapping stays stable).
pub fn template_field_is_dirty(incoming: &str, last_emitted: &str) -> bool {
    incoming != last_emitted
}

/// What resolving the editable's keydown did (Vue: `onKeydown`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum TemplateFieldKeyAction {
    /// Not this component's key.
    None,
    /// ArrowUp / ArrowDown with the panel open and rows present: walk the
    /// cursor (wrapping).
    MoveActive(i32),
    /// Enter / Tab (unshifted) with the panel open and rows present: pick
    /// the cursor's row.
    PickActive,
    /// Escape with the panel open (also stops propagation — a host dialog's
    /// own Escape must not fire behind the panel).
    ClosePanel,
    /// Enter (unshifted) with no active suggestion row: the host's submit
    /// intent.
    Submit,
}

impl TemplateFieldKeyAction {
    /// Whether the key belongs to the field (Vue calls `preventDefault` for
    /// every one of these).
    pub fn consumed(self) -> bool {
        !matches!(self, TemplateFieldKeyAction::None)
    }
}

/// The editable's keydown table, resolved purely (Vue: `onKeydown`). The
/// panel's chord rules only apply while rows are present; Enter falls through
/// to the submit intent when they are not.
pub fn resolve_template_field_key(
    key: &str,
    shift: bool,
    suggest_open: bool,
    rows_len: usize,
) -> TemplateFieldKeyAction {
    if suggest_open && rows_len > 0 {
        match key {
            "ArrowDown" | "ArrowUp" => {
                return TemplateFieldKeyAction::MoveActive(if key == "ArrowDown" { 1 } else { -1 });
            }
            "Enter" => return TemplateFieldKeyAction::PickActive,
            "Tab" if !shift => return TemplateFieldKeyAction::PickActive,
            _ => {}
        }
    }
    if key == "Escape" && suggest_open {
        return TemplateFieldKeyAction::ClosePanel;
    }
    if key == "Enter" && !shift {
        return TemplateFieldKeyAction::Submit;
    }
    TemplateFieldKeyAction::None
}

/// Vue's cursor step: `(suggestActive + dir + n) % n` — wrapping in both
/// directions. 0 when there is nothing to walk (Vue guards the same way at
/// the call site).
pub fn template_field_step_active(active: i32, rows_len: usize, delta: i32) -> i32 {
    if rows_len == 0 {
        return 0;
    }
    let count = rows_len as i32;
    (active + delta + count) % count
}

/// The cursor row the panel highlights (and `aria-activedescendant` points
/// at): Vue clamps `suggestActive` to the last row; a negative cursor has no
/// row (no dangling id reference).
pub fn template_field_active_row_index(active: i32, rows_len: usize) -> Option<usize> {
    if rows_len == 0 {
        return None;
    }
    let clamped = active.min(rows_len as i32 - 1);
    if clamped < 0 {
        None
    } else {
        Some(clamped as usize)
    }
}

/// Vue: `panelRowsId = `hk-tpl-panel-${fieldId}`` — `None` when the caller
/// passed no `id` (no id, no `aria-owns` target).
pub fn template_field_panel_rows_id(id: Option<&str>) -> Option<String> {
    id.map(|id| format!("hk-tpl-panel-{id}"))
}

/// Vue: `${panelRowsId}-row-${index}`.
pub fn template_field_row_id(panel_rows_id: Option<&str>, index: usize) -> Option<String> {
    panel_rows_id.map(|base| format!("{base}-row-{index}"))
}

/// The box's class list (Vue: the error modifier rides the box while an error
/// shows — an EMPTY error string is no error, exactly Vue's truthiness).
pub fn template_field_box_classes(has_error: bool) -> &'static str {
    if has_error {
        "hk-template-field-box hk-template-field-box-error"
    } else {
        "hk-template-field-box"
    }
}

/// The vocabulary panel's inline geometry: with an anchor rect the shared
/// twelve-placement helper pins it DIRECTLY BELOW the field (bottom-start,
/// below-first by user direction 2026-10-10 — the viewport clamp absorbs a
/// short viewport instead of a flip); without one it pins to the nearest
/// positioned ancestor one offset below the box (the `admin_header.rs` no-
/// anchor fallback — a host without measurement wraps the field in its own
/// positioned element).
pub fn template_field_panel_style(anchor: Option<PopoverAnchorRect>, offset: f64) -> String {
    match anchor {
        Some(anchor) => popover_position_style(PopoverPlacement::BottomStart, anchor, offset),
        None => format!("position:absolute;left:0;top:calc(100% + {offset}px)"),
    }
}

/// Vue's `maxHeight="min(18rem, 45dvh)"` — the panel's one scroll cap.
pub const TEMPLATE_FIELD_PANEL_MAX_HEIGHT: &str = "min(18rem, 45dvh)";

/// Vue: `t("hikari::templateField.suggestTitle", "Placeholders")` — the
/// vocabulary panel's surface name (HkMenu's `title`).
pub fn template_field_suggest_title() -> String {
    t("components.hk.templateField.suggestTitle", "Placeholders")
}

/// Vue: `t("hikari::templateField.suggestEmpty", "No matching placeholders")`.
pub fn template_field_suggest_empty() -> String {
    t(
        "components.hk.templateField.suggestEmpty",
        "No matching placeholders",
    )
}

/// Vue: `t("hikari::templateField.chipEditorTitle", "Edit placeholder")` —
/// the chip editor's surface name (HPopover's `title` and the rows listbox's
/// `aria-label`).
pub fn template_field_chip_editor_title() -> String {
    t(
        "components.hk.templateField.chipEditorTitle",
        "Edit placeholder",
    )
}

/// Vue: `t("hikari::templateField.chipSearch", "Search placeholders")`.
pub fn template_field_chip_search_placeholder() -> String {
    t(
        "components.hk.templateField.chipSearch",
        "Search placeholders",
    )
}

/// Vue: `t("hikari::templateField.chipRemove", "Remove")` — the editor
/// footer's remove verb.
pub fn template_field_chip_remove_label() -> String {
    t("components.hk.templateField.chipRemove", "Remove")
}

/// The controlled event wiring (Vue: `setup(props, { emit })`): every write
/// is a callback, nothing is stored — the host owns the value, the caret and
/// both surfaces' state exactly as it owns the vocabulary.
#[derive(Clone)]
struct TemplateFieldWiring {
    model_value: String,
    trigger: Option<TemplateFieldTrigger>,
    suggest_open: bool,
    suggest_active: i32,
    editor_chip: Option<usize>,
    submit_on_enter: Option<EventHandler<()>>,
    onupdate_model_value: Option<EventHandler<String>>,
    oncaret: Option<EventHandler<usize>>,
    on_suggest_open_change: Option<EventHandler<bool>>,
    on_suggest_active: Option<EventHandler<i32>>,
    on_editor_open_change: Option<EventHandler<bool>>,
    on_editor_chip: Option<EventHandler<Option<usize>>>,
    on_editor_token: Option<EventHandler<String>>,
    on_editor_query: Option<EventHandler<String>>,
}

impl TemplateFieldWiring {
    /// Vue's `setValue`: the value first, then the caret editing resumes at.
    fn set_value(&self, value: String, caret: usize) {
        if let Some(handler) = self.onupdate_model_value.as_ref() {
            handler.call(value);
        }
        if let Some(handler) = self.oncaret.as_ref() {
            handler.call(caret);
        }
    }

    /// Vue's `closeSuggestions` (the host clears `trigger` on the same edge —
    /// the two share a lifecycle in `syncSuggestState`).
    fn close_suggestions(&self) {
        if self.suggest_open
            && let Some(handler) = self.on_suggest_open_change.as_ref()
        {
            handler.call(false);
        }
    }

    /// Vue's `pickSuggestion`: splice the chip in place of the trigger, close
    /// the panel, emit value + caret.
    fn pick(&self, token: &str) {
        let (value, caret) = template_field_pick(&self.model_value, self.trigger.as_ref(), token);
        self.close_suggestions();
        self.set_value(value, caret);
    }

    /// Vue's `openChipEditor`: the four ref writes as controlled channels.
    /// An open vocabulary panel trades for the editor (one popup surface at a
    /// time — its anchor is this same field, so its shield would not fire).
    fn open_chip_editor(&self, chip: usize, token: &str) {
        self.close_suggestions();
        if let Some(handler) = self.on_editor_chip.as_ref() {
            handler.call(Some(chip));
        }
        if let Some(handler) = self.on_editor_token.as_ref() {
            handler.call(token.to_string());
        }
        if let Some(handler) = self.on_editor_query.as_ref() {
            handler.call(String::new());
        }
        if let Some(handler) = self.on_editor_open_change.as_ref() {
            handler.call(true);
        }
    }

    fn close_chip_editor(&self) {
        if let Some(handler) = self.on_editor_open_change.as_ref() {
            handler.call(false);
        }
    }

    /// Vue's `applyChipToken`: swap the chip's token, close the editor, emit
    /// value + caret (editing resumes right AFTER the swapped chip).
    fn apply_token(&self, token: &str) {
        if let Some(chip) = self.editor_chip
            && let Some((value, caret)) = template_field_apply_token(&self.model_value, chip, token)
        {
            self.close_chip_editor();
            self.set_value(value, caret);
        }
    }

    /// Vue's `removeChip`: drop the chip, close the editor, emit value +
    /// caret (editing resumes WHERE it was).
    fn remove_chip(&self) {
        if let Some(chip) = self.editor_chip
            && let Some((value, caret)) = template_field_remove_chip(&self.model_value, chip)
        {
            self.close_chip_editor();
            self.set_value(value, caret);
        }
    }

    fn set_editor_query(&self, query: String) {
        if let Some(handler) = self.on_editor_query.as_ref() {
            handler.call(query);
        }
    }

    /// The editable's keydown (Vue: `onKeydown`). The disabled field consumes
    /// nothing (`contenteditable="false"` delivers no keys in a live host).
    fn key(&self, event: KeyboardEvent, filtered: &[TemplateTokenDef]) {
        let action = resolve_template_field_key(
            &event.key,
            event.shift_key,
            self.suggest_open,
            filtered.len(),
        );
        if action.consumed() {
            event.prevent_default();
        }
        match action {
            TemplateFieldKeyAction::None => {}
            TemplateFieldKeyAction::MoveActive(delta) => {
                let next = template_field_step_active(self.suggest_active, filtered.len(), delta);
                if let Some(handler) = self.on_suggest_active.as_ref() {
                    handler.call(next);
                }
            }
            TemplateFieldKeyAction::PickActive => {
                if let Some(index) =
                    template_field_active_row_index(self.suggest_active, filtered.len())
                    && let Some(def) = filtered.get(index)
                {
                    let name = def.name.clone();
                    self.pick(&name);
                }
            }
            TemplateFieldKeyAction::ClosePanel => {
                event.stop_propagation();
                self.close_suggestions();
            }
            TemplateFieldKeyAction::Submit => {
                if let Some(handler) = self.submit_on_enter.as_ref() {
                    handler.call(());
                }
            }
        }
    }
}

/// Vue's presence-only marker attribute: `data-*` carries `"true"` while the
/// flag is on and is absent otherwise (a serialized `="false"` would read as
/// a value to an attribute selector).
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// One lucide glyph, serialized exactly as `lucide-vue-next` renders it: the
/// 24-unit viewBox, the stroke attribute set, the
/// `lucide lucide-{name}-icon lucide-{name}` class pair and the automatic
/// `aria-hidden="true"` (ledger L49: the glyph rides a
/// `dangerous_inner_html` + `display:contents` host).
fn lucide_icon_svg(name: &str, size: u32, body: &str) -> String {
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" \
         viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" \
         stroke-linecap=\"round\" stroke-linejoin=\"round\" \
         class=\"lucide lucide-{name}-icon lucide-{name}\" aria-hidden=\"true\">{body}</svg>"
    )
}

/// lucide `trash-2`'s paths + rules (`<Trash2 size={14} />`).
const LUCIDE_TRASH_2_BODY: &str = concat!(
    r#"<path d="M3 6h18"></path>"#,
    r#"<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>"#,
    r#"<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>"#,
    r#"<line x1="10" x2="10" y1="11" y2="17"></line>"#,
    r#"<line x1="14" x2="14" y1="11" y2="17"></line>"#,
);

/// The grouped rows both surfaces render (Vue: `renderGroupedRows` +
/// `renderTokenRow`). The ROLE rides the surface: `panel_cursor` is `Some`
/// for the vocabulary panel (menuitem rows, the keyboard cursor's
/// `data-active`, row ids); `editor_token` is `Some` for the chip editor's
/// listbox (option rows, `aria-selected` + `data-active` on the token being
/// edited). `on_token` receives the picked/apply target's name.
fn token_row_groups<F>(
    groups: &[TemplateFieldRowGroup],
    panel_cursor: Option<usize>,
    editor_token: Option<&str>,
    row_id_base: Option<&str>,
    on_token: F,
) -> Vec<VNode>
where
    F: Fn(&str) + Clone + 'static,
{
    let is_editor = editor_token.is_some();
    let role: &'static str = if is_editor { "option" } else { "menuitem" };
    let mut out: Vec<VNode> = Vec::new();
    for group in groups {
        let mut rows: Vec<VNode> = Vec::with_capacity(group.entries.len());
        for entry in &group.entries {
            let active = if is_editor {
                editor_token == Some(entry.def.name.as_str())
            } else {
                panel_cursor == Some(entry.index)
            };
            let aria_selected = if is_editor {
                Some(if active { "true" } else { "false" })
            } else {
                None
            };
            let data_active = marker_attr(active);
            let row_id = if is_editor {
                None
            } else {
                template_field_row_id(row_id_base, entry.index)
            };
            let display = format_token_display(&entry.def.name);
            let description = entry
                .def
                .description
                .clone()
                .filter(|description| !description.is_empty());
            let name = entry.def.name.clone();
            let on_token = on_token.clone();
            rows.push(rsx! {
                button {
                    "type": "button",
                    class: "hk-tpl-row",
                    role: role,
                    id: row_id,
                    "aria-selected": aria_selected,
                    "data-active": data_active,
                    // Keep the editable's focus (and caret) on the press
                    // (Vue: onMousedown preventDefault).
                    onmousedown: move |event: MouseEvent| event.prevent_default(),
                    onclick: move |event: MouseEvent| {
                        event.stop_propagation();
                        on_token(&name);
                    },
                    span { class: "hk-tpl-row-name", "{display}" }
                    if let Some(description) = description {
                        span { class: "hk-tpl-row-desc", "{description}" }
                    }
                }
            });
        }
        match group.label.clone() {
            Some(label) => out.push(rsx! {
                div {
                    class: "hk-tpl-group",
                    role: "group",
                    "aria-label": label.clone(),
                    div { class: "hk-tpl-group-label", "aria-hidden": "true", "{label}" }
                    {VNode::Fragment(rows)}
                }
            }),
            None => out.extend(rows),
        }
    }
    out
}

// Raw `#[derive(Props)]` (the `data/cell.rs` `render` precedent), NOT
// `#[define_props]`: the DSL macro force-derives `PartialEq`, which no
// `Rc<dyn Fn>` field has — so `Default` and `PartialEq` are hand-written
// below exactly as the DSL would have generated them.
#[derive(Clone, Props)]
pub struct TemplateFieldProps {
    /// The raw `{{ token }}` value, verbatim from storage (Vue `modelValue`,
    /// default "").
    #[props(default)]
    pub model_value: String,

    /// Vocabulary offered by the panel + chip editor (Vue `tokens`, the
    /// shared `HkTemplateTokenDef` of `templateGrammar.ts` — the same
    /// [`TemplateTokenDef`] the read-only `TemplateText` renders from).
    #[props(default)]
    pub tokens: Vec<TemplateTokenDef>,

    /// Field caption; points the label at the editable (label clicks focus,
    /// screen readers announce the field by name).
    #[props(default)]
    pub label: Option<String>,

    /// Muted helper line under the field (hidden while an error shows).
    #[props(default)]
    pub hint: Option<String>,

    /// Error line + the box's error face (an EMPTY string is no error,
    /// exactly Vue's truthiness).
    #[props(default)]
    pub error: Option<String>,

    /// The `:empty` placeholder of the editable (Vue `placeholder`,
    /// default "").
    #[props(default)]
    pub placeholder: String,

    #[props(default)]
    pub disabled: bool,

    /// Submit intent on Enter (when no suggestion row is active) — the same
    /// contract as `Input`.
    #[props(default)]
    pub submit_on_enter: Option<EventHandler<()>>,

    /// Maps a token's `group` key to the heading label shown over its run
    /// (Vue: the `groupLabel` FUNCTION prop). `None` passes the key through
    /// verbatim — groups are consumer-defined technical keys.
    #[props(default)]
    pub group_label: Option<Rc<dyn Fn(&str) -> String>>,

    /// Element id of the editable (Vue generates one with `useId`); also
    /// seeds the panel-rows / row ids. Without it no ids are emitted.
    #[props(default)]
    pub id: Option<String>,

    /// The trigger rect to anchor the vocabulary panel against
    /// (`feedback::popover::anchor_rect_from_element_id` measures one by id);
    /// `None` pins the popout to the nearest positioned ancestor.
    #[props(default)]
    pub panel_anchor: Option<PopoverAnchorRect>,

    /// Gap between the field and the vocabulary panel (Vue: HkMenu's
    /// `offset` default 6).
    #[props(default = 6.0)]
    pub panel_offset: f64,

    // ── controlled state (Vue keeps every one in local refs) ──────────────
    /// Vocabulary panel visibility (Vue: `suggestOpen`).
    #[props(default)]
    pub suggest_open: bool,

    /// The typed identifier inside the live `{{ query` trigger (Vue:
    /// `suggestQuery`) — the panel's filter input.
    #[props(default)]
    pub suggest_query: String,

    /// The panel's keyboard cursor: an index into the FILTERED rows (Vue:
    /// `suggestActive`).
    #[props(default = 0)]
    pub suggest_active: i32,

    /// The live trigger's serialized span (Vue: `triggerRange`) — what a pick
    /// replaces. The host sets it with `suggest_open` (they share a
    /// lifecycle) and clears it on close.
    #[props(default)]
    pub trigger: Option<TemplateFieldTrigger>,

    /// Chip editor visibility (Vue: `editorOpen`).
    #[props(default)]
    pub editor_open: bool,

    /// The chip the editor edits, by token-segment index (Vue holds the DOM
    /// element).
    #[props(default)]
    pub editor_chip: Option<usize>,

    /// The token name the editor shows (Vue: `editorToken`).
    #[props(default)]
    pub editor_token: String,

    /// The editor's search query (Vue: `editorQuery`).
    #[props(default)]
    pub editor_query: String,

    // ── events ────────────────────────────────────────────────────────────
    /// Vue: `update:modelValue` — the full next value.
    #[props(default)]
    pub onupdate_model_value: Option<EventHandler<String>>,

    /// The caret writer: every pick / apply / remove emits the serialized
    /// offset editing resumes at (Vue parks the caret itself; see the
    /// header's engine delta).
    #[props(default)]
    pub oncaret: Option<EventHandler<usize>>,

    /// The editable's RAW input event, forwarded untouched — the host
    /// normalizes through the pure algebra and writes `model_value` back
    /// (see the header's engine delta).
    #[props(default)]
    pub on_input: Option<EventHandler<InputEvent>>,

    /// Fires with the desired panel state (Vue: HkMenu's `update:open`).
    #[props(default)]
    pub on_suggest_open_change: Option<EventHandler<bool>>,

    /// The keyboard cursor's writer (Vue: the local `suggestActive` writes).
    #[props(default)]
    pub on_suggest_active: Option<EventHandler<i32>>,

    /// Fires with the desired editor state (Vue: HPopover's
    /// `update:modelValue`).
    #[props(default)]
    pub on_editor_open_change: Option<EventHandler<bool>>,

    /// The edited chip's writer (Vue: the local `editorChip` ref writes;
    /// `None` on close).
    #[props(default)]
    pub on_editor_chip: Option<EventHandler<Option<usize>>>,

    /// The edited token name's writer (Vue: the local `editorToken` writes).
    #[props(default)]
    pub on_editor_token: Option<EventHandler<String>>,

    /// The editor search's writer (Vue: the local `editorQuery` writes).
    #[props(default)]
    pub on_editor_query: Option<EventHandler<String>>,
}

impl Default for TemplateFieldProps {
    fn default() -> Self {
        Self {
            model_value: String::new(),
            tokens: Vec::new(),
            label: None,
            hint: None,
            error: None,
            placeholder: String::new(),
            disabled: false,
            submit_on_enter: None,
            group_label: None,
            id: None,
            panel_anchor: None,
            panel_offset: 6.0,
            suggest_open: false,
            suggest_query: String::new(),
            suggest_active: 0,
            trigger: None,
            editor_open: false,
            editor_chip: None,
            editor_token: String::new(),
            editor_query: String::new(),
            onupdate_model_value: None,
            oncaret: None,
            on_input: None,
            on_suggest_open_change: None,
            on_suggest_active: None,
            on_editor_open_change: None,
            on_editor_chip: None,
            on_editor_token: None,
            on_editor_query: None,
        }
    }
}

impl PartialEq for TemplateFieldProps {
    /// Field-wise equality; `group_label` compares by `Rc` identity — an
    /// `Rc<dyn Fn>` has no value equality (the `message_box.rs` / `cell.rs`
    /// function-prop precedent).
    fn eq(&self, other: &Self) -> bool {
        self.model_value == other.model_value
            && self.tokens == other.tokens
            && self.label == other.label
            && self.hint == other.hint
            && self.error == other.error
            && self.placeholder == other.placeholder
            && self.disabled == other.disabled
            && self.submit_on_enter == other.submit_on_enter
            && match (&self.group_label, &other.group_label) {
                (None, None) => true,
                (Some(a), Some(b)) => Rc::ptr_eq(a, b),
                _ => false,
            }
            && self.id == other.id
            && self.panel_anchor == other.panel_anchor
            && self.panel_offset == other.panel_offset
            && self.suggest_open == other.suggest_open
            && self.suggest_query == other.suggest_query
            && self.suggest_active == other.suggest_active
            && self.trigger == other.trigger
            && self.editor_open == other.editor_open
            && self.editor_chip == other.editor_chip
            && self.editor_token == other.editor_token
            && self.editor_query == other.editor_query
            && self.onupdate_model_value == other.onupdate_model_value
            && self.oncaret == other.oncaret
            && self.on_input == other.on_input
            && self.on_suggest_open_change == other.on_suggest_open_change
            && self.on_suggest_active == other.on_suggest_active
            && self.on_editor_open_change == other.on_editor_open_change
            && self.on_editor_chip == other.on_editor_chip
            && self.on_editor_token == other.on_editor_token
            && self.on_editor_query == other.on_editor_query
    }
}

#[component]
pub fn TemplateField(props: TemplateFieldProps) -> Element {
    let segments = parse_template(&props.model_value);
    let filtered = template_field_filter_tokens(&props.tokens, &props.suggest_query);
    let editor_filtered = template_field_filter_tokens(&props.tokens, &props.editor_query);

    // Vue truthiness: empty strings are falsy for label/hint/error.
    let label_text = props.label.clone().filter(|label| !label.is_empty());
    let error_text = props.error.clone().filter(|error| !error.is_empty());
    let has_error = error_text.is_some();
    // Vue: `{props.hint && !props.error && <p hint/>}`.
    let hint_text = if has_error {
        None
    } else {
        props.hint.clone().filter(|hint| !hint.is_empty())
    };

    let panel_rows_id = template_field_panel_rows_id(props.id.as_deref());
    let rows_count = filtered.len();
    let active_row_index = template_field_active_row_index(props.suggest_active, rows_count);
    // Vue: `aria-expanded={suggestOpen || undefined}` — the attribute exists
    // only in the open state.
    let aria_expanded = if props.suggest_open {
        Some("true")
    } else {
        None
    };
    let aria_owns = if props.suggest_open && rows_count > 0 {
        panel_rows_id.clone()
    } else {
        None
    };
    let aria_active = if props.suggest_open && rows_count > 0 {
        active_row_index.and_then(|index| template_field_row_id(panel_rows_id.as_deref(), index))
    } else {
        None
    };

    let wiring = TemplateFieldWiring {
        model_value: props.model_value.clone(),
        trigger: props.trigger.clone(),
        suggest_open: props.suggest_open,
        suggest_active: props.suggest_active,
        editor_chip: props.editor_chip,
        submit_on_enter: props.submit_on_enter.clone(),
        onupdate_model_value: props.onupdate_model_value.clone(),
        oncaret: props.oncaret.clone(),
        on_suggest_open_change: props.on_suggest_open_change.clone(),
        on_suggest_active: props.on_suggest_active.clone(),
        on_editor_open_change: props.on_editor_open_change.clone(),
        on_editor_chip: props.on_editor_chip.clone(),
        on_editor_token: props.on_editor_token.clone(),
        on_editor_query: props.on_editor_query.clone(),
    };

    // ── the editable: text runs + whole-token chips, in source order ─────
    let mut edit_children: Vec<VNode> = Vec::with_capacity(segments.len());
    let mut chip_counter: usize = 0;
    for segment in &segments {
        match segment {
            TemplateSegment::Text(text) => {
                edit_children.push(VNode::Text(VText::new(text.as_str())));
            }
            TemplateSegment::Token { token, raw } => {
                let index = chip_counter;
                chip_counter += 1;
                let token = token.clone();
                let raw = raw.clone();
                let display = format_token_display(&token);
                let token_name = token.clone();
                let chip_wiring = wiring.clone();
                let chip_disabled = props.disabled;
                edit_children.push(rsx! {
                    span {
                        class: "hk-tpl-chip",
                        contenteditable: "false",
                        "data-token": token,
                        "data-raw": raw,
                        // Vue resolves the field press back to
                        // `target.closest(".hk-tpl-chip")`; without DOM queries
                        // the chip stops the press itself — the same "a chip
                        // press opens the editor, never the panel" rule.
                        onclick: move |event: MouseEvent| {
                            event.prevent_default();
                            event.stop_propagation();
                            if !chip_disabled {
                                chip_wiring.open_chip_editor(index, &token_name);
                            }
                        },
                        "{display}"
                    }
                });
            }
        }
    }

    let key_wiring = wiring.clone();
    let key_rows = filtered.clone();
    let key_disabled = props.disabled;

    // ── the vocabulary panel (open only) ─────────────────────────────────
    let panel = if props.suggest_open {
        let suggest_title = template_field_suggest_title();
        let panel_style = template_field_panel_style(props.panel_anchor, props.panel_offset);
        let panel_max_height =
            format!("--hk-select-panel-max-height:{TEMPLATE_FIELD_PANEL_MAX_HEIGHT}");
        let body = if rows_count > 0 {
            let groups = template_field_group_rows(&filtered, props.group_label.as_deref());
            let pick = {
                let wiring = wiring.clone();
                move |name: &str| wiring.pick(name)
            };
            let rows = token_row_groups(
                &groups,
                active_row_index,
                None,
                panel_rows_id.as_deref(),
                pick,
            );
            let rows_id = panel_rows_id.clone();
            rsx! {
                div { class: "hk-tpl-rows", id: rows_id, {VNode::Fragment(rows)} }
            }
        } else {
            let empty_text = template_field_suggest_empty();
            rsx! {
                p { class: "hk-tpl-rows-empty", "{empty_text}" }
            }
        };
        // HkMenu's Escape-close edge (`admin_header.rs`'s mirror pattern):
        // the panel asks its owner to close, and only consumes the key when
        // it actually closed something.
        let panel_key_wiring = wiring.clone();
        let panel_key = move |event: KeyboardEvent| {
            if event.key.as_str() == "Escape" {
                event.prevent_default();
                event.stop_propagation();
                panel_key_wiring.close_suggestions();
            }
        };
        rsx! {
            div {
                class: "hk-select-popout-host",
                "data-side": "bottom",
                "data-align": "start",
                style: panel_style,
                div {
                    class: "hk-select-popout",
                    "aria-label": suggest_title,
                    style: panel_max_height,
                    onkeydown: panel_key,
                    {body}
                }
            }
        }
    } else {
        empty_vnode()
    };

    // ── the chip editor (open only) ──────────────────────────────────────
    let editor = if props.editor_open {
        let editor_title = template_field_chip_editor_title();
        let current_display = format_token_display(&props.editor_token);
        // Vue: `editorDef = tokenIndex.get(editorToken)` — only the
        // description is read here.
        let editor_description = props
            .tokens
            .iter()
            .find(|def| def.name == props.editor_token)
            .and_then(|def| def.description.clone())
            .filter(|description| !description.is_empty());

        let groups = template_field_group_rows(&editor_filtered, props.group_label.as_deref());
        let apply = {
            let wiring = wiring.clone();
            move |name: &str| wiring.apply_token(name)
        };
        let editor_rows = token_row_groups(
            &groups,
            None,
            Some(props.editor_token.as_str()),
            None,
            apply,
        );
        let editor_rows_empty = editor_filtered.is_empty();
        let empty_text = template_field_suggest_empty();

        // The search field is Vue's nested HkInput (mirrored `Input`).
        let search_wiring = wiring.clone();
        let search_placeholder = template_field_chip_search_placeholder();
        let search_field = rsx! {
            Input {
                model_value: props.editor_query.clone(),
                placeholder: Some(search_placeholder),
                oninput: Some(event_handler(move |value: String| {
                    search_wiring.set_editor_query(value);
                })),
            }
        };
        // Enter in the search picks the first matching row — the
        // HkAffixPicker `onSearchEnter` convention (the keyboard flow never
        // has to leave the field to click).
        let search_key_wiring = wiring.clone();
        let search_first = editor_filtered.first().cloned();
        let search_key = move |event: KeyboardEvent| {
            if event.key.as_str() != "Enter" {
                return;
            }
            if let Some(first) = search_first.as_ref() {
                event.prevent_default();
                let name = first.name.clone();
                search_key_wiring.apply_token(&name);
            }
        };

        let remove_wiring = wiring.clone();
        let remove_label = template_field_chip_remove_label();
        let remove_button = rsx! {
            Button {
                variant: ButtonVariant::Ghost,
                size: ButtonSize::Sm,
                children: VNode::Fragment(vec![
                    rsx! {
                        div {
                            style: "display:contents",
                            dangerous_inner_html: lucide_icon_svg(
                                "trash-2",
                                14,
                                LUCIDE_TRASH_2_BODY,
                            ),
                        }
                    },
                    VNode::Text(VText::new(remove_label.as_str())),
                ]),
                onclick: Some(EventHandler::new(move |_event: MouseEvent| {
                    remove_wiring.remove_chip();
                })),
                ..Default::default()
            }
        };

        rsx! {
            div { class: "hk-tpl-editor",
                div { class: "hk-tpl-editor-current",
                    span { class: "hk-tpl-chip", "data-static": "", "{current_display}" }
                    if let Some(description) = editor_description {
                        span { class: "hk-tpl-editor-desc", "{description}" }
                    }
                }
                div {
                    class: "hk-tpl-editor-search",
                    onkeydown: search_key,
                    {search_field}
                }
                div { class: "hk-tpl-editor-scroll",
                    div {
                        class: "hk-tpl-editor-rows",
                        role: "listbox",
                        "aria-label": editor_title,
                        {VNode::Fragment(editor_rows)}
                        if editor_rows_empty {
                            p { class: "hk-tpl-rows-empty", "{empty_text}" }
                        }
                    }
                }
                div { class: "hk-tpl-editor-footer", {remove_button} }
            }
        }
    } else {
        empty_vnode()
    };

    // ── the field shell ──────────────────────────────────────────────────
    let box_classes = template_field_box_classes(has_error);
    rsx! {
        div {
            class: "hk-template-field",
            "data-disabled": marker_attr(props.disabled),
            if let Some(label) = label_text {
                label {
                    class: "hk-template-field-label",
                    "for": props.id.clone(),
                    "{label}"
                }
            }
            div {
                class: box_classes,
                div {
                    id: props.id.clone(),
                    class: "hk-template-field-edit",
                    contenteditable: if props.disabled { "false" } else { "true" },
                    role: "textbox",
                    "aria-multiline": "false",
                    "aria-haspopup": "menu",
                    "aria-expanded": aria_expanded,
                    "aria-owns": aria_owns,
                    "aria-activedescendant": aria_active,
                    spellcheck: "false",
                    "data-ph": props.placeholder.clone(),
                    // Native `oninput` takes a callable, not the raw
                    // `Option<EventHandler>` — forward when present.
                    oninput: {
                        let on_input = props.on_input.clone();
                        move |event: InputEvent| {
                            if let Some(cb) = &on_input {
                                cb.call(event);
                            }
                        }
                    },
                    onkeydown: move |event: KeyboardEvent| {
                        if key_disabled {
                            return;
                        }
                        key_wiring.key(event, &key_rows);
                    },
                    {VNode::Fragment(edit_children)}
                }
            }
            if let Some(hint) = hint_text {
                p { class: "hk-template-field-hint", "{hint}" }
            }
            if let Some(error) = error_text {
                p { class: "hk-template-field-error", "{error}" }
            }
            {panel}
            {editor}
        }
    }
}

impl StyledComponent for TemplateFieldComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-template-field*` / `.hk-tpl-*` names literal so this CSS
        // matches the Vue build). The sheet is SHARED with the read-only
        // `TemplateText` mirror (Vue's HkTemplateText imports this same file)
        // — see the header's registry note: register it under ONE name or
        // the bundle carries the bytes twice.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTemplateField.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "template-field"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn def(name: &str, label: Option<&str>, description: Option<&str>) -> TemplateTokenDef {
        TemplateTokenDef {
            name: name.to_string(),
            label: label.map(str::to_string),
            description: description.map(str::to_string),
            group: None,
        }
    }

    fn grouped(name: &str, group: &str) -> TemplateTokenDef {
        TemplateTokenDef {
            name: name.to_string(),
            label: None,
            description: None,
            group: Some(group.to_string()),
        }
    }

    fn trigger(start: usize, end: usize, query: &str) -> TemplateFieldTrigger {
        TemplateFieldTrigger {
            start,
            end,
            query: query.to_string(),
        }
    }

    // ── props defaults ───────────────────────────────────────────────────

    #[test]
    fn template_field_defaults_match_the_vue_props() {
        let props = TemplateFieldProps::default();
        assert_eq!(props.model_value, "");
        assert!(props.tokens.is_empty());
        assert!(props.label.is_none());
        assert!(props.hint.is_none());
        assert!(props.error.is_none());
        assert_eq!(props.placeholder, "");
        assert!(!props.disabled);
        assert!(props.submit_on_enter.is_none());
        assert!(props.group_label.is_none());
        assert!(props.id.is_none());
        // Vue: HkMenu's `offset` default 6.
        assert_eq!(props.panel_offset, 6.0);
        assert!(!props.suggest_open);
        assert_eq!(props.suggest_query, "");
        assert_eq!(props.suggest_active, 0);
        assert!(props.trigger.is_none());
        assert!(!props.editor_open);
        assert!(props.editor_chip.is_none());
        assert_eq!(props.editor_token, "");
        assert_eq!(props.editor_query, "");
        assert!(props.onupdate_model_value.is_none());
        assert!(props.oncaret.is_none());
        assert!(props.on_input.is_none());
        assert!(props.on_suggest_open_change.is_none());
        assert!(props.on_suggest_active.is_none());
        assert!(props.on_editor_open_change.is_none());
        assert!(props.on_editor_chip.is_none());
        assert!(props.on_editor_token.is_none());
        assert!(props.on_editor_query.is_none());
    }

    // ── pure surface: trigger / filter / groups ──────────────────────────

    #[test]
    fn template_field_open_trigger_matches_the_vue_regex() {
        // A live trigger reports its span and the typed query.
        assert_eq!(
            template_field_open_trigger("Hi {{ em"),
            Some(trigger(3, 8, "em"))
        );
        // Bare braces and a whitespace-only query still trigger.
        assert_eq!(template_field_open_trigger("{{"), Some(trigger(0, 2, "")));
        assert_eq!(template_field_open_trigger("{{ "), Some(trigger(0, 3, "")));
        // The regex finds the LAST brace pair that can reach the caret.
        assert_eq!(
            template_field_open_trigger("a {{ x{{ y"),
            Some(trigger(6, 10, "y"))
        );
        // Identifiers are `[A-Za-z0-9_]` only.
        assert_eq!(
            template_field_open_trigger("{{ a_1"),
            Some(trigger(0, 6, "a_1"))
        );

        // Anything else drops out of trigger state: a space inside the
        // query, a filter pipe, a stray close, no braces at all, a trailing
        // space after the identifier.
        for text in ["{{ a b", "{{ a|b", "}}", "text", "{{ a ", "x{{a}", "{ {a"] {
            assert!(
                template_field_open_trigger(text).is_none(),
                "{text:?} must not trigger"
            );
        }
    }

    #[test]
    fn template_field_filter_tokens_is_two_pass() {
        let tokens = vec![
            def("md5_email", Some("Hash"), Some("md5 of the address")),
            def("username", None, Some("the login name")),
            def("origin", None, None),
        ];
        // Empty (or whitespace) query: the vocabulary verbatim.
        assert_eq!(
            template_field_filter_tokens(&tokens, "").len(),
            3,
            "empty query returns everything"
        );
        assert_eq!(
            template_field_filter_tokens(&tokens, "  ").len(),
            3,
            "whitespace query returns everything"
        );
        // Pass 1 — substring, case-folded, one field at a time (name, label,
        // description).
        assert_eq!(
            template_field_filter_tokens(&tokens, "MD5"),
            vec![def("md5_email", Some("Hash"), Some("md5 of the address"))]
        );
        assert_eq!(
            template_field_filter_tokens(&tokens, "login"),
            vec![def("username", None, Some("the login name"))]
        );
        // Pass 2 — in-order subsequence fallback with gaps allowed.
        assert_eq!(
            template_field_filter_tokens(&tokens, "m5e"),
            vec![def("md5_email", Some("Hash"), Some("md5 of the address"))]
        );
        // Nothing matches: empty.
        assert!(template_field_filter_tokens(&tokens, "zzz").is_empty());
    }

    #[test]
    fn template_field_group_rows_bands_like_vue() {
        let tokens = vec![
            def("bare", None, None),
            grouped("a1", "alpha"),
            grouped("a2", "alpha"),
            grouped("b1", "beta"),
            def("tail", None, None),
        ];
        let groups = template_field_group_rows(&tokens, None);
        // A leading ungrouped stretch renders bare; same-label keys merge;
        // an ungrouped token CONTINUES under the open band.
        assert_eq!(groups.len(), 3, "{groups:?}");
        assert_eq!(groups[0].label, None);
        assert_eq!(groups[0].entries[0].def.name, "bare");
        assert_eq!(groups[0].entries[0].index, 0);
        assert_eq!(groups[1].label.as_deref(), Some("alpha"));
        assert_eq!(
            groups[1]
                .entries
                .iter()
                .map(|entry| entry.def.name.as_str())
                .collect::<Vec<_>>(),
            vec!["a1", "a2"]
        );
        assert_eq!(groups[2].label.as_deref(), Some("beta"));
        assert_eq!(
            groups[2]
                .entries
                .iter()
                .map(|entry| entry.def.name.as_str())
                .collect::<Vec<_>>(),
            vec!["b1", "tail"]
        );

        // The label resolver compares RESOLVED labels: two keys mapping to
        // one label stay in one band.
        let upper: Rc<dyn Fn(&str) -> String> = Rc::new(|group| group.to_uppercase());
        let tokens = vec![grouped("a1", "alpha"), grouped("a2", "ALPHA")];
        let groups = template_field_group_rows(&tokens, Some(upper.as_ref()));
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].label.as_deref(), Some("ALPHA"));

        // Without a resolver the key passes through verbatim (two bands).
        let groups = template_field_group_rows(&tokens, None);
        assert_eq!(groups.len(), 2);
    }

    // ── pure surface: the edit algebra ───────────────────────────────────

    #[test]
    fn template_field_pick_replaces_the_trigger_span() {
        // The canonical spelling replaces the live `{{ em` span, caret right
        // after the inserted chip.
        let (value, caret) = template_field_pick("Hi {{ em!", Some(&trigger(3, 8, "em")), "email");
        assert_eq!(value, "Hi {{ email }}!");
        assert_eq!(caret, "Hi {{ email }}".chars().count());

        // No live trigger: append at the end.
        let (value, caret) = template_field_pick("a", None, "uid");
        assert_eq!(value, "a{{ uid }}");
        assert_eq!(caret, "a{{ uid }}".chars().count());

        // A stale (out-of-range) span clamps instead of panicking.
        let (value, caret) = template_field_pick("abc", Some(&trigger(2, 99, "x")), "uid");
        assert_eq!(value, "ab{{ uid }}");
        assert_eq!(caret, "ab{{ uid }}".chars().count());
    }

    #[test]
    fn template_field_delete_is_chip_atomic() {
        // A caret at a chip edge takes the WHOLE chip: backward at its end…
        let (value, caret) = template_field_delete("a{{ uid }}b", 10, false)
            .expect("backward delete at the chip end edits");
        assert_eq!(value, "ab");
        assert_eq!(caret, 1);
        // …forward at its start.
        let (value, caret) = template_field_delete("a{{ uid }}b", 1, true)
            .expect("forward delete at the chip start edits");
        assert_eq!(value, "ab");
        assert_eq!(caret, 1);
        // Anywhere else deletes a single character (byte-exact raw text).
        let (value, caret) =
            template_field_delete("a{{ uid }}b", 2, false).expect("mid-text delete edits");
        assert_eq!(value, "a{ uid }}b");
        assert_eq!(caret, 1);
        let (value, caret) = template_field_delete("abc", 2, true).expect("plain delete edits");
        // Vue's dir=+1 branch: `at = start`, so the char AT the caret ("c")
        // goes and the caret parks at `at`.
        assert_eq!(value, "ab");
        assert_eq!(caret, 2);
        // The ends have nothing to delete — `None`, no edit.
        assert_eq!(template_field_delete("abc", 0, false), None);
        assert_eq!(template_field_delete("abc", 3, true), None);
    }

    #[test]
    fn template_field_insert_splices_at_the_caret() {
        let (value, caret) = template_field_insert("ab", 1, "X");
        assert_eq!(value, "aXb");
        assert_eq!(caret, 2);
        // Out-of-range carets clamp.
        let (value, caret) = template_field_insert("ab", 99, "Y");
        assert_eq!(value, "abY");
        assert_eq!(caret, 3);
    }

    #[test]
    fn template_field_apply_and_remove_chip_keep_the_caret_contract() {
        // Apply: the raw becomes the canonical spelling of the new name, and
        // editing resumes right AFTER the swapped chip (the R3 freeze).
        let (value, caret) =
            template_field_apply_token("{{a}} tail", 0, "b").expect("apply swaps the chip");
        assert_eq!(value, "{{ b }} tail");
        assert_eq!(caret, "{{ b }}".chars().count());
        // A mid-value chip keeps its position.
        let (value, caret) =
            template_field_apply_token("x{{a}}{{b}}", 1, "c").expect("mid-value apply edits");
        assert_eq!(value, "x{{a}}{{ c }}");
        assert_eq!(caret, "x{{a}}{{ c }}".chars().count());

        // Remove: the chip disappears and editing resumes WHERE it was.
        let (value, caret) =
            template_field_remove_chip("x{{a}}{{b}}", 1).expect("remove chip edits");
        assert_eq!(value, "x{{a}}");
        assert_eq!(caret, "x{{a}}".chars().count());
        // Out-of-range chip indices are a no-op.
        assert_eq!(template_field_apply_token("{{a}}", 1, "b"), None);
        assert_eq!(template_field_remove_chip("plain text", 0), None);
    }

    // ── pure surface: validation / dirty / keyboard ──────────────────────

    #[test]
    fn template_field_validate_flags_unknown_tokens() {
        let tokens = vec![def("email", None, None), def("uid", None, None)];
        // A known vocabulary passes clean, whatever the raw spacing.
        let report = template_field_validate("{{ email }} {{uid}}", &tokens);
        assert_eq!(report.token_count, 2);
        assert!(report.unknown_tokens.is_empty());
        // Unknown names surface in first-appearance order, deduplicated.
        let report =
            template_field_validate("{{ nope }} {{ email }} {{ nope }} {{ other }}", &tokens);
        assert_eq!(report.token_count, 4);
        assert_eq!(
            report.unknown_tokens,
            vec!["nope".to_string(), "other".to_string()]
        );
        // Plain text carries no tokens.
        let report = template_field_validate("no tokens here", &tokens);
        assert_eq!(report.token_count, 0);
        assert!(report.unknown_tokens.is_empty());
    }

    #[test]
    fn template_field_dirty_check_is_the_echo_guard() {
        // Vue's `v !== lastEmitted.value` gate.
        assert!(!template_field_is_dirty("a", "a"));
        assert!(template_field_is_dirty("a", "b"));
        assert!(!template_field_is_dirty("", ""));
    }

    #[test]
    fn template_field_key_table_matches_vue() {
        use TemplateFieldKeyAction::*;
        // Panel open with rows: the combobox chord.
        assert_eq!(
            resolve_template_field_key("ArrowDown", false, true, 3),
            MoveActive(1)
        );
        assert_eq!(
            resolve_template_field_key("ArrowUp", false, true, 3),
            MoveActive(-1)
        );
        assert_eq!(
            resolve_template_field_key("Enter", false, true, 3),
            PickActive
        );
        assert_eq!(
            resolve_template_field_key("Tab", false, true, 3),
            PickActive
        );
        // Shift+Tab is a focus move, not a pick.
        assert_eq!(resolve_template_field_key("Tab", true, true, 3), None);
        // Escape only closes when the panel is open.
        assert_eq!(
            resolve_template_field_key("Escape", false, true, 0),
            ClosePanel
        );
        assert_eq!(resolve_template_field_key("Escape", false, false, 0), None);
        // Enter is the submit intent when no row is active — also with the
        // panel open but EMPTY (Vue falls through the same way).
        assert_eq!(resolve_template_field_key("Enter", false, false, 0), Submit);
        assert_eq!(resolve_template_field_key("Enter", false, true, 0), Submit);
        assert_eq!(resolve_template_field_key("Enter", true, false, 0), None);
        // Arrows with the panel closed are the browser's.
        assert_eq!(
            resolve_template_field_key("ArrowDown", false, false, 3),
            None
        );

        // The cursor wraps in both directions; nothing to walk stays put.
        assert_eq!(template_field_step_active(0, 3, 1), 1);
        assert_eq!(template_field_step_active(2, 3, 1), 0);
        assert_eq!(template_field_step_active(0, 3, -1), 2);
        assert_eq!(template_field_step_active(1, 0, 1), 0);
        // The highlighted row clamps to the last, like Vue's Math.min.
        assert_eq!(template_field_active_row_index(5, 3), Some(2));
        assert_eq!(template_field_active_row_index(1, 3), Some(1));
        assert_eq!(template_field_active_row_index(0, 0), Option::None);
        assert_eq!(template_field_active_row_index(-1, 3), Option::None);
    }

    // ── pure surface: classes / ids / geometry ───────────────────────────

    #[test]
    fn template_field_shell_helpers_match_vue() {
        assert_eq!(template_field_box_classes(false), "hk-template-field-box");
        assert_eq!(
            template_field_box_classes(true),
            "hk-template-field-box hk-template-field-box-error"
        );
        assert_eq!(
            template_field_panel_rows_id(Some("f1")),
            Some("hk-tpl-panel-f1".to_string())
        );
        assert_eq!(template_field_panel_rows_id(None), None);
        assert_eq!(
            template_field_row_id(Some("hk-tpl-panel-f1"), 2),
            Some("hk-tpl-panel-f1-row-2".to_string())
        );
        assert_eq!(template_field_row_id(None, 2), None);
        // Without an anchor the popout pins below the nearest positioned
        // ancestor (the admin_header fallback); an anchor goes through the
        // shared placement helper.
        assert_eq!(
            template_field_panel_style(None, 6.0),
            "position:absolute;left:0;top:calc(100% + 6px)"
        );
        let anchored = template_field_panel_style(
            Some(PopoverAnchorRect {
                x: 10.0,
                y: 20.0,
                width: 100.0,
                height: 28.0,
            }),
            6.0,
        );
        // bottom-start under the anchor: left at the anchor's start edge,
        // top one offset below its box.
        assert!(anchored.contains("left:10px;"), "{anchored}");
        assert!(anchored.contains("top:54px;"), "{anchored}");
    }

    #[test]
    fn template_field_i18n_resolvers_carry_vue_fallbacks() {
        // The keys are new in this wave; the resolvers must agree with the
        // bundle lookups (installed or not) and keep Vue's English defaults.
        assert_eq!(
            template_field_suggest_title(),
            t("components.hk.templateField.suggestTitle", "Placeholders")
        );
        assert_eq!(
            template_field_suggest_empty(),
            t(
                "components.hk.templateField.suggestEmpty",
                "No matching placeholders"
            )
        );
        assert_eq!(
            template_field_chip_editor_title(),
            t(
                "components.hk.templateField.chipEditorTitle",
                "Edit placeholder"
            )
        );
        assert_eq!(
            template_field_chip_search_placeholder(),
            t(
                "components.hk.templateField.chipSearch",
                "Search placeholders"
            )
        );
        assert_eq!(
            template_field_chip_remove_label(),
            t("components.hk.templateField.chipRemove", "Remove")
        );
    }

    // ── DOM contract ─────────────────────────────────────────────────────

    #[test]
    fn template_field_renders_the_vue_dom_contract() {
        let html = TemplateField(TemplateFieldProps {
            model_value: "Hi {{ email }}!".to_string(),
            tokens: vec![def("email", None, Some("Email address"))],
            label: Some("Fill template".to_string()),
            hint: Some("Mix text and placeholders".to_string()),
            placeholder: "Type {{ to browse".to_string(),
            id: Some("field-1".to_string()),
            ..Default::default()
        })
        .render_to_html();
        // The shell, caption and editable.
        assert!(html.contains(r#"class="hk-template-field""#), "{html}");
        assert!(
            html.contains(r#"class="hk-template-field-label""#),
            "{html}"
        );
        assert!(html.contains(r#"for="field-1""#), "{html}");
        assert!(html.contains("Fill template"), "{html}");
        assert!(html.contains(r#"id="field-1""#), "{html}");
        assert!(html.contains(r#"class="hk-template-field-edit""#), "{html}");
        assert!(html.contains(r#"role="textbox""#), "{html}");
        assert!(html.contains(r#"aria-multiline="false""#), "{html}");
        assert!(html.contains(r#"aria-haspopup="menu""#), "{html}");
        assert!(html.contains(r#"spellcheck="false""#), "{html}");
        assert!(html.contains(r#"contenteditable="true""#), "{html}");
        assert!(html.contains(r#"data-ph="Type {{ to browse""#), "{html}");
        // The chip: byte-exact data-raw, canonical display, atomic.
        assert!(html.contains(r#"class="hk-tpl-chip""#), "{html}");
        assert!(html.contains(r#"contenteditable="false""#), "{html}");
        assert!(html.contains(r#"data-token="email""#), "{html}");
        assert!(html.contains(r#"data-raw="{{ email }}""#), "{html}");
        assert!(html.contains(">{{ email }}<"), "{html}");
        // The text runs serialize verbatim around it.
        assert!(html.contains(">Hi "), "{html}");
        // The hint; closed surfaces render nothing.
        assert!(html.contains(r#"class="hk-template-field-hint""#), "{html}");
        assert!(!html.contains("hk-select-popout"), "{html}");
        assert!(!html.contains("hk-tpl-editor"), "{html}");
        assert!(!html.contains("aria-expanded"), "{html}");
        assert!(!html.contains("aria-owns"), "{html}");
        assert!(!html.contains("data-disabled"), "{html}");

        // The error face swaps the hint for the error line and tones the box.
        let html = TemplateField(TemplateFieldProps {
            hint: Some("hint".to_string()),
            error: Some("Unknown placeholder".to_string()),
            disabled: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains("hk-template-field-box hk-template-field-box-error"),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-template-field-error""#),
            "{html}"
        );
        assert!(!html.contains("hk-template-field-hint"), "{html}");
        assert!(html.contains(r#"data-disabled="true""#), "{html}");
        assert!(html.contains(r#"contenteditable="false""#), "{html}");
    }

    #[test]
    fn template_field_renders_the_vocabulary_panel_contract() {
        let tokens = vec![
            grouped("email", "identity"),
            grouped("uid", "identity"),
            grouped("origin", "request"),
        ];
        let html = TemplateField(TemplateFieldProps {
            tokens,
            suggest_open: true,
            suggest_active: 1,
            id: Some("f2".to_string()),
            ..Default::default()
        })
        .render_to_html();
        // HkMenu's popout chrome, below-start.
        assert!(html.contains(r#"class="hk-select-popout-host""#), "{html}");
        assert!(html.contains(r#"data-side="bottom""#), "{html}");
        assert!(html.contains(r#"data-align="start""#), "{html}");
        assert!(html.contains("hk-select-popout"), "{html}");
        // The combobox wiring: expanded, owning the rows, cursor announced.
        assert!(html.contains(r#"aria-expanded="true""#), "{html}");
        assert!(html.contains(r#"aria-owns="hk-tpl-panel-f2""#), "{html}");
        assert!(
            html.contains(r#"aria-activedescendant="hk-tpl-panel-f2-row-1""#),
            "{html}"
        );
        // Grouped rows: role=group wrappers carrying the accessible name,
        // the visible band inside, menuitem rows with cursor data-active.
        assert!(html.contains(r#"class="hk-tpl-rows""#), "{html}");
        assert!(html.contains(r#"id="hk-tpl-panel-f2""#), "{html}");
        assert!(html.contains(r#"class="hk-tpl-group""#), "{html}");
        assert!(html.contains(r#"role="group""#), "{html}");
        assert!(html.contains(r#"aria-label="identity""#), "{html}");
        assert!(html.contains(r#"class="hk-tpl-group-label""#), "{html}");
        assert!(html.contains(r#"role="menuitem""#), "{html}");
        assert!(html.contains(r#"id="hk-tpl-panel-f2-row-1""#), "{html}");
        assert!(html.contains(r#"data-active="true""#), "{html}");
        assert!(html.contains(r#"class="hk-tpl-row-name""#), "{html}");
        assert!(html.contains(">{{ email }}<"), "{html}");

        // A query with no match trades the rows for the empty line and drops
        // the owns/activedescendant wiring (Vue: `filteredTokens.length > 0`).
        let html = TemplateField(TemplateFieldProps {
            tokens: vec![def("email", None, None)],
            suggest_open: true,
            suggest_query: "zzz".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-tpl-rows-empty"), "{html}");
        assert!(!html.contains(r#"class="hk-tpl-rows""#), "{html}");
        assert!(!html.contains("aria-owns"), "{html}");
        assert!(!html.contains("aria-activedescendant"), "{html}");
    }

    #[test]
    fn template_field_renders_the_chip_editor_contract() {
        let tokens = vec![
            def("email", None, Some("Email address")),
            def("uid", None, None),
        ];
        let html = TemplateField(TemplateFieldProps {
            tokens,
            editor_open: true,
            editor_chip: Some(0),
            editor_token: "email".to_string(),
            ..Default::default()
        })
        .render_to_html();
        // The form bands, in Vue's order.
        assert!(html.contains(r#"class="hk-tpl-editor""#), "{html}");
        assert!(html.contains(r#"class="hk-tpl-editor-current""#), "{html}");
        // The current chip is the STATIC spelling with its description.
        assert!(html.contains(r#"data-static="""#), "{html}");
        assert!(html.contains(">{{ email }}<"), "{html}");
        assert!(html.contains(r#"class="hk-tpl-editor-desc""#), "{html}");
        assert!(html.contains("Email address"), "{html}");
        // The search + the listbox with option rows; the edited token is
        // selected AND active.
        assert!(html.contains(r#"class="hk-tpl-editor-search""#), "{html}");
        assert!(html.contains(r#"class="hk-tpl-editor-scroll""#), "{html}");
        assert!(html.contains(r#"class="hk-tpl-editor-rows""#), "{html}");
        assert!(html.contains(r#"role="listbox""#), "{html}");
        assert!(html.contains(r#"role="option""#), "{html}");
        assert!(html.contains(r#"aria-selected="true""#), "{html}");
        assert!(html.contains(r#"aria-selected="false""#), "{html}");
        assert!(html.contains(r#"data-active="true""#), "{html}");
        // The footer: the ghost remove verb with lucide's trash-2 glyph.
        assert!(html.contains(r#"class="hk-tpl-editor-footer""#), "{html}");
        assert!(html.contains("hk-btn-ghost"), "{html}");
        assert!(html.contains("lucide-trash-2"), "{html}");
        assert!(html.contains(">Remove<"), "{html}");
    }

    // ── styles ───────────────────────────────────────────────────────────

    #[test]
    fn template_field_styles_come_from_the_canonical_vue_sheet() {
        let css = TemplateFieldComponent::styles();
        for class in [
            ".hk-template-field",
            ".hk-template-field-edit",
            ".hk-template-field-box-error",
            ".hk-tpl-chip",
            ".hk-tpl-rows",
            ".hk-tpl-group-label",
            ".hk-tpl-row",
            ".hk-tpl-editor",
            ".hk-tpl-editor-footer",
            ".hk-tpl-rows-empty",
        ] {
            assert!(
                css.contains(class),
                "template-field css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored template sheet"
        );
        // The SHARED sheet also carries the read-only half's classes (Vue's
        // HkTemplateText imports this same file).
        assert!(css.contains(".hk-template-text"), "{css:.120}");
    }
}
