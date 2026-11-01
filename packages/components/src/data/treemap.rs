// hi-components/src/data/treemap.rs
// Treemap — mirror of the canonical Vue `HkTreemap`: the family's native
// squarified treemap (DOM-painted cells, no chart library).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkTreemap.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-treemap*` class name is literal and
// identical in both forms. The DOM contract below mirrors the Vue render
// output:
//
//   div.hk-treemap
//     ul.hk-treemap__legend                            (show_legend and data)
//       li.hk-treemap__legend-item[title]
//         span.hk-treemap__legend-swatch[aria-hidden]
//         span.hk-treemap__legend-label[.hk-treemap__label--unknown]
//         span.hk-treemap__legend-value
//         span.hk-treemap__legend-percent
//     div.hk-treemap__body                             (style: height)
//       div.hk-treemap__chart[role=img][aria-label]
//             [aria-describedby]                       (only with data)
//         ── one FLAT list in one canvas coordinate space ──
//         div.hk-treemap__cell.hk-treemap__cell--plate[aria-hidden]
//         div.hk-treemap__cell.hk-treemap__cell--group[role=img][aria-label]
//             [title]
//           span.hk-treemap__group-head
//             span.hk-treemap__label.hk-treemap__label--group[…--unknown]
//             span.hk-treemap__meta?                   (ladder: show_value)
//         div.hk-treemap__cell[role=img][aria-label][title]
//           span.hk-treemap__leaf-body?                (ladder: show_label)
//             span.hk-treemap__label[.hk-treemap__label--unknown]
//             span.hk-treemap__meta?                   (ladder: show_value)
//       div.hk-treemap__empty                          (no data)
//     p#{summary_id}.hk-treemap__a11y-summary           (with data)
//
// Vue paints these cells as DOM boxes (no `<svg>` anywhere in HkTreemap), so
// no `dangerous_inner_html` host appears in this file: every child is an
// element or a text node, and an absent child is `empty_vnode()`.
//
// The layout core is PURE and lives in this file: the squarified rect
// partition ([`treemap_squarify`], Bruls/Huizing/van Wijk), the recursive
// group subdivision ([`treemap_layout_cells`]), the size ladder
// ([`treemap_cell_ladder`]), the colour parse/resolve seam and the
// percent/format helpers. The component only assembles nodes.
//
// Behaviour deltas vs Vue (documented, one per deviation):
//   * NO MEASUREMENT API — Vue measures the chart element
//     (`ResizeObserver` → `clientWidth`/`clientHeight`) and lays out into the
//     measured box. The mirror takes the canvas box as the `width`/`height`
//     props (the box Vue measures, i.e. the CHART element, not the outer
//     card) and writes that height onto `.hk-treemap__body`; the legend's own
//     height therefore never steals from the layout canvas. A host must pass
//     the width it actually renders at.
//   * NO `HkTooltip` PER CELL — Vue wraps every cell in `HkTooltip` whose
//     wrapper IS the absolute cell frame. The mirrored `Tooltip` has no
//     `style` prop and its wrapper is `position:relative`
//     (`HkTooltip.scss`), so it cannot serve as that frame; and one mounted
//     popup node per cell is not what a chart wants. The cell carries the
//     frame itself plus the SAME hint text in a native `title` (Vue's
//     `cellText`) and the sheet's `--hk-treemap-fg` ink variable.
//   * `valueFormatter` is a typed `Callback<f64, String>` instead of a Vue
//     function prop; `None` is exactly Vue's `String(value)` default.
//   * `labelItalic` inheritance is OR-ed (`label_italic: bool`, `false` =
//     unset) because a Rust bool cannot spell Vue's `?? null`; a child
//     therefore cannot FORCE-CLEAR an inherited italic.
//   * NUMBER TEXT: JS `Number(x).toString()`/`toFixed(1)` become Rust
//     `{}`/`{:.1}` — identical for the ordinary values a chart carries, but
//     exact ties round half-to-even here where `toFixed` rounds away from
//     zero, and `1e21` prints differently. Inline px lengths are rounded to
//     two decimals ([`treemap_px`]) so float noise never reaches the DOM.
//   * `useId()` becomes the `summary_id` prop (default
//     `hk-treemap-summary`), so a host with two treemaps owns uniqueness.
//   * CSS colour parsing is strict where `parseFloat` is tolerant
//     (`"12abc"`/`"abc"` do not parse; both fall back to the inherited
//     palette colour) and a degenerate strip (a zero short side out of
//     float rounding) stops the partition where JS would emit `NaN` rects.
//   * duplicate node ids resolve to the LAST occurrence (Vue's `Map`
//     semantics), not the first.
//
// Replaces nothing: the family had no native treemap before this mirror.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct TreemapComponent;

// ── palette + geometry constants ───────────────────────────────────────

/// Vue's `HK_TREEMAP_DEFAULT_COLORS` — the ten-colour categorical palette
/// inherited by every node that carries no parseable opaque colour.
pub const HK_TREEMAP_DEFAULT_COLORS: [&str; 10] = [
    "#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7",
    "#9c755f", "#bab0ab",
];

/// Group header band height (px), reserved at the top of every group cell
/// (Vue: `HK_TREEMAP_GROUP_HEADER_PX`).
pub const HK_TREEMAP_GROUP_HEADER_PX: f64 = 22.0;

/// A group's inner padding (px) on the three remaining sides (Vue:
/// `HK_TREEMAP_GROUP_PAD_PX`).
pub const HK_TREEMAP_GROUP_PAD_PX: f64 = 2.0;

/// A group whose inner box is not strictly larger than this many px on both
/// axes stays a plain cell (Vue: the `innerW > 8 && innerH > 8` guard).
pub const HK_TREEMAP_MIN_SUBDIVIDE_PX: f64 = 8.0;

/// The cell label ladder floors: the label needs 18px of height and 24px of
/// width, the label+meta stack 40px and 56px (Vue's `showLabel` /
/// `showValue`, measured on the ZOOMED size).
pub const HK_TREEMAP_LABEL_MIN_H: f64 = 18.0;
pub const HK_TREEMAP_LABEL_MIN_W: f64 = 24.0;
pub const HK_TREEMAP_VALUE_MIN_H: f64 = 40.0;
pub const HK_TREEMAP_VALUE_MIN_W: f64 = 56.0;

// ── input model ────────────────────────────────────────────────────────

/// One caller-supplied node (Vue: `HkTreemapNode`). A node with a NON-EMPTY
/// `children` list is a group: its own `value` is never trusted, it is
/// derived from its descendants.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreemapNode {
    pub id: String,
    pub label: String,
    /// Render the label in italics — an explicitly UNKNOWN / unattributed
    /// composition bucket, inherited by descendants.
    pub label_italic: bool,
    pub value: f64,
    /// Optional opaque sRGB colour (`#rgb`/`#rrggbb`/`#rrggbbaa`, `rgb()`/
    /// `rgba()`, `hsl()`/`hsla()`); unparseable/translucent values fall back
    /// to the inherited palette colour.
    pub color: Option<String>,
    pub children: Option<Vec<TreemapNode>>,
}

