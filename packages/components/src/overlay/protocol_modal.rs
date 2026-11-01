// hi-components/src/overlay/protocol_modal.rs
// ProtocolModal — mirror of the canonical Vue `HkProtocolModal`: the markdown
// EULA / privacy / terms modal with a Decline/Accept footer.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkProtocolModal.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash`. That sheet carries NO
// RULES — it is the ONE-SCROLLBAR-PER-WINDOW note only (the body grows with its
// content and the HkModal body scroller is THE scrollbar; Vue removed the old
// `bodyHeight` nested scroller as dead API). The `.s-protocol-modal` wrapper is
// therefore a shell hook class, not a painted surface: everything visual comes
// from the `Modal` mirror's sheet.
//
// DOM contract (mirrors Vue, which renders one `HkModal`):
//
//   div.hk-modal-root
//     div.hk-modal-overlay
//     div.hk-modal-content [role=dialog] [aria-modal=true] [aria-label={title}]
//       div.hk-modal-header > h2.hk-modal-title
//         + button.hk-window-close.hk-modal-close
//       div.hk-modal-body > div.hk-modal-body-scroll > div.hk-modal-body-inner
//         div.s-protocol-modal                     ← Vue's shell hook class
//           <markdown body>                        (display::MarkdownRenderer)
//       div.hk-modal-footer                        (Vue: HkModal's footer band)
//         button.hk-btn.hk-btn-secondary.hk-btn-sm   "Copy"     (needs content)
//         button.hk-btn.hk-btn-secondary.hk-btn-sm   "Decline"  (always live)
//         button.hk-btn.hk-btn-primary.hk-btn-sm     "Accept"   (needs content)
//
// Prop/emit mapping (Vue → mirror): `modelValue` → `open` (controlled; closed
// renders nothing), `title` → `title` (defaults to the bundle's "Agreement"),
// `content` → `content`, `acceptLabel`/`declineLabel` →
// `accept_label`/`decline_label`, `closable` → `closable`, `width` → `width`
// (Vue's default `"48rem"`), `update:modelValue` → `on_open_change` (the shell
// only ever requests `false`), `accept`/`decline` → `on_accept`/`on_decline`.
//
// The three verbs, in Vue's order (Copy, Decline, Accept) and with Vue's
// enabled flags, come from the pure [`protocol_modal_actions`]; the gate is
// [`protocol_modal_can_accept`] (`!content.is_empty()`), enforced BOTH as the
// `disabled` attribute and inside the press handler.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * MARKDOWN RENDERER: Vue renders through `HMarkdownRenderer` (marked +
//     DOMPurify in the browser). The mirror renders through the crate's own
//     `display::MarkdownRenderer`, whose single deterministic renderer escapes
//     the source and never injects raw host HTML (see that component's header);
//     the same `.s-protocol-modal` wrapper is kept byte-identical.
//   * NO CLIPBOARD, NO TOAST: Vue's Copy action runs
//     `useClipboardWithToast().copy(content)`. wasip2 has no clipboard and this
//     release has no toast host, so Copy reports through `on_copy` and the HOST
//     performs the copy + toast (the same split `layout/share_bar.rs` and
//     `data/table.rs` document). The button is still gated on content.
//   * FOOTER PATH: the verbs render through the `Modal` mirror's `footer` slot
//     instead of its `footer_actions`, because the crate's `ModalAction` carries
//     label/variant/loading/disabled only — Vue's `onClick` field has no
//     mirror-side field, so `footer_actions` would render inert buttons. The DOM
//     is Vue's `.hk-modal-footer` band with the same three `HkButton`s in the
//     same order; only the handlers differ (they are live here).
//   * i18n NAMESPACE: Vue reads `hikari::protocol.{title,decline,accept,copy}`;
//     the Rust bundle only resolves `components.hk.<component>.<key>`
//     (`packages/i18n/src/locales/*/components.toml`), so the mirror reads
//     `components.hk.protocolModal.*`. Those four keys are new in this wave;
//     until they land the English defaults compiled here are used.
//   * NO `draggable` / `afterLeave`: both are `Modal`-mirror deltas (no drag
//     pass, no leave transition in this release) and are inherited unchanged.

use hikari_i18n::t;

use crate::basic::{Button, ButtonSize, ButtonVariant};
use crate::display::MarkdownRenderer;
use crate::feedback::Modal;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ProtocolModalComponent;

/// Vue's `disabled: !props.content` rule, as a predicate: an EMPTY content
/// string gates Copy and Accept (whitespace-only content is content, exactly
/// like Vue's truthiness test).
pub fn protocol_modal_has_content(content: &str) -> bool {
    !content.is_empty()
}

