// hi-components/src/basic/tag_input.rs
// TagInput — mirror of the canonical Vue `HkTagInput`: the tag editor field.
// Selected tags live IN the field as closable chips, and one searchable catalog
// panel toggles catalog membership.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTagInput.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by
// `tests/vue_mirror_drift_tests.rs`), compiled with `no_hash` so the
// `.hk-tag-input*` class names are literal and identical in both forms. The DOM
// contract below mirrors the Vue render output:
//
//   div.hk-tag-input-wrapper
//     label.hk-tag-input-label [for=id]                    (label && !disabled)
//     div.hk-tag-input-box.hk-tag-input-box-{size}  [.hk-tag-input-box-open]
//         [data-disabled] [data-full] [role=group] [aria-label]
//       ── chips, in HOST order (the mirror of Vue's keyed HkListTransition) ──
//       span.hk-tag.hk-tag-default.hk-tag-{sm,md}.hk-tag-input-tag
//         span.hk-tag-input-tag-text {label}
//         button.hk-tag-close [aria-label="Remove — {label}"]   (!disabled)
//       ── inline typing input (disabled drops it) ──
//       input.hk-tag-input-element
//           id type="text" style="width:{n}ch" [value]
//           role="combobox" [aria-expanded] [aria-controls] aria-autocomplete="list"
//           aria-haspopup="listbox" [aria-activedescendant] [aria-label]
//           [readonly] [placeholder] autocomplete="off" spellcheck="false"
//           data-1p-ignore data-lpignore="true"
//         or, while DISABLED, span.hk-tag-input-placeholder {placeholder}
//       button.hk-tag-input-chevron
//           type="button" [disabled] aria-haspopup="listbox" [aria-expanded]
//           aria-label={title} title={title}
//     p.hk-tag-input-hint                                 (hint)
//     div.hk-tag-input-panel                              (open only; the
//         div.hk-tag-input-search role="search"           mirrored `Input` is
//           div.hk-input-wrapper > … > input.hk-input-element   Vue's HkInput)
//         div#{listboxId}.hk-tag-input-list
//             role="listbox" aria-multiselectable="true" aria-label={title}
//           div.hk-tag-input-row
//               id role="option" tabindex="-1" aria-selected [aria-disabled]
//               [data-selected] [data-checked] [data-disabled] [data-active]
//               [data-reorder]
//             span.hk-tag-input-check aria-hidden="true"    (✓ when selected)
//             span.hk-tag-input-row-flag aria-hidden="true" (flag)
//             span.hk-tag-input-row-label {labelOf(option)}
//             span.hk-tag-input-row-meta {meta}
//             span.hk-tag-input-grip role="button" tabindex="-1"
//                 aria-label={reorder label} title={reorder label}  (selected &&
//                 !disabled — the drag handle's marker in Vue's DOM)
//           div.hk-tag-input-row[data-custom="true"]        (the "Use “q”" row)
//         div.hk-tag-input-empty {emptyText}                (no rows, no custom)
//
// Vue prop mapping: `modelValue` → [`TagInputProps::model_value`] (host order,
// and order IS host state), `options` → [`TagInputProps::options`]
// ([`TagOption`]), `allowCustom` → [`TagInputProps::allow_custom`], `label` →
// [`TagInputProps::label`], `placeholder` → [`TagInputProps::placeholder`],
// `hint` → [`TagInputProps::hint`], `disabled` → [`TagInputProps::disabled`],
// `size` → [`TagInputSize`], `maxTags` → [`TagInputProps::max_tags`] (0 =
// unlimited, Vue's `undefined`), `searchPlaceholder` /
// `emptyText` → [`TagInputProps::search_placeholder`] /
// [`TagInputProps::empty_text`] (i18n fallbacks exactly like Vue). The emits are
// `update:modelValue` → [`TagInputProps::onupdate_model_value`], `add` →
// `onadd`, `remove` → `onremove`, `open` → `onupdate_open`; Vue's internal
// `query` / `activeIndex` / `open` refs are the CONTROLLED
// [`TagInputProps::query`] / [`TagInputProps::active_index`] /
// [`TagInputProps::open`] plus their `onquery` / `onactive` writers — the same
// controlled-state contract `basic/select.rs` documents (tairitsu 0.5.22 has no
// per-instance component state: `use_signal` allocates a fresh signal per render
// and `use_state` shares ONE slot per component type).
//
// The whole panel algebra is a PURE surface ([`TagPanelState`]), ported from the
// Vue setup's computeds and handlers, so the contract is testable without a DOM:
// row order is GROUP-STRICT (selected options in host order, then unselected
// catalog options in catalog order, the custom row last — a query filters WITHIN
// the groups and never re-sorts them), the filter is a two-pass
// substring-then-subsequence rule over one field at a time, adds APPEND, removes
// splice in place, and [`resolve_tag_key`] is the keyboard table
// (Enter/Backspace/ArrowUp/ArrowDown/Escape plus the Alt+Arrow reorder chord).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `HkSelectPanel` / NO POPUP HOST: the panel renders IN PLACE as the
//     field's last child (Vue teleports it into a desktop popout or a mobile
//     bottom sheet through the shared popup manager, with outside-click close,
//     `matchAnchorWidth={false}` and a `min(18rem, 45dvh)` cap). The panel keeps
//     its own designed measure from the sheet; the HOST owns outside dismissal
//     and stacking, exactly like the mirrored `Select`/`Popover` surfaces.
//   * NO `HkListTransition`: no FLIP move animation, no leave-squeeze ghost (so
//     the `hk-list-reveal-leave-active` bookkeeping Vue needs has no analogue).
//   * NO POINTER REORDER: Vue's `usePointerReorder` drives two drag strips
//     (chips on X, selected rows on Y through the grip) by measuring live
//     rects. tairitsu 0.5.22 exposes no element-rect/element-ref pairing, so the
//     mirror renders the SAME state hooks (`data-reorder`, the grip handle, the
//     chip lift classes in the sheet) but nothing starts a drag: `data-dragging`
//     / `data-drop` are never emitted. Reordering remains available through the
//     keyboard — [`TagPanelState::nudge`] is the exact `nudgeActiveRow` edit.
//   * NO GENERATED ID (`useId`) AND NO `encodeURIComponent` DEPENDENCY: the
//     caller passes `id` (+ optional `listbox_id`); the row / listbox / custom
//     stop ids derive from it with [`encode_uri_component`]. Without an `id` no
//     ids are emitted at all, so `aria-controls` / `aria-activedescendant` stay
//     absent rather than dangling (the caption's `for` is dropped the same way).
//   * NO `isComposing` GUARD: `KeyboardEvent` carries no composition flag, so a
//     key pressed mid-IME-composition is handled like any other.
//   * NO FOCUS HANDLES: Vue refocuses the inline input after a field press and
//     keeps its caret across the chevron press. The mirror keeps the chevron
//     press from moving focus (`preventDefault` on mousedown, like Vue) but
//     cannot move focus itself.
//   * The box press drops Vue's `target.closest(".hk-tag-close"/".hk-tag-input-
//     chevron")` resolution: the chip's ×, the chevron and the rows all
//     `stopPropagation` their presses instead, which is the same observable
//     "a press on those never opens the panel" rule without DOM queries.
//   * The GLYPHS are lucide `lucide-vue-next` nodes rendered through
//     `dangerous_inner_html` on `display:contents` hosts (`rsx!`'s `svg {}`
//     lands in the HTML namespace in this host stack). Markup, 24-unit viewBox,
//     stroke attributes, `lucide lucide-{name}-icon lucide-{name}` class pair
//     and the auto `aria-hidden="true"` are byte-for-byte the library's own
//     output; the Vue source's `size` becomes the width/height pair.
//   * `HkTag.scss` is NOT part of the vendored mirror set (`manifest.tsv` lists
//     the chip hooks' own sheet only), so the chip's background/radius/close
//     chrome beyond `.hk-tag-input-tag*` is host-supplied. The chip's exact
//     `hk-tag hk-tag-{variant} hk-tag-{size}` root class list IS mirrored.
//   * `searchPlaceholder` / `emptyText` / the remove + reorder labels come from
//     `hikari_i18n` with Vue's own fallbacks; Vue's `interpolate` helper is
//     reproduced by [`tag_input_reorder_label`].

use hikari_i18n::t;

use crate::basic::{Input, InputSize};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TagInputComponent;

/// One entry of the tag catalog the field picks from (Vue: `HkTagOption`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TagOption {
    /// Stable identity — the value emitted back to the host.
    pub key: String,

    /// Primary row AND tag text.
    pub label: String,

    /// Secondary muted text (code suffix, hint).
    pub meta: Option<String>,

    /// Optional leading glyph (flag emoji or any short symbol).
    pub flag: Option<String>,

    /// Extra haystack for the search filter (aliases, codes, digits).
    pub keywords: Option<String>,

    /// Cannot be toggled ON (still renders its check when it is set).
    pub disabled: bool,
}

/// The field size step (Vue: `"sm" | "md" | "lg"`, default `"md"`). The CHIP
/// size is Vue's separate `tagSize` computed (`sm` stays small, everything else
/// is `md`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TagInputSize {
    Sm,
    #[default]
    Md,
    Lg,
}

impl TagInputSize {
    /// The `hk-tag-input-box-{size}` modifier exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            TagInputSize::Sm => "hk-tag-input-box-sm",
            TagInputSize::Md => "hk-tag-input-box-md",
            TagInputSize::Lg => "hk-tag-input-box-lg",
        }
    }

    /// Vue's `tagSize` computed: the chip's `hk-tag-{size}` class.
    pub fn chip_class(self) -> &'static str {
        match self {
            TagInputSize::Sm => "hk-tag-sm",
            TagInputSize::Md | TagInputSize::Lg => "hk-tag-md",
        }
    }
}