/// A sanitized node. `percent` is a 0–100 percentage of all visible leaves.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreemapLayoutNode {
    pub id: String,
    pub label: String,
    pub label_italic: bool,
    pub value: f64,
    pub color: String,
    pub percent: f64,
    pub children: Option<Vec<TreemapLayoutNode>>,
}

/// The normalized layout: the surviving roots plus the visible leaf total.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreemapLayout {
    pub nodes: Vec<TreemapLayoutNode>,
    pub total: f64,
}

// ── colour seam ────────────────────────────────────────────────────────

/// Parsed sRGB channels with alpha, the shape Vue's `RgbaChannels` carries.
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub struct TreemapRgba {
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,
}

/// Vue's `contrastTextColor`: the cell ink simply follows the theme's text
/// token (user direction 2026-10-28), NOT a per-block black/white flip. The
/// background argument of the Vue helper is deliberately unused there and
/// has no counterpart here.
pub fn treemap_contrast_text_color() -> &'static str {
    "rgb(var(--color-text, 30 30 30))"
}

fn treemap_is_hex(value: &str) -> bool {
    !value.is_empty() && value.chars().all(|c| c.is_ascii_hexdigit())
}

fn treemap_hex_pair(expanded: &str, index: usize) -> f64 {
    f64::from(u8::from_str_radix(&expanded[index..index + 2], 16).unwrap_or(0))
}

/// Vue's `parseHexColor` — `#rgb`, `#rrggbb` or `#rrggbbaa` only.
pub fn treemap_parse_hex_color(raw: &str) -> Option<TreemapRgba> {
    let value = raw.strip_prefix('#')?;
    if ![3usize, 6, 8].contains(&value.len()) || !treemap_is_hex(value) {
        return None;
    }
    let expanded: String = if value.len() == 3 {
        value.chars().flat_map(|c| [c, c]).collect()
    } else {
        value.to_string()
    };
    Some(TreemapRgba {
        r: treemap_hex_pair(&expanded, 0),
        g: treemap_hex_pair(&expanded, 2),
        b: treemap_hex_pair(&expanded, 4),
        a: if value.len() == 8 {
            treemap_hex_pair(&expanded, 6) / 255.0
        } else {
            1.0
        },
    })
}

/// One numeric colour channel (`0`–`255`, or a percentage of 255).
pub fn treemap_numeric_channel(raw: &str) -> Option<f64> {
    if let Some(percent) = raw.strip_suffix('%') {
        let percent = percent.trim().parse::<f64>().ok()?;
        if !percent.is_finite() {
            return None;
        }
        Some(((percent / 100.0) * 255.0).clamp(0.0, 255.0))
    } else {
        let value = raw.trim().parse::<f64>().ok()?;
        if !value.is_finite() {
            return None;
        }
        Some(value.clamp(0.0, 255.0))
    }
}

fn treemap_hue_to_rgb(hue: f64, saturation: f64, lightness: f64) -> (f64, f64, f64) {
    let chroma = (1.0 - (2.0 * lightness - 1.0).abs()) * saturation;
    let sector = (hue.rem_euclid(360.0)) / 60.0;
    let x = chroma * (1.0 - (sector.rem_euclid(2.0) - 1.0).abs());
    let (red, green, blue) = if sector < 1.0 {
        (chroma, x, 0.0)
    } else if sector < 2.0 {
        (x, chroma, 0.0)
    } else if sector < 3.0 {
        (0.0, chroma, x)
    } else if sector < 4.0 {
        (0.0, x, chroma)
    } else if sector < 5.0 {
        (x, 0.0, chroma)
    } else {
        (chroma, 0.0, x)
    };
    let matched = lightness - chroma / 2.0;
    (
        (red + matched) * 255.0,
        (green + matched) * 255.0,
        (blue + matched) * 255.0,
    )
}

/// The alpha component of an `rgb()`/`hsl()` colour; absent (or empty) means
/// fully opaque, like Vue's `alphaComponent`.
pub fn treemap_alpha_component(raw: Option<&str>) -> Option<f64> {
    match raw {
        None | Some("") => Some(1.0),
        Some(value) => {
            if let Some(percent) = value.strip_suffix('%') {
                let percent = percent.trim().parse::<f64>().ok()?;
                if !percent.is_finite() {
                    return None;
                }
                Some((percent / 100.0).clamp(0.0, 1.0))
            } else {
                let parsed = value.trim().parse::<f64>().ok()?;
                if !parsed.is_finite() {
                    return None;
                }
                Some(parsed.clamp(0.0, 1.0))
            }
        }
    }
}

fn treemap_color_parts(inner: &str) -> Vec<&str> {
    inner
        .split(|c: char| c.is_whitespace() || c == ',' || c == '/')
        .filter(|part| !part.is_empty() && *part != "none")
        .collect()
}

/// Vue's `parseCssColor`: hex, `rgb()`/`rgba()` and `hsl()`/`hsla()`, with
/// `none` channels filtered out of the functional forms.
pub fn treemap_parse_css_color(raw: &str) -> Option<TreemapRgba> {
    let value = raw.trim();
    if value.starts_with('#') {
        return treemap_parse_hex_color(value);
    }
    let lower = value.to_ascii_lowercase();
    if let Some(inner) = lower
        .strip_prefix("rgb(")
        .or_else(|| lower.strip_prefix("rgba("))
        .and_then(|rest| rest.strip_suffix(')'))
    {
        let parts = treemap_color_parts(inner);
        if parts.len() < 3 {
            return None;
        }
        let r = treemap_numeric_channel(parts[0])?;
        let g = treemap_numeric_channel(parts[1])?;
        let b = treemap_numeric_channel(parts[2])?;
        let a = treemap_alpha_component(parts.get(3).copied())?;
        return Some(TreemapRgba { r, g, b, a });
    }
    if let Some(inner) = lower
        .strip_prefix("hsl(")
        .or_else(|| lower.strip_prefix("hsla("))
        .and_then(|rest| rest.strip_suffix(')'))
    {
        let parts = treemap_color_parts(inner);
        if parts.len() < 3 {
            return None;
        }
        let hue = treemap_angle_channel(parts[0])?;
        let saturation = treemap_percent_channel(parts[1])?;
        let lightness = treemap_percent_channel(parts[2])?;
        if ![hue, saturation, lightness].iter().all(|v| v.is_finite()) {
            return None;
        }
        let (r, g, b) = treemap_hue_to_rgb(
            hue,
            (saturation / 100.0).clamp(0.0, 1.0),
            (lightness / 100.0).clamp(0.0, 1.0),
        );
        let a = treemap_alpha_component(parts.get(3).copied())?;
        return Some(TreemapRgba { r, g, b, a });
    }
    None
}

