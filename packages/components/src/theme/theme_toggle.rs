// packages/components/src/theme/theme_toggle.rs
// ThemeToggle — mirror of the canonical Vue `HkThemeToggle` (the header
// trigger + popover chrome around the shared theme panel).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkThemeToggle.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.s-theme-*` class names are literal and identical in both forms. The
// panel-content sibling borrows this same table (it has no sheet of its
// own).
//
// DOM contract (mirrors Vue's render output):
//
//   div.s-theme-toggle
//     button.hk-icon-button.hk-icon-button-{28|32}.hk-icon-button-ghost
//          .s-theme-toggle-btn                    (via the mirrored
//            HkIconButton; the palette glyph, aria-label = "Themes")
//     {Popover}                                   (open; sheet-on-mobile,
//                                                 title = "Themes")
//       ThemePanelContent                         (see its own contract)
//
// ONE trigger, exactly Vue's shape: a standard ghost `HkIconButton` whose
// ONLY job is opening the menu (mode switching lives in the panel's
// color-mode strip); `s-theme-toggle-btn` carries no css of its own — it
// survives as the stable consumer/test hook chest's chrome guard asserts.
//
// Deltas vs Vue (documented, not accidental):
//   * The menu's open state is CONTROLLED (`open` / `on_open_change`):
//     Vue's internal `menuOpen` ref and the `closeMenu()` expose have no
//     stateless analogue — the host flips the prop, and the panel's
//     `request-close` (theme applied / customize pressed) routes out as
//     `on_open_change(false)`, which is exactly what `closeMenu()` did.
//   * The chrome size ladder (`useChromeActionSize`: ghost/32 on wide
//     screens, ghost/28 below) has no live breakpoint in tairitsu — the
//     host passes `is_desktop` and [`theme_toggle_chrome_size`] maps it.
//   * `popoverPlacement` maps to the mirrored `PopoverPlacement`
//     (default `bottom-end`); the anchor rect is HOST-MEASURED: Vue hands
//     the trigger's live element ref to `HPopover`, while the mirror
//     takes a `PopoverAnchorRect` (see `feedback::popover::
//     anchor_rect_from_element_id`) because the IconButton mirror carries
//     no element-id/ref channel.
//   * `aria-haspopup="menu"` / `aria-expanded` / `title` on the trigger
//     are dropped: the mirrored `IconButton` exposes no attrs passthrough
//     (its `aria-label` alone survives). Revisit when IconButton grows
//     one — Vue's a11y contract wants the expanded state there.
//   * Everything else — the panel body, the mode strip, the theme rows,
//     the built-in scheme dialog — passes straight through to the
//     `ThemePanelContent` mirror, props and slots alike; the panel's
//     `request-close` is wired to this component's `on_open_change`
//     (never surfaced separately, matching Vue's private `closeMenu`).

use hikari_i18n::t;
use hikari_icons::MdiIcon;

use crate::basic::icon_button::{IconButton, IconButtonSize, IconButtonVariant};
use crate::feedback::popover::{Popover, PopoverAnchorRect, PopoverPlacement};
use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::theme::theme_panel_content::{
    ThemeItemScope, ThemeListItem, ThemeMode, ThemePanelContent,
};

pub struct ThemeToggleComponent;

/// The trigger's stable hook class — carries NO css of its own (Vue's
/// comment: do not reintroduce a chrome rule for it).
pub const THEME_TOGGLE_TRIGGER_CLASS: &str = "s-theme-toggle-btn";

/// The chrome size ladder (Vue: `useChromeActionSize` — ghost/32 on wide
/// screens ≥1024, ghost/28 below; an unknown viewport reads NARROW).
pub fn theme_toggle_chrome_size(is_desktop: bool) -> IconButtonSize {
    if is_desktop {
        IconButtonSize::S32
    } else {
        IconButtonSize::S28
    }
}

/// The trigger glyph (Vue: lucide `Palette` at 16 — the mirrored MDI
/// palette; both chrome rungs keep the 16px glyph per HkIconButton's
/// `glyphSize` rule).
pub fn theme_toggle_glyph() -> MdiIcon {
    MdiIcon::Palette
}

/// The trigger/menu name (Vue: `hikari::theme.themes`).
pub fn theme_toggle_title() -> String {
    t("components.hk.themeToggle.themes", "Themes")
}

