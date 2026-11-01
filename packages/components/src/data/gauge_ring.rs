// hi-components/src/data/gauge_ring.rs
// GaugeRing — mirror of the canonical Vue `HkGaugeRing`: one or more
// concentric percentage rings with an optional centered read-out.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkGaugeRing.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-gauge-ring*` class names are literal and identical in both forms.
// Every radius/circumference/sweep is computed by the pure
// [`gauge_ring_arcs`] (the mirror of the component's `rings` computed), which
// is pinned by the tests below — the render layer only concatenates strings.
//
// DOM contract (mirrors Vue one-to-one):
//
//   div.hk-gauge-ring  style: width/height px
//     div[style="display:contents"][dangerous_inner_html=<svg …>]
//       <svg width height viewBox="0 0 {size} {size}"
//            style="transform:rotate(-90deg)">
//         <g>                                   (one per ring, outermost first)
//           <circle class-less track>           stroke=track_color
//           <circle class-less progress>        dasharray/dashoffset + style
//         </g>
//     div.hk-gauge-ring-center?                 (center_value or center_label)
//       div.hk-gauge-ring-value   {center_value}
//       div.hk-gauge-ring-label   {center_label}
//
// Ring colors ride INLINE `style` declarations (not just the `stroke`
// presentation attribute) exactly like Vue: a `var()` reference inside a
// presentation attribute is not substituted on every engine (Firefox drops
// the whole declaration → `stroke: none` → an invisible ring; svgwg#1031).
//
// The SVG subtree is authored as MARKUP and mounted through
// `dangerous_inner_html` on its OWN `display:contents` host: rsx `svg {}` maps
// to `createElement` in this host stack (HTML namespace) and inner_html
// suppresses an element's children (ledger L49) — the same shape
// `feedback/progress_ring.rs` uses. Markup bypasses tairitsu's escaper, so
// caller-supplied colors are escaped here ([`escape_markup`]).
//
// Deltas vs Vue (documented):
//   * The mount ramp is NOT mirrored. Vue renders `progress = 0` and flips it
//     to 1 on the next frame (`onceFrame` + the animation bus), which needs a
//     reactive cell; the Rust form forbids `use_signal`/`use_state`. The arc
//     ramp factor is a parameter of [`gauge_ring_arcs`] (so the 0 → 1 sweep is
//     unit-tested), and the render layer always passes the settled 1.0. The
//     inline 0.8s `stroke-dashoffset` transition stays, so a host that
//     re-renders with a new `pct` still animates; `prefers-reduced-motion` is
//     handled by the mirrored sheet.
//   * `rings` is `Option<Vec<GaugeRingData>>` instead of Vue's required array:
//     `None` takes the single-ring convenience (`pct` / `color` /
//     `track_color`, added for the mirrored `data/stat_card.rs` usage), while
//     `Some(vec![])` reproduces Vue's "render no ring at all".
//   * `pct` is clamped at the top only (`Math.min(pct, 100)`), negatives pass
//     through — exactly Vue's behavior, kept rather than "fixed".
//   * Host attribute fallthrough (`class` / `style` on `<HkGaugeRing>`) is not
//     mirrored.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct GaugeRingComponent;

pub const GAUGE_RING_SIZE: f64 = 140.0;
pub const GAUGE_RING_STROKE_WIDTH: f64 = 8.0;
pub const GAUGE_RING_GAP: f64 = 6.0;
/// Vue's `Math.max(r, 1)` floor on the innermost radius.
pub const GAUGE_RING_MIN_RADIUS: f64 = 1.0;
/// The settled ramp factor — Vue's `progress` after the mount frame.
pub const GAUGE_RING_FINAL_PROGRESS: f64 = 1.0;
/// Vue's inline per-ring sweep (RING_ANIM_MS = 800).
pub const GAUGE_RING_TRANSITION: &str = "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)";
/// Fallbacks for the single-ring convenience (both are theme-token strings,
/// so a scheme flip still repaints: `rgb()` takes the channel tokens).
pub const GAUGE_RING_PROGRESS_FALLBACK: &str = "rgb(var(--color-primary))";
pub const GAUGE_RING_TRACK_FALLBACK: &str = "rgb(var(--color-text) / 8%)";

