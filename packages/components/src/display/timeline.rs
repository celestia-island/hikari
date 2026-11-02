// packages/components/src/display/timeline.rs
// Timeline — mirror of the canonical Vue `HkTimeline` (the step stepper).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTimeline.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so every
// `.hk-timeline*` class name and every `data-*` hook is literal and
// identical in both forms.
//
// DOM contract (mirrors Vue's render output one-to-one):
//
//   ── full mode ──
//   div.hk-timeline data-mode="full" data-orientation={horizontal|vertical}
//          [data-dir={forward|back}] [+host class]
//     div.hk-timeline-step data-status={completed|active|pending}
//          [data-last] [aria-current="step"] [data-disabled] [data-clickable]
//          [role="button"] [tabindex="0"]
//       span[data-el="indicator"][aria-hidden="true"]
//         span[style="display:contents"] > svg[data-el="check"]  (completed)
//         span[data-el="num"]                                    (else, idx+1)
//       span[data-el="label"]                                    (step.label)
//       div[data-el="connector"]                                 (not the last)
//
//   ── window mode ──
//   div.hk-timeline data-mode="window" data-orientation=... [data-dir=...]
//     div.hk-timeline-links[aria-hidden="true"]
//       div.hk-timeline-link data-segment={before-current|current-after|
//                                          edge-before|edge-after}
//            data-status={completed|pending}
//            [data-fade-dir={left|right|up|down}]
//     div.hk-timeline-window data-side="before" [data-dimmed]   (previous step)
//     div.hk-timeline-window data-side="current"                (current step)
//     div.hk-timeline-window data-side="after" [data-dimmed]    (next step)
//
// Vue prop mapping: `steps` → [`TimelineProps::steps`], `currentKey` →
// [`TimelineProps::current_key`], `orientation` / `clickable` / `collapse`
// one-to-one, `select` → [`TimelineProps::on_select`]. The value math is
// Vue's, helper by helper: `computeTimelineWindow` / `statusOf` / the
// `windowable` + `windowed` gates all live in the free functions below so
// they are testable without a DOM.
//
// State contract (the tairitsu 0.5.22 limit this wave works under): Vue keeps
// `collapsed` in a local ref driven by a `ResizeObserver` over offscreen
// `max-content` probes and derives `navDir` in a watcher over
// `currentIndex`. The mirror keeps NO state — `collapsed` and `nav_dir` are
// CONTROLLED props (the host measures / remembers its own index history) and
// every derived value is a pure function recomputed per render.
//
// Behaviour deltas vs Vue (documented, not accidental):
//   * `collapse: "auto"` cannot measure anything here: the window engages
//     only when the host reports `collapsed`, so Vue's `16px` expand
//     hysteresis and its natural-size probes are host-side work.
//   * `nav_dir` ("forward" / "back") comes from Vue's own index history; the
//     mirror takes it as a prop. `data-dir` stays absent until the host
//     reports a direction, which is exactly Vue's absent-on-first-render
//     contract (the opening frame must not animate).
//   * Vue's lucide `<Check>` is mounted as trusted SVG markup on a
//     `display:contents` span: tairitsu creates HTML-namespaced elements, so
//     an `svg {}` rsx child would never paint. The svg keeps
//     `data-el="check"`, so the sheet's `[data-el="check"]` hook matches
//     exactly as it does over Vue's node.
//   * `TimelineStep::icon` exists on Vue's type but `renderStep` never
//     renders it; it is carried for type parity only.
//   * The legacy Rust `Timeline` / `TimelineItem` (position/line/title shells
//     over `hk-timeline-dot` / `hk-timeline-content` / `hk-timeline-time`) is
//     retired: Vue's component is a step stepper, not an event feed.

// The parser/mirror branches keep Vue's nesting for readability; clippy's
// collapsible-if rewrite makes the token loops harder to compare line by line.
#![allow(clippy::collapsible_if)]
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TimelineComponent;

