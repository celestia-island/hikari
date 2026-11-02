// hi-components/src/display/transition_container.rs
// TransitionContainer — mirror of the canonical Vue `HkTransitionContainer`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTransitionContainer.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-tc*` class
// names are literal and identical in both forms. DOM contract:
//
//   Tag.hk-tc [host class]
//        (style: transition-property:{axis}; transition-duration:{motion}ms;
//                width:{w}px; height:{h}px;          ← only while a pin is set
//                --hk-crossfade-enter-delay:{delay}ms;)
//     div.hk-tc-stage
//       {Crossfade}                        ← the mirrored HkCrossfade stage
//
// The stage IS HkCrossfade (Vue nests the same component): the crossfade owns
// the opacity dissolve and the swap-stall watchdog, this component owns the
// measured size morph around it and the enter-sequencing decision. `hk-tc` is
// `overflow: clip`, so the pinned inline size clips during the morph only.
//
// Deltas vs Vue (documented, not accidental):
//   * tairitsu has NO DOM lifecycle hooks: Vue runs a ResizeObserver on the
//     stage, pins the outgoing size in `watch(swapKey)`, measures the entering
//     generation post-flush and schedules a settle timer. The mirror turns that
//     machinery into CONTROLLED props — the host reports its measurement as
//     `pinned_width`/`pinned_height` (and clears them when the morph settles),
//     forwards its own reduced-motion/animation-switch facts as
//     `reduced_motion`/`animations_off`, and drives the stage through
//     `phase`. The pure decisions are pinned so the host reproduces Vue
//     exactly: [`transition_container_resolve_enter_delay`] (the choreography
//     decision), [`transition_container_pin_size`] (which axis is pinned),
//     [`transition_container_motion_duration`] (the reduced-motion gate that
//     CSS cannot apply to an inline duration), and
//     [`transition_container_settle_delay_ms`] (the settle timer's remaining
//     wait, 40ms slop included).
//   * Vue emits a `swap` event when the settle timer fires
//     (`{ key, previous, durationMs }`) so the host can hand the swap to its
//     scroller's public `scrollTo`. With no timers there is no emission; the
//     payload is [`TransitionContainerSwap`], built by
//     [`transition_container_swap_payload`], and the host's own settle is the
//     trigger.
//   * `enterDelay` travels exactly as in Vue: the CSS custom property
//     `--hk-crossfade-enter-delay` on THIS host (an ancestor of the stage, so
//     the inner enter rule reads it), while the inner Crossfade's own
//     `enter_delay` widens its watchdog/report budgets. Vue passes the
//     worst-case `motionDuration()` there because its var is set later, by the
//     measuring pass; a controlled host already knows the resolved hold, so the
//     mirror forwards that value. The inner crossfade re-declares the same
//     value on its own root (see its header), so the inherited property and the
//     prop can never disagree.

use crate::display::crossfade::{
    Crossfade, CrossfadePhase, CrossfadeProps, crossfade_enter_delay_css, crossfade_enter_delay_ms,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TransitionContainerComponent;

/// Size delta below which a swap reads as "same box" — sub-pixel measurement
/// noise must not buy a sequencing beat (Vue: `SIZE_EPSILON_PX`).
pub const TRANSITION_CONTAINER_SIZE_EPSILON_PX: f64 = 1.0;

/// Family default morph + dissolve duration, ms (`--duration-normal`).
pub const TRANSITION_CONTAINER_DEFAULT_DURATION_MS: f64 = 300.0;

/// Settle-timer slop after the choreography's true end, ms (Vue: `+ 40`).
pub const TRANSITION_CONTAINER_SETTLE_SLOP_MS: f64 = 40.0;

/// Which axes morph (Vue `axis`, default `height`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum MorphAxis {
    /// Most swap surfaces (the box grows/shrinks vertically).
    #[default]
    Height,
    /// Horizontal morphs (segmented panels).
    Width,
    /// Free-floating cards.
    Both,
}

impl MorphAxis {
    /// The inline `transition-property` value Vue computes.
    pub fn transition_property(self) -> &'static str {
        match self {
            MorphAxis::Height => "height",
            MorphAxis::Width => "width",
            MorphAxis::Both => "width, height",
        }
    }
}

/// Vue's `swap` event payload, forwarded to the host's scroll container.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TransitionContainerSwap {
    /// The key now on stage.
    pub key: String,
    /// The key just left (Vue's audit fix: the PREVIOUS key, not the mounted
    /// one).
    pub previous: String,
    /// The whole choreography length (delayed enter included).
    pub duration_ms: f64,
}

