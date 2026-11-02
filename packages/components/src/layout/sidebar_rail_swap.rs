// hi-components/src/layout/sidebar_rail_swap.rs
// SidebarRailSwap — mirror of the canonical Vue `HkSidebarRailSwap` (the
// rail↔full CONTENT handoff of the sidebar rail capability).
//
// NO STYLESHEET OF ITS OWN, and that is upstream's shape: Vue's component
// imports `./HkSidebarRail.scss` for the geometry but owns no sheet, and this
// mirror's `styles()` is empty for the same reason.
//
//   * THE SWAP'S GEOMETRY COMES FROM THE ALREADY-VENDORED
//     `HkSidebarRail.scss` — the rail family's shared chrome table (manifest
//     row `components/HkSidebarRail.scss`). NOTE FOR THE WIRING WAVE: that
//     sheet is vendored but NOT yet compiled by any component in this crate, so
//     it must be registered on the registry path (the `register_vue_chrome`
//     pattern in `styled.rs`); otherwise the swap keeps only HkCrossfade's own
//     rules and loses its flex track. Verified class by class — both classes
//     this file emits from that family are DEFINED there:
//         `.hk-sidebar-rail-swap`        (the `.hk-sidebar-rail-clip >
//             .hk-sidebar-rail-swap` rule: `flex: 1; min-height: 0;
//             align-self: flex-start` — the shrink-to-fit host that keeps the
//             "original content width" guarantee structural)
//         `.hk-sidebar-rail-generation`  (`.hk-sidebar-rail-swap
//             .hk-sidebar-rail-generation`: full height, flex column)
//     The dissolve itself (`.hk-crossfade*`) is `HkCrossfade.scss`, i.e. the
//     `CrossfadeComponent` mirror. Both sheets are vendored and guarded by
//     `tests/vue_mirror_drift_tests.rs`.
//
// CONTRACT THE HOST MUST HOLD UP, twice over:
//   1. The swap must be a DIRECT CHILD of `.hk-sidebar-rail-clip` — the sheet's
//      rule is a child combinator, and a swap nested one level deeper gets no
//      flex track (it collapses to its content width inside the clipping
//      column).
//   2. The clip needs an ancestor `.hk-sidebar-rail-host` for the rail's
//      tokens/geometry to make sense (the host carries the panel width).
//
// DOM contract (Vue's render output):
//
//   div.hk-crossfade.hk-sidebar-rail-swap [.host-class]
//     div.hk-crossfade-item  data-crossfade-key="rail"|"full"
//       div.hk-sidebar-rail-generation [data-rail]  (style: width:{pinned})
//         {children}                    (Vue: the default slot, `{ rail }` param)
//
// WHY THE SPLIT EXISTS (Vue's documented defect this closes): a rail↔full flip
// animates the PANEL's `width` while the density dress flips instantly, so a
// single mounted body would be re-laid-out at the animating panel width —
// expanding mounts full-width rows inside a still-56px panel (labels wrap and
// ellipsize, then relax: the reported "squeezed" content) and collapsing snaps
// rows to icon tiles that glide through the still-wide panel. Each generation
// is therefore PINNED at its own width and the swap exchanges them through an
// opacity dissolve; the clip does the windowing.
//
// Deltas vs Vue (documented, not accidental):
//   * THE DISSOLVE IS CONTROLLED, NOT OWNED. Vue hands the two generations to
//     `HkCrossfade`, whose `<Transition>` engine owns the leaving copy. The
//     Rust `Crossfade` is a CONTROLLED component (no transition hooks in
//     tairitsu), so this mirror forwards `phase` / `previous` / `previous_key`
//     to it: at the [`CrossfadePhase::Idle`] default exactly one generation is
//     mounted, and a host that wants the dissolve passes the frozen outgoing
//     generation and drives the phase. Nothing else in the swap changes.
//   * THE SCOPED SLOT BECOMES A PLAIN ELEMENT. Vue's default slot receives
//     `{ rail }`; a tairitsu slot is an `Element`, not a render function, so
//     the mirror renders `children` as given: the host branches on its own
//     `rail` prop, which it already owns (it is the same value that selects the
//     generation). Consequence: the LEAVING generation cannot be re-invoked
//     with an old parameter — but since the mirror's generations are host-drawn
//     elements, the host keeps the frozen one exactly like Vue freezes the
//     leaving item.
//   * `data-rail` is presence-with-payload (`{props.rail || undefined}` → Vue
//     serialises the truthy boolean as `data-rail="true"`; a data attribute has
//     no boolean form). The full-width generation has NO attribute at all, so a
//     host's `[data-rail]` density dress can never leak into it. Vue puts it on
//     the GENERATION (never the host root) for exactly that reason, and this
//     mirror keeps it there.
//   * An EMPTY width prop renders no inline width at all (Vue would emit an
//     empty `style=""` declaration). The defaults are `56px` / `280px`, i.e.
//     the host's collapsed/full tokens.
//   * `swapKey` is the state string (`"rail"` / `"full"`), Vue's
//     `props.rail ? "rail" : "full"` — the crossfade's identity for the two
//     generations.