/// The accept gate (Vue: the Accept action's `disabled` flag).
pub fn protocol_modal_can_accept(content: &str) -> bool {
    protocol_modal_has_content(content)
}

/// The copy gate (Vue: the Copy action's `disabled` flag — the same rule).
pub fn protocol_modal_can_copy(content: &str) -> bool {
    protocol_modal_has_content(content)
}

/// Which verb a footer button means (Vue: the `footerActions` array order).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ProtocolModalVerb {
    Copy,
    Decline,
    Accept,
}

/// One resolved footer verb: the label (bundle-resolved where Vue falls back),
/// the HkButton voice and the enabled flag.
#[derive(Clone, PartialEq, Debug)]
pub struct ProtocolModalAction {
    /// The visible label.
    pub label: String,
    /// `.hk-btn-{variant}` (Vue: `secondary`, `secondary`, `primary`).
    pub variant: ButtonVariant,
    /// Vue's `disabled` flag for this action.
    pub disabled: bool,
    /// What a press means.
    pub verb: ProtocolModalVerb,
}

/// Vue's `title={props.title ?? t("hikari::protocol.title", "Agreement")}`:
/// an explicit (even empty) title wins over the bundle.
pub fn protocol_modal_title(title: Option<&str>) -> String {
    match title {
        Some(text) => text.to_string(),
        None => t("components.hk.protocolModal.title", "Agreement"),
    }
}

/// Vue: `props.declineLabel ?? t("hikari::protocol.decline", "Decline")`.
pub fn protocol_modal_decline_label(label: Option<&str>) -> String {
    match label {
        Some(text) => text.to_string(),
        None => t("components.hk.protocolModal.decline", "Decline"),
    }
}

/// Vue: `props.acceptLabel ?? t("hikari::protocol.accept", "Accept")`.
pub fn protocol_modal_accept_label(label: Option<&str>) -> String {
    match label {
        Some(text) => text.to_string(),
        None => t("components.hk.protocolModal.accept", "Accept"),
    }
}

/// Vue: `t("hikari::protocol.copy", "Copy")` (no override prop).
pub fn protocol_modal_copy_label() -> String {
    t("components.hk.protocolModal.copy", "Copy")
}

/// Vue's `footerActions` computed, in order: Copy, Decline, Accept. Copy and
/// Accept carry the content gate; Decline is always live (a caller may decline
/// an empty protocol).
pub fn protocol_modal_actions(
    content: &str,
    accept_label: Option<&str>,
    decline_label: Option<&str>,
) -> Vec<ProtocolModalAction> {
    vec![
        ProtocolModalAction {
            label: protocol_modal_copy_label(),
            variant: ButtonVariant::Secondary,
            disabled: !protocol_modal_can_copy(content),
            verb: ProtocolModalVerb::Copy,
        },
        ProtocolModalAction {
            label: protocol_modal_decline_label(decline_label),
            variant: ButtonVariant::Secondary,
            disabled: false,
            verb: ProtocolModalVerb::Decline,
        },
        ProtocolModalAction {
            label: protocol_modal_accept_label(accept_label),
            variant: ButtonVariant::Primary,
            disabled: !protocol_modal_can_accept(content),
            verb: ProtocolModalVerb::Accept,
        },
    ]
}

#[define_props]
pub struct ProtocolModalProps {
    /// Controlled open state (Vue: `modelValue`, default false).
    #[default]
    pub open: bool,

    /// Modal title (Vue: `title`, defaulting to the bundle's "Agreement").
    pub title: Option<String>,

    /// The protocol body as markdown (Vue: `content`, default empty).
    #[default]
    pub content: String,

    /// Accept button label override (Vue: `acceptLabel`).
    pub accept_label: Option<String>,

    /// Decline button label override (Vue: `declineLabel`).
    pub decline_label: Option<String>,

    /// Allow dismissing without a decision (✕ / overlay / Esc); Vue default
    /// true.
    #[default(true)]
    pub closable: bool,

    /// Modal width — a preset or any CSS max-width (Vue default `"48rem"`).
    #[default("48rem".to_string())]
    pub width: String,

    /// Fired with the requested open state (Vue: `update:modelValue`); the
    /// shell only ever requests `false`, and the caller decides whether close
    /// means decline.
    pub on_open_change: Option<EventHandler<bool>>,

    /// The Accept verb (gated on content, like Vue's disabled button).
    pub on_accept: Option<EventHandler<()>>,

