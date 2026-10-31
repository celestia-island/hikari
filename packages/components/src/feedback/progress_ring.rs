// hi-components/src/feedback/progress_ring.rs
// ProgressRing — mirror of the canonical Vue `HkProgressRing`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkProgressRing.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-progress-ring*` class names are literal and identical in both forms.
// DOM contract (mirrors Vue one-to-one):
//
//   div.hk-progress-ring [.hk-progress-ring-success|exception]
//       role="progressbar" aria-valuenow/min/max  style: width/height px
//     svg.hk-progress-ring-svg viewBox="0 0 {size} {size}"
//       circle.hk-progress-ring-track        (show_track)
//       circle.hk-progress-ring-fill         (value mode: dasharray/dashoffset)
//       circle.hk-progress-ring-seg [+class] (segments mode, one per arc)
//     span.hk-progress-ring-label              (show_label and no `overlay`)
//     span.hk-progress-ring-overlay            (overlay slot)
//
// Segmented mode carves a PROGRESS_RING_SEG_GAP_PCT (1%) gap between
// consecutive arcs; the gap is only visible with butt caps (round caps
// swallow it at badge sizes). Segment color rides an inline `stroke` style
// (not a presentation attribute) so CSS variables resolve — same as Vue.
//
// Replaces the retired legacy `Progress` circle variant (`hk-progress-circle*`).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct ProgressRingComponent;

/// Visual gap carved between consecutive segments, in percent of the full
/// ring (Vue: `PROGRESS_RING_SEG_GAP_PCT = 1`).
pub const PROGRESS_RING_SEG_GAP_PCT: f64 = 1.0;

/// Fill ink flavor (`"normal" | "success" | "exception"`, default normal).
/// Ignored in segments mode.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum ProgressRingVariant {
    #[default]
    Normal,
    Success,
    Exception,
}

impl ProgressRingVariant {
    pub fn class_name(self) -> &'static str {
        match self {
            ProgressRingVariant::Normal => "",
            ProgressRingVariant::Success => "hk-progress-ring-success",
            ProgressRingVariant::Exception => "hk-progress-ring-exception",
        }
    }
}

/// One arc of a segmented progress ring (Vue: `HProgressRingSegment`).
/// Values are percentages of the full ring, laid head-to-tail.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ProgressRingSegment {
    pub value: f64,
    /// Any CSS color; applied as an inline `stroke` style so variables
    /// resolve. `None` falls back to the theme default stroke.
    pub color: Option<String>,
    /// Extra class appended to this segment's circle.
    pub class: String,
}

/// One computed arc: `start` is the cumulative share of the previous
/// segments (percent along the ring), `len` the drawn length in percent
/// (the share minus the carved gap when another segment follows).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct ProgressRingArc {
    pub start: f64,
    pub len: f64,
    pub color: Option<String>,
    pub class: String,
}

/// Build the arcs exactly as the Vue component does: drop empty/zero
/// segments, clamp each share to what remains up to 100%, carve the 1% gap
/// before every arc that is followed by another one, and skip arcs whose
/// drawn length collapses to zero.
pub fn progress_ring_arcs(segments: &[ProgressRingSegment]) -> Vec<ProgressRingArc> {
    let visible: Vec<&ProgressRingSegment> = segments.iter().filter(|s| s.value > 0.0).collect();
    let mut out = Vec::new();
    let mut cursor = 0.0f64;
    for (i, seg) in visible.iter().enumerate() {
        if cursor >= 100.0 {
            break;
        }
        let share = seg.value.min(100.0 - cursor).max(0.0);
        let gap = if i + 1 < visible.len() {
            PROGRESS_RING_SEG_GAP_PCT
        } else {
            0.0
        };
        let len = (share - gap).max(0.0);
        if len > 0.0 {
            out.push(ProgressRingArc {
                start: cursor,
                len,
                color: seg.color.clone(),
                class: seg.class.clone(),
            });
        }
        cursor += share;
    }
    out
}