/// The pure swap-choreography decision (Vue: `resolveEnterDelay`): the ENTER
/// side is held back one dissolve beat whenever the incoming content needs a
/// different box than the outgoing one. A null measurement (no layout: every
/// rect reads zero) reads as "same box", so the choreography degrades to the
/// plain dissolve, never to a broken one.
pub fn transition_container_resolve_enter_delay(
    outgoing: (f64, f64),
    incoming: Option<(f64, f64)>,
    duration_ms: f64,
) -> f64 {
    let Some(incoming) = incoming else {
        return 0.0;
    };
    if duration_ms <= 0.0 || duration_ms.is_nan() {
        return 0.0;
    }
    let changed = (incoming.1 - outgoing.1).abs() > TRANSITION_CONTAINER_SIZE_EPSILON_PX
        || (incoming.0 - outgoing.0).abs() > TRANSITION_CONTAINER_SIZE_EPSILON_PX;
    if changed { duration_ms } else { 0.0 }
}

/// The inline `transition-property` for an axis.
pub fn transition_container_transition_property(axis: MorphAxis) -> &'static str {
    axis.transition_property()
}

/// Vue's `motionDuration()`: the morph runs on an INLINE `transitionDuration`,
/// which no stylesheet media query can override, so the reduced-motion gate
/// lives in the component (OS preference or the host's
/// `html[data-css-animations="0"]` switch → 0ms).
pub fn transition_container_motion_duration(
    duration: f64,
    reduced_motion: bool,
    animations_off: bool,
) -> f64 {
    if reduced_motion || animations_off || !duration.is_finite() {
        0.0
    } else {
        duration.max(0.0)
    }
}

/// Which inline size the host pins. Vue applies the single pinned box per
/// axis (`width` unless `axis === "height"`, `height` unless `axis ===
/// "width"`); the mirror takes the two axes separately so a host can pin one,
/// the other, or both. Returns `(width_px, height_px)`.
pub fn transition_container_pin_size(
    axis: MorphAxis,
    width: Option<f64>,
    height: Option<f64>,
) -> (Option<f64>, Option<f64>) {
    match axis {
        MorphAxis::Height => (None, height),
        MorphAxis::Width => (width, None),
        MorphAxis::Both => (width, height),
    }
}

/// The reported choreography length: the morph plus the delayed enter
/// (Vue: `choreoMs = delay + motionDuration()`).
pub fn transition_container_choreo_ms(enter_delay: f64, motion_duration: f64) -> f64 {
    crossfade_enter_delay_ms(enter_delay) + motion_duration.max(0.0)
}

/// The settle timer's remaining wait, measured from NOW so an observer event
/// that lands mid-swap still waits the right remainder (Vue:
/// `Math.max(choreoEndsAt - performance.now(), 0) + 40`).
pub fn transition_container_settle_delay_ms(choreo_ends_at: f64, now: f64) -> f64 {
    (choreo_ends_at - now).max(0.0) + TRANSITION_CONTAINER_SETTLE_SLOP_MS
}

/// The `swap` event payload for one settled swap.
pub fn transition_container_swap_payload(
    swap_key: &str,
    previous_key: &str,
    enter_delay: f64,
    motion_duration: f64,
) -> TransitionContainerSwap {
    TransitionContainerSwap {
        key: swap_key.to_string(),
        previous: previous_key.to_string(),
        duration_ms: transition_container_choreo_ms(enter_delay, motion_duration),
    }
}

/// Vue `tag` prop resolution: an empty tag falls back to the `div` default.
pub fn transition_container_tag(tag: &str) -> &str {
    if tag.is_empty() { "div" } else { tag }
}

#[define_props]
pub struct TransitionContainerProps {
    /// Identity of the content on stage; changing it starts the morph.
    pub swap_key: String,

    /// The generation still dissolving out (forwarded to the stage).
    pub previous_key: Option<String>,

    /// The frozen outgoing content (forwarded to the stage).
    pub previous: Option<Element>,

    /// The controlled swap phase of the inner crossfade.
    #[default]
    pub phase: CrossfadePhase,

    /// Which axes morph (Vue `axis`).
    #[default]
    pub axis: MorphAxis,

    /// Morph + dissolve duration, ms (Vue `duration`).
    #[default(300.0)]
    pub duration: f64,

    /// The RESOLVED enter hold for this swap (the value
    /// [`transition_container_resolve_enter_delay`] returned); it is applied as
    /// `--hk-crossfade-enter-delay` and reported in the swap payload.
    #[default]
    pub enter_delay: f64,

