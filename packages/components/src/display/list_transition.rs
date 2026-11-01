// hi-components/src/display/list_transition.rs
// ListTransition — mirror of the canonical Vue `HkListTransition`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkListTransition.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-list-*`
// class names are literal and identical in both forms. DOM contract:
//
//   Tag [host class] [.hk-list-move-disabled]       (Vue `tag`, default `div`)
//     div.hk-list-item                              (one per ACTIVE row, `items` order)
//          data-list-key={key}
//          [.hk-list-{name}-enter-active .hk-list-{name}-enter-from|enter-to]
//       {content}
//     div.hk-list-item                              (one per RETAINED outgoing row)
//          data-list-key={key}
//          [.hk-list-{name}-leave-active .hk-list-{name}-leave-from|leave-to]
//       {content}
//
// `{name}` is `hk-list-{variant}` or `hk-list-none` when disabled — the same
// string Vue feeds TransitionGroup's `name`, so both forms emit the identical
// `-enter-active` / `-enter-from` / `-leave-*` vocabulary the sheet defines.
//
// Deltas vs Vue (documented, not accidental):
//   * tairitsu has NO transition hooks. Vue's `TransitionGroup` runs the whole
//     choreography through per-child hooks (onBeforeEnter/onAfterLeave and the
//     refcounted animation-bus report); the mirror turns it into the
//     CONTROLLED `phase` prop — `Enter` stages a batch at its `*-from` state,
//     `Entering` runs it to `*-to`, `Leaving` drives the outgoing batch (and
//     settles the active rows), `Idle` means nothing is in flight.
//     [`list_transition_row_classes`] is the complete class table.
//   * Vue owns the leaving children: `<TransitionGroup>` keeps a removed row
//     mounted until `afterLeave`, and it also owns the pre-patch geometry pin
//     (`pinLeaveGeometry`) that keeps the absolute leave row in place. A
//     controlled mirror cannot snapshot a subtree, so the host passes the
//     retained rows as `leaving` and [`list_transition_ghost_keys`] is the
//     retention rule (a row that is back in `items` is never ghosted — Vue
//     cancels that leave; duplicates and empty keys are dropped).
//     [`list_transition_uses_absolute_leave`] is the class of variants whose
//     leave rule lifts the row out of flow and therefore NEEDS a host pin.
//   * Vue applies the transition classes to the child vnode itself.
//     tairitsu cannot inject a class into a caller-supplied `Element`, so each
//     row is wrapped in an unstyled `hk-list-item` box that carries the
//     classes, the patch key and `data-list-key`. The box is not styled by the
//     sheet: a host whose list layout is sensitive to the extra box (a flex
//     ROW list) should style `.hk-list-item` itself.
//   * `move` / `moveClass`: tairitsu patches without a FLIP pass, so the move
//     class cannot be applied to "the rows that moved". The mirror puts
//     `hk-list-move-disabled` (Vue's `moveClass` value when `move` is false) on
//     the GROUP HOST instead — it carries `!important` for the element it lands
//     on only (transitions are not inherited), so it can never mask a row's
//     enter/leave transition.
//   * `appear` is retired: it only gated the MOUNT-time enter, which a
//     controlled host expresses by starting at `phase: Idle`.
//   * Ghost rows are appended after the active rows. For the `position:
//     absolute` leave variants (`pop`/`slide`/`fade`/`grow`) that is invisible;
//     for `reveal`, whose leave stays in flow, the ghost sits at the tail for
//     the one beat it shrinks out.
//   * The `move` prop is spelled `move_enabled`: `move` is a Rust keyword (the
//     same rename `Button` applies to Vue's `type`).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ListTransitionComponent;

/// Vue: `REPORT_MS` — the enter/leave animation-bus window. The slowest
/// variant (`pop`/`slide`/`fade`) runs `--duration-normal`; the fast ones run
/// their own 150ms plus a 150ms stagger, so both finish inside this budget.
pub const LIST_TRANSITION_REPORT_MS: f64 = 320.0;

/// The `--duration-normal` default the three standard variants run (ms).
pub const LIST_TRANSITION_NORMAL_DURATION_MS: f64 = 300.0;

/// The `--duration-fast` default the fast variants run (ms).
pub const LIST_TRANSITION_FAST_DURATION_MS: f64 = 150.0;

/// The one-beat stagger `grow`/`reveal` add on the enter side (ms).
pub const LIST_TRANSITION_FAST_STAGGER_MS: f64 = 150.0;