/// The lucide `Check` glyph Vue renders for a completed step
/// (`<Check size={12} strokeWidth={3} />`) — the verbatim lucide node, keeping
/// the `data-el="check"` hook the sheet styles.
const TIMELINE_CHECK_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="12" height="12" data-el="check" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"/></svg>"#;

/// Track direction (Vue: `"horizontal" | "vertical"`, default `horizontal`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TimelineOrientation {
    #[default]
    Horizontal,
    Vertical,
}

impl TimelineOrientation {
    /// The root's `data-orientation` value exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            TimelineOrientation::Horizontal => "horizontal",
            TimelineOrientation::Vertical => "vertical",
        }
    }
}

/// When the compact three-cell window replaces the full row (Vue:
/// `"auto" | "always" | "never"`, default `auto`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TimelineCollapse {
    #[default]
    Auto,
    Always,
    Never,
}

impl TimelineCollapse {
    /// The prop token exactly as Vue declares it.
    pub fn token(self) -> &'static str {
        match self {
            TimelineCollapse::Auto => "auto",
            TimelineCollapse::Always => "always",
            TimelineCollapse::Never => "never",
        }
    }
}

/// Navigation direction of the last step change, once one happened
/// (Vue: the `navDir` ref, surfaced as `data-dir`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum TimelineNavDir {
    Forward,
    Back,
}

impl TimelineNavDir {
    /// The root's `data-dir` value exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            TimelineNavDir::Forward => "forward",
            TimelineNavDir::Back => "back",
        }
    }
}

/// Which mode the root renders (Vue: `data-mode`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum TimelineMode {
    #[default]
    Full,
    Window,
}

impl TimelineMode {
    /// The root's `data-mode` value exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            TimelineMode::Full => "full",
            TimelineMode::Window => "window",
        }
    }
}

/// A step's position relative to the current one (Vue: `TimelineStepStatus`).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum TimelineStepStatus {
    Completed,
    Active,
    Pending,
}

impl TimelineStepStatus {
    /// The step's `data-status` value exactly as Vue emits it.
    pub fn token(self) -> &'static str {
        match self {
            TimelineStepStatus::Completed => "completed",
            TimelineStepStatus::Active => "active",
            TimelineStepStatus::Pending => "pending",
        }
    }
}

/// One step (Vue: `TimelineStep`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TimelineStep {
    /// Stable identity the host matches `current_key` against.
    pub key: String,
    pub label: String,
    /// Carried for type parity only — Vue's `renderStep` never renders it.
    pub icon: Option<String>,
    /// Greyed and inert, but still visible (Vue: `disabled`).
    pub disabled: bool,
}

/// The compact window's neighbour selection (Vue: `TimelineWindowState`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TimelineWindowState {
    /// Index of the step shown left of / above the current one; `None` at the
    /// start (Vue's `-1`).
    pub before_index: Option<usize>,
    /// Index of the step shown right of / below the current one; `None` at
    /// the end (Vue's `-1`).
    pub after_index: Option<usize>,
    /// Earlier steps exist beyond the window's left edge (fade that side).
    pub fade_before: bool,
    /// Later steps exist beyond the window's right edge (fade that side).
    pub fade_after: bool,
}

/// One bond segment of the window-mode link overlay, in Vue's emission order.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct TimelineLinkSegment {
    /// `before-current` / `current-after` / `edge-before` / `edge-after`.
    pub segment: &'static str,
    /// The neighbour whose status colours this bond.
    pub index: usize,
    /// Set on the two edge continuations only (`left`/`right` or `up`/`down`).
    pub fade_dir: Option<&'static str>,
}

/// Index of `current_key` in `steps` (Vue: `steps.findIndex(...)`, whose
/// "not found" sentinel is `-1`; the mirror spells that `None`).
pub fn timeline_current_index(steps: &[TimelineStep], current_key: &str) -> Option<usize> {
    steps.iter().position(|step| step.key == current_key)
}