use crate::display::{Crossfade, CrossfadePhase, CrossfadeProps};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SidebarRailSwapComponent;

/// The swap host's class (rides HkCrossfade's root through its `class` prop,
/// exactly Vue's fallthrough).
pub const RAIL_SWAP_CLASS: &str = "hk-sidebar-rail-swap";

/// One generation's class.
pub const RAIL_SWAP_GENERATION_CLASS: &str = "hk-sidebar-rail-generation";

/// The class of the wrapper this swap MUST be a direct child of (the sheet's
/// `>` combinator hangs off it).
pub const RAIL_SWAP_CLIP_CLASS: &str = "hk-sidebar-rail-clip";

/// The rail generation's default width — Vue's `railWidth` default (HkSidebar's
/// `collapsedWidth`, the shell's `sidebarCollapsedWidth`).
pub const RAIL_SWAP_DEFAULT_RAIL_WIDTH: &str = "56px";

/// The expanded generation's default width — Vue's `expandedWidth` default.
pub const RAIL_SWAP_DEFAULT_EXPANDED_WIDTH: &str = "280px";

/// Vue: `swapKey={props.rail ? "rail" : "full"}` — the crossfade's generation
/// identity.
pub fn rail_swap_swap_key(rail: bool) -> &'static str {
    if rail { "rail" } else { "full" }
}

/// The generation's `data-rail`: Vue's `{props.rail || undefined}` — the rail
/// generation carries `data-rail="true"` (a data attribute keeps the boolean's
/// string form), the full one carries no attribute at all.
pub fn rail_swap_data_rail(rail: bool) -> Option<&'static str> {
    rail.then_some("true")
}

/// The width the ACTIVE generation is pinned at: `railWidth` while `rail`,
/// `expandedWidth` otherwise. `None` for an empty value — no inline width
/// rather than a broken `width:` declaration.
pub fn rail_swap_generation_width(
    rail: bool,
    rail_width: &str,
    expanded_width: &str,
) -> Option<String> {
    let width = if rail { rail_width } else { expanded_width };
    if width.is_empty() {
        None
    } else {
        Some(width.to_string())
    }
}

/// [`rail_swap_generation_width`] as the inline declaration Vue writes
/// (`style={{ width: … }}` → `"width:56px"`).
pub fn rail_swap_generation_style(
    rail: bool,
    rail_width: &str,
    expanded_width: &str,
) -> Option<String> {
    rail_swap_generation_width(rail, rail_width, expanded_width)
        .map(|width| format!("width:{width}"))
}

#[define_props]
pub struct SidebarRailSwapProps {
    /// Which generation is active: true = the icon rail (the collapsed
    /// density), false = the full sidebar (including a peek). Vue default
    /// false.
    #[default]
    pub rail: bool,

