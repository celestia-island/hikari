// hi-components/src/data/user_picker.rs
// UserPicker — mirror of the canonical Vue `HkUserPicker`: the ONE
// user-selection business component (2026-10-10 user direction) — selected
// members travel as tags (display name + email), picking happens through a
// search dialog (type a nickname, username or email, click a row).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkUserPicker.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-user-picker*` class names are literal and identical in both forms.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   ── the field ──
//   div.hk-user-picker [.is-disabled]
//     div.hk-user-picker-label?                       {label}
//     div.hk-user-picker-field [role=button] [tabindex=0|-1]
//         [aria-disabled=true|false] [aria-label]      (click + Enter/Space)
//       span.hk-user-picker-tag [title]                (per selected user)
//         span.hk-user-picker-tag-body
//           span.hk-user-picker-tag-name               {tagTitle}
//           span.hk-user-picker-tag-email?             {email}
//         button.hk-user-picker-tag-x?                 (live field only)
//             [type=button] [aria-label="Remove {name}"] ×
//       span.hk-user-picker-add [.is-placeholder?]     (the add hint)
//   ── the dialog (mirrored Modal, width 30rem) ──
//   div.hk-modal… > div.hk-user-picker-dialog
//     {mirrored SearchInput}                            (the query box)
//     div.hk-user-picker-rows [data-state=loading|failed|empty|ready]
//       p.hk-user-picker-note?                          (the standing note)
//       button.hk-user-picker-row [.is-selected] [data-checked?]  (per hit)
//             [type=button]
//         span.hk-user-picker-row-main
//           span.hk-user-picker-row-name                {tagTitle}
//           span.hk-user-picker-row-email?              {email}
//         span.hk-user-picker-row-check? [aria-hidden=true] ✓ (multi draft)
//     p.hk-user-picker-count?                           (multi, draft > 0)
//     ── multi footer (mirrored Modal footerActions): Cancel / Confirm ──
//
// STATE CONTRACT (the crate's zero-signal rule): Vue owns the dialog's
// whole session in refs — `open`, `query`, `results`, `loading`,
// `failed`, the multi-mode working copy `draft` and the race guard. The
// mirror takes every one as a CONTROLLED prop and exports the session
// transitions as pure helpers so the host reproduces Vue's behaviour:
//
//   [`user_picker_cap_results`]      Vue's `slice(0, maxResults)` at write
//   [`UserPickerRowsState`]          the `data-state` ladder (loading →
//                                    failed → empty → ready)
//   [`user_picker_note`]             which standing note renders (and
//                                    empty-with-query vs empty-initial)
//   [`user_picker_toggle_draft`]     the multi-mode working-copy toggle
//   [`user_picker_pick_value`]       what a row pick means per mode
//   [`user_picker_remove_uid`]       the tag ×'s value edit
//
// The events are the session's edges: `on_open` (the field was activated —
// the host opens AND runs the initial search, Vue's one-search-per-open
// rule), `on_query_change` (the box text moved — the host debounces and
// searches; a rejection renders the retry hint, never a throw),
// `on_search` (Enter in the mirrored SearchInput), `on_pick` (a row),
// `on_confirm` (multi OK — the host commits the draft),
// `on_cancel` (the dialog asked to close) and `on_remove` (a tag ×).
//
// Deltas vs Vue (documented, not accidental):
//   * NO TRANSPORT AND NO ASYNC: Vue's required `search` callback (a
//     Promise) becomes the host's `on_query_change`/`on_search` handler
//     feeding `results`/`loading`/`failed` back in — the component carries
//     zero transport either way, and the race guard belongs to the caller
//     that owns the async.
//   * THE DEBOUNCE IS INERT, like the mirrored SearchInput's `debounce`
//     prop (250 is still passed for fidelity): the host owns the timing.
//   * Results are capped AT RENDER here (Vue caps at write); the output is
//     identical because [`user_picker_cap_results`] is the same slice.
//   * Vue remounts the search input per open (`key={sessionSeq}`) so a
//     fresh session starts blank; the mirror simply renders the props the
//     host re-seeds on open (empty query, empty results).
//   * The × glyph and the row check are TEXT ("×" / "✓") exactly like
//     Vue's — no SVG involved.
//
// I18N: every string rides `hikari_i18n::t` under
// `components.hk.userPicker.*` — the English literals are the canonical
// ones from the Vue app dictionary (`hikari::userPicker.*` in
// `packages/vue/src/i18n/locales/en/components.json`), re-keyed to the
// crate's component namespace (the same mapping `layout/affix_picker.rs`
// applies; Vue shares its Cancel with `hikari::messageBox.cancel` — the
// mirror gives it this component's own key). New keys (see the wave
// receipt): title, add, remove, confirm, cancel, searchPlaceholder,
// searching, searchFailed, empty, emptyInitial, selectedCount.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamps and inline tuple types keep the port auditable
// against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
#![allow(clippy::too_many_arguments)]
use hikari_i18n::t;

