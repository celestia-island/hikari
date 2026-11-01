// hi-components/src/data/trend_chart.rs
// TrendChart — mirror of the canonical Vue `HkTrendChart`: labelled
// time-series ("pens") drawn over a rolling time window, with optional alarm
// threshold guides.
//
// STYLES: `packages/vue/src/components/HkTrendChart.tsx` ships NO stylesheet
// and emits NO hikari class name — it is an ECharts wrapper whose whole
// anatomy is inline (`<div style="width:100%;height:…">`, then the canvas
// ECharts paints). The vue-mirror manifest therefore has no `HkTrendChart.scss`
// row, and [`TrendChartComponent::styles`] is EMPTY: there is no sheet to
// mirror, and inventing one would fork the design system. The mirror's own
// ink rides inline SVG attributes/styles only.
//
// Every coordinate/proportion/path is computed by the pure [`trend_geometry`]
// (the mirror of the option tree's `xAxis` window, `scale: true` y-range,
// per-series `[time, value]` data and `markLine` thresholds), pinned by the
// tests below — the render layer only concatenates strings.
//
// DOM contract:
//
//   div.hk-trend-chart  style="width:100%;height:{height}"   ← Vue's root div
//     div[style="display:contents"][dangerous_inner_html=<svg …>]
//       <svg class="hk-trend-chart__svg" viewBox="0 0 {w} {h}"
//            preserveAspectRatio="none"
//            style="display:block;width:100%;height:100%">
//         <line class="hk-trend-chart__threshold" …/>      (one per markLine)
//         <path class="hk-trend-chart__area" d=…/>         (one per pen)
//         <polyline class="hk-trend-chart__line" points=…/>(one per pen)
//
// The `hk-trend-chart*` classes are INERT hooks (no sheet defines them, in
// either form) added by the mirror so a host can style or query the node;
// Vue's root div carries no class at all.
//
// The SVG subtree is authored as MARKUP and mounted through
// `dangerous_inner_html` on its OWN `display:contents` host: rsx `svg {}` maps
// to `createElement` in this host stack (HTML namespace) and inner_html
// suppresses an element's children (ledger L49) — the same shape
// `feedback/progress_ring.rs` uses. No consumer-authored string reaches the
// markup (pen labels are not rendered; see the deltas), so nothing here needs
// escaping.
//
// Deltas vs Vue (documented):
//   * ECharts is NOT embedded. Vue lazily imports `echarts/core` and hands it
//     an option tree; the mirror draws the same series geometry as declarative
//     SVG (the HkBarChart / HkDonutChart dependency-free line), which is why
//     the projection is a pure function instead of canvas state.
//   * There is no ECharts chrome: no cartesian grid, no axis/tick labels, no
//     legend, no tooltip/axisPointer, no `dataZoom`, and `smooth: true` becomes
//     a straight polyline. Threshold guides DO keep Vue's colors and dash
//     flavors (see the constants below).
//   * Vue draws lines only (no `areaStyle`); the mirror draws the task's
//     "trend polyline + area" geometry — a translucent fill under each line.
//   * The clock is a PROP: Vue calls `Date.now()` inside `renderChart`, the
//     mirror takes `now` (epoch ms) so a render is deterministic. `None`
//     freezes the window at the newest sample (see [`trend_window_end`]).
//   * The window filter is closed on both ends (`now - timeWindowMs … now`);
//     Vue filters the lower bound itself and lets the axis clip the rest.
//   * Pen ink: ECharts' built-in palette is replaced by the hikari
//     theme-token ladder ([`trend_pen_color`]).
//   * `timeWindowMs` is `f64` (Vue's number) — a non-positive window collapses
//     to an instant instead of dividing by zero.
//   * Host attribute fallthrough (`class` / `style` on `<HkTrendChart>`) is not
//     mirrored.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TrendChartComponent;

