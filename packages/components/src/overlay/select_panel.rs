// hi-components/src/overlay/select_panel.rs
// SelectPanel — mirror of the canonical Vue `HkSelectPanel`: the dropdown
// SURFACE a select opens (desktop popout + mobile bottom sheet), detached from
// the select's trigger so custom surfaces can look like a dropdown panel
// without being one (`HkSelect` itself delegates here).
//
// ── HkSelectSheet: NOT a file of its own (verified against the Vue tree) ──
// The Vue library ships NO `HkSelectSheet.tsx` (there is no
// `packages/vue/src/components/HkSelectSheet.*` source); the only file with
// that name is `HkSelectSheet.test.tsx`, which mounts `HkSelect` and asserts
// the SHEET ARM of this very panel (`sheetOnMobile` + `useBreakpoint`). Its
// expected DOM — scrim, `role="dialog"` panel, grabber, heading with the
// shared ✕ icon-button, list band — is the `hk-select-sheet-*` block rendered
// below. A separate `select_sheet.rs` would therefore have mirrored no Vue
// component and would have re-declared this arm's markup, so the arm is
// folded here and `select_sheet.rs` is deliberately absent.
//
// THE SHEET OWNERSHIP (verified, `styles()` returns `""` for that reason):
// `HkSelectPanel.tsx` imports `./HkSelect.scss` and no sheet of its own, and
// no `HkSelectPanel.scss` exists in the Vue tree. The canvas is the ALREADY
// VENDORED `src/styles/vue-mirror/components/HkSelect.scss` — the popout host
// (`.hk-select-popout-host` / `.hk-select-popout`), the sheet
// (`.hk-select-sheet-scrim` / `-panel` / `-grabber` / `-header` / `-title` /
// `-close` / `-body` / `-list`) and the shared row (`.hk-select-option`) all
// live there — the sheet's `-content` wrapper is a DOM hook no rule paints —
// and that sheet is already compiled
// into the registry bundle by the W2a `basic/select.rs` mirror. The ✕ keeps
// its chrome from the registry chrome (`register_vue_chrome`:
// `.hk-window-close`, `.hk-icon-button*`). 本组件不新增表 — this component
// adds no stylesheet; a second `scss!` of HkSelect.scss would emit the same
// rules twice (the drift suite forbids that).
//
// GEOMETRY AND STEPPING ARE NOT RE-DERIVED. Per the wave's rule, the desktop
// geometry and the highlight cursor come from the W2a mirror:
//   * [`select_panel_popout_style`] delegates to `basic::select::
//     select_popout_style` (it adds only the "host never measured its trigger"
//     rule — Vue's `positionPanel` returns early without `anchorRef`), so the
//     panel can never drift from the HkSelect field's popout;
//   * the keyboard path steps with `basic::select::step_highlight` (the same
//     wrap-around `(i + delta).rem_euclid(len)` Vue uses), and the row model
//     reuses `basic::select::SelectOption` instead of introducing a second
//     option shape.
// What THIS file owns on top of them is the panel contract: the form-factor
// branch, the `--hk-select-panel-max-height` hook, the Escape/outside-click
// semantics and the row/`data-*` mapping.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   ── desktop popout branch (Vue: `activeBranch === "popout"`) ──
//   div.hk-select-popout-host [host class]
//       data-side={top|bottom} data-align={start|center|end}
//       (style: inline anchor geometry — no Teleport, no popup-manager band)
//     div.hk-select-popout
//         aria-label?              (Vue: `title || undefined`)
//         (style: --hk-select-panel-max-height hook)
//       div.hk-select-option       (one per option; only while open)
//           data-highlighted data-select-index data-checked data-disabled
//         span {label}
//   ── mobile sheet branch (Vue: `activeBranch === "sheet"`) ──
//   div.hk-select-sheet-scrim                       (click closes)
//   div.hk-select-sheet-panel [host class] role=dialog aria-modal=true
//       aria-label? tabindex=-1                     (keydown: the panel keys)
//     div.hk-select-sheet-grabber aria-hidden=true  (click closes)
//     div.hk-select-sheet-header
//       div.hk-select-sheet-title {title}?          (only when titled)
//       button.hk-icon-button.hk-icon-button-32.hk-icon-button-ghost
//              .hk-window-close.hk-select-sheet-close
//           aria-label  (the shared modal "Close" label)
//         span.hk-icon-button-icon > the ✕ glyph
//     div.hk-select-sheet-body
//       div.hk-select-sheet-list                    (the cap hook lands HERE)
//         div.hk-select-sheet-content > the option rows above
//
// Vue prop mapping: `open` → [`SelectPanelProps::open`] (CONTROLLED),
// `anchorRef` → [`SelectPanelProps::anchor`] (the measured rect — Vue takes a
// DOM node, the crate's anchored surfaces all take
// `feedback::popover::PopoverAnchorRect`), `title`, `placement` →
// [`SelectPanelPlacement`] (Vue default `"bottom-start"`), `offset` (4),
// `matchAnchorWidth` (true), `maxHeight` → `max_height`, `sheetOnMobile`
// (true). Emits: `update:open` → `on_open_change`, `keydown` → nothing (the
// mirror owns the option navigation, see below).
//
// Controlled state: Vue keeps `open`'s writer in the parent, `highlightedIndex`
// and `activeBranch` in LOCAL refs, plus a surface machine, a back guard and
// several `nextTick` DOM passes. tairitsu 0.5.22 has no per-instance component
// state (`use_signal` allocates a fresh signal per render, `use_state` shares
// ONE slot per component type), so all three become props:
// `open` / `highlighted_index` / `active_branch`, each with an
// `on_*_change` writer. Nothing is stored in the component.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * NO `<Teleport>`, no overlay root, no popup-manager z band: the surface
//     renders IN PLACE, so the host's stacking context decides the paint
//     order (Vue reads its z from `usePopupManager`).
//   * NO OUTSIDE-CLICK LISTENER: Vue installs a capture-phase `document`
//     `click` watcher while the popout is open. The document contract has no
//     tairitsu analogue in this wave, so the HOST owns outside dismissal —
//     [`select_panel_outside_click_closes`] is the same predicate Vue's
//     handler applies (open + popout branch + outside anchor + outside the
//     panel host), exposed as a pure function instead of a listener.
//   * NO AUTO-FLIP AND NO VIEWPORT CLAMP: both read the MEASURED panel box
//     (`offsetWidth`/`offsetHeight`, `popupViewportRect`, `clampWithGutter`)
//     and this wave has no ref + measurement pairing. The placed side/align is
//     used verbatim — exactly Vue's `autoFlip: false` path — so `data-side` /
//     `data-align` carry the PLACED orientation (Vue writes the RESOLVED one,
//     which differs only after a flip).
//   * NO BREAKPOINT AUTO-CLOSE: Vue closes an open panel when the viewport
//     crosses 768px (`watch(isMobile)`). The mirror's branch is re-decided per
//     render (or pinned by `active_branch`); the host re-evaluates on resize —
//     `select_panel_branch` is exported for exactly that.
//   * NO ENTER/LEAVE TRANSITIONS (`hk-select-popout-*` / `hk-select-sheet-*`
//     are Vue's `<Transition>` names), no surface machine, no back guard, no
//     overlay scrollbar, no size morph, no `scrollIntoView`, and none of the
//     `nextTick` DOM passes (duplicate-title filter, scrollbar attach): all of
//     them are animation-bus / history / measurement contracts.
//   * NO SHEET DUPLICATE-TITLE FILTER (`.hk-sheet-dup-title`): it hides the
//     first non-interactive content node whose text repeats the panel title,
//     decided by a `MutationObserver` over live DOM. The mirror renders option
//     rows only, and a row label is never the heading — the class stays a hook
//     for hosts that slot their own markup.
//   * `data-highlighted` / `data-checked` / `data-disabled` are PRESENCE
//     markers (Vue: `cond || undefined`); a serialized `="false"` would still
//     match a `[data-*]` selector, so the mirror emits the attribute only when
//     the flag is on.
//   * the ✕ is the shared `IconButton` (Vue renders `HIconButton` there, with
//     `size={32}` + `variant="ghost"`); its glyph box is
//     `IconButtonSize::glyph_px` (20px at size 32) rather than Vue's literal
//     16 — the row-level delta `basic/icon_button.rs` documents for every
//     caller. The aria label resolves through the components bundle
//     (`components.hk.modal.close`, the same "Close" literal Vue's
//     `hikari::modal.close` key carries).

