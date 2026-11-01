// packages/components/src/layout/step_flow.rs
// StepFlow — mirror of the canonical Vue `HkStepFlow`: an optional Timeline
// header bound to the current step, plus a direction-aware sliding body stage.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkStepFlow.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so `.hk-step-flow`,
// `.hk-stepflow-bodies`, `.hk-stepflow-body` and the staged
// `.hk-stepflow-enter-from` / `.hk-stepflow-leave-to` class names are literal
// and identical in both forms. The swap choreography the sheet implements is
// TWO SEQUENTIAL WINDOWS (2026-09-23 user directive, round 16): a SLIDE window
// (the sheet's height frozen, the old body sliding out while the new one slides
// in, the timeline animating alongside) and then a MORPH window (the old node
// recycled, the hosting sheet handed its new height so the fold sweeps alone).
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   div.hk-step-flow[data-sticky-header] [+host class]
//     div.hk-timeline…                     (the header, unless `hideTimeline`)
//         [.hk-scroll-pin][data-side="top"][data-strategy={bleed|offset}]
//                                          (sticky-header mode only)
//     div.hk-stepflow-bodies[data-direction={forward|back}]
//       div.hk-stepflow-body {active|leaving}[.hk-stepflow-enter-from]
//                                             [.hk-stepflow-leave-to]
//            [data-body-id={0|1}]
//         {the step body's content}
//
// Vue prop mapping: `steps` / `modelValue` → `steps` / `current_key`,
// `hideTimeline` / `timelineClickable` / `stickyHeader` / `collapse`
// one-to-one (`collapse` rides straight onto the mirrored header), `emits
// update:modelValue` → [`StepFlowProps::on_change`]. Vue's keyed slots
// (`slots[stepKey]`) have no tairitsu equivalent, so the host resolves the two
// bodies itself: `children` is the CURRENT step's body and `leaving_children`
// the one sliding out (see the deltas below).
//
// ── State contract (the tairitsu 0.5.22 limit this wave works under) ──
// Vue keeps FOUR pieces of local state: the `direction` ref (derived from its
// own index history), the `bodies` array (mount ids + phases), the `swap`
// object (which body is leaving) and the `swapPhase` ref ("idle" | "slide" |
// "morph"), plus DOM measurements (`offsetHeight`, `transitionDuration`, a
// `transitionend` listener and a watchdog timer). The mirror keeps NONE of it:
// the choreography is a PURE state machine over controlled props, and every
// DOM/timer step stays host-side.
//
//   [`step_flow_current_index`]      Vue's `indexOf` (its `-1` → `None`)
//   [`step_flow_direction`]          Vue's `modelValue` watcher (it reads only
//                                    the two indices, so a host that remembers
//                                    its previous index gets the same answer)
//   [`step_flow_step_status`]        Vue's header `statusOf`, reused verbatim
//                                    from the Timeline mirror (completion)
//   [`step_flow_completed_count`]    how many steps are behind the current one
//   [`step_flow_is_complete`]        the whole flow reached its LAST step
//   [`step_flow_begin_swap`]         the slide half of Vue's watcher
//   [`StepFlowSwap::settle`]         Vue's `endSwap` (slide done, morph left)
//   [`step_flow_bodies`]             the bodies on stage for a phase
//   [`step_flow_body_classes`]       the phase + staged transition classes
//
// The host drives the windows: on a step change it calls `step_flow_begin_swap`
// (phase `slide`), measures the transition duration, listens for
// `transitionend` / runs the watchdog, then calls `settle` (phase `morph`) and
// finally drops the swap (`None`). Reduced motion / a stylesheet-less host
// settles instantly by skipping the slide (Vue's own `swapMs <= 0` branch).
//
// Deltas vs Vue (documented, not accidental):
//   * The keyed slot map becomes `children` + `leaving_children`. During the
//     slide window two bodies render, so the host must hand in both contents;
//     the scoped slot props (`{ key, index, direction }`) are not part of the
//     DOM contract and the host knows its own keys.
//   * `data-body-id` is Vue's monotonic mount counter (its own `querySelector`
//     handle and v-for key). With no mount identities in the mirror the
//     attribute carries the body's STAGE ordinal instead (0 = the leaving body,
//     1 = the current one): deterministic, unique per stage, no counter.
//   * The `hk-stepflow-swap` CustomEvent Vue dispatches for the hosting sheet
//     (phase + measured height delta) has no mirror counterpart: the host owns
//     both the measurement and the sheet, so it can announce the same thing
//     itself when it settles the swap.
//   * Focus is not stolen: Vue blurs the leaving body's focused field before
//     the first animated frame (Android autofill strobe) while deliberately
//     KEEPING focus on a timeline step that drove the change. That needs
//     `document.activeElement` and a live `.hk-stepflow-body` closest() walk —
//     host-side browser work the mirror does not reach for.
//   * The sticky header's pin strategy is Vue's `pinStrategy` ref, measured
//     from the nearest `.hk-scroll-pin-host` (`data-pad-cover` ⇒ `offset`);
//     the mirror takes it as the controlled [`StepFlowProps::sticky_strategy`].
//     `HkScrollPin.scss` itself is not mirrored in this wave, so the markers
//     are emitted (`hk-scroll-pin`, `data-side`, `data-strategy`) but the pin
//     behaves flush unless the host ships that layer — the same documented
//     degradation as the mirrored `FileBrowserDialog` list head.
//   * `class` is an explicit prop appended last (Vue: attribute fallthrough).