#[define_props]
pub struct ThemeToggleProps {
    /// Controlled menu state (Vue: the internal `menuOpen` ref — see the
    /// header delta).
    #[default]
    pub open: bool,

    /// Popover placement (Vue: `popoverPlacement`, default bottom-end).
    #[default(PopoverPlacement::BottomEnd)]
    pub popover_placement: PopoverPlacement,

    /// Wide-screen rung of the chrome size ladder (Vue:
    /// `useChromeActionSize`).
    #[default]
    pub is_desktop: bool,

    /// The trigger's measured rect, host-supplied (see the header delta).
    pub anchor: Option<PopoverAnchorRect>,

    // ── ThemePanelContent pass-through (props) ───────────────────────────
    #[default]
    pub current_mode: ThemeMode,
    #[default]
    pub effective_mode: crate::theme::color_scheme_editor::SchemeMode,
    #[default]
    pub altitude_deg: f64,
    #[default(Vec::new())]
    pub themes: Vec<ThemeListItem>,
    #[default]
    pub current_theme: String,

    /// The host owns the customization surface (Vue: `externalCustomize`)
    /// — the toggle forwards it and re-emits `open-customize`.
    #[default]
    pub external_customize: bool,

    #[default]
    pub scheme_dialog_open: bool,
    #[default(crate::theme::color_scheme_editor::CustomTheme::default())]
    pub scheme_draft: crate::theme::color_scheme_editor::CustomTheme,
    #[default]
    pub scheme_mode: crate::theme::color_scheme_editor::SchemeMode,
    #[default(crate::theme::color_scheme_editor::SchemeTokens::default())]
    pub scheme_dark: crate::theme::color_scheme_editor::SchemeTokens,
    #[default(crate::theme::color_scheme_editor::SchemeTokens::default())]
    pub scheme_light: crate::theme::color_scheme_editor::SchemeTokens,
    #[default]
    pub scheme_name: String,
    pub scheme_open_picker: Option<crate::theme::color_scheme_editor::SchemeEditKey>,

    // ── ThemePanelContent pass-through (slots) ───────────────────────────
    pub mode_extra: Option<Element>,
    pub item_leading: Option<Callback<ThemeItemScope, Element>>,
    pub item_name_suffix: Option<Callback<ThemeItemScope, Element>>,
    pub item_trailing: Option<Callback<ThemeItemScope, Element>>,
    pub menu_extra: Option<Element>,
    pub children: Element,

    // ── Channels ─────────────────────────────────────────────────────────
    /// The menu asks to open/close (the trigger press, the popover's own
    /// backdrop/Esc close, and the panel's request-close all funnel here).
    pub on_open_change: Option<EventHandler<bool>>,

    /// A theme was applied (Vue: `update:scheme` — re-emitted from the
    /// panel's dialog confirm).
    pub on_scheme_update: Option<EventHandler<crate::theme::color_scheme_editor::CustomTheme>>,

    /// Customize pressed while `external_customize` (Vue:
    /// `open-customize`).
    pub on_open_customize: Option<EventHandler<()>>,

    /// Mode option pressed, forwarded to the panel.
    pub on_mode_change: Option<EventHandler<ThemeMode>>,

    /// Theme row pressed, forwarded.
    pub on_select_theme: Option<EventHandler<String>>,

    /// Custom theme delete pressed, forwarded.
    pub on_delete_theme: Option<EventHandler<String>>,

    /// The built-in dialog's desired open state, forwarded.
    pub on_scheme_dialog_open_change: Option<EventHandler<bool>>,

    /// The dialog editor's channels, forwarded.
    pub on_scheme_token_change:
        Option<EventHandler<crate::theme::color_scheme_editor::SchemeTokenEdit>>,
    pub on_scheme_mode_change: Option<EventHandler<crate::theme::color_scheme_editor::SchemeMode>>,
    pub on_scheme_name_change: Option<EventHandler<String>>,
    pub on_scheme_picker_open_change:
        Option<EventHandler<Option<crate::theme::color_scheme_editor::SchemeEditKey>>>,
}