/// An hsl hue: a bare number, optionally suffixed `deg`, and optionally
/// followed by the comma of the legacy comma-separated form.
fn treemap_angle_channel(raw: &str) -> Option<f64> {
    let text = raw.trim().trim_end_matches(',').trim_end_matches("deg");
    text.trim().parse::<f64>().ok()
}

/// An hsl saturation/lightness: a number with an optional `%` suffix (CSS
/// requires the percent, but both forms appear in the wild).
fn treemap_percent_channel(raw: &str) -> Option<f64> {
    let text = raw
        .trim()
        .trim_end_matches(',')
        .trim_end_matches('%')
        .trim();
    text.parse::<f64>().ok()
}

/// Vue's `resolveOpaqueColor`: a parseable, (near-)opaque colour becomes the
/// concrete `rgb(r g b)` the cell paints; everything else inherits.
pub fn treemap_resolve_opaque_color(raw: &str, fallback: &str) -> String {
    match treemap_parse_css_color(raw) {
        Some(channels) if channels.a >= 0.999 => format!(
            "rgb({} {} {})",
            channels.r.round() as i64,
            channels.g.round() as i64,
            channels.b.round() as i64
        ),
        _ => fallback.to_string(),
    }
}

// ── normalization: the only numeric model the chart renders from ────────

fn treemap_is_visible_value(value: f64) -> bool {
    value.is_finite() && value > 0.0
}

fn treemap_normalize_node(
    node: &TreemapNode,
    inherited_color: &str,
    inherited_italic: bool,
) -> Option<TreemapLayoutNode> {
    let color = match node.color.as_deref() {
        Some(raw) if !raw.is_empty() => treemap_resolve_opaque_color(raw, inherited_color),
        _ => inherited_color.to_string(),
    };
    let label_italic = node.label_italic || inherited_italic;
    match node
        .children
        .as_ref()
        .filter(|children| !children.is_empty())
    {
        Some(children) => {
            let normalized: Vec<TreemapLayoutNode> = children
                .iter()
                .filter_map(|child| treemap_normalize_node(child, &color, label_italic))
                .collect();
            if normalized.is_empty() {
                return None;
            }
            let value: f64 = normalized.iter().map(|child| child.value).sum();
            // Finite inputs still overflow when summed: such a group cannot
            // be represented truthfully, so it is omitted entirely.
            if !treemap_is_visible_value(value) {
                return None;
            }
            Some(TreemapLayoutNode {
                id: node.id.clone(),
                label: node.label.clone(),
                label_italic,
                value,
                color,
                percent: 0.0,
                children: Some(normalized),
            })
        }
        None => {
            if !treemap_is_visible_value(node.value) {
                return None;
            }
            Some(TreemapLayoutNode {
                id: node.id.clone(),
                label: node.label.clone(),
                label_italic,
                value: node.value,
                color,
                percent: 0.0,
                children: None,
            })
        }
    }
}

fn treemap_with_percentages(node: &TreemapLayoutNode, total: f64) -> TreemapLayoutNode {
    TreemapLayoutNode {
        id: node.id.clone(),
        label: node.label.clone(),
        label_italic: node.label_italic,
        value: node.value,
        color: node.color.clone(),
        percent: (node.value / total) * 100.0,
        children: node.children.as_ref().map(|children| {
            children
                .iter()
                .map(|c| treemap_with_percentages(c, total))
                .collect()
        }),
    }
}

fn treemap_leaf_total(nodes: &[TreemapLayoutNode]) -> f64 {
    nodes
        .iter()
        .map(|node| match node.children.as_deref() {
            Some(children) => treemap_leaf_total(children),
            None => node.value,
        })
        .sum()
}

/// Vue's `buildHkTreemapLayout`: invalid leaves are removed BEFORE any sum or
/// percentage, caller-supplied group values are ignored, and an unusable
/// total yields the empty layout.
pub fn treemap_build_layout(nodes: &[TreemapNode]) -> TreemapLayout {
    let normalized: Vec<TreemapLayoutNode> = nodes
        .iter()
        .enumerate()
        .filter_map(|(index, node)| {
            let inherited = HK_TREEMAP_DEFAULT_COLORS[index % HK_TREEMAP_DEFAULT_COLORS.len()];
            treemap_normalize_node(node, inherited, false)
        })
        .collect();
    let total = treemap_leaf_total(&normalized);
    if !treemap_is_visible_value(total) {
        return TreemapLayout::default();
    }
    TreemapLayout {
        nodes: normalized
            .iter()
            .map(|node| treemap_with_percentages(node, total))
            .collect(),
        total,
    }
}

// ── text helpers ───────────────────────────────────────────────────────

/// The plain decimal text of a value — Vue's default `String(value)`.
pub fn treemap_plain_value(value: f64) -> String {
    format!("{value}")
}

/// `valueFormatter` or the plain default. `Callback::call` is the mirror's
/// typed stand-in for Vue's function prop.
pub fn treemap_format_value(formatter: Option<&Callback<f64, String>>, value: f64) -> String {
    match formatter {
        Some(callback) => callback.call(value),
        None => treemap_plain_value(value),
    }
}

/// Vue's `formatHkTreemapPercent`: one decimal, whole numbers trimmed, and
/// tiny shares never rounded to a fake zero.
pub fn treemap_format_percent(percent: f64) -> String {
    if !percent.is_finite() || percent <= 0.0 {
        return "0%".to_string();
    }
    if percent < 0.1 {
        return "<0.1%".to_string();
    }
    let fixed = format!("{percent:.1}");
    let trimmed = fixed.strip_suffix(".0").unwrap_or(&fixed);
    format!("{trimmed}%")
}

/// A canvas-space length as an inline CSS px value, rounded to two decimals
/// so float noise never reaches the DOM (`12.340000000000002px`).
pub fn treemap_px(value: f64) -> String {
    let rounded = (value * 100.0).round() / 100.0;
    if rounded == 0.0 {
        "0px".to_string()
    } else {
        format!("{rounded}px")
    }
}

/// The cell tooltip/label text (Vue: `cellText`).
pub fn treemap_cell_text(
    node: &TreemapLayoutNode,
    formatter: Option<&Callback<f64, String>>,
) -> String {
    format!(
        "{}: {} · {}",
        node.label,
        treemap_format_value(formatter, node.value),
        treemap_format_percent(node.percent)
    )
}

// ── class names (the DOM contract, pinned by the tests) ─────────────────

/// Which of the three cell flavours one flat render entry is.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum TreemapCellKind {
    /// A group's colour plate (no text, `aria-hidden`).
    #[default]
    Plate,
    /// A group's header band (the label + meta cell).
    Group,
    /// A leaf cell.
    Leaf,
}