use crate::basic::search_input::{SearchInput, SearchInputProps};
use crate::feedback::modal::{Modal, ModalAction, ModalActionVariant, ModalProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct UserPickerComponent;

/// One pickable user (Vue: `HkUserOption`). `uid` is the stable identity
/// (what the host stores); the rest is display baggage the field keeps
/// inside its value so hosts never re-fetch to re-render.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct HkUserOption {
    pub uid: String,
    pub username: String,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

impl HkUserOption {
    /// A bare user — username only, no display name, no email.
    pub fn new(uid: impl Into<String>, username: impl Into<String>) -> Self {
        Self {
            uid: uid.into(),
            username: username.into(),
            ..Default::default()
        }
    }
}

/// The selection semantics (the HkAffixPicker mode vocabulary): `single`
/// closes on pick and replaces the selection; `multi` toggles rows in a
/// working copy and commits on Confirm.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum UserPickerMode {
    #[default]
    Single,
    Multi,
}

/// Primary tag label (Vue's `tagTitle`): the display name when the
/// deployment has one, the username otherwise — never both stacked (a
/// WHITESPACE-only display name counts as none, Vue's `?.trim() ||`).
pub fn user_picker_tag_title(user: &HkUserOption) -> String {
    user.display_name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or(&user.username)
        .to_string()
}

/// The tag's native tooltip (Vue: `` `${tagTitle} ${email ?? ""}`.trim() ``).
pub fn user_picker_tag_title_attr(user: &HkUserOption) -> String {
    let title = user_picker_tag_title(user);
    match &user.email {
        Some(email) => format!("{title} {email}").trim().to_string(),
        None => title,
    }
}

/// The add hint: the placeholder while nothing is selected, the plain
/// "Select users…" line once tags are on screen (Vue's ternary).
pub fn user_picker_add_text(is_empty: bool, placeholder: Option<&str>) -> String {
    if is_empty {
        placeholder
            .map(str::to_string)
            .unwrap_or_else(|| t("components.hk.userPicker.add", "Select users…"))
    } else {
        t("components.hk.userPicker.add", "Select users…")
    }
}

/// A runaway backend answer cannot turn the dialog into a thousand-row
/// scroll (Vue caps at write; the mirror caps at render — same slice).
pub fn user_picker_cap_results(results: &[HkUserOption], max_results: usize) -> Vec<HkUserOption> {
    results.iter().take(max_results).cloned().collect()
}

/// The rows container's `data-state` ladder (Vue's inline ternary).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum UserPickerRowsState {
    Loading,
    Failed,
    Empty,
    Ready,
}

impl UserPickerRowsState {
    /// The attribute value exactly as Vue emits it.
    pub fn as_str(self) -> &'static str {
        match self {
            UserPickerRowsState::Loading => "loading",
            UserPickerRowsState::Failed => "failed",
            UserPickerRowsState::Empty => "empty",
            UserPickerRowsState::Ready => "ready",
        }
    }
}

/// Vue's `data-state` ternary, evaluated in its own render order.
pub fn user_picker_row_state(
    loading: bool,
    failed: bool,
    result_count: usize,
) -> UserPickerRowsState {
    if loading {
        UserPickerRowsState::Loading
    } else if failed {
        UserPickerRowsState::Failed
    } else if result_count == 0 {
        UserPickerRowsState::Empty
    } else {
        UserPickerRowsState::Ready
    }
}

/// Which standing note the rows area renders (`None` when rows are on
/// screen). The empty note splits by query: a trimmed query means "no
/// users match this search", a blank one means the initial batch came
/// back empty.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum UserPickerNote {
    Searching,
    Failed,
    EmptyQuery,
    EmptyInitial,
}

impl UserPickerNote {
    /// The note's localized text.
    pub fn text(self) -> String {
        match self {
            UserPickerNote::Searching => t("components.hk.userPicker.searching", "Searching…"),
            UserPickerNote::Failed => t(
                "components.hk.userPicker.searchFailed",
                "The search failed; try again.",
            ),
            UserPickerNote::EmptyQuery => t(
                "components.hk.userPicker.empty",
                "No users match this search.",
            ),
            UserPickerNote::EmptyInitial => t(
                "components.hk.userPicker.emptyInitial",
                "Type a nickname, username or email to search.",
            ),
        }
    }
}

