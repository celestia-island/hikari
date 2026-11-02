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
//     row `components/HkSidebarRail.scss`). No component in this crate owns
//     that sheet, so it reaches BOTH bundles as chrome:
//     `StyleRegistry::register_vue_chrome` registers it (`vue-sidebar-rail`)
//     and `src/styles/index.scss` imports it for the builder bundle. Verified
//     class by class — both classes this file emits from that family are
//     DEFINED there:
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
// THE RAIL FLIP'S ICON FLIGHT (`useRailIconFlight`) — DECLARED, NOT SHIPPED.
// A pure dissolve hides the small horizontal journey every rail icon actually
// makes (the expanded row puts the glyph on its leading padding, the rail
// centres it in the 56px column), so Vue adds a flight layer on THIS host: on
// a density flip it pairs icons opted in by `data-flip-icon="<row key>"`
// across the two generations (identified semantically through the crossfade
// items' `data-crossfade-key`), clones each pair into
// `div.hk-sidebar-rail-flight`, animates the clone from the leaving rect to
// the entering one (WAAPI), hides both ends (`data-flipping` on this host +
// `data-flip-flying` on each substituted cell — the single-glyph contract),
// and sweeps the layer when the token-derived window ends.
//
// The mirror ships the SKELETON only, on purpose:
//   * the sheet side is already vendored — `HkSidebarRail.scss` carries the
//     flight layer, the clone box and the single-glyph hide rule, so a host
//     that runs the choreography itself gets Vue's exact paint;
//   * the attribute vocabulary and the TIMING MATH are exported below
//     ([`RAIL_FLIP_ICON_ATTR`], [`RAIL_FLIP_ACTIVE_ATTR`],
//     [`RAIL_FLIP_FLYING_ATTR`], [`RAIL_FLIP_ITEM_ATTR`],
//     [`rail_flight_css_duration_ms`], [`rail_flight_window_ms`],
//     [`rail_flight_sweep_ms`]) — all pure, all pinned to Vue's constants;
//   * the FLIGHT ITSELF IS NOT REPRODUCIBLE HERE, and the reason is the
//     TARGET: the shipped `wasm32-wasip2` artifact has no DOM and no renderer
//     at all — `platform/mod.rs` selects the inert stub for every non
//     `wasm32-unknown-unknown` build, so there is nothing to measure, clone or
//     animate. Two operations the choreography needs are additionally absent
//     from the crate on EVERY target: `Node.cloneNode` (no wrapper exists)
//     and WAAPI's `Element.animate`. That is why the mirror does not ship a
//     "flight" built from static guesses — it would show TWO glyphs of one
//     destination in different places, exactly the double-exposure the
//     single-glyph contract exists to prevent. The dissolve stays the
//     handoff here, and the flight is declared missing.
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

// ── the rail flip's icon flight contract (see the header) ────────────────

/// Row-key attribute that opts an icon cell into the flight
/// (Vue: `RAIL_FLIP_ICON_ATTR`). Vue's `HkMenu` stamps it on every menu icon
/// cell in BOTH densities; the value is the row key, which is what pairs the
/// leaving and entering copies of one destination.
pub const RAIL_FLIP_ICON_ATTR: &str = "data-flip-icon";

/// Host attribute marking a flight in progress (Vue:
/// `RAIL_FLIP_ACTIVE_ATTR`). The sheet's single-glyph hide rule hangs off it:
/// `.hk-sidebar-rail-swap[data-flipping] .hk-menu-item-icon[data-flip-flying]`.
pub const RAIL_FLIP_ACTIVE_ATTR: &str = "data-flipping";

/// Per-cell mark stamped on exactly the cells a flight substituted — BOTH ends
/// of every matched pair (Vue: `RAIL_FLIP_FLYING_ATTR`). The hide rule keys on
/// THIS, never on the opt-in attribute: an opted-in cell without a partner
/// (a rail fallback letter with no expanded counterpart) must dissolve, not
/// vanish without a substitute.
pub const RAIL_FLIP_FLYING_ATTR: &str = "data-flip-flying";

