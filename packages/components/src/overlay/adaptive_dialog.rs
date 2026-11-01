// hi-components/src/overlay/adaptive_dialog.rs
// AdaptiveDialog — mirror of the canonical Vue `HkAdaptiveDialog`: ONE dialog
// contract, two shells.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkAdaptiveDialog.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the two seam class
// names are literal and identical in both forms. NO SHELL IS RE-IMPLEMENTED:
// the desktop branch renders the mirrored `Modal`, the mobile branch the
// mirrored `Drawer` (`side = bottom`) — exactly the pair Vue renders — so the
// overlay, the mask, Escape, the title bar and the body band all come from
// those mirrors. The DOM contract is therefore those two shells' contracts
// (`feedback/modal.rs`, `feedback/drawer.rs`) plus the two seams this sheet
// paints:
//
//   ── desktop branch (viewport_width >= 768) ──
//   div.hk-modal-root
//     div.hk-modal-overlay
//     div.hk-modal-content [role=dialog] [aria-modal=true] [aria-label]
//       div.hk-modal-header > h2.hk-modal-title
//         + button.hk-window-close.hk-modal-close
//       div.hk-modal-subheader?                  (header slot = Vue's slot)
//       div.hk-modal-body > … > {children}
//       div.hk-modal-footer > footerActions?
//
//   ── mobile branch (viewport_width < 768) ──
//   div.hk-drawer-overlay
//   div.hk-drawer-panel.hk-drawer-bottom [.panel_class] [role=dialog]
//     div.hk-drawer-header
//       div.hk-adaptive-dialog-drawer-header     ← seam 1 (this component)
//         span.hk-drawer-title?                    (header slot + title only)
//         {header slot}
//       button.hk-window-close.hk-drawer-close
//     div.hk-drawer-body-wrap > div.hk-drawer-body > {children}
//     div.hk-drawer-footer
//       div.hk-adaptive-dialog-footer            ← seam 2 (this component)
//         button.hk-btn.hk-btn-{variant}.hk-btn-sm  × footerActions (host order)
//
// Slot/prop mapping (Vue → mirror): `modelValue` → `open` (controlled, the
// component renders nothing while closed), `title`/`closable`/`width` →
// the same three names, `mobileSize` → `mobile_size` (the drawer's docked-axis
// length; HkDrawer clamps a bottom panel at 70vh, so Vue's default is "70vh"),
// `panelClass` → `panel_class`, `footerActions` → `footer_actions`
// ([`ModalAction`]), default slot → `children`, `header`/`footer` slots →
// `header`/`footer` ([`Element`]), `update:modelValue` → `on_close` (the shells'
// single close channel, like every other surface mirror).
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * `useBreakpoint()` becomes a HOST-MEASURED PROP: `viewport_width` is read
//     through the pure [`adaptive_dialog_mode`] (>= 768 → desktop modal,
//     < 768 → bottom sheet). This release has no live resize listener, so a
//     window that crosses 768 while a dialog is open does NOT re-shell it; the
//     host re-renders with the new width and the next paint picks the shell.
//   * NO `afterLeave` emit — neither shell mirror has a leave transition edge
//     (`feedback/modal.rs` / `feedback/drawer.rs`), so Vue's mid-flip caveat
//     about a skipped after-leave hook has no mirror-side counterpart.
//   * `draggable` is NOT mirrored: the `Modal` mirror has no drag handle (the
//     drag pass needs DOM measurement this release does not expose).
//   * `footerActions` arrive as DATA, not as behaviour: the crate's
//     [`ModalAction`] carries label/variant/loading/disabled only — Vue's
//     `onClick` field has no mirror-side field — so an action press is inert on
//     BOTH branches. A dialog whose footer must act passes the `footer` slot,
//     which wins over `footerActions` in both shells exactly like Vue.
//   * the drawer footer row renders the crate `Button` (`.hk-btn*`, the
//     `HkButton` mirror) at `size = sm` in host order — Vue's `HButton` row —
//     and maps all five Vue variants straight onto `ButtonVariant` (Vue's
//     `"outline"` stays `outline`; the `Modal` mirror's own footer row folds
//     `outline` into `secondary`, which is not the Vue union).

