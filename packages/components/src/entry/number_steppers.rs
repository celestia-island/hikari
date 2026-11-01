// hi-components/src/entry/number_steppers.rs
// NumberSteppers — mirror of the canonical Vue `HkNumberSteppers`: the shared
// two-button step column hikari's number fields render (HkNumberInput composes
// it, see `entry/number_input.rs`; `basic/input.rs` keeps HkInput's number
// marker class only and documents why it does not mount this column).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkNumberSteppers.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-number-input-step*` name is literal and
// identical in both forms. DOM contract (tag/class skeleton one-to-one with
// Vue; the deltas are marked [D]):
//
//   div.hk-number-input-steppers.hk-number-input-steppers-{sm|md|lg}
//        [host class]
//     button.hk-number-input-step.hk-number-input-step-up
//            type="button" [disabled] tabindex="-1" aria-label="Increase" [D]
//            (mousedown / mouseup / mouseleave / click)
//       span[style="display:contents"]                        [D] SVG host
//         svg.lucide.lucide-chevron-up  14x14                  (lucide glyph)
//     button.hk-number-input-step.hk-number-input-step-down
//            type="button" [disabled] tabindex="-1" aria-label="Decrease" [D]
//       span[style="display:contents"]
//         svg.lucide.lucide-chevron-down  14x14
//
// Vue prop mapping: `canUp` → [`NumberSteppersProps::can_up`], `canDown` →
// `can_down`, `disabled` → `disabled`, `size` → [`NumberInputSize`]
// (`sm|md|lg`, default `md`; the same tokens HkNumberInput declares), the
// `step` emit → [`NumberSteppersProps::on_step`] with a
// [`NumberStepperDirection`] payload (Vue's `"up" | "down"`).
//
// Interaction contract, taken from Vue line by line:
//   * click = one step; press-and-hold = a [`NUMBER_STEPPER_HOLD_DELAY_MS`]
//     arming delay and then a [`NUMBER_STEPPER_HOLD_REPEAT_MS`] repeat;
//   * a hold that reached the repeat phase swallows its release click (Vue's
//     fix for the extra step a held run used to deliver);
//   * a hold dies the moment its direction's bound goes dead (`canUp` /
//     `canDown` flipping off mid-hold) — Vue's hardening so no cadence keeps
//     running behind a disabled button no mouseup can reach;
//   * only button 0 arms a hold, and leaving the button cancels it;
//   * the buttons stay `tabindex="-1"`: keyboard users step through the
//     field's native arrow keys, the column is the pointer affordance.
//
// State home: tairitsu 0.5.22 has no per-instance component state
// (`use_signal` allocates a fresh signal on every render, `use_state` is a
// single shared hook slot), so the live hold lives in a module `thread_local!`
// registry — the pattern `feedback/tooltip.rs` and
// `feedback/persistent_toast.rs` use. What each part is bound to matters:
//   * the EMITTER is captured by the pressing button's own closure when the
//     hold arms, so a cadence always reports to the field it was started from
//     (Vue's `emit` is per instance); it survives the release so a plain click
//     still reports.
//   * the BOUNDS gate is re-published by every render, so a value change that
//     walks the field onto its bound releases the repeat exactly like Vue's
//     live `props.canUp` / `props.canDown` read. On a page with SEVERAL step
//     columns the gate therefore carries the most recently rendered column's
//     bounds, and a mid-hold re-render of another column can sharpen or relax
//     the release one tick early — routing stays correct (the emitter is
//     captured), only the gate is page-global.
//   * ONE hold at a time (a pointer holds one button; the slider mirror uses
//     the same singleton reasoning for its drag flag). The repeat/yield flag is
//     shared by both directions, exactly like Vue's per-instance `holdRepeated`.
//   * a hold that outlives its component cannot be reaped from an unmount hook
//     (tairitsu 0.5.22 exposes none): it stops at the next stepper event, or as
//     soon as the field reaches the bound it was stepping toward (the dead-end
//     release above). Vue's `onUnmounted(stopHold)` has no analogue.
//
// Deltas vs Vue (documented, not accidental):
//   * [D] `aria-label="Increase" | "Decrease"` on the two buttons. Vue's
//     buttons are unlabeled (the lucide svg is `aria-hidden`), so a screen
//     reader announces two nameless buttons; the mirror names them. The text is
//     the plain verb because the Vue chrome ships no i18n key for it.
//   * [D] the svg rides `dangerous_inner_html` on a `style="display:contents"`
//     span: tairitsu creates elements with `createElement(localName)` (HTML
//     namespace), so an rsx `svg {}` child would never paint, and
//     `dangerous_inner_html` suppresses an element's other children — hence the
//     dedicated host. The markup itself is byte-identical to lucide's output
//     for `size={14}`, and the sheet's `.hk-number-input-step svg` size rules
//     win over its `width`/`height` attributes exactly as they do in Vue.
//   * Vue's `rootRef` function-ref prop (HkInput folds the column into its
//     trailing affix reservation) is dropped: tairitsu has no function refs and
//     the input mirror does not measure affixes (see `basic/input.rs`).
//   * `class` is accepted and appended last (Vue merges the fallthrough class
//     itself); the fixed `.hk-number-input-steppers*` names are unchanged.
//
// New file: the family had no Rust counterpart — the retired legacy
// `entry/number_input.rs` inlined plus/minus buttons instead of this column.