#[component]
pub fn ThemeToggle(props: ThemeToggleProps) -> Element {
    let title = theme_toggle_title();

    // The trigger press toggles the menu (Vue: `menuOpen = !menuOpen`).
    let trigger_press = {
        let on_open_change = props.on_open_change.clone();
        let open = props.open;
        move |_e: MouseEvent| {
            if let Some(handler) = on_open_change.as_ref() {
                handler.call(!open);
            }
        }
    };

    // Vue's `closeMenu()`: the panel asking to close collapses to the
    // menu's open channel.
    let panel_request_close = {
        let on_open_change = props.on_open_change.clone();
        move |(): ()| {
            if let Some(handler) = on_open_change.as_ref() {
                handler.call(false);
            }
        }
    };

    let popover_on_open_change = props.on_open_change.clone();

    rsx! {
        div {
            class: "s-theme-toggle",
            IconButton {
                class: THEME_TOGGLE_TRIGGER_CLASS.to_string(),
                icon: Some(theme_toggle_glyph()),
                variant: IconButtonVariant::Ghost,
                size: theme_toggle_chrome_size(props.is_desktop),
                aria_label: Some(title.clone()),
                onclick: Some(EventHandler::new(trigger_press)),
            }
            Popover {
                open: props.open,
                placement: props.popover_placement,
                sheet_on_mobile: true,
                title,
                anchor: props.anchor,
                on_open_change: popover_on_open_change,
                ThemePanelContent {
                    current_mode: props.current_mode,
                    effective_mode: props.effective_mode,
                    altitude_deg: props.altitude_deg,
                    themes: props.themes.clone(),
                    current_theme: props.current_theme.clone(),
                    external_customize: props.external_customize,
                    scheme_dialog_open: props.scheme_dialog_open,
                    scheme_draft: props.scheme_draft.clone(),
                    scheme_mode: props.scheme_mode,
                    scheme_dark: props.scheme_dark.clone(),
                    scheme_light: props.scheme_light.clone(),
                    scheme_name: props.scheme_name.clone(),
                    scheme_open_picker: props.scheme_open_picker,
                    mode_extra: props.mode_extra.clone(),
                    item_leading: props.item_leading.clone(),
                    item_name_suffix: props.item_name_suffix.clone(),
                    item_trailing: props.item_trailing.clone(),
                    menu_extra: props.menu_extra.clone(),
                    children: props.children.clone(),
                    on_mode_change: props.on_mode_change.clone(),
                    on_select_theme: props.on_select_theme.clone(),
                    on_delete_theme: props.on_delete_theme.clone(),
                    on_request_close: Some(EventHandler::new(panel_request_close)),
                    on_open_customize: props.on_open_customize.clone(),
                    on_scheme_update: props.on_scheme_update.clone(),
                    on_scheme_dialog_open_change: props.on_scheme_dialog_open_change.clone(),
                    on_scheme_token_change: props.on_scheme_token_change.clone(),
                    on_scheme_mode_change: props.on_scheme_mode_change.clone(),
                    on_scheme_name_change: props.on_scheme_name_change.clone(),
                    on_scheme_picker_open_change: props.on_scheme_picker_open_change.clone(),
                }
            }
        }
    }
}