/// The segments-mode aria total (Vue: `segmentsTotal`) — rounded to one
/// decimal, clamped to 100.
pub fn progress_ring_segments_total(segments: &[ProgressRingSegment]) -> f64 {
    let sum: f64 = segments.iter().map(|s| s.value.max(0.0)).sum();
    (sum.min(100.0) * 10.0).round() / 10.0
}

#[define_props]
pub struct ProgressRingProps {
    /// Ring value 0-100 (Vue default 0).
    #[default]
    pub value: f64,

    /// Explicit percentage override (Vue: `pct` wins over `value`).
    pub pct: Option<f64>,

    /// Outer ring diameter in px (default 120).
    #[default(120.0)]
    pub size: f64,

    /// Stroke width in px (default 8).
    #[default(8.0)]
    pub stroke_width: f64,

    /// Fill ink flavor.
    #[default]
    pub variant: ProgressRingVariant,

    /// Render the centered percentage label (suppressed when `overlay` is
    /// present, like Vue's default-slot check).
    #[default]
    pub show_label: bool,

    /// Render the background track circle (false for overlay-only use).
    #[default(true)]
    pub show_track: bool,

    /// Segmented mode: when `Some` (an empty vec included) each segment is
    /// its own arc; `value`/`pct`/`variant` are ignored.
    pub segments: Option<Vec<ProgressRingSegment>>,

    /// Centered overlay content (Vue: the default slot).
    pub overlay: Option<Element>,
}

#[component]
pub fn ProgressRing(props: ProgressRingProps) -> Element {
    let clamped_value = props.pct.unwrap_or(props.value).clamp(0.0, 100.0);
    let radius = (props.size - props.stroke_width) / 2.0;
    let circumference = 2.0 * std::f64::consts::PI * radius;
    let dash_offset = circumference * (1.0 - clamped_value / 100.0);

    let segmented = props.segments.is_some();
    let arcs = props
        .segments
        .as_deref()
        .map(progress_ring_arcs)
        .unwrap_or_default();
    let aria_value = match &props.segments {
        Some(segments) => progress_ring_segments_total(segments),
        None => clamped_value,
    };

    let variant_class = props.variant.class_name();
    let root_classes = if variant_class.is_empty() {
        "hk-progress-ring".to_string()
    } else {
        format!("hk-progress-ring {variant_class}")
    };

    let center = props.size / 2.0;
    let text_size = (props.size / 5.0).round() as i64;
    let view_box = format!("0 0 {} {}", props.size, props.size);
    let transform = format!("rotate(-90 {center} {center})");
    let stroke_width = format!("{}", props.stroke_width);

    rsx! {
        div {
            class: root_classes,
            style: format!("width:{}px;height:{}px", props.size, props.size),
            "role": "progressbar",
            "aria-valuenow": format!("{aria_value}"),
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            svg {
                class: "hk-progress-ring-svg",
                view_box: view_box,
                if props.show_track {
                    circle {
                        class: "hk-progress-ring-track",
                        cx: format!("{center}"),
                        cy: format!("{center}"),
                        r: format!("{radius}"),
                        fill: "none",
                        stroke: "currentColor",
                        stroke_width: stroke_width.clone(),
                        stroke_linecap: "round",
                    }
                }
                if segmented {
                    for (i, arc) in arcs.iter().enumerate() {
                        {
                            let len_px = (arc.len / 100.0) * circumference;
                            let dash_array = format!("{len_px} {}", circumference - len_px);
                            let dash_offset = circumference * (1.0 - arc.start / 100.0);
                            let mut classes = String::from("hk-progress-ring-seg");
                            if !arc.class.is_empty() {
                                classes.push(' ');
                                classes.push_str(&arc.class);
                            }
                            let style = arc
                                .color
                                .as_ref()
                                .map(|color| format!("stroke:{color}"))
                                .unwrap_or_default();
                            rsx! {
                                circle {
                                    key: i,
                                    class: classes,
                                    cx: format!("{center}"),
                                    cy: format!("{center}"),
                                    r: format!("{radius}"),
                                    fill: "none",
                                    stroke_width: stroke_width.clone(),
                                    stroke_dasharray: dash_array,
                                    stroke_dashoffset: format!("{dash_offset}"),
                                    // Butt caps keep the carved gap visible.
                                    stroke_linecap: "butt",
                                    transform: transform.clone(),
                                    style: style,
                                }
                            }
                        }
                    }
                } else {
                    circle {
                        class: "hk-progress-ring-fill",
                        cx: format!("{center}"),
                        cy: format!("{center}"),
                        r: format!("{radius}"),
                        fill: "none",
                        stroke_width: stroke_width.clone(),
                        stroke_dasharray: format!("{circumference}"),
                        stroke_dashoffset: format!("{dash_offset}"),
                        stroke_linecap: "round",
                        transform: transform.clone(),
                    }
                }
            }
            if props.show_label && props.overlay.is_none() {
                span {
                    class: "hk-progress-ring-label",
                    style: format!("font-size:{text_size}px"),
                    "{format!(\"{}%\", aria_value.round() as i64)}"
                }
            }
            if let Some(overlay) = props.overlay {
                span { class: "hk-progress-ring-overlay",
                    {overlay}
                }
            }
        }
    }
}

