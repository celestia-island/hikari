// hi-components/src/data/user_picker.rs
// UserPicker — mirror of the canonical Vue `HkUserPicker`: the ONE
// user-selection business component (2026-10-10 user direction) — selected
// members travel as tags (display name + email), picking happens through a
// SEARCH-FIRST anchored panel (2026-11-17 user direction, #1358): the field
// opens the `hk-select-*` surface the selects use (desktop popout under the
// field, the shared bottom sheet on phone widths), a search box sits at the
// top, and the candidates render under it.
//
// THE EMPTY-QUERY CONTRACT (the 2026-11-17 ruling's hard line): an empty (or
// whitespace-only) query means NO candidates and NO request — the panel's
// opening state is one standing hint ("type to search"), never the whole
// user directory. [`user_picker_should_search`] is that predicate; the host
// consults it before running its search (the component carries zero
// transport either way).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkUserPicker.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-user-picker*` class names are literal and identical in both forms.
//
// FORM DELTA (2026-11-18, the third-pass ruling): the Vue component grew a
// TRIGGER presentation — the host fills the `trigger` slot with its own
// icon button and the SAME panel anchors to it (`.hk-user-picker-trigger`
// wrapper, `.is-trigger-anchor` panel width). The mirror keeps the FIELD
// form only: a Rust host that wants a trigger anchor composes its own
// button with the panel helpers — there is no slot concept to mirror, and
// the panel content column is byte-shared. The GROUP-kind rows ARE
// mirrored (see `UserOptionKind`): both forms treat users and user groups
// as the same kind of thing, per the grant-surface ruling.
//
// DOM contract (mirrors the Vue FIELD-form render output one-to-one):
//
//   ── the field ──
//   div.hk-user-picker [.is-disabled] (position:relative — the unmeasured
//       popout arm pins to it; see the geometry delta below)
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
//   ── the surface (ONLY while open; desktop popout branch) ──
//   div.hk-select-popout-host [data-side] [data-align] [style=geometry]
//     div.hk-select-popout [aria-label] [style=cap] [onkeydown]
//       div.hk-user-picker-panel
//         div.hk-user-picker-search [role=search]
//           {mirrored SearchInput}                      (the query box)
//         div.hk-user-picker-rows [role=listbox] [aria-multiselectable?]
//             [aria-label] [data-state=loading|failed|empty|ready]
//           p.hk-user-picker-note?        (Searching… / the standing hint)
//           button.hk-user-picker-retry?  (failed; click = re-run the query)
//           div.hk-user-picker-row [role=option] [aria-selected]
//               [data-checked?] [.is-selected] [data-kind=group?]
//               (per hit; kind=group renders a leading
//                div.hk-icon.hk-user-picker-row-kind glyph — MDI
//                account-group, the packed twin of Vue's lucide
//                UsersRound — before the name column)
//             span.hk-user-picker-row-main
//               span.hk-user-picker-row-name             {tagTitle}
//               span.hk-user-picker-row-email?           {email}
//             span.hk-user-picker-row-check? [aria-hidden] ✓ (multi draft)
//         div.hk-user-picker-footer?                      (multi only)
//           p.hk-user-picker-count?                       ({n} selected)
//           div.hk-user-picker-actions
//             button.hk-user-picker-cancel  (mirrored Button, secondary sm)
//             button.hk-user-picker-confirm (mirrored Button, primary sm;
//                 disabled while the draft is empty)
//   ── the surface (mobile sheet branch) ──
//   div.hk-select-sheet-scrim                       (click closes)
//   div.hk-select-sheet-panel [role=dialog] [aria-modal] [aria-label]
//       [tabindex=-1] [onkeydown]
//     div.hk-select-sheet-grabber aria-hidden=true  (click closes)
//     div.hk-select-sheet-header
//       div.hk-select-sheet-title {title}?          (only when titled)
//       button.hk-icon-button… .hk-window-close.hk-select-sheet-close
//           [aria-label="Close"]                    (the shared ✕)
//     div.hk-select-sheet-body
//       div.hk-select-sheet-list [style=cap]
//         div.hk-select-sheet-content > the panel div above
//
// STATE CONTRACT (the crate's zero-signal rule): Vue owns the panel's
// whole session in refs — `open`, `query`, `results`, `loading`, `failed`,
// the multi-mode working copy `draft`, the keyboard cursor
// `activeIndex` and the race guard. The mirror takes every one as a
// CONTROLLED prop and exports the session transitions as pure helpers so
// the host reproduces Vue's behaviour:
//
//   [`user_picker_cap_results`]      Vue's `slice(0, maxResults)` at write
//   [`UserPickerRowsState`]          the `data-state` ladder (loading →
//                                    failed → empty → ready)
//   [`user_picker_note`]             which standing note renders (and
//                                    empty-with-query vs the empty hint)
//   [`user_picker_should_search`]    THE empty-query contract: false on a
//                                    blank query — the host must not ask
//                                    its backend for candidates then
//   [`user_picker_enter_index`]      Enter's row (the cursor, else the
//                                    first row, else nothing)
//   [`user_picker_toggle_draft`]     the multi-mode working-copy toggle
//   [`user_picker_pick_value`]       what a row pick means per mode
//   [`user_picker_remove_uid`]       the tag ×'s value edit
//
// The events are the session's edges: `on_open` (the field was activated —
// the host opens the panel and re-seeds the session: blank query, empty
// results, draft = value; NO initial search fires — the opening state IS
// the empty hint), `on_query_change` (the box text moved — the host
// debounces, consults [`user_picker_should_search`], and searches; a
// rejection renders the retry hint, never a throw), `on_pick` (a row —
// also Enter's commit), `on_confirm` (multi OK — the host commits the
// draft), `on_cancel` (the surface asked to close: ✕ / scrim / grabber /
// Cancel / Escape / single pick) and `on_remove` (a tag ×).
//
// Deltas vs Vue (documented, not accidental):
//   * NO TRANSPORT AND NO ASYNC: Vue's required `search` callback (a
//     Promise) becomes the host's `on_query_change` handler feeding
//     `results`/`loading`/`failed` back in — the component carries zero
//     transport either way, and the race guard belongs to the caller
//     that owns the async.
//   * THE DEBOUNCE IS INERT, like the mirrored SearchInput's `debounce`
//     prop (250 is still passed for fidelity): the host owns the timing.
//   * Results are capped AT RENDER here (Vue caps at write); the output is
//     identical because [`user_picker_cap_results`] is the same slice.
//   * NO aria-activedescendant on the search box: the mirrored SearchInput's
//     prop set is fixed (no aria passthrough), so the live-cursor Announce
//     rides the listbox's own label instead. The rows keep
//     `role="option"` / `aria-selected` / `data-checked`.
//   * NO TELEPORT, no popup-manager z band, no outside-click listener, no
//     viewport clamp/auto-flip, no transitions — the same surface deltas the
//     `overlay::select_panel` mirror documents. The host owns outside
//     dismissal ([`select_panel_outside_click_closes`] is the predicate) and
//     re-evaluates the branch on resize.
//   * Geometry comes from the select family, never re-derived:
//     [`select_panel_popout_style`] places the popout (with a measured
//     anchor rect it IS Vue's `positionPanel`; without one it pins to the
//     picker root's `position:relative` box), [`select_panel_cap_style`]
//     lands the max-height hook, [`select_panel_branch`] decides the form
//     factor and [`step_highlight`] walks the keyboard cursor.
//   * The × glyph and the row check are TEXT ("×" / "✓") exactly like
//     Vue's — no SVG involved.
//
// I18N: every string rides `hikari_i18n::t` under
// `components.hk.userPicker.*` — the English literals are the canonical
// ones from the Vue app dictionary (`hikari::userPicker.*` in
// `packages/vue/src/i18n/locales/en/components.json`), re-keyed to the
// crate's component namespace (the same mapping `layout/affix_picker.rs`
// applies; Vue shares its Cancel with `hikari::messageBox.cancel` — the
// mirror gives it this component's own key). Keys: title, add, remove,
// confirm, cancel, searchPlaceholder, searching, searchFailed, empty,
// emptyInitial, selectedCount.

