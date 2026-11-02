// hi-components/src/display/crossfade.rs
// Crossfade — mirror of the canonical Vue `HkCrossfade`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCrossfade.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-crossfade*` class names are literal and identical in both forms.
// DOM contract (mirrors the Vue render output):
//
//   Tag.hk-crossfade [host class]        (Vue `tag`, default `div`)
//        (style: --hk-crossfade-enter-delay:{enter_delay}ms)
//     div.hk-crossfade-item                        (the RETAINED outgoing generation)
//          data-crossfade-key={previous_key}
//          [.hk-crossfade-leave-active .hk-crossfade-leave-from|leave-to]
//          inert aria-hidden="true"
//       {previous}
//     div.hk-crossfade-item                        (the incoming generation, painted on top)
//          data-crossfade-key={swap_key}
//          [.hk-crossfade-enter-active .hk-crossfade-enter-from|enter-to]
//       {children}
//
// The two items share ONE grid cell (`grid-area: 1/1` in the sheet), so the
// generations stack at the same geometry for the dissolve: no exit blank
// phase, no side-by-side reflow, no height collapse while both are mounted.
// The outgoing item renders FIRST so the incoming one paints on top — the
// layer order the sheet's "fast-start ease keeps the incoming opacity ahead"
// argument depends on.
//
// Deltas vs Vue (documented, not accidental):
//   * tairitsu has NO transition hooks. Vue drives this component from the
//     rAF-gated `<Transition>` engine (beforeEnter/afterLeave, the 450ms
//     swap-stall watchdog, the refcounted animation-bus report); the mirror
//     turns that lifecycle into the CONTROLLED `phase` prop — the host sets
//     `Enter` when a swap arms (both generations staged at `*-from`),
//     `Entering` while the concurrent dissolve runs, `Leaving` once only the
//     outgoing generation still animates, and `Idle` when it settles.
//     [`crossfade_phase_classes`] is the COMPLETE class table,
//     [`crossfade_watchdog_budget_ms`] + [`crossfade_watchdog_should_remove`]
//     pin the recovery path (budget and sweep predicate) and
//     [`crossfade_retains_previous`] the retention rule, so a host timer
//     reproduces Vue's choreography exactly without any hook machinery.
//   * Vue owns the leaving vnode — `<Transition>` keeps the OLD rendered
//     subtree mounted until `afterLeave`. A controlled mirror cannot snapshot
//     a subtree, so the host passes the frozen outgoing generation as
//     `previous` (plus the `previous_key` stamping it) and clears both when
//     the leave settles.
//   * `appear` is retired: it only gated the MOUNT-time enter, which a
//     controlled host expresses directly by starting at `phase: Idle` (or
//     `Enter` when it wants the mount dissolve). Vue's internal watchdog flag
//     survives as the controlled `suppressed` prop the host sets after its own
//     sweep proves the swap wedged — Vue's degraded render path is then the
//     identical "no transition classes" DOM.
//   * The enter hold is declared as `--hk-crossfade-enter-delay` on the mirror's
//     OWN root, from the prop. Vue sets that property on an ANCESTOR from the
//     outside (HkTransitionContainer's host) and has to reset it to 0ms after
//     every swap so a nested crossfade inside the slot does not inherit a whole
//     stale beat; here each crossfade scopes its own hold, so that leak class of
//     bug cannot occur (an outer swap's hold still reaches this root through
//     inheritance when the host wants it).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CrossfadeComponent;

/// Vue: `CROSSFADE_WATCHDOG_MS` — the swap-stall sweep budget in ms. It sits
/// above ANY healthy completion (`--duration-normal` 0.3s, 0s under reduced
/// motion), so a sweep only ever bites a genuinely stalled swap.
pub const CROSSFADE_WATCHDOG_MS: f64 = 450.0;

const ENTER_FROM: &[&str] = &["hk-crossfade-enter-active", "hk-crossfade-enter-from"];
const ENTER_TO: &[&str] = &["hk-crossfade-enter-active", "hk-crossfade-enter-to"];
const LEAVE_FROM: &[&str] = &["hk-crossfade-leave-active", "hk-crossfade-leave-from"];
const LEAVE_TO: &[&str] = &["hk-crossfade-leave-active", "hk-crossfade-leave-to"];
const NO_CLASSES: &[&str] = &[];

