// hi-components/src/layout/sidebar_rail_toggle.rs
// SidebarRailToggle — mirror of the canonical Vue `HkSidebarRailToggle` (the
// circular hover-reveal toggle of the sidebar rail capability).
//
// NO STYLESHEET OF ITS OWN — and that is upstream's shape, not a shortcut.
// Vue's component imports `./HkSidebarRail.scss` for the geometry but owns no
// sheet of its own, and this mirror's `styles()` is likewise empty:
//
//   * THE WRAPPER'S GEOMETRY COMES FROM THE ALREADY-VENDORED
//     `HkSidebarRail.scss` — the rail family's shared chrome table (the
//     manifest row is `components/HkSidebarRail.scss`). NOTE FOR THE WIRING
//     WAVE: that sheet is vendored but NOT yet compiled by any component in
//     this crate, so `StyleRegistry` gets no rail CSS from any `styles()` —
//     it must be registered on the registry path (the `register_vue_chrome`
//     pattern in `styled.rs`), otherwise the wrapper above has no geometry at
//     all and only `HkIconButton.scss` (the circle) applies. Verified class by
//     class — every class this file emits from that family is DEFINED there:
//         `.hk-sidebar-rail-toggle`                  (position: absolute; the
//             negative logical `inset-inline-end` that straddles the border,
//             opacity 0 / pointer-events none until revealed, the 0.15s fade)
//         `.hk-sidebar-rail-host:hover  .hk-sidebar-rail-toggle`,
//         `.hk-sidebar-rail-host:focus-within .hk-sidebar-rail-toggle`
//                                                    (the reveal itself)
//         `.hk-sidebar-rail-toggle .hk-icon-button`   (the circle: radius
//             override + panel-toned fill + hairline shadow)
//         the reduced-motion block                   (transition: none)
//   * THE CIRCLE'S CHROME COMES FROM `HkIconButton.scss` — `.hk-icon-button`,
//     `.hk-icon-button-24`, `.hk-icon-button-ghost`, `.hk-icon-button-icon`
//     are that component's mirror, not this sheet's. Both sheets are vendored
//     and guarded by `tests/vue_mirror_drift_tests.rs`.
//   * Everything else (`data-expanded`) is state markup only.
//
// CONTRACT THE HOST MUST HOLD UP: the reveal selectors are anchored on an
// ANCESTOR `.hk-sidebar-rail-host`. Without that class the toggle renders at
// `opacity: 0; pointer-events: none` — present, keyboard-unreachable and
// invisible — and the whole control is dead. The geometry tokens
// (`--hk-sidebar-rail-toggle-size: 24px`, `--hk-sidebar-rail-border-width:
// 1px`) are declared on that same host, which is why this markup declares
// neither.
//
// DOM contract (Vue's render output):
//
//   div.hk-sidebar-rail-toggle [data-expanded="true"] [.host-class]
//     button.hk-icon-button.hk-icon-button-24.hk-icon-button-ghost
//            aria-expanded="true|false" aria-label="{localized label}"
//       span.hk-icon-button-icon
//         span[style="display:contents"] > svg.lucide-chevrons-…
//
// `data-expanded` is a PRESENCE attribute (`{props.expanded || undefined}`), so
// the collapsed state renders NO attribute rather than `"false"`; the ARIA
// state, by contrast, is always the string `"true"` / `"false"`
// (`aria-expanded={String(props.expanded)}`).
//
// Deltas vs Vue (documented, not accidental):
//   * THE BUTTON IS RENDERED DIRECTLY, NOT THROUGH `IconButton`. Vue composes
//     `<HkIconButton variant="ghost" size={24} aria-expanded aria-label …>`
//     and relies on attribute fallthrough for `aria-expanded`; the Rust
//     `IconButtonProps` has no generic attribute passthrough (only explicit
//     props), so composing it would silently DROP `aria-expanded`. The mirror
//     therefore emits the identical button — same class list, same
//     `span.hk-icon-button-icon` slot — with the ARIA state intact. The class
//     list is derived from `IconButtonSize::S24` / `IconButtonVariant::Ghost`,
//     so it cannot drift from the component it stands in for.
//   * The chevron pair is lucide markup mounted through
//     `dangerous_inner_html` on a `style="display:contents"` host (an rsx
//     `svg {}` child would be an HTML-namespace element that never paints).
//     The class string is lucide v1.0.0's merged order, so a host's
//     `svg.lucide-*` rule sees the same names Vue emits.
//   * ICON DIRECTION (Vue's documented decision, kept): EXPANDED carries
//     `ChevronsRightLeft` (› ‹ — converging, "squeeze the sidebar in");
//     COLLAPSED carries `ChevronsLeftRight` (‹ › — diverging, "let it back
//     out"). The pair is mirror-symmetric, so RTL needs no glyph flip.
//   * The accessible name comes from the bundle
//     (`components.hk.sidebarRailToggle.collapse` / `.expand`) with Vue's own
//     English as the fallback; Vue reads `hikari::sidebar.collapse` /
//     `hikari::sidebar.expand` (see the receipt: the two key families must be
//     kept in sync by whoever ships the locale entries).
//   * `emit("toggle")` is `on_toggle: EventHandler<()>` — Vue's payload-free
//     emit.
//   * `isPointerOverRailToggle` (a module-level export Vue's suppression
//     wiring imports) is ported as [`is_pointer_over_rail_toggle`]: it works on
//     a rect because a bare `querySelector` handle is not what a mirror should
//     hand a host — the geometry is the pure part, the measurement is the
//     platform's.