/// The crossfade's per-item identity — the semantic pairing anchor (Vue:
/// `RAIL_FLIP_ITEM_ATTR`). The mirrored `Crossfade` emits it as
/// `data-crossfade-key="rail"|"full"`, so it is already in this file's DOM.
pub const RAIL_FLIP_ITEM_ATTR: &str = "data-crossfade-key";

/// Flight-window FALLBACK for when the theme's `--duration-normal` yields no
/// parsable time (Vue: `RAIL_FLIGHT_MS`). A real browser reads the token, so
/// this only covers environments that resolve no custom properties.
pub const RAIL_FLIGHT_FALLBACK_MS: f64 = 300.0;

/// Sweep margin on top of the derived flight window: above any healthy
/// completion, so a stalled clone can never linger (Vue:
/// `RAIL_FLIGHT_SWEEP_MARGIN_MS`).
pub const RAIL_FLIGHT_SWEEP_MARGIN_MS: f64 = 300.0;

/// Parse a CSS time custom property (`"120ms"`, `"0.15s"`, `""`) into
/// milliseconds — Vue's `cssDurationMs`.
///
/// Anything unparsable or non-positive is `0` (the caller decides what 0
/// means: no hold, or the fallback window). Units are case-insensitive in CSS
/// (`"0.3S"` is legal), and the seconds test must NOT match `ms` — Vue
/// lowercases first and excludes the `ms` suffix for exactly that reason.
pub fn rail_flight_css_duration_ms(value: &str) -> f64 {
    let Some(number) = js_parse_float(value) else {
        return 0.0;
    };
    if !number.is_finite() || number <= 0.0 {
        return 0.0;
    }
    let unit = value.trim().to_lowercase();
    if unit.ends_with('s') && !unit.ends_with("ms") {
        number * 1000.0
    } else {
        number
    }
}

/// The flight window in ms: the theme's dissolve duration (falling back to
/// [`RAIL_FLIGHT_FALLBACK_MS`]) plus any enter hold the host choreographed
/// (`--hk-crossfade-enter-delay`). Both ends of the window therefore align with
/// the entering fade without a hard-coded mirror of the theme's number.
pub fn rail_flight_window_ms(dissolve: &str, enter_delay: &str) -> f64 {
    let dissolve_ms = {
        let parsed = rail_flight_css_duration_ms(dissolve);
        if parsed > 0.0 {
            parsed
        } else {
            RAIL_FLIGHT_FALLBACK_MS
        }
    };
    dissolve_ms + rail_flight_css_duration_ms(enter_delay)
}

/// The sweep budget: the flight window plus [`RAIL_FLIGHT_SWEEP_MARGIN_MS`].
pub fn rail_flight_sweep_ms(dissolve: &str, enter_delay: &str) -> f64 {
    rail_flight_window_ms(dissolve, enter_delay) + RAIL_FLIGHT_SWEEP_MARGIN_MS
}

