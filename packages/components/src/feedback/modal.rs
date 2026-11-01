// hi-components/src/feedback/modal.rs
// Modal — mirror of the canonical Vue `HkModal` (the frame contract).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkModal.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-modal*`
// class names are literal and identical in both forms. DOM contract
// (mirrors the Vue render output):
//
//   div.hk-modal-root                       (style: --hk-pad override)
//     div.hk-modal-overlay                  (mask; click closes if closable)
//     div.hk-modal-content [+content_class] (role=dialog aria-modal=true
//                                            style: max-width frame cap)
//       div.hk-modal-header [.hk-modal-header--lead]
//         div.hk-modal-header-lead?         (header_lead slot)
//         h2.hk-modal-title                 (title / header slot)
//         div.hk-modal-header-actions?      (header_actions slot)
//         button.hk-window-close.hk-modal-close  (closable; X icon)
//       div.hk-modal-subheader?             (header slot)
//       div.hk-modal-body
//         div.hk-modal-body-scroll.hk-scroll-pin-host
//           div.hk-modal-body-inner         (children)
//       div.hk-modal-footer [.hk-modal-footer--lead]
//         div.hk-modal-footer-lead?         (footer_lead slot)
//         <footer actions as buttons>       (footerActions)
//
// Width: named presets resolve exactly like Vue (`resolve_modal_width` +
// `modal_frame_max_width` viewport-gutter cap); arbitrary CSS max-widths
// pass through.
//
// Behaviour deltas vs Vue (documented in the wave PR):
//   * No `<Teleport>`: tairitsu has no teleport primitive in this release,
//     so the surface renders in place with `position: fixed` (the sheet
//     already does that). Hosts must mount it outside transformed or
//     `contain`ed ancestors.
//   * No popup-manager z-band / back-guard / focus trap / size morph /
//     content hold / windowed virtualization / auto-follow / drag: these
//     Vue behaviours are driven by DOM measurement, history and animation
//     buses that tairitsu does not expose yet. Esc and overlay-click close
//     DO work (portable event handlers); `afterLeave` has no equivalent
//     because there is no leave transition driver.
//   * Escape is handled at the root (like Vue), which needs the dialog to
//     hold focus; without a focus trap the host should wire Esc itself.
// Replaces the retired legacy imperative chain (use_modal / ModalController
// / ModalConfig / ModalContent / MaskMode / ModalPosition / ModalSize /
// calculate_position + the `.hk-modal-*` legacy sheet).

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::basic::{Button, ButtonSize, ButtonVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::utils::{HkPad, hk_pad_style};

pub struct ModalComponent;

/// Named width presets for the `width` prop (Vue: `MODAL_WIDTH_PRESETS`).
/// Passed through as a raw CSS `max-width`, a bare semantic name like
/// `"sm"` would be dropped by the browser and the frame would span the
/// viewport — presets resolve here instead.
pub const MODAL_WIDTH_PRESETS: &[(&str, &str)] = &[
    ("xs", "20rem"),
    ("sm", "32rem"),
    ("md", "40rem"),
    ("lg", "56rem"),
    ("xl", "72rem"),
];

/// Resolve the `width` prop to a concrete CSS max-width value: presets map
/// through [`MODAL_WIDTH_PRESETS`], everything else passes through
/// untouched (Vue: `resolveModalWidth`).
pub fn resolve_modal_width(width: &str) -> String {
    let key = width.trim();
    for (name, value) in MODAL_WIDTH_PRESETS {
        if *name == key {
            return (*value).to_string();
        }
    }
    width.to_string()
}

/// Cap the resolved max-width so the centered frame keeps the shared
/// viewport gutter clear on both sides (Vue: `modalFrameMaxWidth`). `100%`
/// resolves against the fixed frame's containing block, so the cap tracks
/// the live window; the ≤767px sheet branch overrides max-width with
/// `100% !important`, keeping the full-bleed mobile sheet untouched.
pub fn modal_frame_max_width(resolved: &str) -> String {
    format!("min({resolved}, calc(100% - 2 * var(--viewport-gutter, 16px)))")
}

/// Footer action variants (Vue: `"primary" | "secondary" | "danger" |
/// "ghost" | "outline"`, default `secondary`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ModalActionVariant {
    Primary,
    #[default]
    Secondary,
    Danger,
    Ghost,
    Outline,
}

