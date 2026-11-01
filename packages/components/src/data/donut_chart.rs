// hi-components/src/data/donut_chart.rs
// DonutChart — mirror of the canonical Vue `HkDonutChart`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkDonutChart.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-donut*`
// class names are literal and identical in both forms. Every arc/percent is
// computed by the pure [`donut_slices`] (the mirror of
// `packages/vue/src/components/donutGeometry.ts`), pinned by the tests —
// the render layer only concatenates strings.
//
// DOM contract (mirrors Vue one-to-one):
//
//   div.hk-donut[role="img"][aria-label]
//     div.hk-donut__ring-wrap
//       div[style="display:contents"][dangerous_inner_html=<svg …>]
//         <svg class="hk-donut__ring" viewBox="0 0 {size} {size}">
//           <path class="hk-donut__slice" d=… fill=… data-hint aria-label
//                 tabindex="0">                    (one per non-zero entry)
//           <text class="hk-donut__center" x={size/2} y={size/2 + 5}
//                 text-anchor="middle">{center_value}</text>?
//     div.hk-donut__legend?                          (show_legend)
//       div.hk-donut__legend-col                      (chunked, 5 rows each)
//         div.hk-donut__legend-row[data-hint]
//           span.hk-donut__legend-dot   (style: background={fill})
//           span.hk-donut__legend-label ({icon} or {label})
//           span.hk-donut__legend-pct   ({percent_int}%)
//   div.hk-donut.hk-donut--empty                    (no positive entries)
//     {empty_text}
//
// Slices start at 12 o'clock (-90°), run clockwise in input order, and a
// single 100% slice is split into two 180° halves (a lone 360° arc
// degenerates). Colors arrive pre-resolved: `color` when the caller supplied
// one, else the primary token ladder ([`donut_default_fill`]).
//
// The SVG subtree is authored as MARKUP and mounted through
// `dangerous_inner_html` on its OWN `display:contents` host: rsx `svg {}`
// maps to `createElement` in this host stack (HTML namespace) and inner_html
// suppresses an element's children (ledger L49). Markup bypasses tairitsu's
// escaper, so consumer strings are escaped here ([`escape_markup`]).
//
// Deltas vs Vue (documented):
//   * Hover focus is NOT mirrored: Vue's paired `is-hot` / `is-dim` lift
//     needs a per-instance reactive `hovered` ref, which the Rust form
//     forbids (zero `use_signal`/`use_state`). The classes stay in the
//     mirrored sheet; the mirror never emits them.
//   * `select(key)` is wired on the LEGEND rows only (real VNodes). Vue also
//     emits from each slice `<path>`; those live inside the opaque
//     inner_html blob where no Rust listener can be attached (a wasip2 host
//     has no DOM), so with `show_legend = false` the mirror has no click
//     channel (Vue still fires from the slices).
//   * Vue's scoped `legendIcon` slot becomes [`DonutEntry::icon`] — an
//     optional node rendered in place of the row's text label (the color dot
//     and the row hint stay, exactly like Vue's slot contract).
//   * `hintOf` is a [`Callback<DonutSlice, String>`]; `None` reproduces Vue's
//     default `"{label} · {value} · {percent_int}%"`.
//   * Host attribute fallthrough (`class` / `style` on `<HkDonutChart>`) is
//     not mirrored.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct DonutChartComponent;

/// Legend rows per column — wowsp's constant (Vue:
/// `LEGEND_ROWS_PER_COLUMN = 5`).
pub const DONUT_LEGEND_ROWS_PER_COLUMN: usize = 5;
/// Square viewBox side default (Vue: `size`, 150).
pub const DONUT_SIZE: f64 = 150.0;
/// Ring radii as fractions of half the box (Vue: `["40%", "68%"]`).
pub const DONUT_INNER_RADIUS_RATIO: f64 = 0.4;
pub const DONUT_OUTER_RADIUS_RATIO: f64 = 0.68;
/// The `y` nudge of the center caption (Vue: `size / 2 + 5`).
pub const DONUT_CENTER_DY: f64 = 5.0;
/// A 100% slice is split into two halves — a lone 360° arc degenerates.
const DONUT_RING_EPSILON: f64 = 1e-9;

