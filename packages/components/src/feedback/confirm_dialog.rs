// hi-components/src/feedback/confirm_dialog.rs
// ConfirmDialog — mirror of the canonical Vue `HkConfirmDialog`.
//
// Compact 24rem confirmation built on the mirrored [`Modal`] frame:
//
//   Modal(width="24rem", closable=!loading)
//     div.hk-confirm-dialog
//       p.hk-confirm-dialog-message
//       div.hk-confirm-dialog-actions
//         button.hk-confirm-dialog-btn (confirm; danger by default)
//         button.hk-confirm-dialog-btn (cancel; secondary)
//
// Contract (mirrors Vue):
//   * the PRIMARY action comes first, dismiss second (the message-box
//     order shared by HkMessageBox/HkBlockingToast); the row reverses
//     under RTL because it is a pure visual row;
//   * chrome dismiss (✕ / overlay / Esc) is NEVER a no-op: it routes
//     through the cancel path so the caller's pending decision settles
//     (the 2026-09-11 incident); the modal renders it as `closable`;
//   * `loading` disables the ✕ and the cancel button; confirm shows the
//     busy state.
//
// Delta vs Vue (documented): the buttons render the crate's own Button
// (the HkButton `.hk-btn` mirror has not landed yet); the grid classes on
// the buttons are the Vue ones so the shared sheet sizes the row.

use crate::basic::{Button, ButtonSize, ButtonVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;

use super::modal::Modal;

pub struct ConfirmDialogComponent;

#[define_props]
pub struct ConfirmDialogProps {
    /// Controlled open state (Vue: `open`, required).
    #[default]
    pub open: bool,

    #[default]
    pub title: String,

    #[default]
    pub message: String,

    /// Confirm button label; falls back to the localized default.
    #[default]
    pub confirm_label: String,

    /// Confirm ink: danger (default) or primary.
    #[default]
    pub confirm_variant: ConfirmVariant,

    /// Cancel button label; falls back to the localized default.
    #[default]
    pub cancel_label: String,

    /// Busy state: disables the cancel path and the ✕.
    #[default]
    pub loading: bool,

    /// Fired when the user confirms (before the close request).
    pub on_confirm: Option<EventHandler<MouseEvent>>,

    /// Fired when the user cancels — including ✕ / overlay / Esc
    /// dismissals, so callers can settle their pending decision.
    pub on_cancel: Option<EventHandler<MouseEvent>>,

    /// Fired with the desired open state after either path.
    pub on_open_change: Option<EventHandler<bool>>,
}

/// Confirm ink (Vue: `confirmVariant: "primary" | "danger"`, default
/// danger).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ConfirmVariant {
    Primary,
    #[default]
    Danger,
}

#[component]
pub fn ConfirmDialog(props: ConfirmDialogProps) -> Element {
    let confirm_label = if props.confirm_label.is_empty() {
        hikari_i18n::t("hikari::confirmDialog.confirm", "Confirm")
    } else {
        props.confirm_label.clone()
    };
    let cancel_label = if props.cancel_label.is_empty() {
        hikari_i18n::t("hikari::confirmDialog.cancel", "Cancel")
    } else {
        props.cancel_label.clone()
    };
    let confirm_variant = match props.confirm_variant {
        ConfirmVariant::Primary => ButtonVariant::Primary,
        ConfirmVariant::Danger => ButtonVariant::Danger,
    };

    let on_confirm = props.on_confirm.clone();
    let on_cancel = props.on_cancel.clone();
    let on_open_change = props.on_open_change.clone();

    // Both paths emit their event, then ask the caller to close.
    let confirm_click = {
        let handler = on_confirm.clone();
        let open_change = on_open_change.clone();
        move |_: MouseEvent| {
            if let Some(handler) = handler.as_ref() {
                handler.call(MouseEvent::default());
            }
            if let Some(change) = open_change.as_ref() {
                change.call(false);
            }
        }
    };
    let cancel_click = {
        let handler = on_cancel.clone();
        let open_change = on_open_change.clone();
        move |_: MouseEvent| {
            if let Some(handler) = handler.as_ref() {
                handler.call(MouseEvent::default());
            }
            if let Some(change) = open_change.as_ref() {
                change.call(false);
            }
        }
    };

    // Chrome dismiss = cancel (never a no-op).
    let dismissed = {
        let handler = on_cancel.clone();
        let open_change = on_open_change.clone();
        move |_: MouseEvent| {
            if let Some(handler) = handler.as_ref() {
                handler.call(MouseEvent::default());
            }
            if let Some(change) = open_change.as_ref() {
                change.call(false);
            }
        }
    };

    let confirm_label_for_button = confirm_label.clone();
    let cancel_label_for_button = cancel_label.clone();

    rsx! {
        Modal {
            open: props.open,
            title: if props.title.is_empty() {
                None
            } else {
                Some(props.title.clone())
            },
            closable: !props.loading,
            width: "24rem".to_string(),
            children: rsx! {
                div { class: "hk-confirm-dialog",
                    p { class: "hk-confirm-dialog-message",
                        "{props.message}"
                    }
                    div { class: "hk-confirm-dialog-actions",
                        Button {
                            variant: confirm_variant,
                            size: ButtonSize::Md,
                            loading: props.loading,
                            class: "hk-confirm-dialog-btn".to_string(),
                            onclick: Some(EventHandler::new(confirm_click)),
                            children: VNode::Text(VText::new(&confirm_label_for_button)),
                        }
                        Button {
                            variant: ButtonVariant::Secondary,
                            size: ButtonSize::Md,
                            disabled: props.loading,
                            class: "hk-confirm-dialog-btn".to_string(),
                            onclick: Some(EventHandler::new(cancel_click)),
                            children: VNode::Text(VText::new(&cancel_label_for_button)),
                        }
                    }
                }
            },
            on_close: Some(EventHandler::new(dismissed)),
        }
    }
}

impl StyledComponent for ConfirmDialogComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkConfirmDialog.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "confirm-dialog"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn confirm_dialog_defaults_match_the_vue_props() {
        let props = ConfirmDialogProps::default();
        assert!(!props.open);
        assert_eq!(props.title, "");
        assert_eq!(props.message, "");
        assert_eq!(props.confirm_label, "");
        assert_eq!(props.confirm_variant, ConfirmVariant::Danger);
        assert_eq!(props.cancel_label, "");
        assert!(!props.loading);
        assert!(props.on_confirm.is_none());
        assert!(props.on_cancel.is_none());
        assert!(props.on_open_change.is_none());
    }

    #[test]
    fn confirm_dialog_styles_come_from_the_canonical_vue_sheet() {
        let css = ConfirmDialogComponent::styles();
        assert!(
            css.contains(".hk-confirm-dialog") && css.contains(".hk-confirm-dialog-btn"),
            "confirm dialog css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored confirm dialog sheet"
        );
    }
}