/// Vue: `grid: { left: 50, right: 20, top: 30, bottom: 40 }`.
pub const TREND_CHART_GRID_LEFT: f64 = 50.0;
pub const TREND_CHART_GRID_RIGHT: f64 = 20.0;
pub const TREND_CHART_GRID_TOP: f64 = 30.0;
pub const TREND_CHART_GRID_BOTTOM: f64 = 40.0;
/// The mirror's viewBox frame when the CSS height is not a px length.
pub const TREND_CHART_WIDTH: f64 = 640.0;
pub const TREND_CHART_HEIGHT: f64 = 240.0;
/// Vue default: five minutes.
pub const TREND_CHART_TIME_WINDOW_MS: f64 = 300_000.0;
/// Vue: `lineStyle: { width: 2 }`.
pub const TREND_CHART_LINE_WIDTH: f64 = 2.0;
/// The translucent fill under a line (see the header's area delta).
pub const TREND_CHART_AREA_OPACITY: f64 = 0.12;
/// Vue's `markLine` ink: hh/ll dashed red, h dotted orange, l dotted yellow.
pub const TREND_THRESHOLD_HH_COLOR: &str = "#FF1744";
pub const TREND_THRESHOLD_H_COLOR: &str = "#FF6D00";
pub const TREND_THRESHOLD_L_COLOR: &str = "#FFD600";
pub const TREND_THRESHOLD_LL_COLOR: &str = "#FF1744";
/// SVG dash arrays approximating ECharts' `dashed` / `dotted` line styles.
pub const TREND_THRESHOLD_DASHED: &str = "6 4";
pub const TREND_THRESHOLD_DOTTED: &str = "1 3";
/// The y axis collapses when every shown value is equal; the mirror pads the
/// range by this much on each side so the line lands mid-plot.
const TREND_FLAT_RANGE_PAD: f64 = 1.0;
const TREND_RANGE_EPSILON: f64 = 1e-9;

/// One sample (Vue: `TrendPoint`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TrendPoint {
    /// Epoch milliseconds.
    pub time: f64,
    pub value: f64,
}

/// Per-pen alarm limits (Vue: `AlarmThresholds`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct AlarmThresholds {
    pub hh: Option<f64>,
    pub h: Option<f64>,
    pub l: Option<f64>,
    pub ll: Option<f64>,
}

/// One labelled series (Vue: `TrendPen`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TrendPen {
    pub label: String,
    /// Samples in ascending time order (Vue assumes the same).
    pub data: Vec<TrendPoint>,
    pub thresholds: Option<AlarmThresholds>,
}

/// One projected sample in viewBox units.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TrendCoord {
    pub x: f64,
    pub y: f64,
}

/// The plot frame and the value/time mapping the paths are built from.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TrendFrame {
    pub width: f64,
    pub height: f64,
    pub plot_left: f64,
    pub plot_right: f64,
    pub plot_top: f64,
    pub plot_bottom: f64,
    /// `now - timeWindowMs`.
    pub window_start: f64,
    /// `now` (see [`trend_window_end`]).
    pub window_end: f64,
    pub value_min: f64,
    pub value_max: f64,
}

/// One pen's projected geometry.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TrendPenGeometry {
    pub label: String,
    pub color: String,
    pub points: Vec<TrendCoord>,
    /// The `points` attribute of the `<polyline>` (`"x,y x,y …"`).
    pub line: String,
    /// The area `d` attribute (the line closed down to the baseline).
    pub area: String,
}

/// One horizontal alarm guide (Vue: one `markLine` entry).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TrendThresholdLine {
    pub value: f64,
    pub y: f64,
    pub color: &'static str,
    pub dash: &'static str,
}

/// Everything the render layer needs.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TrendGeometry {
    pub frame: TrendFrame,
    pub pens: Vec<TrendPenGeometry>,
    pub thresholds: Vec<TrendThresholdLine>,
}

