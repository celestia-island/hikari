// hi-components/src/data/bar_chart.rs
// BarChart — mirror of the canonical Vue `HkBarChart`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkBarChart.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-bar-chart*` class names are literal and identical in both forms.
// Every coordinate/proportion/path is computed by the pure [`bar_layout`]
// (the mirror of `packages/vue/src/components/barChart.ts`), which is
// pinned by the tests below — the render layer only concatenates strings.
//
// DOM contract (mirrors Vue one-to-one):
//
//   div[style="display:contents"][dangerous_inner_html=<svg …>]   ← the chart
//     <svg class="hk-bar-chart" viewBox="0 0 {w} {h}"
//          preserveAspectRatio="xMidYMid meet" role="img" aria-label>
//       <g>                                        (one per gridline guide)
//         <line class="hk-bar-chart__grid" x1 y1 x2 y2>
//         <text class="hk-bar-chart__axis" x y>{formatValue(guide)}</text>
//       <g>                                        (one per bucket)
//         <path class="hk-bar-chart__bar" d=… data-hint aria-label tabindex="0">
//         <text class="hk-bar-chart__x" x={centerX} y={baselineY + 14}>{label}</text>
//   div.hk-bar-chart.hk-bar-chart--empty            (every bucket ≤ 0 / no buckets)
//     {empty_text}
//
// The SVG subtree is authored as MARKUP and mounted through
// `dangerous_inner_html` on its OWN `display:contents` host element: rsx
// `svg {}` maps to `createElement` in this host stack (HTML namespace, so
// nothing paints) and inner_html suppresses an element's children (ledger
// L49) — the same shape `feedback/progress_ring.rs` and
// `basic/time_zone_globe.rs` use. Markup bypasses tairitsu's escaper, so
// every consumer-authored string is escaped here ([`escape_markup`]).
//
// Deltas vs Vue (documented):
//   * `emits: select(index)` is NOT mirrored. Vue's bars are individually
//     clickable `<path>`s, but the mirror's marks live inside the opaque
//     inner_html blob, where no Rust listener can be attached (a wasip2 host
//     has no DOM to reach into). Each bar keeps Vue's `data-hint` /
//     `aria-label` / `tabindex="0"` so a host can delegate by bucket index
//     itself; the mirror exposes no `on_select` prop rather than one that
//     can never fire.
//   * Host attribute fallthrough (`class` / `style` passed to `<HkBarChart>`)
//     is not mirrored: the mirror's root is the inert `display:contents` host,
//     not Vue's `<svg>` root.
//   * `formatValue` is a [`Callback<f64, String>`] (Vue takes a plain
//     function); `None` reproduces Vue's default `String(Math.round(v))`.
//   * The frame math trusts its inputs exactly like Vue (`width` ≤ 2·sidePad
//     yields negative slots rather than a guard).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct BarChartComponent;

/// The default frame — the upstreamed wowsp playtime-trend constants
/// (Vue: `BAR_FRAME`).
pub const BAR_CHART_WIDTH: f64 = 640.0;
pub const BAR_CHART_HEIGHT: f64 = 220.0;
pub const BAR_CHART_SIDE_PAD: f64 = 44.0;
pub const BAR_CHART_TOP_PAD: f64 = 14.0;
pub const BAR_CHART_BOTTOM_PAD: f64 = 24.0;
/// Vue: `Math.min(slotW * 0.62, 36)`.
pub const BAR_CHART_SLOT_RATIO: f64 = 0.62;
pub const BAR_CHART_MAX_BAR_WIDTH: f64 = 36.0;
/// Vue: `Math.min(3, barW / 2, h / 2)` — top-only rounding.
pub const BAR_CHART_CORNER_RADIUS: f64 = 3.0;
/// The right-hand end of a gridline (Vue: `l.width - 8`).
pub const BAR_CHART_GRID_RIGHT_GAP: f64 = 8.0;
/// The gap between a guide and its axis label (Vue: `sidePad - 6`, `y + 3`).
pub const BAR_CHART_AXIS_LABEL_GAP: f64 = 6.0;
pub const BAR_CHART_AXIS_LABEL_DY: f64 = 3.0;
/// The x labels sit under the baseline (Vue: `baselineY + 14`).
pub const BAR_CHART_X_LABEL_DY: f64 = 14.0;

