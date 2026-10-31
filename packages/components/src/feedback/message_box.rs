// hi-components/src/feedback/message_box.rs
// MessageBox — mirror of the canonical Vue `HkMessageBox`.
//
// A Windows-style message box: a small modal that confirms, shows a
// notice, or collects ONE value. The stylesheet is the SAME sheet the Vue
// library ships (`packages/vue/src/components/HkMessageBox.scss`, vendored
// under `src/styles/vue-mirror/`). DOM contract (mirrors Vue):
//
//   Modal(width="26rem", title = caller title ?? fallback per kind)
//     div.hk-message-box[data-tone]
//       div.hk-message-box-icon (tone icon, aria-hidden)
//       p.hk-message-box-text [role=alert on danger]
//       div.hk-message-box-prompt?  (prompt only: label + field + error)
//     footer: div.hk-message-box-actions
//       button.hk-message-box-confirm (primary/danger + confirm label)
//       button (secondary cancel label; hidden for alert / hide_cancel)
//
// Contract (mirrors Vue):
//   * backdrop / Esc / ✕ are a CANCEL — the box never stays half-open
//     after a dismissal, and the caller's pending decision settles;
//   * alert resolves on confirm; confirm resolves true/false;
//     prompt resolves the value, or null on cancel;
//   * tone drives the icon ink and the confirm button variant
//     (danger → danger, else primary);
//   * the prompt's validator runs before confirming; a returned error
//     string blocks the confirmation and shows under the field; a fresh
//     keystroke clears a failed validation.
//
// Deltas vs Vue (documented):
//   * Rust has no Promise; the imperative service reports through
//     callbacks and ONE app-mounted host (Vue mounts a transient app per
//     call). The macro-task mount / 360 ms reclaim / 5-minute safety net
//     are Vue host-mounting lifecycle details with no analogue here;
//   * the prompt field renders the crate's Input until the HkInput
//     mirror lands (label/error chrome kept, affixes accepted and
//     rendered as prefix/suffix slots).

use std::rc::Rc;

use crate::basic::{Button, ButtonSize, ButtonVariant, Input, InputSize};
use crate::prelude::*;
use crate::styled::StyledComponent;
use hikari_icons::{Icon, MdiIcon};

use super::modal::Modal;

pub struct MessageBoxComponent;

// tairitsu 0.5.22 component-body state is render-scoped (`use_signal`
// allocates per render; `use_state` has ONE slot per component TYPE), so
// the box's open/value/error live in a module registry keyed by
// `instance_key`. The Signals are created once and `set` drives re-renders.
thread_local! {
    static BOX_STATE: std::cell::RefCell<
        std::collections::HashMap<String, MessageBoxLocalState>,
    > = std::cell::RefCell::new(std::collections::HashMap::new());
}

#[derive(Clone)]
struct MessageBoxLocalState {
    open: Signal<bool>,
    value: Signal<String>,
    error: Signal<Option<String>>,
}

fn box_state(instance_key: &str, initial_value: &str) -> MessageBoxLocalState {
    BOX_STATE.with(|map| {
        let mut map = map.borrow_mut();
        map.entry(instance_key.to_string())
            .or_insert_with(|| MessageBoxLocalState {
                open: Signal::new(true),
                value: Signal::new(initial_value.to_string()),
                error: Signal::new(None),
            })
            .clone()
    })
}

/// Visual urgency (Vue: `"info" | "success" | "warning" | "danger"`,
/// default info). Drives the icon ink and the confirm button variant.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MessageBoxTone {
    #[default]
    Info,
    Success,
    Warning,
    Danger,
}

impl MessageBoxTone {
    pub fn data_tone(self) -> &'static str {
        match self {
            MessageBoxTone::Info => "info",
            MessageBoxTone::Success => "success",
            MessageBoxTone::Warning => "warning",
            MessageBoxTone::Danger => "danger",
        }
    }

    /// Vue: success CheckCircle2 / warning AlertTriangle / danger
    /// ShieldAlert / info Info. Delta: the packed MDI set has no
    /// ShieldAlert/CheckCircle (documented) — Alert/Check stand in.
    pub fn icon(self) -> MdiIcon {
        match self {
            MessageBoxTone::Info => MdiIcon::Information,
            MessageBoxTone::Success => MdiIcon::Check,
            MessageBoxTone::Warning => MdiIcon::AlertTriangle,
            MessageBoxTone::Danger => MdiIcon::Alert,
        }
    }
}

/// The box's resolution mode (Vue: `kind`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MessageBoxKind {
    /// Notice with a single OK button.
    #[default]
    Alert,
    /// Confirmation: resolves true/false.
    Confirm,
    /// Single-field prompt: resolves the value, null on cancel.
    Prompt,
}