    /// Pinned inline width while a morph is in flight (Vue: the measured
    /// `{ w }`).
    pub pinned_width: Option<f64>,

    /// Pinned inline height while a morph is in flight.
    pub pinned_height: Option<f64>,

    /// The OS's `prefers-reduced-motion: reduce` fact (the mirror cannot read
    /// it).
    #[default]
    pub reduced_motion: bool,

    /// The host's global animation switch (`html[data-css-animations="0"]`).
    #[default]
    pub animations_off: bool,

    /// Host element tag (Vue `tag`, default `div`).
    #[default("div".to_string())]
    pub tag: String,

    /// Extra class appended to `hk-tc`.
    #[default]
    pub class: String,

    /// The content on stage (Vue: the default slot, rendered through the
    /// stage's crossfade).
    pub children: Element,
}

#[component]
pub fn TransitionContainer(props: TransitionContainerProps) -> Element {
    let motion = transition_container_motion_duration(
        props.duration,
        props.reduced_motion,
        props.animations_off,
    );
    let (pin_width, pin_height) =
        transition_container_pin_size(props.axis, props.pinned_width, props.pinned_height);

    let mut style = Style::new()
        .add(
            "transition-property",
            transition_container_transition_property(props.axis),
        )
        .add("transition-duration", &format!("{motion}ms"));
    if let Some(width) = pin_width {
        style = style.add("width", &format!("{width}px"));
    }
    if let Some(height) = pin_height {
        style = style.add("height", &format!("{height}px"));
    }
    style = style.add_custom(
        "--hk-crossfade-enter-delay",
        &crossfade_enter_delay_css(props.enter_delay),
    );

    let stage = Crossfade(CrossfadeProps {
        swap_key: props.swap_key.clone(),
        previous_key: props.previous_key.clone(),
        previous: props.previous.clone(),
        phase: props.phase,
        enter_delay: props.enter_delay,
        children: props.children.clone(),
        ..Default::default()
    });

    let mut host_classes = String::from("hk-tc");
    if !props.class.is_empty() {
        host_classes.push(' ');
        host_classes.push_str(&props.class);
    }

    let host = VElement::new(transition_container_tag(&props.tag))
        .class(host_classes)
        .style(style)
        .child(VNode::Element(Box::new(
            VElement::new("div").class("hk-tc-stage").child(stage),
        )));

    VNode::Element(Box::new(host))
}

