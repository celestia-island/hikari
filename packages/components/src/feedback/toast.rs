// hi-components/src/feedback/toast.rs
// Toast — mirror of the canonical Vue `HkToast` (the transient corner
// stack) PLUS the Rust equivalent of its runtime store (`useToast.ts`).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkToast.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-toast*`
// class names are literal and identical in both forms. The DOM contract
// below mirrors the Vue render output one-to-one:
//
//   div.hk-toast-container                          (fixed top-right column)
//     div                                           (the TransitionGroup host)
//       div.hk-toast-item .hk-toast-{type} role aria-live
//         span.hk-toast-icon
//              → div.hk-toast-loading-spinner       (type == loading)
//              → Icon                               (every other type)
//         div.hk-toast-body
//           span.hk-toast-message [title]           (rotation-gated text)
//           span.hk-toast-count                     (only when count > 1)
//         button.hk-toast-action                    (`slot.action`)
//         button.hk-toast-copy-btn [title]          (`slot.copyable`)
//         button.hk-toast-close [aria-label]
//
// The semantics below are TAKEN FROM the Vue sources, not invented here:
//
//   * `packages/vue/src/runtime/useToast.ts` — slot AGGREGATION by type (one
//     slot per type, `findSlot`), the per-type default duration
//     (`TOAST_DURATION`: error/warning 30s, success/info 3s, loading never),
//     `defaultCopyable` (error/warning only), the consecutive-duplicate
//     DEDUPE (an identical message replaces the previous entry instead of
//     appending, and the dismiss clock restarts), the
//     `MAX_TOASTS_PER_SLOT = 5` cap that DROPS THE OLDEST message, "the
//     latest push owns the action" (`slot.action = options.action`, so a
//     plain message clears the button), the auto-dismiss timer RESTARTED on
//     every push (`scheduleAutoDismiss`), and `remove()`'s two-step id
//     lookup (slot id first, then the slot holding that message id).
//   * `packages/vue/src/components/HkToast.tsx` — the out-in message
//     ROTATION GATE ("do not advance while a swap animation is in flight":
//     `tryAdvance` + `onMsgAfterEnter`), the count label
//     `renderCountLabel(count, unit) = "{count} {unit}"`, the copy payload
//     `messages.map(m => m.text).join("\n\n")`, and the live-region mapping
//     (error → `role="alert"` + `aria-live="assertive"`; every other type →
//     `role="status"` + `aria-live="polite"`).
//   * `HkToastItem.handleAction` — the inline action REMOVES the toast FIRST
//     and runs the host handler SECOND (a throwing handler can never keep a
//     dismissed toast alive) and fires at most once.
//
// Adaptation deltas vs Vue (the Vue-side mechanisms have no tairitsu twin;
// each delta is deliberate and listed here instead of hidden in the code):
//
//   * TELEPORT — Vue mounts the stack into `ensureOverlayRoot()`. The Rust
//     host renders in place: `.hk-toast-container` is `position: fixed`, so
//     it escapes layout anyway; only the overlay root's `isolation`
//     stacking fence is lost.
//   * TRANSITIONS / leave pinning — the `hk-toast-enter/leave/move` classes
//     and `pinLeaveGeometry` are not reproduced: a removed slot is gone on
//     the next render, so there is no leaving box to freeze (the sheet's
//     transition classes stay dead weight in the bundle).
//   * ROTATION WINDOW — Vue re-arms the gate from the transition's
//     `onAfterEnter`; the mirror uses the sheet's own swap duration
//     (`--duration-fast`, 0.15s) as that window. A host without a timer op
//     (`dom_ops` unregistered: SSR / unit tests) resolves the window
//     immediately rather than wedging the rotation on the first message.
//   * CLIPBOARD — Vue's item owns a `useClipboard()`; this crate exposes no
//     clipboard op, so the host passes a `Callback<String>` (`on_copy`) and
//     the item hands it the joined text.
//   * POPUP MANAGER — the container z-index rides the sheet's
//     `--hk-overlay-z-toast` fallback (100) instead of a registered band.
//   * ICONS — lucide `XCircle` / `CheckCircle` have no packed MDI twin:
//     error renders `MdiIcon::Alert`, success `MdiIcon::Check` (the same
//     documented delta as the `HkAlert` mirror). `loading` renders the
//     sheet's own spinner div, exactly like Vue.
//   * STATE HOME — the store's rotation state lives in the module-level
//     store (not in per-item hooks) so it survives the parent re-render that
//     a tairitsu `use_signal` write triggers; Vue keeps it in the item's
//     component instance.
//
// Replaces the retired legacy `Toast` (Glow wrapper, `--hi-*` variant table,
// `position` prop, white-100 icon tint, no store/aggregation/auto-dismiss).

use std::cell::{Cell, RefCell};
use std::collections::HashMap;

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};
use tairitsu_vdom::dom_ops::{clear_timeout, set_timeout};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ToastComponent;