/// One bucket as the caller passes it in (Vue: `{ label, value, hint? }`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BarDatum {
    pub label: String,
    pub value: f64,
    /// Consumer tooltip text; `None` falls back to `"{label}: {value}"`
    /// (Vue's `hintOf`), which lands in `data-hint` + `aria-label`.
    pub hint: Option<String>,
}

/// One bucket's slot geometry (Vue: `BarSlot`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BarSlice {
    pub center_x: f64,
    pub bar_width: f64,
    /// Empty string for a zero bucket — no invisible sliver to hover.
    pub path: String,
    pub value: f64,
}

/// One horizontal guide (Vue: `{ y, value }`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BarGridline {
    pub y: f64,
    pub value: f64,
}

/// The full layout the component renders (Vue: `BarLayout`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct BarLayout {
    pub width: f64,
    pub height: f64,
    pub baseline_y: f64,
    pub side_pad: f64,
    /// Three guides: 0, half and the nice max.
    pub gridlines: Vec<BarGridline>,
    pub bars: Vec<BarSlice>,
}

/// JavaScript's `Math.round` — half up, including for negatives
/// (`(-0.5).round()` is -1 in Rust, -0 in JS).
fn js_round(value: f64) -> f64 {
    (value + 0.5).floor()
}

/// Trim float noise so path strings stay short and deterministic
/// (Vue: `fmtBar`).
pub fn fmt_bar(n: f64) -> f64 {
    js_round(n * 100.0) / 100.0
}

/// Round the window max up to a human tick so the axis reads "4", not "3.7":
/// the 1-2-5 ladder over three decades of exponent, then up to the next
/// integer step. Zero / negative / NaN input falls back to 1 (Vue: `niceMax`).
pub fn nice_max(max: f64) -> f64 {
    // NaN and non-positive input falls back to 1 (`!(max > 0.0)`, spelled
    // without a negated comparison so clippy stays quiet).
    if max <= 0.0 || max.is_nan() {
        return 1.0;
    }
    let exp = max.log10().floor();
    let base = 10.0_f64.powf(exp);
    for step in [1.0, 2.0, 5.0, 10.0] {
        if max <= step * base {
            return step * base;
        }
    }
    10.0 * base
}

/// Values → per-slot geometry. Pure: same values + same frame → the same
/// layout (Vue: `barLayout(values, { width, height })`).
pub fn bar_layout(values: &[f64], width: f64, height: f64) -> BarLayout {
    let baseline_y = height - BAR_CHART_BOTTOM_PAD;
    let plot_h = baseline_y - BAR_CHART_TOP_PAD;
    let peak = values.iter().fold(0.0_f64, |acc, value| acc.max(*value));
    let scale = nice_max(peak);
    let slot_w = (width - 2.0 * BAR_CHART_SIDE_PAD) / (values.len().max(1) as f64);
    let bar_w = (slot_w * BAR_CHART_SLOT_RATIO).min(BAR_CHART_MAX_BAR_WIDTH);

    let mut bars = Vec::with_capacity(values.len());
    for (index, value) in values.iter().enumerate() {
        let center_x = BAR_CHART_SIDE_PAD + slot_w * (index as f64 + 0.5);
        if !bar_is_drawable(*value) {
            bars.push(BarSlice {
                center_x,
                bar_width: bar_w,
                path: String::new(),
                value: *value,
            });
            continue;
        }
        let h = (value / scale) * plot_h;
        let top = baseline_y - h;
        let x0 = center_x - bar_w / 2.0;
        let x1 = center_x + bar_w / 2.0;
        let radius = BAR_CHART_CORNER_RADIUS.min(bar_w / 2.0).min(h / 2.0);
        let path = format!(
            "M {} {} L {} {} Q {} {} {} {} L {} {} Q {} {} {} {} L {} {} Z",
            fmt_bar(x0),
            fmt_bar(baseline_y),
            fmt_bar(x0),
            fmt_bar(top + radius),
            fmt_bar(x0),
            fmt_bar(top),
            fmt_bar(x0 + radius),
            fmt_bar(top),
            fmt_bar(x1 - radius),
            fmt_bar(top),
            fmt_bar(x1),
            fmt_bar(top),
            fmt_bar(x1),
            fmt_bar(top + radius),
            fmt_bar(x1),
            fmt_bar(baseline_y),
        );
        bars.push(BarSlice {
            center_x,
            bar_width: bar_w,
            path,
            value: *value,
        });
    }

    let gridlines = [0.0_f64, 0.5, 1.0]
        .iter()
        .map(|factor| BarGridline {
            y: fmt_bar(baseline_y - factor * plot_h),
            value: fmt_bar(scale * factor),
        })
        .collect();

    BarLayout {
        width,
        height,
        baseline_y,
        side_pad: BAR_CHART_SIDE_PAD,
        gridlines,
        bars,
    }
}