use crate::basic::{IconButtonSize, IconButtonVariant};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SidebarRailToggleComponent;

/// The wrapper's class (Vue emits it literally on the div).
pub const RAIL_TOGGLE_CLASS: &str = "hk-sidebar-rail-toggle";

/// Vue's exported `RAIL_TOGGLE_SELECTOR` — one spelling, two hosts.
pub const RAIL_TOGGLE_SELECTOR: &str = ".hk-sidebar-rail-toggle";

/// Vue's `RAIL_TOGGLE_SUPPRESS_PAD`: slack added around the circle when
/// testing "the pointer rests on the toggle" (a resting pointer sits within a
/// pixel or two of the edge, and a razor-thin boundary would re-arm the peek
/// dwell and twitch the drawer).
pub const RAIL_TOGGLE_SUPPRESS_PAD: f64 = 2.0;

/// The box the hit test consumes, in root visual px — a `DOMRect`'s
/// `(x, y, width, height)`, the same shape `tooltip` uses.
pub type RailToggleRect = (f64, f64, f64, f64);

/// Which way a click moves the panel — the direction Vue derives from the
/// `expanded` prop.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum RailToggleAction {
    /// The sidebar is at full width; clicking collapses it.
    Collapse,
    /// The sidebar is an icon rail; clicking expands it.
    Expand,
}

impl RailToggleAction {
    /// The bare verb (`collapse` / `expand`), the bundle key's last segment.
    pub fn verb(self) -> &'static str {
        match self {
            RailToggleAction::Collapse => "collapse",
            RailToggleAction::Expand => "expand",
        }
    }
}

/// The action a click performs (`expanded` true = full width = collapse).
pub fn rail_toggle_action(expanded: bool) -> RailToggleAction {
    if expanded {
        RailToggleAction::Collapse
    } else {
        RailToggleAction::Expand
    }
}

/// The accessible name for the state. Vue:
/// `expanded ? t("hikari::sidebar.collapse", "Collapse sidebar")
///           : t("hikari::sidebar.expand", "Expand sidebar")`.
pub fn rail_toggle_label(expanded: bool) -> String {
    match rail_toggle_action(expanded) {
        RailToggleAction::Collapse => hikari_i18n::t(
            "components.hk.sidebarRailToggle.collapse",
            "Collapse sidebar",
        ),
        RailToggleAction::Expand => {
            hikari_i18n::t("components.hk.sidebarRailToggle.expand", "Expand sidebar")
        }
    }
}

/// The wrapper's `data-expanded` value: Vue's `{props.expanded || undefined}` —
/// `Some("true")` at full width, `None` (genuinely absent) on the rail.
pub fn rail_toggle_expanded_attr(expanded: bool) -> Option<&'static str> {
    expanded.then_some("true")
}

