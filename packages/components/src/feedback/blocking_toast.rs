// hi-components/src/feedback/blocking_toast.rs
// BlockingToast — mirror of the canonical Vue `HkBlockingToast` (the
// toast-shaped, flow-blocking consent card) plus the Rust equivalent of its
// runtime gate (`packages/vue/src/runtime/useBlockingToast.ts`).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkBlockingToast.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-blocking-toast*` class names are literal and identical in both forms.
// The DOM contract below mirrors the Vue render output one-to-one:
//
//   div.hk-blocking-toast-container                  (same column as toasts)
//     div
//       div.hk-blocking-toast-slot
//         div.hk-blocking-toast-card .hk-blocking-toast-{variant}
//             role="alertdialog" [aria-label]
//           span.hk-blocking-toast-icon              (per-variant glyph)
//           div.hk-blocking-toast-body
//             strong.hk-blocking-toast-title         (when `title`)
//             p.hk-blocking-toast-message
//             div.hk-blocking-toast-actions
//               button.hk-btn.hk-btn-primary|danger.hk-btn-sm
//                      > span.hk-btn-label             (confirm, LEFT)
//               button.hk-btn.hk-btn-secondary.hk-btn-sm
//                      > span.hk-btn-label             (cancel, RIGHT)
//
// Behaviour contract taken from the Vue sources, not invented here:
//
//   * `useBlockingToast.ts` — pending prompts are STACKED, never serialized:
//     every `showBlockingToast` call renders its own card and settles
//     independently. The gate never auto-dismisses; `timeoutMs` defaults to
//     "no timeout". `settle(id, value)` removes the card, disposes the timer
//     and resolves; unknown ids are silent no-ops; `clearBlockingToasts()`
//     resolves every pending prompt as cancelled.
//   * `HkBlockingToast.tsx` — the per-variant glyph, the confirm label
//     (falling back to `hikari::blockingToast.confirm`), the cancel label
//     (falling back to `hikari::blockingToast.cancel`), `role="alertdialog"`
//     with `aria-label = title ?? message`, the confirm button taking the
//     `danger` variant on the danger card, and the shared confirmation
//     button ORDER: primary action first (left), dismiss second (right).
//
// The promise → callback mapping (Vue `showBlockingToast` returns
// `Promise<boolean>`; Rust has no awaitable here):
//
//   resolve(true)   → [`BlockingToastOptions::on_confirm`]
//   resolve(false)  → [`BlockingToastOptions::on_cancel`]
//   timeout expiry   → [`BlockingToastOptions::on_timeout`]
//
// Vue cannot tell "cancel" from "timeout" — both resolve `false`. The mirror
// keeps them apart because a timeout usually wants different copy/telemetry;
// pass the same handler to both if you want the Vue shape back.
//
// Adaptation deltas vs Vue (deliberate, listed instead of hidden):
//   * TELEPORT / POPUP MANAGER — the container is rendered in place (the
//     sheet makes it `position: fixed`) and cards carry NO per-card inline
//     z-index: Vue takes one from `usePopupManager` so newer cards paint
//     above older ones. The sheet's `--hk-overlay-z-blocking-toast` band is
//     the whole ordering here, so sibling cards stack in DOM order.
//   * TRANSITIONS / leave pinning — the `hk-blocking-toast-enter/leave/move`
//     classes and `pinLeaveGeometry` are not reproduced: a settled card is
//     gone on the next render, so there is no leaving box to freeze.
//   * BUTTONS — Vue renders `<HButton>`; the Rust `Button` is still the
//     legacy `hk-button-*` component, so the card emits the `hk-btn*`
//     contract the mirror sheet targets directly. Swap in `Button` once the
//     Button mirror lands.
//   * TIMEOUT — the auto-cancel timer rides `dom_ops::set_timeout`; a host
//     with no timer op (SSR / unit tests) never fires it, so a card without
//     a manual answer stays open there (Vue always has a timer).
//   * SETTLE ORDER — the host handler runs AFTER the card is removed (Vue
//     splices the queue and then resolves the promise), so a throwing
//     handler can never leave a dead card on screen.