/// One ring as the caller passes it in (Vue: `RingData`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct GaugeRingData {
    /// Drawn share of the ring, 0–100 (values above 100 clamp).
    pub pct: f64,
    pub color: String,
    pub track_color: String,
}

/// One computed ring (Vue's `rings` computed entry).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct GaugeRingArc {
    pub radius: f64,
    pub circumference: f64,
    pub dash_offset: f64,
    pub color: String,
    pub track_color: String,
    pub stroke_width: f64,
}

/// Rings → per-ring SVG geometry. Pure: same rings + same size/stroke/gap +
/// same ramp factor → the same arcs.
///
/// The radius walk is Vue's: start at `(size - strokeWidth) / 2`, floor every
/// radius at 1, then step inward by `strokeWidth + gap` and stop once the next
/// radius would drop below `strokeWidth / 2` (so the ring count depends on the
/// frame, not on how many rings the caller passed).
pub fn gauge_ring_arcs(
    rings: &[GaugeRingData],
    size: f64,
    stroke_width: f64,
    gap: f64,
    progress: f64,
) -> Vec<GaugeRingArc> {
    let mut radius_cursor = (size - stroke_width) / 2.0;
    let mut arcs = Vec::with_capacity(rings.len());
    for ring in rings {
        let radius = radius_cursor.max(GAUGE_RING_MIN_RADIUS);
        let circumference = 2.0 * std::f64::consts::PI * radius;
        let pct = if ring.pct > 100.0 { 100.0 } else { ring.pct };
        arcs.push(GaugeRingArc {
            radius,
            circumference,
            dash_offset: circumference * (1.0 - (pct / 100.0) * progress),
            color: ring.color.clone(),
            track_color: ring.track_color.clone(),
            stroke_width,
        });
        radius_cursor -= stroke_width + gap;
        if radius_cursor < stroke_width / 2.0 {
            break;
        }
    }
    arcs
}

/// The ring list the render layer walks: the caller's `rings` when present,
/// else the single-ring convenience resolved from
/// `pct` / `color` / `track_color` (empty strings take the token fallbacks).
pub fn gauge_ring_resolved(
    rings: Option<&[GaugeRingData]>,
    pct: f64,
    color: &str,
    track_color: &str,
) -> Vec<GaugeRingData> {
    match rings {
        Some(rings) => rings.to_vec(),
        None => vec![GaugeRingData {
            pct,
            color: if color.is_empty() {
                GAUGE_RING_PROGRESS_FALLBACK.to_string()
            } else {
                color.to_string()
            },
            track_color: if track_color.is_empty() {
                GAUGE_RING_TRACK_FALLBACK.to_string()
            } else {
                track_color.to_string()
            },
        }],
    }
}

/// Escape a caller string for a quoted SVG attribute.
/// `dangerous_inner_html` bypasses tairitsu's escaper, so the mirror owns it.
fn escape_markup(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(ch),
        }
    }
    out
}

/// The ring SVG exactly as Vue renders it: a track + progress circle pair per
/// ring, the whole plane rotated so 0% starts at 12 o'clock.
fn gauge_ring_svg(arcs: &[GaugeRingArc], size: f64, animate: bool) -> String {
    let mut svg = String::new();
    let center = size / 2.0;
    svg.push_str(&format!(
        r#"<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" style="transform:rotate(-90deg)">"#
    ));
    let transition = if animate {
        GAUGE_RING_TRANSITION
    } else {
        "none"
    };
    for arc in arcs {
        let color = escape_markup(&arc.color);
        let track_color = escape_markup(&arc.track_color);
        svg.push_str("<g>");
        svg.push_str(&format!(
            r#"<circle cx="{center}" cy="{center}" r="{}" fill="none" stroke="{track_color}" style="stroke:{track_color}" stroke-width="{}"/>"#,
            arc.radius, arc.stroke_width,
        ));
        svg.push_str(&format!(
            r#"<circle cx="{center}" cy="{center}" r="{}" fill="none" stroke="{color}" stroke-width="{}" stroke-linecap="round" stroke-dasharray="{}" stroke-dashoffset="{}" style="stroke:{color};transition:{transition}"/>"#,
            arc.radius, arc.stroke_width, arc.circumference, arc.dash_offset,
        ));
        svg.push_str("</g>");
    }
    svg.push_str("</svg>");
    svg
}

