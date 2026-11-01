// packages/components/src/theme/color_scheme_editor.rs
// ColorSchemeEditor — mirror of the canonical Vue `HkColorSchemeEditor`
// (the editable body of the custom color scheme form).
//
// STYLESHEET: none of its own, and that is upstream's shape — the Vue
// component imports `./HkColorSchemeDialog.scss` for every `.s-scheme-*`
// rule and ships no sheet of its own. This mirror therefore borrows the
// SAME sheet its sibling compiles: [`crate::theme::color_scheme_dialog::
// ColorSchemeDialogComponent::styles`] already emits
// `src/styles/vue-mirror/components/HkColorSchemeDialog.scss`, and a second
// `styles()` here would duplicate the table (the registry path stays the
// wiring wave's call — see `styled.rs`).
//
// DOM contract (the branches Vue renders, one-to-one):
//
//   div.s-scheme-dialog
//     {Input}                                (`showName`; label/placeholder
//                                            from the i18n table)
//     div.hk-tabs.s-scheme-mode-switch [data-variant="segmented"]
//       div.hk-tabs-list [role="radiogroup"]
//         div.hk-tabs-indicator              (geometry-less: no DOM measure)
//         button.hk-tabs-trigger [role="radio"] [type="button"]
//           [aria-checked] [data-active] …   ×2 (dark, light)
//     p.s-scheme-mode-hint
//     div.s-scheme-colors
//       {ColorPicker} ×7                     (the accent tokens)
//     div.s-scheme-groups
//       div.s-scheme-groups-title
//       div.s-scheme-group-panels
//         div.s-scheme-group-grid
//           {ColorPicker} ×2                 (onSolidText / onSolidIcon)
//         {children}                         (host extension-group panels)
//
// The theme RUNTIME is host-owned (the wave ruling): `useTheme()` /
// `initTheme` / the token-group registry have no tairitsu analogues here,
// so the editor is CONTROLLED — the host holds the draft and feeds it
// back through `dark` / `light` / `theme_name` / `mode`, and every edit
// leaves through `on_token_change` / `on_name_change` / `on_mode_change`
// (zero `use_signal` / `use_state`, ledger L48). The colour math Vue
// computes in-component (`deriveSurface`, the seed resolution, the draft
// id clock) is extracted as the pure functions below so hosts reuse the
// exact derivation instead of re-deriving it.
//
// Deltas vs Vue (documented, not accidental):
//   * The draft is HOST-held. Vue keeps `reactive` dark/light tables and
//     `getDraft()` snapshots them; the mirror routes every picker edit
//     out through `on_token_change(SchemeTokenEdit)` and renders whatever
//     the host passes back, so `reset()` / `getDraft()` become the pure
//     helpers [`scheme_editor_reset`] / [`custom_theme_id`].
//   * The segmented mode switch is the HkTabs segmented DOM SUBSET
//     (`hk-tabs*` classes, `role=radiogroup`/`radio`): the HkTabs sheet is
//     not vendored yet, so the strip's chrome arrives with that mirror —
//     the classes are emitted exactly so the sheet lights up when it
//     lands. The sliding `hk-tabs-indicator` renders WITHOUT
//     `data-ready`: its geometry needs live DOM measure, which tairitsu
//     does not expose in this release.
//   * The extension token-group panels ride the `children` slot. Vue
//     renders one `HExpansionPanel` per registered group (number sliders,
//     enum tab strips, hue-clamped pickers); those primitives have no
//     mirrors yet, so the host renders its group panels itself — the
//     on-brand content grid (the section's FIRST group in Vue) stays the
//     editor's own, rendered flat (no expansion shell) with the same
//     `.s-scheme-group-grid` class.
//   * Picker disclosure is CONTROLLED and single-channel: Vue's
//     `HColorPicker` owns one open flag per picker (several could sit
//     open); the mirror takes `open_picker: Option<SchemeEditKey>` and
//     reports presses through `on_picker_open_change` — one disclosed
//     panel at a time is the practical contract the outside-click close
//     already enforces.
//   * `initialDark` / `initialLight` / `initialGroups` / `initialName`
//     prefill props become the LIVE `dark` / `light` / `groups` pass-
//     through and `theme_name`; the re-seed-on-open watch belongs to the
//     host that owns the open state (the dialog mirror documents the
//     same edge).
//   * Token channels stay f64. Vue's `deriveSurface` multiplies channels
//     without rounding (`p.r * 0.27` stays fractional all the way into
//     the cssvar text); the accent slots the pickers emit are integers,
//     and [`SchemeRgb::as_rgb8`] is the rounding boundary.

#![allow(clippy::type_complexity)]
#![allow(clippy::redundant_clone)]
use std::collections::BTreeMap;

use hikari_i18n::t;

use crate::basic::color_picker::{ColorPicker, ColorRgb};
use crate::basic::input::Input;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ColorSchemeEditorComponent;

/// One scheme token triplet. Channels are `f64` on purpose — Vue's
/// derivation keeps fractional channel values (see the header delta).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct SchemeRgb {
    pub r: f64,
    pub g: f64,
    pub b: f64,
}

impl SchemeRgb {
    pub const fn new(r: f64, g: f64, b: f64) -> Self {
        Self { r, g, b }
    }

    /// Integer channels (picker boundary / preset table).
    pub const fn rgb8(r: u8, g: u8, b: u8) -> Self {
        Self {
            r: r as f64,
            g: g as f64,
            b: b as f64,
        }
    }

