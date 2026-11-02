// hi-components/src/display/infinite_tail.rs
// InfiniteTail — mirror of the canonical Vue `HkInfiniteTail`: the DOM half of
// the infinite-list scaffold, mounted directly after the list body (inside
// whatever scroll viewport the host already uses; it never creates one).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkInfiniteTail.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-infinite-tail-*` class names are literal and identical in both forms.
// DOM contract — the affordance is chosen by [`infinite_tail_affordance`]
// (state × mode), exactly Vue's four render branches:
//
//   EndNote  (state = end, both modes)
//   LoadMore (auto = false, state = idle | loading)
//     the mirrored `LoadMore` component's DOM, byte-identical to Vue's
//     `HkLoadMore` (Vue renders `<HkLoadMore state shown total/>`; the manual
//     idle branch adds `onLoadMore`):
//       div.hk-load-more[data-state="end"|"idle"|"loading"]
//         span.hk-load-more-rule[aria-hidden=true]
//         span.hk-load-more-core
//           span.hk-load-more-end[role=status] "{end note}"    (end)
//           Button{ghost/sm} "{load more|loading}"             (idle/loading)
//           span.hk-load-more-count?                           ("shown / total")
//         span.hk-load-more-rule.hk-load-more-rule-end[aria-hidden=true]
//
//   Skeletons (auto = true, state = loading)
//     div.hk-infinite-tail-loading[role=status][aria-live=polite]
//       div.hk-skeleton-list[aria-hidden=true]              (style: gap:8px)
//         Skeleton atom  div.hk-skeleton[data-tone=primary][data-animated]  × count
//
//   Sentinel (auto = true, state = idle)
//     div.hk-infinite-tail-sentinel[aria-hidden=true][data-label?][data-lookahead]
//
// The tail's own contribution is the STATE MACHINE, not the chrome: Vue
// delegates the end note / button to `HkLoadMore` and the placeholder rows to
// `HkSkeletonList`, and the mirror composes the display wave's `LoadMore` and
// `Skeleton` mirrors the same way. Only the `HkSkeletonList` WRAPPER is
// rendered here — that component has no Rust mirror, and it is three lines of
// container around the mirrored atom.
//
// Deltas vs Vue (documented, not accidental):
//   * tairitsu has NO DOM lifecycle hooks. Vue owns an IntersectionObserver on
//     the sentinel, a rAF geometry re-check on every transition INTO idle (the
//     "page landed but the tail is still on screen" auto-fill case) and emits
//     `loadMore` from those callbacks. The mirror observes nothing and emits
//     nothing on its own: the host runs its own observer and asks the pure
//     predicates — [`infinite_tail_sentinel_in_view`] (the tail-bottom
//     threshold, lookahead included), [`infinite_tail_root_margin`] (the
//     `rootMargin` string) and [`infinite_tail_should_load`] (Vue's
//     `maybeLoad` guard, i.e. the "no auto-retry after a failed page" rule).
//     [`infinite_tail_state`] is the EXACT derivation Vue documents
//     (`exhausted → end`, else any in-flight flag → loading, else idle), so a
//     host composing its page machine cannot drift from the tail's branches.
//     `on_load_more` fires only from the manual button's click, like Vue's
//     `HkLoadMore` emit.
//   * `lookahead` has no observer to feed here, so the sentinel carries it as
//     the mirror-only diagnostic attribute `data-lookahead` (next to Vue's
//     `data-label`); both are inert for styling and let a host/DOM test read
//     the threshold it must observe with.
//   * The three strings ("Load more" / "Loading…" / "You've reached the end")
//     live in the `LoadMore` mirror under the family `components.hk.loadMore.*`
//     i18n keys — one home, exactly like Vue's shared `useI18n` call. The tail
//     adds no string of its own (the sentinel is invisible geometry and the
//     skeleton rows are `aria-hidden`).

use crate::display::load_more::{LoadMore, LoadMoreProps, LoadMoreState};
use crate::display::skeleton::{Skeleton, SkeletonProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct InfiniteTailComponent;

/// Vue's `state` prop: the three tail states (`idle` — more available,
/// `loading` — a page is in flight, `end` — exhausted).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum InfiniteTailState {
    #[default]
    Idle,
    Loading,
    End,
}