use std::cell::RefCell;

use tairitsu_vdom::dom_ops::{clear_interval, clear_timeout, set_interval, set_timeout};

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct NumberSteppersComponent;

/// Vue: press-and-hold arming delay before the repeat starts (ms).
pub const NUMBER_STEPPER_HOLD_DELAY_MS: u32 = 300;

/// Vue: the repeat cadence once armed (ms).
pub const NUMBER_STEPPER_HOLD_REPEAT_MS: u32 = 50;

/// lucide `ChevronUp` at `size={14}` — byte-identical to the markup Vue's
/// `<ChevronUp size={14} aria-hidden="true" />` renders (see the header delta
/// about the `dangerous_inner_html` host). The svg's own size loses to the
/// sheet's per-size `width`/`height` rules, exactly like Vue's.
const CHEVRON_UP_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>"#;

/// lucide `ChevronDown` at `size={14}`.
const CHEVRON_DOWN_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>"#;

/// Size step shared with HkNumberInput (Vue declares the same `"sm" | "md" |
/// "lg"` prop on both components, default `md`). The identifiers are the
/// pre-mirror ones — call sites pass `NumberInputSize::Medium` — while the
/// emitted classes are Vue's `hk-number-input-{sm,md,lg}` /
/// `hk-number-input-steppers-{sm,md,lg}` exactly.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum NumberInputSize {
    Small,
    #[default]
    Medium,
    Large,
}

impl NumberInputSize {
    /// The field wrapper's `hk-number-input-{size}` modifier.
    pub fn class_name(self) -> &'static str {
        match self {
            NumberInputSize::Small => "hk-number-input-sm",
            NumberInputSize::Medium => "hk-number-input-md",
            NumberInputSize::Large => "hk-number-input-lg",
        }
    }

    /// The stepper column's `hk-number-input-steppers-{size}` modifier (the
    /// size class lives on the STACK ROOT, per the sheet's header).
    pub fn steppers_class(self) -> &'static str {
        match self {
            NumberInputSize::Small => "hk-number-input-steppers-sm",
            NumberInputSize::Medium => "hk-number-input-steppers-md",
            NumberInputSize::Large => "hk-number-input-steppers-lg",
        }
    }
}

/// Step intent (Vue: the `step` emit, payload `"up" | "down"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum NumberStepperDirection {
    Up,
    Down,
}

impl NumberStepperDirection {
    /// The token Vue emits (`"up"` / `"down"`).
    pub fn as_str(self) -> &'static str {
        match self {
            NumberStepperDirection::Up => "up",
            NumberStepperDirection::Down => "down",
        }
    }
}

/// Vue: `dir === "up" ? props.canUp : props.canDown`.
pub fn number_stepper_bound_allows(
    can_up: bool,
    can_down: bool,
    direction: NumberStepperDirection,
) -> bool {
    match direction {
        NumberStepperDirection::Up => can_up,
        NumberStepperDirection::Down => can_down,
    }
}