    /// Round-and-clamp each channel into `u8` (the picker display value).
    pub fn as_rgb8(self) -> (u8, u8, u8) {
        fn ch(v: f64) -> u8 {
            let rounded = v.round();
            if rounded <= 0.0 {
                0
            } else if rounded >= 255.0 {
                255
            } else {
                rounded as u8
            }
        }
        (ch(self.r), ch(self.g), ch(self.b))
    }
}

/// The white the optional on-solid slots default to when a prefill omits
/// them (Vue: `WHITE`).
pub const SCHEME_WHITE: SchemeRgb = SchemeRgb::rgb8(255, 255, 255);

/// One scheme's full token table (Vue: `ThemeSchemeTokens`). The two
/// `on_solid_*` slots are `Option` because saved customs predate them.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SchemeTokens {
    pub primary: SchemeRgb,
    pub secondary: SchemeRgb,
    pub accent: SchemeRgb,
    pub text: SchemeRgb,
    pub muted: SchemeRgb,
    pub border: SchemeRgb,
    pub focused_border: SchemeRgb,
    pub background: SchemeRgb,
    pub surface: SchemeRgb,
    pub selected_background: SchemeRgb,
    pub selected_text: SchemeRgb,
    pub status_bar_background: SchemeRgb,
    pub success: SchemeRgb,
    pub error: SchemeRgb,
    pub warning: SchemeRgb,
    pub info: SchemeRgb,
    pub on_solid_text: Option<SchemeRgb>,
    pub on_solid_icon: Option<SchemeRgb>,
}

/// One extension token-group slot value (Vue: `ThemeTokenValue`).
#[derive(Clone, PartialEq, Debug)]
pub enum SchemeTokenValue {
    Rgb(SchemeRgb),
    Number(f64),
    Text(String),
}

/// Group values keyed by group id then slot key (Vue:
/// `ThemeTokenGroupValues`); `BTreeMap` keeps drafts deterministic.
pub type SchemeTokenGroupValues = BTreeMap<String, BTreeMap<String, SchemeTokenValue>>;

/// Per-mode group values (Vue: `ThemeTokenGroupModes`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SchemeTokenGroupModes {
    pub dark: Option<SchemeTokenGroupValues>,
    pub light: Option<SchemeTokenGroupValues>,
}

/// A registrable preset row (Vue: `ThemePreset` / `CustomThemePreset`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SchemePreset {
    pub id: String,
    /// Literal or message-key display name (resolved through `t()`).
    pub name: String,
    pub dark: SchemeTokens,
    pub light: SchemeTokens,
    pub groups: Option<SchemeTokenGroupModes>,
}

/// The custom scheme payload a draft snapshots to (Vue: `HCustomTheme`,
/// structurally hikari's `CustomThemePreset`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct CustomTheme {
    pub id: String,
    pub name: String,
    pub dark: SchemeTokens,
    pub light: SchemeTokens,
    pub groups: Option<SchemeTokenGroupModes>,
}

/// Which palette the editor is editing (Vue: `modeTab`, default `"dark"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum SchemeMode {
    #[default]
    Dark,
    Light,
}

impl SchemeMode {
    /// The tab key exactly as Vue spells it.
    pub fn key(self) -> &'static str {
        match self {
            SchemeMode::Dark => "dark",
            SchemeMode::Light => "light",
        }
    }

    /// The localized tab label (Vue: `hikari::theme.modeDark` / `modeLight`).
    pub fn label(self) -> String {
        match self {
            SchemeMode::Dark => t("components.hk.colorSchemeEditor.modeDark", "Dark"),
            SchemeMode::Light => t("components.hk.colorSchemeEditor.modeLight", "Light"),
        }
    }
}

/// The editable token slots: the seven accents plus the two on-solid
/// content colors. The nine derived surface slots are NOT editable (see
/// [`derive_scheme_surface`]).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SchemeEditKey {
    Primary,
    Secondary,
    Accent,
    Success,
    Error,
    Warning,
    Info,
    OnSolidText,
    OnSolidIcon,
}

impl SchemeEditKey {
    /// The slot key exactly as Vue spells it (`hikari::theme.tokens.<k>`).
    pub fn key(self) -> &'static str {
        match self {
            SchemeEditKey::Primary => "primary",
            SchemeEditKey::Secondary => "secondary",
            SchemeEditKey::Accent => "accent",
            SchemeEditKey::Success => "success",
            SchemeEditKey::Error => "error",
            SchemeEditKey::Warning => "warning",
            SchemeEditKey::Info => "info",
            SchemeEditKey::OnSolidText => "onSolidText",
            SchemeEditKey::OnSolidIcon => "onSolidIcon",
        }
    }

    /// The localized picker label (Vue: `t(\`hikari::theme.tokens.${key}\`)`).
    pub fn label(self) -> String {
        match self {
            SchemeEditKey::Primary => t("components.hk.colorSchemeEditor.token.primary", "Primary"),
            SchemeEditKey::Secondary => t(
                "components.hk.colorSchemeEditor.token.secondary",
                "Secondary",
            ),
            SchemeEditKey::Accent => t("components.hk.colorSchemeEditor.token.accent", "Accent"),
            SchemeEditKey::Success => t("components.hk.colorSchemeEditor.token.success", "Success"),
            SchemeEditKey::Error => t("components.hk.colorSchemeEditor.token.error", "Error"),
            SchemeEditKey::Warning => t("components.hk.colorSchemeEditor.token.warning", "Warning"),
            SchemeEditKey::Info => t("components.hk.colorSchemeEditor.token.info", "Info"),
            SchemeEditKey::OnSolidText => t(
                "components.hk.colorSchemeEditor.token.onSolidText",
                "Text on brand",
            ),
            SchemeEditKey::OnSolidIcon => t(
                "components.hk.colorSchemeEditor.token.onSolidIcon",
                "Icons on brand",
            ),
        }
    }
}