/// The controlled swap state machine (Vue reads it from its `<Transition>`
/// hooks; here the host drives it).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum CrossfadePhase {
    /// Nothing in flight: the incoming generation is settled, no ghost.
    #[default]
    Idle,
    /// A swap just armed: both generations staged at their `*-from` state.
    Enter,
    /// The concurrent dissolve is running: incoming → `enter-to`,
    /// retained outgoing → `leave-to`.
    Entering,
    /// Tail of the swap: only the outgoing generation still animates.
    Leaving,
}

/// Which generation of the swap a class query is for.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum CrossfadeSlot {
    /// The generation `swap_key` identifies (Vue: the entering item).
    Incoming,
    /// The frozen generation the host retained (Vue: the leaving item).
    Leaving,
}

/// The complete phase → class table of HkCrossfade.scss (empty = settled).
pub fn crossfade_phase_classes(
    phase: CrossfadePhase,
    slot: CrossfadeSlot,
) -> &'static [&'static str] {
    match (phase, slot) {
        (CrossfadePhase::Idle, _) => NO_CLASSES,
        (CrossfadePhase::Enter, CrossfadeSlot::Incoming) => ENTER_FROM,
        (CrossfadePhase::Enter, CrossfadeSlot::Leaving) => LEAVE_FROM,
        (CrossfadePhase::Entering, CrossfadeSlot::Incoming) => ENTER_TO,
        (CrossfadePhase::Entering, CrossfadeSlot::Leaving) => LEAVE_TO,
        (CrossfadePhase::Leaving, CrossfadeSlot::Incoming) => NO_CLASSES,
        (CrossfadePhase::Leaving, CrossfadeSlot::Leaving) => LEAVE_TO,
    }
}

/// Retention rule: an outgoing generation is still on stage only while a swap
/// is in flight AND it is a DIFFERENT generation than the incoming one. A
/// flip-back (`previous_key == swap_key`) or a cleared/empty key leaves no
/// ghost behind — Vue's leave is cancelled in exactly that case.
pub fn crossfade_retains_previous(
    phase: CrossfadePhase,
    swap_key: &str,
    previous_key: Option<&str>,
) -> bool {
    if phase == CrossfadePhase::Idle {
        return false;
    }
    match previous_key {
        Some(key) => !key.is_empty() && key != swap_key,
        None => false,
    }
}

/// Vue's `disabled || suppress`: both render the item BARE (no transition
/// classes), so a wedged swap degrades to a synchronous swap instead of a
/// frozen one.
pub fn crossfade_animates(disabled: bool, suppressed: bool) -> bool {
    !disabled && !suppressed
}

/// The choreographed enter hold, clamped the way Vue's
/// `Math.max(props.enterDelay, 0)` is — a non-finite value reads as no hold.
pub fn crossfade_enter_delay_ms(enter_delay: f64) -> f64 {
    if enter_delay.is_finite() {
        enter_delay.max(0.0)
    } else {
        0.0
    }
}

/// The hold as the CSS custom property value the sheet consumes.
pub fn crossfade_enter_delay_css(enter_delay: f64) -> String {
    format!("{}ms", crossfade_enter_delay_ms(enter_delay))
}

/// Vue's per-arm watchdog budget: the base sweep window widened by the
/// choreographed enter hold, so a delayed enter never looks stalled.
pub fn crossfade_watchdog_budget_ms(enter_delay: f64) -> f64 {
    CROSSFADE_WATCHDOG_MS + crossfade_enter_delay_ms(enter_delay)
}

/// Vue's animation-bus window (`REPORT_MS` is the SAME constant as
/// `CROSSFADE_WATCHDOG_MS`, widened by the same hold).
pub fn crossfade_report_window_ms(enter_delay: f64) -> f64 {
    crossfade_watchdog_budget_ms(enter_delay)
}

/// The sweep predicate: a stale item holding a frozen leave class is one the
/// rAF-gated engine can never unmount, so the host removes it by hand and
/// degrades to synchronous rendering (Vue's `frozenLeave &&
/// el.dataset.crossfadeKey !== String(props.swapKey)`).
pub fn crossfade_watchdog_should_remove(
    frozen_leave: bool,
    item_key: &str,
    swap_key: &str,
) -> bool {
    frozen_leave && item_key != swap_key
}

