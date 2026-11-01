// hi-components/src/theme/error_boundary.rs
// ErrorBoundary — mirror of the canonical Vue `HkErrorBoundary`: the inline
// crash guard whose fallback is the shared error landing (inline variant).
//
// CAPTURE MODEL (the wave's deliberate delta, declared here): Vue owns the
// capture — `onErrorCaptured` intercepts a descendant's render error, logs
// it, keeps it in a local ref and stops propagation; `retry()` clears the
// ref. tairitsu 0.5.22 has NO error-capture hook (and no per-instance state
// to keep the captured error in — ledger L48), so the mirror turns the
// boundary into a CONTROLLED ERROR SLOT:
//   * the HOST captures the error in its own glue, stringifies it and
//     injects [`ErrorBoundaryProps::error`] (`None` renders the children
//     untouched, the exact equivalent of Vue's `error.value === null` arm);
//   * the retry verb is [`ErrorBoundaryProps::on_retry`] — Vue's `retry()`
//     cleared the local ref; here the host clears `error` back to `None`
//     when the callback fires;
//   * Vue's `console.error` breadcrumb is host-side too (the mirror renders,
//     it does not log).
//
// STYLES OWNERSHIP (verified, and why `styles()` returns `""`):
// `HkErrorBoundary.tsx` imports no sheet and the Vue tree ships no
// `HkErrorBoundary.scss` (nor does the vendored mirror manifest list one).
// The component owns NO class of its own — every class in its fallback
// (`hk-error-landing__*`) belongs to `HkErrorLanding.scss`, which the
// `theme/error_landing.rs` mirror already compiles; the retry button's
// chrome comes from the Button mirror's sheet and the JSON tree's from the
// JsonTree mirror's. A `scss!` here would have nothing of its own to emit.
//
// DOM contract (mirrors Vue's three render arms):
//
//   error=None      → {children}                     (the slot, verbatim —
//                     Vue returns `slots.default?.()` with no wrapper)
//   error+fallback  → {fallback(format_error)}       (host vnode wins)
//   error+built-in  → ErrorLanding(variant=inline)
//                       title  = error_title || the landing's default
//                       desc   = err.message
//                       code   = err.name            (the tone-matched chip)
//                       copy   = format_error        (the built-in action)
//                       details pane = JsonTree({name, message, [stack],
//                                             [boundary]})
//                       actions = [Retry button]
//
// Deltas vs Vue (documented): the Retry glyph is `MdiIcon::Loading` (the
// packed MDI circular-arrow mark) — the set has no lucide `RefreshCw`; the
// `fallback` renderer takes the FORMATTED error only (Vue's second `retry`
// argument is host-owned here, like the capture itself); and the copy verb
// rides the landing's `on_copy` channel (no clipboard in wasip2 — see the
// landing's header).

#![allow(clippy::type_complexity)]
#![allow(clippy::redundant_clone)]
use std::rc::Rc;

use hikari_i18n::t;

use crate::basic::{Button, ButtonSize, ButtonVariant};
use crate::display::{JsonTree, JsonValue};
use crate::prelude::*;
use crate::styled::StyledComponent;
use crate::theme::error_landing::{ErrorLanding, ErrorLandingVariant};

pub struct ErrorBoundaryComponent;

/// The captured error shape (Vue: `CapturedError`). A host that caught a
/// non-Error value passes the stringified form in `message` and an empty
/// `name` — [`error_boundary_capture`] then normalizes both.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BoundaryError {
    pub name: String,
    pub message: String,
    pub stack: String,
}

/// Vue's `captureError` normalization: an empty name is `Error` (Vue:
/// `err.name || "Error"`; non-Error values arrive with no name at all).
pub fn error_boundary_capture(name: &str, message: &str, stack: &str) -> BoundaryError {
    let name = if name.is_empty() { "Error" } else { name };
    BoundaryError {
        name: name.to_string(),
        message: message.to_string(),
        stack: stack.to_string(),
    }
}

