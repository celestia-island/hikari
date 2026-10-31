// hi-components/src/feedback/persistent_toast.rs
// PersistentToast — mirror of the canonical Vue `HkPersistentToast` (the
// chrome-bar status chip with a hover/focus detail card).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkPersistentToast.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-persistent-toast*` class names are literal and identical in both
// forms. The DOM contract below mirrors the Vue render output one-to-one:
//
//   span.hk-persistent-toast-wrap role="status" aria-live="polite"
//        (style: position: relative — card anchor, see the delta list)
//     button|span.hk-persistent-toast .hk-persistent-toast--{tone}
//                   [type=button] [aria-expanded] [aria-haspopup]
//                   [aria-controls]
//       span.hk-persistent-toast__spinner            (tone == loading)
//         — or —
//       Icon .hk-persistent-toast__icon             (every other tone)
//       span.hk-persistent-toast__label
//     button.hk-persistent-toast__dismiss [aria-label]   (when `dismissible`)
//     div.hk-persistent-toast-card.hii-dropdown-content  (when the card is
//         role="group" [aria-label]                       open and `detail`
//                                                         is provided)
//
// The chip tag follows Vue: a `button` when a `detail` slot exists (the chip
// becomes interactive), otherwise a plain `span`.
//
// Behaviour contract taken from the Vue sources, not invented here:
//
//   * `HkPersistentToast.tsx` — `tone="loading"` renders the CSS spinner and
//     every other tone a static glyph; the label truncates and never wraps
//     (sheet). With a `detail` slot the chip becomes a button: HOVER (after
//     `openDelay`) or FOCUS opens the card; moving the pointer onto the card
//     cancels the close (`closeGrace` re-arms it); a click PINS the card, and
//     a click during the hover window promotes in place instead of flickering
//     closed-and-open; Escape closes a pinned card; focus-out closes an
//     unpinned one. `dismissible` renders the ✕ as a SIBLING button (never a
//     child — a button inside a button is dead markup) that emits `dismiss`.
//     The wrap owns `role="status"` + `aria-live="polite"` so label changes
//     announce without stealing focus.
//   * `HkPersistentToastGroup` — see `persistent_toast_group.rs`.
//
// Adaptation deltas vs Vue (deliberate, listed instead of hidden):
//
//   * OUTSIDE CLICK — Vue installs a capture-phase `pointerdown` listener on
//     `document` so a PINNED card closes when the pointer lands outside the
//     chip and card. This crate has no document-level listener seam, so a
//     pinned card closes on: a chip click (toggle), Escape while the chip is
//     focused, or the chip's focus-out. The unpinned grace/outside paths are
//     unchanged. This is the documented degradation, not an oversight.
//   * TELEPORT + POSITIONING — Vue teleports the card to the overlay root and
//     places it with `positionCard()` (nextTick + rAF + getBoundingClientRect,
//     clamped into the viewport with an 8px gutter). The mirror keeps the card
//     inside the chip wrap, makes the wrap `position: relative` and pins the
//     card with `position:absolute; top:calc(100% + 6px); inset-inline-end:0`
//     — the same "below the chip, end-aligned, 6px gap" geometry from CSS
//     instead of a layout read. The 8px viewport clamp and the resize
//     listener are therefore unnecessary and dropped. The card consequently
//     nests a `div` inside the wrap's `span` (paper-invalid, but the card is
//     absolutely positioned and out of flow, exactly like Vue's teleported
//     body-level sibling).
//   * STATE HOME — tairitsu 0.5.22's `use_signal` allocates a fresh signal on
//     EVERY render (no hook slot), so interaction state kept there would reset
//     the very moment it triggers a re-render. The mirror keeps one entry per
//     chip in a module-level registry (the same pattern as the toast store)
//     keyed by `instance_key`, `tone|label` otherwise — two chips in one chrome
//     bar with an identical tone AND label share their open/pinned state, so
//     pass `instance_key` (e.g. the task id) when that can happen. A chip whose
//     label changes while its card is open loses that open state (the key
//     changes).
//   * GLYPH a11y — Vue puts `aria-hidden="true"` on the lucide svg; the packed
//     `hikari_icons::Icon` component renders its own wrapper div and cannot
//     forward attributes, so the decorative glyph may still be announced. The
//     spinner branch does carry `aria-hidden="true"` exactly as Vue does.
//   * CARD SURFACE — the card keeps Vue's `hii-dropdown-content` class, but
//     that glass surface (background/border/shadow) lives in the Vue-side Hii
//     dropdown sheet, not in the vendored toast sheet. Until that sheet (or an
//     equivalent) joins the Rust bundle the card renders with this sheet's
//     geometry, typography and motion only — transparent behind the content.
//
// New file (the family had no Rust counterpart): nothing is replaced.