use hikari_i18n::t;
use hikari_icons::MdiIcon;
// The prelude curates the tairitsu event set; `PointerEvent` (the hover
// highlight channel) is not part of it (same import as `basic/select.rs`).
use tairitsu_vdom::PointerEvent;

use crate::basic::select::{
    SelectAnchorRect, SelectOption, SelectPanelPlacement, select_popout_style, step_highlight,
};
use crate::basic::{IconButton, IconButtonSize, IconButtonVariant};
use crate::platform;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SelectPanelComponent;

/// The two form factors of the surface (Vue's `activeBranch` ref).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SelectPanelBranch {
    /// The anchored desktop popout (`.hk-select-popout-host`).
    #[default]
    Popout,
    /// The mobile bottom sheet (scrim + grabber + heading + list).
    Sheet,
}

/// Vue's `sheetMode` decision: `props.sheetOnMobile && isMobile`, where
/// `isMobile` is `window.innerWidth < 768` (`useBreakpoint`). The host calls
/// this on every open — and again on resize, since the mirror installs no
/// breakpoint watcher (see the header deltas).
pub fn select_panel_branch(sheet_on_mobile: bool, viewport_width: i32) -> SelectPanelBranch {
    if sheet_on_mobile && viewport_width < 768 {
        SelectPanelBranch::Sheet
    } else {
        SelectPanelBranch::Popout
    }
}