impl StyledComponent for TransitionContainerComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTransitionContainer.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "transition-container"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transition_container_defaults_match_the_vue_props() {
        let props = TransitionContainerProps::default();
        assert_eq!(props.swap_key, "");
        assert!(props.previous_key.is_none());
        assert!(props.previous.is_none());
        assert_eq!(props.phase, CrossfadePhase::Idle);
        assert_eq!(props.axis, MorphAxis::Height);
        assert_eq!(props.duration, 300.0);
        assert_eq!(props.enter_delay, 0.0);
        assert!(props.pinned_width.is_none());
        assert!(props.pinned_height.is_none());
        assert!(!props.reduced_motion);
        assert!(!props.animations_off);
        assert_eq!(props.tag, "div");
        assert_eq!(props.class, "");
    }

    #[test]
    fn transition_container_holds_the_enter_only_for_a_changed_box() {
        let outgoing = (320.0, 120.0);
        // No measurement (no layout) → no beat: the plain dissolve.
        assert_eq!(
            transition_container_resolve_enter_delay(outgoing, None, 300.0),
            0.0
        );
        // Same box → no beat.
        assert_eq!(
            transition_container_resolve_enter_delay(outgoing, Some((320.0, 120.0)), 300.0),
            0.0
        );
        // Sub-pixel noise is "same box" (the epsilon is a strict >).
        assert_eq!(
            transition_container_resolve_enter_delay(outgoing, Some((321.0, 120.9)), 300.0),
            0.0
        );
        // Height change → hold one dissolve beat.
        assert_eq!(
            transition_container_resolve_enter_delay(outgoing, Some((320.0, 240.0)), 300.0),
            300.0
        );
        // Width change alone also counts (horizontal morphs).
        assert_eq!(
            transition_container_resolve_enter_delay(outgoing, Some((540.0, 120.0)), 300.0),
            300.0
        );
        // A zero/negative duration can never produce a hold.
        assert_eq!(
            transition_container_resolve_enter_delay(outgoing, Some((900.0, 900.0)), 0.0),
            0.0
        );
        assert_eq!(
            transition_container_resolve_enter_delay(outgoing, Some((900.0, 900.0)), -5.0),
            0.0
        );
    }

    #[test]
    fn transition_container_pins_only_the_morphing_axes() {
        assert_eq!(
            transition_container_pin_size(MorphAxis::Height, Some(10.0), Some(20.0)),
            (None, Some(20.0))
        );
        assert_eq!(
            transition_container_pin_size(MorphAxis::Width, Some(10.0), Some(20.0)),
            (Some(10.0), None)
        );
        assert_eq!(
            transition_container_pin_size(MorphAxis::Both, Some(10.0), Some(20.0)),
            (Some(10.0), Some(20.0))
        );
        // Settled (no pin): both axes release to auto.
        assert_eq!(
            transition_container_pin_size(MorphAxis::Both, None, None),
            (None, None)
        );
        assert_eq!(
            transition_container_transition_property(MorphAxis::Height),
            "height"
        );
        assert_eq!(
            transition_container_transition_property(MorphAxis::Width),
            "width"
        );
        assert_eq!(
            transition_container_transition_property(MorphAxis::Both),
            "width, height"
        );
    }

    #[test]
    fn transition_container_motion_duration_zeroes_under_reduced_motion() {
        assert_eq!(
            transition_container_motion_duration(300.0, false, false),
            300.0
        );
        assert_eq!(
            transition_container_motion_duration(300.0, true, false),
            0.0
        );
        assert_eq!(
            transition_container_motion_duration(300.0, false, true),
            0.0
        );
        assert_eq!(
            transition_container_motion_duration(-1.0, false, false),
            0.0
        );
        assert_eq!(
            transition_container_motion_duration(f64::NAN, false, false),
            0.0
        );
    }

    #[test]
    fn transition_container_choreography_length_and_settle_slop() {
        // Untouched: exactly the morph duration.
        assert_eq!(transition_container_choreo_ms(0.0, 300.0), 300.0);
        // A delayed enter runs one beat longer.
        assert_eq!(transition_container_choreo_ms(300.0, 300.0), 600.0);
        // Negative holds cannot shorten the choreography.
        assert_eq!(transition_container_choreo_ms(-50.0, 300.0), 300.0);
        // The settle waits out the remaining choreography plus the 40ms slop.
        assert_eq!(transition_container_settle_delay_ms(1000.0, 1000.0), 40.0);
        assert_eq!(transition_container_settle_delay_ms(1000.0, 700.0), 340.0);
        // An observer event that lands AFTER the end settles on the slop only.
        assert_eq!(transition_container_settle_delay_ms(1000.0, 1500.0), 40.0);
        // The payload carries the whole choreography, and the key just LEFT.
        let payload = transition_container_swap_payload("next", "previous", 300.0, 300.0);
        assert_eq!(payload.key, "next");
        assert_eq!(payload.previous, "previous");
        assert_eq!(payload.duration_ms, 600.0);
        assert_eq!(transition_container_tag(""), "div");
        assert_eq!(transition_container_tag("section"), "section");
    }

    #[test]
    fn transition_container_renders_the_stage_and_the_morph_style() {
        let html = TransitionContainer(TransitionContainerProps {
            swap_key: "next".to_string(),
            axis: MorphAxis::Both,
            duration: 300.0,
            enter_delay: 300.0,
            pinned_width: Some(200.0),
            pinned_height: Some(80.0),
            children: rsx! {
                span { "content" }
            },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "hk-tc",
            "hk-tc-stage",
            "hk-crossfade",
            "data-crossfade-key=\"next\"",
            "transition-property:width, height",
            "transition-duration:300ms",
            "width:200px",
            "height:80px",
            "--hk-crossfade-enter-delay:300ms",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    #[test]
    fn transition_container_reduced_motion_renders_a_zero_duration() {
        let html = TransitionContainer(TransitionContainerProps {
            swap_key: "only".to_string(),
            duration: 300.0,
            reduced_motion: true,
            pinned_height: Some(40.0),
            children: rsx! {
                span { "content" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("transition-duration:0ms"), "{html}");
        // Height-axis pin only: no width in the style at all.
        assert!(html.contains("height:40px"), "{html}");
        assert!(!html.contains("width:"), "{html}");
    }

    #[test]
    fn transition_container_styles_come_from_the_canonical_vue_sheet() {
        let css = TransitionContainerComponent::styles();
        assert!(
            css.contains(".hk-tc") && css.contains(".hk-tc-stage"),
            "transition container css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored transition container sheet"
        );
    }
}