/// One committed edit to the host's ordered key list (Vue: the
/// `add`/`remove` + `update:modelValue` pair, or a bare `update:modelValue`
/// for a reorder — nothing was added or removed there).
#[derive(Clone, PartialEq, Debug)]
pub enum TagEdit {
    Add { key: String, next: Vec<String> },
    Remove { key: String, next: Vec<String> },
    Reorder { next: Vec<String> },
}

impl TagEdit {
    /// The full next array the host writes back into `modelValue`.
    pub fn next(&self) -> &[String] {
        match self {
            TagEdit::Add { next, .. }
            | TagEdit::Remove { next, .. }
            | TagEdit::Reorder { next } => next,
        }
    }

    /// The key that was toggled ON, when this edit was an add.
    pub fn added_key(&self) -> Option<&str> {
        match self {
            TagEdit::Add { key, .. } => Some(key),
            _ => None,
        }
    }

    /// The key that was toggled OFF, when this edit was a remove.
    pub fn removed_key(&self) -> Option<&str> {
        match self {
            TagEdit::Remove { key, .. } => Some(key),
            _ => None,
        }
    }
}

/// What resolving the typed query did (Vue: `commitQuery`, plus the query
/// consumption `addCustom` performs).
#[derive(Clone, PartialEq, Debug)]
pub struct TagQueryCommit {
    pub edit: TagEdit,

    /// True when the typed query itself became a tag, so the host must clear
    /// `query` (Vue: `query.value = ""` inside `addCustom`).
    pub consumed_query: bool,
}

/// A keyboard reorder (Vue: `nudgeActiveRow`): the edit plus the cursor's new
/// stop, because the stops rebuild in the new order and the cursor follows the
/// row the user moved.
#[derive(Clone, PartialEq, Debug)]
pub struct TagReorder {
    pub edit: TagEdit,
    pub active_index: i32,
}

/// One keyboard stop of the field (Vue: `onInlineKeydown` / `onSearchKeydown`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum TagKeyAction {
    /// Not this component's key.
    None,

    /// Enter: resolve the query (see [`TagPanelState::commit_query`]).
    CommitQuery,

    /// Backspace on an EMPTY inline query: remove the last tag in host order.
    RemoveLast,

    /// ArrowDown / ArrowUp while the panel is closed: the canonical combobox
    /// step is "open the panel" (which starts with no cursor).
    OpenPanel,

    /// ArrowDown / ArrowUp while the panel is open: walk the cursor.
    MoveActive(i32),

    /// Escape with the panel open (or on the panel's search field).
    ClosePanel,

    /// Alt+ArrowUp / Alt+ArrowDown: move the active selected row one slot.
    NudgeActive(i32),
}

impl TagKeyAction {
    /// Whether the key belongs to the field (Vue calls `preventDefault` for
    /// every one of these — "Alt+Arrow is not a plain arrow, the browser must
    /// not act on it either").
    pub fn consumed(self) -> bool {
        !matches!(self, TagKeyAction::None)
    }
}

/// The field's keydown table, resolved purely (Vue: `onInlineKeydown` with
/// `search: false`, `onSearchKeydown` with `search: true`). The Alt+Arrow
/// reorder chord is consumed even when the cursor has nowhere to go.
pub fn resolve_tag_key(
    key: &str,
    alt: bool,
    search: bool,
    query_empty: bool,
    open: bool,
) -> TagKeyAction {
    if alt && (key == "ArrowUp" || key == "ArrowDown") {
        return TagKeyAction::NudgeActive(if key == "ArrowUp" { -1 } else { 1 });
    }
    match key {
        "Enter" => TagKeyAction::CommitQuery,
        // Backspace only removes when the inline query is empty, and only on
        // the field's own input (the panel's search field never removes).
        "Backspace" if !search && query_empty => TagKeyAction::RemoveLast,
        "ArrowDown" | "ArrowUp" => {
            let delta = if key == "ArrowDown" { 1 } else { -1 };
            if search || open {
                TagKeyAction::MoveActive(delta)
            } else {
                TagKeyAction::OpenPanel
            }
        }
        "Escape" => {
            if open || search {
                TagKeyAction::ClosePanel
            } else {
                TagKeyAction::None
            }
        }
        _ => TagKeyAction::None,
    }
}