/// The five animation variants (Vue default `pop`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ListTransitionVariant {
    #[default]
    Pop,
    Slide,
    Fade,
    Grow,
    Reveal,
}

impl ListTransitionVariant {
    /// The `{variant}` half of TransitionGroup's `name`.
    pub fn name(self) -> &'static str {
        match self {
            ListTransitionVariant::Pop => "pop",
            ListTransitionVariant::Slide => "slide",
            ListTransitionVariant::Fade => "fade",
            ListTransitionVariant::Grow => "grow",
            ListTransitionVariant::Reveal => "reveal",
        }
    }
}

/// The controlled batch state machine (Vue reads it from its
/// `TransitionGroup` hooks; here the host drives it).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ListTransitionPhase {
    /// Nothing in flight: every rendered row is settled.
    #[default]
    Idle,
    /// A batch just armed: entering rows staged at `*-enter-from`, leaving
    /// rows at `*-leave-from`.
    Enter,
    /// The batch is running: entering rows → `*-enter-to`, leaving rows →
    /// `*-leave-to`.
    Entering,
    /// Tail of the batch: the active rows are settled, only the outgoing
    /// rows still animate.
    Leaving,
}

/// Which generation of the batch a class query is for.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ListRowRole {
    /// A key present in `items`.
    Active,
    /// A key the host retained in `leaving`.
    Leaving,
}

/// One keyed row: the key that identifies it plus its content (Vue: the keyed
/// child vnode).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ListTransitionItem {
    pub key: String,
    pub content: Element,
}

/// TransitionGroup's `name`: `hk-list-none` when disabled, else
/// `hk-list-{variant}`. This is the prefix every row class is built from.
pub fn list_transition_name(variant: ListTransitionVariant, disabled: bool) -> String {
    if disabled {
        "hk-list-none".to_string()
    } else {
        format!("hk-list-{}", variant.name())
    }
}

/// The enter budget a variant needs (ms): `pop`/`slide`/`fade` run
/// `--duration-normal`, while `grow`/`reveal` run `--duration-fast` PLUS the
/// one-beat stagger delay the sheet declares. Every variant stays inside
/// [`LIST_TRANSITION_REPORT_MS`] — that is exactly what Vue's report window
/// promises the animation bus, so a host can arm its own listener for this
/// long instead of guessing per variant.
pub fn list_transition_enter_ms(variant: ListTransitionVariant) -> f64 {
    match variant {
        ListTransitionVariant::Pop | ListTransitionVariant::Slide | ListTransitionVariant::Fade => {
            LIST_TRANSITION_NORMAL_DURATION_MS
        }
        ListTransitionVariant::Grow | ListTransitionVariant::Reveal => {
            LIST_TRANSITION_FAST_DURATION_MS + LIST_TRANSITION_FAST_STAGGER_MS
        }
    }
}

/// Vue's `moveClass` expression: `move ? undefined : "hk-list-move-disabled"`.
pub fn list_transition_move_class(move_enabled: bool) -> Option<&'static str> {
    if move_enabled {
        None
    } else {
        Some("hk-list-move-disabled")
    }
}

/// The variants whose leave rule lifts the row out of flow with
/// `position: absolute` (Vue: `ABSOLUTE_VARIANTS`). Only these need the
/// host's geometry pin: `reveal` animates the row's own height in place and
/// `none` never leaves the flow, so a pin would freeze the property they
/// animate.
pub fn list_transition_uses_absolute_leave(variant: ListTransitionVariant, disabled: bool) -> bool {
    !disabled
        && matches!(
            variant,
            ListTransitionVariant::Pop
                | ListTransitionVariant::Slide
                | ListTransitionVariant::Fade
                | ListTransitionVariant::Grow
        )
}

/// The complete phase → class table. A settled row carries NO class (the
/// sheet's rules only exist for the active/from/to states).
pub fn list_transition_row_classes(
    variant: ListTransitionVariant,
    disabled: bool,
    phase: ListTransitionPhase,
    role: ListRowRole,
) -> String {
    let side_step = match (phase, role) {
        (ListTransitionPhase::Idle, _) => None,
        (ListTransitionPhase::Enter, ListRowRole::Active) => Some(("enter", "from")),
        (ListTransitionPhase::Enter, ListRowRole::Leaving) => Some(("leave", "from")),
        (ListTransitionPhase::Entering, ListRowRole::Active) => Some(("enter", "to")),
        (ListTransitionPhase::Entering, ListRowRole::Leaving) => Some(("leave", "to")),
        (ListTransitionPhase::Leaving, ListRowRole::Active) => None,
        (ListTransitionPhase::Leaving, ListRowRole::Leaving) => Some(("leave", "to")),
    };
    match side_step {
        None => String::new(),
        Some((side, step)) => {
            let name = list_transition_name(variant, disabled);
            format!("{name}-{side}-active {name}-{side}-{step}")
        }
    }
}