impl InfiniteTailState {
    /// The `data-state` value the tail's chrome carries (Vue's `state` values,
    /// which `HkLoadMore` re-emits verbatim).
    pub fn attr(self) -> &'static str {
        match self {
            InfiniteTailState::Idle => "idle",
            InfiniteTailState::Loading => "loading",
            InfiniteTailState::End => "end",
        }
    }
}

/// Which affordance the tail renders (Vue: the four branches of its render
/// function).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum InfiniteTailAffordance {
    /// The invisible zero-visibility geometry probe (auto + idle).
    Sentinel,
    /// The animated skeleton placeholder rows (auto + loading).
    Skeletons,
    /// The explicit load-more button (manual mode, idle or loading).
    LoadMore,
    /// The muted end note, both modes (state = end).
    EndNote,
}

/// The state derivation the Vue file says to "bind EXACTLY": `exhausted →
/// end`, else any in-flight flag → `loading`, else `idle`. A first-page load
/// must read as `loading` too, or a short first page never auto-fills.
pub fn infinite_tail_state(
    exhausted: bool,
    loading: bool,
    loading_more: bool,
) -> InfiniteTailState {
    if exhausted {
        InfiniteTailState::End
    } else if loading || loading_more {
        InfiniteTailState::Loading
    } else {
        InfiniteTailState::Idle
    }
}

/// The state × mode → affordance matrix.
pub fn infinite_tail_affordance(state: InfiniteTailState, auto: bool) -> InfiniteTailAffordance {
    match state {
        InfiniteTailState::End => InfiniteTailAffordance::EndNote,
        InfiniteTailState::Loading if auto => InfiniteTailAffordance::Skeletons,
        InfiniteTailState::Loading => InfiniteTailAffordance::LoadMore,
        InfiniteTailState::Idle if auto => InfiniteTailAffordance::Sentinel,
        InfiniteTailState::Idle => InfiniteTailAffordance::LoadMore,
    }
}

/// The bridge into the `LoadMore` mirror's state vocabulary (Vue passes its own
/// `state` straight through to `HkLoadMore`; the two Rust mirrors keep their
/// own enums, so this is the one place that maps them).
pub fn infinite_tail_load_more_state(state: InfiniteTailState) -> LoadMoreState {
    match state {
        InfiniteTailState::Idle => LoadMoreState::Idle,
        InfiniteTailState::Loading => LoadMoreState::Loading,
        InfiniteTailState::End => LoadMoreState::End,
    }
}

/// The lookahead, normalized: a negative runway would invert the trigger zone,
/// and a non-finite one has no meaning, so both read as 0.
pub fn infinite_tail_lookahead_px(lookahead: f64) -> f64 {
    if lookahead.is_finite() {
        lookahead.max(0.0)
    } else {
        0.0
    }
}

/// The observer's `rootMargin` for a lookahead (Vue: `${lookahead}px 0px
/// ${lookahead}px 0px` — the zone extends above AND below the viewport, so a
/// fast upward fling back into the zone counts too).
pub fn infinite_tail_root_margin(lookahead: f64) -> String {
    let px = infinite_tail_lookahead_px(lookahead);
    format!("{px}px 0px {px}px 0px")
}

/// The tail-bottom threshold: is the sentinel's rect inside the lookahead
/// zone? A zero-area rect has nothing to intersect (Vue's
/// `height === 0 && width === 0` early-out), and the zone is
/// `rect.top <= viewport + lookahead && rect.bottom >= -lookahead`.
pub fn infinite_tail_sentinel_in_view(
    rect_top: f64,
    rect_bottom: f64,
    rect_width: f64,
    rect_height: f64,
    viewport_height: f64,
    lookahead: f64,
) -> bool {
    if rect_width <= 0.0 && rect_height <= 0.0 {
        return false;
    }
    let lookahead = infinite_tail_lookahead_px(lookahead);
    rect_top <= viewport_height + lookahead && rect_bottom >= -lookahead
}