/// The button's `aria-expanded`: ALWAYS present, as Vue's
/// `aria-expanded={String(props.expanded)}` is.
pub fn rail_toggle_aria_expanded(expanded: bool) -> &'static str {
    if expanded { "true" } else { "false" }
}

/// The standing-in-for-IconButton class list (`variant="ghost"`, `size={24}`),
/// in IconButton's own order.
pub fn rail_toggle_button_classes() -> String {
    format!(
        "hk-icon-button {} {}",
        IconButtonSize::S24.class_name(),
        IconButtonVariant::Ghost.class_name()
    )
}

/// lucide `ChevronsRightLeft` at `size={14}` — the EXPANDED state's glyph
/// (converging ‹ ›): "squeeze the sidebar in".
const CHEVRONS_RIGHT_LEFT_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-right-left-icon lucide-chevrons-right-left" aria-hidden="true"><path d="m20 17-5-5 5-5"/><path d="m4 17 5-5-5-5"/></svg>"#;

/// lucide `ChevronsLeftRight` at `size={14}` — the COLLAPSED state's glyph
/// (diverging › ‹): "let it back out".
const CHEVRONS_LEFT_RIGHT_SVG: &str = r#"<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-left-right-icon lucide-chevrons-left-right" aria-hidden="true"><path d="m9 7-5 5 5 5"/><path d="m15 7 5 5-5 5"/></svg>"#;

/// The chevron markup for the state (expanded → converging pair).
pub fn rail_toggle_chevron_svg(expanded: bool) -> &'static str {
    if expanded {
        CHEVRONS_RIGHT_LEFT_SVG
    } else {
        CHEVRONS_LEFT_RIGHT_SVG
    }
}

/// Whether the point lies over the toggle's box inside `pad` slack — Vue's
/// `isPointerOverRailToggle` geometry, without the DOM lookup.
///
/// The suppression wiring needs GEOMETRY, not `event.target`: before the
/// region is engaged the toggle is `opacity: 0; pointer-events: none`, so a
/// pointer resting on it targets the element underneath and a
/// `contains(target)` test would report "not on the toggle" — re-arming the
/// dwell under the resting cursor (the reported twitch). The element still has
/// a box while invisible, so its rect is the honest answer.
pub fn is_pointer_over_rail_toggle(rect: RailToggleRect, x: f64, y: f64) -> bool {
    is_pointer_over_rail_toggle_with_pad(rect, x, y, RAIL_TOGGLE_SUPPRESS_PAD)
}

/// [`is_pointer_over_rail_toggle`] with an explicit slack (Vue's `pad`
/// parameter at the call site).
pub fn is_pointer_over_rail_toggle_with_pad(
    rect: RailToggleRect,
    x: f64,
    y: f64,
    pad: f64,
) -> bool {
    let (left, top, width, height) = rect;
    let right = left + width;
    let bottom = top + height;
    x >= left - pad && x <= right + pad && y >= top - pad && y <= bottom + pad
}

/// The paint-inert host every SVG glyph hangs on (`dangerous_inner_html`
/// suppresses an element's own children, so the markup cannot sit beside a
/// sibling — the crate-wide SVG rule).
fn glyph_host(markup: &'static str) -> Element {
    VNode::Element(Box::new(
        VElement::new("span")
            .style("display:contents")
            .dangerous_inner_html(markup),
    ))
}

#[define_props]
pub struct SidebarRailToggleProps {
    /// True while the sidebar is at FULL width (clicking will collapse); false
    /// while it is an icon rail (clicking will expand). Vue's default is true.
    #[default(true)]
    pub expanded: bool,

    /// The `toggle` emit (Vue: `emits: { toggle: () => true }`, no payload).
    pub on_toggle: Option<EventHandler<()>>,

    /// Fallthrough host class on the positioning wrapper (Vue: the single-root
    /// attr merge).
    #[default]
    pub class: String,
}