/// One footer action button (Vue: `ModalAction`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ModalAction {
    pub label: String,
    pub variant: ModalActionVariant,
    pub loading: bool,
    pub disabled: bool,
    /// Fired on press (Vue's `ModalAction.onClick`).
    pub on_click: Option<EventHandler<()>>,
}

#[define_props]
pub struct ModalProps {
    /// Controlled open state (Vue: `modelValue`).
    #[default]
    pub open: bool,

    /// Header title (`hk-modal-title`).
    pub title: Option<String>,

    /// Render the ✕ and allow overlay-click close (Vue default true).
    #[default(true)]
    pub closable: bool,

    /// Body container-padding override (`--hk-pad`); unset keeps the
    /// sheet's own body padding.
    pub padding: Option<HkPad>,

    /// Named preset (`xs`…`xl`) or any CSS max-width value (default
    /// `"32rem"`).
    #[default("32rem".to_string())]
    pub width: String,

    /// Extra class appended to the `.hk-modal-content` frame so hosts can
    /// restyle the surface without forking the modal.
    #[default]
    pub content_class: String,

    /// Accessible name for header-less surfaces; takes precedence over
    /// `title` for `aria-label`.
    pub surface_title: Option<String>,

    /// Footer buttons rendered when no `footer` slot is provided.
    pub footer_actions: Option<Vec<ModalAction>>,

    /// Body content (Vue: the default slot).
    pub children: Element,

    /// Header slot body rendered inside `hk-modal-subheader`.
    pub header: Option<Element>,

    /// Header lead slot (inline-start of the title bar).
    pub header_lead: Option<Element>,

    /// Header actions slot (inline-end, before the close button).
    pub header_actions: Option<Element>,

    /// Custom footer content (wins over `footer_actions`).
    pub footer: Option<Element>,

    /// Footer lead slot (inline-start of the footer row).
    pub footer_lead: Option<Element>,

    /// Fired when the user asks to close (✕ / overlay click / Esc). The
    /// host owns the state and must flip `open`.
    pub on_close: Option<EventHandler<MouseEvent>>,
}