/// Vue's `formatError`: with a stack the technical form is
/// `Name: message\n\nstack`; without it `Name: message`.
pub fn error_boundary_format_error(err: &BoundaryError) -> String {
    if err.stack.is_empty() {
        format!("{}: {}", err.name, err.message)
    } else {
        format!("{}: {}\n\n{}", err.name, err.message, err.stack)
    }
}

/// Vue's `detailsValue` record: `name` and `message` always, `stack` only
/// when present, `boundary` only when the boundary is named (Vue drops the
/// key for the default `"unknown"`).
pub fn error_boundary_details_value(boundary_name: &str, err: &BoundaryError) -> JsonValue {
    let mut record = vec![
        ("name".to_string(), JsonValue::String(err.name.clone())),
        (
            "message".to_string(),
            JsonValue::String(err.message.clone()),
        ),
    ];
    if !err.stack.is_empty() {
        record.push(("stack".to_string(), JsonValue::String(err.stack.clone())));
    }
    if boundary_name != "unknown" {
        record.push((
            "boundary".to_string(),
            JsonValue::String(boundary_name.to_string()),
        ));
    }
    JsonValue::Object(record)
}

/// The Retry button's label (Vue: `props.retryLabel || t(…retry)`).
pub fn error_boundary_retry_label(retry_label: &str) -> String {
    if retry_label.is_empty() {
        t("components.hk.errorBoundary.retry", "Retry")
    } else {
        retry_label.to_string()
    }
}

// Raw `#[derive(Props)]` (the `data/cell.rs` `render` precedent), NOT
// `#[define_props]`: the DSL macro force-derives `PartialEq`, which no
// `Rc<dyn Fn>` field has — so `Default` and `PartialEq` are hand-written
// below exactly as the DSL would have generated them.
#[derive(Clone, Props)]
pub struct ErrorBoundaryProps {
    /// Boundary identity, reported as `boundary` in the details record
    /// (Vue default `"unknown"`, which omits the key).
    #[props(default = "unknown".to_string())]
    pub name: String,

    /// The host-captured error (see the header). `None` renders the
    /// children verbatim.
    #[props(default)]
    pub error: Option<BoundaryError>,

    /// Headline override for the built-in landing (Vue: `errorTitle`; empty
    /// falls back to the landing's own default title).
    #[props(default)]
    pub error_title: String,

    /// Wording override for the landing's built-in copy action (Vue:
    /// `copyErrorLabel`).
    #[props(default)]
    pub copy_error_label: String,

    /// Retry button label override (Vue: `retryLabel`).
    #[props(default)]
    pub retry_label: String,

    /// Host fallback renderer, fed the formatted error (Vue: `fallback(err,
    /// retry)` — the retry closure is host-owned here, see the header).
    #[props(default)]
    pub fallback: Option<Rc<dyn Fn(&str) -> Element>>,

    /// The guarded subtree (Vue: the default slot).
    #[props(default)]
    pub children: Element,

    /// The retry verb — the host clears `error` when it fires.
    #[props(default)]
    pub on_retry: Option<EventHandler<()>>,
}

impl Default for ErrorBoundaryProps {
    fn default() -> Self {
        Self {
            name: "unknown".to_string(),
            error: None,
            error_title: String::new(),
            copy_error_label: String::new(),
            retry_label: String::new(),
            fallback: None,
            children: VNode::default(),
            on_retry: None,
        }
    }
}

impl PartialEq for ErrorBoundaryProps {
    /// Field-wise equality; `fallback` compares by `Rc` identity — an
    /// `Rc<dyn Fn>` has no value equality (the `message_box.rs` / `cell.rs`
    /// function-prop precedent).
    fn eq(&self, other: &Self) -> bool {
        self.name == other.name
            && self.error == other.error
            && self.error_title == other.error_title
            && self.copy_error_label == other.copy_error_label
            && self.retry_label == other.retry_label
            && match (&self.fallback, &other.fallback) {
                (None, None) => true,
                (Some(a), Some(b)) => Rc::ptr_eq(a, b),
                _ => false,
            }
            && self.children == other.children
            && self.on_retry == other.on_retry
    }
}