/// The class string of one cell flavour.
pub fn treemap_cell_classes(kind: TreemapCellKind) -> String {
    match kind {
        TreemapCellKind::Plate => "hk-treemap__cell hk-treemap__cell--plate".to_string(),
        TreemapCellKind::Group => "hk-treemap__cell hk-treemap__cell--group".to_string(),
        TreemapCellKind::Leaf => "hk-treemap__cell".to_string(),
    }
}

/// The class string of a cell label (`--group` for a group header band,
/// `--unknown` for an explicitly unattributed bucket).
pub fn treemap_label_classes(group: bool, italic: bool) -> String {
    let mut classes = String::from("hk-treemap__label");
    if group {
        classes.push_str(" hk-treemap__label--group");
    }
    if italic {
        classes.push_str(" hk-treemap__label--unknown");
    }
    classes
}

// ── squarified partition (Bruls, Huizing & van Wijk, 2000) ──────────────

/// One weight for the partition (Vue: `SquarifyInput`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreemapSquarifyInput {
    pub id: String,
    pub value: f64,
}

/// One laid-out rectangle in canvas space (Vue: `SquarifyRect`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreemapRect {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

fn treemap_aspect(short: f64, value: f64, total: f64) -> f64 {
    let side_a = (short * value) / total;
    let side_b = total / short;
    let max = if side_a > side_b { side_a } else { side_b };
    let min = if side_a < side_b { side_a } else { side_b };
    if min > 0.0 { max / min } else { f64::INFINITY }
}

