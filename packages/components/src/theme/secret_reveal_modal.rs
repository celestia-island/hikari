// hi-components/src/theme/secret_reveal_modal.rs
// SecretRevealModal — mirror of the canonical Vue `HkSecretRevealModal`: the
// show-once secret / API-key reveal panel.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSecretRevealModal.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.s-secret-modal*` class names are literal and identical in both forms.
// DOM contract:
//
//   Modal (title = "{label} — {t(title)}", width "34rem",
//          footerActions = [Close (secondary)])
//     div.s-secret-modal
//       div.s-secret-modal-notice            (warning icon + "Shown only
//         span {icon AlertTriangle 14}        once" notice)
//         span {notice text}
//       code.s-secret-modal-value [data-revealed]   (the hold target)
//         {revealed ? the secret : a fixed mask}     (mouse-family gesture)
//       div.s-secret-modal-actions
//         button.s-secret-modal-copy [disabled=!value]
//           {icon ContentCopy 14} {copy label}
//
// Deltas vs Vue (documented, not accidental):
//   * HOLD-TO-REVEAL (wave-brief direction; Vue renders the value in the
//     clear). The mirror gates the value behind a CONTROLLED reveal: the
//     `code` box publishes presses through
//     [`SecretRevealModalProps::on_reveal_request`] (`true` = held, wants the
//     secret shown; `false` = hold ended, wants it hidden) and the host owns
//     [`SecretRevealModalProps::revealed`]. While unrevealed the secret NEVER
//     MOUNTS — the box shows a FIXED eight-bullet mask (no length leak) and
//     carries `data-revealed="false"` plus a "Hold to show" accessible name
//     for host styling. No per-instance state exists to flip internally
//     (ledger L48), so the whole channel is controlled props.
//   * GESTURE BINDINGS ARE MOUSE-FAMILY ONLY (ledger L67: the host glue
//     dispatches ONLY the mouse family as typed events — `pointer*`/`touch*`
//     walk the generic channel and silently never fire). Press =
//     `mousedown` (primary button only, like every hold in this crate);
//     release = `mouseup` + `mouseleave`. A TOUCH PRESS therefore cannot
//     drive the reveal — declared here, not accidental.
//   * NO DOCUMENT-LEVEL POINTERUP (no implicit capture, like
//     auth/password_surface's [D2]): a release OUTSIDE the box after the
//     cursor left would never arrive, so `mousemove` carries the fallback —
//     a move reporting `buttons == 0` means no button is held anywhere and
//     publishes `false` ([`secret_reveal_still_held`]). A held move (buttons
//     != 0) is a no-op.
//   * CLIPBOARD: Vue's copy runs `useClipboardWithToast` (copy + localized
//     toast). wasip2 has no clipboard and this crate has no toast host, so
//     the button fires [`SecretRevealModalProps::on_copied`] and the HOST
//     performs the copy + toast (the same split
//     `overlay/protocol_modal.rs` documents). The gate stays Vue's
//     `disabled={!props.value}`.
//   * i18n NAMESPACE: Vue reads `hikari::secret.*`; the Rust bundle resolves
//     `components.hk.<component>.<key>`, so the mirror reads
//     `components.hk.secretRevealModal.*` (four of those keys are new in
//     this wave; `holdToReveal` is the mirror's own, for the mask's
//     accessible name — it has no Vue counterpart).

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};