/// Vue's emptiness test: every bucket fails `value > 0` (an empty list counts
/// as empty).
pub fn bar_chart_empty(bars: &[BarDatum]) -> bool {
    bars.iter().all(|bar| !bar_is_drawable(bar.value))
}

/// The bar's tooltip text (Vue: `hintOf`) — the consumer's `hint`, else
/// `"{label}: {value}"`.
pub fn bar_chart_hint(bar: &BarDatum, format: Option<&Callback<f64, String>>) -> String {
    match &bar.hint {
        Some(hint) => hint.clone(),
        None => format!(
            "{}: {}",
            bar.label,
            bar_chart_format_value(bar.value, format)
        ),
    }
}

/// The whole-chart accessible name (Vue: `aria` computed) — the explicit
/// label, else `"{label} {value}"` joined per bucket.
pub fn bar_chart_aria(
    bars: &[BarDatum],
    aria_label: Option<&str>,
    format: Option<&Callback<f64, String>>,
) -> String {
    match aria_label {
        Some(label) => label.to_string(),
        None => bars
            .iter()
            .map(|bar| {
                format!(
                    "{} {}",
                    bar.label,
                    bar_chart_format_value(bar.value, format)
                )
            })
            .collect::<Vec<_>>()
            .join(", "),
    }
}

/// Axis / summary value formatting (Vue: `formatValue`, default
/// `String(Math.round(v))`).
pub fn bar_chart_format_value(value: f64, format: Option<&Callback<f64, String>>) -> String {
    match format {
        Some(formatter) => formatter.call(value),
        None => format!("{}", js_round(value) as i64),
    }
}

/// Whether a bucket draws ink (Vue's `value > 0` — NaN and non-positive are
/// pathless).
fn bar_is_drawable(value: f64) -> bool {
    value > 0.0
}

/// Escape a consumer string for a quoted SVG attribute AND for markup text.
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

/// The chart SVG exactly as Vue renders it (guides, bars, labels).
fn bar_chart_svg(
    layout: &BarLayout,
    bars: &[BarDatum],
    format: Option<&Callback<f64, String>>,
    aria: &str,
) -> String {
    let mut svg = String::new();
    svg.push_str(&format!(
        r#"<svg class="hk-bar-chart" viewBox="0 0 {} {}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="{}">"#,
        layout.width,
        layout.height,
        escape_markup(aria)
    ));

    for gridline in &layout.gridlines {
        svg.push_str("<g>");
        svg.push_str(&format!(
            r#"<line class="hk-bar-chart__grid" x1="{}" y1="{}" x2="{}" y2="{}"/>"#,
            layout.side_pad,
            gridline.y,
            layout.width - BAR_CHART_GRID_RIGHT_GAP,
            gridline.y,
        ));
        svg.push_str(&format!(
            r#"<text class="hk-bar-chart__axis" x="{}" y="{}">{}</text>"#,
            layout.side_pad - BAR_CHART_AXIS_LABEL_GAP,
            gridline.y + BAR_CHART_AXIS_LABEL_DY,
            escape_markup(&bar_chart_format_value(gridline.value, format)),
        ));
        svg.push_str("</g>");
    }

    for (index, slice) in layout.bars.iter().enumerate() {
        // `layout.bars` is one-to-one with `values`, and the component feeds
        // `values` from `bars`, so the index is always in range (Vue indexes
        // `props.bars[i]` the same way).
        let Some(bar) = bars.get(index) else {
            continue;
        };
        svg.push_str("<g>");
        if !slice.path.is_empty() {
            let hint = escape_markup(&bar_chart_hint(bar, format));
            svg.push_str(&format!(
                r#"<path class="hk-bar-chart__bar" d="{}" data-hint="{hint}" aria-label="{hint}" tabindex="0"/>"#,
                slice.path
            ));
        }
        svg.push_str(&format!(
            r#"<text class="hk-bar-chart__x" x="{}" y="{}">{}</text>"#,
            slice.center_x,
            layout.baseline_y + BAR_CHART_X_LABEL_DY,
            escape_markup(&bar.label),
        ));
        svg.push_str("</g>");
    }

    svg.push_str("</svg>");
    svg
}