/// The single editable field a prompt box may host (Vue:
/// `HkMessageBoxPrompt`).
#[derive(Clone, Default)]
pub struct MessageBoxPromptSpec {
    pub value: String,
    pub label: Option<String>,
    pub placeholder: Option<String>,
    /// `"text" | "password" | "number"` (default text).
    pub input_type: Option<String>,
    pub prefix: Option<Element>,
    pub suffix: Option<Element>,
    /// Confirm-time validation: `Some(error string)` blocks the
    /// confirmation, `None` accepts.
    pub validate: Option<Rc<dyn Fn(String) -> Option<String>>>,
}

impl PartialEq for MessageBoxPromptSpec {
    /// Element-wise equality; the validator compares by identity (an
    /// `Rc<dyn Fn>` has no value equality).
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
            && self.label == other.label
            && self.placeholder == other.placeholder
            && self.input_type == other.input_type
            && self.prefix == other.prefix
            && self.suffix == other.suffix
            && match (&self.validate, &other.validate) {
                (None, None) => true,
                (Some(a), Some(b)) => Rc::ptr_eq(a, b),
                _ => false,
            }
    }
}

/// How a message box settled (Vue: the promise payload).
#[derive(Clone, PartialEq, Debug)]
pub enum MessageBoxOutcome {
    /// Alert dismissed either way.
    AlertDismissed,
    /// Confirm answered true.
    Confirmed,
    /// Confirm cancelled / dismissed.
    Cancelled,
    /// Prompt confirmed with a value.
    PromptValue(String),
    /// Prompt cancelled / dismissed.
    PromptCancelled,
}

#[define_props]
pub struct MessageBoxProps {
    pub title: Option<String>,

    /// Body text. Kept plain by design (the Vue scope contract).
    pub message: String,

    #[default]
    pub tone: MessageBoxTone,

    pub confirm_text: Option<String>,

    pub cancel_text: Option<String>,

    /// Hide the cancel button (pure notice; vue default false).
    #[default]
    pub hide_cancel: bool,

    /// Present for prompt boxes (exactly one field).
    pub prompt: Option<MessageBoxPromptSpec>,

    #[default]
    pub kind: MessageBoxKind,

    /// Registry key for the box's transient state (two boxes on one page
    /// must pass different keys; the default suits the usual singleton).
    #[default("message-box".to_string())]
    pub instance_key: String,

    /// Fires once when the box settles.
    pub on_resolve: Option<EventHandler<MessageBoxOutcome>>,
}