/// True when every character of `query` appears in `text` in the same order —
/// gaps allowed ("中国" finds 中华人民共和国). Callers lowercase both sides
/// first, matching the substring pass (Vue: `isSubsequence`; the walk is
/// character-level, which is identical to Vue's per-code-unit walk for BMP
/// text and correct for astral text where Vue's is not).
pub fn tag_is_subsequence(query: &str, text: &str) -> bool {
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

/// Vue's `WIDE_GLYPH`: East-Asian wide glyphs occupy two `ch` units, which keeps
/// an auto-grown inline input from clipping CJK queries.
pub fn tag_is_wide_glyph(ch: char) -> bool {
    matches!(
        ch as u32,
        0x1100..=0x115F
            | 0x2E80..=0xA4CF
            | 0xAC00..=0xD7A3
            | 0xF900..=0xFAFF
            | 0xFE30..=0xFE6F
            | 0xFF00..=0xFF60
            | 0xFFE0..=0xFFE6
    )
}

/// Vue's `inlineWidth` computed: the query (or the placeholder while the query
/// is empty) measured in `ch` units plus one caret unit, never under 2.
pub fn tag_inline_width_ch(query: &str, placeholder: &str) -> usize {
    let text = if query.is_empty() { placeholder } else { query };
    let units: usize = text
        .chars()
        .map(|ch| if tag_is_wide_glyph(ch) { 2 } else { 1 })
        .sum();
    (units + 1).max(2)
}

/// Vue's `matchesQuery`: a TWO-PASS filter over a single field at a time (never
/// across concatenated fields, which produces noise) — an exact (case-folded)
/// substring for precision, then an in-order character subsequence fallback, so
/// a CJK-composed label is still found by its short form. `query` is expected
/// trimmed and lowercased, exactly what `rows` passes.
pub fn tag_matches_query(option: &TagOption, query: &str) -> bool {
    if query.is_empty() {
        return true;
    }
    let label = option.label.to_lowercase();
    if label.contains(query) {
        return true;
    }
    let meta = option.meta.as_deref().map(str::to_lowercase);
    if meta.as_deref().is_some_and(|meta| meta.contains(query)) {
        return true;
    }
    let key = option.key.to_lowercase();
    if key.contains(query) {
        return true;
    }
    let keywords = option.keywords.as_deref().map(str::to_lowercase);
    if keywords
        .as_deref()
        .is_some_and(|keywords| keywords.contains(query))
    {
        return true;
    }
    // Fuzzy fallback — per field, in-order subsequence, gaps allowed.
    if tag_is_subsequence(query, &label) {
        return true;
    }
    if meta
        .as_deref()
        .is_some_and(|meta| tag_is_subsequence(query, meta))
    {
        return true;
    }
    if tag_is_subsequence(query, &key) {
        return true;
    }
    keywords
        .as_deref()
        .is_some_and(|keywords| tag_is_subsequence(query, keywords))
}

/// The panel's rows in READING ORDER — every matching option, never pruned by
/// selection (that is what keeps "used / not used" visible), but GROUP-STRICT:
/// the selected options first in the HOST's `modelValue` order, then the
/// unselected options in catalog order. The query filters WITHIN each group: it
/// can hide rows, it can never re-sort them or merge the groups.
pub fn tag_row_order(options: &[TagOption], selected: &[String], query: &str) -> Vec<TagOption> {
    let matched: Vec<TagOption> = options
        .iter()
        .filter(|option| tag_matches_query(option, query))
        .cloned()
        .collect();
    if selected.is_empty() {
        return matched;
    }
    // modelValue position of a key (a duplicated key keeps its first).
    let mut order: Vec<(&str, usize)> = Vec::new();
    for (index, key) in selected.iter().enumerate() {
        if !order.iter().any(|(known, _)| *known == key.as_str()) {
            order.push((key.as_str(), index));
        }
    }
    let mut chosen: Vec<TagOption> = Vec::new();
    let mut rest: Vec<TagOption> = Vec::new();
    for option in matched {
        if order.iter().any(|(key, _)| *key == option.key.as_str()) {
            chosen.push(option);
        } else {
            rest.push(option);
        }
    }
    // A stable sort by host position (Vue's `Array.prototype.sort` is stable).
    chosen.sort_by_key(|option| {
        order
            .iter()
            .find(|(key, _)| *key == option.key.as_str())
            .map(|(_, index)| *index)
            .unwrap_or(0)
    });
    chosen.extend(rest);
    chosen
}

/// Vue's `moveTo`: move the entry at `from` to the place of the entry at `to`,
/// returning a fresh array — or `None` when the move says nothing (the same
/// slot, or either index out of range). Insert-at-target semantics: the entries
/// between the two shift by one.
pub fn tag_move_to(list: &[String], from: usize, to: usize) -> Option<Vec<String>> {
    if from == to || from >= list.len() || to >= list.len() {
        return None;
    }
    let mut next = list.to_vec();
    let key = next.remove(from);
    next.insert(to, key);
    Some(next)
}

/// `encodeURIComponent` — the unreserved characters plus the sub-delims the
/// JavaScript builtin keeps verbatim; everything else becomes `%XX` UTF-8
/// octets. Used to keep an arbitrary host key inside one DOM id.
pub fn encode_uri_component(value: &str) -> String {
    const KEEP: &str = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()";
    let mut encoded = String::with_capacity(value.len());
    for ch in value.chars() {
        if KEEP.contains(ch) {
            encoded.push(ch);
        } else {
            let mut buffer = [0u8; 4];
            for byte in ch.encode_utf8(&mut buffer).as_bytes() {
                encoded.push_str(&format!("%{byte:02X}"));
            }
        }
    }
    encoded
}

/// Vue: `https://…-option-${encodeURIComponent(key)}`'s Rust form — the single
/// spelling a row renders AND `aria-activedescendant` publishes, so the two can
/// never drift. `None` when the caller passed no `id` (no id, no dangling
/// reference).
pub fn tag_input_option_stop_id(id: Option<&str>, key: &str) -> Option<String> {
    id.map(|id| format!("{id}-option-{}", encode_uri_component(key)))
}

/// Vue: `listboxId = `${generatedId}-listbox`` — explicit `listbox_id` wins,
/// otherwise it derives from `id`, otherwise nothing is emitted.
pub fn tag_input_listbox_id(id: Option<&str>, listbox_id: Option<&str>) -> Option<String> {
    match listbox_id {
        Some(listbox_id) => Some(listbox_id.to_string()),
        None => id.map(|id| format!("{id}-listbox")),
    }
}

/// The `aria-activedescendant` id of the row the cursor is on (the custom row is
/// the LAST stop). A cursor past the end is no cursor.
pub fn tag_input_active_id(
    id: Option<&str>,
    active_index: i32,
    rows: &[TagOption],
    custom_visible: bool,
) -> Option<String> {
    if active_index < 0 {
        return None;
    }
    let index = active_index as usize;
    if index < rows.len() {
        return tag_input_option_stop_id(id, &rows[index].key);
    }
    if index == rows.len() && custom_visible {
        return id.map(|id| format!("{id}-custom"));
    }
    None
}

/// Vue: `props.label ?? t("hikari::tagInput.title", "Tags")` — `??`, so an
/// EMPTY caller label stays empty while `None` falls back.
pub fn tag_input_title(label: Option<&str>) -> String {
    match label {
        Some(label) => label.to_string(),
        None => t("hikari::tagInput.title", "Tags"),
    }
}

/// Vue's `interpolate(t("hikari::tagInput.reorder", "Reorder {label}"), …)` —
/// the grip handle's accessible name.
pub fn tag_input_reorder_label(label: &str) -> String {
    t("hikari::tagInput.reorder", "Reorder {label}").replace("{label}", label)
}

/// The panel's derived view of the controlled props — one struct so the render
/// and the tests exercise the same code (Vue: the setup's `computed`s).
#[derive(Clone, Debug, Default)]
pub struct TagPanelState {
    pub selected: Vec<String>,
    pub options: Vec<TagOption>,
    pub query: String,
    pub allow_custom: bool,
    pub disabled: bool,
    /// Capacity cap; 0 means unlimited (Vue's `undefined`).
    pub max_tags: u32,
}

impl TagPanelState {
    pub fn from_props(props: &TagInputProps) -> Self {
        Self {
            selected: props.model_value.clone(),
            options: props.options.clone(),
            query: props.query.clone(),
            allow_custom: props.allow_custom,
            disabled: props.disabled,
            max_tags: props.max_tags,
        }
    }

    /// Vue: `atMax`.
    pub fn at_max(&self) -> bool {
        self.max_tags > 0 && self.selected.len() >= self.max_tags as usize
    }

    /// True when the key is already carried (in host order).
    pub fn is_selected(&self, key: &str) -> bool {
        self.selected.iter().any(|selected| selected == key)
    }

    /// Vue: `rowsDisabled` — the whole list freezes while the field is
    /// disabled or already full.
    pub fn rows_disabled(&self) -> bool {
        self.disabled || self.at_max()
    }

    /// Vue: `labelOf` — a blank catalog label falls back to the raw key.
    pub fn label_of(option: &TagOption) -> String {
        if option.label.trim().is_empty() {
            option.key.clone()
        } else {
            option.label.clone()
        }
    }

    /// Vue: `tagEntries` — the chips, in host order; a key the catalog does not
    /// carry (a custom tag, or an option deleted since) degrades to its raw key
    /// as the label.
    pub fn tag_entries(&self) -> Vec<TagOption> {
        self.selected
            .iter()
            .map(|key| {
                match self
                    .options
                    .iter()
                    .find(|option| &option.key == key)
                    .filter(|option| !option.label.trim().is_empty())
                {
                    Some(option) => option.clone(),
                    None => TagOption {
                        key: key.clone(),
                        label: key.clone(),
                        ..Default::default()
                    },
                }
            })
            .collect()
    }

    /// Vue: `rows` — see [`tag_row_order`].
    pub fn rows(&self) -> Vec<TagOption> {
        tag_row_order(
            &self.options,
            &self.selected,
            self.query.trim().to_lowercase().as_str(),
        )
    }

    /// Vue: `selectedRows` — the drag strip AND the keyboard reorder's group.
    pub fn selected_rows(&self) -> Vec<TagOption> {
        self.rows()
            .into_iter()
            .filter(|option| self.is_selected(&option.key))
            .collect()
    }

    /// Vue: `customText`.
    pub fn custom_text(&self) -> String {
        self.query.trim().to_string()
    }

    /// Vue: `exactMatch` — the query already names something the field carries
    /// (an option key or label, or an already-selected key), so there is nothing
    /// left for the "Use …" row to add.
    pub fn exact_match(&self) -> bool {
        let query = self.custom_text().to_lowercase();
        if query.is_empty() {
            return false;
        }
        if self.options.iter().any(|option| {
            option.key.to_lowercase() == query || option.label.to_lowercase() == query
        }) {
            return true;
        }
        self.selected.iter().any(|key| key.to_lowercase() == query)
    }

    /// Vue: `customVisible`.
    pub fn custom_visible(&self) -> bool {
        self.allow_custom && !self.custom_text().is_empty() && !self.exact_match()
    }

    /// Vue: `stops.length` — the visible rows, then the custom row (always
    /// last).
    pub fn stops_len(&self) -> usize {
        self.rows().len() + usize::from(self.custom_visible())
    }

    /// Vue: `rowInert` — the field being disabled or full freezes the list;
    /// an option's own `disabled` only forbids toggling it ON, so an
    /// already-selected disabled option stays removable.
    pub fn row_inert(&self, option: &TagOption) -> bool {
        if self.rows_disabled() {
            return true;
        }
        option.disabled && !self.is_selected(&option.key)
    }

    /// Vue: `moveActive` — from "nothing active" ArrowDown lands on the FIRST
    /// stop and ArrowUp on the last; from either end it wraps around. An empty
    /// list leaves nothing active.
    pub fn step_active(&self, from: i32, delta: i32) -> i32 {
        let count = self.stops_len();
        if count == 0 {
            return -1;
        }
        let count = count as i32;
        if from < 0 || from >= count {
            if delta > 0 { 0 } else { count - 1 }
        } else {
            (from + delta + count) % count
        }
    }

    /// Vue: `addKey` — appends to the END of the host order (never re-sorts, so
    /// "first tag = primary" stays under the host's control).
    pub fn add_key(&self, key: &str) -> Option<TagEdit> {
        if self.disabled || self.at_max() || self.is_selected(key) {
            return None;
        }
        let mut next = self.selected.clone();
        next.push(key.to_string());
        Some(TagEdit::Add {
            key: key.to_string(),
            next,
        })
    }

    /// Vue: `removeKey` — splices in place.
    pub fn remove_key(&self, key: &str) -> Option<TagEdit> {
        if self.disabled {
            return None;
        }
        let index = self.selected.iter().position(|selected| selected == key)?;
        let mut next = self.selected.clone();
        next.remove(index);
        Some(TagEdit::Remove {
            key: key.to_string(),
            next,
        })
    }

    /// Vue: `toggle` — a selected key is removed in place, a new one appended.
    pub fn toggle(&self, key: &str) -> Option<TagEdit> {
        if self.disabled {
            return None;
        }
        if self.is_selected(key) {
            self.remove_key(key)
        } else {
            self.add_key(key)
        }
    }

    /// Vue: `toggleRow` — an inert row does nothing.
    pub fn toggle_row(&self, option: &TagOption) -> Option<TagEdit> {
        if self.row_inert(option) {
            return None;
        }
        self.toggle(&option.key)
    }

    /// The inline input's Backspace-on-empty-query path: remove the LAST key in
    /// host order (Vue: `selectedKeys.at(-1)`).
    pub fn remove_last(&self) -> Option<TagEdit> {
        if self.disabled {
            return None;
        }
        let last = self.selected.last()?.clone();
        self.remove_key(&last)
    }

    /// Vue: `addCustom` — the raw typed text becomes the tag; the query is
    /// consumed only when the tag was really added.
    pub fn add_custom(&self) -> Option<TagQueryCommit> {
        let query = self.custom_text();
        if query.is_empty() || self.rows_disabled() {
            return None;
        }
        self.add_key(&query).map(|edit| TagQueryCommit {
            edit,
            consumed_query: true,
        })
    }

    /// Vue: `commitQuery` — Enter resolves the typed query. With an active row
    /// that row wins (the cursor must be able to reach a row other than the top
    /// one); with nothing active it stays the shared picker order: the first row
    /// the query can still ADD, otherwise the custom row. An empty query is a
    /// no-op, and a selected row is never a blind-add target (so Enter can never
    /// silently delete the tag the user is looking at).
    pub fn commit_query(&self, active_index: i32) -> Option<TagQueryCommit> {
        let rows = self.rows();
        if active_index >= 0 {
            let index = active_index as usize;
            if index < rows.len() {
                let option = rows[index].clone();
                return self.toggle_row(&option).map(|edit| TagQueryCommit {
                    edit,
                    consumed_query: false,
                });
            }
            if index == rows.len() && self.custom_visible() {
                return self.add_custom();
            }
            return None;
        }
        if self.custom_text().is_empty() {
            return None;
        }
        let addable = rows
            .iter()
            .find(|option| !self.row_inert(option) && !self.is_selected(&option.key));
        if let Some(option) = addable
            && let Some(edit) = self.toggle_row(option)
        {
            return Some(TagQueryCommit {
                edit,
                consumed_query: false,
            });
        }
        self.add_custom()
    }

    /// Vue: `nudgeActiveRow` — move the ACTIVE row one slot inside the selected
    /// group. Only a selected row has a place in that order, the ends of the
    /// group are hard stops, and `None` means there was nothing this key could
    /// move. The move happens inside the HOST's own array by key, so a key the
    /// panel never showed (a custom tag) is neither dropped nor re-addressed.
    pub fn nudge(&self, active_index: i32, delta: i32) -> Option<TagReorder> {
        if self.disabled || (delta != 1 && delta != -1) {
            return None;
        }
        let rows = self.rows();
        if active_index < 0 || active_index as usize >= rows.len() {
            // A custom stop (or no stop) has no place in the selected group.
            return None;
        }
        let group = self.selected_rows();
        let from = group
            .iter()
            .position(|option| option.key == rows[active_index as usize].key)?;
        let to = from as i32 + delta;
        if to < 0 || to as usize >= group.len() {
            return None;
        }
        let from_key = &group[from].key;
        let to_key = &group[to as usize].key;
        let from_index = self.selected.iter().position(|key| key == from_key)?;
        let to_index = self.selected.iter().position(|key| key == to_key)?;
        let next = tag_move_to(&self.selected, from_index, to_index)?;
        Some(TagReorder {
            edit: TagEdit::Reorder { next },
            active_index: to,
        })
    }
}

/// Vue's presence-only marker attribute: `aria-*` / `data-*` carry `"true"`
/// while the flag is on and are absent otherwise (a serialized `="false"` would
/// be read as a value, not as "off").
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

/// One lucide glyph, serialized exactly as `lucide-vue-next` renders it: the
/// 24-unit viewBox, the stroke attribute set, the
/// `lucide lucide-{name}-icon lucide-{name}` class pair and the automatic
/// `aria-hidden="true"` its `Icon` adds when no a11y prop is passed.
fn lucide_icon_svg(name: &str, size: u32, body: &str) -> String {
    format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" \
         viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" \
         stroke-linecap=\"round\" stroke-linejoin=\"round\" \
         class=\"lucide lucide-{name}-icon lucide-{name}\" aria-hidden=\"true\">{body}</svg>"
    )
}