/// One donut entry as the caller passes it in (Vue: `HkDonutEntry`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DonutEntry {
    /// Stable key (hover focus + select payload).
    pub key: String,
    /// Localized display label.
    pub label: String,
    pub value: f64,
    /// Optional explicit fill; absent entries ride the default ladder.
    pub color: Option<String>,
    /// Vue's scoped `legendIcon` slot: a per-slice glyph rendered in place of
    /// the legend row's text label (flags, tier marks). The color dot and the
    /// row's `data-hint` stay either way.
    pub icon: Option<Element>,
}

/// One computed donut slice: ready-to-render path, fill and shares
/// (Vue: `HkDonutSlice`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct DonutSlice {
    pub key: String,
    pub label: String,
    pub value: f64,
    /// Share of the shown sum at 2-decimal display precision.
    pub percent: f64,
    /// `Math.round` of the RAW share — the single integer both the slice hint
    /// and the DOM legend render (re-rounding `percent` could disagree with
    /// the legend).
    pub percent_int: i64,
    pub path: String,
    pub fill: String,
}

/// JavaScript's `Math.round` — half up, including for negatives.
fn js_round(value: f64) -> f64 {
    (value + 0.5).floor()
}

/// Trim float noise so path strings stay short and deterministic
/// (Vue: `fmtDonut`).
pub fn donut_fmt(n: f64) -> f64 {
    js_round(n * 100.0) / 100.0
}

/// Point on a circle at `deg`. Angles are degrees in the screen coordinate
/// system: -90 = 12 o'clock, increasing clockwise (Vue: `polar`).
pub fn donut_polar(cx: f64, cy: f64, radius: f64, deg: f64) -> (f64, f64) {
    let rad = deg * std::f64::consts::PI / 180.0;
    (cx + radius * rad.cos(), cy + radius * rad.sin())
}

/// Closed ring segment (donut slice) from `start_deg` to `end_deg`: outer arc
/// clockwise, radial edge, inner arc counter-clockwise back, close
/// (Vue: `ringSegment`).
fn donut_ring_segment(
    cx: f64,
    cy: f64,
    outer_r: f64,
    inner_r: f64,
    start_deg: f64,
    end_deg: f64,
) -> String {
    let (o1x, o1y) = donut_polar(cx, cy, outer_r, start_deg);
    let (o2x, o2y) = donut_polar(cx, cy, outer_r, end_deg);
    let (i2x, i2y) = donut_polar(cx, cy, inner_r, end_deg);
    let (i1x, i1y) = donut_polar(cx, cy, inner_r, start_deg);
    let large = if end_deg - start_deg > 180.0 { 1 } else { 0 };
    format!(
        "M {} {} A {} {} 0 {} 1 {} {} L {} {} A {} {} 0 {} 0 {} {} Z",
        donut_fmt(o1x),
        donut_fmt(o1y),
        donut_fmt(outer_r),
        donut_fmt(outer_r),
        large,
        donut_fmt(o2x),
        donut_fmt(o2y),
        donut_fmt(i2x),
        donut_fmt(i2y),
        donut_fmt(inner_r),
        donut_fmt(inner_r),
        large,
        donut_fmt(i1x),
        donut_fmt(i1y),
    )
}

/// A 100% slice as TWO 180° ring halves — see the header (Vue: `fullRing`).
fn donut_full_ring(cx: f64, cy: f64, outer_r: f64, inner_r: f64) -> String {
    format!(
        "{} {}",
        donut_ring_segment(cx, cy, outer_r, inner_r, 0.0, 180.0),
        donut_ring_segment(cx, cy, outer_r, inner_r, 180.0, 360.0)
    )
}

/// The default fill ladder: the primary token at ten descending mixes —
/// token-pure (no hex), so theme flips repaint the ring without a re-render
/// (Vue: `defaultFill`).
pub fn donut_default_fill(index: usize) -> String {
    let pct = 100 - (index % 10) as i64 * 9;
    format!("color-mix(in srgb, var(--color-primary) {pct}%, var(--hi-color-muted))")
}