#[define_props]
pub struct BarChartProps {
    /// The buckets, in axis order (Vue: `bars`, required).
    #[default]
    pub bars: Vec<BarDatum>,

    /// Frame size — the SVG viewBox; CSS scales it (Vue default 640).
    #[default(BAR_CHART_WIDTH)]
    pub width: f64,

    /// Vue default 220.
    #[default(BAR_CHART_HEIGHT)]
    pub height: f64,

    /// Value formatter for the axis guides and the aria label.
    pub format_value: Option<Callback<f64, String>>,

    /// Accessible name; `None` derives the value summary.
    pub aria_label: Option<String>,

    /// Rendered when every bucket is zero / the list is empty
    /// (Vue default `"No data"`).
    #[default("No data".to_string())]
    pub empty_text: String,
}

#[component]
pub fn BarChart(props: BarChartProps) -> Element {
    if bar_chart_empty(&props.bars) {
        let root = VElement::new("div")
            .class("hk-bar-chart hk-bar-chart--empty")
            .child(VNode::Text(VText::new(&props.empty_text)));
        return VNode::Element(Box::new(root));
    }

    let values: Vec<f64> = props.bars.iter().map(|bar| bar.value).collect();
    let layout = bar_layout(&values, props.width, props.height);
    let aria = bar_chart_aria(
        &props.bars,
        props.aria_label.as_deref(),
        props.format_value.as_ref(),
    );
    let svg = bar_chart_svg(&layout, &props.bars, props.format_value.as_ref(), &aria);

    // `dangerous_inner_html` suppresses an element's CHILDREN in
    // tairitsu-vdom, so the SVG markup gets its own `display:contents` host
    // (L49) instead of riding the root node.
    VNode::Element(Box::new(
        VElement::new("div")
            .attr("style", "display:contents")
            .dangerous_inner_html(svg),
    ))
}