/// Vue's `maybeLoad` guard: only an `idle` tail that is in view may ask for the
/// next page. A failed page terminalizes the machine's walk, so the tail keeps
/// re-emitting into a no-op until the host reloads — auto-retry from the tail
/// is deliberately unsupported.
pub fn infinite_tail_should_load(state: InfiniteTailState, in_view: bool) -> bool {
    state == InfiniteTailState::Idle && in_view
}

fn node(element: VElement) -> VNode {
    VNode::Element(Box::new(element))
}

/// The animated skeleton tail: `HkSkeletonList`'s DOM (container + the
/// mirrored `Skeleton` atom per row). Vue passes `count` and `itemHeight`; the
/// gap and the full-width rows are that list's own defaults.
fn skeleton_tail(count: u32, item_height: &str) -> VNode {
    let rows: Vec<VNode> = (0..count)
        .map(|_| {
            Skeleton(SkeletonProps {
                height: item_height.to_string(),
                ..Default::default()
            })
        })
        .collect();
    let list = VElement::new("div")
        .class("hk-skeleton-list")
        .attr("aria-hidden", "true")
        .style("gap:8px")
        .children(rows);
    node(
        VElement::new("div")
            .class("hk-infinite-tail-loading")
            .attr("role", "status")
            .attr("aria-live", "polite")
            .child(node(list)),
    )
}

/// The invisible geometry probe the host observes.
fn sentinel(label: Option<String>, lookahead: f64) -> VNode {
    node(
        VElement::new("div")
            .class("hk-infinite-tail-sentinel")
            .attr("aria-hidden", "true")
            .attr("data-label", label)
            .attr(
                "data-lookahead",
                format!("{}", infinite_tail_lookahead_px(lookahead)),
            ),
    )
}

#[define_props]
pub struct InfiniteTailProps {
    /// The tail state (Vue `state`). Build it with [`infinite_tail_state`] from
    /// the page machine's flags so the derivation cannot drift.
    #[default]
    pub state: InfiniteTailState,

    /// Auto-load on approach (default). `false` renders the explicit load-more
    /// button instead of the invisible sentinel.
    #[default(true)]
    pub auto: bool,

    /// Delivered item count (with `total`, the progress counter).
    pub shown: Option<u32>,

    /// Match count behind the windowed list.
    pub total: Option<u32>,

    /// Skeleton placeholder rows while a later page is in flight.
    #[default(3)]
    pub skeleton_count: u32,

    /// Row height of the skeleton placeholders (match the host's row height so
    /// the tail does not jump when real rows land).
    #[default("40px".to_string())]
    pub skeleton_item_height: String,

    /// Viewport lookahead in px before the tail enters view (default 480).
    /// The host feeds it to [`infinite_tail_root_margin`] /
    /// [`infinite_tail_sentinel_in_view`].
    #[default(480.0)]
    pub lookahead: f64,

    /// Diagnostic hook rendered as `data-label` on the (aria-hidden) sentinel —
    /// for tests and DOM inspection, NOT an a11y name.
    pub label: Option<String>,

    /// The `loadMore` emit: fired by the manual affordance's click.
    pub on_load_more: Option<EventHandler<()>>,
}

#[component]
pub fn InfiniteTail(props: InfiniteTailProps) -> Element {
    match infinite_tail_affordance(props.state, props.auto) {
        InfiniteTailAffordance::EndNote => LoadMore(LoadMoreProps {
            state: infinite_tail_load_more_state(props.state),
            shown: props.shown,
            total: props.total,
            on_load_more: None,
        }),
        InfiniteTailAffordance::Sentinel => sentinel(props.label.clone(), props.lookahead),
        InfiniteTailAffordance::Skeletons => {
            skeleton_tail(props.skeleton_count, &props.skeleton_item_height)
        }
        InfiniteTailAffordance::LoadMore => LoadMore(LoadMoreProps {
            state: infinite_tail_load_more_state(props.state),
            shown: props.shown,
            total: props.total,
            on_load_more: props.on_load_more.clone(),
        }),
    }
}