/// Hard cap on stacked messages per slot (Vue: `MAX_TOASTS_PER_SLOT`). Past
/// it the OLDEST messages are dropped, so a noisy caller cannot bury the
/// surface in unbounded history.
pub const MAX_TOASTS_PER_SLOT: usize = 5;

/// Vue's `LONG_THRESHOLD`. The current Vue render computes `isLong(text)`
/// but never consumes it (the 3-line clamp moved into `.hk-toast-message`),
/// so the mirror keeps the threshold reachable as a pure helper instead of
/// deleting the rule.
pub const TOAST_LONG_THRESHOLD: usize = 50;

/// The out-in message-swap window, in ms (Vue: `.hk-toast-msg-*-active`
/// reads `opacity var(--duration-fast, 0.15s)`).
pub const TOAST_MSG_SWAP_MS: i32 = 150;

/// Icon box inside the item (Vue: `renderIcon(type, size = 18)` and
/// `LoadingSpinner size = 18`).
pub const TOAST_ICON_PX: u32 = 18;

/// Action/copy/close glyph size (Vue: `ACTION_ICON_SIZE = 18`).
pub const TOAST_ACTION_ICON_PX: u32 = 18;

/// The five toast types (Vue: `ToastType = "error" | "success" | "warning" |
/// "info" | "loading"`). `show()` defaults to `info`.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ToastType {
    Error,
    Success,
    Warning,
    #[default]
    Info,
    Loading,
}

impl ToastType {
    /// The `hk-toast-{type}` variant class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            ToastType::Error => "hk-toast-error",
            ToastType::Success => "hk-toast-success",
            ToastType::Warning => "hk-toast-warning",
            ToastType::Info => "hk-toast-info",
            ToastType::Loading => "hk-toast-loading",
        }
    }

    /// Vue's `TOAST_DURATION` table (ms). `0` means "never auto-dismiss".
    pub fn duration_ms(self) -> u64 {
        match self {
            ToastType::Error | ToastType::Warning => 30_000,
            ToastType::Success | ToastType::Info => 3_000,
            ToastType::Loading => 0,
        }
    }

    /// Vue's `isTransient` — the two types that clear themselves quickly.
    pub fn is_transient(self) -> bool {
        matches!(self, ToastType::Success | ToastType::Info)
    }

    /// Vue's `defaultCopyable` — only the two long-lived diagnostic types
    /// expose the copy affordance by default.
    pub fn default_copyable(self) -> bool {
        matches!(self, ToastType::Error | ToastType::Warning)
    }

    /// The item glyph (Vue: `renderIcon`). `None` means the sheet's CSS
    /// spinner (`hk-toast-loading-spinner`) replaces it.
    ///
    /// Delta vs Vue (documented): lucide `XCircle` / `CheckCircle` have no
    /// packed MDI twin — error is `Alert`, success is `Check`, matching the
    /// `HkAlert` mirror's icon delta.
    pub fn default_icon(self) -> Option<MdiIcon> {
        match self {
            ToastType::Error => Some(MdiIcon::Alert),
            ToastType::Success => Some(MdiIcon::Check),
            ToastType::Warning => Some(MdiIcon::AlertTriangle),
            ToastType::Info => Some(MdiIcon::Information),
            ToastType::Loading => None,
        }
    }
}

/// One stacked message in a slot (Vue: `ToastMessage`).
#[derive(Clone, PartialEq, Eq, Debug, Default)]
pub struct ToastMessage {
    pub id: u64,
    pub text: String,
}

/// One inline action button (Vue: `ToastAction`). The action belongs to the
/// CURRENT slot state: every push sets or clears it, so the latest message
/// decides what the button offers. Vue's `onClick` is a plain `() => void`;
/// the mirror takes a [`Callback<()>`] so the host can be a closure.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ToastAction {
    /// Button label (the caller translates it).
    pub label: String,
    /// Runs AFTER the toast is removed. The button is single-shot.
    pub on_click: Option<Callback<()>>,
}

/// One aggregated slot (Vue: `ToastItem`). Messages are grouped per type;
/// `toast_type` is Vue's `type` field (renamed: `type` is a Rust keyword).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ToastSlot {
    pub id: u64,
    pub toast_type: ToastType,
    pub messages: Vec<ToastMessage>,
    /// Dismiss delay in ms; `Some(0)` never auto-dismisses.
    pub duration: Option<u64>,
    pub copyable: bool,
    pub action: Option<ToastAction>,
}

/// Per-call overrides (Vue: the `options` object of `push`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ToastOptions {
    /// Overrides the per-type default duration.
    pub duration: Option<u64>,
    /// `Some(true)` upgrades the slot to copyable; `None` keeps the slot's
    /// current flag (Vue: only an explicit `true` upgrades).
    pub copyable: Option<bool>,
    /// The latest push OWNS the action: `None` clears the button.
    pub action: Option<ToastAction>,
}