/// `parseFloat`'s leading-number rule, for the subset a CSS time can contain:
/// optional sign, decimal digits with at most one point, and an optional
/// `e`/`E` exponent. Leading whitespace is skipped; trailing garbage is
/// ignored (`"120ms"` → 120). Returns `None` where `parseFloat` would return
/// `NaN`; `Infinity` and hex literals are deliberately not accepted (no CSS
/// duration is written that way).
fn js_parse_float(value: &str) -> Option<f64> {
    let trimmed = value.trim_start();
    let bytes = trimmed.as_bytes();
    let mut end = 0usize;
    if matches!(bytes.first(), Some(b'+') | Some(b'-')) {
        end = 1;
    }
    let mut digits = 0usize;
    while end < bytes.len() && bytes[end].is_ascii_digit() {
        end += 1;
        digits += 1;
    }
    if end < bytes.len() && bytes[end] == b'.' {
        end += 1;
        while end < bytes.len() && bytes[end].is_ascii_digit() {
            end += 1;
            digits += 1;
        }
    }
    if digits == 0 {
        return None;
    }
    if end < bytes.len() && (bytes[end] == b'e' || bytes[end] == b'E') {
        let mut probe = end + 1;
        if probe < bytes.len() && (bytes[probe] == b'+' || bytes[probe] == b'-') {
            probe += 1;
        }
        let mut exponent_digits = 0usize;
        while probe < bytes.len() && bytes[probe].is_ascii_digit() {
            probe += 1;
            exponent_digits += 1;
        }
        if exponent_digits > 0 {
            end = probe;
        }
    }
    trimmed[..end].parse::<f64>().ok()
}

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
    fn rail_flight_css_duration_matches_the_vue_parser() {
        // Vue's own `cssDurationMs` cases (useRailIconFlight.test.ts).
        assert_eq!(rail_flight_css_duration_ms(""), 0.0);
        assert_eq!(rail_flight_css_duration_ms("0ms"), 0.0);
        assert_eq!(rail_flight_css_duration_ms("150ms"), 150.0);
        assert_eq!(rail_flight_css_duration_ms("0.2s"), 200.0);
        assert_eq!(rail_flight_css_duration_ms("300ms"), 300.0);
        // CSS units are case-insensitive — an uppercase S is still seconds.
        assert_eq!(rail_flight_css_duration_ms("0.3S"), 300.0);
        // ... while `MS` must not be mistaken for seconds.
        assert_eq!(rail_flight_css_duration_ms("150MS"), 150.0);
        assert_eq!(rail_flight_css_duration_ms("garbage"), 0.0);
        // Non-positive and non-finite values mean "no hold".
        assert_eq!(rail_flight_css_duration_ms("-5ms"), 0.0);
        assert_eq!(rail_flight_css_duration_ms("0s"), 0.0);
        assert_eq!(rail_flight_css_duration_ms("calc(1s)"), 0.0);
        // Leading whitespace is skipped, like parseFloat.
        assert_eq!(rail_flight_css_duration_ms("  120ms"), 120.0);
    }

    #[test]
    fn rail_flight_window_is_token_derived_with_the_vue_fallback() {
        // No theme value → the documented fallback window, plus the margin.
        assert_eq!(rail_flight_window_ms("", ""), RAIL_FLIGHT_FALLBACK_MS);
        assert_eq!(
            rail_flight_sweep_ms("", ""),
            RAIL_FLIGHT_FALLBACK_MS + RAIL_FLIGHT_SWEEP_MARGIN_MS
        );
        // A retuned theme retunes the flight with it (the dissolve reads the
        // same token; the test DOM resolves none, hence the fallback above).
        assert_eq!(rail_flight_window_ms("600ms", ""), 600.0);
        assert_eq!(rail_flight_window_ms("0.6s", ""), 600.0);
        // The entering-fade hold widens the window (and the sweep).
        assert_eq!(rail_flight_window_ms("300ms", "120ms"), 420.0);
        assert_eq!(rail_flight_sweep_ms("300ms", "120ms"), 720.0);
    }

    #[test]
    fn rail_flight_attribute_vocabulary_matches_the_composable() {
        // The three marks and the pairing anchor, verbatim — the vendored
        // sheet's single-glyph rule spells two of them.
        assert_eq!(RAIL_FLIP_ICON_ATTR, "data-flip-icon");
        assert_eq!(RAIL_FLIP_ACTIVE_ATTR, "data-flipping");
        assert_eq!(RAIL_FLIP_FLYING_ATTR, "data-flip-flying");
        assert_eq!(RAIL_FLIP_ITEM_ATTR, "data-crossfade-key");
        assert_eq!(RAIL_FLIGHT_FALLBACK_MS, 300.0);
        assert_eq!(RAIL_FLIGHT_SWEEP_MARGIN_MS, 300.0);
        // The pairing anchor is the one the mirrored Crossfade already emits.
        assert!(
            SidebarRailSwap(SidebarRailSwapProps {
                rail: true,
                ..Default::default()
            })
            .render_to_html()
            .contains(RAIL_FLIP_ITEM_ATTR),
            "the swap's generations carry the flight's pairing anchor"
        );
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