    /// The Decline verb (always live).
    pub on_decline: Option<EventHandler<()>>,

    /// The Copy verb — the mirror's stand-in for Vue's clipboard + toast
    /// service; the host copies `content` (see the header delta).
    pub on_copy: Option<EventHandler<()>>,
}

#[component]
pub fn ProtocolModal(props: ProtocolModalProps) -> Element {
    if !props.open {
        return empty_vnode();
    }

    let title = protocol_modal_title(props.title.as_deref());
    let on_open_change = props.on_open_change.clone();
    let on_close = Some(event_handler(move |_event: MouseEvent| {
        if let Some(handler) = on_open_change.as_ref() {
            handler.call(false);
        }
    }));

    let actions = protocol_modal_actions(
        &props.content,
        props.accept_label.as_deref(),
        props.decline_label.as_deref(),
    );
    let mut buttons: Vec<VNode> = Vec::with_capacity(actions.len());
    for action in actions {
        let label = action.label.clone();
        let verb = action.verb;
        let disabled = action.disabled;
        let on_copy = props.on_copy.clone();
        let on_decline = props.on_decline.clone();
        let on_accept = props.on_accept.clone();
        buttons.push(rsx! {
            Button {
                variant: action.variant,
                size: ButtonSize::Sm,
                disabled: action.disabled,
                onclick: Some(event_handler(move |_event: MouseEvent| {
                    // The gate, second line of defence after `disabled`: Vue's
                    // disabled button can never fire, and neither does this one.
                    if disabled {
                        return;
                    }
                    match verb {
                        ProtocolModalVerb::Copy => {
                            if let Some(handler) = on_copy.as_ref() {
                                handler.call(());
                            }
                        }
                        ProtocolModalVerb::Decline => {
                            if let Some(handler) = on_decline.as_ref() {
                                handler.call(());
                            }
                        }
                        ProtocolModalVerb::Accept => {
                            if let Some(handler) = on_accept.as_ref() {
                                handler.call(());
                            }
                        }
                    }
                })),
                children: VNode::Text(VText::new(&label)),
            }
        });
    }

    let body = props.content.clone();
    rsx! {
        Modal {
            open: true,
            title: Some(title),
            closable: props.closable,
            width: props.width.clone(),
            on_close: on_close,
            footer: Some(VNode::Fragment(buttons)),
            children: rsx! {
                div {
                    class: "s-protocol-modal",
                    MarkdownRenderer { content: body }
                }
            },
        }
    }
}