/// The seven accent slots in Vue's `editableTokens` order.
pub const SCHEME_ACCENT_KEYS: [SchemeEditKey; 7] = [
    SchemeEditKey::Primary,
    SchemeEditKey::Secondary,
    SchemeEditKey::Accent,
    SchemeEditKey::Success,
    SchemeEditKey::Error,
    SchemeEditKey::Warning,
    SchemeEditKey::Info,
];

/// The two on-solid content slots (Vue's `contentTokens`).
pub const SCHEME_ON_SOLID_KEYS: [SchemeEditKey; 2] =
    [SchemeEditKey::OnSolidText, SchemeEditKey::OnSolidIcon];

/// Read one editable slot (on-solid slots default to white, exactly the
/// `currentTokens.value[key] ?? WHITE` render gate).
pub fn scheme_tokens_get(tokens: &SchemeTokens, key: SchemeEditKey) -> SchemeRgb {
    match key {
        SchemeEditKey::Primary => tokens.primary,
        SchemeEditKey::Secondary => tokens.secondary,
        SchemeEditKey::Accent => tokens.accent,
        SchemeEditKey::Success => tokens.success,
        SchemeEditKey::Error => tokens.error,
        SchemeEditKey::Warning => tokens.warning,
        SchemeEditKey::Info => tokens.info,
        SchemeEditKey::OnSolidText => tokens.on_solid_text.unwrap_or(SCHEME_WHITE),
        SchemeEditKey::OnSolidIcon => tokens.on_solid_icon.unwrap_or(SCHEME_WHITE),
    }
}

/// Write one editable slot, returning the updated table.
pub fn scheme_tokens_set(
    tokens: &SchemeTokens,
    key: SchemeEditKey,
    rgb: SchemeRgb,
) -> SchemeTokens {
    let mut next = tokens.clone();
    match key {
        SchemeEditKey::Primary => next.primary = rgb,
        SchemeEditKey::Secondary => next.secondary = rgb,
        SchemeEditKey::Accent => next.accent = rgb,
        SchemeEditKey::Success => next.success = rgb,
        SchemeEditKey::Error => next.error = rgb,
        SchemeEditKey::Warning => next.warning = rgb,
        SchemeEditKey::Info => next.info = rgb,
        SchemeEditKey::OnSolidText => next.on_solid_text = Some(rgb),
        SchemeEditKey::OnSolidIcon => next.on_solid_icon = Some(rgb),
    }
    next
}

/// Vue's channel clamp: `Math.max(0, Math.min(255, v))`.
pub fn clamp_scheme_channel(value: f64) -> f64 {
    value.clamp(0.0, 255.0)
}

/// The surface derivation (Vue: `deriveSurface`) — the nine derived slots
/// recomputed from the accent table for one mode. Channels stay fractional
/// exactly like the JS product (`p.r * 0.27` is never rounded upstream).
pub fn derive_scheme_surface(tokens: &SchemeTokens, dark: bool) -> SchemeTokens {
    let p = tokens.primary;
    let base = if dark { 14.0 } else { 245.0 };
    let text = if dark {
        SchemeRgb::new(228.0, 228.0, 231.0)
    } else {
        SchemeRgb::new(30.0, 30.0, 30.0)
    };
    let muted = if dark {
        SchemeRgb::new(180.0, 180.0, 180.0)
    } else {
        SchemeRgb::new(80.0, 80.0, 80.0)
    };
    let border = if dark {
        SchemeRgb::new(255.0, 255.0, 255.0)
    } else {
        SchemeRgb::new(0.0, 0.0, 0.0)
    };
    let selected_text = if dark {
        SchemeRgb::new(240.0, 240.0, 240.0)
    } else {
        SchemeRgb::new(40.0, 40.0, 45.0)
    };
    let db = if dark { 1.0 } else { -1.0 };
    SchemeTokens {
        primary: p,
        secondary: tokens.secondary,
        accent: tokens.accent,
        text,
        muted,
        border,
        focused_border: p,
        background: SchemeRgb::new(
            clamp_scheme_channel(base),
            clamp_scheme_channel(base),
            clamp_scheme_channel(base + db * if dark { 16.0 } else { 5.0 }),
        ),
        surface: SchemeRgb::new(
            clamp_scheme_channel(base + 10.0),
            clamp_scheme_channel(base + 10.0),
            clamp_scheme_channel(base + if dark { 18.0 } else { 5.0 }),
        ),
        selected_background: SchemeRgb::new(
            clamp_scheme_channel(p.r * 0.27),
            clamp_scheme_channel(p.g * 0.27),
            clamp_scheme_channel(p.b * 0.35),
        ),
        selected_text,
        status_bar_background: SchemeRgb::new(
            // Vue: `base + (isDark ? 10 : -15)` on r/g, `+ (isDark ? 18 : -5)`
            // on b — the LIGHT branch subtracts (an earlier mirror draft
            // wrote db*10/+5, which drifts light to 235/250).
            clamp_scheme_channel(base + if dark { 10.0 } else { -15.0 }),
            clamp_scheme_channel(base + if dark { 10.0 } else { -15.0 }),
            clamp_scheme_channel(base + if dark { 18.0 } else { -5.0 }),
        ),
        success: tokens.success,
        error: tokens.error,
        warning: tokens.warning,
        info: tokens.info,
        on_solid_text: tokens.on_solid_text,
        on_solid_icon: tokens.on_solid_icon,
    }
}