/// The pure, stringly parts of the mirror, extracted so the reuse rules are
/// testable without a DOM.
///
/// Vue's `renderCountLabel`: `"{count} {unit}"`.
pub fn toast_count_label(count: usize, unit: &str) -> String {
    format!("{count} {unit}")
}

/// Vue's `handleCopy` payload: every stacked message joined by a blank line.
pub fn toast_copy_text(messages: &[ToastMessage]) -> String {
    messages
        .iter()
        .map(|m| m.text.as_str())
        .collect::<Vec<_>>()
        .join("\n\n")
}

/// Vue's `latestMsgId`: the newest message in the slot, if any.
pub fn toast_latest_message_id(messages: &[ToastMessage]) -> Option<u64> {
    messages.last().map(|m| m.id)
}

/// Vue's `isLong` (`text.length > LONG_THRESHOLD`). Counts scalar values,
/// not UTF-16 code units — delta only for astral-plane text.
pub fn toast_is_long(text: &str) -> bool {
    text.chars().count() > TOAST_LONG_THRESHOLD
}

/// Vue's `scheduleAutoDismiss` delay: the slot's `duration` wins, otherwise
/// the type default; `None` when the delay is zero (never dismisses).
pub fn toast_auto_dismiss_ms(toast_type: ToastType, duration: Option<u64>) -> Option<u64> {
    let ms = duration.unwrap_or_else(|| toast_type.duration_ms());
    if ms == 0 { None } else { Some(ms) }
}

/// The outcome of one rotation-gate evaluation (Vue: `tryAdvance`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ToastRotation {
    /// Keep rendering the current message (a swap is in flight, or nothing
    /// new arrived).
    Hold,
    /// Swap the displayed message to this id and open a new window.
    Advance(u64),
}

/// The out-in rotation gate, verbatim from Vue's `tryAdvance`:
/// "if animating → return; if latest is null or already displayed → return;
/// otherwise display latest and mark animating".
pub fn toast_rotation_step(
    animating: bool,
    displayed: Option<u64>,
    latest: Option<u64>,
) -> ToastRotation {
    if animating {
        return ToastRotation::Hold;
    }
    match latest {
        None => ToastRotation::Hold,
        Some(id) if Some(id) == displayed => ToastRotation::Hold,
        Some(id) => ToastRotation::Advance(id),
    }
}

/// Per-slot rotation state (Vue: `HkToastItem`'s `displayedMsgId` +
/// `animating` refs, moved into the store so it survives a re-render).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
struct RotationState {
    displayed: Option<u64>,
    animating: bool,
}

/// The store behind the stack — the Rust equivalent of `useToast.ts`'s
/// module-level `state`. One instance per thread (wasm: the only thread);
/// every `Toast` host renders from it and every helper mutates it.
struct ToastStoreInner {
    /// The rendered snapshot. A [`Signal`] so writing it re-renders every
    /// host that read it (the mirror of Vue's `reactive(state)`).
    slots: Signal<Vec<ToastSlot>>,
    rotation: RefCell<HashMap<u64, RotationState>>,
    /// Slot id → auto-dismiss timer handle.
    dismiss_timers: RefCell<HashMap<u64, i32>>,
    /// Slot id → message-swap window timer handle.
    swap_timers: RefCell<HashMap<u64, i32>>,
    next_slot_id: Cell<u64>,
    next_message_id: Cell<u64>,
}

thread_local! {
    /// The process-wide toast store: Vue keeps the same thing as the
    /// module-level `state` of `useToast.ts`.
    static STORE: ToastStoreInner = ToastStoreInner::new();
    /// Slots whose inline action has already fired (the Vue item's local
    /// `actionFired` single-shot flag — kept here because tairitsu 0.5.22
    /// component-local state is render-scoped).
    static FIRED_ACTION_SLOTS: std::cell::RefCell<std::collections::HashSet<u64>> =
        std::cell::RefCell::new(std::collections::HashSet::new());
}

fn fired_action_slots() -> &'static std::cell::RefCell<std::collections::HashSet<u64>> {
    // Leak-free handle to the thread-local registry: the closure keeps the
    // RefCell alive for the process (wasm is single-threaded).
    FIRED_ACTION_SLOTS.with(|slot| unsafe {
        // SAFETY: the thread-local outlives every caller on the single
        // wasm thread; the reference is never used across threads.
        &*(slot as *const _)
    })
}

impl ToastStoreInner {
    fn new() -> Self {
        Self {
            slots: Signal::new(Vec::new()),
            rotation: RefCell::new(HashMap::new()),
            dismiss_timers: RefCell::new(HashMap::new()),
            swap_timers: RefCell::new(HashMap::new()),
            next_slot_id: Cell::new(0),
            next_message_id: Cell::new(0),
        }
    }

    fn snapshot(&self) -> Vec<ToastSlot> {
        self.slots.get()
    }

    /// Re-publish the current snapshot so dependent hosts re-render. Used
    /// when only the rotation state changed (the slots are unchanged).
    fn notify(&self) {
        let slots = self.slots.get();
        self.slots.set(slots);
    }