impl StyledComponent for InfiniteTailComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkInfiniteTail.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "infinite-tail"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infinite_tail_defaults_match_the_vue_props() {
        let props = InfiniteTailProps::default();
        assert_eq!(props.state, InfiniteTailState::Idle);
        assert!(props.auto);
        assert!(props.shown.is_none());
        assert!(props.total.is_none());
        assert_eq!(props.skeleton_count, 3);
        assert_eq!(props.skeleton_item_height, "40px");
        assert_eq!(props.lookahead, 480.0);
        assert!(props.label.is_none());
        assert!(props.on_load_more.is_none());
    }

    #[test]
    fn infinite_tail_state_derivation_binds_the_vue_exactly() {
        // Exhausted wins over ANY in-flight flag.
        assert_eq!(
            infinite_tail_state(true, true, true),
            InfiniteTailState::End
        );
        assert_eq!(
            infinite_tail_state(true, false, false),
            InfiniteTailState::End
        );
        // A first-page load reads as loading too (the short-first-page rule).
        assert_eq!(
            infinite_tail_state(false, true, false),
            InfiniteTailState::Loading
        );
        assert_eq!(
            infinite_tail_state(false, false, true),
            InfiniteTailState::Loading
        );
        // Nothing in flight and more available.
        assert_eq!(
            infinite_tail_state(false, false, false),
            InfiniteTailState::Idle
        );
    }

    #[test]
    fn infinite_tail_affordance_matrix_covers_state_and_mode() {
        // Fully qualified: `LoadMore` names BOTH an affordance variant and the
        // composed component fn, so a glob import here would be ambiguous.
        use InfiniteTailAffordance as Affordance;
        use InfiniteTailState as State;

        assert_eq!(
            infinite_tail_affordance(State::End, true),
            Affordance::EndNote
        );
        assert_eq!(
            infinite_tail_affordance(State::End, false),
            Affordance::EndNote
        );
        assert_eq!(
            infinite_tail_affordance(State::Idle, true),
            Affordance::Sentinel
        );
        assert_eq!(
            infinite_tail_affordance(State::Loading, true),
            Affordance::Skeletons
        );
        assert_eq!(
            infinite_tail_affordance(State::Idle, false),
            Affordance::LoadMore
        );
        assert_eq!(
            infinite_tail_affordance(State::Loading, false),
            Affordance::LoadMore
        );
        // The state vocabulary the chrome re-emits.
        assert_eq!(State::Idle.attr(), "idle");
        assert_eq!(State::Loading.attr(), "loading");
        assert_eq!(State::End.attr(), "end");
        // The LoadMore mirror's bridge keeps the same three values.
        assert_eq!(
            infinite_tail_load_more_state(State::Idle),
            LoadMoreState::Idle
        );
        assert_eq!(
            infinite_tail_load_more_state(State::Loading),
            LoadMoreState::Loading
        );
        assert_eq!(
            infinite_tail_load_more_state(State::End),
            LoadMoreState::End
        );
    }

    #[test]
    fn infinite_tail_bottom_threshold_uses_the_lookahead_zone() {
        // Far below the viewport, beyond the runway: no load yet.
        assert!(!infinite_tail_sentinel_in_view(
            1300.0, 1301.0, 320.0, 1.0, 800.0, 480.0
        ));
        // EXACTLY at viewport + lookahead: the threshold is inclusive.
        assert!(infinite_tail_sentinel_in_view(
            1280.0, 1281.0, 320.0, 1.0, 800.0, 480.0
        ));
        // Just inside the runway.
        assert!(infinite_tail_sentinel_in_view(
            1200.0, 1201.0, 320.0, 1.0, 800.0, 480.0
        ));
        // Scrolled past (above the viewport) but still inside the upper half of
        // the zone: a fling back up still counts.
        assert!(infinite_tail_sentinel_in_view(
            -900.0, -400.0, 320.0, 1.0, 800.0, 480.0
        ));
        // Above the upper bound of the zone: no load.
        assert!(!infinite_tail_sentinel_in_view(
            -1200.0, -700.0, 320.0, 1.0, 800.0, 480.0
        ));
        // A zero-area sentinel has no rect to intersect.
        assert!(!infinite_tail_sentinel_in_view(
            10.0, 10.0, 0.0, 0.0, 800.0, 480.0
        ));
        // No runway still triggers on the strict viewport bottom.
        assert!(infinite_tail_sentinel_in_view(
            790.0, 791.0, 320.0, 1.0, 800.0, 0.0
        ));
        assert!(!infinite_tail_sentinel_in_view(
            810.0, 811.0, 320.0, 1.0, 800.0, 0.0
        ));
        // A negative/non-finite lookahead is normalized to 0, never inverted.
        assert_eq!(infinite_tail_lookahead_px(-20.0), 0.0);
        assert_eq!(infinite_tail_lookahead_px(f64::NAN), 0.0);
        assert_eq!(infinite_tail_root_margin(480.0), "480px 0px 480px 0px");
        assert_eq!(infinite_tail_root_margin(-1.0), "0px 0px 0px 0px");
    }

    #[test]
    fn infinite_tail_only_an_idle_in_view_tail_loads() {
        assert!(infinite_tail_should_load(InfiniteTailState::Idle, true));
        // Not in view → wait.
        assert!(!infinite_tail_should_load(InfiniteTailState::Idle, false));
        // In flight → a second emission would double-fetch.
        assert!(!infinite_tail_should_load(InfiniteTailState::Loading, true));
        // Exhausted → nothing left to ask for.
        assert!(!infinite_tail_should_load(InfiniteTailState::End, true));
    }

    #[test]
    fn infinite_tail_renders_the_sentinel_in_auto_idle() {
        let html = InfiniteTail(InfiniteTailProps {
            label: Some("feed".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-infinite-tail-sentinel",
            "aria-hidden=\"true\"",
            "data-label=\"feed\"",
            "data-lookahead=\"480\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // No skeleton tail and no load-more chrome in the idle/sentinel branch.
        assert!(!html.contains("hk-infinite-tail-loading"), "{html}");
        assert!(!html.contains("hk-load-more"), "{html}");
    }

    #[test]
    fn infinite_tail_renders_the_skeleton_tail_in_auto_loading() {
        let html = InfiniteTail(InfiniteTailProps {
            state: InfiniteTailState::Loading,
            skeleton_count: 2,
            skeleton_item_height: "56px".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-infinite-tail-loading",
            "role=\"status\"",
            "aria-live=\"polite\"",
            "hk-skeleton-list",
            "hk-skeleton",
            "56px",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Exactly one list; the loading branch never renders the button (the
        // skeletons stand in for the rows that are arriving).
        assert_eq!(html.matches("hk-skeleton-list").count(), 1, "{html}");
        assert!(!html.contains("hk-btn"), "{html}");
    }

    #[test]
    fn infinite_tail_renders_the_end_note_with_the_progress_counter() {
        let html = InfiniteTail(InfiniteTailProps {
            state: InfiniteTailState::End,
            shown: Some(3),
            total: Some(19),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-load-more",
            "data-state=\"end\"",
            "hk-load-more-end",
            "role=\"status\"",
            "hk-load-more-count",
            "3 / 19",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The end note carries no button.
        assert!(!html.contains("hk-btn"), "{html}");
    }

    #[test]
    fn infinite_tail_renders_the_manual_button_in_manual_mode() {
        let idle = InfiniteTail(InfiniteTailProps {
            auto: false,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "hk-load-more",
            "data-state=\"idle\"",
            "hk-btn",
            "hk-btn-ghost",
            "hk-btn-sm",
            "Load more",
        ] {
            assert!(idle.contains(needle), "missing {needle}: {idle}");
        }
        // Manual idle never renders the sentinel (the button is the affordance).
        assert!(!idle.contains("hk-infinite-tail-sentinel"), "{idle}");

        let loading = InfiniteTail(InfiniteTailProps {
            auto: false,
            state: InfiniteTailState::Loading,
            ..Default::default()
        })
        .render_to_html();
        for needle in ["data-state=\"loading\"", "hk-btn-loading", "Loading…"] {
            assert!(loading.contains(needle), "missing {needle}: {loading}");
        }
        // Manual loading keeps the button (the affordance never disappears).
        assert!(!loading.contains("hk-infinite-tail-loading"), "{loading}");
    }

    #[test]
    fn infinite_tail_styles_come_from_the_canonical_vue_sheet() {
        let css = InfiniteTailComponent::styles();
        assert!(
            css.contains(".hk-infinite-tail-sentinel") && css.contains(".hk-infinite-tail-loading"),
            "infinite tail css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored infinite tail sheet"
        );
    }
}
