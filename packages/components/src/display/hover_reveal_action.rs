// hi-components/src/display/hover_reveal_action.rs
// HoverRevealAction — mirror of the canonical Vue `HkHoverRevealAction`: a
// wrapper whose extension slot (an inline action cluster) stays hidden until
// the host is hovered, pressed or focused, then slides out from the chosen
// placement side.
//
// Sources mirrored: `packages/vue/src/components/HkHoverRevealAction.tsx`
// and its sheet. The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkHoverRevealAction.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-hover-reveal*`
// class names are literal and identical in both forms. DOM contract (mirrors
// Vue one-to-one):
//
//   {as}.hk-hover-reveal[.is-revealed] data-placement={right|left|top|bottom}
//     span.hk-hover-reveal-main        {main slot}
//     span.hk-hover-reveal-extension?  {extension slot}
//
// Vue drives `is-revealed` with a reactive ref (`revealed`); the mirror keeps
// the state DOM-INLINE instead — the reveal/hide transitions add or remove the
// class on the root node through `tairitsu_vdom::dom_ops`, and the per-node
// timers live in a module `thread_local!` registry keyed by the root's DOM
// handle. No `use_signal` / `use_state` (ledger L48); the sheet's
// `:focus-within` path still reveals the extension for keyboard users without
// any script.
//
// Deltas vs Vue (documented):
//   * `emit("revealChange")` becomes [`HoverRevealActionProps::on_reveal_change`];
//     it fires from the same transitions, but the class swap happens on the DOM
//     node instead of through a re-render, so no attribute is regenerated.
//   * Vue compares `Date.now()` against a `suppressMouseUntil` deadline to keep
//     emulated mouse events from undoing a touch reveal. The mirror arms an
//     equivalent timer window ([`HoverRevealActionProps::touch_hide_delay`]
//     wide), which is the same suppression without a clock dependency.
//   * Vue's `as` prop is `as_tag` here (`as` is a Rust keyword); an empty value
//     falls back to `"span"`.
//   * The extension slot gets no `{ revealed }` scope: the flag lives on the
//     root's class list, which is what the sheet's selectors read.
//   * Vue clears its timers in `onUnmounted`; tairitsu 0.5.22 has no unmount
//     hook, so a timer armed right before a teardown still fires. It only
//     re-touches a detached node's class list, so the visible result is
//     unchanged (same trade-off as `basic/rolling_number.rs`).
//   * Touch reveal (`tap` / `longpress`) is mirrored with the same two timers,
//     including the swipe-cancels-longpress rule (`touchmove`).

use std::cell::RefCell;
use std::collections::HashMap;

use tairitsu_vdom::dom_ops::{class_list_add, class_list_remove, clear_timeout, set_timeout};
use tairitsu_vdom::{DomHandle, MouseEvent, TouchEvent};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct HoverRevealActionComponent;

/// The revealed-state class (Vue: `.is-revealed`; the sheet also allows the
/// `:focus-within` path).
pub const HOVER_REVEAL_ACTIVE_CLASS: &str = "is-revealed";

/// Where the extension slides out from (Vue: `placement`, default `right`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum HoverRevealPlacement {
    #[default]
    Right,
    Left,
    Top,
    Bottom,
}

impl HoverRevealPlacement {
    /// The `data-placement` value exactly as Vue emits it.
    pub fn name(self) -> &'static str {
        match self {
            HoverRevealPlacement::Right => "right",
            HoverRevealPlacement::Left => "left",
            HoverRevealPlacement::Top => "top",
            HoverRevealPlacement::Bottom => "bottom",
        }
    }
}

/// How a touch device reveals the extension (Vue: `touchRevealMode`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum HoverRevealTouchMode {
    /// Any touch reveals it (the legacy behaviour).
    #[default]
    Tap,
    /// The finger has to rest for `long_press_delay` first.
    LongPress,
}

impl HoverRevealTouchMode {
    /// The Vue prop value.
    pub fn name(self) -> &'static str {
        match self {
            HoverRevealTouchMode::Tap => "tap",
            HoverRevealTouchMode::LongPress => "longpress",
        }
    }
}

/// Vue's class array: the base class plus `is-revealed` when the host forced it.
pub fn hover_reveal_classes(force_revealed: bool) -> String {
    if force_revealed {
        format!("hk-hover-reveal {HOVER_REVEAL_ACTIVE_CLASS}")
    } else {
        "hk-hover-reveal".to_string()
    }
}

/// One root node's DOM-inline reveal state.
#[derive(Default)]
struct HoverRevealSlot {
    revealed: bool,
    hide_timer: i32,
    long_press_timer: i32,
    suppress_timer: i32,
    /// A touch interaction currently owns the state (Vue's
    /// `Date.now() < suppressMouseUntil` window).
    touch_owns: bool,
}