#[component]
pub fn Modal(props: ModalProps) -> Element {
    if !props.open {
        return empty_vnode();
    }

    let header_shown = props.title.is_some()
        || props.closable
        || props.header.is_some()
        || props.header_lead.is_some();

    // Vue: `surfaceTitle` wins over `title` for the accessible name.
    let accessible_name = props
        .surface_title
        .clone()
        .or_else(|| props.title.clone())
        .unwrap_or_default();

    let mut content_classes = String::from("hk-modal-content");
    if !props.content_class.is_empty() {
        content_classes.push(' ');
        content_classes.push_str(&props.content_class);
    }

    let frame_style = format!(
        "max-width:{}",
        modal_frame_max_width(&resolve_modal_width(&props.width))
    );

    let root_style = hk_pad_style(props.padding);

    let mut header_classes = String::from("hk-modal-header");
    if props.header_lead.is_some() {
        header_classes.push(' ');
        header_classes.push_str("hk-modal-header--lead");
    }

    let on_close = props.on_close.clone();
    let closable = props.closable;

    // Vue: overlay click closes only when `closable`.
    let overlay_on_close = on_close.clone();
    // Vue: the host's own click handler must not leak into the overlay
    // (the frame stops propagation).
    let on_content_click = move |e: MouseEvent| {
        e.stop_propagation();
    };

    let footer_rendered = props.footer.is_some()
        || props.footer_lead.is_some()
        || props
            .footer_actions
            .as_ref()
            .map(|actions| !actions.is_empty())
            .unwrap_or(false);

    // Pre-compute the footer lead class (Vue adds `--lead` when the lead
    // slot OR actions exist and a lead is rendered).
    let mut footer_classes = String::from("hk-modal-footer");
    if props.footer_lead.is_some() {
        footer_classes.push(' ');
        footer_classes.push_str("hk-modal-footer--lead");
    }

    rsx! {
        div {
            class: "hk-modal-root",
            style: root_style,
            // Root-level Escape (Vue listens on the same root).
            onkeydown: move |e: KeyboardEvent| {
                if e.key == "Escape" && closable {
                    e.prevent_default();
                    e.stop_propagation();
                    if let Some(handler) = on_close.as_ref() {
                        handler.call(MouseEvent::default());
                    }
                }
            },
            div {
                class: "hk-modal-overlay",
                onclick: move |_| {
                    if closable
                        && let Some(handler) = overlay_on_close.as_ref()
                    {
                        handler.call(MouseEvent::default());
                    }
                },
            }
            div {
                class: content_classes,
                style: frame_style,
                "role": "dialog",
                "aria-modal": "true",
                "aria-label": accessible_name,
                tabindex: -1,
                onclick: on_content_click,
                if header_shown {
                    div {
                        class: header_classes,
                        if let Some(lead) = &props.header_lead {
                            div { class: "hk-modal-header-lead", {lead.clone()} }
                        }
                        h2 { class: "hk-modal-title",
                            "{props.title.clone().unwrap_or_default()}"
                        }
                        if let Some(actions) = &props.header_actions {
                            div { class: "hk-modal-header-actions", {actions.clone()} }
                        }
                        if props.closable {
                            button {
                                class: "hk-window-close hk-modal-close",
                                "type": "button",
                                "aria-label": t("hikari::modal.close", "Close"),
                                onclick: {
                                    let handler = props.on_close.clone();
                                    move |_| {
                                        if let Some(handler) = handler.as_ref() {
                                            handler.call(MouseEvent::default());
                                        }
                                    }
                                },
                                Icon {
                                    icon: MdiIcon::Close,
                                    size: 16,
                                }
                            }
                        }
                    }
                    if let Some(header) = &props.header {
                        div { class: "hk-modal-subheader", {header.clone()} }
                    }
                }
                div { class: "hk-modal-body",
                    div {
                        class: "hk-modal-body-scroll hk-scroll-pin-host",
                        "data-scroll-axis": "vertical",
                        "data-pad-cover": "",
                        div { class: "hk-modal-body-inner",
                            {props.children.clone()}
                        }
                    }
                }
                if footer_rendered {
                    div {
                        class: footer_classes,
                        if let Some(lead) = &props.footer_lead {
                            div { class: "hk-modal-footer-lead", {lead.clone()} }
                        }
                        if let Some(footer) = &props.footer {
                            {footer.clone()}
                        } else if let Some(actions) = &props.footer_actions {
                            for (i, action) in actions.iter().enumerate() {
                                {
                                    // Footer actions render through the mirrored
                                    // Button; the variant map is Vue's own, so
                                    // `Outline` stays outline (it is NOT folded
                                    // into secondary).
                                    let variant = match action.variant {
                                        ModalActionVariant::Primary => ButtonVariant::Primary,
                                        ModalActionVariant::Secondary => ButtonVariant::Secondary,
                                        ModalActionVariant::Danger => ButtonVariant::Danger,
                                        ModalActionVariant::Ghost => ButtonVariant::Ghost,
                                        ModalActionVariant::Outline => ButtonVariant::Outline,
                                    };
                                    let action_click = action.on_click.clone();
                                    rsx! {
                                        Button {
                                            variant,
                                            size: ButtonSize::Sm,
                                            disabled: action.disabled,
                                            loading: action.loading,
                                            class: "hk-modal-action".to_string(),
                                            onclick: action_click.map(|handler| {
                                                EventHandler::new(move |_event: MouseEvent| {
                                                    handler.call(());
                                                })
                                            }),
                                            children: VNode::Text(VText::new(&action.label)),
                                        }
                                    }
                                }
                            }
                        }                    }
                }
            }
        }
    }
}