/// The shipped default preset, verbatim from `presets.ts` (dark = the
/// retired Nord entry, light = the retired synthwave '84 entry) — kept
/// reachable by name so a consumer that clears the stock table still has
/// a seed (Vue: `stockDefaultPreset`).
pub fn stock_default_preset() -> SchemePreset {
    let dark = SchemeTokens {
        primary: SchemeRgb::rgb8(136, 192, 208),
        secondary: SchemeRgb::rgb8(143, 188, 187),
        accent: SchemeRgb::rgb8(94, 129, 172),
        text: SchemeRgb::rgb8(247, 249, 252),
        muted: SchemeRgb::rgb8(180, 180, 180),
        border: SchemeRgb::rgb8(128, 128, 128),
        focused_border: SchemeRgb::rgb8(136, 192, 208),
        background: SchemeRgb::rgb8(22, 27, 38),
        surface: SchemeRgb::rgb8(34, 40, 54),
        selected_background: SchemeRgb::rgb8(70, 70, 85),
        selected_text: SchemeRgb::rgb8(248, 248, 250),
        status_bar_background: SchemeRgb::rgb8(34, 40, 54),
        success: SchemeRgb::rgb8(163, 190, 140),
        error: SchemeRgb::rgb8(191, 97, 106),
        warning: SchemeRgb::rgb8(208, 135, 112),
        info: SchemeRgb::rgb8(136, 192, 208),
        // The pale primary puts dark ink on solid fills (white is ~1.9:1).
        on_solid_text: Some(SchemeRgb::rgb8(46, 52, 64)),
        on_solid_icon: Some(SchemeRgb::rgb8(46, 52, 64)),
    };
    let light = SchemeTokens {
        primary: SchemeRgb::rgb8(214, 51, 132),
        secondary: SchemeRgb::rgb8(156, 106, 222),
        accent: SchemeRgb::rgb8(230, 167, 0),
        text: SchemeRgb::rgb8(30, 30, 30),
        muted: SchemeRgb::rgb8(80, 80, 80),
        border: SchemeRgb::rgb8(128, 128, 128),
        focused_border: SchemeRgb::rgb8(214, 51, 132),
        background: SchemeRgb::rgb8(245, 245, 240),
        surface: SchemeRgb::rgb8(255, 255, 255),
        selected_background: SchemeRgb::rgb8(200, 200, 205),
        selected_text: SchemeRgb::rgb8(40, 40, 45),
        status_bar_background: SchemeRgb::rgb8(230, 230, 225),
        success: SchemeRgb::rgb8(16, 185, 129),
        error: SchemeRgb::rgb8(239, 68, 68),
        warning: SchemeRgb::rgb8(245, 158, 11),
        info: SchemeRgb::rgb8(6, 182, 212),
        on_solid_text: Some(SCHEME_WHITE),
        on_solid_icon: Some(SCHEME_WHITE),
    };
    SchemePreset {
        id: "default".to_string(),
        name: "Default".to_string(),
        dark,
        light,
        groups: None,
    }
}

/// The seed resolution (Vue: `seedScheme`) — the table is CONSUMER-OWNED,
/// so `default` is not guaranteed: the stock entry, then whatever the
/// consumer registered, then the shipped palette.
pub fn seed_scheme(mode: SchemeMode, presets: &[SchemePreset]) -> SchemeTokens {
    let preset = presets
        .iter()
        .find(|preset| preset.id == "default")
        .or_else(|| presets.first())
        .cloned()
        .unwrap_or_else(stock_default_preset);
    match mode {
        SchemeMode::Dark => preset.dark,
        SchemeMode::Light => preset.light,
    }
}

/// The editor's re-seed (Vue: `reset`) — prefill ?? seed, with the two
/// optional on-solid slots defaulting to WHITE even when the seed carries
/// values (Vue overwrites them through `initialDark?.[k] ?? WHITE`).
pub fn scheme_editor_reset(
    mode: SchemeMode,
    initial: Option<&SchemeTokens>,
    presets: &[SchemePreset],
) -> SchemeTokens {
    let mut tokens = initial
        .cloned()
        .unwrap_or_else(|| seed_scheme(mode, presets));
    tokens.on_solid_text = initial
        .and_then(|tokens| tokens.on_solid_text)
        .or(Some(SCHEME_WHITE));
    tokens.on_solid_icon = initial
        .and_then(|tokens| tokens.on_solid_icon)
        .or(Some(SCHEME_WHITE));
    tokens
}

/// The draft id (Vue: `` `custom-theme-${Date.now()}` ``); the host owns
/// the clock, the spelling stays the mirror's.
pub fn custom_theme_id(now_ms: u64) -> String {
    format!("custom-theme-{now_ms}")
}

/// The draft name gate (Vue: `themeName || t(customThemeName)`).
pub fn custom_theme_name(name: &str) -> String {
    if name.is_empty() {
        t(
            "components.hk.colorSchemeEditor.customThemeName",
            "Custom theme",
        )
    } else {
        name.to_string()
    }
}

