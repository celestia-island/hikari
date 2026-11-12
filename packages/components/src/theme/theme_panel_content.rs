// packages/components/src/theme/theme_panel_content.rs
// ThemePanelContent — mirror of the canonical Vue `HkThemePanelContent`
// (the theme panel body both the toggle's popover and host settings
// surfaces render).
//
// STYLESHEET: the menu borrows the sibling toggle's compiled table — the
// Vue component imports `./HkThemeToggle.scss` and ships no sheet of its
// own; [`crate::theme::theme_toggle::ThemeToggleComponent::styles`] emits
// `src/styles/vue-mirror/components/HkThemeToggle.scss` (a second
// `styles()` for it here would duplicate it — the registry path stays the
// wiring wave's call, see `styled.rs`). SINCE 2026-11-11 the customize
// entry is the standard HkAddTile (compact form), so this component ALSO
// carries the tile's own compiled sheet for hosts that mount the panel
// without the toggle.
//
// DOM contract (mirrors Vue's render output one-to-one; a FRAGMENT root,
// no wrapper element):
//
//   div.s-theme-menu
//     div.s-theme-menu-label                    "Mode"
//     div.s-theme-mode-row
//       div.hk-tabs [data-variant="segmented"]
//         div.hk-tabs-list [role="radiogroup"] [data-block="true"]
//           div.hk-tabs-indicator
//           button.hk-tabs-trigger [role=radio]  ("Auto")
//           [auto]  div.hk-tabs-merged [data-keys="light dark"]
//                     button.s-theme-mode-autoalt
//                       {sun|moon glyph}
//                       span.s-theme-mode-autoalt-value  "+32.5°"
//           [manual] button.hk-tabs-trigger ×2   ("Light"/"Dark")
//     [div.s-theme-mode-extra]                   (mode_extra slot)
//     div.hk-divider.hk-divider-spacing-md
//     div.s-theme-menu-label                    "Themes"
//     div.s-theme-item-list [role="list"]
//       (per theme)
//       div.hk-list-row.hk-list-row-clickable.s-theme-item-row
//                            [data-custom?] [data-trailing="slot"?]
//                            [data-name-suffix="slot"?] [data-active?]
//                            [role="listitem"] [aria-current="true"?]
//         div.hk-list-row-main
//           div.s-theme-item-line
//             [span.hk-menu-item-icon.s-theme-item-lead]
//             span.s-theme-item-name
//             [span.s-theme-item-name-suffix]
//         [div.hk-list-row-trailing > span.s-theme-item-trailing]
//         [div.hk-list-row-actions.hk-list-row-actions--overlay
//          [role="toolbar"]                       (click-guarded lane)
//            button.hk-list-row-actions__btn [data-danger?]]
//     button.hk-add-tile.hk-add-tile--compact.s-theme-item-customize
//       {Plus glyph svg}  "Customize"                       (standard add tile)
//   [div.hk-menu-slot.hk-menu-slot--extra]      (menu_extra slot)
//   {ColorSchemeDialog}                          (externalCustomize false)
//
// The theme RUNTIME is host-owned (the wave ruling): `useTheme()` (mode,
// theme tables, custom-theme store), the solar clock, the altitude timer
// and the MutationObserver-driven engine all live outside. The mirror is
// CONTROLLED — state arrives as props, every intent leaves through an
// `on_*` channel bound to the MOUSE family (ledger L48: zero
// use_signal/use_state; the mouse family is a convention — the pointer
// family is typed on this wire since tairitsu 0.5.24, ledger L88's
// never-fires window is closed).
//
// Deltas vs Vue (documented, not accidental):
//   * The mode strip is the HkTabs segmented DOM SUBSET (`hk-tabs*`
//     classes, radiogroup/radio roles, the merged cell): the HkTabs sheet
//     is not vendored yet, so the strip's pill chrome arrives with that
//     mirror. The sliding `hk-tabs-indicator` renders WITHOUT
//     `data-ready` — its geometry needs live DOM measure tairitsu does
//     not expose. The block strip keeps its slot-unit markers
//     (`data-slots`, `--hk-tabs-units: 3`) so the future sheet lights up.
//   * Option glyphs: Light/Dark carry the shipped MDI sun/moon glyphs;
//     the AUTO option renders text-only — the icon set has no monitor
//     glyph (Vue: `Monitor`). The altitude cell keeps its sun/moon glyph
//     (which side auto resolves to) — `MoonStar` maps to the closest
//     shipped `MoonWaningCrescent`.
//   * The altitude readout is PURE: the host passes `altitude_deg` (the
//     clock's live solar altitude) and [`format_solar_altitude`] does the
//     JS `toFixed(1)` + sign formatting. The 60s re-tick timer and the
//     700ms press debounce are HOST runtime concerns — a stateless mirror
//     cannot own either (Vue's own debounce exists because input
//     synthesis double-fires; the host re-renders are idempotent here).
//   * The scoped slot payload drops `preset`: the host owns the preset
//     tables and can resolve by `id` — cloning a whole scheme per row per
//     render had no consumer in the mirror.
//   * The delete affordance's glyph is `Close` (12px) — the shipped MDI
//     set has no trash glyph (Vue: `Trash2`); swap when the set grows.
//   * The scheme dialog's editor state is host-held too: the `scheme_*`
//     props and channels below are the dialog's controlled pass-through,
//     documented in its own file. `on_scheme_update` is Vue's
//     `update:scheme` (fired after the dialog's own Save already asked to
//     close itself); applying the theme (`addCustomTheme` + `setTheme`)
//     stays with the host.
//   * The rows are listitems, not buttons (2026-11-13 the Vue side moved
//     onto HkListRow): row selection rides the row's click + the host's
//     keyboard bridge (Vue's Enter/Space parity lives in HkListRow's
//     keydown — a native renderer owns key synthesis, the mirror renders
//     the clickable div). Lane and trailing clicks stop at their
//     wrappers (`stop_propagation` — the HkStatCard action-wrapper rule;
//     a per-row action must never double-fire the row's selection).
//   * The action lane renders in its POINTER form (overlay revealed by
//     the sheet's hover/focus-within): the mirror has no matchMedia, so
//     the touch ⋯ trigger + HkMenu pair is not mirrored — a touch-first
//     native shell reveals the lane through its own focus bridge.
//   * Name-only host actions render title/aria-only buttons (the Vue
//     lane's identity rides tooltips; the crate has no Tooltip mirror
//     yet) — icons ride `ThemeRowAction`'s future fields when a host
//     needs them.
//   * Glyph hosts are `div.hk-icon` (the crate's `Icon` mirror), not
//     Vue's inline `<svg>` — the crate-wide delta `basic/button.rs`
//     documents; the sheet's direct-child `> svg` pins therefore miss,
//     and the Icon's inline px size carries the glyph box instead.

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::layout::divider::{Divider, DividerProps, DividerSpacing};
use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::theme::color_scheme_dialog::ColorSchemeDialog;
use crate::theme::color_scheme_editor::{
    CustomTheme, SchemeEditKey, SchemeMode, SchemeTokenEdit, SchemeTokens,
};