use crate::basic::{Button, ButtonSize, ButtonVariant};
use crate::feedback::{Drawer, DrawerSide, Modal};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct AdaptiveDialogComponent;

/// Vue's mobile seam: `useBreakpoint().isMobile` is `width < 768`, so exactly
/// `768` is already the desktop modal.
pub const ADAPTIVE_DIALOG_BREAKPOINT: f64 = 768.0;

/// Which shell the dialog renders (Vue: which of the two components its render
/// function returns).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum AdaptiveDialogMode {
    /// Desktop: the centered `Modal` frame.
    #[default]
    Modal,
    /// Mobile: the `Drawer` docked to the bottom edge (Vue: the sheet).
    Sheet,
}

impl AdaptiveDialogMode {
    /// Mirror-side identity token (Vue has no token — it picks a component).
    pub fn token(self) -> &'static str {
        match self {
            AdaptiveDialogMode::Modal => "modal",
            AdaptiveDialogMode::Sheet => "sheet",
        }
    }
}

/// Vue's `isMobile.value ? <HDrawer …> : <HModal …>` as a pure function of the
/// host-measured viewport width. `NaN` and negative widths fail the `>= 768`
/// comparison and therefore resolve to the sheet, which is what Vue's
/// `width < 768` does with an unmeasured window.
pub fn adaptive_dialog_mode(viewport_width: f64) -> AdaptiveDialogMode {
    if viewport_width >= ADAPTIVE_DIALOG_BREAKPOINT {
        AdaptiveDialogMode::Modal
    } else {
        AdaptiveDialogMode::Sheet
    }
}

/// The shell root class each mode paints (Vue: the class of the component it
/// rendered) — the desktop frame's band or the sheet's bottom panel.
pub fn adaptive_dialog_shell_class(mode: AdaptiveDialogMode) -> &'static str {
    match mode {
        AdaptiveDialogMode::Modal => "hk-modal-content",
        AdaptiveDialogMode::Sheet => "hk-drawer-panel",
    }
}

/// Seam 1 (`HkAdaptiveDialog.scss`): the composed drawer header that keeps the
/// title in the title bar with the header slot stacked under it.
pub fn adaptive_dialog_composed_header_class() -> &'static str {
    "hk-adaptive-dialog-drawer-header"
}

/// Seam 2 (`HkAdaptiveDialog.scss`): the footerActions row rendered inside the
/// drawer's footer band (HkModal renders that row itself; HkDrawer has no
/// footerActions prop).
pub fn adaptive_dialog_footer_class() -> &'static str {
    "hk-adaptive-dialog-footer"
}

/// Vue's `hasDrawerFooter()`: the footer slot wins, else a non-empty
/// footerActions list gates the whole footer band.
pub fn adaptive_dialog_has_footer(footer: bool, footer_actions: usize) -> bool {
    footer || footer_actions > 0
}

/// Vue's footer-action variant union (`"secondary"` when the field is absent).
fn adaptive_dialog_action_variant(variant: ModalActionVariant) -> ButtonVariant {
    match variant {
        ModalActionVariant::Primary => ButtonVariant::Primary,
        ModalActionVariant::Secondary => ButtonVariant::Secondary,
        ModalActionVariant::Danger => ButtonVariant::Danger,
        ModalActionVariant::Ghost => ButtonVariant::Ghost,
        ModalActionVariant::Outline => ButtonVariant::Outline,
    }
}

#[define_props]
pub struct AdaptiveDialogProps {
    /// Controlled open state (Vue: `modelValue`); closed renders nothing.
    #[default]
    pub open: bool,

    /// Dialog title (both shells' title bar + the accessible name).
    pub title: Option<String>,

    /// Render the ✕ and allow overlay/Escape dismissal (Vue default true).
    #[default(true)]
    pub closable: bool,

    /// Desktop modal width — a preset or any CSS max-width (Vue: `width`).
    #[default("32rem".to_string())]
    pub width: String,