#[define_props]
pub struct GaugeRingProps {
    /// The rings, outermost first (Vue: `rings`, required there). `None` takes
    /// the single-ring convenience below; `Some(vec![])` renders no ring.
    pub rings: Option<Vec<GaugeRingData>>,

    /// Outer diameter in px (Vue default 140).
    #[default(GAUGE_RING_SIZE)]
    pub size: f64,

    /// Stroke width in px (Vue default 8).
    #[default(GAUGE_RING_STROKE_WIDTH)]
    pub stroke_width: f64,

    /// Radial gap between rings in px (Vue default 6).
    #[default(GAUGE_RING_GAP)]
    pub gap: f64,

    /// The read-out's caption (Vue: `centerLabel`, default empty).
    #[default]
    pub center_label: String,

    /// The read-out's headline (Vue: `centerValue`, default empty).
    pub center_value: Option<String>,

    /// Vue default true — see the header for the missing mount ramp.
    #[default(true)]
    pub animate: bool,

    /// Single-ring convenience: the drawn share when `rings` is `None`.
    #[default]
    pub pct: f64,

    /// Single-ring convenience: the progress ink when `rings` is `None`.
    #[default]
    pub color: String,

    /// Single-ring convenience: the track ink when `rings` is `None`.
    #[default]
    pub track_color: String,
}