use std::cell::{Cell, RefCell};
use std::collections::HashMap;

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};
use tairitsu_vdom::dom_ops::{clear_timeout, set_timeout};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct BlockingToastComponent;

/// Card glyph size (Vue: `ICON_SIZE = 18`).
pub const BLOCKING_TOAST_ICON_PX: u32 = 18;

/// Card tones (Vue: `BlockingToastVariant = "info" | "warning" | "danger"`,
/// default `info`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum BlockingToastVariant {
    #[default]
    Info,
    Warning,
    Danger,
}

impl BlockingToastVariant {
    /// The `hk-blocking-toast-{variant}` modifier class exactly as Vue
    /// emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            BlockingToastVariant::Info => "hk-blocking-toast-info",
            BlockingToastVariant::Warning => "hk-blocking-toast-warning",
            BlockingToastVariant::Danger => "hk-blocking-toast-danger",
        }
    }

    /// The card glyph (Vue: `renderIcon`).
    ///
    /// Delta vs Vue (documented): lucide `XCircle` has no packed MDI twin;
    /// the danger card renders `MdiIcon::Alert`.
    pub fn default_icon(self) -> MdiIcon {
        match self {
            BlockingToastVariant::Info => MdiIcon::Information,
            BlockingToastVariant::Warning => MdiIcon::AlertTriangle,
            BlockingToastVariant::Danger => MdiIcon::Alert,
        }
    }

    /// The confirm button classes. Vue passes
    /// `variant={item.variant === "danger" ? "danger" : "primary"}` to
    /// `HButton size="sm"`, so info/warning confirm as `primary`.
    pub fn confirm_button_class(self) -> &'static str {
        match self {
            BlockingToastVariant::Danger => "hk-btn hk-btn-danger hk-btn-sm",
            BlockingToastVariant::Info | BlockingToastVariant::Warning => {
                "hk-btn hk-btn-primary hk-btn-sm"
            }
        }
    }

    /// The cancel button classes (Vue: `HButton variant="secondary"
    /// size="sm"`).
    pub fn cancel_button_class(self) -> &'static str {
        "hk-btn hk-btn-secondary hk-btn-sm"
    }
}

/// The outcome of a settled gate. Vue only knows `true`/`false`; the mirror
/// keeps the timeout separate (see the header's mapping table).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BlockingToastOutcome {
    Confirmed,
    Cancelled,
    TimedOut,
}

/// Per-call options (Vue: `BlockingToastOptions`) plus the callback wiring
/// that replaces Vue's promise.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BlockingToastOptions {
    /// Bold lead-in line (e.g. "Join group?").
    pub title: Option<String>,
    /// Confirm label; falls back to `hikari::blockingToast.confirm`.
    pub confirm_label: Option<String>,
    /// Cancel label; falls back to `hikari::blockingToast.cancel`.
    pub cancel_label: Option<String>,
    /// Card tone.
    pub variant: BlockingToastVariant,
    /// Auto-cancel delay in ms. `None` / `Some(0)` blocks until answered.
    pub timeout_ms: Option<u64>,
    /// Runs when the user confirms.
    pub on_confirm: Option<Callback<()>>,
    /// Runs when the user cancels.
    pub on_cancel: Option<Callback<()>>,
    /// Runs when `timeout_ms` expires (Vue would resolve `false`).
    pub on_timeout: Option<Callback<()>>,
}

/// One pending prompt (Vue: `BlockingToastItem`). The callbacks ride along
/// so the host can settle the gate without a resolver table.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BlockingToastItem {
    pub id: u64,
    pub message: String,
    pub title: Option<String>,
    pub confirm_label: Option<String>,
    pub cancel_label: Option<String>,
    pub variant: BlockingToastVariant,
    pub timeout_ms: Option<u64>,
    pub on_confirm: Option<Callback<()>>,
    pub on_cancel: Option<Callback<()>>,
    pub on_timeout: Option<Callback<()>>,
}