pub struct ThemePanelContentComponent;

/// The color mode union (Vue: `currentMode`, `"system" | "light" | "dark"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ThemeMode {
    #[default]
    System,
    Light,
    Dark,
}

impl ThemeMode {
    /// The mode key exactly as Vue spells it.
    pub fn key(self) -> &'static str {
        match self {
            ThemeMode::System => "system",
            ThemeMode::Light => "light",
            ThemeMode::Dark => "dark",
        }
    }

    /// The localized option label (Vue: `hikari::theme.modeAuto` & co).
    pub fn label(self) -> String {
        match self {
            ThemeMode::System => t("components.hk.themePanelContent.modeAuto", "Auto"),
            ThemeMode::Light => t("components.hk.themePanelContent.modeLight", "Light"),
            ThemeMode::Dark => t("components.hk.themePanelContent.modeDark", "Dark"),
        }
    }
}

/// One theme row (Vue: `allThemeList` entries — `{ id, name, isCustom }`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ThemeListItem {
    pub id: String,
    /// Literal or message-key display name (resolved through `t()`).
    pub name: String,
    pub is_custom: bool,
}

/// The scoped payload handed to the `item_*` slots (Vue:
/// `ThemeItemScope`; the `preset` member is dropped — see the header
/// delta).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ThemeItemScope {
    pub id: String,
    /// The RAW stored name — may be a message key (see
    /// [`theme_panel_display_name`]).
    pub name: String,
    pub is_custom: bool,
}

impl From<&ThemeListItem> for ThemeItemScope {
    fn from(item: &ThemeListItem) -> Self {
        Self {
            id: item.id.clone(),
            name: item.name.clone(),
            is_custom: item.is_custom,
        }
    }
}

/// One named action of a row's option-control array (Vue:
/// `HkListRowAction`, the plain-data subset the wire needs — `name` is
/// the accessible name AND the identity: names are unique per row by
/// the lane contract, so [`ThemePanelContentProps::on_row_action`]
/// carries `(theme_id, action_name)`).
#[derive(Clone, PartialEq, Eq, Debug, Default)]
pub struct ThemeRowAction {
    pub name: String,
    pub danger: bool,
}

/// The auto-mode merged run, hoisted like Vue's `AUTO_MERGE_KEYS` (a
/// fresh literal per render would re-fire the merge watcher).
pub const THEME_PANEL_MERGE_KEYS: [&str; 2] = ["light", "dark"];

/// The altitude readout (Vue: `` `${alt >= 0 ? "+" : ""}${alt.toFixed(1)}°` ``).
/// The rounding is the ECMAScript `toFixed(1)` contract — nearest tenth,
/// ties toward the LARGER integer tenth — which is not what Rust's `{:.1}`
/// does on exact halves.
pub fn format_solar_altitude(alt_deg: f64) -> String {
    let scaled = alt_deg * 10.0;
    let floor = scaled.floor();
    let ceil = floor + 1.0;
    // ECMAScript `toFixed`: nearest tenth, ties toward the LARGER integer
    // tenth (`<=`, not `<` — Rust's own `{:.1}` breaks ties the other way).
    let rounded = if ceil - scaled <= scaled - floor {
        ceil
    } else {
        floor
    };
    let sign = if alt_deg >= 0.0 { "+" } else { "" };
    format!("{sign}{:.1}°", rounded / 10.0)
}

/// True when the mode group is in auto (Vue: `currentMode === "system"`,
/// the merged-cell branch).
pub fn theme_panel_is_auto(mode: ThemeMode) -> bool {
    mode == ThemeMode::System
}

/// Which glyph the altitude cell shows (Vue: `effectiveMode === "dark"`).
pub fn theme_panel_altitude_night(effective: SchemeMode) -> bool {
    effective == SchemeMode::Dark
}

/// Pressing the altitude strip lands on the side auto resolves to
/// (Vue: `setMode(effectiveMode.value)` — day → light, night → dark).
pub fn theme_panel_resolve_auto_target(effective: SchemeMode) -> ThemeMode {
    match effective {
        SchemeMode::Light => ThemeMode::Light,
        SchemeMode::Dark => ThemeMode::Dark,
    }
}

/// A row's display name: preset names may be message keys into hikari's
/// own catalog; `t()` falls back to the raw string for anything that is
/// not a key (Vue: `t(th.name)`).
pub fn theme_panel_display_name(name: &str) -> String {
    t(name, name)
}

/// The three mode options in Vue's order, with localized labels.
pub fn theme_panel_mode_options() -> Vec<(ThemeMode, String)> {
    vec![
        (ThemeMode::System, ThemeMode::System.label()),
        (ThemeMode::Light, ThemeMode::Light.label()),
        (ThemeMode::Dark, ThemeMode::Dark.label()),
    ]
}

/// The roving tabindex (Vue: the active trigger — or the FIRST option
/// when none is — joins the page tab sequence, the rest stay at -1).
pub fn theme_panel_trigger_tabindex(is_active: bool, idx: usize, fallback_idx: usize) -> i32 {
    if is_active || idx == fallback_idx {
        0
    } else {
        -1
    }
}

/// The strip's accessible name (Vue leaves the panel strip unnamed; the
/// HkTabs contract itself asks for a named radiogroup — see the header
/// delta).
pub fn theme_panel_mode_switch_label() -> String {
    t(
        "components.hk.themePanelContent.modeSwitchLabel",
        "Color mode",
    )
}

/// The action lane's accessible name (Vue:
/// `hikari::theme.rowActionsLabel`).
pub fn theme_panel_row_actions_label() -> String {
    t(
        "components.hk.themePanelContent.rowActionsLabel",
        "Row actions",
    )
}