    /// Mobile drawer height (Vue: `mobileSize`; HkDrawer clamps at 70vh).
    #[default("70vh".to_string())]
    pub mobile_size: String,

    /// Extra classes for the mobile drawer panel (Vue: `panelClass`; the
    /// desktop modal has no equivalent hook, like Vue).
    #[default]
    pub panel_class: String,

    /// HOST-MEASURED viewport width in px — the mirror's stand-in for Vue's
    /// live `useBreakpoint()`. The default is a wide desktop window so a host
    /// that forgets the prop gets the modal, never a surprise sheet.
    #[default(1280.0)]
    pub viewport_width: f64,

    /// Footer buttons rendered when no `footer` slot is given (Vue:
    /// `footerActions`; see the header delta — the verbs are inert).
    pub footer_actions: Option<Vec<ModalAction>>,

    /// Body content (Vue: the default slot).
    pub children: Element,

    /// Header slot (Vue: the `header` slot — the modal's sub-header, or the
    /// content stacked under the drawer title).
    pub header: Option<Element>,

    /// Footer slot (Vue: the `footer` slot; wins over `footer_actions`).
    pub footer: Option<Element>,

    /// Fired when the user asks to close (✕ / overlay click / Esc). The host
    /// owns the state and must flip `open` (Vue: `update:modelValue`).
    pub on_close: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn AdaptiveDialog(props: AdaptiveDialogProps) -> Element {
    // Controlled surface: closed renders nothing (Vue's shell machine is in
    // `closed`, so neither component is mounted).
    if !props.open {
        return empty_vnode();
    }

    let mode = adaptive_dialog_mode(props.viewport_width);
    let title = props.title.clone();
    let closable = props.closable;
    let on_close = props.on_close.clone();
    let children = props.children.clone();

    match mode {
        AdaptiveDialogMode::Modal => {
            // Desktop: straight through the mirrored Modal — same props Vue
            // forwards, nothing re-implemented here.
            rsx! {
                Modal {
                    open: true,
                    title: title,
                    closable: closable,
                    width: props.width.clone(),
                    footer_actions: props.footer_actions.clone(),
                    header: props.header.clone(),
                    footer: props.footer.clone(),
                    on_close: on_close,
                    children: children,
                }
            }
        }
        AdaptiveDialogMode::Sheet => {
            // Vue's `renderDrawerHeader()`: only when a header slot exists —
            // HkDrawer's header slot REPLACES its title span, so the shell
            // re-composes "title + slot" as the modal's sub-header does.
            let composed_header: Option<Element> = match &props.header {
                Some(header) => {
                    let header = header.clone();
                    let title_text = props.title.clone();
                    Some(rsx! {
                        div {
                            class: adaptive_dialog_composed_header_class(),
                            if let Some(title_text) = title_text.as_deref() {
                                span { class: "hk-drawer-title",
                                    "{title_text}"
                                }
                            }
                            {header}
                        }
                    })
                }
                None => None,
            };

            // Vue's `renderDrawerFooter()` / `hasDrawerFooter()`: the slot wins,
            // else the HButton row over the drawer's footer band.
            let action_count = props
                .footer_actions
                .as_ref()
                .map(|actions| actions.len())
                .unwrap_or(0);
            let drawer_footer: Option<Element> =
                if adaptive_dialog_has_footer(props.footer.is_some(), action_count) {
                    match &props.footer {
                        Some(footer) => Some(footer.clone()),
                        None => {
                            let mut buttons: Vec<VNode> = Vec::with_capacity(action_count);
                            for action in props.footer_actions.as_deref().unwrap_or_default() {
                                let label = action.label.clone();
                                buttons.push(rsx! {
                                    Button {
                                        variant: adaptive_dialog_action_variant(action.variant),
                                        size: ButtonSize::Sm,
                                        loading: action.loading,
                                        disabled: action.disabled,
                                        children: VNode::Text(VText::new(&label)),
                                    }
                                });
                            }
                            Some(rsx! {
                                div {
                                    class: adaptive_dialog_footer_class(),
                                    {VNode::Fragment(buttons)}
                                }
                            })
                        }
                    }
                } else {
                    None
                };

            rsx! {
                Drawer {
                    open: true,
                    side: DrawerSide::Bottom,
                    title: props.title.clone(),
                    closable: closable,
                    size: props.mobile_size.clone(),
                    panel_class: props.panel_class.clone(),
                    header: composed_header,
                    footer: drawer_footer,
                    on_close: on_close,
                    children: children,
                }
            }
        }
    }
}

impl StyledComponent for AdaptiveDialogComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim: it carries ONLY the two
        // seam classes (everything visual is the modal/drawer sheets').
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkAdaptiveDialog.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "adaptive-dialog"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adaptive_dialog_mode_switches_at_the_vue_breakpoint() {
        assert_eq!(adaptive_dialog_mode(1280.0), AdaptiveDialogMode::Modal);
        assert_eq!(adaptive_dialog_mode(1920.0), AdaptiveDialogMode::Modal);
        // Exactly 768 is a desktop width (Vue: `isMobile === width < 768`).
        assert_eq!(adaptive_dialog_mode(768.0), AdaptiveDialogMode::Modal);
        assert_eq!(adaptive_dialog_mode(767.0), AdaptiveDialogMode::Sheet);
        assert_eq!(adaptive_dialog_mode(390.0), AdaptiveDialogMode::Sheet);
        // An unmeasured window lands on the sheet, like Vue's `width < 768`.
        assert_eq!(adaptive_dialog_mode(0.0), AdaptiveDialogMode::Sheet);
        assert_eq!(adaptive_dialog_mode(f64::NAN), AdaptiveDialogMode::Sheet);
        assert_eq!(ADAPTIVE_DIALOG_BREAKPOINT, 768.0);
    }