/// Vue's gate — `props.disabled || !can*(dir)` — which is BOTH the button's
/// `disabled` attribute and the guard inside `step()`.
pub fn number_stepper_blocked(
    disabled: bool,
    can_up: bool,
    can_down: bool,
    direction: NumberStepperDirection,
) -> bool {
    disabled || !number_stepper_bound_allows(can_up, can_down, direction)
}

/// The live hold. One entry, not one per instance: a pointer holds one button
/// at a time (see the header's state-home note).
#[derive(Default)]
struct StepperHold {
    disabled: bool,
    can_up: bool,
    can_down: bool,
    /// The direction being held, `None` when no hold is armed.
    direction: Option<NumberStepperDirection>,
    /// The emitter CAPTURED BY THE PRESSING BUTTON (see `start_stepper_hold`).
    /// It outlives the hold so a plain release click still reports.
    emitter: Option<EventHandler<NumberStepperDirection>>,
    /// Pending arming timer id (`0` = none, or a host without timer ops).
    delay_timer: i32,
    /// Live repeat timer id (`0` = none).
    repeat_timer: i32,
    /// Set by the FIRST repeat tick — the release click it follows must not
    /// add one more step (Vue's `holdRepeated`).
    repeated: bool,
}

thread_local! {
    static STEPPER_HOLD: RefCell<StepperHold> = RefCell::new(StepperHold::default());
}

/// The direction a hold is currently stepping, if any (mirror-only accessor:
/// hosts and tests can observe the cadence without touching the timers).
pub fn number_stepper_holding() -> Option<NumberStepperDirection> {
    STEPPER_HOLD.with(|hold| hold.borrow().direction)
}

/// Re-publish the BOUND props the timers gate on. Called on every render —
/// Vue reads `props.canUp` / `props.canDown` inside each repeat tick, so the
/// cadence must never gate on a stale snapshot (the dead-end release depends
/// on it). It never disturbs a live hold, and it never touches the emitter:
/// that one is captured by the pressing button (see `start_stepper_hold`).
fn sync_stepper_live(disabled: bool, can_up: bool, can_down: bool) {
    STEPPER_HOLD.with(|hold| {
        let mut hold = hold.borrow_mut();
        hold.disabled = disabled;
        hold.can_up = can_up;
        hold.can_down = can_down;
    });
}

/// Vue's `step()`: a disabled column is ignored outright, a dead end RELEASES
/// the hold (its bus entry would otherwise outlive the button), otherwise the
/// direction is emitted.
fn step_stepper(direction: NumberStepperDirection) {
    let (disabled, bound_dead, emitter) = STEPPER_HOLD.with(|hold| {
        let hold = hold.borrow();
        (
            hold.disabled,
            !number_stepper_bound_allows(hold.can_up, hold.can_down, direction),
            hold.emitter.clone(),
        )
    });
    if disabled {
        return;
    }
    if bound_dead {
        stop_stepper_hold();
        return;
    }
    if let Some(handler) = emitter {
        handler.call(direction);
    }
}

/// Vue's `startHold()`: cancel whatever is armed, arm the 300ms delay, then the
/// 50ms repeat. A host without timer ops (`set_timeout`/`set_interval` return
/// `0`, e.g. the native test build) simply gets no cadence — a click still
/// steps once, so the affordance degrades to click-only instead of hanging.
///
/// `emitter` is the handler of the instance whose button was pressed (each
/// button's own closure carries it), so a hold can never be re-routed to
/// another number field by an unrelated re-render — the singleton registry only
/// shares the BOUNDS gate, which every render refreshes.
fn start_stepper_hold(
    direction: NumberStepperDirection,
    emitter: Option<EventHandler<NumberStepperDirection>>,
) {
    stop_stepper_hold();
    STEPPER_HOLD.with(|hold| {
        let mut hold = hold.borrow_mut();
        hold.direction = Some(direction);
        hold.repeated = false;
        hold.emitter = emitter;
    });

    let delay = set_timeout(
        Box::new(move || {
            // The hold may have been released while the delay was pending.
            let still_armed = STEPPER_HOLD.with(|hold| {
                let mut hold = hold.borrow_mut();
                hold.delay_timer = 0;
                hold.direction == Some(direction)
            });
            if !still_armed {
                return;
            }
            let repeat = set_interval(
                Box::new(move || {
                    STEPPER_HOLD.with(|hold| hold.borrow_mut().repeated = true);
                    step_stepper(direction);
                }),
                NUMBER_STEPPER_HOLD_REPEAT_MS as i32,
            );
            if repeat != 0 {
                STEPPER_HOLD.with(|hold| hold.borrow_mut().repeat_timer = repeat);
            }
        }),
        NUMBER_STEPPER_HOLD_DELAY_MS as i32,
    );
    if delay != 0 {
        STEPPER_HOLD.with(|hold| hold.borrow_mut().delay_timer = delay);
    }
}