/// The altitude strip's tip (Vue: `hikari::theme.autoAltitudeTip`).
pub fn theme_panel_auto_altitude_tip() -> String {
    t(
        "components.hk.themePanelContent.autoAltitudeTip",
        "Auto follows the sun altitude. Press to switch to manual",
    )
}

/// One lane entry's dispatch shape: the built-in delete carries the
/// mirror's own delete channel; a host action rides
/// [`ThemePanelContentProps::on_row_action`] with (theme_id, action_name).
/// (Module-level on purpose — rsx for-body blocks accept statements, not
/// items, and the lane builds per row.)
enum RowActionSpec {
    BuiltinDelete,
    Host { name: String, danger: bool },
}

#[define_props]
pub struct ThemePanelContentProps {
    // ── Mode group ───────────────────────────────────────────────────────
    /// The stored color mode (Vue: `useTheme().currentMode`).
    #[default]
    pub current_mode: ThemeMode,

    /// The side auto currently resolves to (Vue: `effectiveMode`).
    #[default]
    pub effective_mode: SchemeMode,

    /// The solar altitude in degrees, live from the host clock (the
    /// readout itself is pure — see [`format_solar_altitude`]).
    #[default]
    pub altitude_deg: f64,

    // ── Theme rows ───────────────────────────────────────────────────────
    /// The full theme list (Vue: `allThemeList`).
    #[default(Vec::new())]
    pub themes: Vec<ThemeListItem>,

    /// The applied theme id (Vue: `currentTheme`).
    #[default]
    pub current_theme: String,

    // ── Customize / dialog wiring ────────────────────────────────────────
    /// The host owns the customization surface (Vue: `externalCustomize`).
    #[default]
    pub external_customize: bool,

    /// The built-in dialog's open state (Vue: the internal
    /// `schemeDialogOpen` ref, externalized — see the header delta).
    #[default]
    pub scheme_dialog_open: bool,

    /// The Save payload the dialog confirms with.
    #[default(CustomTheme::default())]
    pub scheme_draft: CustomTheme,

    /// The dialog's editor pass-through (see the dialog file).
    #[default]
    pub scheme_mode: SchemeMode,
    #[default(SchemeTokens::default())]
    pub scheme_dark: SchemeTokens,
    #[default(SchemeTokens::default())]
    pub scheme_light: SchemeTokens,
    #[default]
    pub scheme_name: String,
    pub scheme_open_picker: Option<SchemeEditKey>,

    // ── Slots ────────────────────────────────────────────────────────────
    /// Host strip directly under the mode group (Vue: `mode-extra`).
    pub mode_extra: Option<Element>,

    /// Per-row leading cell (Vue: `item-leading`); renders for EVERY row.
    pub item_leading: Option<Callback<ThemeItemScope, Element>>,

    /// Per-row inline mark right after the name (Vue: `item-name-suffix`).
    pub item_name_suffix: Option<Callback<ThemeItemScope, Element>>,

    /// Per-row trailing column (Vue: `item-trailing`); quiet CONTENT —
    /// suppresses the built-in delete lane, and clicks inside stop at
    /// the column.
    pub item_trailing: Option<Callback<ThemeItemScope, Element>>,

    /// Per-row option-control builder (Vue: the `itemActions` callback
    /// prop — 2026-11-13 the rows ride the standard list row and the
    /// host owns the affordances on its lane). Wins over the built-in
    /// delete; without it, custom rows carry the built-in delete.
    pub item_actions: Option<Callback<ThemeItemScope, Vec<ThemeRowAction>>>,

    /// Extra menu content after the panel (Vue: `menu-extra`).
    pub menu_extra: Option<Element>,

    /// Extension-group panels forwarded into the dialog's editor.
    pub children: Element,

    // ── Channels ─────────────────────────────────────────────────────────
    /// A mode option was pressed (Vue: `setMode`).
    pub on_mode_change: Option<EventHandler<ThemeMode>>,

    /// A theme row was pressed (Vue: `setTheme` + `request-close` — the
    /// mirror fires [`ThemePanelContentProps::on_request_close`] right
    /// after this channel).
    pub on_select_theme: Option<EventHandler<String>>,

    /// A custom theme's delete was pressed (Vue: `removeCustomTheme`).
    pub on_delete_theme: Option<EventHandler<String>>,

    /// A host action from [`ThemePanelContentProps::item_actions`] was
    /// pressed — `(theme_id, action_name)` (names are unique per row).
    pub on_row_action: Option<EventHandler<(String, String)>>,

    /// The panel asks its surface to close (theme applied or customize
    /// pressed; a popover host closes, an inline host ignores it).
    pub on_request_close: Option<EventHandler<()>>,

    /// Customize pressed while `external_customize` (Vue: `open-customize`).
    pub on_open_customize: Option<EventHandler<()>>,

    /// The dialog confirmed a scheme (Vue: `update:scheme` — applying it
    /// stays with the host).
    pub on_scheme_update: Option<EventHandler<CustomTheme>>,

    /// The dialog's desired open state (Vue: the internal ref writer).
    pub on_scheme_dialog_open_change: Option<EventHandler<bool>>,

    /// The dialog editor's picker-edit channel, forwarded.
    pub on_scheme_token_change: Option<EventHandler<SchemeTokenEdit>>,

    /// The dialog editor's mode channel, forwarded.
    pub on_scheme_mode_change: Option<EventHandler<SchemeMode>>,

    /// The dialog editor's name channel, forwarded.
    pub on_scheme_name_change: Option<EventHandler<String>>,

    /// The dialog editor's disclosure channel, forwarded.
    pub on_scheme_picker_open_change: Option<EventHandler<Option<SchemeEditKey>>>,
}