use crate::display::timeline::{
    Timeline, TimelineCollapse, TimelineProps, TimelineStep, TimelineStepStatus, timeline_status_of,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct StepFlowComponent;

/// Which way the last navigation moved (Vue: the `direction` ref). Vue derives
/// it while watching `modelValue`; [`step_flow_direction`] is that derivation.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepFlowDirection {
    #[default]
    Forward,
    Back,
}

impl StepFlowDirection {
    /// The stage's `data-direction` value exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            StepFlowDirection::Forward => "forward",
            StepFlowDirection::Back => "back",
        }
    }
}

/// Sticky-header whitespace strategy (Vue: the `pinStrategy` ref, default
/// `bleed`; switch to `offset` when the scroll host declares `data-pad-cover`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepFlowPinStrategy {
    #[default]
    Bleed,
    Offset,
}

impl StepFlowPinStrategy {
    /// The header's `data-strategy` value exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            StepFlowPinStrategy::Bleed => "bleed",
            StepFlowPinStrategy::Offset => "offset",
        }
    }
}

/// Which window of the two-stage choreography is playing (Vue: the
/// `swapPhase` ref). `Morph` is the window AFTER the leaving body was recycled.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum StepFlowSwapPhase {
    #[default]
    Idle,
    Slide,
    Morph,
}

impl StepFlowSwapPhase {
    /// The phase token (Vue spells the same three strings on `swapPhase`).
    pub fn token(self) -> &'static str {
        match self {
            StepFlowSwapPhase::Idle => "idle",
            StepFlowSwapPhase::Slide => "slide",
            StepFlowSwapPhase::Morph => "morph",
        }
    }
}

/// A body's role on the stage (Vue: the `phase` field of a `BodyEntry`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum StepFlowBodyPhase {
    Active,
    Leaving,
}

impl StepFlowBodyPhase {
    /// The body's phase class exactly as Vue emits it.
    pub fn name(self) -> &'static str {
        match self {
            StepFlowBodyPhase::Active => "active",
            StepFlowBodyPhase::Leaving => "leaving",
        }
    }
}

/// One body on the stage (Vue: a `BodyEntry` without its mount id).
#[derive(Clone, PartialEq, Debug)]
pub struct StepFlowBody {
    /// The step key this body renders.
    pub key: String,
    /// `active` (the current step) or `leaving` (sliding out).
    pub phase: StepFlowBodyPhase,
}

/// The swap in flight, folding Vue's `swap` object and its `swapPhase` ref into
/// ONE controlled value. `None` is Vue's `idle` with no swap.
#[derive(Clone, PartialEq, Debug)]
pub struct StepFlowSwap {
    /// Step key of the body sliding out (Vue: `swap.leavingId`'s entry key).
    pub leaving_key: String,
    /// Which window is playing.
    pub phase: StepFlowSwapPhase,
}