impl StyledComponent for ProtocolModalComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim. It carries no rules —
        // only the one-scrollbar-per-window note — so every visual comes from
        // the `Modal` mirror's sheet; the `.s-protocol-modal` wrapper is a host
        // hook, not a painted surface.
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkProtocolModal.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "protocol-modal"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn protocol_modal_content_gates_copy_and_accept() {
        // Vue: `disabled: !content`.
        assert!(!protocol_modal_can_copy(""));
        assert!(!protocol_modal_can_accept(""));
        assert!(protocol_modal_can_copy("# Terms"));
        assert!(protocol_modal_can_accept("# Terms"));
        // Whitespace is content (Vue tests truthiness, not trimming).
        assert!(protocol_modal_can_accept(" "));
        assert!(protocol_modal_has_content("\n"));
    }

    #[test]
    fn protocol_modal_actions_match_the_vue_footer_order() {
        let actions = protocol_modal_actions("# Terms", None, None);
        assert_eq!(actions.len(), 3);
        // Copy, Decline, Accept — Vue's array order.
        assert_eq!(actions[0].verb, ProtocolModalVerb::Copy);
        assert_eq!(actions[1].verb, ProtocolModalVerb::Decline);
        assert_eq!(actions[2].verb, ProtocolModalVerb::Accept);
        // Voices: secondary, secondary, primary.
        assert_eq!(actions[0].variant, ButtonVariant::Secondary);
        assert_eq!(actions[1].variant, ButtonVariant::Secondary);
        assert_eq!(actions[2].variant, ButtonVariant::Primary);
        // The voices resolve to the sheet's class names (Vue's HButton union).
        assert_eq!(actions[0].variant.class_name(), "hk-btn-secondary");
        assert_eq!(actions[1].variant.class_name(), "hk-btn-secondary");
        assert_eq!(actions[2].variant.class_name(), "hk-btn-primary");
        // With content nothing is gated — Vue's `disabled: !content` is false.
        assert!(!actions[0].disabled);
        assert!(!actions[1].disabled);
        assert!(!actions[2].disabled);
    }

    #[test]
    fn protocol_modal_empty_content_disables_copy_and_accept_only() {
        let actions = protocol_modal_actions("", None, None);
        assert!(actions[0].disabled, "Copy needs content");
        assert!(!actions[1].disabled, "Decline stays live");
        assert!(actions[2].disabled, "Accept needs content");
    }

    #[test]
    fn protocol_modal_labels_fall_back_to_the_bundle() {
        assert_eq!(
            protocol_modal_title(None),
            t("components.hk.protocolModal.title", "Agreement")
        );
        assert_eq!(protocol_modal_title(Some("Terms")), "Terms");
        // Vue's `??` keeps an explicit empty string.
        assert_eq!(protocol_modal_title(Some("")), "");
        assert_eq!(
            protocol_modal_accept_label(None),
            t("components.hk.protocolModal.accept", "Accept")
        );
        assert_eq!(
            protocol_modal_decline_label(None),
            t("components.hk.protocolModal.decline", "Decline")
        );
        assert_eq!(
            protocol_modal_copy_label(),
            t("components.hk.protocolModal.copy", "Copy")
        );
        assert_eq!(protocol_modal_accept_label(Some("I agree")), "I agree");
        assert_eq!(protocol_modal_decline_label(Some("No thanks")), "No thanks");
    }

    #[test]
    fn protocol_modal_defaults_match_the_vue_props() {
        let props = ProtocolModalProps::default();
        assert!(!props.open);
        assert!(props.title.is_none());
        assert_eq!(props.content, "");
        assert!(props.accept_label.is_none());
        assert!(props.decline_label.is_none());
        assert!(props.closable);
        assert_eq!(props.width, "48rem");
        assert!(props.on_open_change.is_none());
        assert!(props.on_accept.is_none());
        assert!(props.on_decline.is_none());
        assert!(props.on_copy.is_none());
    }

    #[test]
    fn protocol_modal_renders_the_modal_shell_and_the_footer_band() {
        let html = ProtocolModal(ProtocolModalProps {
            open: true,
            title: Some("Terms".to_string()),
            content: "# Terms\n\nBe kind.".to_string(),
            ..Default::default()
        })
        .render_to_html();

        // The Modal shell (its own contract is tested there).
        assert!(html.contains(r#"class="hk-modal-root""#), "{html}");
        assert!(html.contains(r#"class="hk-modal-content""#), "{html}");
        assert!(html.contains(r#"aria-label="Terms""#), "{html}");
        // The protocol wrapper and the rendered body.
        assert!(html.contains(r#"class="s-protocol-modal""#), "{html}");
        assert!(html.contains("Be kind."), "{html}");
        // The footer band: three HkButtons, Vue's order, Vue's voices.
        assert!(html.contains(r#"class="hk-modal-footer""#), "{html}");
        assert_eq!(html.matches("hk-btn-sm").count(), 3, "{html}");
        assert!(html.contains("hk-btn-primary"), "{html}");
        assert!(html.contains(">Copy<"), "{html}");
        assert!(html.contains(">Decline<"), "{html}");
        assert!(html.contains(">Accept<"), "{html}");
        // With content every verb is live (no `disabled` attribute).
        assert!(!html.contains("disabled"), "{html}");
    }

    #[test]
    fn protocol_modal_empty_content_disables_the_verbs_in_the_dom() {
        let html = ProtocolModal(ProtocolModalProps {
            open: true,
            ..Default::default()
        })
        .render_to_html();

        // The title falls back to the bundle and Copy/Accept carry `disabled`.
        assert!(html.contains(r#"class="s-protocol-modal""#), "{html}");
        assert_eq!(html.matches(r#"disabled="disabled""#).count(), 2, "{html}");
    }

    #[test]
    fn protocol_modal_closed_renders_nothing() {
        let html = ProtocolModal(ProtocolModalProps {
            content: "# Terms".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "a closed protocol mounts nothing: {html}");
    }

    #[test]
    fn protocol_modal_styles_come_from_the_canonical_vue_sheet() {
        let css = ProtocolModalComponent::styles();
        // The vendored sheet holds no rules (one-scrollbar note only), so the
        // assertion is about a CLEAN compile, not about class names.
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored protocol sheet"
        );
        assert!(
            !css.contains(".s-protocol-modal"),
            "the `.s-protocol-modal` wrapper is a shell hook — the sheet never paints it"
        );
        assert_eq!(ProtocolModalComponent::name(), "protocol-modal");
    }
}