impl BlockingToastItem {
    /// The confirm button label (Vue: `item.confirmLabel ??
    /// t("hikari::blockingToast.confirm", "Confirm")`).
    pub fn confirm_label_text(&self) -> String {
        self.confirm_label
            .clone()
            .unwrap_or_else(|| t("hikari::blockingToast.confirm", "Confirm"))
    }

    /// The cancel button label (Vue: `item.cancelLabel ??
    /// t("hikari::blockingToast.cancel", "Cancel")`).
    pub fn cancel_label_text(&self) -> String {
        self.cancel_label
            .clone()
            .unwrap_or_else(|| t("hikari::blockingToast.cancel", "Cancel"))
    }

    /// `aria-label` of the card: the title wins, the message is the fallback
    /// (Vue: `aria-label={item.title ?? item.message}`).
    pub fn aria_label(&self) -> String {
        self.title.clone().unwrap_or_else(|| self.message.clone())
    }

    fn callback_for(&self, outcome: BlockingToastOutcome) -> Option<Callback<()>> {
        match outcome {
            BlockingToastOutcome::Confirmed => self.on_confirm.clone(),
            BlockingToastOutcome::Cancelled => self.on_cancel.clone(),
            BlockingToastOutcome::TimedOut => self.on_timeout.clone(),
        }
    }
}

/// The auto-cancel delay that actually arms a timer: `Some(0)` means "no
/// timeout" in Vue (`const timeout = opts.timeoutMs ?? 0; if (timeout > 0)`).
pub fn blocking_toast_timeout_ms(timeout_ms: Option<u64>) -> Option<u64> {
    match timeout_ms {
        Some(ms) if ms > 0 => Some(ms),
        _ => None,
    }
}

struct BlockingToastQueueInner {
    /// The stacked prompts. A [`Signal`] so a show/settle re-renders the
    /// host that read it (mirror of Vue's `reactive({ queue })`).
    queue: Signal<Vec<BlockingToastItem>>,
    /// Prompt id → auto-cancel timer handle.
    timers: RefCell<HashMap<u64, i32>>,
    next_id: Cell<u64>,
}

thread_local! {
    /// The process-wide gate queue: Vue keeps the same thing as the
    /// module-level `state` of `useBlockingToast.ts`.
    static QUEUE: BlockingToastQueueInner = BlockingToastQueueInner::new();
}

impl BlockingToastQueueInner {
    fn new() -> Self {
        Self {
            queue: Signal::new(Vec::new()),
            timers: RefCell::new(HashMap::new()),
            next_id: Cell::new(0),
        }
    }

    fn snapshot(&self) -> Vec<BlockingToastItem> {
        self.queue.get()
    }

    fn show(&self, message: &str, options: BlockingToastOptions) -> u64 {
        let id = self.next_id.get() + 1;
        self.next_id.set(id);

        let timeout = blocking_toast_timeout_ms(options.timeout_ms);
        let mut queue = self.snapshot();
        queue.push(BlockingToastItem {
            id,
            message: message.to_string(),
            title: options.title,
            confirm_label: options.confirm_label,
            cancel_label: options.cancel_label,
            variant: options.variant,
            timeout_ms: timeout,
            on_confirm: options.on_confirm,
            on_cancel: options.on_cancel,
            on_timeout: options.on_timeout,
        });
        self.queue.set(queue);

        if let Some(delay) = timeout {
            let delay = delay.min(i32::MAX as u64) as i32;
            let timer = set_timeout(
                Box::new(move || {
                    QUEUE.with(|queue| queue.settle(id, BlockingToastOutcome::TimedOut));
                }),
                delay,
            );
            if timer != 0 {
                self.timers.borrow_mut().insert(id, timer);
            }
        }
        id
    }

    fn settle(&self, id: u64, outcome: BlockingToastOutcome) {
        let mut queue = self.snapshot();
        let Some(index) = queue.iter().position(|item| item.id == id) else {
            // Unknown ids are silent no-ops (already answered / never shown).
            return;
        };
        let item = queue.remove(index);
        self.queue.set(queue);
        if let Some(timer) = self.timers.borrow_mut().remove(&id) {
            clear_timeout(timer);
        }
        // The card is already gone: a throwing handler cannot leave it up.
        if let Some(handler) = item.callback_for(outcome) {
            handler.call(());
        }
    }