/// Parse Vue's CSS `height` (default `"240px"`) into the viewBox height. Only
/// a px length can be lifted into the viewBox; anything else (rem/%, a bare
/// number, an empty string) keeps [`TREND_CHART_HEIGHT`].
pub fn trend_height_px(height: &str) -> f64 {
    let trimmed = height.trim();
    if let Some(number) = trimmed.strip_suffix("px")
        && let Ok(px) = number.trim().parse::<f64>()
        && px > 0.0
        && px.is_finite()
    {
        return px;
    }
    TREND_CHART_HEIGHT
}

/// The pen ink ladder: hikari theme tokens, so a scheme flip repaints without
/// a re-render (Vue's pens relied on ECharts' own palette).
pub fn trend_pen_color(index: usize) -> &'static str {
    const LADDER: [&str; 5] = [
        "rgb(var(--color-primary))",
        "rgb(var(--color-success))",
        "rgb(var(--color-warning))",
        "rgb(var(--color-error))",
        "rgb(var(--color-info))",
    ];
    LADDER[index % LADDER.len()]
}

/// Where the rolling window ends. The prop wins (the host's clock); `None`
/// freezes the window at the newest sample across every pen, so a bare render
/// still shows the data instead of an empty five-minute window, and `0.0` when
/// there is no sample at all.
pub fn trend_window_end(pens: &[TrendPen], now: Option<f64>) -> f64 {
    if let Some(now) = now {
        return now;
    }
    let mut latest = f64::NEG_INFINITY;
    for pen in pens {
        for point in &pen.data {
            if point.time > latest {
                latest = point.time;
            }
        }
    }
    if latest.is_finite() { latest } else { 0.0 }
}

/// The `<polyline>` `points` attribute for projected samples (`"x,y x,y …"`).
/// A single sample yields a lone coordinate — a visually empty line, matching
/// Vue's `symbol: "none"`.
pub fn trend_polyline(points: &[TrendCoord]) -> String {
    points
        .iter()
        .map(|point| format!("{},{}", point.x, point.y))
        .collect::<Vec<_>>()
        .join(" ")
}

/// The area `d` attribute: the polyline closed down to `baseline_y` and back.
/// Empty for no samples.
pub fn trend_area_path(points: &[TrendCoord], baseline_y: f64) -> String {
    let Some(first) = points.first() else {
        return String::new();
    };
    let Some(last) = points.last() else {
        return String::new();
    };
    let mut path = format!("M {} {}", first.x, first.y);
    for point in &points[1..] {
        path.push_str(&format!(" L {} {}", point.x, point.y));
    }
    path.push_str(&format!(
        " L {} {} L {} {} Z",
        last.x, baseline_y, first.x, baseline_y
    ));
    path
}