    #[test]
    fn adaptive_dialog_class_names_match_the_shells_and_the_sheet() {
        assert_eq!(AdaptiveDialogMode::Modal.token(), "modal");
        assert_eq!(AdaptiveDialogMode::Sheet.token(), "sheet");
        assert_eq!(
            adaptive_dialog_shell_class(AdaptiveDialogMode::Modal),
            "hk-modal-content"
        );
        assert_eq!(
            adaptive_dialog_shell_class(AdaptiveDialogMode::Sheet),
            "hk-drawer-panel"
        );
        assert_eq!(
            adaptive_dialog_composed_header_class(),
            "hk-adaptive-dialog-drawer-header"
        );
        assert_eq!(adaptive_dialog_footer_class(), "hk-adaptive-dialog-footer");
    }

    #[test]
    fn adaptive_dialog_action_variants_follow_the_vue_union() {
        assert_eq!(
            adaptive_dialog_action_variant(ModalActionVariant::Primary),
            ButtonVariant::Primary
        );
        assert_eq!(
            adaptive_dialog_action_variant(ModalActionVariant::Secondary),
            ButtonVariant::Secondary
        );
        assert_eq!(
            adaptive_dialog_action_variant(ModalActionVariant::Danger),
            ButtonVariant::Danger
        );
        assert_eq!(
            adaptive_dialog_action_variant(ModalActionVariant::Ghost),
            ButtonVariant::Ghost
        );
        // Vue's `outline` is a real HButton variant, not a secondary alias.
        assert_eq!(
            adaptive_dialog_action_variant(ModalActionVariant::Outline),
            ButtonVariant::Outline
        );
        // …and the resolved voice IS the sheet's class name.
        assert_eq!(
            adaptive_dialog_action_variant(ModalActionVariant::Primary).class_name(),
            "hk-btn-primary"
        );
    }

    #[test]
    fn adaptive_dialog_drawer_footer_gate_matches_vue() {
        assert!(!adaptive_dialog_has_footer(false, 0));
        assert!(adaptive_dialog_has_footer(false, 1));
        assert!(adaptive_dialog_has_footer(true, 0));
        assert!(adaptive_dialog_has_footer(true, 3));
    }