#[component]
pub fn ErrorBoundary(props: ErrorBoundaryProps) -> Element {
    let Some(err) = props.error.clone() else {
        // Vue: `error.value === null` → the slot, verbatim (no wrapper).
        return props.children.clone();
    };

    let formatted = error_boundary_format_error(&err);

    if let Some(fallback) = &props.fallback {
        return fallback(&formatted);
    }

    let details = error_boundary_details_value(&props.name, &err);
    let retry_label = error_boundary_retry_label(&props.retry_label);
    let on_retry = props.on_retry.clone();

    // Vue resolves `errorTitle || t(default)` itself, then hands it to the
    // landing — which applies the SAME fallback for an empty title, so the
    // pass-through here renders identically.
    ErrorLanding(ErrorLandingProps {
        variant: ErrorLandingVariant::Inline,
        title: props.error_title.clone(),
        description: err.message.clone(),
        code: err.name.clone(),
        copy_text: formatted,
        copy_label: props.copy_error_label.clone(),
        children: Some(rsx! {
            JsonTree {
                value: Some(details),
                aria_label: Some("stack trace".to_string()),
            }
        }),
        actions: Some(rsx! {
            Button {
                variant: ButtonVariant::Primary,
                size: ButtonSize::Sm,
                icon: Some(rsx! {
                    Icon {
                        icon: MdiIcon::Loading,
                        size: 12,
                    }
                }),
                label: Some(retry_label),
                onclick: Some(event_handler(move |_event: MouseEvent| {
                    if let Some(handler) = on_retry.as_ref() {
                        handler.call(());
                    }
                })),
                children: empty_vnode(),
            }
        }),
        ..Default::default()
    })
}