/// Vue's three note guards, collapsed into one pick.
pub fn user_picker_note(
    loading: bool,
    failed: bool,
    result_count: usize,
    query: &str,
) -> Option<UserPickerNote> {
    if loading {
        Some(UserPickerNote::Searching)
    } else if failed {
        Some(UserPickerNote::Failed)
    } else if result_count == 0 {
        if query.trim().is_empty() {
            Some(UserPickerNote::EmptyInitial)
        } else {
            Some(UserPickerNote::EmptyQuery)
        }
    } else {
        None
    }
}

/// Whether `uid` sits in the multi-mode working copy.
pub fn user_picker_in_draft(draft: &[HkUserOption], uid: &str) -> bool {
    draft.iter().any(|user| user.uid == uid)
}

/// The multi-mode working-copy toggle (Vue's `pickRow` multi branch):
/// in-draft rows drop out, the rest append.
pub fn user_picker_toggle_draft(draft: &[HkUserOption], user: &HkUserOption) -> Vec<HkUserOption> {
    if user_picker_in_draft(draft, &user.uid) {
        draft
            .iter()
            .filter(|kept| kept.uid != user.uid)
            .cloned()
            .collect()
    } else {
        let mut next = draft.to_vec();
        next.push(user.clone());
        next
    }
}

/// What a row pick means per mode (Vue's `pickRow`): `single` closes and
/// replaces the value; `multi` edits the working copy (committed on
/// Confirm). One helper so the host cannot mix the two up.
pub fn user_picker_pick_value(
    mode: UserPickerMode,
    draft: &[HkUserOption],
    user: &HkUserOption,
) -> Vec<HkUserOption> {
    match mode {
        UserPickerMode::Single => vec![user.clone()],
        UserPickerMode::Multi => user_picker_toggle_draft(draft, user),
    }
}

/// The tag ×'s value edit (Vue's `removeTag` filter).
pub fn user_picker_remove_uid(value: &[HkUserOption], uid: &str) -> Vec<HkUserOption> {
    value
        .iter()
        .filter(|user| user.uid != uid)
        .cloned()
        .collect()
}

/// The row's class string: the legacy `.is-selected` face only exists in
/// multi mode for a drafted row.
pub fn user_picker_row_classes(mode: UserPickerMode, in_draft: bool) -> String {
    if mode == UserPickerMode::Multi && in_draft {
        "hk-user-picker-row is-selected".to_string()
    } else {
        "hk-user-picker-row".to_string()
    }
}

/// The unified menu-item grammar's `data-checked` presence marker (the
/// picked row's face survives hover — emitted beside the legacy class).
pub fn user_picker_checked_attr(mode: UserPickerMode, in_draft: bool) -> Option<&'static str> {
    if mode == UserPickerMode::Multi && in_draft {
        Some("true")
    } else {
        None
    }
}

/// The multi footer's Confirm is dead while the working copy is empty
/// (Vue: `disabled: draft.value.length === 0`).
pub fn user_picker_confirm_disabled(mode: UserPickerMode, draft_count: usize) -> bool {
    mode == UserPickerMode::Multi && draft_count == 0
}

/// The count line: `{count} selected` (multi mode, drafted rows only).
pub fn user_picker_count_text(count: usize) -> String {
    t("components.hk.userPicker.selectedCount", "{count} selected")
        .replace("{count}", &count.to_string())
}

/// Whether the count line renders at all.
pub fn user_picker_count_visible(mode: UserPickerMode, draft_count: usize) -> bool {
    mode == UserPickerMode::Multi && draft_count > 0
}

#[define_props]
pub struct UserPickerProps {
    /// The selected users (Vue: `modelValue`).
    #[default]
    pub model_value: Vec<HkUserOption>,

    /// `single` replaces the selection on pick; `multi` accumulates.
    #[default]
    pub mode: UserPickerMode,

    /// Field label; also the dialog's title (Vue: `label ?? t(title)`).
    pub label: Option<String>,

    /// The add hint while nothing is selected (falls back to the i18n
    /// default).
    pub placeholder: Option<String>,

    /// A dead field: dimmed, the tags lose their ×, clicks never open.
    pub disabled: bool,

    /// Rows rendered per query (Vue: `maxResults`, default 50).
    #[default(50)]
    pub max_results: usize,

    /// Dialog visibility (Vue's `open` ref).
    pub open: bool,

    /// The live query (Vue's `query` ref — re-seeded empty on every open).
    pub query: String,

    /// The current search answer (already host-debounced).
    #[default]
    pub results: Vec<HkUserOption>,

    /// A search is in flight.
    pub loading: bool,

    /// The last search rejected — render the retry hint, never a throw.
    pub failed: bool,

    /// The multi-mode working copy, committed only on Confirm.
    #[default]
    pub draft: Vec<HkUserOption>,

    /// The field was activated (click / Enter / Space): the host opens the
    /// dialog, re-seeds the session (blank query, empty results, draft =
    /// value) and runs the initial search.
    pub on_open: Option<EventHandler<()>>,