#[component]
pub fn ThemePanelContent(props: ThemePanelContentProps) -> Element {
    let is_auto = theme_panel_is_auto(props.current_mode);
    let altitude_text = format_solar_altitude(props.altitude_deg);
    let altitude_tip = theme_panel_auto_altitude_tip();
    let altitude_glyph = if theme_panel_altitude_night(props.effective_mode) {
        MdiIcon::MoonWaningCrescent
    } else {
        MdiIcon::WhiteBalanceSunny
    };

    // Bind the channel clones before the rsx tree (the props DSL moves
    // every field into it).
    let on_mode_change = props.on_mode_change.clone();
    let resolve_press = {
        let on_mode_change = props.on_mode_change.clone();
        let target = theme_panel_resolve_auto_target(props.effective_mode);
        move |_e: MouseEvent| {
            if let Some(handler) = on_mode_change.as_ref() {
                handler.call(target);
            }
        }
    };
    let customize_press = {
        let external = props.external_customize;
        let on_request_close = props.on_request_close.clone();
        let on_open_customize = props.on_open_customize.clone();
        let on_scheme_open = props.on_scheme_dialog_open_change.clone();
        move |_e: MouseEvent| {
            if external {
                // Vue's order: dismiss the surface, then hand over.
                if let Some(handler) = on_request_close.as_ref() {
                    handler.call(());
                }
                if let Some(handler) = on_open_customize.as_ref() {
                    handler.call(());
                }
            } else if let Some(handler) = on_scheme_open.as_ref() {
                handler.call(true);
            }
        }
    };

    let mode_extra = props.mode_extra.clone();
    let menu_extra = props.menu_extra.clone();

    let menu = rsx! {
        div {
            class: "s-theme-menu",
            div { class: "s-theme-menu-label",
                {t("components.hk.themePanelContent.mode", "Mode")}
            }
            div {
                class: "s-theme-mode-row",
                div {
                    class: "hk-tabs",
                    "data-variant": "segmented",
                    div {
                        class: "hk-tabs-list",
                        role: "radiogroup",
                        "aria-label": theme_panel_mode_switch_label(),
                        "data-block": "true",
                        "data-slots": "",
                        style: "--hk-tabs-units: 3",
                        div { class: "hk-tabs-indicator" },
                        for (idx, (mode, label)) in theme_panel_mode_options().iter().enumerate() {
                            {
                                // The merged run collapses Light/Dark into
                                // the altitude cell while auto is on; the
                                // system option always renders.
                                let collapsed = is_auto && *mode != ThemeMode::System;
                                if collapsed {
                                    empty_vnode()
                                } else {
                                    let active = props.current_mode == *mode;
                                    let tabindex = theme_panel_trigger_tabindex(active, idx, 0);
                                    let handler = {
                                        let on_mode_change = on_mode_change.clone();
                                        let pressed = *mode;
                                        move |_e: MouseEvent| {
                                            if let Some(handler) = on_mode_change.as_ref() {
                                                handler.call(pressed);
                                            }
                                        }
                                    };
                                    // No monitor glyph ships for the auto
                                    // option (see the header delta); the
                                    // manual sides carry sun/moon.
                                    let glyph = match mode {
                                        ThemeMode::System => None,
                                        ThemeMode::Light => Some(MdiIcon::WhiteBalanceSunny),
                                        ThemeMode::Dark => Some(MdiIcon::MoonWaningCrescent),
                                    };
                                    let label = label.clone();
                                    rsx! {
                                        button {
                                            class: "hk-tabs-trigger",
                                            "type": "button",
                                            role: "radio",
                                            "aria-checked": if active { "true" } else { "false" },
                                            tabindex: tabindex,
                                            onclick: handler,
                                            if let Some(icon) = glyph {
                                                span { class: "hk-tabs-trigger-icon",
                                                    Icon { icon: icon, size: 16 }
                                                }
                                            }
                                            span { "{label}" }
                                        }
                                    }
                                }
                            }
                        }
                        if is_auto {
                            div {
                                class: "hk-tabs-merged",
                                role: "presentation",
                                "data-keys": THEME_PANEL_MERGE_KEYS.join(" "),
                                style: "--hk-tabs-span: 2",
                                button {
                                    class: "s-theme-mode-autoalt",
                                    "type": "button",
                                    title: altitude_tip.clone(),
                                    "aria-label": altitude_tip.clone(),
                                    onclick: resolve_press,
                                    Icon { icon: altitude_glyph, size: 16 }
                                    span { class: "s-theme-mode-autoalt-value",
                                        "{altitude_text}"
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if let Some(extra) = mode_extra {
                div { class: "s-theme-mode-extra", {extra} }
            }
            // Vue: <HDivider spacing="md" /> — the mirrored Divider.
            Divider { spacing: DividerSpacing::Md }
            div { class: "s-theme-menu-label",
                {t("components.hk.themePanelContent.themes", "Themes")}
            }
            // The list band (Vue: div.s-theme-item-list[role="list"]) —
            // the rows' role=listitem anatomy needs the real list parent.
            div {
                class: "s-theme-item-list",
                role: "list",
                for theme in &props.themes {
                {
                    let active = props.current_theme == theme.id;
                    let custom = theme.is_custom;
                    let row_active = active.then_some("");
                    let row_custom = custom.then_some("");
                    let has_trailing = props.item_trailing.is_some();
                    let has_suffix = props.item_name_suffix.is_some();
                    let trailing_marker = has_trailing.then_some("slot");
                    let suffix_marker = has_suffix.then_some("slot");
                    let display_name = theme_panel_display_name(&theme.name);
                    let leading = props
                        .item_leading
                        .as_ref()
                        .map(|slot| slot.call(theme.into()));
                    let suffix = props
                        .item_name_suffix
                        .as_ref()
                        .map(|slot| slot.call(theme.into()));
                    let trailing = props
                        .item_trailing
                        .as_ref()
                        .map(|slot| slot.call(theme.into()));
                    let select_press = {
                        let on_select_theme = props.on_select_theme.clone();
                        let on_request_close = props.on_request_close.clone();
                        let id = theme.id.clone();
                        move |_e: MouseEvent| {
                            if let Some(handler) = on_select_theme.as_ref() {
                                handler.call(id.clone());
                            }
                            if let Some(handler) = on_request_close.as_ref() {
                                handler.call(());
                            }
                        }
                    };
                    let delete_title = t(
                        "components.hk.themePanelContent.deleteTheme",
                        "Delete theme",
                    );
                    // The row's option-control array (Vue grammar:
                    // itemActions prop wins; the trailing slot suppresses
                    // the built-in delete; fully default rows put the
                    // custom delete on the lane). BuiltinDelete carries
                    // the mirror's own delete channel; Host actions ride
                    // on_row_action with (theme_id, action_name).
                    let actions: Vec<RowActionSpec> =
                        if let Some(build) = props.item_actions.as_ref() {
                            build.call(theme.into())
                                .into_iter()
                                .map(|a| RowActionSpec::Host {
                                    name: a.name,
                                    danger: a.danger,
                                })
                                .collect()
                        } else if has_trailing {
                            Vec::new()
                        } else if custom {
                            vec![RowActionSpec::BuiltinDelete]
                        } else {
                            Vec::new()
                        };
                    // Vue: the whole row is the click target (HkListRow
                    // clickable), and clicks inside the trailing column /
                    // the action lane stop at their wrappers — an action
                    // button never double-fires the row's selection (the
                    // HkStatCard action-wrapper rule).
                    let stop_row_press = |e: MouseEvent| e.stop_propagation();
                    // The lane's dispatch is bound OUTSIDE the rsx tree
                    // (the same grammar as select_press): a for-body with
                    // closures/match inside the macro defeats the rsx
                    // parser, so the buttons render from plain tuples.
                    let lane: Vec<(String, bool, EventHandler<MouseEvent>)> = actions
                        .into_iter()
                        .map(|spec| match spec {
                            RowActionSpec::BuiltinDelete => {
                                let on_delete_theme = props.on_delete_theme.clone();
                                let id = theme.id.clone();
                                let press =
                                    EventHandler::new(move |_e: MouseEvent| {
                                        if let Some(handler) = on_delete_theme.as_ref() {
                                            handler.call(id.clone());
                                        }
                                    });
                                (delete_title.clone(), true, press)
                            }
                            RowActionSpec::Host { name, danger } => {
                                let on_row_action = props.on_row_action.clone();
                                let id = theme.id.clone();
                                let label = name.clone();
                                let label_for_press = label.clone();
                                let press = EventHandler::new(move |_e: MouseEvent| {
                                    if let Some(handler) = on_row_action.as_ref() {
                                        handler.call((id.clone(), label_for_press.clone()));
                                    }
                                });
                                (label, danger, press)
                            }
                        })
                        .collect();
                    // The lane pre-renders as an Option<Element>: this rsx
                    // dialect parses a for-in-body only at element-body
                    // top level — nested under an if arm it reads
                    // "expected ,".
                    let lane_render = if lane.is_empty() {
                        None
                    } else {
                        Some(rsx! {
                            div {
                                class: "hk-list-row-actions hk-list-row-actions--overlay",
                                role: "toolbar",
                                "aria-label": theme_panel_row_actions_label(),
                                onclick: stop_row_press,
                                // The mode strip's loop is the grammar
                                // shape: for-body = BLOCK with let
                                // bindings and a tail rsx! — tuple-index
                                // attribute expressions and bare element
                                // bodies both defeat this rsx parser.
                                for entry in lane.iter() {
                                    {
                                        let label = entry.0.clone();
                                        let danger = entry.1;
                                        let press = entry.2.clone();
                                        rsx! {
                                            button {
                                                class: "hk-list-row-actions__btn",
                                                "type": "button",
                                                "data-danger": danger.then_some(""),
                                                "aria-label": label.clone(),
                                                title: label.clone(),
                                                onclick: press,
                                            }
                                        }
                                    }
                                }
                            }
                        })
                    };
                    rsx! {
                        div {
                            class: "hk-list-row hk-list-row-clickable s-theme-item-row",
                            role: "listitem",
                            tabindex: 0,
                            "data-custom": row_custom,
                            "data-trailing": trailing_marker,
                            "data-name-suffix": suffix_marker,
                            "data-active": row_active,
                            "aria-current": active.then_some("true"),
                            onclick: select_press,
                            div {
                                class: "hk-list-row-main",
                                div {
                                    class: "s-theme-item-line",
                                    if let Some(lead) = leading {
                                        span { class: "hk-menu-item-icon s-theme-item-lead", {lead} }
                                    }
                                    span { class: "s-theme-item-name", "{display_name}" }
                                    if let Some(mark) = suffix {
                                        span { class: "s-theme-item-name-suffix", {mark} }
                                    }
                                }
                            }
                            if let Some(tail) = trailing {
                                div {
                                    class: "hk-list-row-trailing",
                                    onclick: stop_row_press,
                                    span { class: "s-theme-item-trailing", {tail} }
                                }
                            }
                            {lane_render.unwrap_or_else(empty_vnode)}
                        }
                    }
                }
                }
            }
            // The customize entry rides the standard HkAddTile compact
            // form (2026-11-11 family migration — same markup contract as
            // the Vue render: dashed tile below the list, Plus glyph,
            // hook class for host scopes).
            button {
                class: "hk-add-tile hk-add-tile--compact s-theme-item-customize",
                "type": "button",
                onclick: customize_press,
                Icon { icon: MdiIcon::Plus, size: 14 }
                {t("components.hk.themePanelContent.customize", "Customize")}
            }
        }
    };

    // Vue's root is a fragment: menu, then the optional menu-extra slot
    // wrapper, then the built-in dialog — no wrapper element.
    let mut roots = vec![menu];
    if let Some(extra) = menu_extra {
        roots.push(rsx! {
            div { class: "hk-menu-slot hk-menu-slot--extra", {extra} }
        });
    }
    if !props.external_customize {
        roots.push(rsx! {
            ColorSchemeDialog {
                open: props.scheme_dialog_open,
                mode: props.scheme_mode,
                dark: props.scheme_dark.clone(),
                light: props.scheme_light.clone(),
                theme_name: props.scheme_name.clone(),
                open_picker: props.scheme_open_picker,
                draft: props.scheme_draft.clone(),
                on_confirm: props.on_scheme_update.clone(),
                on_open_change: props.on_scheme_dialog_open_change.clone(),
                on_token_change: props.on_scheme_token_change.clone(),
                on_mode_change: props.on_scheme_mode_change.clone(),
                on_name_change: props.on_scheme_name_change.clone(),
                on_picker_open_change: props.on_scheme_picker_open_change.clone(),
                children: props.children.clone(),
            }
        });
    }
    VNode::Fragment(roots)
}

impl StyledComponent for ThemePanelContentComponent {
    fn styles() -> &'static str {
        // The tile's own compiled sheet (the customize entry is the
        // standard HkAddTile since 2026-11-11). The menu itself borrows
        // the sibling toggle's sheet — same convention as before; see the
        // file header.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAddTile.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "theme-panel-content"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn themes() -> Vec<ThemeListItem> {
        vec![
            ThemeListItem {
                id: "default".to_string(),
                name: "Default".to_string(),
                is_custom: false,
            },
            ThemeListItem {
                id: "custom-theme-1".to_string(),
                name: "Dusk".to_string(),
                is_custom: true,
            },
        ]
    }

    #[test]
    fn theme_panel_defaults_match_the_vue_props() {
        let props = ThemePanelContentProps::default();
        assert_eq!(props.current_mode, ThemeMode::System);
        assert_eq!(props.effective_mode, SchemeMode::Dark);
        assert_eq!(props.altitude_deg, 0.0);
        assert!(props.themes.is_empty());
        assert_eq!(props.current_theme, "");
        assert!(!props.external_customize);
        assert!(!props.scheme_dialog_open);
        assert_eq!(props.scheme_draft, CustomTheme::default());
        assert_eq!(props.scheme_mode, SchemeMode::Dark);
        assert!(props.mode_extra.is_none());
        assert!(props.item_leading.is_none());
        assert!(props.item_name_suffix.is_none());
        assert!(props.item_trailing.is_none());
        assert!(props.menu_extra.is_none());
        assert!(props.on_mode_change.is_none());
        assert!(props.on_select_theme.is_none());
        assert!(props.on_delete_theme.is_none());
        assert!(props.on_request_close.is_none());
        assert!(props.on_open_customize.is_none());
        assert!(props.on_scheme_update.is_none());
        assert!(props.on_scheme_dialog_open_change.is_none());
    }

    #[test]
    fn theme_panel_mode_union_matches_the_vue_keys() {
        for (mode, key, label) in [
            (ThemeMode::System, "system", "Auto"),
            (ThemeMode::Light, "light", "Light"),
            (ThemeMode::Dark, "dark", "Dark"),
        ] {
            assert_eq!(mode.key(), key);
            assert_eq!(mode.label(), label);
        }
        assert_eq!(
            theme_panel_mode_options()
                .into_iter()
                .map(|(mode, _)| mode.key())
                .collect::<Vec<_>>(),
            vec!["system", "light", "dark"]
        );
        assert_eq!(THEME_PANEL_MERGE_KEYS, ["light", "dark"]);
    }

    #[test]
    fn solar_altitude_formats_like_the_js_template() {
        assert_eq!(format_solar_altitude(32.52), "+32.5°");
        assert_eq!(format_solar_altitude(7.0), "+7.0°");
        assert_eq!(format_solar_altitude(0.0), "+0.0°");
        assert_eq!(format_solar_altitude(-3.25), "-3.2°"); // toFixed tie → larger n
        assert_eq!(format_solar_altitude(-3.26), "-3.3°");
        assert_eq!(format_solar_altitude(89.99), "+90.0°");
    }

    #[test]
    fn theme_panel_auto_predicates_match_the_vue_branches() {
        assert!(theme_panel_is_auto(ThemeMode::System));
        assert!(!theme_panel_is_auto(ThemeMode::Light));
        assert!(!theme_panel_is_auto(ThemeMode::Dark));

        assert!(!theme_panel_altitude_night(SchemeMode::Light));
        assert!(theme_panel_altitude_night(SchemeMode::Dark));

        // A press lands on the side auto resolves to.
        assert_eq!(
            theme_panel_resolve_auto_target(SchemeMode::Light),
            ThemeMode::Light
        );
        assert_eq!(
            theme_panel_resolve_auto_target(SchemeMode::Dark),
            ThemeMode::Dark
        );
    }

    #[test]
    fn theme_panel_display_name_resolves_keys_and_passes_literals() {
        // A literal name passes through unchanged.
        assert_eq!(theme_panel_display_name("Dusk"), "Dusk");
        // A name that is not a resolvable key ALSO passes through — Vue's
        // `t(th.name)` falls back to the raw string, and so does the
        // mirror (a provided locale resolves real message keys through
        // the same table).
        assert_eq!(
            theme_panel_display_name("some.unknown.message.key"),
            "some.unknown.message.key"
        );
    }

    #[test]
    fn theme_panel_roving_tabindex_matches_the_vue_rule() {
        assert_eq!(theme_panel_trigger_tabindex(true, 0, 0), 0);
        assert_eq!(theme_panel_trigger_tabindex(true, 2, 0), 0);
        // Inactive options stay arrow-reachable.
        assert_eq!(theme_panel_trigger_tabindex(false, 1, 0), -1);
        assert_eq!(theme_panel_trigger_tabindex(false, 2, 0), -1);
        // The fallback rung is tabbable when nothing is active.
        assert_eq!(theme_panel_trigger_tabindex(false, 0, 0), 0);
    }

    #[test]
    fn theme_panel_renders_the_vue_dom_contract() {
        let html = ThemePanelContent(ThemePanelContentProps {
            current_mode: ThemeMode::System,
            effective_mode: SchemeMode::Light,
            altitude_deg: 32.52,
            themes: themes(),
            current_theme: "default".to_string(),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="s-theme-menu""#), "{html}");
        assert!(html.contains(r#"class="s-theme-menu-label""#), "{html}");
        assert!(html.contains(">Mode<"), "{html}");
        assert!(html.contains(">Themes<"), "{html}");
        // The mode strip: segmented subset + the auto merged cell.
        assert!(html.contains(r#"data-variant="segmented""#), "{html}");
        assert!(html.contains(r#"role="radiogroup""#), "{html}");
        assert!(html.contains(r#"data-keys="light dark""#), "{html}");
        assert!(html.contains(r#"class="s-theme-mode-autoalt""#), "{html}");
        assert!(html.contains("+32.5°"), "{html}");
        assert!(
            html.contains(r#"class="s-theme-mode-autoalt-value""#),
            "{html}"
        );
        // Merged: no Light/Dark triggers while auto is on.
        assert_eq!(html.matches(r#"role="radio""#).count(), 1, "{html}");
        // The divider renders through the mirrored Divider (spacing md).
        assert!(
            html.contains(r#"class="hk-divider hk-divider-spacing-md""#),
            "{html}"
        );
        // Rows: the STANDARD list row (2026-11-13 — HkListRow anatomy,
        // list wrapper, name line, guarded lane with the delete). The
        // class list is emitted sorted, so the needles target whole
        // attribute values on their own.
        assert!(
            html.contains(r#"class="hk-list-row hk-list-row-clickable s-theme-item-row""#),
            "{html}"
        );
        assert!(html.contains(r#"role="listitem""#), "{html}");
        assert!(html.contains(r#"aria-current="true""#), "{html}");
        assert!(html.contains(r#"class="s-theme-item-list""#), "{html}");
        assert!(html.contains(r#"class="hk-list-row-main""#), "{html}");
        assert!(html.contains(r#"class="s-theme-item-line""#), "{html}");
        assert!(html.contains(r#"class="s-theme-item-name""#), "{html}");
        assert!(html.contains(r#"data-active="""#), "{html}");
        assert!(html.contains(r#"data-custom="""#), "{html}");
        // The built-in custom delete rides the standard lane (danger
        // button, aria + title carry the label).
        assert!(
            html.contains(r#"class="hk-list-row-actions hk-list-row-actions--overlay""#),
            "{html}"
        );
        assert!(html.contains(r#"role="toolbar""#), "{html}");
        assert!(
            html.contains(r#"class="hk-list-row-actions__btn""#),
            "{html}"
        );
        assert!(html.contains(r#"data-danger="""#), "{html}");
        assert!(html.contains(r#"aria-label="Delete theme""#), "{html}");
        assert!(html.contains(r#"title="Delete theme""#), "{html}");
        assert!(html.contains("Delete theme"), "{html}");
        // The retired pinned overlay button is gone for good.
        assert!(!html.contains("s-theme-item-delete"), "{html}");
        assert!(!html.contains("s-theme-item-btn"), "{html}");
        // The customize entry rides the standard add tile (compact form,
        // hook class intact — 2026-11-11 family migration).
        assert!(
            html.contains("hk-add-tile--compact s-theme-item-customize"),
            "{html}"
        );
        assert!(html.contains(">Customize<"), "{html}");
        // Both theme names resolved.
        assert!(html.contains(">Default<"), "{html}");
        assert!(html.contains(">Dusk<"), "{html}");
        // The built-in dialog rides along (externalCustomize false) but
        // renders nothing while closed.
        assert!(!html.contains("hk-modal-root"), "{html}");
    }

    #[test]
    fn theme_panel_manual_mode_renders_the_split_options() {
        let html = ThemePanelContent(ThemePanelContentProps {
            current_mode: ThemeMode::Dark,
            effective_mode: SchemeMode::Dark,
            themes: themes(),
            ..Default::default()
        })
        .render_to_html();
        // All three options render as triggers; no merged cell.
        assert_eq!(html.matches(r#"role="radio""#).count(), 3, "{html}");
        assert!(!html.contains("s-theme-mode-autoalt"), "{html}");
        assert!(!html.contains("hk-tabs-merged"), "{html}");
        // The dark option carries the checked state; sun/moon glyphs ride
        // the manual sides.
        assert!(html.contains(r#"aria-checked="true""#), "{html}");
        assert!(html.contains("hk-tabs-trigger-icon"), "{html}");
    }

    #[test]
    fn theme_panel_slot_markers_and_scoped_payloads() {
        let html = ThemePanelContent(ThemePanelContentProps {
            current_mode: ThemeMode::Light,
            themes: themes(),
            item_leading: Some(Callback::new(|scope: ThemeItemScope| {
                rsx! {
                    span { class: "lead-mark", {format!("lead:{}:", scope.id)} }
                }
            })),
            item_name_suffix: Some(Callback::new(|scope: ThemeItemScope| {
                rsx! {
                    span { class: "suffix-mark", {format!("suffix:{}", scope.name)} }
                }
            })),
            item_trailing: Some(Callback::new(|scope: ThemeItemScope| {
                let tail = if scope.is_custom { "custom" } else { "stock" };
                rsx! {
                    span { class: "tail-mark", {format!("tail:{tail}")} }
                }
            })),
            ..Default::default()
        })
        .render_to_html();

        // The slot markers Vue's sheet scopes on.
        assert!(html.contains(r#"data-trailing="slot""#), "{html}");
        assert!(html.contains(r#"data-name-suffix="slot""#), "{html}");
        // The scoped payloads reached every row.
        assert!(html.contains("lead:default:"), "{html}");
        assert!(html.contains("lead:custom-theme-1:"), "{html}");
        assert!(html.contains("suffix:Dusk"), "{html}");
        assert!(html.contains("tail:custom"), "{html}");
        assert!(html.contains("tail:stock"), "{html}");
        // The trailing slot suppresses the built-in delete lane.
        assert!(!html.contains("s-theme-item-delete"), "{html}");
        assert!(!html.contains("hk-list-row-actions"), "{html}");
        // Clicks inside the column stop at the wrapper (the guard is on
        // the trailing div — asserted structurally below by the walker
        // finding no row-level press when only the column is clicked).
        // The lead cell carries both hook classes.
        assert!(
            html.contains(r#"class="hk-menu-item-icon s-theme-item-lead""#),
            "{html}"
        );
    }

    #[test]
    fn theme_panel_host_actions_ride_the_lane_and_the_wire_channel() {
        // The itemActions builder (Vue: the itemActions callback prop)
        // wins over the built-in delete: the lane renders the host's
        // named actions with (theme_id, action_name) leaving through
        // on_row_action — names are the lane contract's identity.
        let seen = std::rc::Rc::new(std::cell::RefCell::new(Vec::<(String, String)>::new()));
        let sink = std::rc::Rc::clone(&seen);
        let node = ThemePanelContent(ThemePanelContentProps {
            themes: themes(),
            item_actions: Some(Callback::new(|scope: ThemeItemScope| {
                vec![ThemeRowAction {
                    name: format!("Inspect {}", scope.id),
                    danger: false,
                }]
            })),
            on_row_action: Some(EventHandler::new(move |pair: (String, String)| {
                sink.borrow_mut().push(pair);
            })),
            ..Default::default()
        });
        let html = node.clone().render_to_html();
        assert!(
            html.contains(r#"aria-label="Inspect custom-theme-1""#),
            "{html}"
        );
        // No danger flag on a non-danger host action.
        assert!(
            !html.contains("Inspect custom-theme-1\"></button><button"),
            "{html}"
        );

        fn click_inspect(node: &Element, fired: &mut bool) {
            match node {
                VNode::Element(el) => {
                    if el.tag == "button"
                        && el.class.to_string().contains("hk-list-row-actions__btn")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        *fired = true;
                        return;
                    }
                    for child in &el.children {
                        click_inspect(child, fired);
                        if *fired {
                            return;
                        }
                    }
                }
                VNode::Fragment(children) => {
                    for child in children {
                        click_inspect(child, fired);
                        if *fired {
                            return;
                        }
                    }
                }
                _ => {}
            }
        }
        let mut fired = false;
        click_inspect(&node, &mut fired);
        assert!(fired, "no lane button found");
        // The builder wins on EVERY row, so the walker's first lane
        // button belongs to the fixture's first row (default).
        assert_eq!(
            seen.borrow().as_slice(),
            [("default".to_string(), "Inspect default".to_string())].as_slice(),
            "the press carries (theme_id, action_name)"
        );
        // The custom row no longer carries the BUILT-IN delete: the
        // builder's array is the whole lane (precedence, not a merge).
        let html = node.render_to_html();
        assert!(!html.contains(r#"aria-label="Delete theme""#), "{html}");
    }

    #[test]
    fn theme_panel_select_fires_the_theme_then_the_close_request() {
        let seen = std::rc::Rc::new(std::cell::RefCell::new(Vec::<String>::new()));
        let closed = std::rc::Rc::new(std::cell::Cell::new(0usize));
        let sink = std::rc::Rc::clone(&seen);
        let close_sink = std::rc::Rc::clone(&closed);
        let node = ThemePanelContent(ThemePanelContentProps {
            themes: themes(),
            on_select_theme: Some(EventHandler::new(move |id: String| {
                sink.borrow_mut().push(id);
            })),
            on_request_close: Some(EventHandler::new(move |(): ()| {
                close_sink.set(close_sink.get() + 1);
            })),
            ..Default::default()
        });
        // Serialization drops handlers, so walk the tree and INVOKE the
        // first row's click listener — the row IS the click target since
        // the standard-row migration (HkListRow clickable).
        fn click_row_button(node: &Element, fired: &mut bool) {
            match node {
                VNode::Element(el) => {
                    let classes = el.class.to_string();
                    if el.tag == "div"
                        && classes.contains("s-theme-item-row")
                        && classes.contains("hk-list-row-clickable")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        *fired = true;
                        return;
                    }
                    for child in &el.children {
                        click_row_button(child, fired);
                        // A real user presses ONE button: stop after the
                        // first click so sibling rows stay un-fired.
                        if *fired {
                            return;
                        }
                    }
                }
                VNode::Fragment(children) => {
                    for child in children {
                        click_row_button(child, fired);
                        if *fired {
                            return;
                        }
                    }
                }
                _ => {}
            }
        }
        let mut fired = false;
        click_row_button(&node, &mut fired);
        assert!(fired, "no row button found");
        assert_eq!(seen.borrow().as_slice(), ["default"]);
        assert_eq!(closed.get(), 1, "select must ask the surface to close");
    }

    #[test]
    fn theme_panel_customize_paths_split_on_external() {
        fn click_customize(node: &Element, fired: &mut bool) {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("s-theme-item-customize")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        *fired = true;
                        return;
                    }
                    for child in &el.children {
                        click_customize(child, fired);
                    }
                }
                VNode::Fragment(children) => {
                    for child in children {
                        click_customize(child, fired);
                    }
                }
                _ => {}
            }
        }

        // Built-in: the press opens the dialog state.
        let opened = std::rc::Rc::new(std::cell::Cell::new(None));
        let sink = std::rc::Rc::clone(&opened);
        let node = ThemePanelContent(ThemePanelContentProps {
            on_scheme_dialog_open_change: Some(EventHandler::new(move |open: bool| {
                sink.set(Some(open));
            })),
            ..Default::default()
        });
        let mut fired = false;
        click_customize(&node, &mut fired);
        assert!(fired, "no customize entry found");
        assert_eq!(opened.get(), Some(true));

        // External: the press closes the surface FIRST, then hands over
        // (Vue's order); the built-in dialog is not even rendered.
        let order = std::rc::Rc::new(std::cell::RefCell::new(Vec::<&'static str>::new()));
        let external = || ThemePanelContentProps {
            external_customize: true,
            on_request_close: {
                let sink = std::rc::Rc::clone(&order);
                Some(EventHandler::new(move |(): ()| {
                    sink.borrow_mut().push("close");
                }))
            },
            on_open_customize: {
                let sink = std::rc::Rc::clone(&order);
                Some(EventHandler::new(move |(): ()| {
                    sink.borrow_mut().push("customize");
                }))
            },
            ..Default::default()
        };
        let html = ThemePanelContent(external()).render_to_html();
        assert!(!html.contains("s-scheme-dialog"), "{html}");
        let node = ThemePanelContent(external());
        let mut fired = false;
        click_customize(&node, &mut fired);
        assert!(fired);
        assert_eq!(
            order.borrow().as_slice(),
            ["close", "customize"],
            "Vue's order: request-close, then open-customize"
        );
    }

    #[test]
    fn theme_panel_menu_extra_wraps_in_the_vue_slot() {
        let html = ThemePanelContent(ThemePanelContentProps {
            menu_extra: Some(rsx! { span { "extra" } }),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"class="hk-menu-slot hk-menu-slot--extra""#),
            "{html}"
        );
        assert!(html.contains(">extra<"), "{html}");
    }

    #[test]
    fn theme_panel_sheet_is_exactly_the_add_tile_table() {
        // The menu borrows the sibling toggle sheet (see the file
        // header); the tile's own table is the ONLY sheet this component
        // ships since the customize entry became the standard HkAddTile
        // (2026-11-11).
        let css = <ThemePanelContentComponent as StyledComponent>::styles();
        assert!(css.contains(".hk-add-tile"), "{css}");
        assert!(css.contains(".hk-add-tile--compact"), "{css}");
        assert!(
            !css.contains(".s-theme-menu"),
            "the menu table is the toggle's to ship"
        );
        assert_eq!(
            <ThemePanelContentComponent as StyledComponent>::name(),
            "theme-panel-content"
        );
        // The borrowed menu sheet really is the sibling's table.
        let css = crate::theme::theme_toggle::ThemeToggleComponent::styles();
        assert!(css.contains(".s-theme-menu"), "{css}");
    }
}