/// Vue's `stopHold()`: drop both timers and the held direction. The `repeated`
/// flag survives so the release click can consume it exactly once.
fn stop_stepper_hold() {
    let (delay, repeat) = STEPPER_HOLD.with(|hold| {
        let mut hold = hold.borrow_mut();
        let timers = (hold.delay_timer, hold.repeat_timer);
        hold.delay_timer = 0;
        hold.repeat_timer = 0;
        hold.direction = None;
        timers
    });
    if delay != 0 {
        clear_timeout(delay);
    }
    if repeat != 0 {
        clear_interval(repeat);
    }
}

/// Vue's `onClick`: after a held run of repeats the release click is swallowed,
/// otherwise it is one step.
fn click_stepper(direction: NumberStepperDirection) {
    let swallowed = STEPPER_HOLD.with(|hold| {
        let mut hold = hold.borrow_mut();
        if hold.repeated {
            hold.repeated = false;
            true
        } else {
            false
        }
    });
    if swallowed {
        return;
    }
    step_stepper(direction);
}

#[define_props]
pub struct NumberSteppersProps {
    /// Vue: `canUp`, default `true`.
    #[default(true)]
    pub can_up: bool,

    /// Vue: `canDown`, default `true`.
    #[default(true)]
    pub can_down: bool,

    #[default]
    pub disabled: bool,

    /// Size step (`hk-number-input-steppers-{size}`), Vue default `md`.
    #[default]
    pub size: NumberInputSize,

    /// Vue: the `step` emit — once per click, once per repeat tick.
    pub on_step: Option<EventHandler<NumberStepperDirection>>,

    /// Vue attribute fallthrough, appended after the fixed class family.
    #[default]
    pub class: String,
}

#[component]
pub fn NumberSteppers(props: NumberSteppersProps) -> Element {
    let disabled = props.disabled;
    let can_up = props.can_up;
    let can_down = props.can_down;

    // Publish the bounds the timers gate on (see `sync_stepper_live`). The
    // emitter is NOT published here: each button hands its own handler to
    // `start_stepper_hold` when pressed, so a hold stays on its own field.
    sync_stepper_live(disabled, can_up, can_down);

    let mut root_classes = String::from("hk-number-input-steppers");
    root_classes.push(' ');
    root_classes.push_str(props.size.steppers_class());
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    // Vue: `disabled={props.disabled || !props.canUp}` / `!props.canDown`.
    let up_disabled =
        number_stepper_blocked(disabled, can_up, can_down, NumberStepperDirection::Up);
    let down_disabled =
        number_stepper_blocked(disabled, can_up, can_down, NumberStepperDirection::Down);

    // One emitter clone per direction: the press captures the instance's own
    // handler (Vue's `emit` is bound per component instance).
    let up_emitter = props.on_step.clone();
    let down_emitter = props.on_step.clone();

    rsx! {
        div {
            class: root_classes,
            button {
                "type": "button",
                class: "hk-number-input-step hk-number-input-step-up",
                disabled: up_disabled,
                tabindex: -1_i32,
                "aria-label": "Increase",
                onmousedown: move |event: MouseEvent| {
                    event.prevent_default();
                    // Vue: a non-primary button never arms the hold.
                    if event.button != 0 {
                        return;
                    }
                    start_stepper_hold(NumberStepperDirection::Up, up_emitter.clone());
                },
                onmouseup: move |event: MouseEvent| {
                    event.prevent_default();
                    stop_stepper_hold();
                },
                onmouseleave: move |_event: MouseEvent| stop_stepper_hold(),
                onclick: move |event: MouseEvent| {
                    event.prevent_default();
                    click_stepper(NumberStepperDirection::Up);
                },
                // `dangerous_inner_html` suppresses an element's other
                // children, so the SVG markup sits on its own host (header
                // delta [D]).
                span {
                    style: "display:contents",
                    dangerous_inner_html: CHEVRON_UP_SVG,
                }
            }
            button {
                "type": "button",
                class: "hk-number-input-step hk-number-input-step-down",
                disabled: down_disabled,
                tabindex: -1_i32,
                "aria-label": "Decrease",
                onmousedown: move |event: MouseEvent| {
                    event.prevent_default();
                    if event.button != 0 {
                        return;
                    }
                    start_stepper_hold(NumberStepperDirection::Down, down_emitter.clone());
                },
                onmouseup: move |event: MouseEvent| {
                    event.prevent_default();
                    stop_stepper_hold();
                },
                onmouseleave: move |_event: MouseEvent| stop_stepper_hold(),
                onclick: move |event: MouseEvent| {
                    event.prevent_default();
                    click_stepper(NumberStepperDirection::Down);
                },
                span {
                    style: "display:contents",
                    dangerous_inner_html: CHEVRON_DOWN_SVG,
                }
            }
        }
    }
}