impl StepFlowSwap {
    /// A slide window that leaves `leaving_key` — the object Vue builds inside
    /// its `modelValue` watcher.
    pub fn slide(leaving_key: impl Into<String>) -> Self {
        Self {
            leaving_key: leaving_key.into(),
            phase: StepFlowSwapPhase::Slide,
        }
    }

    /// Vue's `endSwap`: the slide is over, the leaving body has been recycled
    /// (it is gone from `bodies` before the morph is announced) and only the
    /// morph window is left.
    pub fn settle(self) -> Self {
        Self {
            leaving_key: self.leaving_key,
            phase: StepFlowSwapPhase::Morph,
        }
    }

    /// Is the leaving body still on stage? (Vue: `swap !== null`.)
    pub fn is_sliding(&self) -> bool {
        self.phase == StepFlowSwapPhase::Slide
    }
}

/// Vue's `steps.findIndex(s => s.key === key)`, whose "not found" sentinel is
/// `-1`; the mirror spells that `None`.
pub fn step_flow_current_index(steps: &[TimelineStep], current_key: &str) -> Option<usize> {
    steps.iter().position(|step| step.key == current_key)
}

/// Vue's `modelValue` watcher, as the derivation it is: `back` only when BOTH
/// indices resolve and the move goes towards the start; every other case
/// (first render, a key that matches nothing, a forward move) is `forward`.
pub fn step_flow_direction(previous: Option<usize>, next: Option<usize>) -> StepFlowDirection {
    match (previous, next) {
        (Some(previous), Some(next)) if next < previous => StepFlowDirection::Back,
        _ => StepFlowDirection::Forward,
    }
}

/// [`step_flow_direction`] over the two step keys — the shape a host actually
/// holds while it navigates.
pub fn step_flow_direction_from_keys(
    steps: &[TimelineStep],
    previous_key: &str,
    current_key: &str,
) -> StepFlowDirection {
    step_flow_direction(
        step_flow_current_index(steps, previous_key),
        step_flow_current_index(steps, current_key),
    )
}

/// The step's status relative to the current one: steps before it are
/// `completed`, it is `active`, everything after is `pending` — Vue's header
/// `statusOf`, reused verbatim from the Timeline mirror so the two can never
/// drift. A current key that matches nothing leaves every step `pending`.
pub fn step_flow_step_status(current_index: Option<usize>, index: usize) -> TimelineStepStatus {
    timeline_status_of(current_index, index)
}

/// How many steps are already behind the current one (Vue: `currentIndex`, with
/// its `-1` read as "none reached").
pub fn step_flow_completed_count(steps: &[TimelineStep], current_key: &str) -> usize {
    step_flow_current_index(steps, current_key).unwrap_or(0)
}

/// The whole flow reached its LAST step — the completion judgement a host needs
/// for "finish" affordances. An empty flow is never complete, and an unknown
/// current key leaves it incomplete (Vue's `-1`).
pub fn step_flow_is_complete(steps: &[TimelineStep], current_key: &str) -> bool {
    match step_flow_current_index(steps, current_key) {
        Some(index) => index + 1 == steps.len(),
        None => false,
    }
}

/// The bodies on stage, in Vue's emission order: the leaving body FIRST, then
/// the current one. Only the slide window holds two bodies — after `settle`
/// the leaving body has been recycled, so the morph window (like `idle`) shows
/// the single current body.
pub fn step_flow_bodies(current_key: &str, swap: Option<&StepFlowSwap>) -> Vec<StepFlowBody> {
    match swap {
        Some(swap) if swap.is_sliding() => vec![
            StepFlowBody {
                key: swap.leaving_key.clone(),
                phase: StepFlowBodyPhase::Leaving,
            },
            StepFlowBody {
                key: current_key.to_string(),
                phase: StepFlowBodyPhase::Active,
            },
        ],
        _ => vec![StepFlowBody {
            key: current_key.to_string(),
            phase: StepFlowBodyPhase::Active,
        }],
    }
}