    fn next_slot_id(&self) -> u64 {
        let id = self.next_slot_id.get() + 1;
        self.next_slot_id.set(id);
        id
    }

    fn next_message_id(&self) -> u64 {
        let id = self.next_message_id.get() + 1;
        self.next_message_id.set(id);
        id
    }

    fn push(&self, toast_type: ToastType, text: &str, options: ToastOptions) -> u64 {
        let mut slots = self.snapshot();
        let message_id;

        let index = match slots.iter().position(|s| s.toast_type == toast_type) {
            Some(index) => {
                // Aggregation: the slot already exists — refresh the
                // per-slot affordances, then append (or dedupe) the message.
                let slot = &mut slots[index];
                if options.copyable == Some(true) && !slot.copyable {
                    slot.copyable = true;
                }
                // Latest push owns the action (a plain message clears it).
                slot.action = options.action.clone();
                match slot.messages.last() {
                    Some(last) if last.text == text => {
                        // Consecutive duplicate: keep the single entry, reuse
                        // its id (the dismiss clock restarts below).
                        message_id = last.id;
                    }
                    _ => {
                        message_id = self.next_message_id();
                        slot.messages.push(ToastMessage {
                            id: message_id,
                            text: text.to_string(),
                        });
                    }
                }
                index
            }
            None => {
                let slot_id = self.next_slot_id();
                message_id = self.next_message_id();
                slots.push(ToastSlot {
                    id: slot_id,
                    toast_type,
                    messages: vec![ToastMessage {
                        id: message_id,
                        text: text.to_string(),
                    }],
                    duration: Some(options.duration.unwrap_or_else(|| toast_type.duration_ms())),
                    copyable: options
                        .copyable
                        .unwrap_or_else(|| toast_type.default_copyable()),
                    action: options.action.clone(),
                });
                slots.len() - 1
            }
        };

        // Cap: drop the oldest messages beyond the per-slot limit.
        while slots[index].messages.len() > MAX_TOASTS_PER_SLOT {
            slots[index].messages.remove(0);
        }

        let slot_id = slots[index].id;
        let duration = slots[index].duration;
        self.slots.set(slots);
        // Vue restarts the dismiss clock on EVERY push (`scheduleAutoDismiss`).
        self.schedule_dismiss(slot_id, toast_auto_dismiss_ms(toast_type, duration));
        self.try_advance(slot_id);
        message_id
    }

    fn remove(&self, id: u64) {
        let slots = self.snapshot();
        // Vue: a slot id removes that slot; otherwise the id is searched
        // among the messages and its owning slot is removed.
        let target = slots
            .iter()
            .find(|slot| slot.id == id)
            .map(|slot| slot.id)
            .or_else(|| {
                slots
                    .iter()
                    .find(|slot| slot.messages.iter().any(|m| m.id == id))
                    .map(|slot| slot.id)
            });
        if let Some(slot_id) = target {
            self.remove_slot(slot_id);
        }
    }

    fn remove_slot(&self, slot_id: u64) {
        let mut slots = self.snapshot();
        let before = slots.len();
        slots.retain(|slot| slot.id != slot_id);
        if slots.len() == before {
            // Unknown-id no-ops stay silent (Vue: no splice, no pulse).
            return;
        }
        if let Some(timer) = self.dismiss_timers.borrow_mut().remove(&slot_id) {
            clear_timeout(timer);
        }
        if let Some(timer) = self.swap_timers.borrow_mut().remove(&slot_id) {
            clear_timeout(timer);
        }
        self.rotation.borrow_mut().remove(&slot_id);
        self.slots.set(slots);
    }

    fn schedule_dismiss(&self, slot_id: u64, delay_ms: Option<u64>) {
        if let Some(timer) = self.dismiss_timers.borrow_mut().remove(&slot_id) {
            clear_timeout(timer);
        }
        let Some(delay_ms) = delay_ms else {
            return;
        };
        let delay = delay_ms.min(i32::MAX as u64) as i32;
        let timer = set_timeout(
            Box::new(move || {
                STORE.with(|store| store.remove_slot(slot_id));
            }),
            delay,
        );
        if timer != 0 {
            self.dismiss_timers.borrow_mut().insert(slot_id, timer);
        }
    }

    /// The message the rotation gate currently displays (Vue:
    /// `displayedMessage`). A `None` means "no message to show" — either the
    /// slot is empty or the displayed message was dropped by the 5-cap, which
    /// Vue renders as empty text too.
    fn displayed_message(&self, slot: &ToastSlot) -> Option<ToastMessage> {
        let displayed = match self.rotation.borrow().get(&slot.id).copied() {
            Some(state) => state.displayed,
            None => toast_latest_message_id(&slot.messages),
        };
        let id = displayed?;
        slot.messages.iter().find(|m| m.id == id).cloned()
    }