impl StyledComponent for NumberSteppersComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-number-input-step*` names literal so this CSS matches Vue).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkNumberSteppers.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "number-steppers"
    }
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;
    use std::rc::Rc;

    use super::*;

    #[test]
    fn number_input_size_tokens_match_the_vue_classes() {
        assert_eq!(NumberInputSize::default(), NumberInputSize::Medium);
        assert_eq!(NumberInputSize::Small.class_name(), "hk-number-input-sm");
        assert_eq!(NumberInputSize::Medium.class_name(), "hk-number-input-md");
        assert_eq!(NumberInputSize::Large.class_name(), "hk-number-input-lg");
        assert_eq!(
            NumberInputSize::Small.steppers_class(),
            "hk-number-input-steppers-sm"
        );
        assert_eq!(
            NumberInputSize::Medium.steppers_class(),
            "hk-number-input-steppers-md"
        );
        assert_eq!(
            NumberInputSize::Large.steppers_class(),
            "hk-number-input-steppers-lg"
        );
    }

    #[test]
    fn number_stepper_directions_match_the_vue_emit_payload() {
        assert_eq!(NumberStepperDirection::Up.as_str(), "up");
        assert_eq!(NumberStepperDirection::Down.as_str(), "down");
    }

    #[test]
    fn number_stepper_blocked_matches_the_vue_gate() {
        // Disabled wins over every bound.
        assert!(number_stepper_blocked(
            true,
            true,
            true,
            NumberStepperDirection::Up
        ));
        assert!(number_stepper_blocked(
            true,
            true,
            true,
            NumberStepperDirection::Down
        ));
        // Each direction only reads its OWN bound.
        assert!(number_stepper_blocked(
            false,
            false,
            true,
            NumberStepperDirection::Up
        ));
        assert!(!number_stepper_blocked(
            false,
            false,
            true,
            NumberStepperDirection::Down
        ));
        assert!(number_stepper_blocked(
            false,
            true,
            false,
            NumberStepperDirection::Down
        ));
        assert!(!number_stepper_blocked(
            false,
            true,
            false,
            NumberStepperDirection::Up
        ));
        // Both bounds live → both directions emit.
        assert!(!number_stepper_blocked(
            false,
            true,
            true,
            NumberStepperDirection::Up
        ));
        assert!(!number_stepper_blocked(
            false,
            true,
            true,
            NumberStepperDirection::Down
        ));
    }

    #[test]
    fn number_steppers_defaults_match_the_vue_props() {
        let props = NumberSteppersProps::default();
        assert!(props.can_up);
        assert!(props.can_down);
        assert!(!props.disabled);
        assert_eq!(props.size, NumberInputSize::Medium);
        assert_eq!(props.on_step, None);
        assert_eq!(props.class, "");
    }

    #[test]
    fn number_steppers_render_the_vue_column() {
        let html = NumberSteppers(NumberSteppersProps::default()).render_to_html();
        for needle in [
            "hk-number-input-steppers",
            "hk-number-input-steppers-md",
            "hk-number-input-step hk-number-input-step-up",
            "hk-number-input-step hk-number-input-step-down",
            "tabindex=\"-1\"",
            "aria-label=\"Increase\"",
            "aria-label=\"Decrease\"",
            "type=\"button\"",
            "lucide-chevron-up",
            "lucide-chevron-down",
            "display:contents",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Up precedes down, exactly like Vue's render order.
        let up = html.find("hk-number-input-step-up").expect("up button");
        let down = html.find("hk-number-input-step-down").expect("down button");
        assert!(up < down, "the up button must come first: {html}");
        // An enabled column renders no disabled attribute at all (rsx bool
        // attributes are presence-only).
        assert!(!html.contains("disabled"), "{html}");
    }

    #[test]
    fn number_steppers_disable_only_the_dead_end() {
        let html = NumberSteppers(NumberSteppersProps {
            can_up: false,
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(
            html.matches("disabled=\"disabled\"").count(),
            1,
            "exactly the dead end renders disabled: {html}"
        );
        // ... and it is the UP button that carries it.
        let up = html.find("hk-number-input-step-up").expect("up button");
        let disabled = html.find("disabled").expect("disabled attr");
        assert!(disabled < up, "{html}");

        let html = NumberSteppers(NumberSteppersProps {
            disabled: true,
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(
            html.matches("disabled=\"disabled\"").count(),
            2,
            "a disabled column disables both: {html}"
        );
    }

    #[test]
    fn number_steps_emit_only_through_the_live_props() {
        let seen: Rc<Cell<u32>> = Rc::new(Cell::new(0));
        let counter = Rc::clone(&seen);
        let handler = EventHandler::new(move |_direction: NumberStepperDirection| {
            counter.set(counter.get() + 1);
        });

        // `canDown: false` → the down step is a dead end: nothing is emitted.
        sync_stepper_live(false, true, false);
        start_stepper_hold(NumberStepperDirection::Down, Some(handler.clone()));
        click_stepper(NumberStepperDirection::Down);
        assert_eq!(seen.get(), 0);
        start_stepper_hold(NumberStepperDirection::Up, Some(handler.clone()));
        click_stepper(NumberStepperDirection::Up);
        assert_eq!(seen.get(), 1);

        // A disabled column swallows every step (Vue's `step()` guard).
        sync_stepper_live(true, true, true);
        start_stepper_hold(NumberStepperDirection::Up, Some(handler));
        click_stepper(NumberStepperDirection::Up);
        click_stepper(NumberStepperDirection::Down);
        assert_eq!(seen.get(), 1);

        stop_stepper_hold();
    }

    #[test]
    fn number_stepper_hold_round_trips_without_timer_ops() {
        // The native test host has no timer ops, so `set_timeout`/`set_interval`
        // return 0: the hold must still track its direction and release
        // cleanly instead of panicking or leaking a cadence.
        sync_stepper_live(false, true, true);
        assert_eq!(number_stepper_holding(), None);
        start_stepper_hold(NumberStepperDirection::Up, Some(EventHandler::new(|_| {})));
        assert_eq!(number_stepper_holding(), Some(NumberStepperDirection::Up));
        stop_stepper_hold();
        assert_eq!(number_stepper_holding(), None);

        // A dead end releases a live hold (Vue's mid-hold hardening).
        sync_stepper_live(false, true, false);
        start_stepper_hold(
            NumberStepperDirection::Down,
            Some(EventHandler::new(|_| {})),
        );
        click_stepper(NumberStepperDirection::Down);
        assert_eq!(number_stepper_holding(), None);
    }

    #[test]
    fn number_steppers_styles_come_from_the_canonical_vue_sheet() {
        let css = NumberSteppersComponent::styles();
        for needle in [
            ".hk-number-input-steppers",
            ".hk-number-input-step",
            ".hk-number-input-steppers-sm",
            ".hk-number-input-steppers-md",
            ".hk-number-input-steppers-lg",
            "svg",
        ] {
            assert!(
                css.contains(needle),
                "steppers css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored steppers sheet"
        );
    }
}