/// A body's class attribute: its phase class, plus the staged transition class
/// the sheet animates. Vue stages the ENTERING body (`enter-from`) only while
/// `swapPhase === "slide"`, and gives the leaving body its `leave-to` offset
/// for as long as it exists (which is exactly the slide window).
pub fn step_flow_body_classes(phase: StepFlowBodyPhase, swap_phase: StepFlowSwapPhase) -> String {
    let mut classes = format!("hk-stepflow-body {}", phase.name());
    match phase {
        StepFlowBodyPhase::Leaving => classes.push_str(" hk-stepflow-leave-to"),
        StepFlowBodyPhase::Active if swap_phase == StepFlowSwapPhase::Slide => {
            classes.push_str(" hk-stepflow-enter-from");
        }
        StepFlowBodyPhase::Active => {}
    }
    classes
}

/// The body's `data-body-id`: Vue's monotonic mount counter there, the stage
/// ordinal here (`0` = the leaving body, `1` = the current one) — see the file
/// header's deltas.
pub fn step_flow_body_id(phase: StepFlowBodyPhase) -> &'static str {
    match phase {
        StepFlowBodyPhase::Leaving => "0",
        StepFlowBodyPhase::Active => "1",
    }
}

/// The slide half of Vue's `modelValue` watcher, as a pure reducer: a changed
/// step starts a slide that leaves the previous one. An unchanged step starts
/// nothing (Vue returns early on `next === prev`).
pub fn step_flow_begin_swap(previous_key: &str, next_key: &str) -> Option<StepFlowSwap> {
    if previous_key == next_key {
        None
    } else {
        Some(StepFlowSwap::slide(previous_key))
    }
}