use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

use hikari_i18n::t;
use hikari_icons::{Icon, MdiIcon};
use tairitsu_vdom::dom_ops::{clear_timeout, set_timeout};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct PersistentToastComponent;

/// Vertical gap between the chip's bottom edge and the detail card (Vue:
/// `CARD_GAP_PX`).
pub const PERSISTENT_TOAST_CARD_GAP_PX: u32 = 6;

/// Chip glyph / ✕ size (Vue: `size={12}` for both).
pub const PERSISTENT_TOAST_ICON_PX: u32 = 12;

/// Vue's default `openDelay` (ms).
pub const PERSISTENT_TOAST_OPEN_DELAY_MS: u32 = 150;

/// Vue's default `closeGrace` (ms).
pub const PERSISTENT_TOAST_CLOSE_GRACE_MS: u32 = 250;

/// The four tones (Vue: `PersistentToastTone = "loading" | "info" | "warning"
/// "error"`, default `info`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum PersistentToastTone {
    Loading,
    #[default]
    Info,
    Warning,
    Error,
}

impl PersistentToastTone {
    /// The `hk-persistent-toast--{tone}` modifier class exactly as Vue emits
    /// it.
    pub fn class_name(self) -> &'static str {
        match self {
            PersistentToastTone::Loading => "hk-persistent-toast--loading",
            PersistentToastTone::Info => "hk-persistent-toast--info",
            PersistentToastTone::Warning => "hk-persistent-toast--warning",
            PersistentToastTone::Error => "hk-persistent-toast--error",
        }
    }

    /// The glyph (Vue: `renderIcon`). `None` means the sheet's CSS spinner
    /// (`hk-persistent-toast__spinner`) replaces it.
    pub fn default_icon(self) -> Option<MdiIcon> {
        match self {
            PersistentToastTone::Loading => None,
            PersistentToastTone::Info => Some(MdiIcon::Information),
            PersistentToastTone::Warning | PersistentToastTone::Error => {
                Some(MdiIcon::AlertTriangle)
            }
        }
    }
}

/// Vue's `onChipKeydown` check: Escape closes a pinned card.
pub fn persistent_toast_is_escape(key: &str) -> bool {
    matches!(Key::from_str(key), Key::Escape)
}

/// The inline geometry that pins the card below the chip — Vue's
/// `positionCard()` result expressed in CSS (see the POSITIONING delta).
pub fn persistent_toast_card_style() -> String {
    format!(
        "position:absolute;top:calc(100% + {}px);inset-inline-end:0",
        PERSISTENT_TOAST_CARD_GAP_PX
    )
}

/// The chip wrap's inline anchor style (needed because the card is absolute).
pub fn persistent_toast_wrap_style() -> &'static str {
    "position:relative;"
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum ChipTimer {
    Open,
    Close,
}

/// One chip's interaction state (Vue: the `open` / `pinned` refs plus the two
/// timer handles, held by the component instance).
struct PersistentToastState {
    /// The stable DOM id for `aria-controls` (Vue: the module-level
    /// `popupSeq` id).
    id: String,
    open: Signal<bool>,
    pinned: Signal<bool>,
    open_timer: Option<i32>,
    close_timer: Option<i32>,
}

thread_local! {
    /// Per-chip state, keyed by the chip's identity string (see the STATE
    /// HOME delta). Entries outlive their chip: they are a handful of booleans
    /// and a String, and a returning chip of the same identity resumes with a
    /// closed card only if nothing re-opens it.
    static CHIP_STATE: RefCell<HashMap<String, PersistentToastState>> =
        RefCell::new(HashMap::new());
}

static CHIP_SEQ: AtomicU64 = AtomicU64::new(0);

/// A cloneable handle to one chip's state: the component reads `open` /
/// `pinned` during render and every event handler gets its own clone.
#[derive(Clone)]
struct ChipHandle {
    key: String,
    id: String,
    open: Signal<bool>,
    pinned: Signal<bool>,
}

fn chip_handle(key: &str) -> ChipHandle {
    CHIP_STATE.with(|states| {
        let mut states = states.borrow_mut();
        let state = states.entry(key.to_string()).or_insert_with(|| {
            let seq = CHIP_SEQ.fetch_add(1, Ordering::Relaxed);
            PersistentToastState {
                id: format!("hk-persistent-toast-{seq}"),
                open: Signal::new(false),
                pinned: Signal::new(false),
                open_timer: None,
                close_timer: None,
            }
        });
        ChipHandle {
            key: key.to_string(),
            id: state.id.clone(),
            open: state.open.clone(),
            pinned: state.pinned.clone(),
        }
    })
}