    /// The query box text moved (Vue: `update:modelValue` — the host
    /// debounces and searches).
    pub on_query_change: Option<EventHandler<String>>,

    /// Enter was pressed in the query box (the mirrored SearchInput's
    /// search emit).
    pub on_search: Option<EventHandler<String>>,

    /// A result row was picked — see [`user_picker_pick_value`] for what
    /// it means per mode.
    pub on_pick: Option<EventHandler<HkUserOption>>,

    /// Multi-mode Confirm: the host commits the draft to the value.
    pub on_confirm: Option<EventHandler<()>>,

    /// The dialog asked to close (✕ / overlay / Cancel / single pick).
    pub on_cancel: Option<EventHandler<()>>,

    /// A tag × was pressed; carries the uid (the host edits the value —
    /// no dialog involved).
    pub on_remove: Option<EventHandler<String>>,
}

/// One selected-member tag.
fn user_picker_tag(
    user: &HkUserOption,
    disabled: bool,
    on_remove: &Option<EventHandler<String>>,
) -> VNode {
    let mut tag = VElement::new("span")
        .class("hk-user-picker-tag")
        .attr("title", user_picker_tag_title_attr(user));
    let mut body = VElement::new("span").class("hk-user-picker-tag-body");
    body = body.child(VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-user-picker-tag-name")
            .child(VNode::Text(VText::new(
                user_picker_tag_title(user).as_str(),
            ))),
    )));
    if let Some(email) = &user.email {
        body = body.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-user-picker-tag-email")
                .child(VNode::Text(VText::new(email.as_str()))),
        )));
    }
    tag = tag.child(VNode::Element(Box::new(body)));

    // A dead field renders the tags WITHOUT their × (Vue's
    // `!props.disabled &&`).
    if !disabled {
        let uid = user.uid.clone();
        let handler = on_remove.clone();
        let title = user_picker_tag_title(user);
        let remove_label = t("components.hk.userPicker.remove", "Remove");
        tag = tag.child(VNode::Element(Box::new(
            VElement::new("button")
                .class("hk-user-picker-tag-x")
                .attr("type", "button")
                .attr("aria-label", format!("{remove_label} {title}"))
                .child(VNode::Text(VText::new("×")))
                .on_click(move |event: MouseEvent| {
                    // The × must not open the dialog beneath it.
                    event.stop_propagation();
                    if let Some(handler) = handler.as_ref() {
                        handler.call(uid.clone());
                    }
                }),
        )));
    }
    VNode::Element(Box::new(tag))
}