    fn clear(&self) {
        let ids: Vec<u64> = self.snapshot().iter().map(|item| item.id).collect();
        for id in ids {
            self.settle(id, BlockingToastOutcome::Cancelled);
        }
    }
}

/// Handle to the shared gate queue — the Rust equivalent of the object
/// `useBlockingToast()` returns.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct BlockingToastStore;

impl BlockingToastStore {
    /// The stacked prompts, oldest first. Reading it subscribes the calling
    /// component.
    pub fn queue(&self) -> Vec<BlockingToastItem> {
        QUEUE.with(|queue| queue.snapshot())
    }

    /// Vue's `showBlockingToast`: stack one prompt, arm its optional
    /// auto-cancel, return the prompt id.
    pub fn show(&self, message: &str, options: BlockingToastOptions) -> u64 {
        QUEUE.with(|queue| queue.show(message, options))
    }

    /// Vue's `resolveBlockingToast(id, value)`.
    pub fn resolve(&self, id: u64, confirmed: bool) {
        QUEUE.with(|queue| {
            queue.settle(
                id,
                if confirmed {
                    BlockingToastOutcome::Confirmed
                } else {
                    BlockingToastOutcome::Cancelled
                },
            )
        });
    }

    /// Vue's `clearBlockingToasts`: settle every pending prompt as cancelled.
    pub fn clear(&self) {
        QUEUE.with(|queue| queue.clear());
    }
}

/// The Rust equivalent of `useBlockingToast()`.
pub fn use_blocking_toast() -> BlockingToastStore {
    BlockingToastStore
}

/// Vue's `showBlockingToast` — the free-function form the Vue module
/// exports (the promise becomes [`BlockingToastOptions`]' callbacks).
pub fn show_blocking_toast(message: &str, options: BlockingToastOptions) -> u64 {
    use_blocking_toast().show(message, options)
}

/// Vue's `resolveBlockingToast`.
pub fn resolve_blocking_toast(id: u64, confirmed: bool) {
    use_blocking_toast().resolve(id, confirmed);
}

/// Vue's `clearBlockingToasts`.
pub fn clear_blocking_toasts() {
    use_blocking_toast().clear();
}

/// Host props. Vue's `HkBlockingToast` takes NO props (it renders the
/// queue), so `items` is the presentational override and `class` is the
/// host-side seam.
#[define_props]
pub struct BlockingToastProps {
    /// Render exactly these cards instead of the shared queue (keeps the
    /// card layer usable standalone / in tests). `None` — the Vue default —
    /// renders `use_blocking_toast().queue()`.
    pub items: Option<Vec<BlockingToastItem>>,

    #[default]
    pub class: String,
}

/// One card (Vue: `HkBlockingToastCard`), split out so a host can render a
/// card without the queue.
#[define_props]
pub struct BlockingToastCardProps {
    pub item: BlockingToastItem,

    /// Fired with `true` on confirm and `false` on cancel (Vue: the
    /// `confirm` / `cancel` emits).
    pub on_resolve: Option<Callback<bool>>,
}