#[component]
pub fn MessageBox(props: MessageBoxProps) -> Element {
    // The box is a transient singleton in practice; `instance_key` lets a
    // host keep two boxes apart (see the registry note above).
    let initial_value = props
        .prompt
        .as_ref()
        .map(|prompt| prompt.value.clone())
        .unwrap_or_default();
    let local = box_state(&props.instance_key, &initial_value);

    let confirm_label = props
        .confirm_text
        .clone()
        .unwrap_or_else(|| hikari_i18n::t("hikari::messageBox.confirm", "Confirm"));
    let cancel_label = props
        .cancel_text
        .clone()
        .unwrap_or_else(|| hikari_i18n::t("hikari::messageBox.cancel", "Cancel"));
    let confirm_variant = if props.tone == MessageBoxTone::Danger {
        ButtonVariant::Danger
    } else {
        ButtonVariant::Primary
    };
    // Vue fallback titles per kind.
    let fallback_title = match props.kind {
        MessageBoxKind::Alert => hikari_i18n::t("hikari::messageBox.alertTitle", "Notice"),
        MessageBoxKind::Confirm => {
            hikari_i18n::t("hikari::messageBox.confirmTitle", "Please confirm")
        }
        MessageBoxKind::Prompt => hikari_i18n::t("hikari::messageBox.promptTitle", "Input"),
    };
    let title = props.title.clone().unwrap_or(fallback_title);

    let resolve = props.on_resolve.clone();
    let kind = props.kind;
    let prompt_spec = props.prompt.clone();
    let hide_cancel = props.hide_cancel;

    // Settle helper: close, then report the outcome exactly once.
    let settle = {
        let resolve = resolve.clone();
        let open_state = local.open.clone();
        move |outcome: MessageBoxOutcome| {
            open_state.set(false);
            if let Some(handler) = resolve.as_ref() {
                handler.call(outcome);
            }
        }
    };

    let settle_cancel = {
        let settle = settle.clone();
        move |_: MouseEvent| {
            settle(match kind {
                MessageBoxKind::Alert => MessageBoxOutcome::AlertDismissed,
                MessageBoxKind::Confirm => MessageBoxOutcome::Cancelled,
                MessageBoxKind::Prompt => MessageBoxOutcome::PromptCancelled,
            });
        }
    };

    // Confirm path: prompts validate first (an error blocks and shows).
    let settle_confirm = {
        let settle = settle.clone();
        let prompt_spec = prompt_spec.clone();
        let value_state = local.value.clone();
        let error_state = local.error.clone();
        move |_: MouseEvent| {
            if let Some(prompt) = &prompt_spec {
                let current = value_state.get();
                if let Some(validate) = &prompt.validate
                    && let Some(message) = validate(current.clone())
                {
                    error_state.set(Some(message));
                    return;
                }
                error_state.set(None);
                settle(MessageBoxOutcome::PromptValue(current));
                return;
            }
            settle(match kind {
                MessageBoxKind::Confirm => MessageBoxOutcome::Confirmed,
                _ => MessageBoxOutcome::AlertDismissed,
            });
        }
    };

    // Vue: a fresh keystroke clears a failed validation.
    let on_input = {
        let value_state = local.value.clone();
        let error_state = local.error.clone();
        move |next: String| {
            value_state.set(next);
            if error_state.get().is_some() {
                error_state.set(None);
            }
        }
    };

    let tone_icon = props.tone.icon();
    let danger_role = props.tone == MessageBoxTone::Danger;
    let show_cancel = !(kind == MessageBoxKind::Alert || hide_cancel);
    let is_open = local.open.get();
    let current_value = local.value.get();
    let current_error = local.error.get();

    // Chrome dismiss (✕ / overlay / Esc) settles as a cancel, exactly the
    // cancel button's outcome.
    let modal_dismiss = {
        let settle = settle.clone();
        move |_: MouseEvent| {
            settle(match kind {
                MessageBoxKind::Alert => MessageBoxOutcome::AlertDismissed,
                MessageBoxKind::Confirm => MessageBoxOutcome::Cancelled,
                MessageBoxKind::Prompt => MessageBoxOutcome::PromptCancelled,
            });
        }
    };

    let prompt_body = match &props.prompt {
        Some(prompt) => rsx! {
            div { class: "hk-message-box-prompt",
                if let Some(label) = &prompt.label {
                    div { class: "hk-message-box-prompt-label", "{label}" }
                }
                Input {
                    value: Some(current_value.clone()),
                    input_type: prompt.input_type.clone(),
                    placeholder: prompt.placeholder.clone(),
                    size: InputSize::Medium,
                    oninput: Some(EventHandler::new(on_input.clone())),
                    prefix_icon: prompt.prefix.clone(),
                    suffix_icon: prompt.suffix.clone(),
                }
                if let Some(message) = &current_error {
                    p {
                        class: "hk-message-box-prompt-error",
                        "role": "alert",
                        "{message}"
                    }
                }
            }
        },
        None => empty_vnode(),
    };

    rsx! {
        if is_open {
            Modal {
                open: true,
                title: Some(title.clone()),
                width: "26rem".to_string(),
                children: rsx! {
                    div {
                        class: "hk-message-box",
                        "data-tone": props.tone.data_tone(),
                        div { class: "hk-message-box-icon", "aria-hidden": "true",
                            Icon {
                                icon: tone_icon,
                                size: 18,
                            }
                        }
                        p {
                            class: "hk-message-box-text",
                            "role": if danger_role { "alert" } else { "" },
                            "{props.message}"
                        }
                        {prompt_body}
                    }
                },
                footer: Some(rsx! {
                    div { class: "hk-message-box-actions",
                        Button {
                            variant: confirm_variant,
                            size: ButtonSize::Medium,
                            class: "hk-message-box-confirm".to_string(),
                            onclick: Some(EventHandler::new(settle_confirm.clone())),
                            children: VNode::Text(VText::new(&confirm_label)),
                        }
                        if show_cancel {
                            Button {
                                variant: ButtonVariant::Secondary,
                                size: ButtonSize::Medium,
                                onclick: Some(EventHandler::new(settle_cancel.clone())),
                                children: VNode::Text(VText::new(&cancel_label)),
                            }
                        }
                    }
                }),
                on_close: Some(EventHandler::new(modal_dismiss)),
            }
        }
    }
}

impl StyledComponent for MessageBoxComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkMessageBox.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "message-box"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn message_box_defaults_match_the_vue_options() {
        let props = MessageBoxProps::default();
        assert!(props.title.is_none());
        assert_eq!(props.message, "");
        assert_eq!(props.tone, MessageBoxTone::Info);
        assert!(props.confirm_text.is_none());
        assert!(props.cancel_text.is_none());
        assert!(!props.hide_cancel);
        assert!(props.prompt.is_none());
        assert_eq!(props.kind, MessageBoxKind::Alert);
    }

    #[test]
    fn message_box_tone_data_tokens_and_icons() {
        assert_eq!(MessageBoxTone::Info.data_tone(), "info");
        assert_eq!(MessageBoxTone::Success.data_tone(), "success");
        assert_eq!(MessageBoxTone::Warning.data_tone(), "warning");
        assert_eq!(MessageBoxTone::Danger.data_tone(), "danger");
        assert_eq!(MessageBoxTone::Info.icon(), MdiIcon::Information);
        assert_eq!(MessageBoxTone::Warning.icon(), MdiIcon::AlertTriangle);
    }

    #[test]
    fn message_box_styles_come_from_the_canonical_vue_sheet() {
        let css = MessageBoxComponent::styles();
        assert!(
            css.contains(".hk-message-box") && css.contains(".hk-message-box-actions"),
            "message box css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored message box sheet"
        );
    }
}