fn take_chip_timer(key: &str, which: ChipTimer) -> Option<i32> {
    CHIP_STATE.with(|states| {
        let mut states = states.borrow_mut();
        states.get_mut(key).and_then(|state| match which {
            ChipTimer::Open => state.open_timer.take(),
            ChipTimer::Close => state.close_timer.take(),
        })
    })
}

fn store_chip_timer(key: &str, which: ChipTimer, timer: i32) {
    CHIP_STATE.with(|states| {
        let mut states = states.borrow_mut();
        if let Some(state) = states.get_mut(key) {
            match which {
                ChipTimer::Open => state.open_timer = Some(timer),
                ChipTimer::Close => state.close_timer = Some(timer),
            }
        }
    });
}

fn clear_chip_timers(key: &str) {
    if let Some(timer) = take_chip_timer(key, ChipTimer::Open) {
        clear_timeout(timer);
    }
    if let Some(timer) = take_chip_timer(key, ChipTimer::Close) {
        clear_timeout(timer);
    }
}

/// Vue's `openCard(pin)`: cancel both timers, optionally pin, then open.
fn open_card(handle: &ChipHandle, pin: bool) {
    clear_chip_timers(&handle.key);
    if pin {
        handle.pinned.set(true);
    }
    handle.open.set(true);
}

/// Vue's `closeCard(force)`: a pinned card ignores a soft close.
fn close_card(handle: &ChipHandle, force: bool) {
    if handle.pinned.read() && !force {
        return;
    }
    handle.pinned.set(false);
    handle.open.set(false);
    clear_chip_timers(&handle.key);
}

/// Vue's `scheduleOpen` (`openDelay`).
fn schedule_open(handle: &ChipHandle, delay_ms: u32) {
    if let Some(timer) = take_chip_timer(&handle.key, ChipTimer::Open) {
        clear_timeout(timer);
    }
    let next = handle.clone();
    let timer = set_timeout(Box::new(move || open_card(&next, false)), delay_ms as i32);
    if timer == 0 {
        // No timer op on this host: degrade the delay to "immediately"
        // instead of never opening the card.
        open_card(handle, false);
    } else {
        store_chip_timer(&handle.key, ChipTimer::Open, timer);
    }
}

/// Vue's `scheduleClose` (`closeGrace`).
fn schedule_close(handle: &ChipHandle, grace_ms: u32) {
    if let Some(timer) = take_chip_timer(&handle.key, ChipTimer::Close) {
        clear_timeout(timer);
    }
    let next = handle.clone();
    let timer = set_timeout(Box::new(move || close_card(&next, false)), grace_ms as i32);
    if timer == 0 {
        close_card(handle, false);
    } else {
        store_chip_timer(&handle.key, ChipTimer::Close, timer);
    }
}

/// Vue's `cancelClose` (the pointer moved onto the card).
fn cancel_close(handle: &ChipHandle) {
    if let Some(timer) = take_chip_timer(&handle.key, ChipTimer::Close) {
        clear_timeout(timer);
    }
}

/// Vue's `onChipClick`: a pinned card unpins, otherwise the click promotes
/// the (hover-)open card to pinned IN PLACE.
fn toggle_pin(handle: &ChipHandle) {
    if handle.pinned.read() {
        close_card(handle, true);
    } else {
        open_card(handle, true);
    }
}

#[define_props]
pub struct PersistentToastProps {
    /// Chip tone: `loading` renders the spinner, the rest a static glyph.
    #[default]
    pub tone: PersistentToastTone,

    /// Text beside the icon (truncates, never wraps).
    #[default]
    pub label: String,

    /// `aria-label` of the detail card (Vue: `detailLabel`).
    #[default]
    pub detail_label: String,

    /// Render the ✕ affordance beside the chip and fire [`Self::on_dismiss`].
    #[default]
    pub dismissible: bool,

    /// Hover delay before the card opens (ms).
    #[default(150)]
    pub open_delay: u32,

    /// Grace period before the card closes after a hover-out (ms).
    #[default(250)]
    pub close_grace: u32,

    /// The card content (Vue: the `detail` slot). Providing it makes the chip
    /// interactive.
    pub detail: Option<Element>,

    /// Fired when the ✕ is clicked (Vue: the `dismiss` emit).
    pub on_dismiss: Option<EventHandler<MouseEvent>>,