/// lucide `x`'s two paths.
const LUCIDE_X_BODY: &str = r#"<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>"#;
/// lucide `check`'s path.
const LUCIDE_CHECK_BODY: &str = r#"<path d="M20 6 9 17l-5-5"></path>"#;
/// lucide `plus`'s two paths.
const LUCIDE_PLUS_BODY: &str = r#"<path d="M5 12h14"></path><path d="M12 5v14"></path>"#;
/// lucide `search`'s path + circle.
const LUCIDE_SEARCH_BODY: &str =
    r#"<path d="m21 21-4.34-4.34"></path><circle cx="11" cy="11" r="8"></circle>"#;
/// lucide `chevron-down`'s path.
const LUCIDE_CHEVRON_DOWN_BODY: &str = r#"<path d="m6 9 6 6 6-6"></path>"#;
/// lucide `grip-vertical`'s six dots.
const LUCIDE_GRIP_VERTICAL_BODY: &str = concat!(
    r#"<circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle>"#,
    r#"<circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle>"#,
    r#"<circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle>"#
);

/// The controlled event wiring (Vue: `setup(props, { emit })`): every write is
/// a callback, nothing is stored — the host owns `modelValue`, `open`, `query`
/// and the cursor exactly as it owns the selection.
#[derive(Clone)]
struct TagInputWiring {
    state: TagPanelState,
    open: bool,
    active_index: i32,
    on_update_model_value: Option<EventHandler<Vec<String>>>,
    on_add: Option<EventHandler<String>>,
    on_remove: Option<EventHandler<String>>,
    on_update_open: Option<EventHandler<bool>>,
    on_query: Option<EventHandler<String>>,
    on_active: Option<EventHandler<i32>>,
}

impl TagInputWiring {
    /// Vue's `commit`: the specific event first (the key), then the full next
    /// array — the order every neighbour uses.
    fn commit(&self, edit: TagEdit) {
        if let Some(key) = edit.added_key()
            && let Some(handler) = self.on_add.as_ref()
        {
            handler.call(key.to_string());
        }
        if let Some(key) = edit.removed_key()
            && let Some(handler) = self.on_remove.as_ref()
        {
            handler.call(key.to_string());
        }
        if let Some(handler) = self.on_update_model_value.as_ref() {
            handler.call(edit.next().to_vec());
        }
    }

    fn remove_key(&self, key: &str) {
        if let Some(edit) = self.state.remove_key(key) {
            self.commit(edit);
        }
    }

    fn toggle_row(&self, option: &TagOption) {
        if let Some(edit) = self.state.toggle_row(option) {
            self.commit(edit);
        }
    }

    fn add_custom(&self) {
        if let Some(commit) = self.state.add_custom() {
            self.commit(commit.edit);
            if commit.consumed_query {
                self.set_query(String::new());
            }
        }
    }

    fn commit_query(&self) {
        if let Some(commit) = self.state.commit_query(self.active_index) {
            self.commit(commit.edit);
            if commit.consumed_query {
                self.set_query(String::new());
            }
        }
    }

    fn set_open(&self, open: bool) {
        if let Some(handler) = self.on_update_open.as_ref() {
            handler.call(open);
        }
    }

    fn toggle_open(&self) {
        self.set_open(!self.open);
    }

    /// Vue's `onFieldClick` → `openPanel()`; the field press never closes.
    fn open_field(&self) {
        if self.state.disabled {
            return;
        }
        self.set_open(true);
    }

    fn set_query(&self, query: String) {
        if let Some(handler) = self.on_query.as_ref() {
            handler.call(query);
        }
    }

    fn set_active(&self, index: i32) {
        if let Some(handler) = self.on_active.as_ref() {
            handler.call(index);
        }
    }

    fn move_active(&self, delta: i32) {
        let next = self.state.step_active(self.active_index, delta);
        self.set_active(next);
    }

    fn nudge(&self, delta: i32) {
        if let Some(reorder) = self.state.nudge(self.active_index, delta) {
            self.commit(reorder.edit);
            self.set_active(reorder.active_index);
        }
    }

    /// Vue: `onInlineKeydown`.
    fn inline_key(&self, event: KeyboardEvent) {
        let action = resolve_tag_key(
            &event.key,
            event.alt_key,
            false,
            self.state.query.is_empty(),
            self.open,
        );
        self.dispatch(action, event);
    }

    /// Vue: `onSearchKeydown`.
    fn search_key(&self, event: KeyboardEvent) {
        let action = resolve_tag_key(
            &event.key,
            event.alt_key,
            true,
            self.state.query.is_empty(),
            self.open,
        );
        self.dispatch(action, event);
    }

    fn dispatch(&self, action: TagKeyAction, event: KeyboardEvent) {
        if action.consumed() {
            event.prevent_default();
        }
        match action {
            TagKeyAction::None => {}
            TagKeyAction::CommitQuery => self.commit_query(),
            TagKeyAction::RemoveLast => {
                if let Some(edit) = self.state.remove_last() {
                    self.commit(edit);
                }
            }
            TagKeyAction::OpenPanel => self.set_open(true),
            TagKeyAction::MoveActive(delta) => self.move_active(delta),
            TagKeyAction::ClosePanel => self.set_open(false),
            TagKeyAction::NudgeActive(delta) => self.nudge(delta),
        }
    }
}

#[define_props]
pub struct TagInputProps {
    /// Selected keys, IN HOST ORDER (order is meaningful to hosts; add appends,
    /// remove splices).
    pub model_value: Vec<String>,

    /// The catalog the panel lists.
    pub options: Vec<TagOption>,

    /// Offer the trailing "Use “<query>”" row (free-text tags).
    #[default]
    pub allow_custom: bool,

    /// Field caption; also names the panel and the control.
    pub label: Option<String>,

    /// Shown inside the field while no tag & query — the inline input's
    /// placeholder.
    pub placeholder: Option<String>,

    /// Muted helper line under the field.
    pub hint: Option<String>,

    #[default]
    pub disabled: bool,

    #[default]
    pub size: TagInputSize,

    /// Capacity cap; 0 means unlimited. At the cap the inline input stays
    /// mounted but read-only and the panel's add affordances go inert; the
    /// chips' × still removes.
    #[default]
    pub max_tags: u32,

    /// Search field placeholder; falls back to `t("hikari::tagInput.search",
    /// "Search")`.
    pub search_placeholder: Option<String>,

    /// "No matches" row text; falls back to `t("hikari::tagInput.empty",
    /// "No matches")`.
    pub empty_text: Option<String>,

    /// Element id the caption's `for` points at, and the seed of the listbox /
    /// row / custom stop ids (Vue generates one with `useId`; tairitsu has no
    /// analogue, so nothing is emitted when this is `None`).
    pub id: Option<String>,

    /// Explicit listbox id; derived as `{id}-listbox` when omitted.
    pub listbox_id: Option<String>,

    // ── controlled state (Vue keeps all three in local refs) ──────────────
    /// Panel visibility (Vue: the local `open`).
    #[default]
    pub open: bool,

    /// The inline query (Vue: the local `query`). Every edit starts a new
    /// filter, which drops the cursor.
    #[default]
    pub query: String,

    /// The keyboard cursor: an index into the stops, `-1` = nothing active
    /// (Vue: the local `activeIndex`).
    #[default(-1)]
    pub active_index: i32,

    // ── events ────────────────────────────────────────────────────────────
    /// Vue: `update:modelValue` — the full next array.
    pub onupdate_model_value: Option<EventHandler<Vec<String>>>,

    /// Vue: the `add` emit (fires before `update:modelValue`).
    pub onadd: Option<EventHandler<String>>,

    /// Vue: the `remove` emit (fires before `update:modelValue`).
    pub onremove: Option<EventHandler<String>>,

    /// Vue: the `open` emit (every open/close edge).
    pub onupdate_open: Option<EventHandler<bool>>,

    /// The inline query's writer — the Rust-side stand-in for Vue's local
    /// `query` ref writes (row filtering, "Use …" consumption).
    pub onquery: Option<EventHandler<String>>,

    /// The cursor's writer — the Rust-side stand-in for Vue's local
    /// `activeIndex` writes.
    pub onactive: Option<EventHandler<i32>>,
}