/// Vue's `statusOf`: steps before the current one are `completed`, the current
/// one is `active`, everything after (and everything when no step matches
/// `current_key`) is `pending`.
pub fn timeline_status_of(current_index: Option<usize>, index: usize) -> TimelineStepStatus {
    match current_index {
        Some(current) if index < current => TimelineStepStatus::Completed,
        Some(current) if index == current => TimelineStepStatus::Active,
        _ => TimelineStepStatus::Pending,
    }
}

/// Vue's `windowable`: the window only makes sense for more steps than it can
/// show (a 3-step timeline IS its own window), and only with a current step.
pub fn timeline_is_windowable(step_count: usize, current_index: Option<usize>) -> bool {
    step_count > 3 && current_index.is_some()
}

/// Vue's `windowed`: the windowable gate AND (`always`, or `auto` while the
/// host reports the row/column collapsed).
pub fn timeline_is_windowed(windowable: bool, collapse: TimelineCollapse, collapsed: bool) -> bool {
    windowable
        && (collapse == TimelineCollapse::Always
            || (collapse == TimelineCollapse::Auto && collapsed))
}

/// Vue's `computeTimelineWindow`: at most one neighbour per side, and a side
/// only fades when further hidden steps continue past it.
pub fn timeline_window(steps: &[TimelineStep], current_key: &str) -> TimelineWindowState {
    let Some(index) = timeline_current_index(steps, current_key) else {
        return TimelineWindowState::default();
    };
    TimelineWindowState {
        before_index: index.checked_sub(1),
        after_index: if index + 1 < steps.len() {
            Some(index + 1)
        } else {
            None
        },
        // Vue: `currentIndex - 1 > 0`.
        fade_before: index > 1,
        // Vue: `currentIndex + 1 < steps.length - 1`.
        fade_after: index + 2 < steps.len(),
    }
}

/// The window-mode link overlay, in Vue's emission order. A bond is only
/// emitted for a neighbour that exists, and an edge continuation only when
/// that side still hides steps (its fade runs into the container edge).
pub fn timeline_link_segments(
    state: &TimelineWindowState,
    orientation: TimelineOrientation,
) -> Vec<TimelineLinkSegment> {
    let (edge_before_dir, edge_after_dir) = match orientation {
        TimelineOrientation::Horizontal => ("left", "right"),
        TimelineOrientation::Vertical => ("up", "down"),
    };
    let mut segments = Vec::new();
    if let Some(index) = state.before_index {
        segments.push(TimelineLinkSegment {
            segment: "before-current",
            index,
            fade_dir: None,
        });
    }
    if let Some(index) = state.after_index {
        segments.push(TimelineLinkSegment {
            segment: "current-after",
            index,
            fade_dir: None,
        });
    }
    if let Some(index) = state.before_index {
        if state.fade_before {
            segments.push(TimelineLinkSegment {
                segment: "edge-before",
                index,
                fade_dir: Some(edge_before_dir),
            });
        }
    }
    if let Some(index) = state.after_index {
        if state.fade_after {
            segments.push(TimelineLinkSegment {
                segment: "edge-after",
                index,
                fade_dir: Some(edge_after_dir),
            });
        }
    }
    segments
}

/// Vue: `clickable && status === "completed" && !step.disabled` — the step
/// takes the pointer/keyboard path (and `data-clickable` / `tabindex="0"`).
pub fn timeline_step_actionable(
    clickable: bool,
    status: TimelineStepStatus,
    disabled: bool,
) -> bool {
    clickable && status == TimelineStepStatus::Completed && !disabled
}

/// The root class list: `.hk-timeline` plus the host class appended last, the
/// way Vue's attribute fallthrough merges it.
pub fn timeline_root_classes(class: &str) -> String {
    let mut classes = String::from("hk-timeline");
    if !class.is_empty() {
        classes.push(' ');
        classes.push_str(class);
    }
    classes
}