/// The popout host's inline geometry.
///
/// With a measured trigger rect this IS the W2a
/// `basic::select::select_popout_style` (Vue: `positionPanel`, minus the
/// measured flip/clamp pass) — delegated, never re-derived, so the panel and
/// the `HkSelect` field can never land differently. WITHOUT a rect it is the
/// empty string: Vue's `positionPanel` returns early when the host passed no
/// `anchorRef`, leaving the stylesheet's own box in charge.
pub fn select_panel_popout_style(
    placement: SelectPanelPlacement,
    anchor: Option<SelectAnchorRect>,
    offset: f64,
    match_anchor_width: bool,
) -> String {
    match anchor {
        Some(anchor) => select_popout_style(placement, anchor, offset, match_anchor_width),
        None => String::new(),
    }
}

/// Vue's `surfaceCap`: the host-tunable cap published as the
/// `--hk-select-panel-max-height` custom property on whichever element
/// scrolls (the desktop popout, the sheet's list band). An absent or empty
/// value publishes nothing, so the stylesheet's own ceiling stays in charge
/// (`HkSelect.scss` reads the hook inside its `@supports (height: 1dvh)`
/// branch for the popout and unguarded for the sheet list).
pub fn select_panel_cap_style(max_height: Option<&str>) -> String {
    match max_height {
        Some(value) if !value.is_empty() => {
            format!("--hk-select-panel-max-height:{value}")
        }
        _ => String::new(),
    }
}

/// One rendered row: the Vue `HkSelect` option slot (`div.hk-select-option`)
/// mapped to its marker set.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SelectPanelRow {
    /// `data-select-index` — the row's position in the option list.
    pub index: usize,
    /// The value a press/Enter commits.
    pub value: String,
    /// The row text.
    pub label: String,
    /// `data-highlighted`: the keyboard/pointer cursor sits on this row.
    pub highlighted: bool,
    /// `data-checked`: the row matches the controlled model.
    pub checked: bool,
    /// `data-disabled`: renders, never commits.
    pub disabled: bool,
}

/// Vue's row loop: every option becomes one row, marked by the cursor, the
/// model and the option's own flag. Host order is preserved (Vue renders the
/// `options` prop in order) — sorting belongs to the caller.
pub fn select_panel_rows(
    options: &[SelectOption],
    model_value: &str,
    highlighted: i32,
) -> Vec<SelectPanelRow> {
    options
        .iter()
        .enumerate()
        .map(|(index, option)| SelectPanelRow {
            index,
            value: option.value.clone(),
            label: option.label.clone(),
            highlighted: highlighted == index as i32,
            checked: option.value == model_value,
            disabled: option.disabled,
        })
        .collect()
}

/// Vue's Enter path (`onPopoutKeydown`): commit the highlighted row — unless
/// nothing is highlighted (Vue's `highlightedIndex === -1`) or the row is
/// disabled (`if (!option.disabled)`). Returns the row to hand to the host.
pub fn select_panel_commit_row(options: &[SelectOption], highlighted: i32) -> Option<SelectOption> {
    let index = usize::try_from(highlighted).ok()?;
    let option = options.get(index)?;
    if option.disabled {
        return None;
    }
    Some(option.clone())
}

/// What a surface key does to the open panel.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SelectPanelKeyAction {
    /// Arrow down (+1) / arrow up (-1): step the cursor, wrapping.
    Step(i32),
    /// Enter: commit the highlighted row when it is committable.
    Commit,
    /// Escape: close AND consume the key (see [`select_panel_key_action`]).
    CloseAndConsume,
    /// Anything else: the panel leaves it alone.
    Forward,
}

/// The panel's key grammar (Vue: `onPopoutKeydown` + `onSurfaceEscape`,
/// reached through `forwardKeydown`).
///
/// Escape is consumed EXACTLY ONCE — `preventDefault` + `stopPropagation` on
/// the key that closes the panel — so a dialog hosting the panel does not also
/// close on the same press. The trigger's own Escape arm follows the opposite
/// rule (consume only when it actually closed something) because a closed
/// select must let the key bubble; the panel only exists while open, which is
/// why every Escape reaching it is a close.
pub fn select_panel_key_action(key: &str) -> SelectPanelKeyAction {
    match key {
        "ArrowDown" => SelectPanelKeyAction::Step(1),
        "ArrowUp" => SelectPanelKeyAction::Step(-1),
        "Enter" => SelectPanelKeyAction::Commit,
        "Escape" => SelectPanelKeyAction::CloseAndConsume,
        _ => SelectPanelKeyAction::Forward,
    }
}