    /// Vue's `tryAdvance`, called on every push and again when a swap window
    /// closes: at most ONE swap per window, always landing on the newest
    /// message.
    fn try_advance(&self, slot_id: u64) {
        let latest = self
            .snapshot()
            .iter()
            .find(|slot| slot.id == slot_id)
            .and_then(|slot| toast_latest_message_id(&slot.messages));
        let state = self
            .rotation
            .borrow()
            .get(&slot_id)
            .copied()
            .unwrap_or_default();
        let ToastRotation::Advance(id) =
            toast_rotation_step(state.animating, state.displayed, latest)
        else {
            return;
        };
        self.rotation.borrow_mut().insert(
            slot_id,
            RotationState {
                displayed: Some(id),
                animating: true,
            },
        );
        let timer = set_timeout(
            Box::new(move || {
                STORE.with(|store| store.finish_swap(slot_id));
            }),
            TOAST_MSG_SWAP_MS,
        );
        if timer == 0 {
            // No timer op on this host (dom_ops unregistered). Resolve the
            // window immediately instead of freezing the rotation.
            self.finish_swap(slot_id);
        } else if let Some(previous) = self.swap_timers.borrow_mut().insert(slot_id, timer) {
            clear_timeout(previous);
        }
    }

    /// Vue's `onMsgAfterEnter`: close the window, then advance again if a
    /// message arrived while it was open.
    fn finish_swap(&self, slot_id: u64) {
        let known = {
            let mut rotation = self.rotation.borrow_mut();
            match rotation.get_mut(&slot_id) {
                Some(state) => {
                    state.animating = false;
                    true
                }
                None => false,
            }
        };
        if !known {
            return;
        }
        let _ = self.swap_timers.borrow_mut().remove(&slot_id);
        self.try_advance(slot_id);
        self.notify();
    }

    fn clear(&self) {
        let dismiss: Vec<i32> = self
            .dismiss_timers
            .borrow_mut()
            .drain()
            .map(|(_, timer)| timer)
            .collect();
        for timer in dismiss {
            clear_timeout(timer);
        }
        let swaps: Vec<i32> = self
            .swap_timers
            .borrow_mut()
            .drain()
            .map(|(_, timer)| timer)
            .collect();
        for timer in swaps {
            clear_timeout(timer);
        }
        self.rotation.borrow_mut().clear();
        self.slots.set(Vec::new());
    }
}

/// Handle to the process-wide toast store — the Rust equivalent of the
/// object `useToast()` returns. Cheap to copy; every method reaches the one
/// shared stack.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct ToastStore;

impl ToastStore {
    /// The current stack, oldest slot first. Reading it subscribes the
    /// calling component, so a later mutation re-renders it.
    pub fn slots(&self) -> Vec<ToastSlot> {
        STORE.with(|store| store.snapshot())
    }

    /// Vue's `push`: aggregate into the slot for `toast_type`, append (or
    /// dedupe) the message, restart the dismiss clock, return the message id.
    pub fn push(&self, toast_type: ToastType, text: &str, options: ToastOptions) -> u64 {
        STORE.with(|store| store.push(toast_type, text, options))
    }

    /// Vue's `show`: push with an explicit type (defaults to `info`).
    pub fn show(&self, text: &str, options: ToastOptions) -> u64 {
        self.push(ToastType::Info, text, options)
    }

    pub fn error(&self, text: &str) -> u64 {
        self.push(ToastType::Error, text, ToastOptions::default())
    }

    pub fn success(&self, text: &str) -> u64 {
        self.push(ToastType::Success, text, ToastOptions::default())
    }

    pub fn warning(&self, text: &str) -> u64 {
        self.push(ToastType::Warning, text, ToastOptions::default())
    }

    pub fn info(&self, text: &str) -> u64 {
        self.push(ToastType::Info, text, ToastOptions::default())
    }

    /// Vue's `loading(message, maxDuration = 0)`: no auto-dismiss unless the
    /// caller passes a cap.
    pub fn loading(&self, text: &str, max_duration_ms: u64) -> u64 {
        let mut options = ToastOptions::default();
        if max_duration_ms > 0 {
            options.duration = Some(max_duration_ms);
        }
        self.push(ToastType::Loading, text, options)
    }

    /// Vue's `remove`: a slot id dismisses that slot, a message id dismisses
    /// the slot that owns it.
    pub fn remove(&self, id: u64) {
        STORE.with(|store| store.remove(id));
    }

    /// The rotation-gated message for a slot (see [`toast_rotation_step`]).
    pub fn displayed_message(&self, slot: &ToastSlot) -> Option<ToastMessage> {
        STORE.with(|store| store.displayed_message(slot))
    }

    /// Teardown helper (tests / host shutdown): drop every slot and timer.
    pub fn clear(&self) {
        STORE.with(|store| store.clear());
    }
}

/// The Rust equivalent of `useToast()`: a handle to the shared stack.
pub fn use_toast() -> ToastStore {
    ToastStore
}