#[component]
pub fn UserPicker(props: UserPickerProps) -> Element {
    // ── the field ──────────────────────────────────────────────────────
    let mut root_classes = String::from("hk-user-picker");
    if props.disabled {
        root_classes.push_str(" is-disabled");
    }

    let field_label = props
        .label
        .clone()
        .unwrap_or_else(|| t("components.hk.userPicker.title", "Select users"));

    let mut field = VElement::new("div")
        .class("hk-user-picker-field")
        .attr("role", "button")
        .attr("tabindex", if props.disabled { "-1" } else { "0" })
        .attr(
            "aria-disabled",
            if props.disabled { "true" } else { "false" },
        )
        .attr("aria-label", field_label);

    for user in &props.model_value {
        field = field.child(user_picker_tag(user, props.disabled, &props.on_remove));
    }

    let is_empty = props.model_value.is_empty();
    let mut add_classes = String::from("hk-user-picker-add");
    if is_empty {
        add_classes.push_str(" is-placeholder");
    }
    let add_text = user_picker_add_text(is_empty, props.placeholder.as_deref());
    field = field.child(VNode::Element(Box::new(
        VElement::new("span")
            .class(add_classes)
            .child(VNode::Text(VText::new(add_text.as_str()))),
    )));

    // Click and keyboard parity on the same activation edge; a dead field
    // takes neither (Vue guards both handlers).
    let on_open = props.on_open.clone();
    let disabled = props.disabled;
    let open_click = {
        let on_open = on_open.clone();
        move |_event: MouseEvent| {
            if disabled {
                return;
            }
            if let Some(handler) = on_open.as_ref() {
                handler.call(());
            }
        }
    };
    let open_key = move |event: KeyboardEvent| {
        if disabled {
            return;
        }
        if event.key == "Enter" || event.key == " " {
            event.prevent_default();
            if let Some(handler) = on_open.as_ref() {
                handler.call(());
            }
        }
    };
    field = field.on_click(open_click).on_keydown(open_key);

    let mut root = VElement::new("div").class(root_classes);
    if let Some(label) = &props.label {
        root = root.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-user-picker-label")
                .child(VNode::Text(VText::new(label.as_str()))),
        )));
    }
    root = root.child(VNode::Element(Box::new(field)));

    // ── the dialog ─────────────────────────────────────────────────────
    let results = user_picker_cap_results(&props.results, props.max_results);
    let rows_state = user_picker_row_state(props.loading, props.failed, results.len());
    let note = user_picker_note(props.loading, props.failed, results.len(), &props.query);

    let search = SearchInput(SearchInputProps {
        model_value: props.query.clone(),
        placeholder: Some(t(
            "components.hk.userPicker.searchPlaceholder",
            "Nickname, username or email",
        )),
        // Inert on the mirrored SearchInput (see the header); still the
        // number Vue passes.
        debounce: 250.0,
        oninput: props.on_query_change.clone(),
        onsearch: props.on_search.clone(),
        ..Default::default()
    });

    let mut rows = VElement::new("div")
        .class("hk-user-picker-rows")
        .attr("data-state", rows_state.as_str());
    if let Some(note) = note {
        rows = rows.child(VNode::Element(Box::new(
            VElement::new("p")
                .class("hk-user-picker-note")
                .child(VNode::Text(VText::new(&note.text()))),
        )));
    }
    for user in &results {
        let in_draft =
            props.mode == UserPickerMode::Multi && user_picker_in_draft(&props.draft, &user.uid);
        let mut row = VElement::new("button")
            .class(user_picker_row_classes(props.mode, in_draft))
            .attr("type", "button");
        if let Some(marker) = user_picker_checked_attr(props.mode, in_draft) {
            row = row.attr("data-checked", marker);
        }
        let mut main = VElement::new("span").class("hk-user-picker-row-main");
        main = main.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-user-picker-row-name")
                .child(VNode::Text(VText::new(
                    user_picker_tag_title(user).as_str(),
                ))),
        )));
        if let Some(email) = &user.email {
            main = main.child(VNode::Element(Box::new(
                VElement::new("span")
                    .class("hk-user-picker-row-email")
                    .child(VNode::Text(VText::new(email.as_str()))),
            )));
        }
        row = row.child(VNode::Element(Box::new(main)));
        if in_draft {
            row = row.child(VNode::Element(Box::new(
                VElement::new("span")
                    .class("hk-user-picker-row-check")
                    .attr("aria-hidden", "true")
                    .child(VNode::Text(VText::new("✓"))),
            )));
        }
        let on_pick = props.on_pick.clone();
        let picked = user.clone();
        row = row.on_click(move |_event: MouseEvent| {
            if let Some(handler) = on_pick.as_ref() {
                handler.call(picked.clone());
            }
        });
        rows = rows.child(VNode::Element(Box::new(row)));
    }

    let mut dialog = VElement::new("div").class("hk-user-picker-dialog");
    dialog = dialog.child(search);
    dialog = dialog.child(VNode::Element(Box::new(rows)));
    if user_picker_count_visible(props.mode, props.draft.len()) {
        dialog = dialog.child(VNode::Element(Box::new(
            VElement::new("p")
                .class("hk-user-picker-count")
                .child(VNode::Text(VText::new(&user_picker_count_text(
                    props.draft.len(),
                )))),
        )));
    }

    // The footer only exists in multi mode (Vue's `dialogActions`).
    let footer_actions = match props.mode {
        UserPickerMode::Single => None,
        UserPickerMode::Multi => {
            let on_cancel = props.on_cancel.clone();
            let on_confirm = props.on_confirm.clone();
            Some(vec![
                ModalAction {
                    label: t("components.hk.userPicker.cancel", "Cancel"),
                    variant: ModalActionVariant::Secondary,
                    on_click: on_cancel
                        .map(|handler| EventHandler::new(move |()| handler.call(()))),
                    ..Default::default()
                },
                ModalAction {
                    label: t("components.hk.userPicker.confirm", "Confirm"),
                    variant: ModalActionVariant::Primary,
                    disabled: user_picker_confirm_disabled(
                        UserPickerMode::Multi,
                        props.draft.len(),
                    ),
                    on_click: on_confirm
                        .map(|handler| EventHandler::new(move |()| handler.call(()))),
                    ..Default::default()
                },
            ])
        }
    };

    let on_cancel = props.on_cancel.clone();
    let modal = Modal(ModalProps {
        open: props.open,
        title: Some(
            props
                .label
                .clone()
                .unwrap_or_else(|| t("components.hk.userPicker.title", "Select users")),
        ),
        width: "30rem".to_string(),
        footer_actions,
        on_close: on_cancel
            .map(|handler| EventHandler::new(move |_event: MouseEvent| handler.call(()))),
        children: VNode::Element(Box::new(dialog)),
        ..Default::default()
    });

    VNode::Fragment(vec![VNode::Element(Box::new(root)), modal])
}