#[component]
pub fn BlockingToastCard(props: BlockingToastCardProps) -> Element {
    let item = props.item;
    let variant = item.variant;
    let title = item.title.clone();
    let message = item.message.clone();
    let aria_label = item.aria_label();
    let confirm_label = item.confirm_label_text();
    let cancel_label = item.cancel_label_text();
    let confirm_class = variant.confirm_button_class();
    let cancel_class = variant.cancel_button_class();
    let on_resolve_confirm = props.on_resolve.clone();
    let on_resolve_cancel = props.on_resolve;

    let card_class = format!("hk-blocking-toast-card {}", variant.class_name());
    let icon = variant.default_icon();

    rsx! {
        div {
            class: card_class,
            "role": "alertdialog",
            "aria-label": aria_label,
            span { class: "hk-blocking-toast-icon",
                Icon {
                    icon,
                    size: BLOCKING_TOAST_ICON_PX,
                }
            }
            div { class: "hk-blocking-toast-body",
                if let Some(title) = title {
                    strong { class: "hk-blocking-toast-title",
                        "{title}"
                    }
                }
                p { class: "hk-blocking-toast-message",
                    "{message}"
                }
                div { class: "hk-blocking-toast-actions",
                    button {
                        class: confirm_class,
                        "type": "button",
                        onclick: move |_| {
                            if let Some(handler) = on_resolve_confirm.as_ref() {
                                handler.call(true);
                            }
                        },
                        span { class: "hk-btn-label",
                            "{confirm_label}"
                        }
                    }
                    button {
                        class: cancel_class,
                        "type": "button",
                        onclick: move |_| {
                            if let Some(handler) = on_resolve_cancel.as_ref() {
                                handler.call(false);
                            }
                        },
                        span { class: "hk-btn-label",
                            "{cancel_label}"
                        }
                    }
                }
            }
        }
    }
}

#[component]
pub fn BlockingToast(props: BlockingToastProps) -> Element {
    let store = use_blocking_toast();
    let items = props.items.unwrap_or_else(|| store.queue());

    let container_class = if props.class.is_empty() {
        String::from("hk-blocking-toast-container")
    } else {
        format!("hk-blocking-toast-container {}", props.class)
    };

    // Build the cards eagerly (Vue: `<div :key>` per queue item inside the
    // TransitionGroup). The slot wrapper is the DOM node the sheet's
    // `.hk-blocking-toast-slot` pointer-events rule targets.
    let cards: Vec<Element> = items
        .iter()
        .map(|item| {
            let id = item.id;
            let on_resolve = Callback::new(move |confirmed: bool| {
                store.resolve(id, confirmed);
            });
            let card = BlockingToastCard(BlockingToastCardProps {
                item: item.clone(),
                on_resolve: Some(on_resolve),
            });
            rsx! {
                div { class: "hk-blocking-toast-slot",
                    {card}
                }
            }
        })
        .collect();

    rsx! {
        div { class: container_class,
            div {
                {VNode::Fragment(cards)}
            }
        }
    }
}