impl StyledComponent for ThemeToggleComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.s-theme-*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkThemeToggle.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "theme-toggle"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn theme_toggle_defaults_match_the_vue_props() {
        let props = ThemeToggleProps::default();
        assert!(!props.open);
        // Vue: popoverPlacement default "bottom-end".
        assert_eq!(props.popover_placement, PopoverPlacement::BottomEnd);
        assert!(!props.is_desktop);
        assert!(props.anchor.is_none());
        assert_eq!(props.current_mode, ThemeMode::System);
        assert!(props.themes.is_empty());
        assert_eq!(props.current_theme, "");
        assert!(!props.external_customize);
        assert!(!props.scheme_dialog_open);
        assert!(props.on_open_change.is_none());
        assert!(props.on_scheme_update.is_none());
        assert!(props.on_open_customize.is_none());
    }

    #[test]
    fn theme_toggle_chrome_size_matches_the_ladder() {
        // Wide screens wear the generous ghost/32 cluster; narrower
        // viewports tighten to ghost/28 (the safe rung for an unknown
        // viewport).
        assert_eq!(
            theme_toggle_chrome_size(true),
            IconButtonSize::S32,
            "desktop rung must be ghost/32"
        );
        assert_eq!(
            theme_toggle_chrome_size(false),
            IconButtonSize::S28,
            "narrow rung must be ghost/28"
        );
    }

    #[test]
    fn theme_toggle_trigger_hooks_stay_stable() {
        assert_eq!(THEME_TOGGLE_TRIGGER_CLASS, "s-theme-toggle-btn");
        assert_eq!(theme_toggle_glyph(), MdiIcon::Palette);
        assert_eq!(theme_toggle_title(), "Themes");
    }

    #[test]
    fn theme_toggle_closed_renders_the_trigger_only() {
        let html = ThemeToggle(ThemeToggleProps::default()).render_to_html();
        assert!(html.contains(r#"class="s-theme-toggle""#), "{html}");
        // The trigger is the standard ghost icon button with the stable
        // hook appended (default rung: 28).
        assert!(
            html.contains(
                "hk-icon-button hk-icon-button-28 hk-icon-button-ghost s-theme-toggle-btn"
            ),
            "{html}"
        );
        assert!(html.contains(r#"aria-label="Themes""#), "{html}");
        // Closed menu: no popover panel at all.
        assert!(!html.contains("hk-popover-panel"), "{html}");
        assert!(!html.contains("s-theme-menu"), "{html}");
    }

    #[test]
    fn theme_toggle_open_renders_the_popover_panel_with_the_shared_content() {
        let html = ThemeToggle(ThemeToggleProps {
            open: true,
            is_desktop: true,
            current_mode: ThemeMode::System,
            effective_mode: crate::theme::color_scheme_editor::SchemeMode::Dark,
            altitude_deg: -12.34,
            themes: vec![ThemeListItem {
                id: "default".to_string(),
                name: "Default".to_string(),
                is_custom: false,
            }],
            ..Default::default()
        })
        .render_to_html();
        // The wide rung shows through the trigger chrome.
        assert!(
            html.contains(
                "hk-icon-button hk-icon-button-32 hk-icon-button-ghost s-theme-toggle-btn"
            ),
            "{html}"
        );
        // The anchored popover carries the shared panel content.
        assert!(html.contains("hk-popover-panel"), "{html}");
        assert!(html.contains(r#"class="s-theme-menu""#), "{html}");
        assert!(html.contains("s-theme-mode-autoalt"), "{html}");
        assert!(html.contains("-12.3°"), "{html}");
        assert!(html.contains(">Default<"), "{html}");
    }

    #[test]
    fn theme_toggle_press_routes_the_toggle_through_the_open_channel() {
        let seen = std::rc::Rc::new(std::cell::Cell::new(None));
        let sink = std::rc::Rc::clone(&seen);
        let node = ThemeToggle(ThemeToggleProps {
            on_open_change: Some(EventHandler::new(move |open: bool| {
                sink.set(Some(open));
            })),
            ..Default::default()
        });
        // Serialization drops handlers, so walk the tree and INVOKE the
        // trigger's click listener: the closed menu must ask to OPEN.
        fn click_trigger(node: &Element, fired: &mut bool) {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains(THEME_TOGGLE_TRIGGER_CLASS)
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        *fired = true;
                        return;
                    }
                    for child in &el.children {
                        click_trigger(child, fired);
                    }
                }
                VNode::Fragment(children) => {
                    for child in children {
                        click_trigger(child, fired);
                    }
                }
                _ => {}
            }
        }
        let mut fired = false;
        click_trigger(&node, &mut fired);
        assert!(fired, "no trigger found");
        assert_eq!(seen.get(), Some(true), "the press must ask to open");
    }

    #[test]
    fn theme_toggle_styles_come_from_the_canonical_vue_sheet() {
        let css = ThemeToggleComponent::styles();
        for needle in [
            ".s-theme-toggle",
            ".s-theme-menu",
            ".s-theme-menu-label",
            ".s-theme-mode-row",
            ".s-theme-mode-autoalt",
            ".s-theme-mode-autoalt-value",
            ".s-theme-item-row",
            ".s-theme-item-btn",
            ".s-theme-item-name",
            ".s-theme-item-customize",
            ".s-theme-item-delete",
            ".s-theme-item-trailing",
            ".s-theme-item-lead",
            ".s-theme-mode-extra",
            "prefers-reduced-motion",
        ] {
            assert!(
                css.contains(needle),
                "theme-toggle css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored theme-toggle sheet"
        );
    }
}