impl StyledComponent for UserPickerComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-user-picker*` names literal so this CSS matches the Vue
        // build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkUserPicker.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "user-picker"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user(uid: &str, username: &str, display: Option<&str>, email: Option<&str>) -> HkUserOption {
        HkUserOption {
            uid: uid.to_string(),
            username: username.to_string(),
            display_name: display.map(str::to_string),
            email: email.map(str::to_string),
            avatar_url: None,
        }
    }

    // ── props defaults ─────────────────────────────────────────────────

    #[test]
    fn user_picker_defaults_match_the_vue_props() {
        let props = UserPickerProps::default();
        assert!(props.model_value.is_empty());
        assert_eq!(props.mode, UserPickerMode::Single);
        assert!(props.label.is_none());
        assert!(props.placeholder.is_none());
        assert!(!props.disabled);
        assert_eq!(props.max_results, 50);
        assert!(!props.open);
        assert_eq!(props.query, "");
        assert!(props.results.is_empty());
        assert!(!props.loading);
        assert!(!props.failed);
        assert!(props.draft.is_empty());
        assert!(props.on_open.is_none());
        assert!(props.on_query_change.is_none());
        assert!(props.on_search.is_none());
        assert!(props.on_pick.is_none());
        assert!(props.on_confirm.is_none());
        assert!(props.on_cancel.is_none());
        assert!(props.on_remove.is_none());

        let option = HkUserOption::default();
        assert_eq!(option.uid, "");
        assert_eq!(option.username, "");
        assert!(option.email.is_none());
        assert!(option.display_name.is_none());
        assert!(option.avatar_url.is_none());
    }

    // ── class-name mapping ────────────────────────────────────────────

    #[test]
    fn user_picker_class_names_match_the_vue_sheet() {
        assert_eq!(
            user_picker_row_classes(UserPickerMode::Single, true),
            "hk-user-picker-row"
        );
        assert_eq!(
            user_picker_row_classes(UserPickerMode::Multi, true),
            "hk-user-picker-row is-selected"
        );
        assert_eq!(
            user_picker_row_classes(UserPickerMode::Multi, false),
            "hk-user-picker-row"
        );
        // The grammar's checked face is presence-only, multi-draft only.
        assert_eq!(
            user_picker_checked_attr(UserPickerMode::Multi, true),
            Some("true")
        );
        assert_eq!(user_picker_checked_attr(UserPickerMode::Multi, false), None);
        assert_eq!(user_picker_checked_attr(UserPickerMode::Single, true), None);
        assert_eq!(UserPickerRowsState::Loading.as_str(), "loading",);
        assert_eq!(UserPickerRowsState::Failed.as_str(), "failed");
        assert_eq!(UserPickerRowsState::Empty.as_str(), "empty");
        assert_eq!(UserPickerRowsState::Ready.as_str(), "ready");
    }

    // ── the pure session helpers ──────────────────────────────────────

    #[test]
    fn user_picker_tag_title_prefers_a_real_display_name() {
        let plain = user("1", "ada", None, None);
        assert_eq!(user_picker_tag_title(&plain), "ada");
        let named = user("1", "ada", Some("Ada Lovelace"), None);
        assert_eq!(user_picker_tag_title(&named), "Ada Lovelace");
        // A whitespace-only display name counts as none (Vue's trim-||).
        let blank = user("1", "ada", Some("   "), None);
        assert_eq!(user_picker_tag_title(&blank), "ada");
        // The tooltip joins the email and trims the join.
        let mailed = user("1", "ada", Some("Ada"), Some("ada@x.dev"));
        assert_eq!(user_picker_tag_title_attr(&mailed), "Ada ada@x.dev");
        assert_eq!(
            user_picker_tag_title_attr(&plain),
            "ada",
            "no email leaves the plain title"
        );
    }

    #[test]
    fn user_picker_add_text_follows_the_vue_ternary() {
        assert_eq!(
            user_picker_add_text(true, None),
            "Select users…",
            "empty falls back to the i18n default"
        );
        assert_eq!(
            user_picker_add_text(true, Some("Pick teammates")),
            "Pick teammates"
        );
        assert_eq!(
            user_picker_add_text(false, Some("Pick teammates")),
            "Select users…",
            "once tags exist the placeholder line is the i18n one"
        );
    }

    #[test]
    fn user_picker_state_and_note_ladders_match_the_vue_guards() {
        use UserPickerNote::{EmptyInitial, EmptyQuery, Failed as FailedNote, Searching};
        use UserPickerRowsState::{Empty, Failed, Loading, Ready};
        // loading wins; then failed; then emptiness splits by query.
        assert_eq!(user_picker_row_state(true, true, 3), Loading);
        assert_eq!(user_picker_row_state(false, true, 3), Failed);
        assert_eq!(user_picker_row_state(false, false, 0), Empty);
        assert_eq!(user_picker_row_state(false, false, 2), Ready);
        assert_eq!(user_picker_note(true, true, 3, "x"), Some(Searching));
        assert_eq!(user_picker_note(false, true, 0, ""), Some(FailedNote));
        assert_eq!(
            user_picker_note(false, false, 0, "  "),
            Some(EmptyInitial),
            "a blank query is the initial batch"
        );
        assert_eq!(user_picker_note(false, false, 0, "ada"), Some(EmptyQuery));
        assert_eq!(user_picker_note(false, false, 1, "ada"), None);
        assert_eq!(UserPickerNote::Searching.text(), "Searching…");
        assert_eq!(
            UserPickerNote::EmptyQuery.text(),
            "No users match this search."
        );
    }

    #[test]
    fn user_picker_draft_and_value_edits_follow_the_vue_branches() {
        let ada = user("1", "ada", None, None);
        let bob = user("2", "bob", None, None);

        // Multi toggles in and out of the working copy.
        let drafted = user_picker_toggle_draft(&[], &ada);
        assert_eq!(drafted.len(), 1);
        let drafted = user_picker_toggle_draft(&drafted, &bob);
        assert_eq!(drafted.len(), 2);
        assert!(user_picker_in_draft(&drafted, "1"));
        let drafted = user_picker_toggle_draft(&drafted, &ada);
        assert!(!user_picker_in_draft(&drafted, "1"));
        assert_eq!(drafted.len(), 1);

        // Single replaces regardless of the draft; multi edits it.
        assert_eq!(
            user_picker_pick_value(UserPickerMode::Single, &drafted, &ada),
            vec![ada.clone()]
        );
        assert_eq!(
            user_picker_pick_value(UserPickerMode::Multi, &[], &ada),
            vec![ada.clone()]
        );

        // The tag × removes directly, no dialog.
        let value = vec![ada.clone(), bob.clone()];
        let removed = user_picker_remove_uid(&value, "1");
        assert_eq!(removed, vec![bob.clone()]);
        assert_eq!(user_picker_remove_uid(&value, "gone").len(), 2);

        // The cap is Vue's slice.
        let many: Vec<HkUserOption> = (0..80)
            .map(|i| user(&i.to_string(), "u", None, None))
            .collect();
        assert_eq!(user_picker_cap_results(&many, 50).len(), 50);
        assert_eq!(user_picker_cap_results(&many, 3).len(), 3);

        // Confirm is dead on an empty multi draft only.
        assert!(user_picker_confirm_disabled(UserPickerMode::Multi, 0));
        assert!(!user_picker_confirm_disabled(UserPickerMode::Multi, 2));
        assert!(!user_picker_confirm_disabled(UserPickerMode::Single, 0));
        assert_eq!(user_picker_count_text(3), "3 selected");
        assert!(user_picker_count_visible(UserPickerMode::Multi, 1));
        assert!(!user_picker_count_visible(UserPickerMode::Multi, 0));
        assert!(!user_picker_count_visible(UserPickerMode::Single, 3));
    }

    // ── DOM contract ──────────────────────────────────────────────────

    #[test]
    fn user_picker_renders_the_field_with_tags_and_the_add_hint() {
        let html = UserPicker(UserPickerProps {
            label: Some("Owners".to_string()),
            model_value: vec![
                user("1", "ada", Some("Ada Lovelace"), Some("ada@x.dev")),
                user("2", "bob", None, None),
            ],
            placeholder: Some("Pick owners".to_string()),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-user-picker""#,
            r#"class="hk-user-picker-label""#,
            "Owners",
            r#"class="hk-user-picker-field""#,
            r#"role="button""#,
            r#"tabindex="0""#,
            r#"aria-disabled="false""#,
            r#"aria-label="Owners""#,
            r#"class="hk-user-picker-tag""#,
            "title=\"Ada Lovelace ada@x.dev\"",
            r#"class="hk-user-picker-tag-body""#,
            r#"class="hk-user-picker-tag-name""#,
            "Ada Lovelace",
            r#"class="hk-user-picker-tag-email""#,
            "ada@x.dev",
            ">bob</span>",
            r#"class="hk-user-picker-tag-x""#,
            r#"aria-label="Remove Ada Lovelace""#,
            ">×</button>",
            // Tags exist → the add line is the plain i18n one, not the
            // placeholder.
            r#"class="hk-user-picker-add""#,
            "Select users…",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("is-placeholder"), "{html}");
        assert!(!html.contains("is-disabled"), "{html}");
        // The dialog is closed.
        assert!(!html.contains("hk-user-picker-dialog"), "{html}");
    }

    #[test]
    fn user_picker_renders_the_placeholder_and_disabled_faces() {
        let empty = UserPicker(UserPickerProps::default()).render_to_html();
        assert!(empty.contains("is-placeholder"), "{empty}");
        assert!(empty.contains("Select users…"), "{empty}");
        // No label prop → the field's accessible name is the i18n title.
        assert!(empty.contains(r#"aria-label="Select users""#), "{empty}");
        assert!(!empty.contains("hk-user-picker-label"), "{empty}");

        let disabled = UserPicker(UserPickerProps {
            disabled: true,
            model_value: vec![user("1", "ada", None, None)],
            ..Default::default()
        })
        .render_to_html();
        assert!(
            disabled.contains("hk-user-picker is-disabled"),
            "{disabled}"
        );
        assert!(disabled.contains(r#"tabindex="-1""#), "{disabled}");
        assert!(disabled.contains(r#"aria-disabled="true""#), "{disabled}");
        // A dead field renders its tags WITHOUT the ×.
        assert!(!disabled.contains("hk-user-picker-tag-x"), "{disabled}");
    }

    #[test]
    fn user_picker_dialog_renders_rows_states_and_the_multi_footer() {
        let html = UserPicker(UserPickerProps {
            open: true,
            mode: UserPickerMode::Multi,
            query: "ad".to_string(),
            results: vec![
                user("1", "ada", Some("Ada Lovelace"), Some("ada@x.dev")),
                user("2", "bob", None, None),
            ],
            draft: vec![user("1", "ada", Some("Ada Lovelace"), None)],
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-user-picker-dialog""#,
            "hk-search-input",
            r#"placeholder="Nickname, username or email""#,
            r#"class="hk-user-picker-rows""#,
            r#"data-state="ready""#,
            r#"class="hk-user-picker-row is-selected""#,
            r#"data-checked="true""#,
            r#"class="hk-user-picker-row-main""#,
            r#"class="hk-user-picker-row-name""#,
            r#"class="hk-user-picker-row-email""#,
            r#"class="hk-user-picker-row-check""#,
            "✓",
            r#"class="hk-user-picker-count""#,
            "1 selected",
            ">Confirm<",
            ">Cancel<",
            // The modal frame, the Vue width.
            "hk-modal-title",
            "Select users",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Exactly the drafted row carries the checked pair.
        assert_eq!(html.matches("data-checked").count(), 1, "{html}");
        assert_eq!(
            html.matches("hk-user-picker-row-check").count(),
            1,
            "{html}"
        );
        // No standing note while rows are on screen.
        assert!(!html.contains("hk-user-picker-note"), "{html}");
    }

    #[test]
    fn user_picker_dialog_renders_the_standing_notes_and_empty_footer_rules() {
        let searching = UserPicker(UserPickerProps {
            open: true,
            loading: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(searching.contains(r#"data-state="loading""#), "{searching}");
        assert!(searching.contains("Searching…"), "{searching}");

        let failed = UserPicker(UserPickerProps {
            open: true,
            failed: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(failed.contains(r#"data-state="failed""#), "{failed}");
        assert!(failed.contains("The search failed; try again."), "{failed}");

        let initial = UserPicker(UserPickerProps {
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(initial.contains(r#"data-state="empty""#), "{initial}");
        assert!(
            initial.contains("Type a nickname, username or email to search."),
            "{initial}"
        );

        let no_match = UserPicker(UserPickerProps {
            open: true,
            query: "  zzz  ".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            no_match.contains("No users match this search."),
            "{no_match}"
        );

        // Single mode has no footer actions; multi with an empty draft
        // renders a dead Confirm.
        let single = UserPicker(UserPickerProps {
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(!single.contains(">Cancel<"), "{single}");
        assert!(!single.contains(">Confirm<"), "{single}");

        let multi_empty = UserPicker(UserPickerProps {
            open: true,
            mode: UserPickerMode::Multi,
            ..Default::default()
        })
        .render_to_html();
        assert!(multi_empty.contains(">Confirm<"), "{multi_empty}");
        assert!(
            multi_empty.contains(r#"disabled="disabled""#),
            "{multi_empty}"
        );
        assert!(
            !multi_empty.contains("hk-user-picker-count"),
            "{multi_empty}"
        );
    }

    #[test]
    fn user_picker_styles_come_from_the_canonical_vue_sheet() {
        let css = UserPickerComponent::styles();
        for needle in [
            ".hk-user-picker",
            ".hk-user-picker-field",
            ".hk-user-picker-tag",
            ".hk-user-picker-tag-x",
            ".hk-user-picker-add",
            ".hk-user-picker-dialog",
            ".hk-user-picker-rows",
            ".hk-user-picker-row",
            ".hk-user-picker-count",
        ] {
            assert!(
                css.contains(needle),
                "user-picker css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored user-picker sheet"
        );
        assert_eq!(UserPickerComponent::name(), "user-picker");
    }
}