/// Vue `tag` prop resolution: an empty tag is not a valid element name, so it
/// falls back to the `div` default instead of rendering a broken root.
pub fn crossfade_tag(tag: &str) -> &str {
    if tag.is_empty() { "div" } else { tag }
}

fn merged_classes(base: &str, extra: &[&str]) -> String {
    let mut out = String::from(base);
    for class in extra {
        out.push(' ');
        out.push_str(class);
    }
    out
}

#[define_props]
pub struct CrossfadeProps {
    /// Identity of the content on stage (Vue: `swapKey`, `String | number`;
    /// the mirror keeps the string form and stamps it as
    /// `data-crossfade-key`).
    pub swap_key: String,

    /// Key of the generation the host is still holding for the dissolve.
    pub previous_key: Option<String>,

    /// The frozen outgoing generation (Vue: the leaving vnode it manages).
    /// Rendered only while [`crossfade_retains_previous`] holds; an absent
    /// element renders an empty box rather than nothing, so the dissolve
    /// geometry survives a host that only kept the key.
    pub previous: Option<Element>,

    /// The controlled swap phase (see the header delta).
    #[default]
    pub phase: CrossfadePhase,

    /// Enter-side hold in ms (`--hk-crossfade-enter-delay`).
    #[default]
    pub enter_delay: f64,

    /// No dissolve at all: the swap applies synchronously (Vue `disabled`).
    #[default]
    pub disabled: bool,

    /// The host's watchdog verdict (Vue's internal `suppress`): render the
    /// active generation bare until the next swap re-arms.
    #[default]
    pub suppressed: bool,

    /// Host element tag (Vue `tag`, default `div`).
    #[default("div".to_string())]
    pub tag: String,

    /// Extra class appended after `hk-crossfade`.
    #[default]
    pub class: String,

    /// The incoming generation's content (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn Crossfade(props: CrossfadeProps) -> Element {
    let animates = crossfade_animates(props.disabled, props.suppressed);

    let mut root_classes = String::from("hk-crossfade");
    if !props.class.is_empty() {
        root_classes.push(' ');
        root_classes.push_str(&props.class);
    }

    let incoming_classes = if animates {
        merged_classes(
            "hk-crossfade-item",
            crossfade_phase_classes(props.phase, CrossfadeSlot::Incoming),
        )
    } else {
        String::from("hk-crossfade-item")
    };

    let mut root = VElement::new(crossfade_tag(&props.tag))
        .class(root_classes)
        .with_css_var(
            "--hk-crossfade-enter-delay",
            &crossfade_enter_delay_css(props.enter_delay),
        );

    // The outgoing generation renders FIRST so the incoming one paints on
    // top (the sheet's layer-order argument); it is dead content for the
    // dissolve: out of the tab order, out of the accessibility tree, and
    // `pointer-events: none` via the leave class.
    // Vue's `disabled || suppress` renders the incoming item BARE: the swap is
    // synchronous, so no outgoing generation survives.
    if animates
        && crossfade_retains_previous(props.phase, &props.swap_key, props.previous_key.as_deref())
    {
        let previous_key = props.previous_key.clone().unwrap_or_default();
        let ghost_classes = if animates {
            merged_classes(
                "hk-crossfade-item",
                crossfade_phase_classes(props.phase, CrossfadeSlot::Leaving),
            )
        } else {
            String::from("hk-crossfade-item")
        };
        let ghost = VElement::new("div")
            .class(ghost_classes)
            .attr("data-crossfade-key", previous_key.clone())
            .attr("inert", "")
            .attr("aria-hidden", "true")
            .key(&format!("{previous_key}:leave"))
            .child(props.previous.clone().unwrap_or_else(empty_vnode));
        root = root.child(VNode::Element(Box::new(ghost)));
    }

    let incoming = VElement::new("div")
        .class(incoming_classes)
        .attr("data-crossfade-key", props.swap_key.clone())
        .key(&props.swap_key)
        .child(props.children.clone());

    VNode::Element(Box::new(root.child(VNode::Element(Box::new(incoming)))))
}