thread_local! {
    static HOVER_REVEAL_SLOTS: RefCell<HashMap<u64, HoverRevealSlot>> =
        RefCell::new(HashMap::new());
}

fn hover_reveal_with_slot<R>(handle: u64, update: impl FnOnce(&mut HoverRevealSlot) -> R) -> R {
    HOVER_REVEAL_SLOTS.with(|slots| update(slots.borrow_mut().entry(handle).or_default()))
}

fn hover_reveal_clear_timer(timer: &mut i32) {
    if *timer != 0 {
        clear_timeout(*timer);
        *timer = 0;
    }
}

fn hover_reveal_notify(notify: &Option<EventHandler<bool>>, revealed: bool) {
    if let Some(handler) = notify {
        handler.call(revealed);
    }
}

/// Vue's `reveal()`: cancel the pending hide and add the class; returns whether
/// the state actually changed (Vue emits only on the false → true edge).
fn hover_reveal_reveal(handle: u64) -> bool {
    let changed = hover_reveal_with_slot(handle, |slot| {
        hover_reveal_clear_timer(&mut slot.hide_timer);
        if slot.revealed {
            false
        } else {
            slot.revealed = true;
            true
        }
    });
    if changed {
        class_list_add(DomHandle::from_raw(handle), &[HOVER_REVEAL_ACTIVE_CLASS]);
    }
    changed
}

/// Vue's hide transition: drop the class; returns whether it was revealed.
fn hover_reveal_hide(handle: u64) -> bool {
    let changed = hover_reveal_with_slot(handle, |slot| {
        hover_reveal_clear_timer(&mut slot.hide_timer);
        if slot.revealed {
            slot.revealed = false;
            true
        } else {
            false
        }
    });
    if changed {
        class_list_remove(DomHandle::from_raw(handle), &[HOVER_REVEAL_ACTIVE_CLASS]);
    }
    changed
}

/// Vue's `scheduleHide(delay)`: `force_revealed` pins the extension open.
fn hover_reveal_schedule_hide(
    handle: u64,
    delay_ms: f64,
    force_revealed: bool,
    notify: Option<EventHandler<bool>>,
) {
    if force_revealed {
        return;
    }
    hover_reveal_with_slot(handle, |slot| {
        hover_reveal_clear_timer(&mut slot.hide_timer);
        let timer = set_timeout(
            Box::new(move || {
                if hover_reveal_hide(handle) {
                    hover_reveal_notify(&notify, false);
                }
            }),
            delay_ms as i32,
        );
        slot.hide_timer = timer;
    });
}

/// Arm the touch-owns window (Vue's `suppressMouseUntil = Date.now() + delay`).
fn hover_reveal_suppress_mouse(handle: u64, delay_ms: f64) {
    hover_reveal_with_slot(handle, |slot| {
        slot.touch_owns = true;
        hover_reveal_clear_timer(&mut slot.suppress_timer);
        let timer = set_timeout(
            Box::new(move || {
                hover_reveal_with_slot(handle, |slot| slot.touch_owns = false);
            }),
            delay_ms as i32,
        );
        slot.suppress_timer = timer;
    });
}

fn hover_reveal_touch_owns(handle: u64) -> bool {
    hover_reveal_with_slot(handle, |slot| slot.touch_owns)
}

fn hover_reveal_cancel_long_press(handle: u64) {
    hover_reveal_with_slot(handle, |slot| {
        hover_reveal_clear_timer(&mut slot.long_press_timer)
    });
}

/// Vue's long-press arm: a resting finger reveals after `delay_ms`; a lift or a
/// swipe cancels it before it ever fires.
fn hover_reveal_arm_long_press(handle: u64, delay_ms: f64, notify: Option<EventHandler<bool>>) {
    hover_reveal_with_slot(handle, |slot| {
        hover_reveal_clear_timer(&mut slot.long_press_timer);
        let timer = set_timeout(
            Box::new(move || {
                hover_reveal_with_slot(handle, |slot| slot.long_press_timer = 0);
                if hover_reveal_reveal(handle) {
                    hover_reveal_notify(&notify, true);
                }
            }),
            delay_ms as i32,
        );
        slot.long_press_timer = timer;
    });
}

fn hover_reveal_on_enter(handle: Option<u64>, notify: Option<EventHandler<bool>>) {
    let Some(handle) = handle else {
        return;
    };
    // During the touch linger the touch timer owns the state; re-revealing here
    // would clear it and leave the extension open forever.
    if hover_reveal_touch_owns(handle) {
        return;
    }
    if hover_reveal_reveal(handle) {
        hover_reveal_notify(&notify, true);
    }
}