/// The retention rule: the keys the host kept in `leaving` that are NOT back
/// in `items`, in declaration order, deduplicated, empty keys dropped. A key
/// that reappears in `items` is never ghosted (Vue cancels that leave and the
/// row re-enters), and it renders exactly once — as the active row.
pub fn list_transition_ghost_keys(items: &[String], leaving: &[String]) -> Vec<String> {
    let mut ghosts: Vec<String> = Vec::new();
    for key in leaving {
        if key.is_empty() {
            continue;
        }
        if items.iter().any(|active| active == key) {
            continue;
        }
        if ghosts.iter().any(|ghost| ghost == key) {
            continue;
        }
        ghosts.push(key.clone());
    }
    ghosts
}

/// Vue `tag` prop resolution: an empty tag falls back to the `div` default
/// instead of rendering a broken root.
pub fn list_transition_tag(tag: &str) -> &str {
    if tag.is_empty() { "div" } else { tag }
}

fn list_row(
    variant: ListTransitionVariant,
    disabled: bool,
    phase: ListTransitionPhase,
    role: ListRowRole,
    key: &str,
    content: Element,
) -> VNode {
    let row = VElement::new("div")
        .class(list_transition_row_classes(variant, disabled, phase, role))
        .attr("data-list-key", key.to_string())
        .key(key)
        .child(content);
    VNode::Element(Box::new(row))
}

#[define_props]
pub struct ListTransitionProps {
    /// Host element tag (Vue `tag`, default `div`).
    #[default("div".to_string())]
    pub tag: String,

    /// Enter/leave choreography variant (Vue `variant`).
    #[default]
    pub variant: ListTransitionVariant,

    /// FLIP the siblings into their new places (Vue `move`; renamed because
    /// `move` is a Rust keyword — same treatment as `Button`'s `type`).
    #[default]
    pub move_enabled: bool,

    /// No choreography at all: rows render under `hk-list-none` (Vue
    /// `disabled`).
    #[default]
    pub disabled: bool,

    /// The controlled batch phase (see the header delta).
    #[default]
    pub phase: ListTransitionPhase,

    /// The active, keyed rows in render order (Vue: the keyed children).
    pub items: Vec<ListTransitionItem>,

    /// The outgoing rows the host still holds for the leave (Vue: the children
    /// TransitionGroup cannot unmount yet). Filtered through
    /// [`list_transition_ghost_keys`].
    pub leaving: Vec<ListTransitionItem>,

    /// Extra class appended to the group host.
    #[default]
    pub class: String,
}

#[component]
pub fn ListTransition(props: ListTransitionProps) -> Element {
    let mut host_classes = props.class.clone();
    if let Some(move_class) = list_transition_move_class(props.move_enabled) {
        if !host_classes.is_empty() {
            host_classes.push(' ');
        }
        host_classes.push_str(move_class);
    }

    let mut rows: Vec<VNode> = Vec::with_capacity(props.items.len() + props.leaving.len());
    let mut item_keys: Vec<String> = Vec::with_capacity(props.items.len());
    for item in &props.items {
        item_keys.push(item.key.clone());
        rows.push(list_row(
            props.variant,
            props.disabled,
            props.phase,
            ListRowRole::Active,
            &item.key,
            item.content.clone(),
        ));
    }

    let leaving_keys: Vec<String> = props.leaving.iter().map(|row| row.key.clone()).collect();
    for key in list_transition_ghost_keys(&item_keys, &leaving_keys) {
        let content = props
            .leaving
            .iter()
            .find(|row| row.key == key)
            .map(|row| row.content.clone())
            .unwrap_or_else(empty_vnode);
        rows.push(list_row(
            props.variant,
            props.disabled,
            props.phase,
            ListRowRole::Leaving,
            &key,
            content,
        ));
    }

    let host = VElement::new(list_transition_tag(&props.tag))
        .class(host_classes)
        .children(rows);
    VNode::Element(Box::new(host))
}