#[component]
pub fn TagInput(props: TagInputProps) -> Element {
    let state = TagPanelState::from_props(&props);
    let rows = state.rows();
    let custom_visible = state.custom_visible();
    let at_max = state.at_max();
    let disabled = props.disabled;
    let open = props.open;
    let active_index = props.active_index;

    let id = props.id.clone();
    let listbox_id = tag_input_listbox_id(props.id.as_deref(), props.listbox_id.as_deref());
    let active_id = tag_input_active_id(props.id.as_deref(), active_index, &rows, custom_visible);
    let title = tag_input_title(props.label.as_deref());
    let label_text = props.label.clone().filter(|label| !label.is_empty());
    let placeholder = props.placeholder.clone().unwrap_or_default();
    let hint_text = props.hint.clone().filter(|hint| !hint.is_empty());
    let search_placeholder = props
        .search_placeholder
        .clone()
        .unwrap_or_else(|| t("hikari::tagInput.search", "Search"));
    let empty_text = props
        .empty_text
        .clone()
        .unwrap_or_else(|| t("hikari::tagInput.empty", "No matches"));
    let remove_label = t("hikari::tagInput.remove", "Remove");
    let input_rendered = !disabled;
    let aria_expanded = if open { "true" } else { "false" };

    let wiring = TagInputWiring {
        state: state.clone(),
        open,
        active_index,
        on_update_model_value: props.onupdate_model_value.clone(),
        on_add: props.onadd.clone(),
        on_remove: props.onremove.clone(),
        on_update_open: props.onupdate_open.clone(),
        on_query: props.onquery.clone(),
        on_active: props.onactive.clone(),
    };

    // ── chips, in host order ─────────────────────────────────────────────
    let chip_class = props.size.chip_class();
    let mut chips: Vec<VNode> = Vec::new();
    for entry in state.tag_entries() {
        let label = TagPanelState::label_of(&entry);
        let close_label = format!("{remove_label} — {label}");
        let key = entry.key.clone();
        let remove_chip = wiring.clone();
        chips.push(rsx! {
            span { class: format!("hk-tag hk-tag-default {chip_class} hk-tag-input-tag"),
                span { class: "hk-tag-input-tag-text", "{label}" }
                if !disabled {
                    button {
                        "type": "button",
                        class: "hk-tag-close",
                        "aria-label": close_label,
                        onclick: move |event: MouseEvent| {
                            // Vue resolves the field press back to
                            // `target.closest(".hk-tag-close")`; without DOM
                            // queries the press is stopped here instead, which
                            // is the same "a × never opens the panel" rule.
                            event.stop_propagation();
                            remove_chip.remove_key(&key);
                        },
                        div {
                            style: "display:contents",
                            dangerous_inner_html: lucide_icon_svg("x", 12, LUCIDE_X_BODY),
                        }
                    }
                }
            }
        });
    }

    // ── the inline typing input (or the disabled field's placeholder) ────
    let inline = if input_rendered {
        let width_style = format!(
            "width: {}ch",
            tag_inline_width_ch(&props.query, &placeholder)
        );
        // Vue: `aria-label={props.label ? undefined : title}`.
        let input_aria_label = if label_text.is_some() {
            None
        } else {
            Some(title.clone())
        };
        let inline_width = props.query.clone();
        let inline_placeholder = placeholder.clone();
        let inline_id = id.clone();
        let inline_controls = listbox_id.clone();
        let inline_active = active_id.clone();
        let oninput_inline = wiring.clone();
        let onkeydown_inline = wiring.clone();
        rsx! {
            input {
                id: inline_id,
                "type": "text",
                class: "hk-tag-input-element",
                style: width_style,
                value: inline_width,
                role: "combobox",
                "aria-expanded": aria_expanded,
                "aria-controls": inline_controls,
                "aria-autocomplete": "list",
                "aria-haspopup": "listbox",
                "aria-activedescendant": inline_active,
                "aria-label": input_aria_label,
                readonly: marker_attr(at_max),
                placeholder: inline_placeholder,
                autocomplete: "off",
                spellcheck: "false",
                "data-1p-ignore": Some("true"),
                "data-lpignore": "true",
                oninput: move |event: InputEvent| oninput_inline.set_query(event.data.clone()),
                onkeydown: move |event: KeyboardEvent| onkeydown_inline.inline_key(event),
            }
        }
    } else if !placeholder.is_empty() {
        rsx! {
            span { class: "hk-tag-input-placeholder", "{placeholder}" }
        }
    } else {
        empty_vnode()
    };

    // ── the chevron ──────────────────────────────────────────────────────
    let chevron_toggle = wiring.clone();
    let chevron = rsx! {
        button {
            "type": "button",
            class: "hk-tag-input-chevron",
            disabled: marker_attr(disabled),
            "aria-haspopup": "listbox",
            "aria-expanded": aria_expanded,
            "aria-label": title.clone(),
            title: title.clone(),
            // Keep the inline input's focus (and its caret) on the press, like
            // Vue: the panel opens without a blur flicker.
            onmousedown: move |event: MouseEvent| event.prevent_default(),
            onclick: move |event: MouseEvent| {
                event.prevent_default();
                event.stop_propagation();
                if !disabled {
                    chevron_toggle.toggle_open();
                }
            },
            div {
                style: "display:contents",
                dangerous_inner_html: lucide_icon_svg(
                    "chevron-down",
                    16,
                    LUCIDE_CHEVRON_DOWN_BODY,
                ),
            }
        }
    };

    // ── the panel (open only; Vue teleports it, see the header deltas) ───
    let panel = if open {
        let mut row_nodes: Vec<VNode> = Vec::with_capacity(rows.len() + 1);
        for (index, option) in rows.iter().enumerate() {
            let key = option.key.clone();
            let option_for_click = option.clone();
            let label = TagPanelState::label_of(option);
            let meta = option.meta.clone().filter(|meta| !meta.is_empty());
            let flag = option.flag.clone().filter(|flag| !flag.is_empty());
            let selected = state.is_selected(&key);
            let inert = state.row_inert(option);
            let reorderable = selected && !disabled;
            let stop_id = tag_input_option_stop_id(id.as_deref(), &key);
            let active = active_index == index as i32;
            // Precomputed so no `if` expression sits in attribute position.
            let aria_selected = if selected { "true" } else { "false" };
            let data_reorder = if reorderable { Some("true") } else { None };
            let grip_label = tag_input_reorder_label(&label);
            let advance_row = wiring.clone();
            row_nodes.push(rsx! {
                div {
                    id: stop_id,
                    role: "option",
                    tabindex: -1,
                    class: "hk-tag-input-row",
                    "aria-selected": aria_selected,
                    "aria-disabled": marker_attr(inert),
                    "data-selected": marker_attr(selected),
                    // The grammar's checked face AND its hover guard key on
                    // `data-checked`; the legacy `data-selected` stays beside it.
                    "data-checked": marker_attr(selected),
                    "data-disabled": marker_attr(inert),
                    "data-active": marker_attr(active),
                    "data-reorder": data_reorder,
                    onclick: move |event: MouseEvent| {
                        event.stop_propagation();
                        advance_row.toggle_row(&option_for_click);
                    },
                    span { class: "hk-tag-input-check", "aria-hidden": "true",
                        if selected {
                            div {
                                style: "display:contents",
                                dangerous_inner_html: lucide_icon_svg(
                                    "check",
                                    14,
                                    LUCIDE_CHECK_BODY,
                                ),
                            }
                        }
                    }
                    if let Some(flag) = flag {
                        span { class: "hk-tag-input-row-flag", "aria-hidden": "true", "{flag}" }
                    }
                    span { class: "hk-tag-input-row-label", "{label}" }
                    if let Some(meta) = meta {
                        span { class: "hk-tag-input-row-meta", "{meta}" }
                    }
                    if reorderable {
                        span {
                            class: "hk-tag-input-grip",
                            role: "button",
                            tabindex: -1,
                            "aria-label": grip_label.clone(),
                            title: grip_label,
                            // A press on the handle that never became a drag
                            // must not fall through to the row's toggle.
                            onclick: move |event: MouseEvent| event.stop_propagation(),
                            div {
                                style: "display:contents",
                                dangerous_inner_html: lucide_icon_svg(
                                    "grip-vertical",
                                    14,
                                    LUCIDE_GRIP_VERTICAL_BODY,
                                ),
                            }
                        }
                    }
                }
            });
        }

        // The "Use “<query>”" row — the raw typed text becomes the tag.
        if custom_visible {
            let custom_stop_id = id.as_ref().map(|id| format!("{id}-custom"));
            let custom_label =
                t("hikari::tagInput.addCustom", "Use “{q}”").replace("{q}", &state.custom_text());
            let rows_disabled = state.rows_disabled();
            let add_custom = wiring.clone();
            row_nodes.push(rsx! {
                div {
                    id: custom_stop_id,
                    role: "option",
                    tabindex: -1,
                    class: "hk-tag-input-row",
                    "aria-selected": "false",
                    "aria-disabled": marker_attr(rows_disabled),
                    "data-custom": "true",
                    "data-disabled": marker_attr(rows_disabled),
                    "data-active": marker_attr(active_index == rows.len() as i32),
                    onclick: move |event: MouseEvent| {
                        event.stop_propagation();
                        add_custom.add_custom();
                    },
                    span { class: "hk-tag-input-check", "aria-hidden": "true",
                        div {
                            style: "display:contents",
                            dangerous_inner_html: lucide_icon_svg("plus", 14, LUCIDE_PLUS_BODY),
                        }
                    }
                    span { class: "hk-tag-input-row-label", "{custom_label}" }
                }
            });
        }

        // The panel's search field is Vue's nested HkInput (mirrored `Input`):
        // the same wrapper/box/element chain plus the magnifier prefix affix.
        let oninput_search = wiring.clone();
        let onkeydown_search = wiring.clone();
        let search_field = rsx! {
            Input {
                model_value: props.query.clone(),
                size: InputSize::Small,
                placeholder: Some(search_placeholder.clone()),
                // Vue passes `aria-label={searchPlaceholder}`; the mirrored
                // Input's `hide_label` renders exactly that on the element
                // without printing a caption.
                label: Some(search_placeholder.clone()),
                hide_label: true,
                autocomplete: Some("off".to_string()),
                prefix_icon: Some(rsx! {
                    div {
                        style: "display:contents",
                        dangerous_inner_html: lucide_icon_svg(
                            "search",
                            13,
                            LUCIDE_SEARCH_BODY,
                        ),
                    }
                }),
                oninput: Some(event_handler(move |value: String| oninput_search.set_query(value))),
                onkeydown: Some(event_handler(move |event: KeyboardEvent| {
                    onkeydown_search.search_key(event)
                })),
            }
        };

        let panel_listbox_id = listbox_id.clone();
        rsx! {
            div { class: "hk-tag-input-panel",
                div { class: "hk-tag-input-search", role: "search",
                    {search_field}
                }
                div {
                    id: panel_listbox_id,
                    class: "hk-tag-input-list",
                    role: "listbox",
                    "aria-multiselectable": "true",
                    "aria-label": title.clone(),
                    {VNode::Fragment(row_nodes)}
                }
                // The empty message lives OUTSIDE the listbox: a listbox may
                // only own options/groups.
                if rows.is_empty() && !custom_visible {
                    div { class: "hk-tag-input-empty", "{empty_text}" }
                }
            }
        }
    } else {
        empty_vnode()
    };

    // ── the field shell ──────────────────────────────────────────────────
    let mut box_classes = format!("hk-tag-input-box {}", props.size.class_name());
    if open {
        box_classes.push_str(" hk-tag-input-box-open");
    }
    // Vue: while disabled there is no input to point the caption at, and the
    // box carries the caption itself.
    let box_role = if input_rendered { None } else { Some("group") };
    let box_aria_label = if input_rendered {
        None
    } else {
        Some(title.clone())
    };
    let label_for = if input_rendered { id.clone() } else { None };
    let field_click = wiring.clone();

    rsx! {
        div { class: "hk-tag-input-wrapper",
            if let Some(label) = label_text {
                label { class: "hk-tag-input-label", "for": label_for,
                    "{label}"
                }
            }
            div {
                class: box_classes,
                "data-disabled": marker_attr(disabled),
                "data-full": marker_attr(at_max),
                role: box_role,
                "aria-label": box_aria_label,
                onclick: move |_event: MouseEvent| field_click.open_field(),
                {VNode::Fragment(chips)}
                {inline}
                {chevron}
            }
            if let Some(hint) = hint_text {
                p { class: "hk-tag-input-hint", "{hint}" }
            }
            {panel}
        }
    }
}