/// Resolve every entry's fill BEFORE the non-positive ones are dropped, so
/// the ladder index matches the caller's array (Vue:
/// `entries.map((e, i) => ({ ...e, color: e.color ?? defaultFill(i) }))`).
pub fn donut_entries_with_fills(entries: &[DonutEntry]) -> Vec<DonutEntry> {
    entries
        .iter()
        .enumerate()
        .map(|(index, entry)| {
            let mut resolved = entry.clone();
            if resolved.color.is_none() {
                resolved.color = Some(donut_default_fill(index));
            }
            resolved
        })
        .collect()
}

/// Entries → donut slices starting at 12 o'clock (-90°), laid out clockwise
/// in input order. Non-positive entries are dropped; an empty (or all-zero)
/// input yields `[]`. Pure: same entries + same opts → the same slices
/// (Vue: `donutSlices`).
///
/// `outer_radius` / `inner_radius` are the Vue `opts` overrides; `None` keeps
/// the retired-ECharts look (40% / 68% of half the box).
pub fn donut_slices(
    entries: &[DonutEntry],
    view_box: f64,
    outer_radius: Option<f64>,
    inner_radius: Option<f64>,
) -> Vec<DonutSlice> {
    let shown: Vec<&DonutEntry> = entries.iter().filter(|entry| entry.value > 0.0).collect();
    let total: f64 = shown.iter().map(|entry| entry.value).sum();
    if total <= 0.0 || total.is_nan() {
        return Vec::new();
    }
    let cx = view_box / 2.0;
    let cy = view_box / 2.0;
    let outer_r = outer_radius.unwrap_or(DONUT_OUTER_RADIUS_RATIO * cx);
    let inner_r = inner_radius.unwrap_or(DONUT_INNER_RADIUS_RATIO * cx);

    let mut slices = Vec::with_capacity(shown.len());
    let mut angle = -90.0f64;
    for entry in shown {
        let share = entry.value / total;
        let sweep = share * 360.0;
        let end = angle + sweep;
        let path = if sweep > 360.0 - DONUT_RING_EPSILON {
            donut_full_ring(cx, cy, outer_r, inner_r)
        } else {
            donut_ring_segment(cx, cy, outer_r, inner_r, angle, end)
        };
        slices.push(DonutSlice {
            key: entry.key.clone(),
            label: entry.label.clone(),
            value: entry.value,
            percent: js_round(share * 10000.0) / 100.0,
            percent_int: js_round(share * 100.0) as i64,
            path,
            fill: entry.color.clone().unwrap_or_default(),
        });
        angle = end;
    }
    slices
}

/// Split items into fixed-height columns: each column holds up to `size`
/// items (filled top-to-bottom in input order), overflow continues in the
/// next column to the right. Pure and order-preserving (Vue:
/// `chunkLegendItems`); a zero/negative size clamps to one row per column.
pub fn chunk_legend_items<T: Clone>(items: &[T], size: usize) -> Vec<Vec<T>> {
    let rows = size.max(1);
    let mut columns = Vec::new();
    let mut index = 0;
    while index < items.len() {
        let end = (index + rows).min(items.len());
        columns.push(items[index..end].to_vec());
        index = end;
    }
    columns
}

/// The slice hint (Vue: `hint`) — the consumer's `hintOf`, else
/// `"{label} · {value} · {percent_int}%"`.
pub fn donut_hint(slice: &DonutSlice, hint_of: Option<&Callback<DonutSlice, String>>) -> String {
    match hint_of {
        Some(callback) => callback.call(slice.clone()),
        None => format!("{} · {} · {}%", slice.label, slice.value, slice.percent_int),
    }
}