/// Vue's `onDocumentClick` guard, exposed as a pure predicate because the
/// mirror installs no document listener (the host owns outside dismissal).
///
/// Vue closes when the panel is open, the popout branch is live, and the
/// press landed outside BOTH the anchor and the fixed host (the host wraps the
/// panel AND the overlay-scrollbar tracks, so one containment question covers
/// both; the sheet branch dismisses through its scrim instead and never
/// participates). The host asks the same questions and closes when this
/// returns `true`.
pub fn select_panel_outside_click_closes(
    open: bool,
    sheet_branch: bool,
    in_anchor: bool,
    in_panel_host: bool,
) -> bool {
    open && !sheet_branch && !in_anchor && !in_panel_host
}

#[define_props]
pub struct SelectPanelProps {
    /// Vue: `open`, required — CONTROLLED (the parent owns the flag).
    pub open: bool,

    /// The rows the surface carries. Vue passes them as the default slot
    /// (arbitrary markup); the mirror renders the option model `HkSelect`
    /// builds from it, so the surface has a typed shape and a keyboard path.
    pub options: Vec<SelectOption>,

    /// The row that reads as selected (`data-checked`).
    #[default]
    pub model_value: String,

    /// Keyboard/pointer highlight; `-1` means "none" (Vue: the local
    /// `highlightedIndex` ref).
    #[default(-1)]
    pub highlighted_index: i32,

    /// Sheet heading and the popout's `aria-label` (Vue: `title`, published as
    /// `title || undefined`).
    #[default]
    pub title: String,

    /// Desktop-popout placement (Vue default `"bottom-start"`).
    #[default]
    pub placement: SelectPanelPlacement,

    /// Gap between the trigger and the popout, in px (Vue default 4).
    #[default(4.0)]
    pub offset: f64,

    /// Tie the popout's minimum width to the trigger (Vue default true).
    #[default(true)]
    pub match_anchor_width: bool,

    /// Cap for the scrolling surface, as any CSS length (Vue: `maxHeight`).
    pub max_height: Option<String>,

    /// Dock as a bottom sheet on phone-width viewports (Vue default true).
    #[default(true)]
    pub sheet_on_mobile: bool,

    /// The form factor the surface opened in (Vue's local `activeBranch` ref,
    /// promoted like the other refs). `None` resolves from the live viewport,
    /// which is also what Vue seeds it with on its opening edge; a host that
    /// wants the born shape pinned across a resize passes it explicitly.
    pub active_branch: Option<SelectPanelBranch>,

    /// The trigger rect to anchor against (`feedback::popover::
    /// anchor_rect_from_element_id` measures one by id). Without it the popout
    /// keeps the stylesheet's default box — Vue without `anchorRef`.
    pub anchor: Option<SelectAnchorRect>,

    /// Extra class on the surface root (the popout host / the sheet panel).
    /// Vue has no `class` prop here; the crate's mirrors all carry one.
    #[default]
    pub class: String,

    /// Fires with the desired open state (Vue: `update:open`).
    pub on_open_change: Option<EventHandler<bool>>,

    /// Fires with the chosen row's value.
    pub on_value_change: Option<EventHandler<String>>,

    /// Fires with the desired highlight index.
    pub on_highlight_change: Option<EventHandler<i32>>,
}

/// The controlled event wiring both branches share: the open flag, the cursor
/// and the three writers, bundled so the scrim, the grabber, the ✕, the rows
/// and the key handler build their closures from one value.
#[derive(Clone)]
struct SelectPanelWiring {
    highlighted: i32,
    on_open_change: Option<EventHandler<bool>>,
    on_value_change: Option<EventHandler<String>>,
    on_highlight_change: Option<EventHandler<i32>>,
}

impl SelectPanelWiring {
    fn request_open(&self, open: bool) {
        if let Some(handler) = self.on_open_change.as_ref() {
            handler.call(open);
        }
    }

    fn set_highlight(&self, index: i32) {
        if let Some(handler) = self.on_highlight_change.as_ref() {
            handler.call(index);
        }
    }

    /// Vue's row press: emit the value, then close.
    fn commit(&self, value: String) {
        if let Some(handler) = self.on_value_change.as_ref() {
            handler.call(value);
        }
        self.request_open(false);
    }

    /// Vue's `onPopoutKeydown`, re-expressed in controlled terms.
    fn panel_key(&self, event: KeyboardEvent, options: &[SelectOption]) {
        match select_panel_key_action(event.key.as_str()) {
            SelectPanelKeyAction::Step(delta) => {
                event.prevent_default();
                // The W2a step: one cursor rule for the field and the surface.
                self.set_highlight(step_highlight(self.highlighted, options.len(), delta));
            }
            SelectPanelKeyAction::Commit => {
                event.prevent_default();
                if let Some(option) = select_panel_commit_row(options, self.highlighted) {
                    self.commit(option.value);
                }
            }
            SelectPanelKeyAction::CloseAndConsume => {
                event.prevent_default();
                event.stop_propagation();
                self.request_open(false);
            }
            SelectPanelKeyAction::Forward => {}
        }
    }
}