impl StyledComponent for ModalComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkModal.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "modal"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn modal_width_presets_resolve() {
        assert_eq!(resolve_modal_width("xs"), "20rem");
        assert_eq!(resolve_modal_width("sm"), "32rem");
        assert_eq!(resolve_modal_width("md"), "40rem");
        assert_eq!(resolve_modal_width("lg"), "56rem");
        assert_eq!(resolve_modal_width("xl"), "72rem");
    }

    #[test]
    fn modal_width_passes_through_arbitrary_values() {
        assert_eq!(resolve_modal_width("560px"), "560px");
        assert_eq!(resolve_modal_width("50%"), "50%");
        // Vue trims only for the PRESET lookup and returns the original
        // value otherwise; the browser parses the surrounding spaces.
        assert_eq!(resolve_modal_width(" 32rem "), " 32rem ");
        // Not a preset, not a length: passes through verbatim (the Vue dev
        // warn is a dev-only console note, not a value change).
        assert_eq!(resolve_modal_width("wide"), "wide");
    }

    #[test]
    fn modal_frame_caps_to_the_viewport_gutter() {
        assert_eq!(
            modal_frame_max_width("40rem"),
            "min(40rem, calc(100% - 2 * var(--viewport-gutter, 16px)))"
        );
    }

    #[test]
    fn modal_defaults_match_the_vue_props() {
        let props = ModalProps::default();
        assert!(!props.open);
        assert!(props.title.is_none());
        assert!(props.closable);
        assert!(props.padding.is_none());
        assert_eq!(props.width, "32rem");
        assert_eq!(props.content_class, "");
        assert!(props.surface_title.is_none());
        assert!(props.footer_actions.is_none());
        assert!(props.header.is_none());
        assert!(props.header_lead.is_none());
        assert!(props.header_actions.is_none());
        assert!(props.footer.is_none());
        assert!(props.footer_lead.is_none());
        assert!(props.on_close.is_none());
    }

    #[test]
    fn modal_action_defaults_match_the_vue_action() {
        let action = ModalAction::default();
        assert_eq!(action.variant, ModalActionVariant::Secondary);
        assert!(!action.loading);
        assert!(!action.disabled);
    }

    #[test]
    fn modal_footer_action_wires_the_click_handler() {
        let clicks = std::rc::Rc::new(std::cell::Cell::new(0usize));
        let counter = std::rc::Rc::clone(&clicks);
        let node = Modal(ModalProps {
            open: true,
            footer_actions: Some(vec![ModalAction {
                label: "OK".to_string(),
                on_click: Some(EventHandler::new(move |_: ()| {
                    counter.set(counter.get() + 1);
                })),
                ..Default::default()
            }]),
            ..Default::default()
        });
        // Serialization drops handlers, so walk the tree and INVOKE the button's
        // click listener: deleting the wiring leaves it a no-op.
        fn click_action_button(node: &Element) -> bool {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("hk-modal-action")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        return true;
                    }
                    el.children.iter().any(click_action_button)
                }
                VNode::Fragment(children) => children.iter().any(click_action_button),
                _ => false,
            }
        }
        assert!(click_action_button(&node), "no action button found");
        assert_eq!(clicks.get(), 1, "the wired handler must run");
    }

    #[test]
    fn modal_footer_actions_keep_the_vue_variant_and_the_click_channel() {
        let html = Modal(ModalProps {
            open: true,
            footer_actions: Some(vec![
                ModalAction {
                    label: "Cancel".to_string(),
                    variant: ModalActionVariant::Outline,
                    ..Default::default()
                },
                ModalAction {
                    label: "OK".to_string(),
                    variant: ModalActionVariant::Primary,
                    ..Default::default()
                },
            ]),
            ..Default::default()
        })
        .render_to_html();
        // Outline must NOT be folded into secondary (Vue's map keeps it).
        assert!(html.contains("hk-btn-outline"), "{html}");
        assert!(html.contains("hk-btn-primary"), "{html}");
    }

    #[test]
    fn modal_styles_come_from_the_canonical_vue_sheet() {
        let css = ModalComponent::styles();
        assert!(
            css.contains(".hk-modal-root") && css.contains(".hk-modal-content"),
            "modal css must carry the vue frame classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored modal sheet"
        );
    }
}