impl StyledComponent for ProgressRingComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkProgressRing.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "progress-ring"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn seg(value: f64) -> ProgressRingSegment {
        ProgressRingSegment {
            value,
            color: None,
            class: String::new(),
        }
    }

    #[test]
    fn ring_arcs_carve_the_gap_before_following_segments_only() {
        let arcs = progress_ring_arcs(&[seg(30.0), seg(20.0)]);
        assert_eq!(arcs.len(), 2);
        assert_eq!(arcs[0].start, 0.0);
        // First arc has a follower → 1% carved.
        assert_eq!(arcs[0].len, 29.0);
        assert_eq!(arcs[1].start, 30.0);
        // Last arc: no gap.
        assert_eq!(arcs[1].len, 20.0);
    }

    #[test]
    fn ring_arcs_clamp_and_skip_zero_segments() {
        let arcs = progress_ring_arcs(&[seg(0.0), seg(150.0), seg(10.0)]);
        // Zero segment dropped; the 150 clamps to the remaining 100, and
        // the 1% gap still applies because a follower IS in the visible
        // list (Vue's `i < visible.length - 1` check), so len = 99.
        assert_eq!(arcs.len(), 1);
        assert_eq!(arcs[0].len, 99.0);
        assert_eq!(progress_ring_segments_total(&[seg(0.0), seg(150.0)]), 100.0);
    }

    #[test]
    fn ring_segments_total_rounds_to_one_decimal() {
        assert_eq!(
            progress_ring_segments_total(&[seg(33.33), seg(33.33)]),
            66.7
        );
    }

    #[test]
    fn ring_defaults_match_the_vue_props() {
        let props = ProgressRingProps::default();
        assert_eq!(props.value, 0.0);
        assert_eq!(props.pct, None);
        assert_eq!(props.size, 120.0);
        assert_eq!(props.stroke_width, 8.0);
        assert_eq!(props.variant, ProgressRingVariant::Normal);
        assert!(!props.show_label);
        assert!(props.show_track);
        assert_eq!(props.segments, None);
        assert!(props.overlay.is_none());
    }

    #[test]
    fn ring_styles_come_from_the_canonical_vue_sheet() {
        let css = ProgressRingComponent::styles();
        assert!(
            css.contains(".hk-progress-ring") && css.contains(".hk-progress-ring-svg"),
            "progress ring css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored progress ring sheet"
        );
    }
}