fn timeline_step_node(
    index: usize,
    step: &TimelineStep,
    status: TimelineStepStatus,
    clickable: bool,
    connector: bool,
    last: bool,
    on_select: &Option<EventHandler<String>>,
) -> VNode {
    let actionable = timeline_step_actionable(clickable, status, step.disabled);

    let mut el = VElement::new("div")
        .class("hk-timeline-step")
        .attr("data-status", status.token());
    if last {
        el = el.attr("data-last", "");
    }
    if status == TimelineStepStatus::Active {
        el = el.attr("aria-current", "step");
    }
    if step.disabled {
        el = el.attr("data-disabled", "");
    }
    if actionable {
        el = el.attr("data-clickable", "");
    }
    // Vue: `role="button"` for every enabled step of a clickable stepper (the
    // completed ones are the only ones with a tabindex, see below).
    if clickable && !step.disabled {
        el = el.attr("role", "button");
    }
    if actionable {
        el = el.attr("tabindex", "0");
    }

    let key = step.key.clone();
    let select_click = on_select.clone();
    el = el.on_click(move |_event: MouseEvent| {
        if !actionable {
            return;
        }
        if let Some(handler) = select_click.as_ref() {
            handler.call(key.clone());
        }
    });

    let key = step.key.clone();
    let select_key = on_select.clone();
    el = el.on_keydown(move |event: KeyboardEvent| {
        if !actionable {
            return;
        }
        if event.key == "Enter" || event.key == " " {
            event.prevent_default();
            if let Some(handler) = select_key.as_ref() {
                handler.call(key.clone());
            }
        }
    });

    let indicator = if status == TimelineStepStatus::Completed {
        // Trusted static markup on a `display:contents` host (see the file
        // header): the svg itself keeps `data-el="check"`.
        VNode::Element(Box::new(
            VElement::new("span")
                .style("display:contents")
                .dangerous_inner_html(TIMELINE_CHECK_SVG),
        ))
    } else {
        let number = (index + 1).to_string();
        rsx! {
            span { "data-el": "num", "{number}" }
        }
    };
    el = el.child(rsx! {
        span { "data-el": "indicator", "aria-hidden": "true",
            {indicator}
        }
    });

    let label = step.label.clone();
    el = el.child(rsx! {
        span { "data-el": "label", "{label}" }
    });

    if connector {
        el = el.child(rsx! {
            div { "data-el": "connector" }
        });
    }

    VNode::Element(Box::new(el))
}

/// One window cell: the step it reveals, or an empty cell at the flow's edges
/// (Vue keeps all three thirds fixed so the geometry never shifts).
fn timeline_window_cell(
    side: &'static str,
    index: Option<usize>,
    steps: &[TimelineStep],
    current_index: Option<usize>,
    clickable: bool,
    on_select: &Option<EventHandler<String>>,
) -> VNode {
    let mut cell = VElement::new("div")
        .class("hk-timeline-window")
        .attr("data-side", side);
    // Vue dims the NEIGHBOUR wrappers only (its current cell has no marker).
    if index.is_some() && side != "current" {
        cell = cell.attr("data-dimmed", "");
    }
    if let Some(index) = index {
        if let Some(step) = steps.get(index) {
            cell = cell.child(timeline_step_node(
                index,
                step,
                timeline_status_of(current_index, index),
                clickable,
                false,
                false,
                on_select,
            ));
        }
    }
    VNode::Element(Box::new(cell))
}

#[define_props]
pub struct TimelineProps {
    /// The steps, in flow order (required upstream; empty renders no steps).
    pub steps: Vec<TimelineStep>,

    /// Key of the current step (required upstream; `""` matches nothing).
    #[default]
    pub current_key: String,

    #[default]
    pub orientation: TimelineOrientation,