/// Vue's presence-only marker attribute: `data-*` carries `"true"` while the
/// flag is on and is ABSENT otherwise (a serialized `="false"` reads as a value
/// to a `[data-checked]` selector).
fn marker_attr(flag: bool) -> Option<&'static str> {
    if flag { Some("true") } else { None }
}

#[component]
pub fn SelectPanel(props: SelectPanelProps) -> Element {
    let options = props.options.clone();
    let open = props.open;
    let _ = open;
    let highlighted = props.highlighted_index;
    // Vue: `activeBranch` once opened, `sheetMode` otherwise. A controlled
    // `active_branch` wins (the born form factor); otherwise the live viewport
    // decides, exactly like the ref's opening-edge seed.
    let branch = props
        .active_branch
        .unwrap_or_else(|| select_panel_branch(props.sheet_on_mobile, platform::inner_width()));
    // Vue: `aria-label={props.title || undefined}` on both branches.
    let aria_label = Some(props.title.clone()).filter(|title| !title.is_empty());
    let cap_style = select_panel_cap_style(props.max_height.as_deref());
    let surface_class = props.class.clone();

    let wiring = SelectPanelWiring {
        highlighted,
        on_open_change: props.on_open_change.clone(),
        on_value_change: props.on_value_change.clone(),
        on_highlight_change: props.on_highlight_change.clone(),
    };

    // ── the surface ───────────────────────────────────────────────────────
    // Rows exist only while open (Vue mounts the surface, and its slot
    // content, on the opening edge), so the whole sweep sits behind the guard.
    let layer = if open {
        let rows = select_panel_rows(&options, &props.model_value, highlighted);
        let key_wiring = wiring.clone();
        let key_options = options.clone();
        let panel_keydown = move |event: KeyboardEvent| key_wiring.panel_key(event, &key_options);

        let mut row_nodes: Vec<VNode> = Vec::with_capacity(rows.len());
        for row in rows {
            let index = row.index;
            let index_i32 = index as i32;
            let is_highlighted = row.highlighted;
            let is_checked = row.checked;
            let is_disabled = row.disabled;
            let row_label = row.label;
            let click_wiring = wiring.clone();
            let click_value = row.value;
            let enter_wiring = wiring.clone();
            // Vue spreads the hover highlight only for the desktop popout; the
            // rows only exist while open, so the form-factor guard is the whole
            // rule (sheet rows never follow the pointer).
            let hover_enabled = branch == SelectPanelBranch::Popout;
            row_nodes.push(rsx! {
                div {
                    class: "hk-select-option",
                    "data-highlighted": marker_attr(is_highlighted),
                    "data-select-index": index_i32,
                    "data-checked": marker_attr(is_checked),
                    "data-disabled": marker_attr(is_disabled),
                    onclick: move |_event: MouseEvent| {
                        if !is_disabled {
                            click_wiring.commit(click_value.clone());
                        }
                    },
                    onpointerenter: move |_event: PointerEvent| {
                        if hover_enabled {
                            enter_wiring.set_highlight(index_i32);
                        }
                    },
                    span { {row_label} }
                }
            });
        }
        let row_nodes = VNode::Fragment(row_nodes);

        Some(match branch {
            SelectPanelBranch::Sheet => {
                let scrim_wiring = wiring.clone();
                let grabber_wiring = wiring.clone();
                let close_wiring = wiring.clone();
                let close_label = t("components.hk.modal.close", "Close");
                let title = props.title.clone();
                let sheet_classes = if surface_class.is_empty() {
                    String::from("hk-select-sheet-panel")
                } else {
                    format!("hk-select-sheet-panel {surface_class}")
                };
                let list_cap = cap_style.clone();
                rsx! {
                    div {
                        class: "hk-select-sheet-scrim",
                        onclick: move |_event: MouseEvent| scrim_wiring.request_open(false),
                    }
                    div {
                        class: sheet_classes,
                        "role": "dialog",
                        "aria-modal": "true",
                        "aria-label": aria_label,
                        "tabindex": -1,
                        onkeydown: panel_keydown,
                        div {
                            class: "hk-select-sheet-grabber",
                            "aria-hidden": "true",
                            onclick: move |_event: MouseEvent| grabber_wiring.request_open(false),
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
                                    close_wiring.request_open(false);
                                })),
                            }
                        }
                        div {
                            class: "hk-select-sheet-body",
                            div {
                                class: "hk-select-sheet-list",
                                style: list_cap,
                                div { class: "hk-select-sheet-content",
                                    {row_nodes}
                                }
                            }
                        }
                    }
                }
            }
            SelectPanelBranch::Popout => {
                let (side, align) = props.placement.side_align();
                let geometry = select_panel_popout_style(
                    props.placement,
                    props.anchor,
                    props.offset,
                    props.match_anchor_width,
                );
                let host_classes = if surface_class.is_empty() {
                    String::from("hk-select-popout-host")
                } else {
                    format!("hk-select-popout-host {surface_class}")
                };
                let popout_cap = cap_style.clone();
                rsx! {
                    div {
                        class: host_classes,
                        "data-side": side.token(),
                        "data-align": align.token(),
                        style: geometry,
                        div {
                            class: "hk-select-popout",
                            "aria-label": aria_label,
                            style: popout_cap,
                            onkeydown: panel_keydown,
                            {row_nodes}
                        }
                    }
                }
            }
        })
    } else {
        None
    };

    // Nothing is stored: a closed panel owns no nodes at all (Vue's surface
    // machine unmounts the Teleport once the leave window finishes).
    match layer {
        Some(layer) => rsx! {
            {layer}
        },
        None => empty_vnode(),
    }
}