    #[test]
    fn adaptive_dialog_defaults_match_the_vue_props() {
        let props = AdaptiveDialogProps::default();
        assert!(!props.open);
        assert!(props.title.is_none());
        assert!(props.closable);
        assert_eq!(props.width, "32rem");
        // Vue's `mobileSize` default equals HkDrawer's bottom-panel cap.
        assert_eq!(props.mobile_size, "70vh");
        assert_eq!(props.panel_class, "");
        // Mirror-side prop: a host that forgets it gets the desktop modal.
        assert_eq!(props.viewport_width, 1280.0);
        assert!(props.footer_actions.is_none());
        assert!(props.header.is_none());
        assert!(props.footer.is_none());
        assert!(props.on_close.is_none());
    }

    #[test]
    fn adaptive_dialog_renders_the_modal_shell_on_desktop() {
        let html = AdaptiveDialog(AdaptiveDialogProps {
            open: true,
            title: Some("Settings".to_string()),
            viewport_width: 1200.0,
            footer_actions: Some(vec![ModalAction {
                label: "Save".to_string(),
                ..Default::default()
            }]),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-modal-root""#), "{html}");
        assert!(html.contains(r#"class="hk-modal-content""#), "{html}");
        assert!(html.contains(r#"aria-label="Settings""#), "{html}");
        // The desktop branch must never mount the sheet shell …
        assert!(!html.contains("hk-drawer-panel"), "{html}");
        assert!(!html.contains("hk-adaptive-dialog-footer"), "{html}");
    }

    #[test]
    fn adaptive_dialog_renders_the_bottom_sheet_on_mobile() {
        let html = AdaptiveDialog(AdaptiveDialogProps {
            open: true,
            title: Some("Settings".to_string()),
            viewport_width: 390.0,
            header: Some(rsx! {
                div { class: "host-subheader", "Advanced" }
            }),
            footer_actions: Some(vec![
                ModalAction {
                    label: "Cancel".to_string(),
                    ..Default::default()
                },
                ModalAction {
                    label: "Save".to_string(),
                    variant: ModalActionVariant::Primary,
                    ..Default::default()
                },
            ]),
            ..Default::default()
        })
        .render_to_html();

        // The drawer shell, docked to the bottom edge (the sheet's
        // `-enter-active` class rides along, like every drawer mirror).
        assert!(html.contains("hk-drawer-panel hk-drawer-bottom"), "{html}");
        assert!(html.contains("hk-drawer-overlay"), "{html}");
        // … never the centered modal frame.
        assert!(!html.contains("hk-modal-content"), "{html}");
        // Seam 1: the composed header keeps the title in the title bar and the
        // header slot under it.
        assert!(
            html.contains(r#"class="hk-adaptive-dialog-drawer-header""#),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-drawer-title""#), "{html}");
        assert!(html.contains(r#"class="host-subheader""#), "{html}");
        // Seam 2: the footerActions row, host order, on the drawer band.
        assert!(
            html.contains(r#"class="hk-adaptive-dialog-footer""#),
            "{html}"
        );
        // Both buttons render through the mirrored HkButton at `sm`.
        assert_eq!(html.matches("hk-btn-sm").count(), 2, "{html}");
        assert!(html.contains("hk-btn-primary"), "{html}");
        assert!(html.contains("hk-btn-secondary"), "{html}");
        assert!(html.contains(">Cancel<"), "{html}");
        assert!(html.contains(">Save<"), "{html}");
    }

    #[test]
    fn adaptive_dialog_closed_renders_nothing() {
        let html = AdaptiveDialog(AdaptiveDialogProps {
            title: Some("Settings".to_string()),
            viewport_width: 390.0,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "a closed dialog mounts no surface: {html}");
    }

    #[test]
    fn adaptive_dialog_styles_come_from_the_canonical_vue_sheet() {
        let css = AdaptiveDialogComponent::styles();
        assert!(
            css.contains(".hk-adaptive-dialog-drawer-header")
                && css.contains(".hk-adaptive-dialog-footer"),
            "adaptive-dialog css must carry both seam classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored adaptive-dialog sheet"
        );
        assert_eq!(AdaptiveDialogComponent::name(), "adaptive-dialog");
    }
}