/// The palette count caption (Vue: `countLabel`) — `{count}` replaced
/// literally, no pluralization upstream.
pub fn scheme_group_count_label(count: usize) -> String {
    t(
        "components.hk.colorSchemeEditor.groupCount",
        "{count} colors",
    )
    .replace("{count}", &count.to_string())
}

/// The tabs' own accessible label (Vue leaves the editor's strip unnamed;
/// kept as a pure seam so hosts can name it without a string fork).
pub fn scheme_mode_switch_aria_label() -> String {
    t(
        "components.hk.colorSchemeEditor.modeSwitchLabel",
        "Editing palette",
    )
}

#[derive(Clone, PartialEq, Debug)]
pub struct SchemeTokenEdit {
    pub mode: SchemeMode,
    pub key: SchemeEditKey,
    pub rgb: SchemeRgb,
}

#[define_props]
pub struct ColorSchemeEditorProps {
    /// Which palette the editor edits (Vue: `modeTab`, default dark) —
    /// controlled; see the header delta.
    #[default]
    pub mode: SchemeMode,

    /// The live dark draft (host-held).
    #[default(SchemeTokens::default())]
    pub dark: SchemeTokens,

    /// The live light draft (host-held).
    #[default(SchemeTokens::default())]
    pub light: SchemeTokens,

    /// The scheme name field value (Vue: `initialName` seeded `themeName`).
    #[default]
    pub theme_name: String,

    /// Render the built-in name input (Vue: `showName`, default true).
    #[default(true)]
    pub show_name: bool,

    /// The currently disclosed picker (single-channel disclosure; see the
    /// header delta). `None` = all closed.
    pub open_picker: Option<SchemeEditKey>,

    /// Every picker edit (accent and on-solid alike).
    pub on_token_change: Option<EventHandler<SchemeTokenEdit>>,

    /// Mode tab press (Vue: `update:modelValue` on the segmented strip).
    pub on_mode_change: Option<EventHandler<SchemeMode>>,

    /// Name field input (Vue: `update:modelValue` on `HInput`).
    pub on_name_change: Option<EventHandler<String>>,

    /// Picker disclosure press (the trigger toggling a panel).
    pub on_picker_open_change: Option<EventHandler<Option<SchemeEditKey>>>,

    /// Host extension-group panels, rendered after the on-solid grid
    /// (Vue: one expansion panel per registered token group).
    pub children: Element,
}

#[component]
pub fn ColorSchemeEditor(props: ColorSchemeEditorProps) -> Element {
    let current = match props.mode {
        SchemeMode::Dark => &props.dark,
        SchemeMode::Light => &props.light,
    };

    let mode_change = props.on_mode_change.clone();
    let picker_toggle = props.on_picker_open_change.clone();
    let token_change = props.on_token_change.clone();
    let name_change = props.on_name_change.clone();

    let mode = props.mode;

    // Both picker grids are PREBUILT as `Vec<VNode>` locals and mounted as
    // one fragment each (Vue's v-for order = the constant arrays): the rsx
    // macro takes no nested `rsx!` inside a mount expression, so the maps
    // live outside the tree and the mounts stay single-expression.
    let swatch_nodes: Vec<VNode> = SCHEME_ACCENT_KEYS
        .iter()
        .map(|key| {
            let key = *key;
            let rgb = scheme_tokens_get(current, key);
            let (r, g, b) = rgb.as_rgb8();
            let label = key.label();
            let on_change = {
                let token_change = token_change.clone();
                Some(EventHandler::new(move |next: ColorRgb| {
                    if let Some(handler) = token_change.as_ref() {
                        handler.call(SchemeTokenEdit {
                            mode,
                            key,
                            rgb: SchemeRgb::rgb8(next.r, next.g, next.b),
                        });
                    }
                }))
            };
            let on_open = {
                let picker_toggle = picker_toggle.clone();
                Some(EventHandler::new(move |open: bool| {
                    if let Some(handler) = picker_toggle.as_ref() {
                        handler.call(open.then_some(key));
                    }
                }))
            };
            rsx! {
                ColorPicker {
                    r: r,
                    g: g,
                    b: b,
                    label: label,
                    open: props.open_picker == Some(key),
                    on_open_change: on_open,
                    on_change: on_change,
                }
            }
        })
        .collect();

    let on_solid_nodes: Vec<VNode> = SCHEME_ON_SOLID_KEYS
        .iter()
        .map(|key| {
            let key = *key;
            let rgb = scheme_tokens_get(current, key);
            let (r, g, b) = rgb.as_rgb8();
            let label = key.label();
            let on_change = {
                let token_change = token_change.clone();
                Some(EventHandler::new(move |next: ColorRgb| {
                    if let Some(handler) = token_change.as_ref() {
                        handler.call(SchemeTokenEdit {
                            mode,
                            key,
                            rgb: SchemeRgb::rgb8(next.r, next.g, next.b),
                        });
                    }
                }))
            };
            let on_open = {
                let picker_toggle = picker_toggle.clone();
                Some(EventHandler::new(move |open: bool| {
                    if let Some(handler) = picker_toggle.as_ref() {
                        handler.call(open.then_some(key));
                    }
                }))
            };
            rsx! {
                ColorPicker {
                    r: r,
                    g: g,
                    b: b,
                    label: label,
                    open: props.open_picker == Some(key),
                    on_open_change: on_open,
                    on_change: on_change,
                }
            }
        })
        .collect();

    rsx! {
        div {
            class: "s-scheme-dialog",
            if props.show_name {
                Input {
                    model_value: props.theme_name.clone(),
                    label: Some(t(
                        "components.hk.colorSchemeEditor.themeName",
                        "Theme name"
                    )),
                    placeholder: Some(t(
                        "components.hk.colorSchemeEditor.customThemeName",
                        "Custom theme"
                    )),
                    oninput: name_change,
                }
            }
            div {
                class: "hk-tabs s-scheme-mode-switch",
                "data-variant": "segmented",
                div {
                    class: "hk-tabs-list",
                    role: "radiogroup",
                    "aria-label": scheme_mode_switch_aria_label(),
                    div { class: "hk-tabs-indicator" },
                    for (idx, tab) in [SchemeMode::Dark, SchemeMode::Light].iter().enumerate() {
                        {
                            let active = *tab == mode;
                            // Roving tabindex (Vue: the active trigger joins
                            // the page tab sequence, the first stays the
                            // fallback) — no live measure involved. Plain
                            // `i32` 0/-1 like `theme_panel_content` (the
                            // native attr takes no `Option`).
                            let tabindex: i32 = if active || idx == 0 { 0 } else { -1 };
                            let handler = {
                                let mode_change = mode_change.clone();
                                let pressed = *tab;
                                move |_e: MouseEvent| {
                                    if let Some(handler) = mode_change.as_ref() {
                                        handler.call(pressed);
                                    }
                                }
                            };
                            let label = tab.label();
                            rsx! {
                                button {
                                    class: "hk-tabs-trigger",
                                    "type": "button",
                                    role: "radio",
                                    "aria-checked": if active { "true" } else { "false" },
                                    tabindex: tabindex,
                                    onclick: handler,
                                    span { "{label}" }
                                }
                            }
                        }
                    }
                }
            }
            p { class: "s-scheme-mode-hint",
                {t(
                    "components.hk.colorSchemeEditor.modeHint",
                    "These tabs pick the palette you edit; the applied mode lives in the theme panel."
                )}
            }
            div {
                class: "s-scheme-colors",
                {VNode::Fragment(swatch_nodes)}
            }
            div {
                class: "s-scheme-groups",
                div { class: "s-scheme-groups-title",
                    {t("components.hk.colorSchemeEditor.extendedColors", "Extended colors")}
                }
                div {
                    class: "s-scheme-group-panels",
                    div {
                        class: "s-scheme-group-grid",
                        {VNode::Fragment(on_solid_nodes)}
                    }
                    {props.children.clone()}
                }
            }
        }
    }
}