impl StyledComponent for CrossfadeComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCrossfade.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "crossfade"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn classes_for(phase: CrossfadePhase, slot: CrossfadeSlot) -> Vec<&'static str> {
        crossfade_phase_classes(phase, slot).to_vec()
    }

    #[test]
    fn crossfade_defaults_match_the_vue_props() {
        let props = CrossfadeProps::default();
        assert_eq!(props.swap_key, "");
        assert!(props.previous_key.is_none());
        assert!(props.previous.is_none());
        assert_eq!(props.phase, CrossfadePhase::Idle);
        assert_eq!(props.enter_delay, 0.0);
        assert!(!props.disabled);
        assert!(!props.suppressed);
        assert_eq!(props.tag, "div");
        assert_eq!(props.class, "");
    }

    #[test]
    fn crossfade_phase_classes_are_the_complete_vue_table() {
        // Idle settles everything: no class on either slot.
        assert!(classes_for(CrossfadePhase::Idle, CrossfadeSlot::Incoming).is_empty());
        assert!(classes_for(CrossfadePhase::Idle, CrossfadeSlot::Leaving).is_empty());
        // Enter = the pre-frame of both sides.
        assert_eq!(
            classes_for(CrossfadePhase::Enter, CrossfadeSlot::Incoming),
            vec!["hk-crossfade-enter-active", "hk-crossfade-enter-from"]
        );
        assert_eq!(
            classes_for(CrossfadePhase::Enter, CrossfadeSlot::Leaving),
            vec!["hk-crossfade-leave-active", "hk-crossfade-leave-from"]
        );
        // Entering = the concurrent dissolve.
        assert_eq!(
            classes_for(CrossfadePhase::Entering, CrossfadeSlot::Incoming),
            vec!["hk-crossfade-enter-active", "hk-crossfade-enter-to"]
        );
        assert_eq!(
            classes_for(CrossfadePhase::Entering, CrossfadeSlot::Leaving),
            vec!["hk-crossfade-leave-active", "hk-crossfade-leave-to"]
        );
        // Leaving = only the outgoing generation still animates.
        assert!(classes_for(CrossfadePhase::Leaving, CrossfadeSlot::Incoming).is_empty());
        assert_eq!(
            classes_for(CrossfadePhase::Leaving, CrossfadeSlot::Leaving),
            vec!["hk-crossfade-leave-active", "hk-crossfade-leave-to"]
        );
    }

    #[test]
    fn crossfade_retention_drops_idle_empty_same_and_keeps_real_swaps() {
        // Idle: settled, no ghost even with a stale key pair.
        assert!(!crossfade_retains_previous(
            CrossfadePhase::Idle,
            "b",
            Some("a")
        ));
        // In flight with a different generation: retained.
        assert!(crossfade_retains_previous(
            CrossfadePhase::Entering,
            "b",
            Some("a")
        ));
        assert!(crossfade_retains_previous(
            CrossfadePhase::Leaving,
            "b",
            Some("a")
        ));
        // Flip-back / re-render with the same key: nothing to dissolve.
        assert!(!crossfade_retains_previous(
            CrossfadePhase::Entering,
            "a",
            Some("a")
        ));
        // No (or empty) previous key: no ghost either.
        assert!(!crossfade_retains_previous(
            CrossfadePhase::Entering,
            "a",
            None
        ));
        assert!(!crossfade_retains_previous(
            CrossfadePhase::Entering,
            "a",
            Some("")
        ));
    }

    #[test]
    fn crossfade_watchdog_budget_and_report_window_track_the_enter_hold() {
        assert_eq!(crossfade_watchdog_budget_ms(0.0), 450.0);
        assert_eq!(crossfade_watchdog_budget_ms(300.0), 750.0);
        // REPORT_MS is the SAME constant as the watchdog, widened the same way.
        assert_eq!(crossfade_report_window_ms(300.0), 750.0);
        // The clamped-enters cannot shrink a budget.
        assert_eq!(crossfade_watchdog_budget_ms(-50.0), 450.0);
        assert_eq!(crossfade_watchdog_budget_ms(f64::NAN), 450.0);
        assert_eq!(crossfade_enter_delay_ms(f64::INFINITY), 0.0);
        assert_eq!(crossfade_enter_delay_css(300.0), "300ms");
    }

    #[test]
    fn crossfade_watchdog_only_removes_frozen_stale_items() {
        // Frozen leave class + a key that is no longer active → sweeps.
        assert!(crossfade_watchdog_should_remove(true, "a", "b"));
        // The active generation is never removed, even while it dissolves.
        assert!(!crossfade_watchdog_should_remove(true, "b", "b"));
        // A healthy item (no frozen class) is left alone.
        assert!(!crossfade_watchdog_should_remove(false, "a", "b"));
    }

    #[test]
    fn crossfade_disabled_and_suppressed_emit_no_transition_classes() {
        assert!(crossfade_animates(false, false));
        assert!(!crossfade_animates(true, false));
        assert!(!crossfade_animates(false, true));
        assert_eq!(crossfade_tag(""), "div");
        assert_eq!(crossfade_tag("section"), "section");
    }

    #[test]
    fn crossfade_renders_the_stacked_generations_and_the_delay_property() {
        let html = Crossfade(CrossfadeProps {
            swap_key: "incoming".to_string(),
            previous_key: Some("outgoing".to_string()),
            previous: Some(rsx! {
                span { class: "old", "old" }
            }),
            phase: CrossfadePhase::Entering,
            enter_delay: 300.0,
            children: rsx! {
                span { class: "new", "new" }
            },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "hk-crossfade",
            "--hk-crossfade-enter-delay:300ms",
            "hk-crossfade-enter-active",
            "hk-crossfade-enter-to",
            "hk-crossfade-leave-active",
            "hk-crossfade-leave-to",
            "data-crossfade-key=\"incoming\"",
            "data-crossfade-key=\"outgoing\"",
            "inert=\"\"",
            "aria-hidden=\"true\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The ghost renders BEFORE the incoming generation (paint order).
        let ghost_at = html.find("outgoing").expect("ghost key");
        let incoming_at = html.find("incoming").expect("incoming key");
        assert!(ghost_at < incoming_at, "ghost must paint under: {html}");
    }

    #[test]
    fn crossfade_ghost_survives_a_key_only_retention() {
        // A host that kept ONLY the outgoing key still gets the ghost box: the
        // dissolve geometry (one shared grid cell) must not collapse just
        // because the frozen content is gone.
        let html = Crossfade(CrossfadeProps {
            swap_key: "b".to_string(),
            previous_key: Some("a".to_string()),
            phase: CrossfadePhase::Leaving,
            children: rsx! {
                span { "content" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("data-crossfade-key=\"a\""), "{html}");
        assert!(html.contains("hk-crossfade-leave-active"), "{html}");
        // The settled phase drops even a retained key (no stale ghost).
        let settled = Crossfade(CrossfadeProps {
            swap_key: "b".to_string(),
            previous_key: Some("a".to_string()),
            phase: CrossfadePhase::Idle,
            children: rsx! {
                span { "content" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(!settled.contains("data-crossfade-key=\"a\""), "{settled}");
    }

    #[test]
    fn crossfade_settled_and_disabled_render_without_ghost_or_classes() {
        let settled = Crossfade(CrossfadeProps {
            swap_key: "only".to_string(),
            children: rsx! {
                span { "content" }
            },
            ..Default::default()
        })
        .render_to_html();
        assert!(settled.contains("hk-crossfade-item"), "{settled}");
        // The inline `--hk-crossfade-enter-delay` property contains the
        // substring, so the check targets the transition CLASS names.
        assert!(!settled.contains("hk-crossfade-enter-active"), "{settled}");
        assert!(!settled.contains("hk-crossfade-enter-from"), "{settled}");
        assert!(!settled.contains("hk-crossfade-leave-active"), "{settled}");
        assert!(!settled.contains("inert"), "{settled}");

        let disabled = Crossfade(CrossfadeProps {
            swap_key: "b".to_string(),
            previous_key: Some("a".to_string()),
            phase: CrossfadePhase::Entering,
            disabled: true,
            children: rsx! {
                span { "content" }
            },
            ..Default::default()
        })
        .render_to_html();
        // Absence of the transition CLASSES (the inline property name contains
        // the substring too).
        assert!(
            !disabled.contains("hk-crossfade-enter-active"),
            "{disabled}"
        );
        assert!(
            !disabled.contains("hk-crossfade-leave-active"),
            "{disabled}"
        );
        // Disabled still keeps the previous generation? No: the ghost only
        // exists while a transition can play.
        assert!(!disabled.contains("inert"), "{disabled}");
    }

    #[test]
    fn crossfade_styles_come_from_the_canonical_vue_sheet() {
        let css = CrossfadeComponent::styles();
        assert!(
            css.contains(".hk-crossfade")
                && css.contains(".hk-crossfade-enter-active")
                && css.contains("--hk-crossfade-enter-delay"),
            "crossfade css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored crossfade sheet"
        );
    }
}