// These kernels are line-for-line ports of the upstream JS math: the negated
// comparisons, manual clamps and inline tuple types keep the port auditable
// against the source, so the idiomatic-rewrite lints are off here.
#![allow(clippy::neg_cmp_op_on_partial_ord)]
#![allow(clippy::collapsible_if)]
#![allow(clippy::type_complexity)]
#![allow(clippy::too_many_arguments)]
use hikari_i18n::t;
use hikari_icons::{Icon, IconProps, MdiIcon};

use crate::basic::button::{Button, ButtonProps, ButtonSize, ButtonVariant};
use crate::basic::search_input::{SearchInput, SearchInputProps};
use crate::basic::select::{SelectAnchorRect, SelectPanelPlacement, step_highlight};
use crate::basic::{IconButton, IconButtonSize, IconButtonVariant};
use crate::overlay::select_panel::{
    SelectPanelBranch, SelectPanelKeyAction, select_panel_branch, select_panel_cap_style,
    select_panel_key_action, select_panel_popout_style,
};
use crate::platform;
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
    /// Row kind (Vue's `kind`): `Group` marks a user-group row — a batch
    /// grant, not a person. The row wears the group glyph and
    /// `data-kind="group"`; identity stays `uid`. Default `User`.
    pub kind: UserOptionKind,
}

/// The option's kind (Vue: `kind`, default `"user"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum UserOptionKind {
    #[default]
    User,
    Group,
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
    let display = user.display_name.as_deref().map(str::trim);
    display
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| user.username.clone())
}