/// Lay `values` (id → positive weight) into the rectangle `(x, y, w, h)`.
///
/// Two contracts are the reason the algorithm is pinned:
///
///  1. AREA TRUTH — every value maps to a rectangle whose area is that
///     value's exact share of the canvas (float rounding aside).
///  2. ASPECT BOUND — squarify's whole point over slice-and-dice: the worst
///     aspect ratio stays bounded (≤ 4 for reasonable inputs).
///
/// Deterministic: input order is preserved inside a strip (stable sort by
/// DESCENDING value first); zero/negative/NaN weights are dropped; the
/// caller's slice is never mutated (the canvas-area scaling happens on a
/// local copy).
pub fn treemap_squarify(
    values: &[TreemapSquarifyInput],
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Vec<TreemapRect> {
    let mut items: Vec<TreemapSquarifyInput> = values
        .iter()
        .filter(|item| item.value.is_finite() && item.value > 0.0)
        .cloned()
        .collect();
    items.sort_by(|a, b| {
        b.value
            .partial_cmp(&a.value)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut rects: Vec<TreemapRect> = Vec::new();
    if items.is_empty() || w <= 0.0 || h <= 0.0 {
        return rects;
    }

    // Scale values into CANVAS AREAS first (v' = v · w·h / Σv): the strip
    // math below assumes a row's value-sum IS the area it covers.
    let total_value: f64 = items.iter().map(|item| item.value).sum();
    let area_scale = (w * h) / total_value;
    for item in items.iter_mut() {
        item.value *= area_scale;
    }

    let mut cx = x;
    let mut cy = y;
    let mut cw = w;
    let mut ch = h;
    let mut index = 0usize;

    while index < items.len() {
        let short = cw.min(ch);
        let vertical = cw >= ch; // strip runs along the SHORT side
        if short <= 0.0 {
            // Float rounding collapsed the remaining canvas; JS would divide
            // by zero here and emit NaN rects, so stop instead.
            break;
        }

        let mut row_ids: Vec<String> = Vec::new();
        let mut row_values: Vec<f64> = Vec::new();
        let mut row_total = 0.0f64;
        let mut row_worst = f64::INFINITY;

        while index < items.len() {
            let value = items[index].value;
            let candidate_total = row_total + value;
            let candidate_worst = row_values
                .iter()
                .copied()
                .chain(std::iter::once(value))
                .fold(0.0f64, |worst, candidate| {
                    worst.max(treemap_aspect(short, candidate, candidate_total))
                });
            if row_ids.is_empty() || candidate_worst <= row_worst {
                row_ids.push(items[index].id.clone());
                row_values.push(value);
                row_total = candidate_total;
                row_worst = candidate_worst;
                index += 1;
            } else {
                break;
            }
        }

        let strip_len = row_total / short;
        let mut offset = if vertical { cy } else { cx };
        for slot in 0..row_values.len() {
            let extent = (row_values[slot] / row_total) * short;
            let id = row_ids[slot].clone();
            if vertical {
                rects.push(TreemapRect {
                    id,
                    x: cx,
                    y: offset,
                    w: strip_len,
                    h: extent,
                });
            } else {
                rects.push(TreemapRect {
                    id,
                    x: offset,
                    y: cy,
                    w: extent,
                    h: strip_len,
                });
            }
            offset += extent;
        }
        if vertical {
            cx += strip_len;
            cw -= strip_len;
        } else {
            cy += strip_len;
            ch -= strip_len;
        }
    }

    rects
}

/// The worst aspect ratio across a laid-out rectangle set (the aspect-bound
/// test seam, Vue: `worstAspectRatio`).
pub fn treemap_worst_aspect_ratio(rects: &[TreemapRect]) -> f64 {
    let mut worst = 1.0f64;
    for rect in rects {
        if rect.w <= 0.0 || rect.h <= 0.0 {
            continue;
        }
        let ratio = (rect.w / rect.h).max(rect.h / rect.w);
        worst = worst.max(ratio);
    }
    worst
}

// ── cells: the recursive group subdivision ─────────────────────────────

/// One laid-out cell (Vue: `HkTreemapCell`). `children` is empty for a leaf
/// and for a group whose inner box is too small to subdivide (that group
/// then renders as a plain cell with its header band).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct TreemapCell {
    pub node: TreemapLayoutNode,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub children: Vec<TreemapCell>,
}

/// Vue's `layoutHkTreemapCells`: squarify one level, then let each group's
/// children subdivide the box below the header band and inside the padding.
pub fn treemap_layout_cells(
    nodes: &[TreemapLayoutNode],
    x: f64,
    y: f64,
    w: f64,
    h: f64,
) -> Vec<TreemapCell> {
    if w <= 0.0 || h <= 0.0 || nodes.is_empty() {
        return Vec::new();
    }
    let inputs: Vec<TreemapSquarifyInput> = nodes
        .iter()
        .map(|node| TreemapSquarifyInput {
            id: node.id.clone(),
            value: node.value,
        })
        .collect();
    treemap_squarify(&inputs, x, y, w, h)
        .into_iter()
        .filter_map(|rect| {
            // Vue resolves through a Map, i.e. the LAST duplicate id wins.
            let node = nodes.iter().rev().find(|node| node.id == rect.id)?;
            let children = match node.children.as_ref().filter(|c| !c.is_empty()) {
                Some(children) => {
                    let inner_w = rect.w - HK_TREEMAP_GROUP_PAD_PX * 2.0;
                    let inner_h =
                        rect.h - HK_TREEMAP_GROUP_HEADER_PX - HK_TREEMAP_GROUP_PAD_PX * 2.0;
                    if inner_w > HK_TREEMAP_MIN_SUBDIVIDE_PX
                        && inner_h > HK_TREEMAP_MIN_SUBDIVIDE_PX
                    {
                        treemap_layout_cells(
                            children,
                            rect.x + HK_TREEMAP_GROUP_PAD_PX,
                            rect.y + HK_TREEMAP_GROUP_HEADER_PX + HK_TREEMAP_GROUP_PAD_PX,
                            inner_w,
                            inner_h,
                        )
                    } else {
                        Vec::new()
                    }
                }
                None => Vec::new(),
            };
            Some(TreemapCell {
                node: node.clone(),
                x: rect.x,
                y: rect.y,
                w: rect.w,
                h: rect.h,
                children,
            })
        })
        .collect()
}

/// Which of the two label lines a cell of this (ZOOMED) size can carry.
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub struct TreemapCellLadder {
    pub show_label: bool,
    pub show_value: bool,
}

/// Vue's detail ladder: a tall cell shows label + value + share, a shorter
/// one the label only, a tiny one nothing but colour (the hint still speaks).
pub fn treemap_cell_ladder(w: f64, h: f64, zoom: f64) -> TreemapCellLadder {
    let zw = w * zoom;
    let zh = h * zoom;
    TreemapCellLadder {
        show_label: zh >= HK_TREEMAP_LABEL_MIN_H && zw >= HK_TREEMAP_LABEL_MIN_W,
        show_value: zh >= HK_TREEMAP_VALUE_MIN_H && zw >= HK_TREEMAP_VALUE_MIN_W,
    }
}

/// Vue's `createHkTreemapSummary`: every leaf as `a / b / leaf: value (share)`.
pub fn treemap_summary(
    layout: &TreemapLayout,
    formatter: Option<&Callback<f64, String>>,
) -> String {
    fn walk(
        nodes: &[TreemapLayoutNode],
        parents: &mut Vec<String>,
        formatter: Option<&Callback<f64, String>>,
        entries: &mut Vec<String>,
    ) {
        for node in nodes {
            parents.push(node.label.clone());
            match node.children.as_deref() {
                Some(children) => walk(children, parents, formatter, entries),
                None => entries.push(format!(
                    "{}: {} ({})",
                    parents.join(" / "),
                    treemap_format_value(formatter, node.value),
                    treemap_format_percent(node.percent)
                )),
            }
            parents.pop();
        }
    }
    let mut entries: Vec<String> = Vec::new();
    let mut parents: Vec<String> = Vec::new();
    walk(&layout.nodes, &mut parents, formatter, &mut entries);
    entries.join("; ")
}

// ── props ──────────────────────────────────────────────────────────────

#[define_props]
pub struct TreemapProps {
    /// Caller-supplied tree (Vue: `nodes`, default `[]`).
    pub nodes: Vec<TreemapNode>,

    /// Plot canvas WIDTH in px. Vue measures the chart element; the mirror
    /// has no measurement API (see the header), so the host passes the box.
    #[default(320.0)]
    pub width: f64,

    /// Plot canvas HEIGHT in px — written onto `.hk-treemap__body`, exactly
    /// the box Vue measures.
    #[default(320.0)]
    pub height: f64,

    /// Render the categorical legend strip above the chart.
    #[default(true)]
    pub show_legend: bool,

    /// Text of the empty state (Vue: `emptyText`).
    #[default("No data".to_string())]
    pub empty_text: String,

    /// Accessible name of the chart region (Vue: `ariaLabel`).
    #[default("Treemap".to_string())]
    pub aria_label: String,

    /// Value formatter (Vue: `valueFormatter`); `None` is Vue's default.
    pub value_formatter: Option<Callback<f64, String>>,

    /// Unique id of the visually-hidden summary paragraph. Vue allocates one
    /// per instance through `useId()`; the host owns uniqueness here.
    #[default("hk-treemap-summary".to_string())]
    pub summary_id: String,
}

// ── render assembly (no layout math below this line) ────────────────────

fn treemap_cell_frame_style(x: f64, y: f64, w: f64, h: f64, color: &str) -> String {
    format!(
        "position:absolute;left:{};top:{};width:{};height:{};background:{}",
        treemap_px(x),
        treemap_px(y),
        treemap_px(w),
        treemap_px(h),
        color
    )
}

fn treemap_label_node(node: &TreemapLayoutNode, group: bool) -> VNode {
    let label = node.label.clone();
    rsx! {
        span {
            class: treemap_label_classes(group, node.label_italic),
            {label}
        }
    }
}

fn treemap_meta_node(node: &TreemapLayoutNode, formatter: Option<&Callback<f64, String>>) -> VNode {
    let meta = format!(
        "{} · {}",
        treemap_format_value(formatter, node.value),
        treemap_format_percent(node.percent)
    );
    rsx! {
        span { class: "hk-treemap__meta", {meta} }
    }
}

fn treemap_plate_node(cell: &TreemapCell) -> VNode {
    VNode::Element(Box::new(
        VElement::new("div")
            .class(treemap_cell_classes(TreemapCellKind::Plate))
            .attr("aria-hidden", "true")
            .style(treemap_cell_frame_style(
                cell.x,
                cell.y,
                cell.w,
                cell.h,
                &cell.node.color,
            )),
    ))
}

fn treemap_head_node(cell: &TreemapCell, formatter: Option<&Callback<f64, String>>) -> VNode {
    let node = &cell.node;
    let ladder = treemap_cell_ladder(cell.w, cell.h, 1.0);
    let meta = if ladder.show_value {
        treemap_meta_node(node, formatter)
    } else {
        empty_vnode()
    };
    let label = treemap_label_node(node, true);
    // The header band is capped by the cell (Vue: `Math.min(22, Math.max(0, h))`).
    let band_h = cell.h.clamp(0.0, HK_TREEMAP_GROUP_HEADER_PX);
    let style = format!(
        "{};--hk-treemap-fg:{}",
        treemap_cell_frame_style(cell.x, cell.y, cell.w, band_h, &node.color),
        treemap_contrast_text_color()
    );
    let aria = treemap_cell_text(node, formatter);
    VNode::Element(Box::new(
        VElement::new("div")
            .class(treemap_cell_classes(TreemapCellKind::Group))
            .attr("role", "img")
            .attr("aria-label", aria.clone())
            .attr("title", aria)
            .style(style)
            .child(rsx! {
                span {
                    class: "hk-treemap__group-head",
                    {label}
                    {meta}
                }
            }),
    ))
}

fn treemap_leaf_node(cell: &TreemapCell, formatter: Option<&Callback<f64, String>>) -> VNode {
    let node = &cell.node;
    let ladder = treemap_cell_ladder(cell.w, cell.h, 1.0);
    let body = if ladder.show_label {
        let label = treemap_label_node(node, false);
        let meta = if ladder.show_value {
            treemap_meta_node(node, formatter)
        } else {
            empty_vnode()
        };
        rsx! {
            span {
                class: "hk-treemap__leaf-body",
                {label}
                {meta}
            }
        }
    } else {
        empty_vnode()
    };
    let style = format!(
        "{};--hk-treemap-fg:{}",
        treemap_cell_frame_style(cell.x, cell.y, cell.w, cell.h, &node.color),
        treemap_contrast_text_color()
    );
    let aria = treemap_cell_text(node, formatter);
    VNode::Element(Box::new(
        VElement::new("div")
            .class(treemap_cell_classes(TreemapCellKind::Leaf))
            .attr("role", "img")
            .attr("aria-label", aria.clone())
            .attr("title", aria)
            .style(style)
            .child(body),
    ))
}

/// The render model is a FLAT list in one canvas coordinate space: a group
/// contributes a colour plate + a header band, a leaf a cell. Depth order is
/// the paint order, so children ride above their group's plate without any
/// z-index bookkeeping.
fn treemap_cell_nodes(
    cells: &[TreemapCell],
    formatter: Option<&Callback<f64, String>>,
) -> Vec<VNode> {
    let mut out: Vec<VNode> = Vec::new();
    for cell in cells {
        if cell.children.is_empty() {
            out.push(treemap_leaf_node(cell, formatter));
        } else {
            out.push(treemap_plate_node(cell));
            out.push(treemap_head_node(cell, formatter));
            out.extend(treemap_cell_nodes(&cell.children, formatter));
        }
    }
    out
}

fn treemap_legend_nodes(
    layout: &TreemapLayout,
    formatter: Option<&Callback<f64, String>>,
) -> Vec<VNode> {
    layout
        .nodes
        .iter()
        .map(|node| {
            let value_text = treemap_format_value(formatter, node.value);
            let percent_text = treemap_format_percent(node.percent);
            let legend_title = format!("{}: {} ({})", node.label, value_text, percent_text);
            let swatch = format!("background-color:{}", node.color);
            let label_classes = if node.label_italic {
                "hk-treemap__legend-label hk-treemap__label--unknown".to_string()
            } else {
                "hk-treemap__legend-label".to_string()
            };
            let label = node.label.clone();
            rsx! {
                li {
                    class: "hk-treemap__legend-item",
                    title: legend_title,
                    span {
                        class: "hk-treemap__legend-swatch",
                        "aria-hidden": "true",
                        style: swatch,
                    }
                    span { class: label_classes, {label} }
                    span { class: "hk-treemap__legend-value", {value_text} }
                    span { class: "hk-treemap__legend-percent", {percent_text} }
                }
            }
        })
        .collect()
}

#[component]
pub fn Treemap(props: TreemapProps) -> Element {
    let formatter = props.value_formatter.clone();
    let layout = treemap_build_layout(&props.nodes);
    let has_data = !layout.nodes.is_empty();
    let summary = treemap_summary(&layout, formatter.as_ref());
    let cells = if has_data {
        treemap_layout_cells(&layout.nodes, 0.0, 0.0, props.width, props.height)
    } else {
        Vec::new()
    };
    let cell_nodes = treemap_cell_nodes(&cells, formatter.as_ref());
    let legend_nodes = if props.show_legend && has_data {
        treemap_legend_nodes(&layout, formatter.as_ref())
    } else {
        Vec::new()
    };
    let body_height = format!("height:{}", treemap_px(props.height));
    let aria_label = props.aria_label.clone();
    let empty_text = props.empty_text.clone();
    let summary_id = props.summary_id.clone();
    let described_by = if has_data {
        Some(props.summary_id.clone())
    } else {
        None
    };

    rsx! {
        div { class: "hk-treemap",
            if props.show_legend && has_data {
                ul { class: "hk-treemap__legend", ..legend_nodes }
            }
            div { class: "hk-treemap__body", style: body_height,
                div {
                    class: "hk-treemap__chart",
                    role: "img",
                    "aria-label": aria_label,
                    "aria-describedby": described_by,
                    ..cell_nodes
                }
                if !has_data {
                    div { class: "hk-treemap__empty", {empty_text} }
                }
            }
            if has_data {
                p {
                    id: summary_id,
                    class: "hk-treemap__a11y-summary",
                    {summary}
                }
            }
        }
    }
}

impl StyledComponent for TreemapComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkTreemap.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "treemap"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn leaf(id: &str, value: f64) -> TreemapNode {
        TreemapNode {
            id: id.to_string(),
            label: id.to_string(),
            value,
            ..Default::default()
        }
    }

    fn group(id: &str, children: Vec<TreemapNode>) -> TreemapNode {
        TreemapNode {
            id: id.to_string(),
            label: id.to_string(),
            children: Some(children),
            ..Default::default()
        }
    }

    fn squarify_inputs(pairs: &[(&str, f64)]) -> Vec<TreemapSquarifyInput> {
        pairs
            .iter()
            .map(|(id, value)| TreemapSquarifyInput {
                id: (*id).to_string(),
                value: *value,
            })
            .collect()
    }

    // ── props defaults ─────────────────────────────────────────────────

    #[test]
    fn treemap_defaults_match_the_vue_props() {
        let props = TreemapProps::default();
        assert!(props.nodes.is_empty());
        assert_eq!(props.width, 320.0);
        assert_eq!(props.height, 320.0);
        assert!(props.show_legend);
        assert_eq!(props.empty_text, "No data");
        assert_eq!(props.aria_label, "Treemap");
        assert!(props.value_formatter.is_none());
        assert_eq!(props.summary_id, "hk-treemap-summary");
    }

    // ── class-name mapping ─────────────────────────────────────────────

    #[test]
    fn treemap_class_names_match_the_vue_sheet() {
        assert_eq!(
            treemap_cell_classes(TreemapCellKind::Plate),
            "hk-treemap__cell hk-treemap__cell--plate"
        );
        assert_eq!(
            treemap_cell_classes(TreemapCellKind::Group),
            "hk-treemap__cell hk-treemap__cell--group"
        );
        assert_eq!(
            treemap_cell_classes(TreemapCellKind::Leaf),
            "hk-treemap__cell"
        );
        assert_eq!(
            treemap_label_classes(true, true),
            "hk-treemap__label hk-treemap__label--group hk-treemap__label--unknown"
        );
        assert_eq!(treemap_label_classes(false, false), "hk-treemap__label");
        assert_eq!(
            treemap_contrast_text_color(),
            "rgb(var(--color-text, 30 30 30))"
        );
    }

    // ── pure layout: area truth + tiling ──────────────────────────────

    #[test]
    fn treemap_squarify_maps_every_value_to_its_exact_area_share() {
        let rects = treemap_squarify(
            &squarify_inputs(&[("a", 6.0), ("b", 6.0), ("c", 3.0), ("d", 3.0)]),
            0.0,
            0.0,
            200.0,
            100.0,
        );
        assert_eq!(rects.len(), 4);
        for (id, value) in [("a", 6.0), ("b", 6.0), ("c", 3.0), ("d", 3.0)] {
            let rect = rects.iter().find(|rect| rect.id == id).expect("rect");
            let expected = (value / 18.0) * 200.0 * 100.0;
            assert!(
                (rect.w * rect.h - expected).abs() < 1e-6,
                "{id}: area {} != {expected}",
                rect.w * rect.h
            );
        }
    }

    #[test]
    fn treemap_squarify_tiles_the_canvas_without_overlap() {
        let rects = treemap_squarify(
            &squarify_inputs(&[
                ("a", 30.0),
                ("b", 20.0),
                ("c", 15.0),
                ("d", 10.0),
                ("e", 8.0),
                ("f", 7.0),
            ]),
            0.0,
            0.0,
            320.0,
            240.0,
        );
        let area: f64 = rects.iter().map(|rect| rect.w * rect.h).sum();
        assert!(
            (area - 320.0 * 240.0).abs() < 1e-6,
            "the rects must tile the canvas: {area}"
        );
        for (i, a) in rects.iter().enumerate() {
            for b in rects.iter().skip(i + 1) {
                let overlap = (a.x + a.w).min(b.x + b.w) - a.x.max(b.x);
                let vertical = (a.y + a.h).min(b.y + b.h) - a.y.max(b.y);
                let overlap = overlap.max(0.0) * vertical.max(0.0);
                assert!(
                    (overlap - 0.0).abs() < 1e-9,
                    "{} and {} overlap by {overlap}",
                    a.id,
                    b.id
                );
            }
        }
    }

    #[test]
    fn treemap_squarify_bounds_the_aspect_ratio() {
        // Slice-and-dice on this sorted input produces ~12:1 slivers;
        // squarify keeps the set under 4.
        let rects = treemap_squarify(
            &squarify_inputs(&[
                ("a", 30.0),
                ("b", 20.0),
                ("c", 15.0),
                ("d", 10.0),
                ("e", 8.0),
                ("f", 7.0),
            ]),
            0.0,
            0.0,
            320.0,
            240.0,
        );
        assert!(
            treemap_worst_aspect_ratio(&rects) <= 4.0,
            "worst aspect {} exceeds the bound",
            treemap_worst_aspect_ratio(&rects)
        );
    }

    // ── pure layout: empty / single / degenerate containers ───────────

    #[test]
    fn treemap_squarify_handles_empty_single_and_degenerate_canvases() {
        // Empty input.
        assert!(treemap_squarify(&[], 0.0, 0.0, 100.0, 100.0).is_empty());
        // A single value takes the whole canvas.
        let single = treemap_squarify(&squarify_inputs(&[("only", 42.0)]), 0.0, 0.0, 100.0, 60.0);
        assert_eq!(single.len(), 1);
        assert_eq!(
            (single[0].x, single[0].y, single[0].w, single[0].h),
            (0.0, 0.0, 100.0, 60.0)
        );
        // Non-positive / non-finite weights are dropped.
        let filtered = treemap_squarify(
            &squarify_inputs(&[("a", 5.0), ("zero", 0.0), ("neg", -3.0), ("nan", f64::NAN)]),
            0.0,
            0.0,
            100.0,
            100.0,
        );
        assert_eq!(
            filtered.iter().map(|r| r.id.as_str()).collect::<Vec<_>>(),
            vec!["a"]
        );
        // Degenerate canvases.
        assert!(treemap_squarify(&squarify_inputs(&[("a", 1.0)]), 0.0, 0.0, 0.0, 100.0).is_empty());
        assert!(treemap_squarify(&squarify_inputs(&[("a", 1.0)]), 0.0, 0.0, 100.0, 0.0).is_empty());
    }

    #[test]
    fn treemap_squarify_is_deterministic_and_never_mutates_the_caller() {
        let input = squarify_inputs(&[("a", 3.0), ("b", 2.0), ("c", 2.0), ("d", 1.0)]);
        let snapshot = input.clone();
        let first = treemap_squarify(&input, 0.0, 0.0, 180.0, 90.0);
        let second = treemap_squarify(&input, 0.0, 0.0, 180.0, 90.0);
        assert_eq!(first, second, "the partition must be deterministic");
        assert_eq!(
            input, snapshot,
            "the canvas-area scaling must not write back"
        );
    }

    // ── pure layout: the group subdivision + the ladder ───────────────

    #[test]
    fn treemap_layout_cells_reserves_the_group_header_band() {
        let layout = treemap_build_layout(&[
            group("g", vec![leaf("a", 6.0), leaf("b", 4.0)]),
            leaf("c", 10.0),
        ]);
        assert_eq!(layout.nodes.len(), 2);
        assert!((layout.total - 20.0).abs() < 1e-9);
        let cells = treemap_layout_cells(&layout.nodes, 0.0, 0.0, 400.0, 200.0);
        assert_eq!(cells.len(), 2);
        let group_cell = cells.iter().find(|c| c.node.id == "g").expect("group cell");
        assert_eq!(group_cell.children.len(), 2, "the group subdivides");
        assert!((group_cell.node.percent - 50.0).abs() < 1e-9);
        let child = &group_cell.children[0];
        // Inside the padding box, BELOW the 22px header band + 2px pad.
        assert!(child.x >= group_cell.x + HK_TREEMAP_GROUP_PAD_PX - 1e-9);
        assert!(child.y >= group_cell.y + HK_TREEMAP_GROUP_HEADER_PX - 1e-9);
        let child_share: f64 = group_cell.children.iter().map(|c| c.node.percent).sum();
        assert!((child_share - 50.0).abs() < 1e-9);
    }

    #[test]
    fn treemap_layout_cells_stops_subdividing_in_an_extremely_narrow_box() {
        // A 10px-wide container: the group keeps its cell but cannot
        // subdivide (the `innerW > 8` guard), and a zero-size canvas yields
        // no cells at all.
        let layout = treemap_build_layout(&[group("g", vec![leaf("a", 6.0), leaf("b", 4.0)])]);
        let cells = treemap_layout_cells(&layout.nodes, 0.0, 0.0, 10.0, 400.0);
        assert_eq!(cells.len(), 1);
        assert!(
            cells[0].children.is_empty(),
            "narrow group stays a plain cell"
        );
        assert!(treemap_layout_cells(&layout.nodes, 0.0, 0.0, 0.0, 400.0).is_empty());
        assert!(treemap_layout_cells(&layout.nodes, 0.0, 0.0, 400.0, 0.0).is_empty());
        assert!(treemap_layout_cells(&[], 0.0, 0.0, 400.0, 400.0).is_empty());
    }

    #[test]
    fn treemap_cell_ladder_degrades_with_size() {
        // Roomy cell: label + value.
        let roomy = treemap_cell_ladder(160.0, 90.0, 1.0);
        assert!(roomy.show_label && roomy.show_value);
        // Label only: 60×24 clears the label floor, not the value floor.
        let label_only = treemap_cell_ladder(60.0, 24.0, 1.0);
        assert!(label_only.show_label && !label_only.show_value);
        // A sliver stays a silent colour block.
        let silent = treemap_cell_ladder(12.0, 10.0, 1.0);
        assert!(!silent.show_label && !silent.show_value);
        // Zooming a sliver up reveals its text (the stage's contract).
        let zoomed = treemap_cell_ladder(30.0, 20.0, 2.0);
        assert!(zoomed.show_label && zoomed.show_value);
    }

    // ── pure normalization: percentages + colour fallback ─────────────

    #[test]
    fn treemap_build_layout_drops_invalid_leaves_and_derives_percentages() {
        let layout = treemap_build_layout(&[
            leaf("a", 3.0),
            leaf("zero", 0.0),
            leaf("neg", -2.0),
            leaf("nan", f64::NAN),
            group("empty", vec![]),
            group("allbad", vec![leaf("bad", 0.0)]),
        ]);
        assert_eq!(
            layout
                .nodes
                .iter()
                .map(|n| n.id.as_str())
                .collect::<Vec<_>>(),
            vec!["a"]
        );
        // A group with no surviving leaf is dropped, an empty children array
        // is a leaf (Vue), and the empty leaf input yields the empty layout.
        assert!((layout.total - 3.0).abs() < 1e-9);
        assert!((layout.nodes[0].percent - 100.0).abs() < 1e-9);
        assert!(treemap_build_layout(&[]).nodes.is_empty());
        assert!(treemap_build_layout(&[leaf("zero", 0.0)]).nodes.is_empty());

        // A group's caller-supplied value is ignored in favour of its leaves.
        let derived = treemap_build_layout(&[TreemapNode {
            value: 999.0,
            ..group("g", vec![leaf("a", 2.0), leaf("b", 2.0)])
        }]);
        assert!((derived.total - 4.0).abs() < 1e-9);
        assert!((derived.nodes[0].percent - 100.0).abs() < 1e-9);
        assert!((derived.nodes[0].children.as_ref().unwrap()[0].percent - 50.0).abs() < 1e-9);
    }

    #[test]
    fn treemap_colors_parse_and_fall_back_inherited() {
        let hex = treemap_parse_css_color("#abc").expect("short hex");
        assert_eq!((hex.r, hex.g, hex.b), (170.0, 187.0, 204.0));
        assert_eq!(hex.a, 1.0);
        let alpha = treemap_parse_css_color("#11223380").expect("8-digit hex");
        assert!((alpha.a - 0.501960784).abs() < 1e-6);
        let rgb = treemap_parse_css_color("rgb(78 121 167 / 50%)").expect("rgb with alpha");
        assert_eq!((rgb.r, rgb.g, rgb.b), (78.0, 121.0, 167.0));
        assert!((rgb.a - 0.5).abs() < 1e-9);
        let hsl = treemap_parse_css_color("hsl(210, 36%, 48%)").expect("hsl");
        assert!(
            (hsl.r - 78.0).abs() < 1.0 && (hsl.g - 122.0).abs() < 1.0,
            "hsl must convert to the same family of channels: {hsl:?}"
        );
        // Translucent or unparseable values inherit the palette colour.
        assert_eq!(
            treemap_resolve_opaque_color("#aabbcc88", "#4e79a7"),
            "#4e79a7",
            "an alpha of 0x88/255 is translucent"
        );
        assert_eq!(
            treemap_resolve_opaque_color("rebeccapurple", "#f28e2b"),
            "#f28e2b"
        );
        assert_eq!(
            treemap_resolve_opaque_color("#4e79a7", "#f28e2b"),
            "rgb(78 121 167)"
        );
    }

    #[test]
    fn treemap_percent_text_matches_the_vue_ladder() {
        assert_eq!(treemap_format_percent(0.0), "0%");
        assert_eq!(treemap_format_percent(-4.0), "0%");
        assert_eq!(treemap_format_percent(f64::NAN), "0%");
        assert_eq!(treemap_format_percent(0.05), "<0.1%");
        assert_eq!(treemap_format_percent(0.1), "0.1%");
        assert_eq!(treemap_format_percent(66.66), "66.7%");
        assert_eq!(treemap_format_percent(100.0), "100%");
        assert_eq!(treemap_px(12.340000000000002), "12.34px");
        assert_eq!(treemap_px(0.0), "0px");
    }

    #[test]
    fn treemap_summary_walks_the_leaf_paths() {
        let layout = treemap_build_layout(&[
            group("g", vec![leaf("a", 3.0), leaf("b", 1.0)]),
            leaf("c", 4.0),
        ]);
        let summary = treemap_summary(&layout, None);
        assert!(summary.contains("g / a: 3 (37.5%)"), "{summary}");
        assert!(summary.contains("g / b: 1 (12.5%)"), "{summary}");
        assert!(summary.contains("c: 4 (50%)"), "{summary}");
        assert_eq!(summary.split("; ").count(), 3);
    }

    // ── DOM contract ──────────────────────────────────────────────────

    #[test]
    fn treemap_renders_the_legend_the_cells_and_the_summary() {
        let html = Treemap(TreemapProps {
            nodes: vec![
                group("g", vec![leaf("a", 6.0), leaf("b", 4.0)]),
                leaf("c", 10.0),
            ],
            width: 400.0,
            height: 200.0,
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-treemap\"",
            "hk-treemap__legend",
            "hk-treemap__legend-item",
            "hk-treemap__legend-swatch",
            "hk-treemap__body",
            "hk-treemap__chart",
            "hk-treemap__cell hk-treemap__cell--plate",
            "hk-treemap__cell hk-treemap__cell--group",
            "hk-treemap__group-head",
            "hk-treemap__leaf-body",
            "hk-treemap__a11y-summary",
            "aria-describedby=\"hk-treemap-summary\"",
            "height:200px",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(html.contains("g / a: 6 (30%)"), "summary text: {html}");
    }

    #[test]
    fn treemap_renders_the_empty_state_without_legend_or_summary() {
        let html = Treemap(TreemapProps {
            empty_text: "Nothing here".to_string(),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-treemap__empty"), "{html}");
        assert!(html.contains("Nothing here"), "{html}");
        assert!(!html.contains("hk-treemap__legend"), "{html}");
        assert!(!html.contains("hk-treemap__a11y-summary"), "{html}");
        assert!(!html.contains("aria-describedby"), "{html}");
    }

    #[test]
    fn treemap_styles_come_from_the_canonical_vue_sheet() {
        let css = TreemapComponent::styles();
        assert!(
            css.contains(".hk-treemap") && css.contains(".hk-treemap__cell"),
            "treemap css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored treemap sheet"
        );
        assert_eq!(TreemapComponent::name(), "treemap");
    }
}