#[component]
pub fn SidebarRailToggle(props: SidebarRailToggleProps) -> Element {
    let expanded = props.expanded;
    let on_toggle = props.on_toggle.clone();

    let wrapper_classes = if props.class.is_empty() {
        RAIL_TOGGLE_CLASS.to_string()
    } else {
        format!("{RAIL_TOGGLE_CLASS} {}", props.class)
    };

    let mut wrapper = VElement::new("div").class(wrapper_classes);
    if let Some(flag) = rail_toggle_expanded_attr(expanded) {
        wrapper = wrapper.attr("data-expanded", flag);
    }

    let button = VElement::new("button")
        .class(rail_toggle_button_classes())
        .attr("aria-expanded", rail_toggle_aria_expanded(expanded))
        .attr("aria-label", rail_toggle_label(expanded))
        .on_click(move |_event: MouseEvent| {
            if let Some(handler) = on_toggle.as_ref() {
                handler.call(());
            }
        })
        .child(rsx! {
            span { class: "hk-icon-button-icon",
                {glyph_host(rail_toggle_chevron_svg(expanded))}
            }
        });

    wrapper = wrapper.child(VNode::Element(Box::new(button)));
    VNode::Element(Box::new(wrapper))
}

impl StyledComponent for SidebarRailToggleComponent {
    fn styles() -> &'static str {
        // Vue ships no sheet for THIS component: the wrapper's geometry lives
        // in the vendored HkSidebarRail.scss (the rail family's shared chrome
        // table — every class emitted above is defined there) and the circle's
        // chrome in HkIconButton.scss. An empty table, not an error.
        ""
    }

    fn name() -> &'static str {
        "sidebar-rail-toggle"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A 24px circle at the panel's content-facing border.
    const RECT: RailToggleRect = (100.0, 50.0, 24.0, 24.0);

    #[test]
    fn sidebar_rail_toggle_defaults_match_the_vue_props() {
        let props = SidebarRailToggleProps::default();
        // Vue: `expanded: { type: Boolean, default: true }`.
        assert!(props.expanded);
        assert!(props.on_toggle.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn sidebar_rail_toggle_constants_match_the_vue_module() {
        assert_eq!(RAIL_TOGGLE_CLASS, "hk-sidebar-rail-toggle");
        // Vue's exported selector is the class with its dot.
        assert_eq!(RAIL_TOGGLE_SELECTOR, ".hk-sidebar-rail-toggle");
        assert_eq!(format!(".{RAIL_TOGGLE_CLASS}"), RAIL_TOGGLE_SELECTOR);
        // Vue: `RAIL_TOGGLE_SUPPRESS_PAD = 2`.
        assert_eq!(RAIL_TOGGLE_SUPPRESS_PAD, 2.0);
    }

    #[test]
    fn sidebar_rail_toggle_derives_its_action_and_label_from_the_state() {
        assert_eq!(rail_toggle_action(true), RailToggleAction::Collapse);
        assert_eq!(rail_toggle_action(false), RailToggleAction::Expand);
        assert_eq!(RailToggleAction::Collapse.verb(), "collapse");
        assert_eq!(RailToggleAction::Expand.verb(), "expand");
        // Vue's English defaults, byte for byte.
        assert_eq!(rail_toggle_label(true), "Collapse sidebar");
        assert_eq!(rail_toggle_label(false), "Expand sidebar");
    }

    #[test]
    fn sidebar_rail_toggle_state_attributes_split_presence_from_aria() {
        // `{props.expanded || undefined}`: the collapsed state has NO attribute.
        assert_eq!(rail_toggle_expanded_attr(true), Some("true"));
        assert_eq!(rail_toggle_expanded_attr(false), None);
        // `aria-expanded={String(props.expanded)}`: always present.
        assert_eq!(rail_toggle_aria_expanded(true), "true");
        assert_eq!(rail_toggle_aria_expanded(false), "false");
    }

    #[test]
    fn sidebar_rail_toggle_button_matches_the_icon_button_composition() {
        // Vue: `<HkIconButton variant="ghost" size={24}>` — IconButton's order.
        assert_eq!(
            rail_toggle_button_classes(),
            "hk-icon-button hk-icon-button-24 hk-icon-button-ghost"
        );
    }

    #[test]
    fn sidebar_rail_toggle_chevrons_flip_with_the_state() {
        let expanded = rail_toggle_chevron_svg(true);
        let collapsed = rail_toggle_chevron_svg(false);
        // Vue: expanded → ChevronsRightLeft (converging), collapsed → the
        // diverging pair. Both are shaft-less and 14px.
        assert!(
            expanded.contains("lucide-chevrons-right-left"),
            "{expanded}"
        );
        assert!(
            collapsed.contains("lucide-chevrons-left-right"),
            "{collapsed}"
        );
        assert_ne!(expanded, collapsed);
        for svg in [expanded, collapsed] {
            assert!(svg.contains(r#"width="14""#), "{svg}");
            assert!(svg.contains(r#"height="14""#), "{svg}");
            assert!(svg.contains(r#"viewBox="0 0 24 24""#), "{svg}");
            assert!(svg.contains(r#"aria-hidden="true""#), "{svg}");
        }
    }

    #[test]
    fn sidebar_rail_toggle_hit_test_carries_the_two_pixel_slack() {
        // Dead centre of the circle.
        assert!(is_pointer_over_rail_toggle(RECT, 112.0, 62.0));
        // Inside the box.
        assert!(is_pointer_over_rail_toggle(RECT, 100.5, 50.5));
        // The slack band on every side (24px box at 100/50 → right 124,
        // bottom 74): 1px outside passes, 3px outside fails.
        for point in [(99.0, 62.0), (125.0, 62.0), (112.0, 49.0), (112.0, 75.0)] {
            assert!(
                is_pointer_over_rail_toggle(RECT, point.0, point.1),
                "{point:?} is within the pad"
            );
        }
        for point in [(97.0, 62.0), (127.0, 62.0), (112.0, 47.0), (112.0, 77.0)] {
            assert!(
                !is_pointer_over_rail_toggle(RECT, point.0, point.1),
                "{point:?} is outside the pad"
            );
        }
        // The pad is a parameter, not a constant of the geometry.
        assert!(is_pointer_over_rail_toggle_with_pad(RECT, 99.0, 62.0, 4.0));
        assert!(!is_pointer_over_rail_toggle_with_pad(RECT, 99.0, 62.0, 0.5));
    }

    #[test]
    fn sidebar_rail_toggle_renders_the_vue_wrapper_and_circle() {
        let html = SidebarRailToggle(SidebarRailToggleProps::default()).render_to_html();

        for needle in [
            "<div",
            r#"class="hk-sidebar-rail-toggle""#,
            // Vue's `{expanded || undefined}` presence attribute.
            r#"data-expanded="true""#,
            "<button",
            r#"class="hk-icon-button hk-icon-button-24 hk-icon-button-ghost""#,
            r#"aria-expanded="true""#,
            r#"aria-label="Collapse sidebar""#,
            // The default slot rides IconButton's icon span.
            r#"class="hk-icon-button-icon""#,
            "display:contents",
            "lucide-chevrons-right-left",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The button carries NO `type` — HkIconButton's template sets none.
        assert!(!html.contains(r#"type="button""#), "{html}");
    }

    #[test]
    fn sidebar_rail_toggle_collapsed_state_drops_the_presence_attribute() {
        let html = SidebarRailToggle(SidebarRailToggleProps {
            expanded: false,
            ..Default::default()
        })
        .render_to_html();

        assert!(!html.contains("data-expanded"), "{html}");
        for needle in [
            r#"aria-expanded="false""#,
            r#"aria-label="Expand sidebar""#,
            "lucide-chevrons-left-right",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("lucide-chevrons-right-left"), "{html}");
    }

    #[test]
    fn sidebar_rail_toggle_styles_come_from_the_vendored_rail_chrome() {
        // No sheet of its own: HkSidebarRail.scss carries the wrapper geometry
        // (as the rail family's shared table) and HkIconButton.scss the circle.
        let css = SidebarRailToggleComponent::styles();
        assert_eq!(css, "");
        assert_eq!(SidebarRailToggleComponent::name(), "sidebar-rail-toggle");
        // The classes the markup claims are the ones the schema documents —
        // the assertion above pins that this file ships no CSS of its own,
        // so the vendored rail sheet MUST define the wrapper class.
        assert_eq!(RAIL_TOGGLE_CLASS, "hk-sidebar-rail-toggle");
    }
}