/// The tag's `title` tooltip: the primary label with the email joined after
/// it (Vue's `[tagTitle(user), user.email].filter(Boolean).join(' ')`).
pub fn user_picker_tag_title_attr(user: &HkUserOption) -> String {
    let mut parts = vec![user_picker_tag_title(user)];
    if let Some(email) = &user.email {
        parts.push(email.clone());
    }
    parts.join(" ")
}

/// The add hint (Vue's ternary): the placeholder while the selection is
/// empty, the i18n "add" line once tags exist — never nothing.
pub fn user_picker_add_text(is_empty: bool, placeholder: Option<&str>) -> String {
    if is_empty {
        placeholder
            .map(str::to_string)
            .unwrap_or_else(|| t("components.hk.userPicker.add", "Select users…"))
    } else {
        t("components.hk.userPicker.add", "Select users…")
    }
}

/// The render-time answer cap (Vue caps at write: `slice(0, maxResults)`).
pub fn user_picker_cap_results(results: &[HkUserOption], max_results: usize) -> Vec<HkUserOption> {
    results.iter().take(max_results).cloned().collect()
}

/// THE EMPTY-QUERY CONTRACT (2026-11-17): a blank query asks for nothing —
/// the host must not run a search (and the panel shows the standing hint,
/// never candidates). Vue encodes the same guard before calling its
/// `search` callback.
pub fn user_picker_should_search(query: &str) -> bool {
    !query.trim().is_empty()
}

/// The rows band's state ladder (Vue: `rowsState`), published as
/// `data-state` so hosts and tests key on the state without reading note
/// text.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum UserPickerRowsState {
    Loading,
    Failed,
    Empty,
    Ready,
}

impl UserPickerRowsState {
    pub fn as_str(self) -> &'static str {
        match self {
            UserPickerRowsState::Loading => "loading",
            UserPickerRowsState::Failed => "failed",
            UserPickerRowsState::Empty => "empty",
            UserPickerRowsState::Ready => "ready",
        }
    }
}

/// Vue's `rowsState` computed as one pick: loading wins, then failed, then
/// emptiness, then ready.
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

/// Which standing line the rows band carries while it shows no rows.
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

/// Vue's note guards, collapsed into one pick. A blank query resolves to
/// the EmptyInitial hint (the panel's opening state — never candidates);
/// a non-blank query with no answers resolves to the no-match line.
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

/// The multi-mode working-copy toggle (Vue's `toggleDraft`): a copy first —
/// the draft is committed only on Confirm, never mutated in place.
pub fn user_picker_toggle_draft(draft: &[HkUserOption], user: &HkUserOption) -> Vec<HkUserOption> {
    if user_picker_in_draft(draft, &user.uid) {
        draft
            .iter()
            .filter(|entry| entry.uid != user.uid)
            .cloned()
            .collect()
    } else {
        let mut next = draft.to_vec();
        next.push(user.clone());
        next
    }
}

/// What a row pick means per mode (Vue's `pickValue`): `single` replaces
/// the whole selection; `multi` writes the draft.
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

/// The tag ×'s value edit: drop `uid`, keep the order.
pub fn user_picker_remove_uid(value: &[HkUserOption], uid: &str) -> Vec<HkUserOption> {
    value
        .iter()
        .filter(|user| user.uid != uid)
        .cloned()
        .collect()
}

/// The row's classes (Vue: `class={{ 'hk-user-picker-row': true, 'is-selected': selected }}`).
pub fn user_picker_row_classes(mode: UserPickerMode, in_draft: bool) -> String {
    if mode == UserPickerMode::Multi && in_draft {
        String::from("hk-user-picker-row is-selected")
    } else {
        String::from("hk-user-picker-row")
    }
}

/// Enter's commit row (Vue: "有光标取光标，无盲光标取首行"): the cursor when
/// it sits on a live row, the FIRST row when no cursor was ever moved, and
/// nothing on an empty candidate list.
pub fn user_picker_enter_index(highlighted: i32, count: usize) -> Option<usize> {
    if count == 0 {
        return None;
    }
    if highlighted >= 0 && (highlighted as usize) < count {
        Some(highlighted as usize)
    } else {
        Some(0)
    }
}

/// The multi Confirm's dead face: an empty draft cannot commit (single has
/// no footer at all, so the flag is meaningless there — `false`).
pub fn user_picker_confirm_disabled(mode: UserPickerMode, draft_count: usize) -> bool {
    mode == UserPickerMode::Multi && draft_count == 0
}

/// The draft counter's text (Vue: `"{count} selected"`).
pub fn user_picker_count_text(count: usize) -> String {
    t("components.hk.userPicker.selectedCount", "{count} selected")
        .replace("{count}", &count.to_string())
}