impl StyledComponent for ColorSchemeEditorComponent {
    fn styles() -> &'static str {
        // No sheet of its own — the sibling dialog compiles the borrowed
        // `HkColorSchemeDialog.scss` (see the file header). An empty table,
        // not an error; same convention as `layout::admin_table_page`.
        ""
    }

    fn name() -> &'static str {
        "color-scheme-editor"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scheme_editor_defaults_match_the_vue_props() {
        let props = ColorSchemeEditorProps::default();
        assert_eq!(props.mode, SchemeMode::Dark);
        assert_eq!(props.dark, SchemeTokens::default());
        assert_eq!(props.light, SchemeTokens::default());
        assert_eq!(props.theme_name, "");
        assert!(props.show_name);
        assert!(props.open_picker.is_none());
        assert!(props.on_token_change.is_none());
        assert!(props.on_mode_change.is_none());
        assert!(props.on_name_change.is_none());
        assert!(props.on_picker_open_change.is_none());
    }

    #[test]
    fn scheme_mode_and_keys_spell_like_vue() {
        assert_eq!(SchemeMode::Dark.key(), "dark");
        assert_eq!(SchemeMode::Light.key(), "light");
        for (key, name) in [
            (SchemeEditKey::Primary, "primary"),
            (SchemeEditKey::Secondary, "secondary"),
            (SchemeEditKey::Accent, "accent"),
            (SchemeEditKey::Success, "success"),
            (SchemeEditKey::Error, "error"),
            (SchemeEditKey::Warning, "warning"),
            (SchemeEditKey::Info, "info"),
            (SchemeEditKey::OnSolidText, "onSolidText"),
            (SchemeEditKey::OnSolidIcon, "onSolidIcon"),
        ] {
            assert_eq!(key.key(), name);
            assert!(!key.label().is_empty(), "{name} needs a label");
        }
        // The accent order is Vue's editableTokens order.
        assert_eq!(
            SCHEME_ACCENT_KEYS.map(|key| key.key()),
            [
                "primary",
                "secondary",
                "accent",
                "success",
                "error",
                "warning",
                "info"
            ]
        );
    }

    #[test]
    fn scheme_channel_clamp_matches_the_js_min_max() {
        assert_eq!(clamp_scheme_channel(-12.0), 0.0);
        assert_eq!(clamp_scheme_channel(0.0), 0.0);
        assert_eq!(clamp_scheme_channel(128.5), 128.5);
        assert_eq!(clamp_scheme_channel(255.0), 255.0);
        assert_eq!(clamp_scheme_channel(300.0), 255.0);
    }

    #[test]
    fn scheme_rgb8_rounds_and_clamps_at_the_picker_boundary() {
        assert_eq!(SchemeRgb::rgb8(136, 192, 208).as_rgb8(), (136, 192, 208));
        assert_eq!(SchemeRgb::new(36.72, 0.0, 255.0).as_rgb8(), (37, 0, 255));
        assert_eq!(SchemeRgb::new(-3.0, 300.0, 127.4).as_rgb8(), (0, 255, 127));
    }

    #[test]
    fn derive_scheme_surface_matches_the_vue_table() {
        let dark = derive_scheme_surface(&stock_default_preset().dark, true);
        assert_eq!(dark.background, SchemeRgb::new(14.0, 14.0, 30.0));
        assert_eq!(dark.surface, SchemeRgb::new(24.0, 24.0, 32.0));
        assert_eq!(dark.text, SchemeRgb::new(228.0, 228.0, 231.0));
        assert_eq!(dark.muted, SchemeRgb::new(180.0, 180.0, 180.0));
        assert_eq!(dark.border, SchemeRgb::new(255.0, 255.0, 255.0));
        assert_eq!(dark.focused_border, SchemeRgb::rgb8(136, 192, 208));
        // The selected wash keeps Vue's fractional channels unrounded.
        let expected = SchemeRgb::new(136.0 * 0.27, 192.0 * 0.27, 208.0 * 0.35);
        assert_eq!(dark.selected_background, expected);
        assert_eq!(dark.selected_text, SchemeRgb::new(240.0, 240.0, 240.0));
        assert_eq!(dark.status_bar_background, SchemeRgb::new(24.0, 24.0, 32.0));
        // The accent table passes through untouched.
        assert_eq!(dark.primary, SchemeRgb::rgb8(136, 192, 208));
        assert_eq!(dark.error, SchemeRgb::rgb8(191, 97, 106));

        let light = derive_scheme_surface(&stock_default_preset().light, false);
        assert_eq!(light.background, SchemeRgb::new(245.0, 245.0, 240.0));
        assert_eq!(light.surface, SchemeRgb::new(255.0, 255.0, 250.0));
        assert_eq!(light.text, SchemeRgb::new(30.0, 30.0, 30.0));
        assert_eq!(light.muted, SchemeRgb::new(80.0, 80.0, 80.0));
        assert_eq!(light.border, SchemeRgb::new(0.0, 0.0, 0.0));
        assert_eq!(light.selected_text, SchemeRgb::new(40.0, 40.0, 45.0));
        assert_eq!(
            light.status_bar_background,
            SchemeRgb::new(230.0, 230.0, 240.0)
        );
    }

    #[test]
    fn seed_scheme_resolves_stock_then_consumer_then_shipped() {
        // No table at all: the shipped palette answers.
        assert_eq!(
            seed_scheme(SchemeMode::Dark, &[]),
            stock_default_preset().dark
        );
        // A consumer that cleared the stock keys: its first registration
        // is the seed (chest's brand line).
        let brand = SchemePreset {
            id: "brand".to_string(),
            name: "Brand".to_string(),
            dark: SchemeTokens {
                primary: SchemeRgb::rgb8(1, 2, 3),
                ..Default::default()
            },
            light: SchemeTokens::default(),
            groups: None,
        };
        assert_eq!(
            seed_scheme(SchemeMode::Dark, std::slice::from_ref(&brand)).primary,
            SchemeRgb::rgb8(1, 2, 3)
        );
        // A live `default` key beats the first entry (seed_scheme already
        // selects the mode's table — stock light).
        assert_eq!(
            seed_scheme(SchemeMode::Light, &[brand, stock_default_preset()]),
            stock_default_preset().light
        );
    }

    #[test]
    fn scheme_editor_reset_defaults_the_on_solid_slots_to_white() {
        // No prefill: even though the STOCK dark seed carries dark ink on
        // solid fills, Vue's reset overwrites both slots with WHITE.
        let reset = scheme_editor_reset(SchemeMode::Dark, None, &[]);
        assert_eq!(reset.on_solid_text, Some(SCHEME_WHITE));
        assert_eq!(reset.on_solid_icon, Some(SCHEME_WHITE));
        // A prefill that HAS the slots keeps them.
        let mut prefill = stock_default_preset().dark;
        prefill.on_solid_text = Some(SchemeRgb::rgb8(46, 52, 64));
        let reset = scheme_editor_reset(SchemeMode::Dark, Some(&prefill), &[]);
        assert_eq!(reset.on_solid_text, Some(SchemeRgb::rgb8(46, 52, 64)));
        // A legacy prefill WITHOUT them lands on white too.
        let mut legacy = prefill;
        legacy.on_solid_text = None;
        legacy.on_solid_icon = None;
        let reset = scheme_editor_reset(SchemeMode::Light, Some(&legacy), &[]);
        assert_eq!(reset.on_solid_text, Some(SCHEME_WHITE));
        assert_eq!(reset.on_solid_icon, Some(SCHEME_WHITE));
    }

    #[test]
    fn scheme_token_accessors_roundtrip_every_editable_slot() {
        let tokens = stock_default_preset().light;
        for key in SCHEME_ACCENT_KEYS.into_iter().chain(SCHEME_ON_SOLID_KEYS) {
            let before = scheme_tokens_get(&tokens, key);
            let next = SchemeRgb::rgb8(9, 8, 7);
            let updated = scheme_tokens_set(&tokens, key, next);
            assert_eq!(scheme_tokens_get(&updated, key), next);
            assert_eq!(scheme_tokens_get(&updated, key), next);
            assert_ne!(before, next);
        }
        // A MISSING on-solid slot reads as white at the render gate.
        let mut missing = tokens.clone();
        missing.on_solid_icon = None;
        assert_eq!(
            scheme_tokens_get(&missing, SchemeEditKey::OnSolidIcon),
            SCHEME_WHITE
        );
    }

    #[test]
    fn custom_theme_helpers_match_the_vue_getdraft_spelling() {
        assert_eq!(custom_theme_id(1770000000000), "custom-theme-1770000000000");
        assert_eq!(custom_theme_name(""), "Custom theme");
        assert_eq!(custom_theme_name("Sunset"), "Sunset");
        assert_eq!(scheme_group_count_label(7), "7 colors");
        assert_eq!(scheme_group_count_label(0), "0 colors");
    }

    #[test]
    fn scheme_editor_renders_the_vue_dom_contract() {
        let html = ColorSchemeEditor(ColorSchemeEditorProps {
            mode: SchemeMode::Dark,
            dark: stock_default_preset().dark,
            light: stock_default_preset().light,
            theme_name: "Dusk".to_string(),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="s-scheme-dialog""#), "{html}");
        // The name input renders through the mirrored Input.
        assert!(html.contains("hk-input"), "{html}");
        assert!(html.contains(r#"value="Dusk""#), "{html}");
        // The mode switch is the segmented subset with the Vue class hook.
        assert!(
            html.contains(r#"class="hk-tabs s-scheme-mode-switch""#)
                && html.contains(r#"data-variant="segmented""#)
                && html.contains(r#"role="radiogroup""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-tabs-trigger""#), "{html}");
        assert!(html.contains(r#"role="radio""#), "{html}");
        assert!(html.contains("s-scheme-mode-hint"), "{html}");
        // Seven accent pickers + two on-solid pickers (each swatch is one
        // `hk-color-picker-swatch`), all in the sheet's own containers.
        assert!(
            html.matches("hk-color-picker-swatch").count() >= 9,
            "{html}"
        );
        assert!(html.contains(r#"class="s-scheme-colors""#), "{html}");
        assert!(html.contains(r#"class="s-scheme-groups-title""#), "{html}");
        assert!(html.contains(r#"class="s-scheme-group-panels""#), "{html}");
        assert!(html.contains(r#"class="s-scheme-group-grid""#), "{html}");
    }

    #[test]
    fn scheme_editor_hides_the_name_input_and_marks_the_active_tab() {
        let html = ColorSchemeEditor(ColorSchemeEditorProps {
            show_name: false,
            mode: SchemeMode::Light,
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-input"), "{html}");
        // Two radio triggers; the light one carries the checked state.
        assert_eq!(html.matches(r#"role="radio""#).count(), 2, "{html}");
        let dark_at = html.find("Dark</span>").expect("dark tab");
        let light_at = html.find(r#"aria-checked="true""#).expect("checked");
        assert!(light_at > dark_at, "the light tab must be checked: {html}");
    }

    #[test]
    fn scheme_editor_feeds_the_pickers_from_the_edited_mode() {
        // The controlled props must follow the `mode` tab: light mode
        // paints the light table's primary (#d63384) and the disclosure
        // flag lands on exactly one picker.
        let html = ColorSchemeEditor(ColorSchemeEditorProps {
            mode: SchemeMode::Light,
            dark: stock_default_preset().dark,
            light: stock_default_preset().light,
            open_picker: Some(SchemeEditKey::Accent),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("background:#d63384"), "{html}");
        // The accent picker is the only expanded trigger.
        assert_eq!(html.matches(r#"aria-expanded="true""#).count(), 1, "{html}");
    }

    #[test]
    fn scheme_editor_routes_disclosure_presses_through_the_open_channel() {
        let seen = std::rc::Rc::new(std::cell::Cell::new(None));
        let sink = std::rc::Rc::clone(&seen);
        let node = ColorSchemeEditor(ColorSchemeEditorProps {
            on_picker_open_change: Some(EventHandler::new(move |key: Option<SchemeEditKey>| {
                sink.set(key);
            })),
            ..Default::default()
        });
        // Serialization drops handlers, so walk the tree and INVOKE the
        // FIRST picker trigger's click listener (the primary accent):
        // deleting the wiring leaves the channel silent.
        fn click_first_picker_trigger(node: &Element, fired: &mut bool) {
            if *fired {
                return;
            }
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("hk-color-picker-swatch-btn")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        *fired = true;
                        return;
                    }
                    for child in &el.children {
                        click_first_picker_trigger(child, fired);
                    }
                }
                VNode::Fragment(children) => {
                    for child in children {
                        click_first_picker_trigger(child, fired);
                    }
                }
                _ => {}
            }
        }
        let mut fired = false;
        click_first_picker_trigger(&node, &mut fired);
        assert!(fired, "no picker trigger found");
        assert_eq!(
            seen.get(),
            Some(SchemeEditKey::Primary),
            "the closed primary picker press must request disclosure"
        );
    }

    #[test]
    fn scheme_editor_has_no_sheet_of_its_own() {
        assert_eq!(
            <ColorSchemeEditorComponent as StyledComponent>::styles(),
            "",
            "the editor borrows the dialog sheet; the mirror must invent none"
        );
        assert_eq!(
            <ColorSchemeEditorComponent as StyledComponent>::name(),
            "color-scheme-editor"
        );
        // The borrowed sheet really is the sibling's table.
        let css = crate::theme::color_scheme_dialog::ColorSchemeDialogComponent::styles();
        assert!(css.contains(".s-scheme-dialog"), "{css}");
    }
}