    /// Completed steps become selectable (`data-clickable`, `role="button"`).
    #[default]
    pub clickable: bool,

    #[default]
    pub collapse: TimelineCollapse,

    /// Host-reported overflow: Vue computes this from a `ResizeObserver` +
    /// offscreen `max-content` probes; the mirror takes it as a controlled
    /// prop (see the file header's state contract).
    #[default]
    pub collapsed: bool,

    /// Direction of the last step change (Vue derives it from its own index
    /// history); `None` keeps `data-dir` absent, so nothing animates.
    pub nav_dir: Option<TimelineNavDir>,

    /// Vue attribute fallthrough onto the root `<div>`.
    #[default]
    pub class: String,

    /// Fired with the step key when a completed, enabled step is activated
    /// (Vue: `select`).
    pub on_select: Option<EventHandler<String>>,
}

#[component]
pub fn Timeline(props: TimelineProps) -> Element {
    let current_index = timeline_current_index(&props.steps, &props.current_key);
    let status_of = |index: usize| timeline_status_of(current_index, index);
    let windowable = timeline_is_windowable(props.steps.len(), current_index);
    let windowed = timeline_is_windowed(windowable, props.collapse, props.collapsed);

    let mut root = VElement::new("div")
        .class(timeline_root_classes(&props.class))
        .attr("data-orientation", props.orientation.token());
    if let Some(nav_dir) = props.nav_dir {
        root = root.attr("data-dir", nav_dir.token());
    }

    if windowed {
        let state = timeline_window(&props.steps, &props.current_key);
        let segments = timeline_link_segments(&state, props.orientation);

        root = root.attr("data-mode", TimelineMode::Window.token());

        if !segments.is_empty() {
            let mut links = VElement::new("div")
                .class("hk-timeline-links")
                .attr("aria-hidden", "true");
            for segment in &segments {
                let mut link = VElement::new("div")
                    .class("hk-timeline-link")
                    .attr("data-segment", segment.segment)
                    .attr(
                        "data-status",
                        timeline_status_of(current_index, segment.index).token(),
                    );
                if let Some(fade_dir) = segment.fade_dir {
                    link = link.attr("data-fade-dir", fade_dir);
                }
                links = links.child(VNode::Element(Box::new(link)));
            }
            root = root.child(VNode::Element(Box::new(links)));
        }

        root = root.child(timeline_window_cell(
            "before",
            state.before_index,
            &props.steps,
            current_index,
            props.clickable,
            &props.on_select,
        ));
        root = root.child(timeline_window_cell(
            "current",
            current_index,
            &props.steps,
            current_index,
            props.clickable,
            &props.on_select,
        ));
        root = root.child(timeline_window_cell(
            "after",
            state.after_index,
            &props.steps,
            current_index,
            props.clickable,
            &props.on_select,
        ));
        return VNode::Element(Box::new(root));
    }

    root = root.attr("data-mode", TimelineMode::Full.token());
    for (index, step) in props.steps.iter().enumerate() {
        let last = index + 1 == props.steps.len();
        root = root.child(timeline_step_node(
            index,
            step,
            status_of(index),
            props.clickable,
            !last,
            last,
            &props.on_select,
        ));
    }
    VNode::Element(Box::new(root))
}