    /// Interaction-state identity (see the STATE HOME delta). Empty falls back
    /// to `tone|label`; pass a stable id when several chips in one chrome bar
    /// share a tone and label.
    #[default]
    pub instance_key: String,
}

#[component]
pub fn PersistentToast(props: PersistentToastProps) -> Element {
    let tone = props.tone;
    let label = props.label;
    let detail_label = props.detail_label;
    let dismissible = props.dismissible;
    let open_delay = props.open_delay;
    let close_grace = props.close_grace;
    let detail = props.detail;
    let on_dismiss = props.on_dismiss;
    let instance_key = props.instance_key;

    let key = if instance_key.is_empty() {
        format!("{}|{}", tone.class_name(), label)
    } else {
        instance_key
    };
    let handle = chip_handle(&key);
    let is_open = handle.open.read();
    let interactive = detail.is_some();

    let chip_class = format!("hk-persistent-toast {}", tone.class_name());
    let card_style = persistent_toast_card_style();
    let aria_expanded = if is_open { "true" } else { "false" };
    let aria_controls = if is_open {
        Some(handle.id.clone())
    } else {
        None
    };
    let card_aria_label = if detail_label.is_empty() {
        None
    } else {
        Some(detail_label.clone())
    };

    let glyph = match tone.default_icon() {
        Some(icon) => rsx! {
            Icon {
                icon,
                size: PERSISTENT_TOAST_ICON_PX,
                class: "hk-persistent-toast__icon".to_string(),
            }
        },
        None => rsx! {
            span {
                class: "hk-persistent-toast__spinner",
                "aria-hidden": "true",
            }
        },
    };

    // One handle clone per event handler: every rsx handler is its own `move`
    // closure, so they cannot share a capture.
    let enter = handle.clone();
    let leave = handle.clone();
    let focus = handle.clone();
    let blur = handle.clone();
    let click = handle.clone();
    let keydown = handle.clone();
    let card_enter = handle.clone();
    let card_leave = handle.clone();
    let on_dismiss_click = on_dismiss;

    rsx! {
        span {
            class: "hk-persistent-toast-wrap",
            style: persistent_toast_wrap_style(),
            "role": "status",
            "aria-live": "polite",
            if interactive {
                button {
                    class: chip_class.clone(),
                    "type": "button",
                    "aria-expanded": aria_expanded,
                    "aria-haspopup": "true",
                    "aria-controls": aria_controls.clone(),
                    onmouseenter: move |_| schedule_open(&enter, open_delay),
                    onmouseleave: move |_| schedule_close(&leave, close_grace),
                    onfocus: move |_| open_card(&focus, false),
                    onblur: move |_| {
                        if !blur.pinned.read() {
                            close_card(&blur, false);
                        }
                    },
                    onclick: move |_| toggle_pin(&click),
                    onkeydown: move |event: KeyboardEvent| {
                        if persistent_toast_is_escape(&event.key) && keydown.open.read() {
                            close_card(&keydown, true);
                        }
                    },
                    {glyph.clone()}
                    span { class: "hk-persistent-toast__label",
                        "{label}"
                    }
                }
            } else {
                span { class: chip_class.clone(),
                    {glyph}
                    span { class: "hk-persistent-toast__label",
                        "{label}"
                    }
                }
            }
            if dismissible {
                button {
                    class: "hk-persistent-toast__dismiss",
                    "type": "button",
                    "aria-label": t("hikari::persistentToast.dismiss", "Dismiss"),
                    onclick: move |event: MouseEvent| {
                        if let Some(handler) = on_dismiss_click.as_ref() {
                            handler.call(event);
                        }
                    },
                    Icon {
                        icon: MdiIcon::Close,
                        size: PERSISTENT_TOAST_ICON_PX,
                    }
                }
            }
            if is_open {
                if let Some(detail) = detail.clone() {
                    div {
                        class: "hk-persistent-toast-card hii-dropdown-content",
                        id: handle.id.clone(),
                        style: card_style.clone(),
                        "role": "group",
                        "aria-label": card_aria_label.clone(),
                        onmouseenter: move |_| cancel_close(&card_enter),
                        onmouseleave: move |_| {
                            if !card_leave.pinned.read() {
                                schedule_close(&card_leave, close_grace);
                            }
                        },
                        {detail}
                    }
                }
            }
        }
    }
}