/// Host props. Vue's `HkToast` takes NO props (it renders the store), so the
/// only fields here are the host-side seams this port needs: a clipboard
/// sink (see the CLIPBOARD delta) and an extra class on the container.
#[define_props]
pub struct ToastProps {
    /// Copy sink for the per-item copy button: receives the slot's messages
    /// joined by a blank line (Vue: the item's own `useClipboard()`).
    pub on_copy: Option<Callback<String>>,

    #[default]
    pub class: String,
}

/// The presentational item (Vue: `HkToastItem`), split out so a host can
/// render a single item without the store — same sheet, same classes.
#[define_props]
pub struct ToastItemViewProps {
    /// The aggregated slot (Vue: the item's `toast` prop).
    pub slot: ToastSlot,

    /// The message the rotation gate displays (Vue: `displayedMessage`);
    /// `None` renders empty text.
    pub displayed: Option<ToastMessage>,

    /// Fired with the slot id when the ✕ or the inline action dismisses it
    /// (Vue: the `remove` emit).
    pub on_remove: Option<Callback<u64>>,

    /// Fired with the joined text when the copy button is clicked.
    pub on_copy: Option<Callback<String>>,
}

#[component]
pub fn Toast(props: ToastProps) -> Element {
    let store = use_toast();
    let slots = store.slots();

    let container_class = if props.class.is_empty() {
        String::from("hk-toast-container")
    } else {
        format!("hk-toast-container {}", props.class)
    };

    let on_remove = Callback::new(move |id: u64| store.remove(id));
    let on_copy = props.on_copy;

    // Build the items eagerly (Vue: `<HkToastItem v-for>` inside the
    // TransitionGroup); the host's DOM keeps the extra wrapper div the sheet
    // styles as `.hk-toast-container > div`.
    let items: Vec<Element> = slots
        .iter()
        .map(|slot| {
            ToastItemView(ToastItemViewProps {
                slot: slot.clone(),
                displayed: store.displayed_message(slot),
                on_remove: Some(on_remove.clone()),
                on_copy: on_copy.clone(),
            })
        })
        .collect();

    rsx! {
        div { class: container_class,
            div {
                {VNode::Fragment(items)}
            }
        }
    }
}

#[component]
pub fn ToastItemView(props: ToastItemViewProps) -> Element {
    // Vue: `let actionFired = false` — the inline action is single-shot.
    // tairitsu 0.5.22 has no per-instance component state (one hook slot per
    // component TYPE), so the fired flag lives in a module registry keyed by
    // the slot id (stable for the slot's lifetime).
    let action_fired = fired_action_slots().borrow().contains(&props.slot.id);

    let slot = props.slot;
    let slot_id = slot.id;
    let toast_type = slot.toast_type;
    let messages = slot.messages;
    let action = slot.action;
    let copyable = slot.copyable;
    let count = messages.len();

    let text = props
        .displayed
        .as_ref()
        .map(|message| message.text.clone())
        .unwrap_or_default();

    let count_label = if count > 1 {
        Some(toast_count_label(count, &t("hikari::toast.msgs", "msgs")))
    } else {
        None
    };

    // Live-region semantics: errors interrupt (role=alert is assertive),
    // everything else announces politely (role=status).
    let (role, aria_live) = if toast_type == ToastType::Error {
        ("alert", "assertive")
    } else {
        ("status", "polite")
    };

    let item_class = format!("hk-toast-item {}", toast_type.class_name());

    let icon = match toast_type.default_icon() {
        Some(icon) => rsx! {
            Icon {
                icon,
                size: TOAST_ICON_PX,
            }
        },
        None => rsx! {
            div {
                class: "hk-toast-loading-spinner",
                style: format!(
                    "width:{}px;height:{}px",
                    TOAST_ICON_PX, TOAST_ICON_PX
                ),
            }
        },
    };

    let on_remove_action = props.on_remove.clone();
    let on_remove_close = props.on_remove.clone();
    let on_copy_click = props.on_copy.clone();
    let copy_payload = toast_copy_text(&messages);
    // Bound before the rsx: the action button's `onclick` closure takes the
    // action by value, so the label must already live in its own binding.
    let action_label = action
        .as_ref()
        .map(|action| action.label.clone())
        .unwrap_or_default();

    rsx! {
        div {
            class: item_class,
            "role": role,
            "aria-live": aria_live,
            span { class: "hk-toast-icon",
                {icon}
            }
            div { class: "hk-toast-body",
                span {
                    class: "hk-toast-message",
                    title: text.clone(),
                    "{text}"
                }
                if let Some(label) = count_label {
                    span { class: "hk-toast-count",
                        "{label}"
                    }
                }
            }
            if let Some(action) = action {
                button {
                    class: "hk-toast-action",
                    "type": "button",
                    title: action_label.clone(),
                    onclick: move |_| {
                        if action_fired {
                            return;
                        }
                        fired_action_slots().borrow_mut().insert(slot_id);
                        // Remove FIRST, run the handler SECOND: a throwing
                        // handler can never keep a dismissed toast alive.
                        if let Some(handler) = on_remove_action.as_ref() {
                            handler.call(slot_id);
                        }
                        if let Some(handler) = action.on_click.as_ref() {
                            handler.call(());
                        }
                    },
                    "{action_label}"
                }
            }
            if copyable {
                button {
                    class: "hk-toast-copy-btn",
                    "type": "button",
                    title: t("hikari::toast.copy", "Copy"),
                    onclick: move |_| {
                        if let Some(handler) = on_copy_click.as_ref() {
                            handler.call(copy_payload.clone());
                        }
                    },
                    Icon {
                        icon: MdiIcon::ContentCopy,
                        size: TOAST_ACTION_ICON_PX,
                    }
                }
            }
            button {
                class: "hk-toast-close",
                "type": "button",
                "aria-label": t("hikari::toast.close", "Close"),
                onclick: move |_| {
                    if let Some(handler) = on_remove_close.as_ref() {
                        handler.call(slot_id);
                    }
                },
                Icon {
                    icon: MdiIcon::Close,
                    size: TOAST_ACTION_ICON_PX,
                }
            }
        }
    }
}