fn hover_reveal_on_leave(
    handle: Option<u64>,
    delay_ms: f64,
    force_revealed: bool,
    notify: Option<EventHandler<bool>>,
) {
    let Some(handle) = handle else {
        return;
    };
    if hover_reveal_touch_owns(handle) {
        return;
    }
    hover_reveal_schedule_hide(handle, delay_ms, force_revealed, notify);
}

/// Vue's `onTouchStart`: any touch suppresses the mouse path; `tap` reveals
/// immediately, `longpress` only arms the timer.
fn hover_reveal_on_touch_start(
    handle: Option<u64>,
    mode: HoverRevealTouchMode,
    long_press_delay: f64,
    touch_hide_delay: f64,
    notify: Option<EventHandler<bool>>,
) {
    let Some(handle) = handle else {
        return;
    };
    hover_reveal_suppress_mouse(handle, touch_hide_delay);
    match mode {
        HoverRevealTouchMode::Tap => {
            if hover_reveal_reveal(handle) {
                hover_reveal_notify(&notify, true);
            }
        }
        HoverRevealTouchMode::LongPress => {
            hover_reveal_arm_long_press(handle, long_press_delay, notify);
        }
    }
}

/// Vue's `onTouchEnd` / `onTouchCancel`: cancel any pending long press and let
/// the extension linger for `touch_hide_delay`.
fn hover_reveal_on_touch_end(
    handle: Option<u64>,
    touch_hide_delay: f64,
    force_revealed: bool,
    notify: Option<EventHandler<bool>>,
) {
    let Some(handle) = handle else {
        return;
    };
    hover_reveal_suppress_mouse(handle, touch_hide_delay);
    hover_reveal_cancel_long_press(handle);
    hover_reveal_schedule_hide(handle, touch_hide_delay, force_revealed, notify);
}

/// Vue's `onTouchMove`: a sliding finger is a swipe, not a press.
fn hover_reveal_on_touch_move(handle: Option<u64>, mode: HoverRevealTouchMode) {
    if mode != HoverRevealTouchMode::LongPress {
        return;
    }
    if let Some(handle) = handle {
        hover_reveal_cancel_long_press(handle);
    }
}

#[define_props]
pub struct HoverRevealActionProps {
    /// Mouse-leave hide delay in ms (Vue default 140).
    #[default(140.0)]
    pub hide_delay: f64,

    /// How long a touch-revealed extension lingers after the finger lifts
    /// (Vue default 3000).
    #[default(3000.0)]
    pub touch_hide_delay: f64,

    /// When a touch reveals the extension (Vue default `tap`).
    #[default]
    pub touch_reveal_mode: HoverRevealTouchMode,

    /// Rest duration before a `longpress` reveal fires (Vue default 500).
    #[default(500.0)]
    pub long_press_delay: f64,

    /// The host tag (Vue prop `as`, default `"span"`).
    #[default("span".to_string())]
    pub as_tag: String,

    /// Placement side of the extension (Vue default `right`).
    #[default]
    pub placement: HoverRevealPlacement,

    /// Pin the extension open (Vue default false).
    #[default]
    pub force_revealed: bool,

    /// The main slot.
    pub main: Element,

    /// The extension slot (the revealed action cluster).
    pub extension: Option<Element>,

    /// Vue's `revealChange` emit.
    pub on_reveal_change: Option<EventHandler<bool>>,
}