impl StyledComponent for PersistentToastComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-persistent-toast*` names literal so this CSS matches the Vue
        // build).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkPersistentToast.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "persistent-toast"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persistent_toast_tone_class_names_match_the_vue_modifiers() {
        assert_eq!(
            PersistentToastTone::Loading.class_name(),
            "hk-persistent-toast--loading"
        );
        assert_eq!(
            PersistentToastTone::Info.class_name(),
            "hk-persistent-toast--info"
        );
        assert_eq!(
            PersistentToastTone::Warning.class_name(),
            "hk-persistent-toast--warning"
        );
        assert_eq!(
            PersistentToastTone::Error.class_name(),
            "hk-persistent-toast--error"
        );
    }

    #[test]
    fn persistent_toast_glyphs_follow_the_tone() {
        // Vue: loading → spinner, info → Info, warning/error → AlertTriangle.
        assert_eq!(PersistentToastTone::Loading.default_icon(), None);
        assert_eq!(
            PersistentToastTone::Info.default_icon(),
            Some(MdiIcon::Information)
        );
        assert_eq!(
            PersistentToastTone::Warning.default_icon(),
            Some(MdiIcon::AlertTriangle)
        );
        assert_eq!(
            PersistentToastTone::Error.default_icon(),
            Some(MdiIcon::AlertTriangle)
        );
    }

    #[test]
    fn persistent_toast_props_default_matches_the_vue_props() {
        let props = PersistentToastProps::default();
        assert_eq!(props.tone, PersistentToastTone::Info);
        assert_eq!(props.label, "");
        assert_eq!(props.detail_label, "");
        assert!(!props.dismissible);
        assert_eq!(props.open_delay, PERSISTENT_TOAST_OPEN_DELAY_MS);
        assert_eq!(props.open_delay, 150);
        assert_eq!(props.close_grace, PERSISTENT_TOAST_CLOSE_GRACE_MS);
        assert_eq!(props.close_grace, 250);
        assert!(props.detail.is_none());
        assert!(props.on_dismiss.is_none());
        assert_eq!(props.instance_key, "");
    }

    #[test]
    fn persistent_toast_escape_detection_matches_vues_key_check() {
        assert!(persistent_toast_is_escape("Escape"));
        assert!(!persistent_toast_is_escape("Enter"));
        assert!(!persistent_toast_is_escape("a"));
    }

    #[test]
    fn persistent_toast_card_style_keeps_the_vue_gap_and_end_alignment() {
        // Vue anchors the card below the chip, end-aligned, CARD_GAP_PX away;
        // the mirror expresses the same geometry in CSS (see the delta list).
        let style = persistent_toast_card_style();
        assert!(style.contains("position:absolute"));
        assert!(style.contains("top:calc(100% + 6px)"));
        assert!(style.contains("inset-inline-end:0"));
        assert_eq!(
            persistent_toast_wrap_style(),
            "position:relative;",
            "the wrap must anchor the absolutely positioned card"
        );
    }

    #[test]
    fn persistent_toast_chip_state_pins_and_ignores_soft_closes() {
        let handle = chip_handle("unit-test-chip-pin");
        // Fresh chips start closed and unpinned.
        handle.open.set(false);
        handle.pinned.set(false);

        // Hover-open (unpinned) → a soft close succeeds.
        open_card(&handle, false);
        assert!(handle.open.read());
        close_card(&handle, false);
        assert!(!handle.open.read());

        // A click during the hover window pins in place.
        open_card(&handle, false);
        toggle_pin(&handle);
        assert!(handle.pinned.read());
        assert!(handle.open.read());

        // A pinned card ignores the grace/soft close …
        close_card(&handle, false);
        assert!(handle.open.read());
        assert!(handle.pinned.read());

        // … and closes on the forced path (Escape / outside click in Vue).
        close_card(&handle, true);
        assert!(!handle.open.read());
        assert!(!handle.pinned.read());
        assert!(!handle.open.read(), "state persists across reads");
    }

    #[test]
    fn persistent_toast_chip_identity_is_stable_per_key() {
        let first = chip_handle("unit-test-chip-identity");
        let second = chip_handle("unit-test-chip-identity");
        assert_eq!(
            first.id, second.id,
            "the same key reuses the same chip state"
        );
        let other = chip_handle("unit-test-chip-identity-2");
        assert_ne!(first.id, other.id);
    }

    #[test]
    fn persistent_toast_styles_come_from_the_canonical_vue_sheet() {
        let css = PersistentToastComponent::styles();
        for class_name in [
            ".hk-persistent-toast-wrap",
            ".hk-persistent-toast__label",
            ".hk-persistent-toast__dismiss",
            ".hk-persistent-toast-card",
            ".hk-persistent-toast__spinner",
        ] {
            assert!(
                css.contains(class_name),
                "persistent toast css must come from the vue-mirror sheet (missing {class_name})"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored persistent-toast sheet"
        );
    }
}