impl StyledComponent for ErrorBoundaryComponent {
    fn styles() -> &'static str {
        // Verified: no HkErrorBoundary sheet exists — the boundary owns no
        // class; every visual in its fallback belongs to the ErrorLanding /
        // Button / JsonTree mirrors' sheets (see the file header).
        ""
    }

    fn name() -> &'static str {
        "error-boundary"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_boundary_capture_normalizes_like_vue() {
        // A named Error keeps its name.
        let err = error_boundary_capture("TypeError", "cannot read x", "at f (a.ts:1)");
        assert_eq!(err.name, "TypeError");
        assert_eq!(err.message, "cannot read x");
        assert_eq!(err.stack, "at f (a.ts:1)");
        // An empty name (Vue's non-Error arm) becomes "Error".
        assert_eq!(error_boundary_capture("", "boom", "").name, "Error");
    }

    #[test]
    fn error_boundary_format_error_matches_vue() {
        let with_stack = BoundaryError {
            name: "TypeError".to_string(),
            message: "cannot read x".to_string(),
            stack: "at f (a.ts:1)".to_string(),
        };
        assert_eq!(
            error_boundary_format_error(&with_stack),
            "TypeError: cannot read x\n\nat f (a.ts:1)"
        );
        let bare = BoundaryError {
            name: "Error".to_string(),
            message: "boom".to_string(),
            stack: String::new(),
        };
        assert_eq!(error_boundary_format_error(&bare), "Error: boom");
    }

    #[test]
    fn error_boundary_details_record_matches_vue() {
        let err = BoundaryError {
            name: "TypeError".to_string(),
            message: "cannot read x".to_string(),
            stack: "at f".to_string(),
        };
        // Named boundary → boundary key rides along.
        let JsonValue::Object(record) = error_boundary_details_value("settings", &err) else {
            panic!("details must be an object");
        };
        let keys: Vec<&str> = record.iter().map(|(k, _)| k.as_str()).collect();
        assert_eq!(keys, vec!["name", "message", "stack", "boundary"]);
        // Default name → no boundary key; empty stack → no stack key.
        let JsonValue::Object(record) =
            error_boundary_details_value("unknown", &BoundaryError::default())
        else {
            panic!("details must be an object");
        };
        let keys: Vec<&str> = record.iter().map(|(k, _)| k.as_str()).collect();
        assert_eq!(keys, vec!["name", "message"]);
    }

    #[test]
    fn error_boundary_retry_label_falls_back_to_the_bundle() {
        assert_eq!(error_boundary_retry_label(""), "Retry");
        assert_eq!(error_boundary_retry_label("Reload"), "Reload");
        assert_eq!(
            error_boundary_retry_label(""),
            t("components.hk.errorBoundary.retry", "Retry")
        );
    }

    #[test]
    fn error_boundary_defaults_match_the_vue_props() {
        let props = ErrorBoundaryProps::default();
        assert_eq!(props.name, "unknown");
        assert!(props.error.is_none());
        assert_eq!(props.error_title, "");
        assert_eq!(props.copy_error_label, "");
        assert_eq!(props.retry_label, "");
        assert!(props.fallback.is_none());
        assert!(props.on_retry.is_none());
    }

    #[test]
    fn error_boundary_healthy_slot_renders_verbatim() {
        let html = ErrorBoundary(ErrorBoundaryProps {
            children: rsx! {
                div { class: "guarded", "content" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("guarded"), "{html}");
        assert!(html.contains("content"), "{html}");
        // No wrapper, no landing.
        assert!(!html.contains("hk-error-landing"), "{html}");
    }

    #[test]
    fn error_boundary_crashed_slot_renders_the_inline_landing() {
        let html = ErrorBoundary(ErrorBoundaryProps {
            name: "settings".to_string(),
            error: Some(error_boundary_capture("TypeError", "cannot read x", "at f")),
            children: rsx! {
                div { "never rendered" }
            },
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            // Vue's root order: base, tone, then the inline variant.
            "hk-error-landing is-error is-inline",
            "hk-error-landing__code",
            "TypeError",
            "cannot read x",
            // The details record rides the JSON tree pane.
            "hk-error-landing__details",
            "boundary",
            // The retry action is a primary button.
            "hk-btn-primary",
            ">Retry<",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("never rendered"), "{html}");
    }

    #[test]
    fn error_boundary_host_fallback_wins_over_the_builtin() {
        let html = ErrorBoundary(ErrorBoundaryProps {
            error: Some(error_boundary_capture("Error", "boom", "")),
            fallback: Some(Rc::new(|formatted: &str| {
                rsx! {
                    p { class: "host-fallback", "{formatted}" }
                }
            })),
            children: empty_vnode(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("host-fallback"), "{html}");
        assert!(html.contains("Error: boom"), "{html}");
        assert!(!html.contains("hk-error-landing"), "{html}");
    }

    #[test]
    fn error_boundary_retry_fires_the_callback() {
        let fired = std::rc::Rc::new(std::cell::Cell::new(false));
        let flag = std::rc::Rc::clone(&fired);
        let node = ErrorBoundary(ErrorBoundaryProps {
            error: Some(error_boundary_capture("Error", "boom", "")),
            on_retry: Some(EventHandler::new(move |()| {
                flag.set(true);
            })),
            children: empty_vnode(),
            ..Default::default()
        });
        // Walk the tree and INVOKE the retry button's click listener: the
        // host clears `error` when this fires.
        fn click_retry_button(node: &Element) -> bool {
            match node {
                VNode::Element(el) => {
                    if el.class.to_string().contains("hk-btn-primary")
                        && let Some(handler) = el.event_handlers.get("click")
                    {
                        handler.borrow_mut()(
                            Box::new(MouseEvent::default()) as Box<dyn tairitsu_vdom::EventData>
                        );
                        return true;
                    }
                    el.children.iter().any(click_retry_button)
                }
                VNode::Fragment(children) => children.iter().any(click_retry_button),
                _ => false,
            }
        }
        assert!(click_retry_button(&node), "no retry button found");
        assert!(fired.get(), "the wired retry handler must run");
    }

    #[test]
    fn error_boundary_owns_no_sheet() {
        // Verified conclusion (see the file header): the boundary ships no
        // sheet and no class of its own.
        assert_eq!(ErrorBoundaryComponent::styles(), "");
        assert_eq!(ErrorBoundaryComponent::name(), "error-boundary");
    }
}