impl StyledComponent for TagInputComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-tag-input*` names literal so this CSS matches the Vue build; the
        // sheet also `@use`s the mirrored menu-item grammar and polyfill).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTagInput.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "tag-input"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn option(key: &str, label: &str) -> TagOption {
        TagOption {
            key: key.to_string(),
            label: label.to_string(),
            ..Default::default()
        }
    }

    fn panel_state(selected: &[&str], options: Vec<TagOption>) -> TagPanelState {
        TagPanelState {
            selected: selected.iter().map(|key| key.to_string()).collect(),
            options,
            ..Default::default()
        }
    }

    fn catalog() -> Vec<TagOption> {
        vec![
            option("cn", "China"),
            option("jp", "Japan"),
            option("de", "Germany"),
        ]
    }

    #[test]
    fn tag_input_defaults_match_the_vue_props() {
        let props = TagInputProps::default();
        assert!(props.model_value.is_empty());
        assert!(props.options.is_empty());
        assert!(!props.allow_custom);
        assert_eq!(props.label, None);
        assert_eq!(props.placeholder, None);
        assert_eq!(props.hint, None);
        assert!(!props.disabled);
        assert_eq!(props.size, TagInputSize::Md);
        // Vue: `maxTags: undefined`, i.e. unlimited — 0 is the Rust spelling.
        assert_eq!(props.max_tags, 0);
        assert_eq!(props.search_placeholder, None);
        assert_eq!(props.empty_text, None);
        assert_eq!(props.id, None);
        assert_eq!(props.listbox_id, None);
        assert!(!props.open);
        assert_eq!(props.query, "");
        assert_eq!(props.active_index, -1);
        assert!(props.onupdate_model_value.is_none());
        assert!(props.onadd.is_none());
        assert!(props.onremove.is_none());
        assert!(props.onupdate_open.is_none());
        assert!(props.onquery.is_none());
        assert!(props.onactive.is_none());
    }

    #[test]
    fn tag_input_size_classes_match_the_vue_modifiers() {
        assert_eq!(TagInputSize::Sm.class_name(), "hk-tag-input-box-sm");
        assert_eq!(TagInputSize::Md.class_name(), "hk-tag-input-box-md");
        assert_eq!(TagInputSize::Lg.class_name(), "hk-tag-input-box-lg");
        // Vue's `tagSize`: only `sm` keeps a small chip.
        assert_eq!(TagInputSize::Sm.chip_class(), "hk-tag-sm");
        assert_eq!(TagInputSize::Md.chip_class(), "hk-tag-md");
        assert_eq!(TagInputSize::Lg.chip_class(), "hk-tag-md");
    }

    #[test]
    fn tag_input_subsequence_pass_allows_gaps() {
        assert!(tag_is_subsequence("cn", "china"));
        assert!(tag_is_subsequence("中国", "中华人民共和国"));
        assert!(tag_is_subsequence("", "anything"));
        assert!(!tag_is_subsequence("china", "cn"));
        assert!(!tag_is_subsequence("xyz", "china"));
    }

    #[test]
    fn tag_input_filter_is_substring_then_subsequence_per_field() {
        let mut china = option("cn", "China");
        china.meta = Some("+86".to_string());
        china.keywords = Some("prc mainland".to_string());
        // Substring on label / meta / key / keywords (case-folded by `rows`).
        assert!(tag_matches_query(&china, "chin"));
        assert!(tag_matches_query(&china, "+86"));
        assert!(tag_matches_query(&china, "prc"));
        assert!(tag_matches_query(&china, "cn"));
        // Subsequence fallback on a field (gaps allowed).
        assert!(tag_matches_query(&china, "chn"));
        // Nothing matches across concatenated fields.
        assert!(!tag_matches_query(&china, "chin+86"));
        // An empty query keeps every row.
        assert!(tag_matches_query(&china, ""));
    }

    #[test]
    fn tag_input_rows_are_group_strict() {
        // Selected options come first, in HOST order — not catalog order.
        let catalog = catalog();
        let selected = vec!["de".to_string(), "cn".to_string()];
        let keys: Vec<String> = tag_row_order(&catalog, &selected, "")
            .into_iter()
            .map(|option| option.key)
            .collect();
        assert_eq!(keys, vec!["de", "cn", "jp"]);

        // A query filters WITHIN the groups and never re-sorts them: "an"
        // keeps Japan (unselected) and Germany (selected) — the selected group
        // still leads, even though the catalog order is the other way round.
        let keys: Vec<String> = tag_row_order(&catalog, &selected, "an")
            .into_iter()
            .map(|option| option.key)
            .collect();
        assert_eq!(keys, vec!["de", "jp"]);

        // A key the catalog does not carry simply has no row.
        let selected = vec!["custom".to_string(), "jp".to_string()];
        let keys: Vec<String> = tag_row_order(&catalog, &selected, "")
            .into_iter()
            .map(|option| option.key)
            .collect();
        assert_eq!(keys, vec!["jp", "cn", "de"]);
    }

    #[test]
    fn tag_input_inline_width_matches_the_vue_measurement() {
        // Query wins; the placeholder drives the width while the query is empty.
        assert_eq!(tag_inline_width_ch("", ""), 2);
        assert_eq!(tag_inline_width_ch("abc", "placeholder"), 4);
        assert_eq!(tag_inline_width_ch("", "abc"), 4);
        // East-Asian wide glyphs occupy two units each.
        assert_eq!(tag_inline_width_ch("中文", ""), 5);
        assert!(tag_is_wide_glyph('中'));
        assert!(!tag_is_wide_glyph('a'));
    }

    #[test]
    fn tag_input_move_to_matches_the_insert_at_target_rule() {
        let list: Vec<String> = ["a", "b", "c"].iter().map(|k| k.to_string()).collect();
        assert_eq!(
            tag_move_to(&list, 0, 2),
            Some(vec!["b".to_string(), "c".to_string(), "a".to_string()])
        );
        assert_eq!(
            tag_move_to(&list, 2, 0),
            Some(vec!["c".to_string(), "a".to_string(), "b".to_string()])
        );
        // The same slot says nothing, and out-of-range does too.
        assert_eq!(tag_move_to(&list, 1, 1), None);
        assert_eq!(tag_move_to(&list, 0, 3), None);
        assert_eq!(tag_move_to(&[], 0, 0), None);
    }

    #[test]
    fn tag_input_ids_derive_from_the_caller_id() {
        assert_eq!(encode_uri_component("plain-id_1"), "plain-id_1");
        assert_eq!(encode_uri_component("a b"), "a%20b");
        assert_eq!(encode_uri_component("中国"), "%E4%B8%AD%E5%9B%BD");
        assert_eq!(
            tag_input_option_stop_id(Some("t1"), "a b"),
            Some("t1-option-a%20b".to_string())
        );
        // No id → no ids at all (never a dangling aria reference).
        assert_eq!(tag_input_option_stop_id(None, "a"), None);
        assert_eq!(
            tag_input_listbox_id(Some("t1"), None),
            Some("t1-listbox".to_string())
        );
        assert_eq!(
            tag_input_listbox_id(Some("t1"), Some("custom-list")),
            Some("custom-list".to_string())
        );
        assert_eq!(tag_input_listbox_id(None, None), None);

        let rows = catalog();
        assert_eq!(
            tag_input_active_id(Some("t1"), 1, &rows, false),
            Some("t1-option-jp".to_string())
        );
        assert_eq!(tag_input_active_id(Some("t1"), -1, &rows, false), None);
        // The custom row is the stop right after the rows — only while offered.
        assert_eq!(
            tag_input_active_id(Some("t1"), 3, &rows, true),
            Some("t1-custom".to_string())
        );
        assert_eq!(tag_input_active_id(Some("t1"), 3, &rows, false), None);
        // A cursor past the end is no cursor.
        assert_eq!(tag_input_active_id(Some("t1"), 9, &rows, true), None);
    }

    #[test]
    fn tag_input_chip_entries_degrade_to_the_raw_key() {
        // A catalog label wins; a key the catalog does not carry (or a blank
        // label) renders the raw key.
        let mut blank = option("blank", "");
        blank.label = "   ".to_string();
        let state = panel_state(
            &["cn", "custom", "blank"],
            vec![option("cn", "China"), blank],
        );
        let entries: Vec<(String, String)> = state
            .tag_entries()
            .into_iter()
            .map(|entry| (entry.key, entry.label))
            .collect();
        assert_eq!(
            entries,
            vec![
                ("cn".to_string(), "China".to_string()),
                ("custom".to_string(), "custom".to_string()),
                ("blank".to_string(), "blank".to_string()),
            ]
        );
    }

    #[test]
    fn tag_input_add_remove_rules_match_vue() {
        let state = panel_state(&["cn"], catalog());
        // Add appends to the END of the host order.
        let edit = state.add_key("jp").expect("jp is addable");
        assert_eq!(edit.added_key(), Some("jp"));
        assert_eq!(
            edit.next().to_vec(),
            vec!["cn".to_string(), "jp".to_string()]
        );
        assert!(edit.removed_key().is_none());
        // A duplicate says nothing.
        assert_eq!(state.add_key("cn"), None);
        // Remove splices in place.
        let edit = state.remove_key("cn").expect("cn is selected");
        assert_eq!(edit.removed_key(), Some("cn"));
        assert!(edit.next().is_empty());
        // Toggle picks the right branch.
        assert_eq!(
            state
                .toggle("cn")
                .and_then(|edit| edit.removed_key().map(str::to_string)),
            Some("cn".to_string())
        );
        assert_eq!(
            state
                .toggle("jp")
                .and_then(|edit| edit.added_key().map(str::to_string)),
            Some("jp".to_string())
        );

        // `maxTags` freezes ADDS only (Vue: "maxTags freezes ADDS only").
        let capped = TagPanelState {
            max_tags: 1,
            ..state.clone()
        };
        assert_eq!(capped.add_key("jp"), None);
        assert!(capped.at_max());
        assert!(capped.remove_key("cn").is_some());

        // A disabled field edits nothing.
        let disabled = TagPanelState {
            disabled: true,
            ..state.clone()
        };
        assert_eq!(disabled.add_key("jp"), None);
        assert_eq!(disabled.remove_key("cn"), None);
        assert_eq!(disabled.remove_last(), None);
    }

    #[test]
    fn tag_input_backspace_removes_the_last_host_order_key() {
        let state = panel_state(&["cn", "jp"], catalog());
        let edit = state.remove_last().expect("the last key is removable");
        assert_eq!(edit.removed_key(), Some("jp"));
        assert_eq!(edit.next().to_vec(), vec!["cn".to_string()]);
        assert_eq!(panel_state(&[], catalog()).remove_last(), None);
    }

    #[test]
    fn tag_input_custom_row_visibility_matches_the_exact_match_rule() {
        // `allowCustom` + a non-empty query that names nothing new.
        let mut state = TagPanelState {
            allow_custom: true,
            query: "  sweden  ".to_string(),
            ..panel_state(&[], catalog())
        };
        assert_eq!(state.custom_text(), "sweden");
        assert!(state.custom_visible());
        // An exact option KEY match suppresses the row …
        state.query = "jp".to_string();
        assert!(state.exact_match());
        assert!(!state.custom_visible());
        // … so does an exact LABEL match (case-folded) …
        state.query = "Japan".to_string();
        assert!(state.exact_match());
        assert!(!state.custom_visible());
        // … and a key the field already carries.
        state.query = "custom".to_string();
        state.selected = vec!["custom".to_string()];
        assert!(state.exact_match());
        assert!(!state.custom_visible());
        // A blank query offers nothing, and `allowCustom: false` never does.
        state.selected.clear();
        state.query = "   ".to_string();
        assert!(!state.custom_visible());
        let closed = TagPanelState {
            allow_custom: false,
            query: "sweden".to_string(),
            ..state.clone()
        };
        assert!(!closed.custom_visible());
    }

    #[test]
    fn tag_input_enter_resolution_matches_the_vue_order() {
        let catalog_rows = catalog();
        // "a" matches all three labels, so the selected row stays visible.
        let state = TagPanelState {
            query: "a".to_string(),
            ..panel_state(&["jp"], catalog_rows.clone())
        };
        let rows = state.rows();
        assert_eq!(rows.len(), 3);
        // Group-strict: the selected "jp" is row 0, then the catalog order.
        assert_eq!(rows[0].key, "jp");
        assert_eq!(rows[1].key, "cn");

        // With an active row that row wins — even when it is already selected
        // (so it removes; the cursor is a deliberate act).
        let commit = state.commit_query(0).expect("the active row resolves");
        assert_eq!(commit.edit.removed_key(), Some("jp"));
        assert!(!commit.consumed_query);

        // With nothing active: the first row the query can still ADD.
        let commit = state.commit_query(-1).expect("China is addable");
        assert_eq!(commit.edit.added_key(), Some("cn"));
        assert!(!commit.consumed_query);

        // A query naming only what the field already carries is a no-op.
        let mut only_selected = TagPanelState {
            query: "jp".to_string(),
            ..panel_state(&["jp"], catalog_rows.clone())
        };
        only_selected.options = vec![option("jp", "Japan")];
        assert_eq!(only_selected.commit_query(-1), None);

        // An empty query is a no-op: Enter on a blank field never picks the top.
        let mut blank = TagPanelState {
            query: String::new(),
            ..panel_state(&[], catalog_rows.clone())
        };
        assert_eq!(blank.commit_query(-1), None);

        // The custom row is the last stop, and its add consumes the query.
        blank.allow_custom = true;
        blank.query = "sweden".to_string();
        let rows_len = blank.rows().len();
        let commit = blank
            .commit_query(rows_len as i32)
            .expect("the custom stop adds");
        assert_eq!(commit.edit.added_key(), Some("sweden"));
        assert!(commit.consumed_query);
    }

    #[test]
    fn tag_input_at_max_still_removes_but_never_adds() {
        let state = TagPanelState {
            max_tags: 1,
            query: "sweden".to_string(),
            allow_custom: true,
            ..panel_state(&["cn"], catalog())
        };
        assert!(state.at_max());
        // Every row is inert at the cap …
        assert!(state.row_inert(&option("jp", "Japan")));
        assert_eq!(state.add_custom(), None);
        assert_eq!(state.commit_query(-1), None);
        // … but the chips' × still removes (the keyboard's way out).
        assert!(state.remove_key("cn").is_some());
    }

    #[test]
    fn tag_input_disabled_option_is_only_blocked_from_being_turned_on() {
        let mut disabled_option = option("jp", "Japan");
        disabled_option.disabled = true;
        // Unselected + disabled → inert.
        let state = panel_state(&[], vec![disabled_option.clone()]);
        assert!(state.row_inert(&disabled_option));
        assert_eq!(state.toggle_row(&disabled_option), None);
        // Already selected + disabled → stay removable (a catalog edit must
        // never strand a tag forever).
        let state = panel_state(&["jp"], vec![disabled_option.clone()]);
        assert!(!state.row_inert(&disabled_option));
        assert_eq!(
            state
                .toggle_row(&disabled_option)
                .and_then(|edit| edit.removed_key().map(str::to_string)),
            Some("jp".to_string())
        );
    }

    #[test]
    fn tag_input_cursor_walk_wraps_and_starts_at_either_end() {
        let state = TagPanelState {
            query: "a".to_string(),
            allow_custom: true,
            ..panel_state(&[], catalog())
        };
        // 3 rows + the custom stop.
        assert_eq!(state.stops_len(), 4);
        // From "nothing active", ArrowDown lands on the first stop and ArrowUp
        // on the last.
        assert_eq!(state.step_active(-1, 1), 0);
        assert_eq!(state.step_active(-1, -1), 3);
        // Both ends wrap.
        assert_eq!(state.step_active(3, 1), 0);
        assert_eq!(state.step_active(0, -1), 3);
        assert_eq!(state.step_active(1, 1), 2);
        // An empty list leaves nothing active.
        let empty = TagPanelState::default();
        assert_eq!(empty.stops_len(), 0);
        assert_eq!(empty.step_active(-1, 1), -1);
    }

    #[test]
    fn tag_input_nudge_moves_only_within_the_selected_group() {
        // Host order: cn, jp. Catalog order: cn, jp, de.
        let state = panel_state(&["cn", "jp"], catalog());
        // Rows are [cn, jp (selected group)], then de.
        let reorder = state.nudge(1, -1).expect("jp can move up");
        assert_eq!(
            reorder.edit.next().to_vec(),
            vec!["jp".to_string(), "cn".to_string()]
        );
        assert_eq!(reorder.active_index, 0);
        // The ends of the group are hard stops.
        assert_eq!(state.nudge(0, -1), None);
        assert_eq!(state.nudge(1, 1), None);
        // An UNSELECTED row has no place in the group.
        assert_eq!(state.nudge(2, -1), None);
        // The custom stop (past the rows) has no place either.
        assert_eq!(state.nudge(3, 1), None);
        // A disabled field nudges nothing.
        let disabled = TagPanelState {
            disabled: true,
            ..state.clone()
        };
        assert_eq!(disabled.nudge(1, -1), None);
    }

    #[test]
    fn tag_input_key_table_matches_the_vue_handlers() {
        // Enter always resolves the query.
        assert_eq!(
            resolve_tag_key("Enter", false, false, false, true),
            TagKeyAction::CommitQuery
        );
        // Backspace removes only from the field's own input, and only when the
        // query is empty.
        assert_eq!(
            resolve_tag_key("Backspace", false, false, true, false),
            TagKeyAction::RemoveLast
        );
        assert_eq!(
            resolve_tag_key("Backspace", false, false, false, false),
            TagKeyAction::None
        );
        assert_eq!(
            resolve_tag_key("Backspace", false, true, true, true),
            TagKeyAction::None
        );
        // Arrows open the closed panel, else walk the cursor.
        assert_eq!(
            resolve_tag_key("ArrowDown", false, false, false, false),
            TagKeyAction::OpenPanel
        );
        assert_eq!(
            resolve_tag_key("ArrowDown", false, false, false, true),
            TagKeyAction::MoveActive(1)
        );
        assert_eq!(
            resolve_tag_key("ArrowUp", false, false, false, true),
            TagKeyAction::MoveActive(-1)
        );
        // The panel's search field always walks.
        assert_eq!(
            resolve_tag_key("ArrowUp", false, true, false, false),
            TagKeyAction::MoveActive(-1)
        );
        // Escape only closes an open panel; on the search field it always does.
        assert_eq!(
            resolve_tag_key("Escape", false, false, false, false),
            TagKeyAction::None
        );
        assert_eq!(
            resolve_tag_key("Escape", false, false, false, true),
            TagKeyAction::ClosePanel
        );
        assert_eq!(
            resolve_tag_key("Escape", false, true, false, false),
            TagKeyAction::ClosePanel
        );
        // The Alt+Arrow reorder chord is consumed on both surfaces, even when
        // the cursor has nowhere to go.
        assert_eq!(
            resolve_tag_key("ArrowUp", true, false, false, false),
            TagKeyAction::NudgeActive(-1)
        );
        assert_eq!(
            resolve_tag_key("ArrowDown", true, true, false, true),
            TagKeyAction::NudgeActive(1)
        );
        // Unrelated keys are not the field's business.
        assert_eq!(
            resolve_tag_key("a", false, false, false, true),
            TagKeyAction::None
        );
        assert!(!TagKeyAction::None.consumed());
        assert!(TagKeyAction::OpenPanel.consumed());
    }

    #[test]
    fn tag_input_titles_labels_and_markers_match_vue() {
        assert_eq!(tag_input_title(None), "Tags");
        assert_eq!(tag_input_title(Some("Countries")), "Countries");
        // Vue's `??`: an empty caller label stays empty.
        assert_eq!(tag_input_title(Some("")), "");
        assert_eq!(tag_input_reorder_label("China"), "Reorder China");
        assert_eq!(marker_attr(true), Some("true"));
        assert_eq!(marker_attr(false), None);
    }

    #[test]
    fn tag_input_glyphs_are_lucide_markup() {
        let svg = lucide_icon_svg("x", 12, LUCIDE_X_BODY);
        assert!(svg.starts_with("<svg "), "{svg}");
        assert!(svg.ends_with("</svg>"), "{svg}");
        assert!(svg.contains(r#"width="12" height="12""#), "{svg}");
        assert!(svg.contains(r#"viewBox="0 0 24 24""#), "{svg}");
        // The library's own class pair and its automatic aria-hidden.
        assert!(
            svg.contains(r#"class="lucide lucide-x-icon lucide-x""#),
            "{svg}"
        );
        assert!(svg.contains(r#"aria-hidden="true""#), "{svg}");
        assert!(svg.contains(r#"<path d="M18 6 6 18"></path>"#), "{svg}");
        // lucide's grip-vertical is six 1-unit dots.
        assert_eq!(LUCIDE_GRIP_VERTICAL_BODY.matches("<circle").count(), 6);
    }

    #[test]
    fn tag_input_renders_the_vue_field_contract() {
        let html = TagInput(TagInputProps {
            model_value: vec!["cn".to_string()],
            options: catalog(),
            label: Some("Countries".to_string()),
            placeholder: Some("Pick".to_string()),
            hint: Some("Optional".to_string()),
            id: Some("tags-1".to_string()),
            ..Default::default()
        })
        .render_to_html();

        // Wrapper + caption wired to the field id.
        assert!(html.contains(r#"class="hk-tag-input-wrapper""#), "{html}");
        assert!(html.contains(r#"class="hk-tag-input-label""#), "{html}");
        assert!(html.contains(r#"for="tags-1""#), "{html}");
        // The chip keeps HkTag's own root class list plus the field hook.
        assert!(
            html.contains(r#"class="hk-tag hk-tag-default hk-tag-md hk-tag-input-tag""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-tag-input-tag-text""#), "{html}");
        assert!(html.contains(r#"class="hk-tag-close""#), "{html}");
        assert!(html.contains(r#"aria-label="Remove — China""#), "{html}");
        // The inline combobox publishes the listbox contract.
        assert!(
            html.contains(r#"class="hk-tag-input-box hk-tag-input-box-md""#),
            "{html}"
        );
        assert!(html.contains(r#"role="combobox""#), "{html}");
        assert!(html.contains(r#"aria-controls="tags-1-listbox""#), "{html}");
        assert!(html.contains(r#"aria-expanded="false""#), "{html}");
        assert!(html.contains(r#"aria-autocomplete="list""#), "{html}");
        // `Style` re-serializes the declaration pair without the space
        // (`width:5ch`); the CSS value is Vue's `5ch`.
        assert!(html.contains(r#"style="width:5ch""#), "{html}");
        // The chevron names the control, and the hint line renders.
        assert!(html.contains(r#"class="hk-tag-input-chevron""#), "{html}");
        assert!(html.contains(r#"aria-label="Countries""#), "{html}");
        assert!(html.contains(r#"class="hk-tag-input-hint""#), "{html}");
        // Closed: no panel, and no falsy marker attributes.
        assert!(!html.contains("hk-tag-input-panel"), "{html}");
        assert!(!html.contains(r#"data-disabled="false""#), "{html}");
    }

    #[test]
    fn tag_input_renders_the_open_panel_contract() {
        let html = TagInput(TagInputProps {
            model_value: vec!["cn".to_string()],
            options: catalog(),
            open: true,
            query: "ja".to_string(),
            active_index: 0,
            allow_custom: true,
            id: Some("t".to_string()),
            ..Default::default()
        })
        .render_to_html();

        // The panel, its search region and the listbox it publishes.
        assert!(html.contains(r#"class="hk-tag-input-panel""#), "{html}");
        assert!(html.contains(r#"role="search""#), "{html}");
        assert!(html.contains(r#"class="hk-tag-input-list""#), "{html}");
        assert!(html.contains(r#"id="t-listbox""#), "{html}");
        assert!(html.contains(r#"role="listbox""#), "{html}");
        assert!(html.contains(r#"aria-multiselectable="true""#), "{html}");
        // The selected row is first (group-strict) and carries Vue's data
        // faces; the query is "ja", so the selected China row is filtered OUT
        // and only Japan survives as a row.
        assert!(html.contains(r#"class="hk-tag-input-row""#), "{html}");
        assert!(html.contains(r#"role="option""#), "{html}");
        assert!(html.contains(r#"id="t-option-jp""#), "{html}");
        assert!(!html.contains(r#"id="t-option-cn""#), "{html}");
        // The custom row is last, marked with `data-custom`.
        assert!(html.contains(r#"data-custom="true""#), "{html}");
        assert!(html.contains(r#"id="t-custom""#), "{html}");
        // The cursor is published on the row and at the field level.
        assert!(html.contains(r#"data-active="true""#), "{html}");
        assert!(
            html.contains(r#"aria-activedescendant="t-option-jp""#),
            "{html}"
        );
        // The field is marked open, and the search field renders through the
        // mirrored Input (wrapper/box/element + its prefix affix).
        assert!(html.contains("hk-tag-input-box-open"), "{html}");
        assert!(html.contains(r#"class="hk-input-wrapper""#), "{html}");
        assert!(
            html.contains(r#"class="hk-input-affix hk-input-prefix""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-input-element""#), "{html}");
    }

    #[test]
    fn tag_input_renders_the_disabled_field_contract() {
        let html = TagInput(TagInputProps {
            model_value: vec!["cn".to_string()],
            options: catalog(),
            disabled: true,
            placeholder: Some("Pick".to_string()),
            ..Default::default()
        })
        .render_to_html();
        // A disabled control must not be focusable: the input is GONE and the
        // placeholder text stands in for it; the box carries the caption.
        assert!(!html.contains("hk-tag-input-element"), "{html}");
        assert!(
            html.contains(r#"class="hk-tag-input-placeholder""#),
            "{html}"
        );
        assert!(html.contains(r#"data-disabled="true""#), "{html}");
        assert!(html.contains(r#"role="group""#), "{html}");
        // The chips lose their × (nothing may be removed from a dead field).
        assert!(!html.contains("hk-tag-close"), "{html}");
    }

    #[test]
    fn tag_input_styles_come_from_the_canonical_vue_sheet() {
        let css = TagInputComponent::styles();
        for class in [
            ".hk-tag-input-wrapper",
            ".hk-tag-input-label",
            ".hk-tag-input-box",
            ".hk-tag-input-box-sm",
            ".hk-tag-input-box-md",
            ".hk-tag-input-box-lg",
            ".hk-tag-input-box-open",
            ".hk-tag-input-tag",
            ".hk-tag-input-tag-text",
            ".hk-tag-input-element",
            ".hk-tag-input-placeholder",
            ".hk-tag-input-chevron",
            ".hk-tag-input-hint",
            ".hk-tag-input-panel",
            ".hk-tag-input-search",
            ".hk-tag-input-list",
            ".hk-tag-input-row",
            ".hk-tag-input-check",
            ".hk-tag-input-row-flag",
            ".hk-tag-input-row-label",
            ".hk-tag-input-row-meta",
            ".hk-tag-input-grip",
            ".hk-tag-input-empty",
        ] {
            assert!(
                css.contains(class),
                "tag-input css must carry the vue class {class:?}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored tag input sheet"
        );
    }
}