impl StyledComponent for BlockingToastComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-blocking-toast*` names literal so this CSS matches the Vue
        // build — including the `.hk-btn-*` recoloring hooks it carries).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkBlockingToast.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "blocking-toast"
    }
}

#[cfg(test)]
mod tests {
    use std::rc::Rc;

    use super::*;

    fn counting_callback() -> (Callback<()>, Rc<Cell<usize>>) {
        let counter = Rc::new(Cell::new(0));
        let for_handler = counter.clone();
        let handler = Callback::new(move |_| {
            for_handler.set(for_handler.get() + 1);
        });
        (handler, counter)
    }

    #[test]
    fn blocking_toast_variant_class_names_match_the_vue_modifiers() {
        assert_eq!(
            BlockingToastVariant::Info.class_name(),
            "hk-blocking-toast-info"
        );
        assert_eq!(
            BlockingToastVariant::Warning.class_name(),
            "hk-blocking-toast-warning"
        );
        assert_eq!(
            BlockingToastVariant::Danger.class_name(),
            "hk-blocking-toast-danger"
        );
    }

    #[test]
    fn blocking_toast_confirm_button_follows_the_card_tone() {
        // Vue: variant === "danger" ? "danger" : "primary", size "sm".
        assert_eq!(
            BlockingToastVariant::Danger.confirm_button_class(),
            "hk-btn hk-btn-danger hk-btn-sm"
        );
        assert_eq!(
            BlockingToastVariant::Info.confirm_button_class(),
            "hk-btn hk-btn-primary hk-btn-sm"
        );
        assert_eq!(
            BlockingToastVariant::Warning.confirm_button_class(),
            "hk-btn hk-btn-primary hk-btn-sm"
        );
        assert_eq!(
            BlockingToastVariant::Info.cancel_button_class(),
            "hk-btn hk-btn-secondary hk-btn-sm"
        );
    }

    #[test]
    fn blocking_toast_defaults_match_the_vue_options() {
        let options = BlockingToastOptions::default();
        assert_eq!(options.variant, BlockingToastVariant::Info);
        assert!(options.title.is_none());
        assert!(options.timeout_ms.is_none());
        assert!(options.on_confirm.is_none());
        assert!(options.on_cancel.is_none());
        assert!(options.on_timeout.is_none());

        // Vue's host takes no props; the mirror only adds the override/class.
        let props = BlockingToastProps::default();
        assert!(props.items.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn blocking_toast_timeout_only_arms_above_zero() {
        assert_eq!(blocking_toast_timeout_ms(None), None);
        assert_eq!(blocking_toast_timeout_ms(Some(0)), None);
        assert_eq!(blocking_toast_timeout_ms(Some(1_500)), Some(1_500));
    }

    #[test]
    fn blocking_toast_item_labels_fall_back_to_i18n() {
        let mut item = BlockingToastItem {
            message: String::from("join this group?"),
            title: Some(String::from("Join group?")),
            ..Default::default()
        };
        // Explicit labels win.
        item.confirm_label = Some(String::from("Yep"));
        item.cancel_label = Some(String::from("Nope"));
        assert_eq!(item.confirm_label_text(), "Yep");
        assert_eq!(item.cancel_label_text(), "Nope");
        // The aria label is the title, or the message when there is none.
        assert_eq!(item.aria_label(), "Join group?");
        item.title = None;
        assert_eq!(item.aria_label(), "join this group?");
        // Unset labels resolve through the i18n fallbacks.
        item.confirm_label = None;
        item.cancel_label = None;
        assert_eq!(item.confirm_label_text(), "Confirm");
        assert_eq!(item.cancel_label_text(), "Cancel");
    }

    #[test]
    fn blocking_toast_store_stacks_and_settles_each_prompt_independently() {
        let store = use_blocking_toast();
        store.clear();

        let (on_confirm, confirmed) = counting_callback();
        let (on_cancel, cancelled) = counting_callback();
        let (on_timeout, timed_out) = counting_callback();

        let first = store.show(
            "first gate",
            BlockingToastOptions {
                on_confirm: Some(on_confirm),
                on_cancel: Some(on_cancel),
                on_timeout: Some(on_timeout),
                ..Default::default()
            },
        );
        let second = store.show("second gate", BlockingToastOptions::default());
        assert_eq!(
            store.queue().len(),
            2,
            "prompts stack, they do not serialize"
        );

        store.resolve(first, true);
        assert_eq!(confirmed.get(), 1);
        assert_eq!(cancelled.get(), 0);
        assert_eq!(timed_out.get(), 0);
        assert_eq!(store.queue().len(), 1);
        assert_eq!(store.queue()[0].id, second);

        // A second answer on the same prompt is a silent no-op.
        store.resolve(first, false);
        assert_eq!(cancelled.get(), 0);

        // The second prompt carried no callbacks, so cancelling it just
        // clears the queue without firing anything.
        store.resolve(second, false);
        assert_eq!(cancelled.get(), 0);
        assert!(store.queue().is_empty());
        store.clear();
    }

    #[test]
    fn blocking_toast_clear_settles_every_prompt_as_cancelled() {
        let store = use_blocking_toast();
        store.clear();
        let (on_cancel, cancelled) = counting_callback();
        store.show(
            "gate",
            BlockingToastOptions {
                on_cancel: Some(on_cancel),
                ..Default::default()
            },
        );
        store.clear();
        assert_eq!(cancelled.get(), 1);
        assert!(store.queue().is_empty());
    }

    #[test]
    fn blocking_toast_styles_come_from_the_canonical_vue_sheet() {
        let css = BlockingToastComponent::styles();
        for class_name in [
            ".hk-blocking-toast-container",
            ".hk-blocking-toast-slot",
            ".hk-blocking-toast-card",
            ".hk-blocking-toast-actions",
            ".hk-btn-primary",
        ] {
            assert!(
                css.contains(class_name),
                "blocking toast css must come from the vue-mirror sheet (missing {class_name})"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored blocking-toast sheet"
        );
    }
}
