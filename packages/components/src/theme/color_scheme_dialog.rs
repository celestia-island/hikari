// packages/components/src/theme/color_scheme_dialog.rs
// ColorSchemeDialog — mirror of the canonical Vue `HkColorSchemeDialog`
// (the modal chrome around the custom color scheme editor).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkColorSchemeDialog.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.s-scheme-*` class names are literal and identical in both forms. The
// editor sibling borrows this same table (it has no sheet of its own).
//
// DOM contract — thin composition, exactly Vue's render:
//
//   {Modal}                                 (title = "Edit scheme",
//                                            width = 36rem,
//                                            footer = Decline | Save)
//     ColorSchemeEditor                     (the s-scheme-dialog body)
//
// Vue owns only the chrome here: title, the two footer actions and the
// open→re-seed→save lifecycle; the token/group form belongs to
// `HkColorSchemeEditor`. The mirror keeps that split — see the sibling
// file for the editor's own contract.
//
// Deltas vs Vue (documented, not accidental):
//   * The editor's STATE is host-held (the wave's controlled-mirror
//     ruling): what Vue seeded through `initialDark` / `initialLight` /
//     `initialGroups` and read back through the `reset()` / `getDraft()`
//     expose is, in the mirror, the LIVE `dark` / `light` / `theme_name`
//     / `open_picker` props plus the four `on_*` channels the dialog
//     forwards verbatim. The re-seed-on-open watch is therefore the
//     HOST's: it re-passes a reset draft when it flips `open` (the pure
//     half is `color_scheme_editor::scheme_editor_reset`).
//   * `confirm` fires with the `draft` PROP — the snapshot the host
//     assembled from the editor's change stream (Vue's `getDraft()`
//     returns the editor-internal draft; there is no internal draft to
//     read here). The id spelling helper stays pure:
//     `color_scheme_editor::custom_theme_id`.
//   * The footer order/variants are the spec pure function
//     [`color_scheme_dialog_footer_spec`] so tests pin them without
//     reaching into the rendered tree.

use hikari_i18n::t;