#[component]
pub fn GaugeRing(props: GaugeRingProps) -> Element {
    let resolved = gauge_ring_resolved(
        props.rings.as_deref(),
        props.pct,
        &props.color,
        &props.track_color,
    );
    let arcs = gauge_ring_arcs(
        &resolved,
        props.size,
        props.stroke_width,
        props.gap,
        GAUGE_RING_FINAL_PROGRESS,
    );
    let svg = gauge_ring_svg(&arcs, props.size, props.animate);

    // Vue tests both center strings for truthiness; an empty string is absent.
    let center_value = props.center_value.clone().filter(|value| !value.is_empty());
    let center_label = if props.center_label.is_empty() {
        None
    } else {
        Some(props.center_label.clone())
    };

    // `dangerous_inner_html` suppresses children, so the SVG markup gets its
    // own `display:contents` host and the read-out stays a sibling (L49).
    let mut root = VElement::new("div")
        .class("hk-gauge-ring")
        .attr(
            "style",
            format!("width:{}px;height:{}px", props.size, props.size),
        )
        .child(VNode::Element(Box::new(
            VElement::new("div")
                .attr("style", "display:contents")
                .dangerous_inner_html(svg),
        )));

    if center_value.is_some() || center_label.is_some() {
        let mut center = VElement::new("div").class("hk-gauge-ring-center");
        if let Some(value) = center_value {
            center = center.child(VNode::Element(Box::new(
                VElement::new("div")
                    .class("hk-gauge-ring-value")
                    .child(VNode::Text(VText::new(&value))),
            )));
        }
        if let Some(label) = center_label {
            center = center.child(VNode::Element(Box::new(
                VElement::new("div")
                    .class("hk-gauge-ring-label")
                    .child(VNode::Text(VText::new(&label))),
            )));
        }
        root = root.child(VNode::Element(Box::new(center)));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for GaugeRingComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkGaugeRing.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "gauge-ring"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ring(pct: f64) -> GaugeRingData {
        GaugeRingData {
            pct,
            color: "rgb(var(--color-primary))".to_string(),
            track_color: "rgb(var(--color-text) / 8%)".to_string(),
        }
    }

    #[test]
    fn gauge_ring_arcs_walk_inward_by_the_stroke_plus_gap() {
        let rings: Vec<GaugeRingData> = (0..5).map(|_| ring(50.0)).collect();
        let arcs = gauge_ring_arcs(&rings, 140.0, 8.0, 6.0, 1.0);
        // (140 - 8) / 2 = 66, then 66 - 14 = 52, 38, 24, 10, and the next
        // (=-4) is below strokeWidth / 2 → the walk stops after five rings.
        let radii: Vec<f64> = arcs.iter().map(|arc| arc.radius).collect();
        assert_eq!(radii, vec![66.0, 52.0, 38.0, 24.0, 10.0]);
        assert_eq!(arcs[0].circumference, 2.0 * std::f64::consts::PI * 66.0);
        assert_eq!(arcs[0].stroke_width, 8.0);
        // A sixth ring never renders: the frame runs out first.
        let six: Vec<GaugeRingData> = (0..6).map(|_| ring(50.0)).collect();
        assert_eq!(gauge_ring_arcs(&six, 140.0, 8.0, 6.0, 1.0).len(), 5);
    }

    #[test]
    fn gauge_ring_arcs_map_pct_through_the_ramp_factor() {
        let one = [ring(50.0)];
        // Ramp 0 → the ring is empty (dash offset swallows the whole stroke).
        let closed = gauge_ring_arcs(&one, 140.0, 8.0, 6.0, 0.0);
        assert_eq!(closed[0].dash_offset, closed[0].circumference);
        // Settled 1 → half the ring is drawn.
        let settled = gauge_ring_arcs(&one, 140.0, 8.0, 6.0, 1.0);
        assert!((settled[0].dash_offset - settled[0].circumference * 0.5).abs() < 1e-9);
        // 100% → no offset left.
        let full = gauge_ring_arcs(&[ring(100.0)], 140.0, 8.0, 6.0, 1.0);
        assert_eq!(full[0].dash_offset, 0.0);
    }

    #[test]
    fn gauge_ring_arcs_clamp_the_top_only() {
        // Vue: `Math.min(ring.pct, 100)` — a value above 100 draws the full
        // ring, a negative one over-rotates the dash (no lower clamp).
        let over = gauge_ring_arcs(&[ring(150.0)], 140.0, 8.0, 6.0, 1.0);
        assert_eq!(over[0].dash_offset, 0.0);
        let negative = gauge_ring_arcs(&[ring(-20.0)], 140.0, 8.0, 6.0, 1.0);
        assert!(negative[0].dash_offset > negative[0].circumference);
    }

    #[test]
    fn gauge_ring_arcs_handle_degenerate_frames_and_empty_ring_lists() {
        assert!(gauge_ring_arcs(&[], 140.0, 8.0, 6.0, 1.0).is_empty());
        // size 10 / stroke 8 → (10 - 8) / 2 = 1 stays at the floor.
        let tiny = gauge_ring_arcs(&[ring(50.0), ring(50.0)], 10.0, 8.0, 6.0, 1.0);
        assert_eq!(tiny.len(), 1);
        assert_eq!(tiny[0].radius, GAUGE_RING_MIN_RADIUS);
        // A frame smaller than the stroke floors the radius instead of
        // producing a negative one.
        let inverted = gauge_ring_arcs(&[ring(50.0)], 4.0, 8.0, 6.0, 1.0);
        assert_eq!(inverted[0].radius, GAUGE_RING_MIN_RADIUS);
    }

    #[test]
    fn gauge_ring_resolved_prefers_rings_and_falls_back_to_the_tokens() {
        let explicit = gauge_ring_resolved(Some(&[ring(20.0)]), 90.0, "red", "gray");
        assert_eq!(explicit.len(), 1);
        assert_eq!(explicit[0].pct, 20.0);
        assert_eq!(explicit[0].color, "rgb(var(--color-primary))");

        // `Some(vec![])` is Vue's "no ring", not a synthesized one.
        assert!(gauge_ring_resolved(Some(&[]), 90.0, "red", "gray").is_empty());

        // The single-ring convenience: caller colors win, empties fall back.
        let single = gauge_ring_resolved(None, 42.0, "", "");
        assert_eq!(single.len(), 1);
        assert_eq!(single[0].pct, 42.0);
        assert_eq!(single[0].color, GAUGE_RING_PROGRESS_FALLBACK);
        assert_eq!(single[0].track_color, GAUGE_RING_TRACK_FALLBACK);
        let custom = gauge_ring_resolved(None, 1.0, "#123", "#456");
        assert_eq!(custom[0].color, "#123");
        assert_eq!(custom[0].track_color, "#456");
    }

    #[test]
    fn gauge_ring_defaults_match_the_vue_props() {
        let props = GaugeRingProps::default();
        assert!(props.rings.is_none());
        assert_eq!(props.size, 140.0);
        assert_eq!(props.stroke_width, 8.0);
        assert_eq!(props.gap, 6.0);
        assert_eq!(props.center_label, "");
        assert!(props.center_value.is_none());
        assert!(props.animate);
        assert_eq!(props.pct, 0.0);
        assert!(props.color.is_empty());
        assert!(props.track_color.is_empty());
    }

    #[test]
    fn gauge_ring_renders_track_plus_progress_with_the_center_readout() {
        let html = GaugeRing(GaugeRingProps {
            rings: Some(vec![ring(25.0), ring(75.0)]),
            center_value: Some("75%".to_string()),
            center_label: "CPU".to_string(),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="hk-gauge-ring""#,
            r#"style="width:140px;height:140px""#,
            r#"<div style="display:contents">"#,
            r#"<svg width="140" height="140" viewBox="0 0 140 140" style="transform:rotate(-90deg)">"#,
            r#"stroke-linecap="round""#,
            r#"stroke-dasharray=""#,
            r#"stroke-dashoffset=""#,
            // The inline stroke declarations Vue documents (var() in a
            // presentation attribute is not substituted everywhere); the
            // progress circle carries the sweep transition on the same
            // declaration.
            r#"style="stroke:rgb(var(--color-primary));transition:stroke-dashoffset 0.8s"#,
            r#"<div class="hk-gauge-ring-center">"#,
            r#"<div class="hk-gauge-ring-value">75%</div>"#,
            r#"<div class="hk-gauge-ring-label">CPU</div>"#,
        ] {
            assert!(html.contains(needle), "missing {needle} in {html}");
        }
        // Two rings → two `<g>` pairs → four circles.
        assert_eq!(html.matches("<circle ").count(), 4, "{html}");
        // The settled ramp carries the animated transition.
        assert!(html.contains(GAUGE_RING_TRANSITION), "{html}");
    }

    #[test]
    fn gauge_ring_omits_the_readout_and_the_transition_when_asked() {
        let html = GaugeRing(GaugeRingProps {
            pct: 40.0,
            animate: false,
            ..Default::default()
        })
        .render_to_html();
        // No center strings → no read-out node at all.
        assert!(!html.contains("hk-gauge-ring-center"), "{html}");
        // `animate: false` pins the transition off (Vue: `transition: none`).
        assert!(html.contains("transition:none"), "{html}");
        assert!(!html.contains(GAUGE_RING_TRANSITION), "{html}");
        // The single-ring convenience paints with the token fallbacks.
        assert!(
            html.contains(r#"style="stroke:rgb(var(--color-primary));transition:none""#),
            "{html}"
        );
        assert_eq!(html.matches("<circle ").count(), 2, "{html}");
    }

    #[test]
    fn gauge_ring_styles_come_from_the_canonical_vue_sheet() {
        let css = GaugeRingComponent::styles();
        assert!(
            css.contains(".hk-gauge-ring")
                && css.contains(".hk-gauge-ring-center")
                && css.contains(".hk-gauge-ring-value")
                && css.contains(".hk-gauge-ring-label"),
            "gauge css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored gauge sheet"
        );
    }
}