impl StyledComponent for ToastComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-toast*` names literal so this CSS matches the Vue build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkToast.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "toast"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(id: u64, text: &str) -> ToastMessage {
        ToastMessage {
            id,
            text: text.to_string(),
        }
    }

    #[test]
    fn toast_type_class_names_match_the_vue_modifiers() {
        assert_eq!(ToastType::Error.class_name(), "hk-toast-error");
        assert_eq!(ToastType::Success.class_name(), "hk-toast-success");
        assert_eq!(ToastType::Warning.class_name(), "hk-toast-warning");
        assert_eq!(ToastType::Info.class_name(), "hk-toast-info");
        assert_eq!(ToastType::Loading.class_name(), "hk-toast-loading");
    }

    #[test]
    fn toast_type_durations_match_the_vue_schedule() {
        assert_eq!(ToastType::Error.duration_ms(), 30_000);
        assert_eq!(ToastType::Warning.duration_ms(), 30_000);
        assert_eq!(ToastType::Success.duration_ms(), 3_000);
        assert_eq!(ToastType::Info.duration_ms(), 3_000);
        assert_eq!(ToastType::Loading.duration_ms(), 0);
        assert!(ToastType::Success.is_transient());
        assert!(ToastType::Info.is_transient());
        assert!(!ToastType::Error.is_transient());
        assert!(ToastType::Error.default_copyable());
        assert!(ToastType::Warning.default_copyable());
        assert!(!ToastType::Info.default_copyable());
    }

    #[test]
    fn toast_type_defaults_to_info_and_loading_has_no_icon() {
        assert_eq!(ToastType::default(), ToastType::Info);
        assert_eq!(ToastType::Loading.default_icon(), None);
        assert_eq!(ToastType::Error.default_icon(), Some(MdiIcon::Alert));
        assert_eq!(ToastType::Success.default_icon(), Some(MdiIcon::Check));
    }

    #[test]
    fn toast_host_props_default_matches_the_vue_host() {
        // Vue's HkToast has no props at all; the mirror only adds the
        // clipboard sink (delta) and a container class.
        let props = ToastProps::default();
        assert!(props.on_copy.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn toast_count_label_matches_vues_render_count_label() {
        assert_eq!(toast_count_label(2, "msgs"), "2 msgs");
        assert_eq!(toast_count_label(12, "条消息"), "12 条消息");
    }

    #[test]
    fn toast_copy_text_joins_messages_with_a_blank_line() {
        let messages = vec![message(1, "first"), message(2, "second")];
        assert_eq!(toast_copy_text(&messages), "first\n\nsecond");
        assert_eq!(toast_copy_text(&[]), "");
    }

    #[test]
    fn toast_is_long_uses_the_vue_threshold() {
        assert!(!toast_is_long(&"a".repeat(TOAST_LONG_THRESHOLD)));
        assert!(toast_is_long(&"a".repeat(TOAST_LONG_THRESHOLD + 1)));
    }

    #[test]
    fn toast_auto_dismiss_follows_the_type_default() {
        assert_eq!(toast_auto_dismiss_ms(ToastType::Error, None), Some(30_000));
        assert_eq!(toast_auto_dismiss_ms(ToastType::Success, None), Some(3_000));
        // Explicit duration wins over the type default.
        assert_eq!(
            toast_auto_dismiss_ms(ToastType::Success, Some(9_000)),
            Some(9_000)
        );
        // Zero never auto-dismisses.
        assert_eq!(toast_auto_dismiss_ms(ToastType::Loading, None), None);
        assert_eq!(toast_auto_dismiss_ms(ToastType::Info, Some(0)), None);
    }

    #[test]
    fn toast_rotation_holds_while_animating_and_never_rewinds() {
        // A swap is in flight → hold, even when a newer message waits.
        assert_eq!(
            toast_rotation_step(true, Some(1), Some(2)),
            ToastRotation::Hold
        );
        // Nothing displayed yet, a message arrived → advance.
        assert_eq!(
            toast_rotation_step(false, None, Some(7)),
            ToastRotation::Advance(7)
        );
        // Already showing the latest → hold.
        assert_eq!(
            toast_rotation_step(false, Some(7), Some(7)),
            ToastRotation::Hold
        );
        // Empty slot → hold (and no panic on the dropped-message case).
        assert_eq!(
            toast_rotation_step(false, Some(3), None),
            ToastRotation::Hold
        );
    }

    #[test]
    fn toast_store_aggregates_by_type_and_caps_the_stack_at_five() {
        let store = use_toast();
        store.clear();
        let first = store.info("boom 1");
        store.info("boom 2");
        store.info("boom 3");
        store.info("boom 4");
        store.info("boom 5");
        store.info("boom 6");
        let slots = store.slots();
        assert_eq!(slots.len(), 1, "one slot per type (aggregation)");
        assert_eq!(slots[0].messages.len(), MAX_TOASTS_PER_SLOT);
        // The oldest entries are dropped, so the first id is gone.
        assert!(slots[0].messages.iter().all(|m| m.id != first));
        assert_eq!(
            slots[0].messages.last().map(|m| m.text.as_str()),
            Some("boom 6")
        );
        // A different type opens its own slot.
        store.error("fatal");
        assert_eq!(store.slots().len(), 2);
        store.clear();
    }

    #[test]
    fn toast_store_dedupes_a_consecutive_identical_message() {
        let store = use_toast();
        store.clear();
        let first = store.warning("same text");
        let second = store.warning("same text");
        assert_eq!(first, second, "identical consecutive message reuses its id");
        let slots = store.slots();
        assert_eq!(slots[0].messages.len(), 1);
        // A different text in between makes the repeat a new entry again.
        store.warning("other text");
        let third = store.warning("same text");
        assert_ne!(first, third);
        assert_eq!(store.slots()[0].messages.len(), 3);
        store.clear();
    }

    #[test]
    fn toast_store_latest_push_owns_the_action_and_copyable_upgrades() {
        let store = use_toast();
        store.clear();
        store.info("plain");
        assert!(!store.slots()[0].copyable);
        assert!(store.slots()[0].action.is_none());

        let action = ToastAction {
            label: String::from("Undo"),
            on_click: None,
        };
        store.push(
            ToastType::Info,
            "with action",
            ToastOptions {
                copyable: Some(true),
                action: Some(action.clone()),
                ..Default::default()
            },
        );
        assert!(
            store.slots()[0].copyable,
            "explicit copyable upgrades the slot"
        );
        assert_eq!(store.slots()[0].action, Some(action));

        // A plain message clears the action off the shared slot.
        store.info("plain again");
        assert!(store.slots()[0].action.is_none());
        store.clear();
    }

    #[test]
    fn toast_store_removes_by_slot_id_and_by_message_id() {
        let store = use_toast();
        store.clear();
        let first_message = store.success("saved");
        let second_message = store.success("saved again");
        assert_ne!(first_message, second_message);
        // Two messages in one slot: `second_message` cannot be the slot id,
        // so this exercises the message-id branch of Vue's `remove()`.
        store.remove(second_message);
        assert!(store.slots().is_empty());

        store.info("one");
        let slot_id = store.slots()[0].id;
        store.remove(slot_id);
        assert!(store.slots().is_empty());
        // Unknown ids are silent no-ops.
        store.remove(9_999);
        assert!(store.slots().is_empty());
        store.clear();
    }

    #[test]
    fn toast_store_displayed_message_lands_on_the_newest_without_a_timer_host() {
        let store = use_toast();
        store.clear();
        store.info("first");
        store.info("second");
        let slots = store.slots();
        // With no `dom_ops` timer registered the swap window resolves
        // immediately, so the gate does not wedge on the first message.
        assert_eq!(
            store.displayed_message(&slots[0]).map(|m| m.text),
            Some(String::from("second"))
        );
        store.clear();
        let empty = ToastSlot::default();
        assert!(store.displayed_message(&empty).is_none());
    }

    #[test]
    fn toast_styles_come_from_the_canonical_vue_sheet() {
        let css = ToastComponent::styles();
        for class_name in [
            ".hk-toast-container",
            ".hk-toast-item",
            ".hk-toast-body",
            ".hk-toast-message",
            ".hk-toast-copy-btn",
            ".hk-toast-loading-spinner",
        ] {
            assert!(
                css.contains(class_name),
                "toast css must come from the vue-mirror sheet (missing {class_name})"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored toast sheet"
        );
        // The retired legacy sheet (src/styles/components/toast.scss) had its
        // own `.hk-toast-content` / `.hk-toast-progress` / `.hk-toast-sm`
        // rules; none of them may leak back through the mirror.
        for legacy in [".hk-toast-content", ".hk-toast-progress", ".hk-toast-sm"] {
            assert!(
                !css.contains(legacy),
                "legacy toast sheet markers are retired (found {legacy:?})"
            );
        }
    }
}