impl StyledComponent for SelectPanelComponent {
    fn styles() -> &'static str {
        // NO sheet of its own — verified, not assumed. `HkSelectPanel.tsx`
        // imports `./HkSelect.scss` (no `HkSelectPanel.scss` exists in the Vue
        // tree), and that sheet is already compiled into the bundle by the W2a
        // `basic/select.rs` mirror; the ✕ chrome comes from
        // `StyleRegistry::register_vue_chrome`. A second `scss!` of the same
        // file would emit its rules twice, so the canvas is inherited and the
        // table here stays empty (the `basic/kbd.rs` rule for sheet-less
        // components). 画布来自已 vendored 的 HkSelect.scss（registry chrome
        // 已有）；本组件不新增表.
        ""
    }

    fn name() -> &'static str {
        "select-panel"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options() -> Vec<SelectOption> {
        vec![
            SelectOption {
                value: "a".to_string(),
                label: "Alpha".to_string(),
                disabled: false,
            },
            SelectOption {
                value: "b".to_string(),
                label: "Beta".to_string(),
                disabled: true,
            },
        ]
    }

    fn anchor() -> SelectAnchorRect {
        SelectAnchorRect {
            x: 100.0,
            y: 50.0,
            width: 40.0,
            height: 20.0,
        }
    }

    #[test]
    fn select_panel_branch_follows_the_vue_breakpoint() {
        // `useBreakpoint().isMobile` is `innerWidth < 768`.
        assert_eq!(select_panel_branch(true, 767), SelectPanelBranch::Sheet);
        assert_eq!(select_panel_branch(true, 375), SelectPanelBranch::Sheet);
        assert_eq!(select_panel_branch(true, 768), SelectPanelBranch::Popout);
        assert_eq!(select_panel_branch(true, 1280), SelectPanelBranch::Popout);
        // `sheetOnMobile: false` pins the popout at every width.
        assert_eq!(select_panel_branch(false, 375), SelectPanelBranch::Popout);
    }

    #[test]
    fn select_panel_popout_style_reuses_the_w2a_geometry() {
        // The delegated W2a helper, byte for byte — no second geometry.
        assert_eq!(
            select_panel_popout_style(SelectPanelPlacement::BottomStart, Some(anchor()), 4.0, true),
            "left:100px;top:74px;min-width:40px"
        );
        assert_eq!(
            select_panel_popout_style(SelectPanelPlacement::BottomStart, Some(anchor()), 4.0, true),
            select_popout_style(SelectPanelPlacement::BottomStart, anchor(), 4.0, true)
        );
        assert_eq!(
            select_panel_popout_style(SelectPanelPlacement::TopEnd, Some(anchor()), 4.0, true),
            "left:140px;bottom:calc(100vh - 46px);transform:translateX(-100%);min-width:40px"
        );
        // The `matchAnchorWidth={false}` arm drops the width tie.
        assert_eq!(
            select_panel_popout_style(
                SelectPanelPlacement::BottomStart,
                Some(anchor()),
                4.0,
                false
            ),
            "left:100px;top:74px"
        );
        // No measured trigger → the stylesheet's own box (Vue returns early).
        assert_eq!(
            select_panel_popout_style(SelectPanelPlacement::BottomStart, None, 4.0, true),
            ""
        );
    }

    #[test]
    fn select_panel_cap_style_publishes_the_hook_only_when_set() {
        assert_eq!(
            select_panel_cap_style(Some("min(18rem, 45dvh)")),
            "--hk-select-panel-max-height:min(18rem, 45dvh)"
        );
        assert_eq!(
            select_panel_cap_style(Some("24rem")),
            "--hk-select-panel-max-height:24rem"
        );
        // Vue's `props.maxHeight ? … : undefined` — empty and absent agree.
        assert_eq!(select_panel_cap_style(None), "");
        assert_eq!(select_panel_cap_style(Some("")), "");
    }

    #[test]
    fn select_panel_rows_map_the_vue_row_markers() {
        let rows = select_panel_rows(&options(), "b", 0);
        assert_eq!(rows.len(), 2);
        // `data-select-index` is the row's position.
        assert_eq!(rows[0].index, 0);
        assert_eq!(rows[1].index, 1);
        assert_eq!(rows[0].value, "a");
        assert_eq!(rows[0].label, "Alpha");
        // One cursor row, one checked row (the model), the disabled flag as-is.
        assert!(rows[0].highlighted);
        assert!(!rows[1].highlighted);
        assert!(!rows[0].checked);
        assert!(rows[1].checked);
        assert!(!rows[0].disabled);
        assert!(rows[1].disabled);
        // `-1` highlights nothing — Vue's "no cursor".
        let none_highlighted = select_panel_rows(&options(), "a", -1);
        assert!(none_highlighted.iter().all(|row| !row.highlighted));
        assert!(none_highlighted[0].checked);
    }

    #[test]
    fn select_panel_commit_row_filters_disabled_and_absent_rows() {
        assert_eq!(
            select_panel_commit_row(&options(), 0).map(|option| option.value),
            Some("a".to_string())
        );
        // A disabled row renders but never commits (Vue: `if (!option.disabled)`).
        assert!(select_panel_commit_row(&options(), 1).is_none());
        // No cursor, past the end, and an empty list all commit nothing.
        assert!(select_panel_commit_row(&options(), -1).is_none());
        assert!(select_panel_commit_row(&options(), 2).is_none());
        assert!(select_panel_commit_row(&[], 0).is_none());
    }

    #[test]
    fn select_panel_key_actions_consume_escape_once() {
        assert_eq!(
            select_panel_key_action("ArrowDown"),
            SelectPanelKeyAction::Step(1)
        );
        assert_eq!(
            select_panel_key_action("ArrowUp"),
            SelectPanelKeyAction::Step(-1)
        );
        assert_eq!(
            select_panel_key_action("Enter"),
            SelectPanelKeyAction::Commit
        );
        // Escape both closes and consumes (one layer only).
        assert_eq!(
            select_panel_key_action("Escape"),
            SelectPanelKeyAction::CloseAndConsume
        );
        // Everything else is the host's (Vue re-emits `keydown`).
        assert_eq!(
            select_panel_key_action("Tab"),
            SelectPanelKeyAction::Forward
        );
        assert_eq!(select_panel_key_action("a"), SelectPanelKeyAction::Forward);
        assert_eq!(select_panel_key_action(" "), SelectPanelKeyAction::Forward);
    }

    #[test]
    fn select_panel_outside_click_needs_an_open_popout_and_an_outside_target() {
        assert!(select_panel_outside_click_closes(true, false, false, false));
        // Closed panel: nothing to dismiss.
        assert!(!select_panel_outside_click_closes(
            false, false, false, false
        ));
        // The sheet dismisses through its scrim, never through this predicate.
        assert!(!select_panel_outside_click_closes(true, true, false, false));
        // A press on the trigger or anywhere inside the fixed host keeps it.
        assert!(!select_panel_outside_click_closes(true, false, true, false));
        assert!(!select_panel_outside_click_closes(true, false, false, true));
    }

    #[test]
    fn select_panel_defaults_match_the_vue_props() {
        let props = SelectPanelProps::default();
        assert!(!props.open);
        assert!(props.options.is_empty());
        assert_eq!(props.model_value, "");
        assert_eq!(props.highlighted_index, -1);
        assert_eq!(props.title, "");
        // Vue's `placement` default is `bottom-start`.
        assert_eq!(props.placement, SelectPanelPlacement::BottomStart);
        assert_eq!(props.offset, 4.0);
        assert!(props.match_anchor_width);
        assert_eq!(props.max_height, None);
        assert!(props.sheet_on_mobile);
        assert_eq!(props.active_branch, None);
        assert!(props.anchor.is_none());
        assert_eq!(props.class, "");
        assert!(props.on_open_change.is_none());
        assert!(props.on_value_change.is_none());
        assert!(props.on_highlight_change.is_none());
    }

    #[test]
    fn select_panel_renders_the_vue_sheet_contract() {
        // The folded HkSelectSheet arm: the born branch pinned to `Sheet` (the
        // native width stub is desktop, so the viewport cannot reach it).
        let html = SelectPanel(SelectPanelProps {
            open: true,
            options: options(),
            model_value: "a".to_string(),
            highlighted_index: 0,
            title: "Channel".to_string(),
            active_branch: Some(SelectPanelBranch::Sheet),
            max_height: Some("24rem".to_string()),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-select-sheet-scrim""#), "{html}");
        assert!(html.contains(r#"class="hk-select-sheet-panel""#), "{html}");
        assert!(html.contains(r#"role="dialog""#), "{html}");
        assert!(html.contains(r#"aria-modal="true""#), "{html}");
        assert!(html.contains(r#"aria-label="Channel""#), "{html}");
        assert!(html.contains(r#"tabindex="-1""#), "{html}");
        assert!(
            html.contains(r#"class="hk-select-sheet-grabber""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-select-sheet-header""#), "{html}");
        assert!(
            html.contains(r#"class="hk-select-sheet-title">Channel<"#),
            "{html}"
        );
        // The ✕ is the shared icon-button chrome, as Vue renders it.
        assert!(html.contains("hk-window-close"), "{html}");
        assert!(html.contains("hk-select-sheet-close"), "{html}");
        assert!(html.contains("hk-icon-button-ghost"), "{html}");
        assert!(html.contains("hk-icon-button-32"), "{html}");
        assert!(html.contains(r#"aria-label="Close""#), "{html}");
        // Body → list (the cap hook) → content → the rows.
        assert!(html.contains(r#"class="hk-select-sheet-body""#), "{html}");
        assert!(html.contains(r#"class="hk-select-sheet-list""#), "{html}");
        assert!(
            html.contains(r#"style="--hk-select-panel-max-height:24rem""#),
            "{html}"
        );
        assert!(
            html.contains(r#"class="hk-select-sheet-content""#),
            "{html}"
        );
        assert_eq!(
            html.matches(r#"class="hk-select-option""#).count(),
            2,
            "{html}"
        );
        assert!(html.contains(r#"data-highlighted="true""#), "{html}");
        assert!(html.contains(r#"data-checked="true""#), "{html}");
        assert!(html.contains(r#"data-disabled="true""#), "{html}");
        // Presence-only markers: never a serialized `false`.
        assert!(!html.contains(r#"data-checked="false""#), "{html}");
        assert!(!html.contains(r#"data-disabled="false""#), "{html}");
        // The sheet branch renders no anchored popout.
        assert!(!html.contains("hk-select-popout"), "{html}");
    }

    #[test]
    fn select_panel_renders_the_vue_popout_contract() {
        let html = SelectPanel(SelectPanelProps {
            open: true,
            options: options(),
            highlighted_index: 1,
            placement: SelectPanelPlacement::TopEnd,
            anchor: Some(anchor()),
            title: "Channel".to_string(),
            active_branch: Some(SelectPanelBranch::Popout),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-select-popout-host""#), "{html}");
        // The resolved-or-placed orientation feeds the transition's origin.
        assert!(html.contains(r#"data-side="top""#), "{html}");
        assert!(html.contains(r#"data-align="end""#), "{html}");
        // Inline geometry from the W2a helper (no Teleport, no z band).
        assert!(
            html.contains(
                r#"style="left:140px;bottom:calc(100vh - 46px);transform:translateX(-100%);min-width:40px""#
            ),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-select-popout""#), "{html}");
        assert!(html.contains(r#"aria-label="Channel""#), "{html}");
        assert_eq!(
            html.matches(r#"class="hk-select-option""#).count(),
            2,
            "{html}"
        );
        assert!(html.contains(r#"data-select-index="1""#), "{html}");
        // No cap hook without `max_height`, and no sheet in this branch.
        assert!(!html.contains("--hk-select-panel-max-height"), "{html}");
        assert!(!html.contains("hk-select-sheet"), "{html}");
    }

    #[test]
    fn select_panel_closed_renders_nothing() {
        let html = SelectPanel(SelectPanelProps {
            options: options(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "a closed panel mounts no surface: {html}");
    }

    #[test]
    fn select_panel_ships_no_sheet_of_its_own() {
        // Verified ownership: Vue ships no `HkSelectPanel.scss` — the canvas is
        // the vendored HkSelect sheet the W2a Select mirror already compiles.
        assert_eq!(SelectPanelComponent::styles(), "");
        assert_eq!(SelectPanelComponent::name(), "select-panel");
        let canvas = std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/src/styles/vue-mirror/components/HkSelect.scss"
        ))
        .expect("the vendored panel canvas exists");
        for class in [
            ".hk-select-popout-host",
            ".hk-select-popout ",
            ".hk-select-sheet-scrim",
            ".hk-select-sheet-panel",
            ".hk-select-sheet-grabber",
            ".hk-select-sheet-header",
            ".hk-select-sheet-close",
            ".hk-select-sheet-title",
            ".hk-select-sheet-body",
            ".hk-select-sheet-list",
            "--hk-select-panel-max-height",
        ] {
            assert!(canvas.contains(class), "canvas is missing {class}");
        }
    }
}