/// Pens → projected geometry. Pure: same pens + clock + window + frame →
/// the same geometry.
pub fn trend_geometry(
    pens: &[TrendPen],
    now: Option<f64>,
    time_window_ms: f64,
    width: f64,
    height: f64,
    show_thresholds: bool,
) -> TrendGeometry {
    let window_end = trend_window_end(pens, now);
    let window_span = time_window_ms.max(0.0);
    let window_start = window_end - window_span;
    // Vue: `min = now - timeWindowMs, max = now`. A zero window collapses to
    // an instant; the divisor guard keeps the projection finite.
    let time_denom = if window_span > 0.0 { window_span } else { 1.0 };

    let plot_left = TREND_CHART_GRID_LEFT;
    let plot_right = (width - TREND_CHART_GRID_RIGHT).max(plot_left);
    let plot_top = TREND_CHART_GRID_TOP;
    let plot_bottom = (height - TREND_CHART_GRID_BOTTOM).max(plot_top);
    let plot_w = plot_right - plot_left;
    let plot_h = plot_bottom - plot_top;

    // The y range comes from the SHOWN samples only: ECharts' `scale: true`
    // fits the data extent and a `markLine` value does not extend the axis.
    let mut value_min = f64::INFINITY;
    let mut value_max = f64::NEG_INFINITY;
    for pen in pens {
        for point in &pen.data {
            if point.time >= window_start && point.time <= window_end {
                if point.value < value_min {
                    value_min = point.value;
                }
                if point.value > value_max {
                    value_max = point.value;
                }
            }
        }
    }
    if !value_min.is_finite() || !value_max.is_finite() {
        value_min = 0.0;
        value_max = 1.0;
    }
    if value_max - value_min < TREND_RANGE_EPSILON {
        // A flat (or single-sample) series collapses the axis; pad it so the
        // line lands mid-plot instead of dividing by zero.
        value_min -= TREND_FLAT_RANGE_PAD;
        value_max += TREND_FLAT_RANGE_PAD;
    }
    let value_span = value_max - value_min;

    let x_of = |time: f64| plot_left + ((time - window_start) / time_denom) * plot_w;
    let y_of = |value: f64| plot_bottom - ((value - value_min) / value_span) * plot_h;

    let mut projected = Vec::with_capacity(pens.len());
    for (index, pen) in pens.iter().enumerate() {
        let points: Vec<TrendCoord> = pen
            .data
            .iter()
            .filter(|point| point.time >= window_start && point.time <= window_end)
            .map(|point| TrendCoord {
                x: x_of(point.time),
                y: y_of(point.value),
            })
            .collect();
        projected.push(TrendPenGeometry {
            label: pen.label.clone(),
            color: trend_pen_color(index).to_string(),
            line: trend_polyline(&points),
            area: trend_area_path(&points, plot_bottom),
            points,
        });
    }

    let mut thresholds = Vec::new();
    if show_thresholds {
        for pen in pens {
            let Some(limits) = &pen.thresholds else {
                continue;
            };
            // Vue pushes one markLine per PRESENT limit, in this order.
            for (value, color, dash) in [
                (limits.hh, TREND_THRESHOLD_HH_COLOR, TREND_THRESHOLD_DASHED),
                (limits.h, TREND_THRESHOLD_H_COLOR, TREND_THRESHOLD_DOTTED),
                (limits.l, TREND_THRESHOLD_L_COLOR, TREND_THRESHOLD_DOTTED),
                (limits.ll, TREND_THRESHOLD_LL_COLOR, TREND_THRESHOLD_DASHED),
            ] {
                let Some(value) = value else {
                    continue;
                };
                // ECharts clips a guide that falls outside the axis range.
                if value < value_min || value > value_max {
                    continue;
                }
                thresholds.push(TrendThresholdLine {
                    value,
                    y: y_of(value),
                    color,
                    dash,
                });
            }
        }
    }

    TrendGeometry {
        frame: TrendFrame {
            width,
            height,
            plot_left,
            plot_right,
            plot_top,
            plot_bottom,
            window_start,
            window_end,
            value_min,
            value_max,
        },
        pens: projected,
        thresholds,
    }
}

/// The chart SVG: threshold guides first, then each pen's area + line.
fn trend_chart_svg(geometry: &TrendGeometry) -> String {
    let frame = &geometry.frame;
    let mut svg = String::new();
    svg.push_str(&format!(
        r#"<svg class="hk-trend-chart__svg" viewBox="0 0 {} {}" preserveAspectRatio="none" style="display:block;width:100%;height:100%">"#,
        frame.width, frame.height,
    ));
    for threshold in &geometry.thresholds {
        svg.push_str(&format!(
            r#"<line class="hk-trend-chart__threshold" x1="{}" y1="{}" x2="{}" y2="{}" stroke="{}" stroke-width="1" stroke-dasharray="{}"/>"#,
            frame.plot_left,
            threshold.y,
            frame.plot_right,
            threshold.y,
            threshold.color,
            threshold.dash,
        ));
    }
    for pen in &geometry.pens {
        if !pen.area.is_empty() {
            svg.push_str(&format!(
                r#"<path class="hk-trend-chart__area" d="{}" fill="{}" fill-opacity="{}" stroke="none"/>"#,
                pen.area, pen.color, TREND_CHART_AREA_OPACITY,
            ));
        }
        if !pen.line.is_empty() {
            svg.push_str(&format!(
                r#"<polyline class="hk-trend-chart__line" points="{}" fill="none" stroke="{}" stroke-width="{}" stroke-linejoin="round" stroke-linecap="round"/>"#,
                pen.line, pen.color, TREND_CHART_LINE_WIDTH,
            ));
        }
    }
    svg.push_str("</svg>");
    svg
}