/// The root class list: `.hk-step-flow` plus the host class appended last.
pub fn step_flow_root_classes(class: &str) -> String {
    let mut classes = String::from("hk-step-flow");
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

/// Stamp the scroll-pin markers onto the mirrored header's root. Vue reaches
/// them through attribute fallthrough (`class` / `data-side` / `data-strategy`
/// all land on the timeline root); the mirrored `Timeline` exposes `class` but
/// no generic passthrough, so the two data markers are set on the node it
/// returns — the same element the sheet's
/// `.hk-step-flow[data-sticky-header] > .hk-timeline.hk-scroll-pin` rule styles.
fn step_flow_pin_header(header: Element, strategy: StepFlowPinStrategy) -> Element {
    match header {
        VNode::Element(element) => {
            let element = (*element)
                .attr("data-side", "top")
                .attr("data-strategy", strategy.token());
            VNode::Element(Box::new(element))
        }
        // The timeline mirror always renders an element; keep the fallback so a
        // future fragment header can never be dropped.
        other => other,
    }
}

#[define_props]
pub struct StepFlowProps {
    /// The flow's steps, in order (Vue: required `steps`).
    pub steps: Vec<TimelineStep>,

    /// The step currently on stage (Vue: required `modelValue`).
    pub current_key: String,

    /// Vue: `hideTimeline` — render the bodies without the header.
    #[default]
    pub hide_timeline: bool,

    /// Vue: `timelineClickable` — completed header steps become selectable.
    #[default]
    pub timeline_clickable: bool,

    /// Vue: `stickyHeader` — pin the header to the scroll host's top.
    #[default]
    pub sticky_header: bool,

    /// Vue: `collapse`, forwarded to the header timeline (default `auto`).
    #[default]
    pub collapse: TimelineCollapse,

    /// Vue's `pinStrategy` ref, as a controlled prop (see the file header).
    #[default]
    pub sticky_strategy: StepFlowPinStrategy,

    /// Direction of the last navigation (Vue: its own `direction` ref; derive it
    /// with [`step_flow_direction_from_keys`]).
    #[default]
    pub direction: StepFlowDirection,

    /// The swap in flight (Vue: `swap` + `swapPhase`); `None` is `idle`.
    pub swap: Option<StepFlowSwap>,

    /// Body content for the step sliding out — Vue's keyed slot of the leaving
    /// step. Only consulted while `swap` is in its slide window.
    pub leaving_children: Option<Element>,

    /// Body content for the current step — Vue's keyed slot of `modelValue`.
    pub children: Element,

    /// Fired when the header timeline selects a completed step (Vue: `emit
    /// ("update:modelValue", key)`).
    pub on_change: Option<EventHandler<String>>,

    /// Vue attribute fallthrough onto the root `<div>`.
    #[default]
    pub class: String,
}

#[component]
pub fn StepFlow(props: StepFlowProps) -> Element {
    let swap_phase = props
        .swap
        .as_ref()
        .map(|swap| swap.phase)
        .unwrap_or_default();

    let mut root = VElement::new("div").class(step_flow_root_classes(&props.class));
    if props.sticky_header {
        root = root.attr("data-sticky-header", "");
    }

    if !props.hide_timeline {
        // The header is the mirrored Timeline, bound to the same steps and the
        // same current key. Vue passes neither `orientation` nor `collapsed`,
        // so both stay at the Timeline defaults here too (which is why the
        // header only windows when `collapse` is `always`).
        let header = Timeline(TimelineProps {
            steps: props.steps.clone(),
            current_key: props.current_key.clone(),
            clickable: props.timeline_clickable,
            collapse: props.collapse,
            class: if props.sticky_header {
                "hk-scroll-pin".to_string()
            } else {
                String::new()
            },
            on_select: props.on_change.clone(),
            ..Default::default()
        });
        root = root.child(if props.sticky_header {
            step_flow_pin_header(header, props.sticky_strategy)
        } else {
            header
        });
    }

    let mut stage = VElement::new("div")
        .class("hk-stepflow-bodies")
        .attr("data-direction", props.direction.token());
    for body in step_flow_bodies(&props.current_key, props.swap.as_ref()) {
        let content = match body.phase {
            StepFlowBodyPhase::Leaving => {
                props.leaving_children.clone().unwrap_or_else(empty_vnode)
            }
            StepFlowBodyPhase::Active => props.children.clone(),
        };
        let element = VElement::new("div")
            .class(step_flow_body_classes(body.phase, swap_phase))
            .attr("data-body-id", step_flow_body_id(body.phase))
            .child(content);
        stage = stage.child(VNode::Element(Box::new(element)));
    }
    root = root.child(VNode::Element(Box::new(stage)));

    VNode::Element(Box::new(root))
}

impl StyledComponent for StepFlowComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkStepFlow.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "step-flow"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn steps() -> Vec<TimelineStep> {
        ["Alpha", "Beta", "Gamma", "Delta"]
            .iter()
            .enumerate()
            .map(|(index, label)| TimelineStep {
                key: format!("s{index}"),
                label: (*label).to_string(),
                icon: None,
                disabled: false,
            })
            .collect()
    }

    fn count(haystack: &str, needle: &str) -> usize {
        haystack.matches(needle).count()
    }

    #[test]
    fn step_flow_defaults_match_the_vue_props() {
        let props = StepFlowProps::default();
        assert!(props.steps.is_empty());
        assert_eq!(props.current_key, "");
        assert!(!props.hide_timeline);
        assert!(!props.timeline_clickable);
        assert!(!props.sticky_header);
        assert_eq!(props.collapse, TimelineCollapse::Auto);
        assert_eq!(props.sticky_strategy, StepFlowPinStrategy::Bleed);
        assert_eq!(props.direction, StepFlowDirection::Forward);
        assert!(props.swap.is_none());
        assert!(props.leaving_children.is_none());
        assert!(props.on_change.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn step_flow_tokens_match_the_vue_attribute_values() {
        assert_eq!(StepFlowDirection::Forward.token(), "forward");
        assert_eq!(StepFlowDirection::Back.token(), "back");
        assert_eq!(StepFlowPinStrategy::Bleed.token(), "bleed");
        assert_eq!(StepFlowPinStrategy::Offset.token(), "offset");
        assert_eq!(StepFlowSwapPhase::Idle.token(), "idle");
        assert_eq!(StepFlowSwapPhase::Slide.token(), "slide");
        assert_eq!(StepFlowSwapPhase::Morph.token(), "morph");
        assert_eq!(StepFlowBodyPhase::Active.name(), "active");
        assert_eq!(StepFlowBodyPhase::Leaving.name(), "leaving");
    }

    #[test]
    fn step_flow_current_index_matches_the_vue_find_index() {
        let steps = steps();
        assert_eq!(step_flow_current_index(&steps, "s0"), Some(0));
        assert_eq!(step_flow_current_index(&steps, "s3"), Some(3));
        // Vue's `-1` sentinel, spelled `None`.
        assert_eq!(step_flow_current_index(&steps, "missing"), None);
        assert_eq!(step_flow_current_index(&steps, ""), None);
        assert_eq!(step_flow_current_index(&[], "s0"), None);
    }

    #[test]
    fn step_flow_direction_follows_the_index_history() {
        // Backwards moves are `back`; forwards, first renders and unresolved
        // keys are `forward` (Vue's watcher requires both indices to resolve).
        assert_eq!(
            step_flow_direction(Some(2), Some(1)),
            StepFlowDirection::Back
        );
        assert_eq!(
            step_flow_direction(Some(1), Some(2)),
            StepFlowDirection::Forward
        );
        assert_eq!(
            step_flow_direction(Some(1), Some(1)),
            StepFlowDirection::Forward
        );
        assert_eq!(
            step_flow_direction(None, Some(0)),
            StepFlowDirection::Forward
        );
        assert_eq!(
            step_flow_direction(Some(0), None),
            StepFlowDirection::Forward
        );
        assert_eq!(step_flow_direction(None, None), StepFlowDirection::Forward);

        // The key-based shape a host holds.
        let steps = steps();
        assert_eq!(
            step_flow_direction_from_keys(&steps, "s2", "s1"),
            StepFlowDirection::Back
        );
        assert_eq!(
            step_flow_direction_from_keys(&steps, "s1", "s2"),
            StepFlowDirection::Forward
        );
        assert_eq!(
            step_flow_direction_from_keys(&steps, "missing", "s2"),
            StepFlowDirection::Forward
        );
    }

    #[test]
    fn step_flow_completion_marks_completed_active_and_pending() {
        // The header's `statusOf` — the completion judgement the flow needs too.
        let current = Some(2);
        assert_eq!(
            step_flow_step_status(current, 0),
            TimelineStepStatus::Completed
        );
        assert_eq!(
            step_flow_step_status(current, 1),
            TimelineStepStatus::Completed
        );
        assert_eq!(
            step_flow_step_status(current, 2),
            TimelineStepStatus::Active
        );
        assert_eq!(
            step_flow_step_status(current, 3),
            TimelineStepStatus::Pending
        );
        // An unresolved current key leaves every step pending.
        assert_eq!(step_flow_step_status(None, 0), TimelineStepStatus::Pending);
    }

    #[test]
    fn step_flow_completion_gates_on_the_last_step() {
        let steps = steps();
        // Boundary cases: first step, middle, LAST step, unknown key, empty.
        assert_eq!(step_flow_completed_count(&steps, "s0"), 0);
        assert_eq!(step_flow_completed_count(&steps, "s2"), 2);
        assert_eq!(step_flow_completed_count(&steps, "s3"), 3);
        assert_eq!(step_flow_completed_count(&steps, "missing"), 0);
        assert_eq!(step_flow_completed_count(&[], "s0"), 0);

        assert!(!step_flow_is_complete(&steps, "s0"));
        assert!(!step_flow_is_complete(&steps, "s2"));
        assert!(step_flow_is_complete(&steps, "s3"));
        assert!(!step_flow_is_complete(&steps, "missing"));
        assert!(!step_flow_is_complete(&[], ""));
        // A one-step flow is complete on its only step.
        assert!(step_flow_is_complete(&steps[0..1], "s0"));
    }

    #[test]
    fn step_flow_bodies_follow_the_swap_phase() {
        // idle / morph: a single current body.
        let idle = step_flow_bodies("s1", None);
        assert_eq!(idle.len(), 1);
        assert_eq!(idle[0].key, "s1");
        assert_eq!(idle[0].phase, StepFlowBodyPhase::Active);

        let morph = step_flow_bodies("s1", Some(&StepFlowSwap::slide("s0").settle()));
        assert_eq!(morph.len(), 1);
        assert_eq!(morph[0].key, "s1");
        assert_eq!(morph[0].phase, StepFlowBodyPhase::Active);

        // slide: the leaving body first (Vue appends the entering one).
        let slide = step_flow_bodies("s1", Some(&StepFlowSwap::slide("s0")));
        assert_eq!(slide.len(), 2);
        assert_eq!(slide[0].key, "s0");
        assert_eq!(slide[0].phase, StepFlowBodyPhase::Leaving);
        assert_eq!(slide[1].key, "s1");
        assert_eq!(slide[1].phase, StepFlowBodyPhase::Active);
    }

    #[test]
    fn step_flow_body_classes_stage_the_transition() {
        // Idle/morph: the current body is plain `active`.
        assert_eq!(
            step_flow_body_classes(StepFlowBodyPhase::Active, StepFlowSwapPhase::Idle),
            "hk-stepflow-body active"
        );
        assert_eq!(
            step_flow_body_classes(StepFlowBodyPhase::Active, StepFlowSwapPhase::Morph),
            "hk-stepflow-body active"
        );
        // Slide: the entering body is staged, the leaving body gets leave-to.
        assert_eq!(
            step_flow_body_classes(StepFlowBodyPhase::Active, StepFlowSwapPhase::Slide),
            "hk-stepflow-body active hk-stepflow-enter-from"
        );
        assert_eq!(
            step_flow_body_classes(StepFlowBodyPhase::Leaving, StepFlowSwapPhase::Slide),
            "hk-stepflow-body leaving hk-stepflow-leave-to"
        );
        // The stage ordinals are unique per stage.
        assert_eq!(step_flow_body_id(StepFlowBodyPhase::Leaving), "0");
        assert_eq!(step_flow_body_id(StepFlowBodyPhase::Active), "1");
        assert_ne!(
            step_flow_body_id(StepFlowBodyPhase::Leaving),
            step_flow_body_id(StepFlowBodyPhase::Active)
        );
    }

    #[test]
    fn step_flow_swap_reducer_starts_and_settles() {
        // A moved step starts a slide from the step that was on stage.
        let swap = step_flow_begin_swap("s0", "s1").expect("a slide");
        assert_eq!(swap.leaving_key, "s0");
        assert_eq!(swap.phase, StepFlowSwapPhase::Slide);
        assert!(swap.is_sliding());

        // The same key starts nothing (Vue's `next === prev` early return).
        assert!(step_flow_begin_swap("s1", "s1").is_none());

        // Settling keeps the leaving key for reference but recycles the body.
        let settled = swap.clone().settle();
        assert_eq!(settled.leaving_key, "s0");
        assert_eq!(settled.phase, StepFlowSwapPhase::Morph);
        assert!(!settled.is_sliding());
        assert_eq!(step_flow_bodies("s1", Some(&settled)).len(), 1);
    }

    #[test]
    fn step_flow_root_classes_append_the_host_class() {
        assert_eq!(step_flow_root_classes(""), "hk-step-flow");
        assert_eq!(step_flow_root_classes("host"), "hk-step-flow host");
    }

    #[test]
    fn step_flow_renders_the_vue_dom_contract() {
        let html = StepFlow(StepFlowProps {
            steps: steps(),
            current_key: "s1".to_string(),
            class: "host".to_string(),
            children: rsx! {
                p { "data-el": "body", "beta" }
            },
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"class="hk-step-flow host""#), "{html}");
        assert!(!html.contains("data-sticky-header"), "{html}");
        // The header is the mirrored timeline, bound to the current step.
        assert!(html.contains("hk-timeline"), "{html}");
        assert_eq!(count(&html, r#"class="hk-timeline-step""#), 4, "{html}");
        assert_eq!(count(&html, r#"data-status="completed""#), 1, "{html}");
        assert_eq!(count(&html, r#"data-status="active""#), 1, "{html}");
        assert!(html.contains(r#"aria-current="step""#), "{html}");
        // The stage: one current body, forward, ordinal 1.
        assert!(
            html.contains(r#"data-direction="forward" class="hk-stepflow-bodies""#),
            "{html}"
        );
        assert!(
            html.contains(r#"data-body-id="1" class="hk-stepflow-body active""#),
            "{html}"
        );
        assert!(html.contains(r#"data-el="body""#), "{html}");
        assert!(html.contains(">beta<"), "{html}");
    }

    #[test]
    fn step_flow_slide_stages_both_bodies() {
        let html = StepFlow(StepFlowProps {
            steps: steps(),
            current_key: "s2".to_string(),
            direction: StepFlowDirection::Back,
            swap: Some(StepFlowSwap::slide("s1")),
            leaving_children: Some(rsx! {
                p { "data-el": "leaving", "beta" }
            }),
            children: rsx! {
                p { "data-el": "current", "gamma" }
            },
            ..Default::default()
        })
        .render_to_html();

        assert!(
            html.contains(r#"data-direction="back""#),
            "the direction prop rides the stage: {html}"
        );
        assert_eq!(count(&html, "hk-stepflow-body "), 2, "{html}");
        assert!(
            html.contains(
                r#"data-body-id="0" class="hk-stepflow-body leaving hk-stepflow-leave-to""#
            ),
            "{html}"
        );
        assert!(
            html.contains(
                r#"data-body-id="1" class="hk-stepflow-body active hk-stepflow-enter-from""#
            ),
            "{html}"
        );
        // The leaving body renders the host's leaving content, first in DOM order.
        let leaving = html.find(r#"data-el="leaving""#).expect("leaving body");
        let current = html.find(r#"data-el="current""#).expect("current body");
        assert!(leaving < current, "{html}");
    }

    #[test]
    fn step_flow_hides_the_timeline_and_pins_a_sticky_header() {
        // hideTimeline: the bodies stand alone.
        let html = StepFlow(StepFlowProps {
            steps: steps(),
            current_key: "s0".to_string(),
            hide_timeline: true,
            children: rsx! {
                p { "body" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-timeline"), "{html}");
        assert!(html.contains("hk-stepflow-bodies"), "{html}");

        // stickyHeader: the header carries the scroll-pin contract.
        let html = StepFlow(StepFlowProps {
            steps: steps(),
            current_key: "s1".to_string(),
            sticky_header: true,
            sticky_strategy: StepFlowPinStrategy::Offset,
            children: rsx! {
                p { "body" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-sticky-header="""#), "{html}");
        assert!(html.contains("hk-timeline hk-scroll-pin"), "{html}");
        assert!(html.contains(r#"data-side="top""#), "{html}");
        assert!(html.contains(r#"data-strategy="offset""#), "{html}");
    }

    #[test]
    fn step_flow_empty_flow_renders_the_bare_shell() {
        // Boundary: no steps, no current key — a shell, never a panic.
        let html = StepFlow(StepFlowProps::default()).render_to_html();
        assert!(html.contains("hk-step-flow"), "{html}");
        assert!(html.contains("hk-stepflow-bodies"), "{html}");
        assert_eq!(count(&html, "hk-stepflow-body "), 1, "{html}");
        assert!(!html.contains("hk-timeline-step"), "{html}");
    }

    #[test]
    fn step_flow_styles_come_from_the_canonical_vue_sheet() {
        let css = StepFlowComponent::styles();
        for needle in [
            ".hk-step-flow",
            "hk-stepflow-bodies",
            "hk-stepflow-body",
            "hk-stepflow-enter-from",
            "hk-stepflow-leave-to",
            "hk-stepflow-duration",
            "hk-scroll-pin",
            "prefers-reduced-motion",
        ] {
            assert!(
                css.contains(needle),
                "step-flow css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored step-flow sheet"
        );
    }
}