use crate::feedback::{Modal, ModalAction, ModalActionVariant, ModalProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SecretRevealModalComponent;

/// The unrevealed mask: a FIXED eight bullets — never the secret, never its
/// length (a value-derived count would leak the secret's size at a glance).
pub const SECRET_REVEAL_MASK: &str = "••••••••";

/// Vue's title composition: `title ?? "{label} — " +
/// t("hikari::secret.title")` (an explicit title, even empty, wins).
pub fn secret_reveal_title(label: &str, title: Option<&str>) -> String {
    match title {
        Some(text) => text.to_string(),
        None => format!(
            "{} — {}",
            label,
            t("components.hk.secretRevealModal.title", "Secret")
        ),
    }
}

/// Vue's notice fallback: `props.notice ?? t("hikari::secret.notice")`.
pub fn secret_reveal_notice(notice: Option<&str>) -> String {
    match notice {
        Some(text) => text.to_string(),
        None => t("components.hk.secretRevealModal.notice", "Shown only once"),
    }
}

/// Vue's copy-label fallback: `props.copyLabel ?? t("hikari::secret.copy")`.
pub fn secret_reveal_copy_label(copy_label: Option<&str>) -> String {
    match copy_label {
        Some(text) => text.to_string(),
        None => t("components.hk.secretRevealModal.copy", "Copy"),
    }
}

/// Vue's copy gate: `disabled={!props.value}` — an EMPTY secret disables the
/// verb (whitespace is a secret, exactly like Vue's truthiness test).
pub fn secret_reveal_can_copy(value: &str) -> bool {
    !value.is_empty()
}

/// The value a press publishes (the hold's intent): `None` when there is no
/// secret to show (the press changes nothing), otherwise `true` — a hold
/// always asks to reveal, never to hide.
pub fn secret_reveal_press_intent(has_secret: bool) -> Option<bool> {
    if has_secret { Some(true) } else { None }
}

/// The `buttons == 0` fallback predicate: a `mousemove` reporting no held
/// button means the release happened outside this element after the cursor
/// left — the hold is over (see the header; there is no document-level
/// pointerup in this host stack).
pub fn secret_reveal_still_held(buttons: u16) -> bool {
    buttons != 0
}

#[define_props]
pub struct SecretRevealModalProps {
    /// Controlled open state (Vue: `modelValue`).
    #[default]
    pub open: bool,

    /// Secret label (e.g. "API Key").
    #[default]
    pub label: String,

    /// The secret value to reveal. While [`Self::revealed`] is false it
    /// never mounts — only the fixed mask does.
    #[default]
    pub value: String,

    /// Copy button label override.
    pub copy_label: Option<String>,

    /// "Shown once" notice override.
    pub notice: Option<String>,

    /// Modal title override (Vue: `title`).
    pub title: Option<String>,

    /// Controlled reveal state (the wave-brief hold channel — see the
    /// header deltas). `false` renders the mask.
    #[default]
    pub revealed: bool,

    /// Fired with the requested reveal state: `true` on press (hold wants
    /// the secret), `false` on release / leave / buttonless move.
    pub on_reveal_request: Option<EventHandler<bool>>,

    /// The copy verb — the host performs the clipboard write + toast.
    pub on_copied: Option<EventHandler<()>>,

    /// Fired when the user asks to close (Vue: `update:modelValue`); the
    /// shell only ever requests `false`.
    pub on_open_change: Option<EventHandler<bool>>,
}

#[component]
pub fn SecretRevealModal(props: SecretRevealModalProps) -> Element {
    if !props.open {
        return empty_vnode();
    }

    let title = secret_reveal_title(&props.label, props.title.as_deref());
    let notice = secret_reveal_notice(props.notice.as_deref());
    let copy_label = secret_reveal_copy_label(props.copy_label.as_deref());
    let can_copy = secret_reveal_can_copy(&props.value);

    // The close verb rides the Modal's own footer channel (Vue:
    // footerActions=[{ label: t(close), variant: "secondary", onClick:
    // emit(false) }] — the mirror's ModalAction carries the same three
    // fields, so this is Vue's wiring verbatim).
    let on_open_change = props.on_open_change.clone();
    let close_action = ModalAction {
        label: t("components.hk.secretRevealModal.close", "Close"),
        variant: ModalActionVariant::Secondary,
        on_click: Some(event_handler(move |()| {
            if let Some(handler) = on_open_change.as_ref() {
                handler.call(false);
            }
        })),
        ..Default::default()
    };

    // The hold target: the mouse family only (header delta, ledger L67).
    let request_show = props.on_reveal_request.clone();
    let request_hide = props.on_reveal_request.clone();
    let request_hide_leave = props.on_reveal_request.clone();
    let request_hide_move = props.on_reveal_request.clone();
    let has_secret = !props.value.is_empty();
    let mut value_box = VElement::new("code")
        .class("s-secret-modal-value")
        // The state hook + the mask's accessible name (no length leak: the
        // mask is fixed).
        .attr(
            "data-revealed",
            if props.revealed { "true" } else { "false" },
        )
        .attr_opt(
            "aria-label",
            (!props.revealed).then(|| {
                t(
                    "components.hk.secretRevealModal.holdToReveal",
                    "Hold to show",
                )
            }),
        )
        .on_mousedown(move |event: MouseEvent| {
            // No text selection during a hold, and only the primary button
            // arms it (the crate-wide hold rule).
            event.prevent_default();
            if event.button != 0 {
                return;
            }
            if let Some(true) = secret_reveal_press_intent(has_secret)
                && let Some(handler) = request_show.as_ref()
            {
                handler.call(true);
            }
        })
        .on_mouseup(move |_event: MouseEvent| {
            if let Some(handler) = request_hide.as_ref() {
                handler.call(false);
            }
        })
        .on_mouseleave(move |_event: MouseEvent| {
            if let Some(handler) = request_hide_leave.as_ref() {
                handler.call(false);
            }
        })
        .on_mousemove(move |event: MouseEvent| {
            // buttons==0 fallback: the release happened elsewhere.
            if !secret_reveal_still_held(event.buttons)
                && let Some(handler) = request_hide_move.as_ref()
            {
                handler.call(false);
            }
        });
    value_box = value_box.child(VNode::Text(VText::new(if props.revealed {
        props.value.as_str()
    } else {
        SECRET_REVEAL_MASK
    })));

    // The copy verb: a raw button with its own sheet class (Vue does not use
    // HkButton here), gated on a non-empty value exactly like Vue.
    let on_copied = props.on_copied.clone();
    let value_for_copy = props.value.clone();
    let body = rsx! {
        div {
            class: "s-secret-modal",
            div { class: "s-secret-modal-notice",
                Icon {
                    icon: MdiIcon::AlertTriangle,
                    size: 14,
                }
                span { "{notice}" }
            }
            {VNode::Element(Box::new(value_box))}
            div { class: "s-secret-modal-actions",
                button {
                    class: "s-secret-modal-copy",
                    "type": "button",
                    disabled: !can_copy,
                    onclick: move |_event: MouseEvent| {
                        // Belt-and-braces after `disabled`: an empty secret
                        // never fires (Vue's disabled button cannot).
                        if !secret_reveal_can_copy(&value_for_copy) {
                            return;
                        }
                        if let Some(handler) = on_copied.as_ref() {
                            handler.call(());
                        }
                    },
                    Icon {
                        icon: MdiIcon::ContentCopy,
                        size: 14,
                    }
                    "{copy_label}"
                }
            }
        }
    };

    Modal(ModalProps {
        open: true,
        title: Some(title),
        width: "34rem".to_string(),
        footer_actions: Some(vec![close_action]),
        children: body,
        ..Default::default()
    })
}

impl StyledComponent for SecretRevealModalComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.s-secret-modal*` names literal so this CSS matches Vue).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSecretRevealModal.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "secret-reveal-modal"
    }
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;
    use std::rc::Rc;

    use super::*;

    #[test]
    fn secret_reveal_labels_fall_back_to_the_bundle() {
        assert_eq!(
            secret_reveal_title("API Key", None),
            format!(
                "API Key — {}",
                t("components.hk.secretRevealModal.title", "Secret")
            )
        );
        // An explicit title, even empty, wins (Vue's `??`).
        assert_eq!(secret_reveal_title("API Key", Some("Token")), "Token");
        assert_eq!(secret_reveal_title("API Key", Some("")), "");
        assert_eq!(
            secret_reveal_notice(None),
            t("components.hk.secretRevealModal.notice", "Shown only once")
        );
        assert_eq!(secret_reveal_notice(Some("Custom")), "Custom");
        assert_eq!(
            secret_reveal_copy_label(None),
            t("components.hk.secretRevealModal.copy", "Copy")
        );
        assert_eq!(secret_reveal_copy_label(Some("Copy key")), "Copy key");
    }

    #[test]
    fn secret_reveal_gates_match_vue() {
        // Vue: `disabled={!props.value}` — whitespace is a secret.
        assert!(!secret_reveal_can_copy(""));
        assert!(secret_reveal_can_copy("sk-1234"));
        assert!(secret_reveal_can_copy(" "));
        // A hold only ever asks to SHOW, and an empty secret asks nothing.
        assert_eq!(secret_reveal_press_intent(true), Some(true));
        assert_eq!(secret_reveal_press_intent(false), None);
        // The buttons==0 fallback: only a buttonless move reads as released.
        assert!(secret_reveal_still_held(1));
        assert!(secret_reveal_still_held(2));
        assert!(!secret_reveal_still_held(0));
        // The mask is fixed — it never leaks the secret's length.
        assert_eq!(SECRET_REVEAL_MASK.chars().count(), 8);
    }

    #[test]
    fn secret_reveal_defaults_match_the_vue_props() {
        let props = SecretRevealModalProps::default();
        assert!(!props.open);
        assert_eq!(props.label, "");
        assert_eq!(props.value, "");
        assert!(props.copy_label.is_none());
        assert!(props.notice.is_none());
        assert!(props.title.is_none());
        assert!(!props.revealed);
        assert!(props.on_reveal_request.is_none());
        assert!(props.on_copied.is_none());
        assert!(props.on_open_change.is_none());
    }

    #[test]
    fn secret_reveal_renders_the_vue_panel() {
        let html = SecretRevealModal(SecretRevealModalProps {
            open: true,
            label: "API Key".to_string(),
            value: "sk-secret-1234".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            // The Modal shell (Vue default width 34rem).
            r#"class="hk-modal-root""#,
            r#"aria-label="API Key — Secret""#,
            "hk-modal-footer",
            ">Close<",
            // The panel body.
            r#"class="s-secret-modal""#,
            "s-secret-modal-notice",
            "Shown only once",
            "s-secret-modal-value",
            "s-secret-modal-actions",
            "s-secret-modal-copy",
            ">Copy<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Unrevealed (the default): the secret NEVER mounts, the fixed mask
        // does, with the state hook and the hold hint.
        assert!(!html.contains("sk-secret-1234"), "{html}");
        assert!(html.contains(SECRET_REVEAL_MASK), "{html}");
        assert!(html.contains(r#"data-revealed="false""#), "{html}");
        assert!(html.contains("Hold to show"), "{html}");
    }

    #[test]
    fn secret_reveal_revealed_mounts_the_secret() {
        let html = SecretRevealModal(SecretRevealModalProps {
            open: true,
            label: "API Key".to_string(),
            value: "sk-secret-1234".to_string(),
            revealed: true,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("sk-secret-1234"), "{html}");
        assert!(!html.contains(SECRET_REVEAL_MASK), "{html}");
        assert!(html.contains(r#"data-revealed="true""#), "{html}");
        // No hold hint while revealed.
        assert!(!html.contains("Hold to show"), "{html}");
    }

    #[test]
    fn secret_reveal_empty_secret_disables_the_copy_verb() {
        let html = SecretRevealModal(SecretRevealModalProps {
            open: true,
            label: "API Key".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(html.matches(r#"disabled="disabled""#).count(), 1, "{html}");
    }

    #[test]
    fn secret_reveal_closed_renders_nothing() {
        let html = SecretRevealModal(SecretRevealModalProps {
            value: "sk-secret-1234".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.is_empty(), "a closed panel mounts nothing: {html}");
    }

    #[test]
    fn secret_reveal_hold_publishes_through_the_mouse_family() {
        let asks: Rc<Cell<i32>> = Rc::new(Cell::new(0));
        let last: Rc<Cell<bool>> = Rc::new(Cell::new(false));
        let (asks_c, last_c) = (Rc::clone(&asks), Rc::clone(&last));
        let node = SecretRevealModal(SecretRevealModalProps {
            open: true,
            label: "API Key".to_string(),
            value: "sk-secret-1234".to_string(),
            on_reveal_request: Some(EventHandler::new(move |want: bool| {
                asks_c.set(asks_c.get() + 1);
                last_c.set(want);
            })),
            ..Default::default()
        });
        // Walk the tree to the value box, then INVOKE its mouse listeners:
        // the gesture is the contract (serialization drops handlers, so the
        // wiring itself is what needs proving).
        fn value_box_of(node: &Element) -> Option<&VElement> {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("s-secret-modal-value") {
                        return Some(el);
                    }
                    el.children.iter().find_map(value_box_of)
                }
                VNode::Fragment(children) => children.iter().find_map(value_box_of),
                _ => None,
            }
        }
        let value_box = value_box_of(&node).expect("the value box must be mounted");
        let fire = |event: &str, data: MouseEvent| {
            let handler = value_box
                .event_handlers
                .get(event)
                .unwrap_or_else(|| panic!("the {event} listener must be wired"));
            handler.borrow_mut()(Box::new(data) as Box<dyn tairitsu_vdom::EventData>);
        };
        // Press (primary) asks to show.
        let mut press = MouseEvent::default();
        press.button = 0;
        fire("mousedown", press);
        assert_eq!((asks.get(), last.get()), (1, true));
        // A non-primary press never arms the hold.
        let mut other = MouseEvent::default();
        other.button = 2;
        fire("mousedown", other);
        assert_eq!(asks.get(), 1);
        // Release hides.
        fire("mouseup", MouseEvent::default());
        assert_eq!((asks.get(), last.get()), (2, false));
        // A held move is a no-op; a buttonless move is the release fallback.
        let mut held = MouseEvent::default();
        held.buttons = 1;
        fire("mousemove", held);
        assert_eq!(asks.get(), 2);
        fire("mousemove", MouseEvent::default());
        assert_eq!((asks.get(), last.get()), (3, false));
        // Leaving the box hides.
        fire("mouseleave", MouseEvent::default());
        assert_eq!((asks.get(), last.get()), (4, false));
    }

    #[test]
    fn secret_reveal_copy_fires_the_host_verb() {
        let fired = Rc::new(Cell::new(false));
        let flag = Rc::clone(&fired);
        let node = SecretRevealModal(SecretRevealModalProps {
            open: true,
            label: "API Key".to_string(),
            value: "sk-secret-1234".to_string(),
            on_copied: Some(EventHandler::new(move |()| {
                flag.set(true);
            })),
            ..Default::default()
        });
        fn click_copy(node: &Element) -> bool {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("s-secret-modal-copy")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        return true;
                    }
                    el.children.iter().any(click_copy)
                }
                VNode::Fragment(children) => children.iter().any(click_copy),
                _ => false,
            }
        }
        assert!(click_copy(&node), "no copy button found");
        assert!(fired.get(), "the wired copy handler must run");
    }

    #[test]
    fn secret_reveal_styles_come_from_the_canonical_vue_sheet() {
        let css = SecretRevealModalComponent::styles();
        for needle in [
            ".s-secret-modal",
            ".s-secret-modal-notice",
            ".s-secret-modal-value",
            ".s-secret-modal-copy",
        ] {
            assert!(
                css.contains(needle),
                "secret modal css must carry {needle}: {css}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored secret sheet"
        );
        assert_eq!(SecretRevealModalComponent::name(), "secret-reveal-modal");
    }
}