#[define_props]
pub struct TrendChartProps {
    /// The labelled series (Vue: `pens`, default `[]`).
    #[default]
    pub pens: Vec<TrendPen>,

    /// Vue's inline height on the root div (default `"240px"`); its px value
    /// also sizes the viewBox.
    #[default("240px".to_string())]
    pub height: String,

    /// Draw the alarm threshold guides (Vue default true).
    #[default(true)]
    pub show_thresholds: bool,

    /// Rolling window length in ms (Vue default 300_000 — five minutes).
    #[default(TREND_CHART_TIME_WINDOW_MS)]
    pub time_window_ms: f64,

    /// The window's "now" in epoch ms. `None` freezes it at the newest sample
    /// (Vue reads `Date.now()` — see the header).
    pub now: Option<f64>,

    /// The viewBox width (the mirror's frame; Vue let ECharts measure the
    /// container instead).
    #[default(TREND_CHART_WIDTH)]
    pub width: f64,
}

#[component]
pub fn TrendChart(props: TrendChartProps) -> Element {
    let height_px = trend_height_px(&props.height);
    let geometry = trend_geometry(
        &props.pens,
        props.now,
        props.time_window_ms,
        props.width,
        height_px,
        props.show_thresholds,
    );

    // Vue's own inline box; an empty height keeps the viewBox-derived px.
    let height_css = if props.height.trim().is_empty() {
        format!("{height_px}px")
    } else {
        props.height.clone()
    };

    // `dangerous_inner_html` suppresses children, so the SVG markup gets its
    // own `display:contents` host (L49).
    VNode::Element(Box::new(
        VElement::new("div")
            .class("hk-trend-chart")
            .attr("style", format!("width:100%;height:{height_css}"))
            .child(VNode::Element(Box::new(
                VElement::new("div")
                    .attr("style", "display:contents")
                    .dangerous_inner_html(trend_chart_svg(&geometry)),
            ))),
    ))
}