#[component]
pub fn HoverRevealAction(props: HoverRevealActionProps) -> Element {
    let as_tag = if props.as_tag.is_empty() {
        "span".to_string()
    } else {
        props.as_tag
    };
    let classes = hover_reveal_classes(props.force_revealed);
    let mut root = VElement::new(&as_tag)
        .class(classes)
        .attr("data-placement", props.placement.name());

    let force_revealed = props.force_revealed;
    let hide_delay = props.hide_delay;
    let touch_hide_delay = props.touch_hide_delay;
    let touch_reveal_mode = props.touch_reveal_mode;
    let long_press_delay = props.long_press_delay;
    let notify = props.on_reveal_change;

    let enter_notify = notify.clone();
    root = root.on_mouseenter(move |event: MouseEvent| {
        hover_reveal_on_enter(event.current_target, enter_notify.clone());
    });

    let leave_notify = notify.clone();
    root = root.on_mouseleave(move |event: MouseEvent| {
        hover_reveal_on_leave(
            event.current_target,
            hide_delay,
            force_revealed,
            leave_notify.clone(),
        );
    });

    // A bare synthetic click (a test driver dispatching a click at the
    // extension's coordinates without a hover move) lands while the extension
    // is still `pointer-events: none`; a mousedown on the host reveals it first.
    let down_notify = notify.clone();
    root = root.on_mousedown(move |event: MouseEvent| {
        hover_reveal_on_enter(event.current_target, down_notify.clone());
    });

    let touch_start_notify = notify.clone();
    root = root.on_touchstart(move |event: TouchEvent| {
        hover_reveal_on_touch_start(
            event.current_target,
            touch_reveal_mode,
            long_press_delay,
            touch_hide_delay,
            touch_start_notify.clone(),
        );
    });

    let touch_end_notify = notify.clone();
    root = root.on_touchend(move |event: TouchEvent| {
        hover_reveal_on_touch_end(
            event.current_target,
            touch_hide_delay,
            force_revealed,
            touch_end_notify.clone(),
        );
    });

    let touch_cancel_notify = notify.clone();
    root = root.on_touchcancel(move |event: TouchEvent| {
        hover_reveal_on_touch_end(
            event.current_target,
            touch_hide_delay,
            force_revealed,
            touch_cancel_notify.clone(),
        );
    });

    root = root.on_touchmove(move |event: TouchEvent| {
        hover_reveal_on_touch_move(event.current_target, touch_reveal_mode);
    });

    root = root.child(VNode::Element(Box::new(
        VElement::new("span")
            .class("hk-hover-reveal-main")
            .child(props.main),
    )));
    if let Some(extension) = props.extension {
        root = root.child(VNode::Element(Box::new(
            VElement::new("span")
                .class("hk-hover-reveal-extension")
                .child(extension),
        )));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for HoverRevealActionComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkHoverRevealAction.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "hover-reveal-action"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hover_reveal_placement_names_match_vue() {
        assert_eq!(HoverRevealPlacement::Right.name(), "right");
        assert_eq!(HoverRevealPlacement::Left.name(), "left");
        assert_eq!(HoverRevealPlacement::Top.name(), "top");
        assert_eq!(HoverRevealPlacement::Bottom.name(), "bottom");
    }

    #[test]
    fn hover_reveal_touch_mode_names_match_vue() {
        assert_eq!(HoverRevealTouchMode::Tap.name(), "tap");
        assert_eq!(HoverRevealTouchMode::LongPress.name(), "longpress");
    }

    #[test]
    fn hover_reveal_classes_follow_the_vue_class_array() {
        // Vue's `[base, revealed && "is-revealed"]` drops the falsy entry.
        assert_eq!(hover_reveal_classes(false), "hk-hover-reveal");
        assert_eq!(hover_reveal_classes(true), "hk-hover-reveal is-revealed");
    }

    #[test]
    fn hover_reveal_defaults_match_the_vue_props() {
        let props = HoverRevealActionProps::default();
        assert_eq!(props.hide_delay, 140.0);
        assert_eq!(props.touch_hide_delay, 3000.0);
        assert_eq!(props.touch_reveal_mode, HoverRevealTouchMode::Tap);
        assert_eq!(props.long_press_delay, 500.0);
        assert_eq!(props.as_tag, "span");
        assert_eq!(props.placement, HoverRevealPlacement::Right);
        assert!(!props.force_revealed);
        assert!(props.extension.is_none());
        assert!(props.on_reveal_change.is_none());
    }

    #[test]
    fn hover_reveal_renders_the_wrapper_main_and_extension() {
        let html = HoverRevealAction(HoverRevealActionProps {
            main: VNode::Text(VText::new("Tabs")),
            extension: Some(VNode::Text(VText::new("+"))),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-hover-reveal\"",
            "data-placement=\"right\"",
            "hk-hover-reveal-main",
            "hk-hover-reveal-extension",
            "Tabs",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("is-revealed"), "{html}");
    }

    #[test]
    fn hover_reveal_without_an_extension_renders_only_the_main_slot() {
        let html = HoverRevealAction(HoverRevealActionProps {
            main: VNode::Text(VText::new("Tabs")),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-hover-reveal-main"), "{html}");
        assert!(!html.contains("hk-hover-reveal-extension"), "{html}");
    }

    #[test]
    fn hover_reveal_honours_force_revealed_placement_and_the_host_tag() {
        let html = HoverRevealAction(HoverRevealActionProps {
            as_tag: "div".to_string(),
            placement: HoverRevealPlacement::Bottom,
            force_revealed: true,
            main: VNode::Text(VText::new("Main")),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.starts_with("<div "), "{html}");
        assert!(
            html.contains("class=\"hk-hover-reveal is-revealed\""),
            "{html}"
        );
        assert!(html.contains("data-placement=\"bottom\""), "{html}");
    }

    #[test]
    fn hover_reveal_styles_come_from_the_canonical_vue_sheet() {
        let css = HoverRevealActionComponent::styles();
        for needle in [
            ".hk-hover-reveal",
            ".hk-hover-reveal-main",
            ".hk-hover-reveal-extension",
            ".is-revealed",
        ] {
            assert!(
                css.contains(needle),
                "hover-reveal css must carry {needle}: {css}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored hover-reveal sheet"
        );
    }
}