use crate::feedback::modal::{Modal, ModalAction, ModalActionVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::theme::color_scheme_editor::{
    ColorSchemeEditor, SchemeEditKey, SchemeMode, SchemeTokenEdit, SchemeTokens,
};

// The custom-scheme payload this dialog confirms, re-exported from the
// editor exactly like Vue re-exports `HCustomTheme` from the dialog.
pub use crate::theme::color_scheme_editor::CustomTheme;

pub struct ColorSchemeDialogComponent;

/// The modal frame width (Vue: `width="36rem"`).
pub const COLOR_SCHEME_DIALOG_WIDTH: &str = "36rem";

/// The modal title (Vue: `hikari::theme.editScheme`).
pub fn color_scheme_dialog_title() -> String {
    t("components.hk.colorSchemeDialog.title", "Edit scheme")
}

/// The footer action pair in Vue's order — Decline (secondary) then Save
/// (primary). Pure so the wiring test and the render share one source.
pub fn color_scheme_dialog_footer_spec() -> Vec<(ModalActionVariant, String)> {
    vec![
        (
            ModalActionVariant::Secondary,
            t("components.hk.colorSchemeDialog.cancel", "Decline"),
        ),
        (
            ModalActionVariant::Primary,
            t("components.hk.colorSchemeDialog.save", "Save"),
        ),
    ]
}

#[define_props]
pub struct ColorSchemeDialogProps {
    /// Controlled open state (Vue: `modelValue`, required there).
    #[default]
    pub open: bool,

    // ── The editor's controlled pass-through (see the header delta) ─────
    /// Which palette the nested editor edits.
    #[default]
    pub mode: SchemeMode,

    /// The live dark draft.
    #[default(SchemeTokens::default())]
    pub dark: SchemeTokens,

    /// The live light draft.
    #[default(SchemeTokens::default())]
    pub light: SchemeTokens,

    /// The scheme name field value.
    #[default]
    pub theme_name: String,

    /// Render the editor's built-in name input (Vue: `showName`).
    #[default(true)]
    pub show_name: bool,

    /// The editor's currently disclosed picker.
    pub open_picker: Option<SchemeEditKey>,

    /// The Save payload — the host-assembled draft snapshot (Vue:
    /// `getDraft()`; see the header delta).
    #[default(CustomTheme::default())]
    pub draft: CustomTheme,

    /// Host extension-group panels for the nested editor.
    pub children: Element,

    // ── Channels ─────────────────────────────────────────────────────────
    /// Fired with the draft on Save, then the dialog asks to close
    /// (Vue: `confirm` + `update:modelValue(false)`).
    pub on_confirm: Option<EventHandler<CustomTheme>>,

    /// Fired with the desired open state (Vue: `update:modelValue`) —
    /// Decline, Save, ✕, overlay click and Esc all funnel here as
    /// `false` through the modal's own close channel.
    pub on_open_change: Option<EventHandler<bool>>,

    /// Every picker edit, forwarded to the editor (host-held draft).
    pub on_token_change: Option<EventHandler<SchemeTokenEdit>>,

    /// Mode tab press, forwarded.
    pub on_mode_change: Option<EventHandler<SchemeMode>>,

    /// Name field input, forwarded.
    pub on_name_change: Option<EventHandler<String>>,

    /// Picker disclosure press, forwarded.
    pub on_picker_open_change: Option<EventHandler<Option<SchemeEditKey>>>,
}

#[component]
pub fn ColorSchemeDialog(props: ColorSchemeDialogProps) -> Element {
    // Bind the channel clones before the rsx tree (the props DSL moves
    // every field into it) — the same pattern `feedback::modal` uses.
    let on_open_change = props.on_open_change.clone();
    let decline_click = Some(EventHandler::new(move |(): ()| {
        if let Some(handler) = on_open_change.as_ref() {
            handler.call(false);
        }
    }));
    let confirm = props.on_confirm.clone();
    let close_after_confirm = props.on_open_change.clone();
    let draft = props.draft.clone();
    let save_click = Some(EventHandler::new(move |(): ()| {
        if let Some(handler) = confirm.as_ref() {
            handler.call(draft.clone());
        }
        if let Some(handler) = close_after_confirm.as_ref() {
            handler.call(false);
        }
    }));

    let footer_actions: Vec<ModalAction> = color_scheme_dialog_footer_spec()
        .into_iter()
        .enumerate()
        .map(|(index, (variant, label))| ModalAction {
            label,
            variant,
            loading: false,
            disabled: false,
            // Decline asks to close; Save confirms with the draft then
            // asks to close (Vue: `handleConfirm`).
            on_click: if index == 0 {
                decline_click.clone()
            } else {
                save_click.clone()
            },
        })
        .collect();

    rsx! {
        Modal {
            open: props.open,
            title: Some(color_scheme_dialog_title()),
            width: COLOR_SCHEME_DIALOG_WIDTH.to_string(),
            footer_actions: Some(footer_actions),
            on_close: props.on_open_change.clone().map(|handler| {
                EventHandler::new(move |_event: MouseEvent| {
                    handler.call(false);
                })
            }),
            ColorSchemeEditor {
                mode: props.mode,
                dark: props.dark.clone(),
                light: props.light.clone(),
                theme_name: props.theme_name.clone(),
                show_name: props.show_name,
                open_picker: props.open_picker,
                on_token_change: props.on_token_change.clone(),
                on_mode_change: props.on_mode_change.clone(),
                on_name_change: props.on_name_change.clone(),
                on_picker_open_change: props.on_picker_open_change.clone(),
                children: props.children.clone(),
            }
        }
    }
}

impl StyledComponent for ColorSchemeDialogComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkColorSchemeDialog.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "color-scheme-dialog"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn color_scheme_dialog_defaults_match_the_vue_props() {
        let props = ColorSchemeDialogProps::default();
        assert!(!props.open);
        assert_eq!(props.mode, SchemeMode::Dark);
        assert_eq!(props.dark, SchemeTokens::default());
        assert_eq!(props.light, SchemeTokens::default());
        assert_eq!(props.theme_name, "");
        assert!(props.show_name);
        assert!(props.open_picker.is_none());
        assert_eq!(props.draft, CustomTheme::default());
        assert!(props.on_confirm.is_none());
        assert!(props.on_open_change.is_none());
        assert!(props.on_token_change.is_none());
        assert!(props.on_mode_change.is_none());
        assert!(props.on_name_change.is_none());
        assert!(props.on_picker_open_change.is_none());
    }

    #[test]
    fn color_scheme_dialog_chrome_matches_the_vue_constants() {
        assert_eq!(COLOR_SCHEME_DIALOG_WIDTH, "36rem");
        assert_eq!(color_scheme_dialog_title(), "Edit scheme");
        // Decline is SECONDARY, Save is PRIMARY — Vue's exact pair, in
        // order.
        assert_eq!(
            color_scheme_dialog_footer_spec()
                .into_iter()
                .map(|(variant, label)| (format!("{variant:?}"), label))
                .collect::<Vec<_>>(),
            vec![
                ("Secondary".to_string(), "Decline".to_string()),
                ("Primary".to_string(), "Save".to_string()),
            ]
        );
    }

    #[test]
    fn color_scheme_dialog_footer_pair_is_complete_and_named() {
        let spec = color_scheme_dialog_footer_spec();
        // Exactly the two actions, both non-empty (an i18n regression to
        // an empty string would render a nameless button).
        assert_eq!(spec.len(), 2);
        for (_, label) in &spec {
            assert!(!label.is_empty(), "footer labels must be non-empty");
        }
        // The pure spec is the single source the render consumes, so the
        // order is part of the contract (Decline before Save).
        assert_eq!(spec[0].1, "Decline");
        assert_eq!(spec[1].1, "Save");
    }

    #[test]
    fn color_scheme_dialog_renders_the_modal_chrome_and_editor_body() {
        let html = ColorSchemeDialog(ColorSchemeDialogProps {
            open: true,
            dark: crate::theme::color_scheme_editor::stock_default_preset().dark,
            light: crate::theme::color_scheme_editor::stock_default_preset().light,
            ..Default::default()
        })
        .render_to_html();

        // The modal chrome (via the mirrored Modal).
        assert!(html.contains("hk-modal-root"), "{html}");
        assert!(html.contains("hk-modal-title"), "{html}");
        assert!(html.contains(">Edit scheme<"), "{html}");
        assert!(html.contains("36rem"), "{html}");
        // The footer pair keeps its variants.
        assert!(html.contains("hk-btn-secondary"), "{html}");
        assert!(html.contains("hk-btn-primary"), "{html}");
        assert!(html.contains(">Decline<"), "{html}");
        assert!(html.contains(">Save<"), "{html}");
        // The editor body rides inside.
        assert!(html.contains(r#"class="s-scheme-dialog""#), "{html}");
    }

    #[test]
    fn color_scheme_dialog_renders_nothing_while_closed() {
        let html = ColorSchemeDialog(ColorSchemeDialogProps::default()).render_to_html();
        assert!(!html.contains("hk-modal-root"), "{html}");
        assert!(!html.contains("s-scheme-dialog"), "{html}");
    }

    #[test]
    fn color_scheme_dialog_save_confirms_with_the_draft_then_closes() {
        let confirmed = std::rc::Rc::new(std::cell::RefCell::new(Vec::<CustomTheme>::new()));
        let closed = std::rc::Rc::new(std::cell::Cell::new(false));
        let confirm_sink = std::rc::Rc::clone(&confirmed);
        let close_sink = std::rc::Rc::clone(&closed);
        let draft = CustomTheme {
            id: "custom-theme-1".to_string(),
            name: "Dusk".to_string(),
            ..Default::default()
        };
        let node = ColorSchemeDialog(ColorSchemeDialogProps {
            open: true,
            draft: draft.clone(),
            on_confirm: Some(EventHandler::new(move |theme: CustomTheme| {
                confirm_sink.borrow_mut().push(theme);
            })),
            on_open_change: Some(EventHandler::new(move |open: bool| {
                close_sink.set(!open);
            })),
            ..Default::default()
        });
        // Serialization drops handlers, so walk the tree and INVOKE the
        // SAVE button's click listener (the primary footer action).
        fn click_save(node: &Element, fired: &mut bool) {
            match node {
                VNode::Element(el) => {
                    let classes = el.class.to_string();
                    if classes.contains("hk-modal-action")
                        && classes.contains("hk-btn-primary")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        *fired = true;
                        return;
                    }
                    for child in &el.children {
                        click_save(child, fired);
                    }
                }
                VNode::Fragment(children) => {
                    for child in children {
                        click_save(child, fired);
                    }
                }
                _ => {}
            }
        }
        let mut fired = false;
        click_save(&node, &mut fired);
        assert!(fired, "no save action found");
        assert_eq!(confirmed.borrow().as_slice(), [draft]);
        assert!(closed.get(), "save must ask the host to close");
    }

    #[test]
    fn color_scheme_dialog_styles_come_from_the_canonical_vue_sheet() {
        let css = ColorSchemeDialogComponent::styles();
        for needle in [
            ".s-scheme-dialog",
            ".s-scheme-mode-switch",
            ".s-scheme-mode-hint",
            ".s-scheme-colors",
            ".s-scheme-groups",
            ".s-scheme-groups-title",
            ".s-scheme-group-panels",
            ".s-scheme-group-grid",
            ".s-scheme-group-field",
        ] {
            assert!(
                css.contains(needle),
                "color-scheme-dialog css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored scheme sheet"
        );
    }
}