impl StyledComponent for TrendChartComponent {
    /// Empty by construction: `HkTrendChart` has no stylesheet in either form
    /// (see the header's STYLES note). Keeping the empty string registered is
    /// what lets the registry stay uniform without inventing a sheet.
    fn styles() -> &'static str {
        ""
    }

    fn name() -> &'static str {
        "trend-chart"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pen(label: &str, samples: &[(f64, f64)]) -> TrendPen {
        TrendPen {
            label: label.to_string(),
            data: samples
                .iter()
                .map(|(time, value)| TrendPoint {
                    time: *time,
                    value: *value,
                })
                .collect(),
            thresholds: None,
        }
    }

    #[test]
    fn trend_height_px_lifts_only_px_lengths_into_the_viewbox() {
        assert_eq!(trend_height_px("240px"), 240.0);
        assert_eq!(trend_height_px(" 120px "), 120.0);
        // Everything else keeps the default frame height.
        assert_eq!(trend_height_px("0px"), TREND_CHART_HEIGHT);
        assert_eq!(trend_height_px("-40px"), TREND_CHART_HEIGHT);
        assert_eq!(trend_height_px("18rem"), TREND_CHART_HEIGHT);
        assert_eq!(trend_height_px("240"), TREND_CHART_HEIGHT);
        assert_eq!(trend_height_px(""), TREND_CHART_HEIGHT);
        assert_eq!(trend_height_px("240px;"), TREND_CHART_HEIGHT);
    }

    #[test]
    fn trend_geometry_projects_the_rolling_window_onto_the_frame() {
        // 640 x 240 frame → plot 50..620 horizontally, 30..200 vertically.
        let pens = [pen(
            "cpu",
            &[(0.0, 1.0), (4000.0, 2.0), (4500.0, 3.0), (5000.0, 4.0)],
        )];
        let geometry = trend_geometry(&pens, Some(5000.0), 1000.0, 640.0, 240.0, true);
        let frame = &geometry.frame;
        assert_eq!(frame.window_start, 4000.0);
        assert_eq!(frame.window_end, 5000.0);
        assert_eq!(
            (
                frame.plot_left,
                frame.plot_right,
                frame.plot_top,
                frame.plot_bottom
            ),
            (50.0, 620.0, 30.0, 200.0)
        );
        // The window drops the two oldest samples and maps the rest.
        assert_eq!(geometry.pens[0].points.len(), 3);
        assert_eq!(geometry.pens[0].line, "50,200 335,115 620,30");
        assert_eq!(
            geometry.pens[0].area,
            "M 50 200 L 335 115 L 620 30 L 620 200 L 50 200 Z"
        );
    }

    #[test]
    fn trend_geometry_freezes_the_window_at_the_newest_sample_without_a_clock() {
        let pens = [pen(
            "cpu",
            &[(0.0, 1.0), (4000.0, 2.0), (4500.0, 3.0), (5000.0, 4.0)],
        )];
        let explicit = trend_geometry(&pens, Some(5000.0), 1000.0, 640.0, 240.0, true);
        let derived = trend_geometry(&pens, None, 1000.0, 640.0, 240.0, true);
        assert_eq!(derived.frame.window_end, 5000.0);
        assert_eq!(derived.pens[0].line, explicit.pens[0].line);
        // No samples at all → the window sits at the epoch.
        assert_eq!(trend_window_end(&[], None), 0.0);
    }

    #[test]
    fn trend_geometry_handles_a_single_sample_and_a_flat_series() {
        // A single sample: one coordinate (an invisible line, like Vue's
        // symbol-less series) and a padded range that lands mid-plot.
        let single = trend_geometry(
            &[pen("cpu", &[(1000.0, 7.0)])],
            Some(1000.0),
            5000.0,
            640.0,
            240.0,
            true,
        );
        assert_eq!(single.frame.value_min, 6.0);
        assert_eq!(single.frame.value_max, 8.0);
        assert_eq!(single.pens[0].line, "620,115");
        assert_eq!(single.pens[0].area, "M 620 115 L 620 200 L 620 200 Z");

        // A flat series must not divide by zero (the axis pads by ±1).
        let flat = trend_geometry(
            &[pen("cpu", &[(0.0, 5.0), (1000.0, 5.0)])],
            Some(1000.0),
            1000.0,
            640.0,
            240.0,
            true,
        );
        assert_eq!(flat.frame.value_min, 4.0);
        assert_eq!(flat.frame.value_max, 6.0);
        for point in &flat.pens[0].points {
            assert!((point.y - 115.0).abs() < 1e-9, "{}", point.y);
        }
    }

    #[test]
    fn trend_geometry_keeps_negative_values_inside_the_frame() {
        let pens = [pen("temp", &[(0.0, -10.0), (1000.0, -2.0)])];
        let geometry = trend_geometry(&pens, Some(1000.0), 1000.0, 640.0, 240.0, true);
        assert_eq!(geometry.frame.value_min, -10.0);
        assert_eq!(geometry.frame.value_max, -2.0);
        // Lowest value sits on the baseline, highest on the plot top.
        assert!((geometry.pens[0].points[0].y - 200.0).abs() < 1e-9);
        assert!((geometry.pens[0].points[1].y - 30.0).abs() < 1e-9);
    }

    #[test]
    fn trend_geometry_survives_no_pens_a_zero_window_and_a_tiny_frame() {
        let empty = trend_geometry(&[], None, 300_000.0, 640.0, 240.0, true);
        assert!(empty.pens.is_empty());
        assert!(empty.thresholds.is_empty());
        assert_eq!(empty.frame.value_min, 0.0);
        assert_eq!(empty.frame.value_max, 1.0);
        assert_eq!(empty.frame.window_start, -300_000.0);

        // timeWindowMs <= 0 collapses the window to an instant (Vue's
        // `minTime = now`) — the projection still stays finite.
        let instant = trend_geometry(
            &[pen("cpu", &[(1000.0, 3.0)])],
            Some(1000.0),
            0.0,
            640.0,
            240.0,
            true,
        );
        assert_eq!(instant.frame.window_start, 1000.0);
        assert_eq!(instant.pens[0].points.len(), 1);
        assert!(instant.pens[0].points[0].x.is_finite());

        // A frame smaller than the paddings must not invert the plot box.
        let tiny = trend_geometry(
            &[pen("cpu", &[(0.0, 1.0), (1000.0, 2.0)])],
            Some(1000.0),
            1000.0,
            40.0,
            20.0,
            true,
        );
        assert_eq!(tiny.frame.plot_left, tiny.frame.plot_right);
        assert_eq!(tiny.frame.plot_top, tiny.frame.plot_bottom);
    }

    #[test]
    fn trend_geometry_emits_one_guide_per_present_threshold_in_vue_order() {
        let mut with_limits = pen("cpu", &[(0.0, 1.0), (1000.0, 9.0)]);
        with_limits.thresholds = Some(AlarmThresholds {
            hh: Some(5.0),
            h: Some(2.0),
            l: Some(1.5),
            ll: Some(1.0),
        });
        let geometry = trend_geometry(
            &[with_limits.clone()],
            Some(1000.0),
            1000.0,
            640.0,
            240.0,
            true,
        );
        assert_eq!(geometry.thresholds.len(), 4);
        let colors: Vec<&str> = geometry.thresholds.iter().map(|line| line.color).collect();
        assert_eq!(
            colors,
            vec![
                TREND_THRESHOLD_HH_COLOR,
                TREND_THRESHOLD_H_COLOR,
                TREND_THRESHOLD_L_COLOR,
                TREND_THRESHOLD_LL_COLOR,
            ]
        );
        let dashes: Vec<&str> = geometry.thresholds.iter().map(|line| line.dash).collect();
        assert_eq!(
            dashes,
            vec![
                TREND_THRESHOLD_DASHED,
                TREND_THRESHOLD_DOTTED,
                TREND_THRESHOLD_DOTTED,
                TREND_THRESHOLD_DASHED,
            ]
        );
        // hh = 5 on a 1..9 axis maps between the others, in order.
        assert!(geometry.thresholds[0].y < geometry.thresholds[1].y);
        assert!(geometry.thresholds[1].y < geometry.thresholds[2].y);

        // `show_thresholds = false` wins over any limits.
        let hidden = trend_geometry(&[with_limits], Some(1000.0), 1000.0, 640.0, 240.0, false);
        assert!(hidden.thresholds.is_empty());
    }

    #[test]
    fn trend_geometry_clips_guides_outside_the_value_range() {
        let mut with_limits = pen("cpu", &[(0.0, 2.0), (1000.0, 4.0)]);
        with_limits.thresholds = Some(AlarmThresholds {
            hh: Some(50.0),
            h: Some(3.0),
            l: Some(-20.0),
            ll: None,
        });
        let geometry = trend_geometry(&[with_limits], Some(1000.0), 1000.0, 640.0, 240.0, true);
        let values: Vec<f64> = geometry.thresholds.iter().map(|line| line.value).collect();
        assert_eq!(values, vec![3.0]);
    }

    #[test]
    fn trend_geometry_colors_pens_from_the_token_ladder() {
        let geometry = trend_geometry(
            &[
                pen("cpu", &[(0.0, 1.0), (1000.0, 2.0)]),
                pen("mem", &[(0.0, 3.0), (1000.0, 4.0)]),
            ],
            Some(1000.0),
            1000.0,
            640.0,
            240.0,
            true,
        );
        assert_eq!(geometry.pens.len(), 2);
        assert_eq!(geometry.pens[0].label, "cpu");
        assert_eq!(geometry.pens[0].color, "rgb(var(--color-primary))");
        assert_eq!(geometry.pens[1].color, "rgb(var(--color-success))");
        // The ladder wraps for the sixth pen and never runs out.
        assert_eq!(trend_pen_color(5), trend_pen_color(0));
        assert_eq!(trend_pen_color(9), "rgb(var(--color-info))");
    }

    #[test]
    fn trend_chart_defaults_match_the_vue_props() {
        let props = TrendChartProps::default();
        assert!(props.pens.is_empty());
        assert_eq!(props.height, "240px");
        assert!(props.show_thresholds);
        assert_eq!(props.time_window_ms, TREND_CHART_TIME_WINDOW_MS);
        assert_eq!(props.now, None);
        assert_eq!(props.width, 640.0);
    }

    #[test]
    fn trend_chart_renders_geometry_on_its_own_contents_host() {
        let html = TrendChart(TrendChartProps {
            pens: vec![pen("cpu", &[(0.0, 1.0), (5000.0, 4.0)])],
            now: Some(5000.0),
            time_window_ms: 5000.0,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="hk-trend-chart""#,
            // Vue's own inline box on the root div.
            r#"style="width:100%;height:240px""#,
            r#"<div style="display:contents">"#,
            r#"<svg class="hk-trend-chart__svg" viewBox="0 0 640 240" preserveAspectRatio="none""#,
            r#"<polyline class="hk-trend-chart__line" points="50,200 620,30""#,
            r#"<path class="hk-trend-chart__area" d="M 50 200 L 620 30 L 620 200 L 50 200 Z""#,
            r#"stroke="rgb(var(--color-primary))""#,
        ] {
            assert!(html.contains(needle), "missing {needle} in {html}");
        }
        assert!(html.ends_with("</div>"), "{html}");
    }

    #[test]
    fn trend_chart_renders_threshold_guides_into_the_markup() {
        let mut with_limits = pen("cpu", &[(0.0, 1.0), (1000.0, 9.0)]);
        with_limits.thresholds = Some(AlarmThresholds {
            hh: Some(8.0),
            h: None,
            l: None,
            ll: None,
        });
        let html = TrendChart(TrendChartProps {
            pens: vec![with_limits],
            now: Some(1000.0),
            time_window_ms: 1000.0,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(r#"<line class="hk-trend-chart__threshold" x1="50""#),
            "{html}"
        );
        assert!(html.contains(r##"stroke="#FF1744""##), "{html}");
        assert!(html.contains(r#"stroke-dasharray="6 4""#), "{html}");

        // Without thresholds the geometry is the only ink.
        let html = TrendChart(TrendChartProps {
            pens: vec![pen("cpu", &[(0.0, 1.0)])],
            now: Some(0.0),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-trend-chart__threshold"), "{html}");
    }

    #[test]
    fn trend_chart_style_is_empty_by_design() {
        // HkTrendChart ships no sheet in the Vue form (it is an ECharts
        // wrapper with inline sizing), so the mirror has nothing to compile —
        // an invented sheet would fork the design system.
        let css = TrendChartComponent::styles();
        assert_eq!(css, "", "trend chart must not carry an invented sheet");
        assert!(!css.contains("CSS generation failed"));
    }
}