impl StyledComponent for BarChartComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkBarChart.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "bar-chart"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bars(values: &[f64]) -> Vec<BarDatum> {
        values
            .iter()
            .map(|value| BarDatum {
                label: format!("b{value}"),
                value: *value,
                hint: None,
            })
            .collect()
    }

    /// Pull every number out of a path string (the Vue test's
    /// `path.split(/[\sMLQAZ]+/)` equivalent).
    fn path_numbers(path: &str) -> Vec<f64> {
        path.split(|ch: char| !(ch.is_ascii_digit() || ch == '.' || ch == '-'))
            .filter(|chunk| !chunk.is_empty())
            .filter_map(|chunk| chunk.parse::<f64>().ok())
            .collect()
    }

    #[test]
    fn nice_max_rounds_up_the_one_two_five_ladder() {
        // Vue's barChart.test.ts ladder, including the degenerate inputs.
        assert_eq!(nice_max(0.0), 1.0);
        assert_eq!(nice_max(-3.0), 1.0);
        assert_eq!(nice_max(f64::NAN), 1.0);
        assert_eq!(nice_max(0.7), 1.0);
        assert_eq!(nice_max(1.0), 1.0);
        assert_eq!(nice_max(1.5), 2.0);
        assert_eq!(nice_max(3.0), 5.0);
        assert_eq!(nice_max(6.0), 10.0);
        assert_eq!(nice_max(70.0), 100.0);
        assert_eq!(nice_max(600.0), 1000.0);
    }

    #[test]
    fn bar_layout_matches_the_default_frame_and_emits_one_slot_per_bucket() {
        let values = [3600.0, 7200.0, 0.0, 5400.0, 9000.0, 1200.0];
        let layout = bar_layout(&values, BAR_CHART_WIDTH, BAR_CHART_HEIGHT);
        assert_eq!(layout.width, BAR_CHART_WIDTH);
        assert_eq!(layout.height, BAR_CHART_HEIGHT);
        assert_eq!(layout.baseline_y, BAR_CHART_HEIGHT - BAR_CHART_BOTTOM_PAD);
        assert_eq!(layout.side_pad, BAR_CHART_SIDE_PAD);
        assert_eq!(layout.bars.len(), values.len());
        for (index, value) in values.iter().enumerate() {
            assert_eq!(layout.bars[index].value, *value);
            // Zero buckets carry no path (no invisible sliver to hover).
            assert_eq!(layout.bars[index].path.is_empty(), *value <= 0.0);
        }
        // Same values + same frame → the same layout.
        assert_eq!(
            bar_layout(&values, BAR_CHART_WIDTH, BAR_CHART_HEIGHT),
            layout
        );
    }

    #[test]
    fn bar_layout_draws_three_guides_at_zero_half_and_the_nice_max() {
        let layout = bar_layout(&[4.0, 8.0], BAR_CHART_WIDTH, BAR_CHART_HEIGHT);
        let values: Vec<f64> = layout.gridlines.iter().map(|guide| guide.value).collect();
        assert_eq!(values, vec![0.0, 5.0, 10.0]);
        assert_eq!(layout.gridlines[0].y, fmt_bar(layout.baseline_y));
        assert_eq!(layout.gridlines[2].y, fmt_bar(BAR_CHART_TOP_PAD));
    }

    #[test]
    fn bar_layout_tops_the_tallest_bar_at_the_top_pad() {
        let layout = bar_layout(&[0.0, 10.0], BAR_CHART_WIDTH, BAR_CHART_HEIGHT);
        // niceMax(10) = 10 → the max bar fills the plot: its highest path
        // point (the Q control / corner) sits exactly at the top pad.
        let numbers = path_numbers(&layout.bars[1].path);
        assert!(!numbers.is_empty());
        let highest = numbers.iter().cloned().fold(f64::INFINITY, f64::min);
        assert!((highest - BAR_CHART_TOP_PAD).abs() < 1e-9, "{highest}");
    }

    #[test]
    fn bar_layout_handles_empty_negative_and_single_bucket_inputs() {
        // No buckets: no slots, but still three sane guides (Vue's empty chart
        // keeps an axis — `niceMax(0)` is 1).
        let empty = bar_layout(&[], BAR_CHART_WIDTH, BAR_CHART_HEIGHT);
        assert!(empty.bars.is_empty());
        assert_eq!(empty.gridlines.len(), 3);
        assert_eq!(empty.gridlines[2].value, 1.0);

        // Negative / NaN buckets are pathless, exactly like Vue's `!(v > 0)`.
        let negative = bar_layout(&[-5.0, f64::NAN], BAR_CHART_WIDTH, BAR_CHART_HEIGHT);
        assert!(negative.bars.iter().all(|slot| slot.path.is_empty()));
        assert_eq!(negative.gridlines[2].value, 1.0);

        // A frame narrower than the side paddings inverts the slots instead
        // of being guarded — Vue's math is trusted verbatim (documented delta),
        // so the only contract is "it still builds a path".
        let tight = bar_layout(&[7.0], 80.0, BAR_CHART_HEIGHT);
        assert!(!tight.bars[0].path.is_empty());
        assert!(tight.bars[0].bar_width < 0.0);

        // A single bucket still gets the full-slot center.
        let single = bar_layout(&[7.0], BAR_CHART_WIDTH, BAR_CHART_HEIGHT);
        assert_eq!(single.bars.len(), 1);
        assert!(
            (single.bars[0].center_x
                - (BAR_CHART_SIDE_PAD + (BAR_CHART_WIDTH - 2.0 * BAR_CHART_SIDE_PAD) / 2.0))
                .abs()
                < 1e-9
        );
        assert!(!single.bars[0].path.is_empty());
    }

    #[test]
    fn bar_chart_hint_and_aria_follow_vues_precedence() {
        let explicit = BarDatum {
            label: "Mon".to_string(),
            value: 4.0,
            hint: Some("4 plays".to_string()),
        };
        assert_eq!(bar_chart_hint(&explicit, None), "4 plays");
        let derived = BarDatum {
            label: "Mon".to_string(),
            value: 3.6,
            hint: None,
        };
        // Vue's default formatter is `String(Math.round(v))`.
        assert_eq!(bar_chart_hint(&derived, None), "Mon: 4");
        let percent = Callback::new(|value: f64| format!("{value}%"));
        assert_eq!(bar_chart_hint(&derived, Some(&percent)), "Mon: 3.6%");
        assert_eq!(
            bar_chart_aria(&[explicit.clone(), derived.clone()], None, None),
            "Mon 4, Mon 4"
        );
        assert_eq!(
            bar_chart_aria(&[explicit, derived], Some("Playtime"), None),
            "Playtime"
        );
    }

    #[test]
    fn bar_chart_defaults_match_the_vue_props() {
        let props = BarChartProps::default();
        assert!(props.bars.is_empty());
        assert_eq!(props.width, 640.0);
        assert_eq!(props.height, 220.0);
        assert_eq!(props.format_value, None);
        assert_eq!(props.aria_label, None);
        assert_eq!(props.empty_text, "No data");
    }

    #[test]
    fn bar_chart_empty_state_carries_both_vue_classes() {
        // Empty list and all-zero lists both take the empty shell.
        for input in [Vec::new(), bars(&[0.0, 0.0, -1.0])] {
            let html = BarChart(BarChartProps {
                bars: input,
                ..Default::default()
            })
            .render_to_html();
            assert_eq!(
                html,
                r#"<div class="hk-bar-chart hk-bar-chart--empty">No data</div>"#
            );
        }
        // `emptyText` overrides the copy.
        let html = BarChart(BarChartProps {
            bars: bars(&[0.0]),
            empty_text: "暂无数据".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("暂无数据"), "{html}");
    }

    #[test]
    fn bar_chart_renders_the_svg_markup_on_its_own_contents_host() {
        // DOM contract: the SVG rides a childless `display:contents` host
        // (inner_html suppresses children), so every mark/class is markup.
        let html = BarChart(BarChartProps {
            bars: bars(&[4.0, 8.0]),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"<div style="display:contents">"#,
            r#"<svg class="hk-bar-chart" viewBox="0 0 640 220" preserveAspectRatio="xMidYMid meet" role="img""#,
            r#"<line class="hk-bar-chart__grid""#,
            r#"<text class="hk-bar-chart__axis""#,
            r#"<path class="hk-bar-chart__bar""#,
            r#"<text class="hk-bar-chart__x""#,
            // Derived hint + aria on the bar (Vue's `hintOf`).
            r#"data-hint="b4: 4""#,
            r#"tabindex="0""#,
        ] {
            assert!(html.contains(needle), "missing {needle} in {html}");
        }
        assert!(html.ends_with("</div>"), "{html}");
        assert!(!html.contains("hk-bar-chart--empty"), "{html}");
    }

    #[test]
    fn bar_chart_escapes_consumer_text_inside_the_inner_html_markup() {
        // `dangerous_inner_html` skips tairitsu's escaper, so labels and hints
        // must be escaped by the mirror itself.
        let html = BarChart(BarChartProps {
            bars: vec![BarDatum {
                label: "a<b\"c".to_string(),
                value: 1.0,
                hint: Some("<script>".to_string()),
            }],
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("a&lt;b&quot;c"), "{html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
        assert!(!html.contains("<script>"), "{html}");
    }

    #[test]
    fn bar_chart_styles_come_from_the_canonical_vue_sheet() {
        let css = BarChartComponent::styles();
        assert!(
            css.contains(".hk-bar-chart")
                && css.contains(".hk-bar-chart__bar")
                && css.contains(".hk-bar-chart--empty"),
            "bar chart css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored bar chart sheet"
        );
    }
}