/// The whole-chart accessible name (Vue: `aria` computed) — the explicit
/// label, else `"{label} {percent_int}%"` joined per slice.
pub fn donut_aria(slices: &[DonutSlice], aria_label: Option<&str>) -> String {
    match aria_label {
        Some(label) => label.to_string(),
        None => slices
            .iter()
            .map(|slice| format!("{} {}%", slice.label, slice.percent_int))
            .collect::<Vec<_>>()
            .join(", "),
    }
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

/// The legend glyph for `key`, when the caller supplied one
/// (Vue: `slots.legendIcon?.(slice)`).
fn donut_legend_icon(entries: &[DonutEntry], key: &str) -> Option<Element> {
    entries
        .iter()
        .find(|entry| entry.key == key)
        .and_then(|entry| entry.icon.clone())
}

/// The ring SVG exactly as Vue renders it (slices, then the center caption).
fn donut_ring_svg(
    slices: &[DonutSlice],
    size: f64,
    center_value: Option<&str>,
    hint_of: Option<&Callback<DonutSlice, String>>,
) -> String {
    let mut svg = String::new();
    svg.push_str(&format!(
        r#"<svg class="hk-donut__ring" viewBox="0 0 {size} {size}">"#
    ));
    for slice in slices {
        let hint = escape_markup(&donut_hint(slice, hint_of));
        svg.push_str(&format!(
            r#"<path class="hk-donut__slice" d="{}" fill="{}" data-hint="{hint}" aria-label="{hint}" tabindex="0"/>"#,
            slice.path,
            escape_markup(&slice.fill),
        ));
    }
    if let Some(center) = center_value.filter(|value| !value.is_empty()) {
        svg.push_str(&format!(
            r#"<text class="hk-donut__center" x="{}" y="{}" text-anchor="middle">{}</text>"#,
            size / 2.0,
            size / 2.0 + DONUT_CENTER_DY,
            escape_markup(center),
        ));
    }
    svg.push_str("</svg>");
    svg
}

#[define_props]
pub struct DonutChartProps {
    /// The slices' source rows; pass count-desc for the wowsp look
    /// (Vue: `entries`, required).
    #[default]
    pub entries: Vec<DonutEntry>,

    /// Square ring size (px, Vue default 150).
    #[default(DONUT_SIZE)]
    pub size: f64,

    /// Legend rows per column (Vue default 5).
    #[default(DONUT_LEGEND_ROWS_PER_COLUMN)]
    pub legend_rows: usize,

    /// Render the DOM legend (Vue default true).
    #[default(true)]
    pub show_legend: bool,

    /// Optional center caption inside the ring (Vue default null).
    pub center_value: Option<String>,

    /// Per-slice hover hint (Vue: `hintOf`).
    pub hint_of: Option<Callback<DonutSlice, String>>,

    /// Accessible name; `None` derives the legend summary.
    pub aria_label: Option<String>,

    /// Rendered when there is nothing to show (Vue default `"No data"`).
    #[default("No data".to_string())]
    pub empty_text: String,

    /// Fired with the slice key when a legend row is clicked (Vue's
    /// `select` — see the header for the slice-side gap).
    pub on_select: Option<EventHandler<String>>,
}

#[component]
pub fn DonutChart(props: DonutChartProps) -> Element {
    let filled = donut_entries_with_fills(&props.entries);
    let slices = donut_slices(&filled, props.size, None, None);

    if slices.is_empty() {
        let root = VElement::new("div")
            .class("hk-donut hk-donut--empty")
            .child(VNode::Text(VText::new(&props.empty_text)));
        return VNode::Element(Box::new(root));
    }

    let aria = donut_aria(&slices, props.aria_label.as_deref());
    let svg = donut_ring_svg(
        &slices,
        props.size,
        props.center_value.as_deref(),
        props.hint_of.as_ref(),
    );

    // `dangerous_inner_html` suppresses children, so the ring markup gets its
    // own `display:contents` host inside the ring wrapper (L49).
    let ring_host = VElement::new("div")
        .attr("style", "display:contents")
        .dangerous_inner_html(svg);
    let ring_wrap = VElement::new("div")
        .class("hk-donut__ring-wrap")
        .child(VNode::Element(Box::new(ring_host)));

    let mut root = VElement::new("div")
        .class("hk-donut")
        .attr("role", "img")
        .attr("aria-label", aria)
        .child(VNode::Element(Box::new(ring_wrap)));

    if props.show_legend {
        let mut legend = VElement::new("div").class("hk-donut__legend");
        for column in chunk_legend_items(&slices, props.legend_rows) {
            let mut column_el = VElement::new("div").class("hk-donut__legend-col");
            for slice in column {
                let hint = donut_hint(&slice, props.hint_of.as_ref());
                let key = slice.key.clone();
                let on_select = props.on_select.clone();

                let mut dot = VElement::new("span").class("hk-donut__legend-dot");
                if !slice.fill.is_empty() {
                    dot = dot.attr("style", format!("background:{}", slice.fill));
                }

                let label_node = match donut_legend_icon(&props.entries, &slice.key) {
                    Some(icon) => icon,
                    None => VNode::Text(VText::new(&slice.label)),
                };
                let label = VElement::new("span")
                    .class("hk-donut__legend-label")
                    .child(label_node);
                let percent = VElement::new("span")
                    .class("hk-donut__legend-pct")
                    .child(VNode::Text(VText::new(&format!("{}%", slice.percent_int))));

                let row = VElement::new("div")
                    .class("hk-donut__legend-row")
                    // Vue's rows carry the hint attribute only (no aria-label).
                    .attr("data-hint", hint)
                    .on_click(move |_event: MouseEvent| {
                        if let Some(handler) = on_select.as_ref() {
                            handler.call(key.clone());
                        }
                    })
                    .child(VNode::Element(Box::new(dot)))
                    .child(VNode::Element(Box::new(label)))
                    .child(VNode::Element(Box::new(percent)));

                column_el = column_el.child(VNode::Element(Box::new(row)));
            }
            legend = legend.child(VNode::Element(Box::new(column_el)));
        }
        root = root.child(VNode::Element(Box::new(legend)));
    }

    VNode::Element(Box::new(root))
}

impl StyledComponent for DonutChartComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkDonutChart.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "donut-chart"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(key: &str, value: f64) -> DonutEntry {
        DonutEntry {
            key: key.to_string(),
            label: key.to_uppercase(),
            value,
            color: None,
            icon: None,
        }
    }

    /// Vue's `donutGeometry.test.ts` fixture.
    fn vue_entries() -> Vec<DonutEntry> {
        vec![entry("dd", 60.0), entry("ca", 30.0), entry("bb", 10.0)]
    }

    #[test]
    fn donut_slices_lay_shares_out_clockwise_from_twelve_oclock() {
        let slices = donut_slices(&donut_entries_with_fills(&vue_entries()), 150.0, None, None);
        let percents: Vec<i64> = slices.iter().map(|slice| slice.percent_int).collect();
        assert_eq!(percents, vec![60, 30, 10]);
        // The first slice starts at 12 o'clock: (cx, cy - outerR) on the 150
        // box → (75, 75 - 51).
        assert!(slices[0].path.starts_with("M 75 24"), "{}", slices[0].path);
    }

    #[test]
    fn donut_slices_drop_non_positive_entries_and_yield_empty_for_zero_input() {
        let zero = donut_slices(&[entry("a", 0.0)], 150.0, None, None);
        assert!(zero.is_empty());
        let negative = donut_slices(&[entry("a", -3.0), entry("b", 0.0)], 150.0, None, None);
        assert!(negative.is_empty());
        let none = donut_slices(&[], 150.0, None, None);
        assert!(none.is_empty());
        // A dropped entry does not shift the ladder index of the survivors
        // (`donut_entries_with_fills` resolves BEFORE the filter).
        let mixed = donut_slices(
            &donut_entries_with_fills(&[entry("a", 0.0), entry("b", 5.0)]),
            150.0,
            None,
            None,
        );
        assert_eq!(mixed.len(), 1);
        assert!(mixed[0].fill.contains("91%"), "{}", mixed[0].fill);
    }

    #[test]
    fn donut_slices_split_a_full_ring_into_two_halves() {
        let slices = donut_slices(&[entry("solo", 7.0)], 150.0, None, None);
        assert_eq!(slices.len(), 1);
        assert_eq!(slices[0].percent_int, 100);
        // Two subpaths = two "M " commands (no degenerate lone 360° arc).
        assert_eq!(
            slices[0].path.matches("M ").count(),
            2,
            "{}",
            slices[0].path
        );
        // Both halves are 180° arcs → `large-arc-flag` stays 0.
        assert_eq!(slices[0].path.matches(" 0 1 ").count(), 2);
    }

    #[test]
    fn donut_slices_keep_percent_and_percent_int_from_diverging() {
        let slices = donut_slices(&[entry("a", 1.0), entry("b", 2.0)], 150.0, None, None);
        // 33.33% raw → percent 33.33, percentInt 33.
        assert!(
            (slices[0].percent - 33.33).abs() < 1e-9,
            "{}",
            slices[0].percent
        );
        assert_eq!(slices[0].percent_int, 33);
        assert!(
            (slices[1].percent - 66.67).abs() < 1e-9,
            "{}",
            slices[1].percent
        );
        assert_eq!(slices[1].percent_int, 67);
    }

    #[test]
    fn donut_slices_carry_the_callers_color_and_the_default_ladder() {
        let mut explicit = entry("a", 1.0);
        explicit.color = Some("#abc".to_string());
        let slices = donut_slices(&[explicit], 150.0, None, None);
        assert_eq!(slices[0].fill, "#abc");

        // The ladder: 100%, 91%, ... 19%, then it wraps back to 100%.
        assert!(donut_default_fill(0).contains("100%"));
        assert!(donut_default_fill(1).contains("91%"));
        assert!(donut_default_fill(9).contains("19%"));
        assert_eq!(donut_default_fill(10), donut_default_fill(0));
        assert!(donut_default_fill(0).starts_with("color-mix(in srgb, var(--color-primary) "));
    }

    #[test]
    fn donut_slices_honour_the_radius_overrides() {
        let slices = donut_slices(&[entry("solo", 1.0)], 150.0, Some(60.0), Some(20.0));
        assert_eq!(slices.len(), 1);
        // The full ring's outer arc radius is the override, not 0.68 * 75.
        assert!(slices[0].path.contains("A 60 60 "), "{}", slices[0].path);
        assert!(slices[0].path.contains("A 20 20 "), "{}", slices[0].path);
    }

    #[test]
    fn chunk_legend_items_fills_columns_top_to_bottom_then_right() {
        let items: Vec<u32> = (1..=7).collect();
        assert_eq!(
            chunk_legend_items(&items, 3),
            vec![vec![1, 2, 3], vec![4, 5, 6], vec![7]]
        );
        // A zero size clamps to one row per column (Vue: `Math.max(1, ...)`).
        assert_eq!(chunk_legend_items(&items[..2], 0), vec![vec![1], vec![2]]);
        assert!(chunk_legend_items::<u32>(&[], 5).is_empty());
    }

    #[test]
    fn donut_hint_and_aria_follow_vues_defaults() {
        let slices = donut_slices(&donut_entries_with_fills(&vue_entries()), 150.0, None, None);
        assert_eq!(donut_hint(&slices[0], None), "DD · 60 · 60%");
        assert_eq!(donut_aria(&slices, None), "DD 60%, CA 30%, BB 10%");
        assert_eq!(donut_aria(&slices, Some("Playtime")), "Playtime");
        let custom = Callback::new(|slice: DonutSlice| format!("{}!", slice.key));
        assert_eq!(donut_hint(&slices[0], Some(&custom)), "dd!");
    }

    #[test]
    fn donut_chart_defaults_match_the_vue_props() {
        let props = DonutChartProps::default();
        assert!(props.entries.is_empty());
        assert_eq!(props.size, 150.0);
        assert_eq!(props.legend_rows, 5);
        assert_eq!(props.legend_rows, DONUT_LEGEND_ROWS_PER_COLUMN);
        assert!(props.show_legend);
        assert!(props.center_value.is_none());
        assert!(props.hint_of.is_none());
        assert!(props.aria_label.is_none());
        assert_eq!(props.empty_text, "No data");
        assert!(props.on_select.is_none());
    }

    #[test]
    fn donut_chart_empty_state_carries_both_vue_classes() {
        let html = DonutChart(DonutChartProps {
            entries: vec![entry("a", 0.0), entry("b", -1.0)],
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(
            html,
            r#"<div class="hk-donut hk-donut--empty">No data</div>"#
        );
    }

    #[test]
    fn donut_chart_renders_the_ring_and_the_chunked_legend() {
        // DOM contract: the ring rides its own `display:contents` host inside
        // the wrapper, and the legend is a sibling of the wrapper.
        let html = DonutChart(DonutChartProps {
            entries: vue_entries(),
            center_value: Some("100%".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            r#"class="hk-donut""#,
            r#"role="img""#,
            r#"aria-label="DD 60%, CA 30%, BB 10%""#,
            r#"<div class="hk-donut__ring-wrap">"#,
            r#"<div style="display:contents">"#,
            r#"<svg class="hk-donut__ring" viewBox="0 0 150 150">"#,
            r#"<path class="hk-donut__slice""#,
            r#"data-hint="DD · 60 · 60%""#,
            r#"<text class="hk-donut__center" x="75" y="80" text-anchor="middle">100%</text>"#,
            r#"<div class="hk-donut__legend">"#,
            r#"<div class="hk-donut__legend-col">"#,
            r#"class="hk-donut__legend-row""#,
            r#"<span class="hk-donut__legend-label">DD</span>"#,
            r#"<span class="hk-donut__legend-pct">60%</span>"#,
        ] {
            assert!(html.contains(needle), "missing {needle} in {html}");
        }
        // The legend row's dot paints the slice fill inline.
        assert!(html.contains(r#"background:color-mix"#), "{html}");
        // 5 rows per column → a single column for three slices.
        assert_eq!(html.matches("hk-donut__legend-col").count(), 1);
        assert!(!html.contains("hk-donut--empty"), "{html}");
    }

    #[test]
    fn donut_chart_skips_the_legend_and_uses_the_icon_slot() {
        let glyph_entry = || {
            let mut entry = entry("dd", 60.0);
            entry.icon = Some(rsx! { i { "GLYPH" } });
            entry
        };

        // `show_legend = false` drops the whole legend subtree.
        let html = DonutChart(DonutChartProps {
            entries: vec![glyph_entry()],
            show_legend: false,
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("hk-donut__legend"), "{html}");
        assert!(html.contains("hk-donut__slice"), "{html}");

        // With the legend on the icon replaces the row's text label only:
        // the dot and the percent stay (Vue's `legendIcon` contract).
        let html = DonutChart(DonutChartProps {
            entries: vec![glyph_entry()],
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("GLYPH"), "{html}");
        assert!(html.contains("hk-donut__legend-pct"), "{html}");
    }

    #[test]
    fn donut_chart_escapes_consumer_text_inside_the_inner_html_markup() {
        let mut hostile = entry("s", 1.0);
        hostile.label = "<script>".to_string();
        hostile.color = Some(r#"a"b<&"#.to_string());
        let html = DonutChart(DonutChartProps {
            entries: vec![hostile],
            ..Default::default()
        })
        .render_to_html();
        // The slice markup is raw inner_html — no unescaped tag may survive.
        assert!(!html.contains("<script>"), "{html}");
        assert!(html.contains("&lt;script&gt;"), "{html}");
        assert!(html.contains("&quot;"), "{html}");
    }

    #[test]
    fn donut_chart_styles_come_from_the_canonical_vue_sheet() {
        let css = DonutChartComponent::styles();
        assert!(
            css.contains(".hk-donut")
                && css.contains(".hk-donut__slice")
                && css.contains(".hk-donut__legend-row")
                && css.contains(".hk-donut--empty"),
            "donut css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored donut sheet"
        );
    }
}