/// Whether the counter renders (multi, draft > 0).
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

    /// Field label; also the panel's title / the rows' accessible name
    /// (Vue: `label ?? t(title)`).
    pub label: Option<String>,

    /// The add hint while nothing is selected (falls back to the i18n
    /// default).
    pub placeholder: Option<String>,

    /// A dead field: dimmed, the tags lose their ×, clicks never open.
    pub disabled: bool,

    /// Rows rendered per query (Vue: `maxResults`, default 50).
    #[default(50)]
    pub max_results: usize,

    /// The standing hint while the query is empty (Vue: `emptyHint`).
    /// Defaults to the i18n bundle's `emptyInitial` line.
    pub empty_hint: Option<String>,

    /// Surface visibility (Vue's `open` ref).
    pub open: bool,

    /// The live query (Vue's `query` ref — re-seeded empty on every open;
    /// the panel shows NO candidates until this names someone).
    pub query: String,

    /// The current search answer (already host-debounced). The component
    /// renders the answer verbatim — it never fills the panel itself.
    #[default]
    pub results: Vec<HkUserOption>,

    /// A search is in flight.
    pub loading: bool,

    /// The last search rejected — render the retry hint, never a throw.
    pub failed: bool,

    /// The multi-mode working copy, committed only on Confirm.
    #[default]
    pub draft: Vec<HkUserOption>,

    /// Keyboard/pointer cursor over the candidates (`-1` = none). Enter
    /// commits this row, else the first ([`user_picker_enter_index`]).
    #[default(-1)]
    pub highlighted_index: i32,

    /// The measured field rect to anchor the popout against (Vue:
    /// `anchorRef`). Without one the surface pins to the picker root's
    /// `position: relative` box, one `offset` below the field.
    pub anchor: Option<SelectAnchorRect>,

    /// Dock as the bottom sheet on phone-width viewports (Vue default
    /// true).
    #[default(true)]
    pub sheet_on_mobile: bool,

    /// The born form factor (Vue's `activeBranch`): `None` resolves from
    /// the live viewport per render; a host that wants the shape pinned
    /// across a resize passes it explicitly.
    pub active_branch: Option<SelectPanelBranch>,

    /// Desktop-popout placement (Vue default `"bottom-start"`).
    #[default]
    pub placement: SelectPanelPlacement,

    /// Gap between the field and the popout, in px (Vue default 4).
    #[default(4.0)]
    pub offset: f64,

    /// Cap for the scrolling surface (Vue: `maxHeight`, default
    /// `min(22rem, 50dvh)`).
    pub max_height: Option<String>,

    /// The field was activated (click / Enter / Space): the host opens the
    /// panel and re-seeds the session (blank query, empty results, draft =
    /// value). NO search fires — the opening state is the empty hint, and
    /// [`user_picker_should_search`] keeps the first keystroke from being
    /// treated as one either.
    pub on_open: Option<EventHandler<()>>,

    /// The query box text moved (Vue: `update:modelValue` — the host
    /// debounces, consults [`user_picker_should_search`], and searches).
    /// The retry button re-fires this edge with the CURRENT query (the
    /// historic failed/retry semantics).
    pub on_query_change: Option<EventHandler<String>>,

    /// A result row was picked — see [`user_picker_pick_value`] for what
    /// it means per mode. Enter commits the cursor's row through this same
    /// edge.
    pub on_pick: Option<EventHandler<HkUserOption>>,

    /// Multi-mode Confirm: the host commits the draft to the value.
    pub on_confirm: Option<EventHandler<()>>,

    /// The surface asked to close (✕ / scrim / grabber / Cancel / Escape /
    /// single pick).
    pub on_cancel: Option<EventHandler<()>>,

    /// A tag × was pressed; carries the uid (the host edits the value —
    /// no surface involved).
    pub on_remove: Option<EventHandler<String>>,

    /// Fires with the desired cursor index (↑/↓ stepping).
    pub on_highlight_change: Option<EventHandler<i32>>,
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
                    // The × must not open the surface beneath it.
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

    let panel_title = props
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
        .attr("aria-label", panel_title.clone());

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

    let mut root = VElement::new("div")
        .class(root_classes)
        // The unmeasured popout arm pins to this box (the header_picker
        // precedent); `position:relative` keeps the block layout intact.
        .attr("style", "position:relative");
    if let Some(label) = &props.label {
        root = root.child(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-user-picker-label")
                .child(VNode::Text(VText::new(label.as_str()))),
        )));
    }
    root = root.child(VNode::Element(Box::new(field)));

    // ── the surface ────────────────────────────────────────────────────
    let results = user_picker_cap_results(&props.results, props.max_results);
    let rows_state = user_picker_row_state(props.loading, props.failed, results.len());
    let note = user_picker_note(props.loading, props.failed, results.len(), &props.query);
    let empty_hint = props
        .empty_hint
        .clone()
        .unwrap_or_else(|| UserPickerNote::EmptyInitial.text());

    // The query box: the panel's top lane. Enter does NOT search (Vue's
    // Enter now commits the cursor's row — the panel keydown owns it), so
    // the mirrored SearchInput's `onsearch` stays unwired.
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
        ..Default::default()
    });

    // The rows band: the standing lines first (a failed search IS a button —
    // clicking it re-runs the same query through the query-change edge), the
    // candidate rows after.
    let mut rows = VElement::new("div")
        .class("hk-user-picker-rows")
        .attr("role", "listbox")
        .attr("aria-label", panel_title.clone())
        .attr("data-state", rows_state.as_str());
    if props.mode == UserPickerMode::Multi {
        rows = rows.attr("aria-multiselectable", "true");
    }
    if let Some(note) = note {
        rows = if note == UserPickerNote::Failed {
            // The retry affordance IS the note (Vue's `hk-user-picker-retry`).
            let on_query = props.on_query_change.clone();
            let query = props.query.clone();
            let mut retry = VElement::new("button")
                .class("hk-user-picker-retry")
                .attr("type", "button")
                .child(VNode::Text(VText::new(&note.text())));
            retry = retry.on_click(move |_event: MouseEvent| {
                if let Some(handler) = on_query.as_ref() {
                    handler.call(query.clone());
                }
            });
            rows.child(VNode::Element(Box::new(retry)))
        } else {
            let text = if note == UserPickerNote::EmptyInitial {
                empty_hint.clone()
            } else {
                note.text()
            };
            rows.child(VNode::Element(Box::new(
                VElement::new("p")
                    .class("hk-user-picker-note")
                    .child(VNode::Text(VText::new(&text))),
            )))
        };
    }
    for (index, user) in results.iter().enumerate() {
        let in_draft =
            props.mode == UserPickerMode::Multi && user_picker_in_draft(&props.draft, &user.uid);
        let is_group = user.kind == UserOptionKind::Group;
        let mut row = VElement::new("div")
            .class(user_picker_row_classes(props.mode, in_draft))
            .attr("role", "option")
            .attr("tabindex", "-1")
            .attr("aria-selected", if in_draft { "true" } else { "false" })
            .attr("data-user-index", index.to_string());
        // Grammar face attribute (_menu-item.scss): mi.item's checked face
        // keys on data-checked — presence-only, multi-draft only.
        if in_draft {
            row = row.attr("data-checked", "true");
        }
        if is_group {
            row = row.attr("data-kind", "group");
            // The group-kind glyph (Vue's leading `UsersRound`): one quiet
            // glyph that says "this row grants a batch", before the name.
            // Delta vs Vue (documented, the toast.rs precedent): the packed
            // MDI `account-group` twin stands in for the lucide glyph and
            // carries no text of its own, so Vue's `aria-hidden` has no
            // mirrored attribute — the row keeps Vue's `data-kind="group"`.
            row = row.child(Icon(IconProps {
                icon: MdiIcon::AccountGroup,
                size: 14,
                class: "hk-user-picker-row-kind".to_string(),
                ..Default::default()
            }));
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

    // The panel body: search lane + rows band + the multi footer.
    let mut panel = VElement::new("div").class("hk-user-picker-panel");
    panel = panel.child(VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-user-picker-search")
            .attr("role", "search")
            .child(search),
    )));
    panel = panel.child(VNode::Element(Box::new(rows)));
    if props.mode == UserPickerMode::Multi {
        let mut footer = VElement::new("div").class("hk-user-picker-footer");
        if user_picker_count_visible(props.mode, props.draft.len()) {
            footer = footer.child(VNode::Element(Box::new(
                VElement::new("p")
                    .class("hk-user-picker-count")
                    .child(VNode::Text(VText::new(&user_picker_count_text(
                        props.draft.len(),
                    )))),
            )));
        }
        let mut actions = VElement::new("div").class("hk-user-picker-actions");
        actions = actions.child(Button(ButtonProps {
            variant: ButtonVariant::Secondary,
            size: ButtonSize::Sm,
            label: Some(t("components.hk.userPicker.cancel", "Cancel")),
            class: "hk-user-picker-cancel".to_string(),
            onclick: props
                .on_cancel
                .clone()
                .map(|handler| event_handler(move |_: MouseEvent| handler.call(()))),
            ..Default::default()
        }));
        actions = actions.child(Button(ButtonProps {
            variant: ButtonVariant::Primary,
            size: ButtonSize::Sm,
            label: Some(t("components.hk.userPicker.confirm", "Confirm")),
            class: "hk-user-picker-confirm".to_string(),
            disabled: user_picker_confirm_disabled(props.mode, props.draft.len()),
            onclick: props
                .on_confirm
                .clone()
                .map(|handler| event_handler(move |_: MouseEvent| handler.call(()))),
            ..Default::default()
        }));
        footer = footer.child(VNode::Element(Box::new(actions)));
        panel = panel.child(VNode::Element(Box::new(footer)));
    }

    // The panel keydown (Vue's `onPanelKeydown`, reached through the
    // surface's forwarded keydown): ↑/↓ step the cursor, Enter commits it
    // (or the first row), Escape closes AND consumes the key. All edges are
    // the session's own writers — nothing is stored.
    let pick_wiring = props.on_pick.clone();
    let highlight_wiring = props.on_highlight_change.clone();
    let cancel_wiring = props.on_cancel.clone();
    let key_results = results.clone();
    let key_highlight = props.highlighted_index;
    let panel_keydown =
        move |event: KeyboardEvent| match select_panel_key_action(event.key.as_str()) {
            SelectPanelKeyAction::Step(delta) => {
                event.prevent_default();
                if let Some(handler) = highlight_wiring.as_ref() {
                    handler.call(step_highlight(key_highlight, key_results.len(), delta));
                }
            }
            SelectPanelKeyAction::Commit => {
                event.prevent_default();
                if let Some(index) = user_picker_enter_index(key_highlight, key_results.len())
                    && let Some(user) = key_results.get(index)
                    && let Some(handler) = pick_wiring.as_ref()
                {
                    handler.call(user.clone());
                }
            }
            SelectPanelKeyAction::CloseAndConsume => {
                event.prevent_default();
                event.stop_propagation();
                if let Some(handler) = cancel_wiring.as_ref() {
                    handler.call(());
                }
            }
            SelectPanelKeyAction::Forward => {}
        };

    // The surface: ONLY while open (Vue mounts it on the opening edge).
    let open = props.open;
    let branch = props
        .active_branch
        .unwrap_or_else(|| select_panel_branch(props.sheet_on_mobile, platform::inner_width()));
    let aria_label = Some(panel_title.clone()).filter(|title| !title.is_empty());
    let cap_style = select_panel_cap_style(
        Some(
            props
                .max_height
                .clone()
                .unwrap_or_else(|| "min(22rem, 50dvh)".to_string()),
        )
        .as_deref(),
    );
    let panel_node = VNode::Element(Box::new(panel));

    let layer: Option<VNode> = if open {
        match branch {
            SelectPanelBranch::Sheet => {
                let close_label = t("components.hk.modal.close", "Close");
                let title = panel_title.clone();
                let scrim_cancel = props.on_cancel.clone();
                let grabber_cancel = props.on_cancel.clone();
                let close_cancel = props.on_cancel.clone();
                Some(rsx! {
                    div {
                        class: "hk-select-sheet-scrim",
                        onclick: move |_event: MouseEvent| {
                            if let Some(handler) = scrim_cancel.as_ref() {
                                handler.call(());
                            }
                        },
                    }
                    div {
                        class: "hk-select-sheet-panel",
                        "role": "dialog",
                        "aria-modal": "true",
                        "aria-label": aria_label,
                        "tabindex": -1,
                        onkeydown: panel_keydown,
                        div {
                            class: "hk-select-sheet-grabber",
                            "aria-hidden": "true",
                            onclick: move |_event: MouseEvent| {
                                if let Some(handler) = grabber_cancel.as_ref() {
                                    handler.call(());
                                }
                            },
                        }
                        div {
                            class: "hk-select-sheet-header",
                            if !title.is_empty() {
                                div { class: "hk-select-sheet-title", {title} }
                            }
                            IconButton {
                                size: IconButtonSize::S32,
                                variant: IconButtonVariant::Ghost,
                                icon: Some(MdiIcon::Close),
                                aria_label: Some(close_label),
                                class: "hk-window-close hk-select-sheet-close".to_string(),
                                onclick: Some(event_handler(move |_: MouseEvent| {
                                    if let Some(handler) = close_cancel.as_ref() {
                                        handler.call(());
                                    }
                                })),
                            }
                        }
                        div {
                            class: "hk-select-sheet-body",
                            div {
                                class: "hk-select-sheet-list",
                                style: cap_style.clone(),
                                div { class: "hk-select-sheet-content",
                                    {panel_node}
                                }
                            }
                        }
                    }
                })
            }
            SelectPanelBranch::Popout => {
                let (side, align) = props.placement.side_align();
                let geometry = select_panel_popout_style(
                    props.placement,
                    props.anchor,
                    props.offset,
                    // Vue: `matchAnchorWidth` defaults true on HkSelectPanel
                    // and the picker passes nothing — the panel hugs the
                    // field's width.
                    true,
                );
                Some(rsx! {
                    div {
                        class: "hk-select-popout-host",
                        "data-side": side.token(),
                        "data-align": align.token(),
                        style: geometry,
                        div {
                            class: "hk-select-popout",
                            "aria-label": aria_label,
                            style: cap_style.clone(),
                            onkeydown: panel_keydown,
                            {panel_node}
                        }
                    }
                })
            }
        }
    } else {
        None
    };

    VNode::Fragment(vec![
        VNode::Element(Box::new(root)),
        layer.unwrap_or_else(empty_vnode),
    ])
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
            kind: UserOptionKind::User,
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
        assert!(props.empty_hint.is_none());
        assert!(!props.open);
        assert_eq!(props.query, "");
        assert!(props.results.is_empty());
        assert!(!props.loading);
        assert!(!props.failed);
        assert!(props.draft.is_empty());
        assert_eq!(props.highlighted_index, -1);
        assert!(props.anchor.is_none());
        assert!(props.sheet_on_mobile);
        assert!(props.active_branch.is_none());
        assert_eq!(props.placement, SelectPanelPlacement::BottomStart);
        assert_eq!(props.offset, 4.0);
        assert!(props.max_height.is_none());
        assert!(props.on_open.is_none());
        assert!(props.on_query_change.is_none());
        assert!(props.on_pick.is_none());
        assert!(props.on_confirm.is_none());
        assert!(props.on_cancel.is_none());
        assert!(props.on_remove.is_none());
        assert!(props.on_highlight_change.is_none());

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
            "a blank query is the standing hint, never candidates"
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
    fn the_empty_query_contract_never_asks_for_a_blank_query() {
        // THE hard line (2026-11-17): blank input is "no request, no
        // candidates" — every blank spelling, and nothing else.
        assert!(!user_picker_should_search(""));
        assert!(!user_picker_should_search(" "));
        assert!(!user_picker_should_search("  \t "));
        assert!(user_picker_should_search("a"));
        assert!(user_picker_should_search(" ada "));
    }

    #[test]
    fn enter_picks_the_cursor_else_the_first_row() {
        let three = 3;
        assert_eq!(
            user_picker_enter_index(-1, three),
            Some(0),
            "no cursor yet → first row"
        );
        assert_eq!(user_picker_enter_index(0, three), Some(0));
        assert_eq!(user_picker_enter_index(2, three), Some(2));
        assert_eq!(
            user_picker_enter_index(5, three),
            Some(0),
            "an out-of-range cursor is no cursor"
        );
        assert_eq!(
            user_picker_enter_index(-1, 0),
            None,
            "an empty list commits nothing"
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

        // The tag × removes directly, no surface involved.
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
        // Closed → NO surface at all (not even a hidden one).
        assert!(!html.contains("hk-select-popout-host"), "{html}");
        assert!(!html.contains("hk-select-sheet-panel"), "{html}");
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
    fn user_picker_surface_is_the_select_popout_carrying_the_panel() {
        // Desktop (the stub viewport is 1024) with a measured anchor: the
        // surface IS the select family's popout, geometry inline, and the
        // content is the picker's own panel div.
        let html = UserPicker(UserPickerProps {
            open: true,
            anchor: Some(SelectAnchorRect {
                x: 12.0,
                y: 34.0,
                width: 320.0,
                height: 40.0,
            }),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"class="hk-select-popout-host""#,
            r#"class="hk-select-popout""#,
            r#"aria-label="Select users""#,
            // The anchored geometry IS Vue's positionPanel output: the
            // field rect + the 4px offset, width tied to the anchor.
            "left:12px",
            "top:78px",
            "min-width:320px",
            // The panel body and its two lanes.
            r#"class="hk-user-picker-panel""#,
            r#"class="hk-user-picker-search""#,
            r#"role="search""#,
            "hk-search-input",
            r#"placeholder="Nickname, username or email""#,
            r#"class="hk-user-picker-rows""#,
            r#"role="listbox""#,
            r#"data-state="empty""#,
            // The OPENING state is the hint — never candidates, never a
            // request (the empty-query contract's visible face).
            "Type a nickname, username or email to search.",
            // The retired modal dialog stays retired.
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("hk-user-picker-dialog"), "{html}");
        assert!(!html.contains("hk-modal"), "{html}");
    }

    #[test]
    fn user_picker_rows_render_as_options_with_the_checked_face() {
        let html = UserPicker(UserPickerProps {
            open: true,
            mode: UserPickerMode::Multi,
            query: "ad".to_string(),
            results: vec![
                user("1", "ada", Some("Ada Lovelace"), Some("ada@x.dev")),
                user("2", "bob", None, None),
            ],
            draft: vec![user("1", "ada", Some("Ada Lovelace"), None)],
            active_branch: Some(SelectPanelBranch::Popout),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            r#"role="option""#,
            r#"aria-selected="true""#,
            r#"aria-selected="false""#,
            r#"class="hk-user-picker-row is-selected""#,
            r#"data-checked="true""#,
            r#"class="hk-user-picker-row-main""#,
            r#"class="hk-user-picker-row-name""#,
            r#"class="hk-user-picker-row-email""#,
            r#"class="hk-user-picker-row-check""#,
            "✓",
            r#"class="hk-user-picker-footer""#,
            r#"class="hk-user-picker-count""#,
            "1 selected",
            // The footer buttons ride the shared Button family (the class
            // prop merges AFTER the hk-btn* family).
            "hk-btn hk-btn-secondary hk-btn-sm hk-user-picker-cancel",
            "hk-btn hk-btn-primary hk-btn-sm hk-user-picker-confirm",
            ">Cancel</span>",
            ">Confirm</span>",
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
        // The empty draft's Confirm is dead.
        let html = UserPicker(UserPickerProps {
            open: true,
            mode: UserPickerMode::Multi,
            query: "ad".to_string(),
            results: vec![user("1", "ada", None, None)],
            active_branch: Some(SelectPanelBranch::Popout),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-user-picker-confirm"), "{html}");
        assert!(
            html.contains("disabled=\"disabled\""),
            "the empty draft's Confirm is dead: {html}"
        );
        assert!(!html.contains("hk-user-picker-count"), "{html}");
    }

    #[test]
    fn user_picker_surface_renders_the_standing_notes_and_the_sheet_branch() {
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
        // The retry affordance IS the note — a button, not a line.
        assert!(
            failed.contains(r#"class="hk-user-picker-retry""#),
            "{failed}"
        );
        assert!(failed.contains("The search failed; try again."), "{failed}");

        // A custom hint overrides the i18n opening line (Vue: `emptyHint`).
        let hinted = UserPicker(UserPickerProps {
            open: true,
            empty_hint: Some("Search the directory".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(hinted.contains("Search the directory"), "{hinted}");

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

        // Single mode has no footer at all.
        let single = UserPicker(UserPickerProps {
            open: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(!single.contains("hk-user-picker-footer"), "{single}");
        assert!(!single.contains("hk-user-picker-cancel"), "{single}");
        assert!(!single.contains("hk-user-picker-confirm"), "{single}");

        // The sheet branch: the shared sheet frame, the ✕, the panel inside
        // the list band.
        let sheet = UserPicker(UserPickerProps {
            open: true,
            mode: UserPickerMode::Multi,
            label: Some("Owners".to_string()),
            active_branch: Some(SelectPanelBranch::Sheet),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="hk-select-sheet-scrim""#,
            r#"class="hk-select-sheet-panel""#,
            r#"role="dialog""#,
            r#"aria-modal="true""#,
            r#"class="hk-select-sheet-grabber""#,
            r#"class="hk-select-sheet-title""#,
            "Owners",
            "hk-select-sheet-close",
            r#"class="hk-select-sheet-body""#,
            r#"class="hk-select-sheet-content""#,
            r#"class="hk-user-picker-panel""#,
            r#"aria-label="Close""#,
        ] {
            assert!(sheet.contains(needle), "missing {needle}: {sheet}");
        }
        // The popout is absent in the sheet branch.
        assert!(!sheet.contains("hk-select-popout-host"), "{sheet}");
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
            ".hk-user-picker-panel",
            ".hk-user-picker-search",
            ".hk-user-picker-retry",
            ".hk-user-picker-footer",
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

    #[test]
    fn user_picker_group_kind_rows_render_the_glyph_and_data_kind() {
        // (2026-11-18 third pass) A kind=Group option renders the group
        // glyph before the name and `data-kind="group"` on the row; a
        // plain user row carries neither.
        let team = HkUserOption {
            uid: "g-1".into(),
            username: String::new(),
            display_name: Some("Design team".into()),
            kind: UserOptionKind::Group,
            ..Default::default()
        };
        let alice = HkUserOption::new("u-1", "alice");

        let element = UserPicker(UserPickerProps {
            open: true,
            results: vec![team, alice],
            query: "a".into(),
            ..Default::default()
        });
        let html = element.render_to_html();

        assert!(
            html.contains(r#"data-kind="group""#),
            "the group row must wear data-kind=group: {html}"
        );
        assert!(
            html.contains("hk-user-picker-row-kind"),
            "the group row must carry the group glyph class: {html}"
        );
        // The packed account-group path renders (not the build script's
        // help-circle fallback — get("account-group") must resolve).
        assert!(
            html.contains("M12,5.5A3.5,3.5"),
            "the glyph must be the packed account-group path, not the fallback: {html}"
        );
        assert!(
            !html.contains("M12 2C6.48 2 2 6.48"),
            "the icon fallback must not render for a packed name: {html}"
        );
        // Exactly one kind row: the user row stays plain.
        assert_eq!(
            html.matches(r#"data-kind="group""#).count(),
            1,
            "only the group-kind row wears the marker"
        );
    }

    #[test]
    fn user_picker_kind_defaults_to_user() {
        // Default::default() is a plain user row — every existing host
        // keeps rendering exactly what it rendered before the kind field.
        let plain = HkUserOption::default();
        assert_eq!(plain.kind, UserOptionKind::User);
        let bare = HkUserOption::new("u-1", "ada");
        assert_eq!(bare.kind, UserOptionKind::User);
    }
}