    /// Pinned width of the RAIL generation (Vue: `railWidth`, default `56px`).
    #[default("56px".to_string())]
    pub rail_width: String,

    /// Pinned width of the EXPANDED generation (Vue: `expandedWidth`, default
    /// `280px`) — a CSS length or a `var()` reference.
    #[default("280px".to_string())]
    pub expanded_width: String,

    /// The controlled crossfade phase (see the header delta): `Idle` renders
    /// the settled single-generation state.
    #[default]
    pub phase: CrossfadePhase,

    /// Key of the generation the host is still holding for the dissolve
    /// (Vue: the leaving item's key, owned by `<Transition>`).
    pub previous_key: Option<String>,

    /// The frozen outgoing generation (Vue: `<Transition>`'s retained vnode).
    pub previous: Option<Element>,

    /// The generation's content (Vue: the default slot; see the header delta
    /// about the scoped `{ rail }` parameter).
    pub children: Element,

    /// Fallthrough host class, appended after `hk-sidebar-rail-swap` (Vue's
    /// attr merge onto HkCrossfade's root).
    #[default]
    pub class: String,
}

#[component]
pub fn SidebarRailSwap(props: SidebarRailSwapProps) -> Element {
    let rail = props.rail;

    let mut swap_classes = RAIL_SWAP_CLASS.to_string();
    if !props.class.is_empty() {
        swap_classes.push(' ');
        swap_classes.push_str(&props.class);
    }

    let mut generation = VElement::new("div").class(RAIL_SWAP_GENERATION_CLASS);
    if let Some(flag) = rail_swap_data_rail(rail) {
        generation = generation.attr("data-rail", flag);
    }
    if let Some(style) = rail_swap_generation_style(rail, &props.rail_width, &props.expanded_width)
    {
        generation = generation.style(style);
    }
    generation = generation.child(props.children.clone());

    // The swap host is HkCrossfade's root: `tag="div"` (Vue's explicit tag) and
    // the family class through the `class` prop, so the sheet's
    // `.hk-sidebar-rail-clip > .hk-sidebar-rail-swap` rule matches.
    Crossfade(CrossfadeProps {
        swap_key: rail_swap_swap_key(rail).to_string(),
        previous_key: props.previous_key.clone(),
        previous: props.previous.clone(),
        phase: props.phase,
        tag: "div".to_string(),
        class: swap_classes,
        children: VNode::Element(Box::new(generation)),
        ..Default::default()
    })
}