impl StyledComponent for TimelineComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps every
        // `.hk-timeline*` name and `data-*` hook literal).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTimeline.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "timeline"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn steps() -> Vec<TimelineStep> {
        ["Start", "Build", "Review", "Ship", "Done"]
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
    fn timeline_tokens_match_the_vue_attribute_values() {
        assert_eq!(TimelineOrientation::Horizontal.token(), "horizontal");
        assert_eq!(TimelineOrientation::Vertical.token(), "vertical");
        assert_eq!(TimelineCollapse::Auto.token(), "auto");
        assert_eq!(TimelineCollapse::Always.token(), "always");
        assert_eq!(TimelineCollapse::Never.token(), "never");
        assert_eq!(TimelineNavDir::Forward.token(), "forward");
        assert_eq!(TimelineNavDir::Back.token(), "back");
        assert_eq!(TimelineMode::Full.token(), "full");
        assert_eq!(TimelineMode::Window.token(), "window");
        assert_eq!(TimelineStepStatus::Completed.token(), "completed");
        assert_eq!(TimelineStepStatus::Active.token(), "active");
        assert_eq!(TimelineStepStatus::Pending.token(), "pending");
    }

    #[test]
    fn timeline_defaults_match_the_vue_props() {
        let props = TimelineProps::default();
        assert!(props.steps.is_empty());
        assert_eq!(props.current_key, "");
        assert_eq!(props.orientation, TimelineOrientation::Horizontal);
        assert!(!props.clickable);
        assert_eq!(props.collapse, TimelineCollapse::Auto);
        assert!(!props.collapsed);
        assert_eq!(props.nav_dir, None);
        assert_eq!(props.class, "");
        assert!(props.on_select.is_none());
    }

    #[test]
    fn timeline_status_derivation_follows_the_current_index() {
        // The current step is `active`, everything before it is `completed`,
        // everything after it is `pending` — Vue's `statusOf`.
        let current = Some(2);
        assert_eq!(
            timeline_status_of(current, 0),
            TimelineStepStatus::Completed
        );
        assert_eq!(
            timeline_status_of(current, 1),
            TimelineStepStatus::Completed
        );
        assert_eq!(timeline_status_of(current, 2), TimelineStepStatus::Active);
        assert_eq!(timeline_status_of(current, 3), TimelineStepStatus::Pending);
        // A key that matches nothing leaves every step pending (Vue's -1).
        assert_eq!(timeline_status_of(None, 0), TimelineStepStatus::Pending);
        assert_eq!(timeline_status_of(None, 7), TimelineStepStatus::Pending);
    }

    #[test]
    fn timeline_window_reveals_one_neighbour_per_side() {
        let steps = steps();
        // Middle step: both neighbours, and both sides keep hidden steps.
        let middle = timeline_window(&steps, "s2");
        assert_eq!(middle.before_index, Some(1));
        assert_eq!(middle.after_index, Some(3));
        assert!(middle.fade_before);
        assert!(middle.fade_after);

        // First step: only the next one, and its side fades (steps 2.. remain).
        let first = timeline_window(&steps, "s0");
        assert_eq!(first.before_index, None);
        assert_eq!(first.after_index, Some(1));
        assert!(!first.fade_before);
        assert!(first.fade_after);

        // Second step: the previous neighbour is the first step, so its edge
        // has nothing further to reveal (Vue: `currentIndex - 1 > 0`).
        let second = timeline_window(&steps, "s1");
        assert_eq!(second.before_index, Some(0));
        assert!(!second.fade_before);

        // Last step: only the previous one, right edge exhausted.
        let last = timeline_window(&steps, "s4");
        assert_eq!(last.before_index, Some(3));
        assert_eq!(last.after_index, None);
        assert!(!last.fade_after);

        // Unknown key: nothing to window around.
        assert_eq!(
            timeline_window(&steps, "missing"),
            TimelineWindowState::default()
        );
    }

    #[test]
    fn timeline_window_gates_match_the_vue_computeds() {
        // Fewer than four steps is its own window → never windowable.
        assert!(!timeline_is_windowable(3, Some(1)));
        assert!(!timeline_is_windowable(4, None));
        assert!(timeline_is_windowable(4, Some(0)));

        // `always` windows a windowable stepper, `never` never does, `auto`
        // follows the host-reported collapse.
        assert!(timeline_is_windowed(true, TimelineCollapse::Always, false));
        assert!(!timeline_is_windowed(true, TimelineCollapse::Never, true));
        assert!(timeline_is_windowed(true, TimelineCollapse::Auto, true));
        assert!(!timeline_is_windowed(true, TimelineCollapse::Auto, false));
        // Non-windowable steppers stay full-mode whatever the props say.
        assert!(!timeline_is_windowed(false, TimelineCollapse::Always, true));
    }

    #[test]
    fn timeline_link_segments_follow_the_neighbours_and_edges() {
        let horizontal = timeline_link_segments(
            &TimelineWindowState {
                before_index: Some(1),
                after_index: Some(3),
                fade_before: true,
                fade_after: false,
            },
            TimelineOrientation::Horizontal,
        );
        // Vue's emission order: the two bonds, then the fading continuations.
        assert_eq!(horizontal.len(), 3);
        assert_eq!(horizontal[0].segment, "before-current");
        assert_eq!(horizontal[0].index, 1);
        assert_eq!(horizontal[0].fade_dir, None);
        assert_eq!(horizontal[1].segment, "current-after");
        assert_eq!(horizontal[1].index, 3);
        // Only the left side still hides steps → one edge continuation.
        assert_eq!(horizontal[2].segment, "edge-before");
        assert_eq!(horizontal[2].fade_dir, Some("left"));

        // Vertical mode fades along the block axis instead.
        let vertical = timeline_link_segments(
            &TimelineWindowState {
                before_index: None,
                after_index: Some(1),
                fade_before: false,
                fade_after: true,
            },
            TimelineOrientation::Vertical,
        );
        assert_eq!(vertical.len(), 2);
        assert_eq!(vertical[0].segment, "current-after");
        assert_eq!(vertical[1].segment, "edge-after");
        assert_eq!(vertical[1].fade_dir, Some("down"));

        // Nothing around the current step → no overlay at all.
        assert!(
            timeline_link_segments(
                &TimelineWindowState::default(),
                TimelineOrientation::Horizontal
            )
            .is_empty()
        );
    }

    #[test]
    fn timeline_actionable_gate_matches_the_vue_click_guard() {
        // Only a completed, enabled step of a clickable stepper reacts.
        assert!(timeline_step_actionable(
            true,
            TimelineStepStatus::Completed,
            false
        ));
        assert!(!timeline_step_actionable(
            false,
            TimelineStepStatus::Completed,
            false
        ));
        assert!(!timeline_step_actionable(
            true,
            TimelineStepStatus::Completed,
            true
        ));
        assert!(!timeline_step_actionable(
            true,
            TimelineStepStatus::Active,
            false
        ));
        assert!(!timeline_step_actionable(
            true,
            TimelineStepStatus::Pending,
            false
        ));
    }

    #[test]
    fn timeline_root_classes_append_the_host_class() {
        assert_eq!(timeline_root_classes(""), "hk-timeline");
        assert_eq!(timeline_root_classes("host"), "hk-timeline host");
    }

    #[test]
    fn timeline_full_mode_renders_the_vue_dom_contract() {
        let html = Timeline(TimelineProps {
            steps: steps(),
            current_key: "s2".to_string(),
            clickable: true,
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains("hk-timeline"), "{html}");
        assert!(html.contains(r#"data-orientation="horizontal""#), "{html}");
        assert!(html.contains(r#"data-mode="full""#), "{html}");
        // Status derivation across the whole row.
        assert_eq!(count(&html, r#"data-status="completed""#), 2, "{html}");
        assert_eq!(count(&html, r#"data-status="active""#), 1, "{html}");
        assert_eq!(count(&html, r#"data-status="pending""#), 2, "{html}");
        assert!(html.contains(r#"aria-current="step""#), "{html}");
        // One connector per step but the last, one `data-last` marker.
        assert_eq!(count(&html, r#"data-el="connector""#), 4, "{html}");
        assert_eq!(count(&html, r#"data-last=""#), 1, "{html}");
        // Completed steps carry the check glyph host + the svg hook.
        assert_eq!(count(&html, r#"data-el="check""#), 2, "{html}");
        assert_eq!(count(&html, r#"data-el="num""#), 3, "{html}");
        assert_eq!(count(&html, r#"data-el="label""#), 5, "{html}");
        // Completed steps of a clickable stepper are actionable.
        assert_eq!(count(&html, r#"data-clickable="#), 2, "{html}");
        assert!(html.contains(">Start<"), "labels must render: {html}");
    }

    #[test]
    fn timeline_window_mode_renders_the_three_cell_window() {
        let html = Timeline(TimelineProps {
            steps: steps(),
            current_key: "s2".to_string(),
            collapse: TimelineCollapse::Always,
            nav_dir: Some(TimelineNavDir::Back),
            ..Default::default()
        })
        .render_to_html();

        assert!(html.contains(r#"data-mode="window""#), "{html}");
        assert!(html.contains(r#"data-dir="back""#), "{html}");
        // The bond overlay joins the three node centers.
        assert!(html.contains("hk-timeline-links"), "{html}");
        assert!(html.contains(r#"data-segment="before-current""#), "{html}");
        assert!(html.contains(r#"data-segment="current-after""#), "{html}");
        assert!(html.contains(r#"data-segment="edge-before""#), "{html}");
        assert!(html.contains(r#"data-fade-dir="left""#), "{html}");
        // Three fixed cells; the neighbours are dimmed, the current is not.
        assert!(html.contains(r#"data-side="before""#), "{html}");
        assert!(html.contains(r#"data-side="current""#), "{html}");
        assert!(html.contains(r#"data-side="after""#), "{html}");
        assert_eq!(count(&html, "hk-timeline-window"), 3, "{html}");
        assert_eq!(count(&html, r#"data-dimmed=""#), 2, "{html}");
    }

    #[test]
    fn timeline_stays_full_mode_when_the_window_cannot_apply() {
        // A three-step flow is its own window, even with `collapse: always`.
        let html = Timeline(TimelineProps {
            steps: steps()[0..3].to_vec(),
            current_key: "s1".to_string(),
            collapse: TimelineCollapse::Always,
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-mode="full""#), "{html}");

        // `auto` without a host-reported collapse stays full too.
        let html = Timeline(TimelineProps {
            steps: steps(),
            current_key: "s2".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains(r#"data-mode="full""#), "{html}");
        assert!(!html.contains("data-dir="), "no direction yet: {html}");

        // An empty stepper renders the bare root, not a panic.
        let html = Timeline(TimelineProps::default()).render_to_html();
        assert!(html.contains("hk-timeline"), "{html}");
        assert!(!html.contains("hk-timeline-step"), "{html}");
    }

    #[test]
    fn timeline_disabled_steps_are_inert_but_visible() {
        let mut steps = steps();
        steps[0].disabled = true;
        let html = Timeline(TimelineProps {
            steps,
            current_key: "s2".to_string(),
            clickable: true,
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(count(&html, r#"data-disabled=""#), 1, "{html}");
        // The disabled completed step is the only one without `data-clickable`.
        assert_eq!(count(&html, r#"data-clickable="#), 1, "{html}");
        assert!(
            html.contains(">Start<"),
            "disabled steps stay visible: {html}"
        );
    }

    #[test]
    fn timeline_styles_come_from_the_canonical_vue_sheet() {
        let css = TimelineComponent::styles();
        // Selector spelling stays quote-agnostic here: the mirrored sheet is
        // compiled by the scss macro, so only the names/hooks are asserted.
        for needle in [
            ".hk-timeline",
            ".hk-timeline-step",
            "data-el",
            "hk-timeline-link",
            "hk-timeline-window",
            "hk-timeline-wipe",
        ] {
            assert!(
                css.contains(needle),
                "timeline css must carry the vue hook {needle}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored timeline sheet"
        );
    }
}