impl StyledComponent for ListTransitionComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkListTransition.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "list-transition"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(key: &str) -> ListTransitionItem {
        ListTransitionItem {
            key: key.to_string(),
            content: rsx! {
                span { "{key}" }
            },
        }
    }

    #[test]
    fn list_transition_defaults_match_the_vue_props() {
        let props = ListTransitionProps::default();
        assert_eq!(props.tag, "div");
        assert_eq!(props.variant, ListTransitionVariant::Pop);
        assert!(!props.move_enabled);
        assert!(!props.disabled);
        assert_eq!(props.phase, ListTransitionPhase::Idle);
        assert!(props.items.is_empty());
        assert!(props.leaving.is_empty());
        assert_eq!(props.class, "");
    }

    #[test]
    fn list_transition_name_and_move_class_follow_vue() {
        assert_eq!(
            list_transition_name(ListTransitionVariant::Pop, false),
            "hk-list-pop"
        );
        assert_eq!(
            list_transition_name(ListTransitionVariant::Reveal, false),
            "hk-list-reveal"
        );
        // Disabled short-circuits the variant entirely.
        assert_eq!(
            list_transition_name(ListTransitionVariant::Slide, true),
            "hk-list-none"
        );
        assert_eq!(
            list_transition_move_class(false),
            Some("hk-list-move-disabled")
        );
        assert_eq!(list_transition_move_class(true), None);
        assert_eq!(list_transition_tag(""), "div");
        assert_eq!(list_transition_tag("ul"), "ul");
    }

    #[test]
    fn list_transition_enter_budget_stays_inside_the_report_window() {
        // The standard variants run --duration-normal ...
        for variant in [
            ListTransitionVariant::Pop,
            ListTransitionVariant::Slide,
            ListTransitionVariant::Fade,
        ] {
            assert_eq!(list_transition_enter_ms(variant), 300.0);
        }
        // ... the fast ones run --duration-fast plus the stagger beat.
        assert_eq!(list_transition_enter_ms(ListTransitionVariant::Grow), 300.0);
        assert_eq!(
            list_transition_enter_ms(ListTransitionVariant::Reveal),
            300.0
        );
        // The report window must cover every variant (Vue's REPORT_MS promise).
        for variant in [
            ListTransitionVariant::Pop,
            ListTransitionVariant::Slide,
            ListTransitionVariant::Fade,
            ListTransitionVariant::Grow,
            ListTransitionVariant::Reveal,
        ] {
            assert!(
                list_transition_enter_ms(variant) <= LIST_TRANSITION_REPORT_MS,
                "{variant:?} overruns the report window"
            );
        }
    }

    #[test]
    fn list_transition_absolute_leave_covers_exactly_the_vue_set() {
        for variant in [
            ListTransitionVariant::Pop,
            ListTransitionVariant::Slide,
            ListTransitionVariant::Fade,
            ListTransitionVariant::Grow,
        ] {
            assert!(
                list_transition_uses_absolute_leave(variant, false),
                "{variant:?} lifts its leave out of flow"
            );
        }
        // `reveal` animates the row's own height in place: never pinned.
        assert!(!list_transition_uses_absolute_leave(
            ListTransitionVariant::Reveal,
            false
        ));
        // Disabled renders `hk-list-none`: no leave rule at all.
        assert!(!list_transition_uses_absolute_leave(
            ListTransitionVariant::Pop,
            true
        ));
    }

    #[test]
    fn list_transition_row_classes_are_the_complete_phase_table() {
        use ListTransitionPhase::*;
        use ListTransitionVariant::Pop;

        assert_eq!(
            list_transition_row_classes(Pop, false, Idle, ListRowRole::Active),
            ""
        );
        assert_eq!(
            list_transition_row_classes(Pop, false, Idle, ListRowRole::Leaving),
            ""
        );
        // Enter stages both sides at their `-from` state.
        assert_eq!(
            list_transition_row_classes(Pop, false, Enter, ListRowRole::Active),
            "hk-list-pop-enter-active hk-list-pop-enter-from"
        );
        assert_eq!(
            list_transition_row_classes(Pop, false, Enter, ListRowRole::Leaving),
            "hk-list-pop-leave-active hk-list-pop-leave-from"
        );
        // Entering runs them to `-to`.
        assert_eq!(
            list_transition_row_classes(Pop, false, Entering, ListRowRole::Active),
            "hk-list-pop-enter-active hk-list-pop-enter-to"
        );
        assert_eq!(
            list_transition_row_classes(Pop, false, Entering, ListRowRole::Leaving),
            "hk-list-pop-leave-active hk-list-pop-leave-to"
        );
        // Leaving settles the batch: only the ghosts still animate.
        assert_eq!(
            list_transition_row_classes(Pop, false, Leaving, ListRowRole::Active),
            ""
        );
        assert_eq!(
            list_transition_row_classes(Pop, false, Leaving, ListRowRole::Leaving),
            "hk-list-pop-leave-active hk-list-pop-leave-to"
        );
        // Disabled rewrites the PREFIX, not the phase mapping.
        assert_eq!(
            list_transition_row_classes(Pop, true, Entering, ListRowRole::Active),
            "hk-list-none-enter-active hk-list-none-enter-to"
        );
    }

    #[test]
    fn list_transition_ghosts_skip_reappearing_duplicate_and_empty_keys() {
        let items = vec!["a".to_string(), "b".to_string()];
        // The empty list keeps every retained key ...
        assert_eq!(
            list_transition_ghost_keys(&[], &["x".to_string(), "y".to_string()]),
            vec!["x".to_string(), "y".to_string()]
        );
        // ... a single element list keeps exactly the other one ...
        assert_eq!(
            list_transition_ghost_keys(&["a".to_string()], &["b".to_string()]),
            vec!["b".to_string()]
        );
        // ... a key that came BACK is not a ghost (Vue cancels that leave) ...
        assert_eq!(
            list_transition_ghost_keys(&items, &["b".to_string(), "c".to_string()]),
            vec!["c".to_string()]
        );
        // ... duplicates collapse, empty keys never key a row.
        assert_eq!(
            list_transition_ghost_keys(&items, &["x".to_string(), "x".to_string(), String::new()]),
            vec!["x".to_string()]
        );
        // Nothing retained → nothing ghosted.
        assert!(list_transition_ghost_keys(&items, &[]).is_empty());
    }

    #[test]
    fn list_transition_renders_active_rows_then_the_retained_ghost() {
        let html = ListTransition(ListTransitionProps {
            variant: ListTransitionVariant::Slide,
            phase: ListTransitionPhase::Entering,
            items: vec![row("a"), row("b")],
            leaving: vec![row("gone"), row("a")],
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "hk-list-move-disabled",
            "data-list-key=\"a\"",
            "data-list-key=\"b\"",
            "data-list-key=\"gone\"",
            "hk-list-slide-enter-active",
            "hk-list-slide-enter-to",
            "hk-list-slide-leave-active",
            "hk-list-slide-leave-to",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The re-added key renders once (as an ACTIVE row, no leave class).
        assert_eq!(html.matches("data-list-key=\"a\"").count(), 1, "{html}");
        // Ghosts are appended after the active rows.
        let active_at = html.find("data-list-key=\"b\"").expect("active row");
        let ghost_at = html.find("data-list-key=\"gone\"").expect("ghost row");
        assert!(active_at < ghost_at, "ghost must trail the batch: {html}");
    }

    #[test]
    fn list_transition_disabled_and_idle_render_without_choreography() {
        let idle = ListTransition(ListTransitionProps {
            items: vec![row("only")],
            ..Default::default()
        })
        .render_to_html();
        assert!(idle.contains("data-list-key=\"only\""), "{idle}");
        assert!(!idle.contains("hk-list-pop-"), "{idle}");

        let disabled = ListTransition(ListTransitionProps {
            disabled: true,
            move_enabled: true,
            phase: ListTransitionPhase::Enter,
            items: vec![row("only")],
            ..Default::default()
        })
        .render_to_html();
        assert!(disabled.contains("hk-list-none-enter-active"), "{disabled}");
        assert!(!disabled.contains("hk-list-move-disabled"), "{disabled}");

        // An empty active list is legal: no rows, no panic.
        let empty = ListTransition(ListTransitionProps::default()).render_to_html();
        assert!(!empty.contains("hk-list-item"), "{empty}");
    }

    #[test]
    fn list_transition_styles_come_from_the_canonical_vue_sheet() {
        let css = ListTransitionComponent::styles();
        assert!(
            css.contains(".hk-list-pop-enter-active")
                && css.contains(".hk-list-reveal-leave-active")
                && css.contains(".hk-list-none-move"),
            "list transition css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored list transition sheet"
        );
    }
}