impl StyledComponent for SidebarRailSwapComponent {
    fn styles() -> &'static str {
        // Vue ships no sheet for THIS component: the swap's own geometry lives
        // in the vendored HkSidebarRail.scss (the rail family's shared chrome
        // table) and the dissolve classes in HkCrossfade.scss. An empty table,
        // not an error.
        ""
    }

    fn name() -> &'static str {
        "sidebar-rail-swap"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sidebar_rail_swap_defaults_match_the_vue_props() {
        let props = SidebarRailSwapProps::default();
        // Vue: `rail: { type: Boolean, default: false }`.
        assert!(!props.rail);
        // Vue: `railWidth: { type: String, default: "56px" }`.
        assert_eq!(props.rail_width, RAIL_SWAP_DEFAULT_RAIL_WIDTH);
        // Vue: `expandedWidth: { type: String, default: "280px" }`.
        assert_eq!(props.expanded_width, RAIL_SWAP_DEFAULT_EXPANDED_WIDTH);
        // The settled state has no dissolve in flight.
        assert_eq!(props.phase, CrossfadePhase::Idle);
        assert!(props.previous_key.is_none());
        assert!(props.previous.is_none());
        assert_eq!(props.class, "");
    }

    #[test]
    fn sidebar_rail_swap_widths_pin_each_generation() {
        // Rail generation → the rail token; expanded → the full token.
        assert_eq!(
            rail_swap_generation_width(true, "56px", "280px"),
            Some("56px".to_string())
        );
        assert_eq!(
            rail_swap_generation_width(false, "56px", "280px"),
            Some("280px".to_string())
        );
        // The widths are opaque strings — a `var()` reference passes through.
        assert_eq!(
            rail_swap_generation_width(true, "var(--rail-w)", "280px"),
            Some("var(--rail-w)".to_string())
        );
        // An empty value pins nothing (no broken `width:` declaration).
        assert_eq!(rail_swap_generation_width(true, "", "280px"), None);
        assert_eq!(rail_swap_generation_width(false, "56px", ""), None);
        // The inline declaration is Vue's `style={{ width }}`.
        assert_eq!(
            rail_swap_generation_style(true, "56px", "280px"),
            Some("width:56px".to_string())
        );
        assert_eq!(
            rail_swap_generation_style(false, "56px", "280px"),
            Some("width:280px".to_string())
        );
        // An empty width produces no declaration at all.
        assert_eq!(rail_swap_generation_style(true, "", "280px"), None);
    }

    #[test]
    fn sidebar_rail_swap_keys_and_density_markers_follow_the_state() {
        // Vue: `swapKey={props.rail ? "rail" : "full"}`.
        assert_eq!(rail_swap_swap_key(true), "rail");
        assert_eq!(rail_swap_swap_key(false), "full");
        // `data-rail={props.rail || undefined}` — the rail generation only.
        assert_eq!(rail_swap_data_rail(true), Some("true"));
        assert_eq!(rail_swap_data_rail(false), None);
        // The three class hooks belong to the vendored rail chrome sheet.
        assert_eq!(RAIL_SWAP_CLASS, "hk-sidebar-rail-swap");
        assert_eq!(RAIL_SWAP_GENERATION_CLASS, "hk-sidebar-rail-generation");
        assert_eq!(RAIL_SWAP_CLIP_CLASS, "hk-sidebar-rail-clip");
    }

    #[test]
    fn sidebar_rail_swap_renders_the_vue_swap_around_the_rail_generation() {
        let html = SidebarRailSwap(SidebarRailSwapProps {
            rail: true,
            previous_key: None,
            children: rsx! {
                span { "RAIL" }
            },
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            // The crossfade host carries both classes …
            r#"class="hk-crossfade hk-sidebar-rail-swap""#,
            // … and the generation is its item.
            r#"class="hk-crossfade-item""#,
            r#"data-crossfade-key="rail""#,
            r#"class="hk-sidebar-rail-generation""#,
            r#"data-rail="true""#,
            // The width is pinned inline, exactly Vue's `style={{ width }}`.
            "width:56px",
            "RAIL",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The swap renders in place (no wrapper element around the crossfade).
        assert!(html.starts_with("<div"), "{html}");
    }

    #[test]
    fn sidebar_rail_swap_full_generation_drops_the_density_marker() {
        let html = SidebarRailSwap(SidebarRailSwapProps {
            rail: false,
            rail_width: "56px".to_string(),
            expanded_width: "240px".to_string(),
            children: rsx! {
                span { "FULL" }
            },
            ..Default::default()
        })
        .render_to_html();

        assert!(!html.contains("data-rail"), "{html}");
        for needle in [r#"data-crossfade-key="full""#, "width:240px", "FULL"] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // The rail width never leaks into the full generation.
        assert!(!html.contains("width:56px"), "{html}");
    }

    #[test]
    fn sidebar_rail_swap_styles_come_from_the_vendored_rail_chrome() {
        // No sheet of its own: HkSidebarRail.scss carries the swap/generation
        // geometry (as the rail family's shared table) and HkCrossfade.scss the
        // dissolve.
        let css = SidebarRailSwapComponent::styles();
        assert_eq!(css, "");
        assert_eq!(SidebarRailSwapComponent::name(), "sidebar-rail-swap");
    }
}
