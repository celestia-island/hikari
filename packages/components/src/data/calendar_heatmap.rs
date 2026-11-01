// hi-components/src/data/calendar_heatmap.rs
// CalendarHeatmap — mirror of the canonical Vue `HkCalendarHeatmap`: a
// GitHub-style calendar heatmap of daily values.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCalendarHeatmap.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-calendar-heatmap*` class name is
// literal and identical in both forms. The DOM contract below mirrors the Vue
// render output:
//
//   div.hk-calendar-heatmap
//     div.hk-calendar-heatmap-head
//       span.hk-calendar-heatmap-legend[data-testid=hk-calendar-heatmap-legend]
//         {Less} span[data-legend-level=0..4]* {More}
//       {toolbar}                                  (slot)
//     div.hk-calendar-heatmap-scroll
//       div.hk-calendar-heatmap-body
//         div.hk-calendar-heatmap-rail[aria-hidden]     (style: row-gap)
//           span* (7; the first and last carry a weekday name)
//         div.hk-calendar-heatmap-cells
//           div.hk-calendar-heatmap-markers               (style: columns/gap)
//             span* (one per week column; month short name, or empty)
//           div.hk-calendar-heatmap-grid[data-testid][data-max]
//               [role=img][aria-label]
//             span[data-level][data-date][title]     (a day of the series)
//             span[data-gap][data-date][aria-hidden] (a hatched no-data cell)
//
// HkCalendarHeatmap paints DOM spans only (no `<svg>`), so no
// `dangerous_inner_html` host appears here: every cell is an element, and the
// only optional children (the toolbar slot) are spread as a vnode list.
//
// All the math lives in this file as PURE functions (pinned by the tests):
// the week/column grid ([`heatmap_calendar_grid`]), the intensity buckets and
// their fill/opacity ladder ([`heatmap_bucket_level`] /
// [`heatmap_cell_fill`] / [`heatmap_cell_opacity`]), the month markers, the
// inline grid geometry and the label formatters. The component only
// assembles nodes.
//
// Behaviour deltas vs Vue (documented, one per deviation):
//   * `today` is a PROP here (Vue calls `todayIso()` on every recompute). The
//     grid function always takes the date explicitly, so the component stays
//     clock-injectable; `None` falls back to the host's UTC today, which is
//     exactly Vue's behaviour.
//   * `Intl.DateTimeFormat` is replaced by the SAME locale layer the mirrored
//     `DatePicker`/`DateTag` use (`basic::DateLocale`, chrono `LC_TIME`):
//     weekday names come from `%a` anchored on 2024-01-01 (a Monday, the same
//     anchor Vue uses), month markers from `month_short`, and the cell title's
//     `dateStyle: "medium"` from `DateLocale::display_text`. Digits stay
//     Latin, and a locale whose chrono data differs from ICU's for a shape
//     inherits the Delta list `DateLocale` already documents.
//   * `language` is an explicit prop (`None` = the i18n context's active
//     language) so a host and its tests can pin the locale.
//   * The i18n strings resolve through `hikari_i18n::t` with the same
//     English fallbacks Vue carries (`less`/`more`/`summary`/`cellTitle`).
//   * A malformed `days[0].date` / `today` / `first` renders the EMPTY grid
//     instead of Vue's `Invalid Date` artifacts, and a non-finite day value
//     buckets to level 0.
//   * `number` text: JS `String(value)` becomes Rust `{}` (identical for the
//     ordinary counts this component carries).
//
// Replaces nothing: the family had no calendar heatmap before this mirror.

use chrono::{Datelike, NaiveDate};

use crate::basic::{DateLocale, active_language, date_locale};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CalendarHeatmapComponent;

// ── the intensity scale (Vue: the exported constants) ───────────────────

/// The empty cell (level 0) and the legend's first swatch fill: the muted
/// token washed out so "no consumption" stays distinct from "the smallest
/// consumption on record". Level 0 never rides the primary token.
pub const HEATMAP_EMPTY_FILL: &str = "color-mix(in srgb, var(--hi-color-muted) 40%, transparent)";

/// The fill every CONSUMING cell (levels 1–4) rides.
pub const HEATMAP_PRIMARY_FILL: &str = "var(--hi-color-primary)";

/// Opacity per CONSUMING bucket (levels 1–4) over the primary token, four
/// steps low → peak (Vue: `HEATMAP_LEVEL_OPACITY`, indexed by `level - 1`).
pub const HEATMAP_LEVEL_OPACITY: [&str; 4] = ["0.22", "0.42", "0.66", "0.95"];

/// The no-data cell (before the account's first activity / after today):
/// muted diagonal hatch over the surface. Rendered inert.
pub const HEATMAP_GAP_HATCH: &str = "repeating-linear-gradient(45deg, color-mix(in srgb, var(--hi-color-muted) 70%, transparent) 0px, color-mix(in srgb, var(--hi-color-muted) 70%, transparent) 2px, transparent 2px, transparent 4px)";

/// The legend's swatch levels, empty first (Vue: `LEGEND_LEVELS`).
pub const HEATMAP_LEGEND_LEVELS: [u8; 5] = [0, 1, 2, 3, 4];

/// The number of CONSUMING buckets (a day's level is 0…4 inclusive).
pub const HEATMAP_MAX_LEVEL: u8 = 4;

// ── input + cell model ─────────────────────────────────────────────────

/// One input day of the dense series. `value` may be zero or negative — it
/// still buckets to level 0.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct HeatmapDay {
    pub date: String,
    pub value: f64,
}

/// Why a cell carries no data (`before` the account's first activity,
/// `after` today).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum HeatmapGapPhase {
    #[default]
    Before,
    After,
}

impl HeatmapGapPhase {
    /// The `data-gap` attribute value.
    pub fn as_str(self) -> &'static str {
        match self {
            HeatmapGapPhase::Before => "before",
            HeatmapGapPhase::After => "after",
        }
    }
}

/// One heatmap cell: a real day of the series, or a gap the account has no
/// data for (the rest of the always-full-year window). Gaps render hatched
/// and inert; they never claim a fake zero.
#[derive(Clone, PartialEq, Debug)]
pub enum HeatmapCell {
    Day {
        date: String,
        value: f64,
        level: u8,
    },
    Gap {
        date: String,
        phase: HeatmapGapPhase,
    },
}

impl HeatmapCell {
    /// The cell's real calendar date (every cell carries one).
    pub fn date(&self) -> &str {
        match self {
            HeatmapCell::Day { date, .. } | HeatmapCell::Gap { date, .. } => date,
        }
    }

    /// True for the unarrived tail of the padded axis (Vue's
    /// `kind === "gap" && phase === "after"`).
    pub fn is_future_gap(&self) -> bool {
        matches!(
            self,
            HeatmapCell::Gap {
                phase: HeatmapGapPhase::After,
                ..
            }
        )
    }
}

// ── the scale (pure) ───────────────────────────────────────────────────

/// The fill of one cell: level 0 carries the empty wash, every consuming
/// level rides the primary token. The two channels stay independent — the
/// empty cell is never re-tinted primary and never takes an opacity step.
pub fn heatmap_cell_fill(level: u8) -> &'static str {
    if level == 0 {
        HEATMAP_EMPTY_FILL
    } else {
        HEATMAP_PRIMARY_FILL
    }
}

/// The opacity step of one cell: level 0 has none (its wash is the fill),
/// consuming levels index [`HEATMAP_LEVEL_OPACITY`] by `level - 1`.
pub fn heatmap_cell_opacity(level: u8) -> Option<&'static str> {
    if level == 0 {
        return None;
    }
    let index = usize::from(level.clamp(1, HEATMAP_MAX_LEVEL) - 1);
    Some(HEATMAP_LEVEL_OPACITY[index])
}

/// The heatmap's intensity bucket: 0 (none) … 4 (peak), scaled against the
/// window's max day. Zero/negative days are bucket 0; every consuming day
/// lands in 1..4 (ceil, so even the smallest consumption shows one step
/// above empty).
pub fn heatmap_bucket_level(value: f64, max: f64) -> u8 {
    if !value.is_finite() || !max.is_finite() || value <= 0.0 || max <= 0.0 {
        return 0;
    }
    let level = ((value / max) * f64::from(HEATMAP_MAX_LEVEL)).ceil();
    level.clamp(1.0, f64::from(HEATMAP_MAX_LEVEL)) as u8
}

/// The inline style of one day cell (fill + opacity channel).
pub fn heatmap_level_style(level: u8) -> String {
    let fill = heatmap_cell_fill(level);
    match heatmap_cell_opacity(level) {
        Some(opacity) => format!("border-radius:3px;background:{fill};opacity:{opacity}"),
        None => format!("border-radius:3px;background:{fill}"),
    }
}

/// The inline style of a no-data gap cell.
pub fn heatmap_gap_style() -> String {
    format!(
        "border-radius:3px;background:{};pointer-events:none",
        HEATMAP_GAP_HATCH
    )
}

// ── dates (pure; UTC day boundaries only) ───────────────────────────────

fn heatmap_parse_iso(iso: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(iso, "%Y-%m-%d").ok()
}

/// ISO date ± n days (UTC arithmetic only — no local timezone leaks).
pub fn heatmap_shift_iso(iso: &str, days: i64) -> Option<String> {
    let date = heatmap_parse_iso(iso)?;
    let shifted = if days >= 0 {
        date.checked_add_days(chrono::Days::new(days as u64))
    } else {
        date.checked_sub_days(chrono::Days::new(days.unsigned_abs()))
    }?;
    Some(shifted.format("%Y-%m-%d").to_string())
}

/// Monday-first weekday index of an ISO date (Mon = 0 … Sun = 6).
pub fn heatmap_weekday_index(iso: &str) -> Option<usize> {
    let date = heatmap_parse_iso(iso)?;
    Some(date.weekday().num_days_from_monday() as usize)
}

/// Today as an ISO date (UTC — the series' day boundary).
pub fn heatmap_today_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%d").to_string()
}

// ── the grid (pure) ────────────────────────────────────────────────────

/// Vue's `calendarGrid`: pad the dense series into the week-aligned calendar
/// grid — head cells back to the window's first Monday, tail cells to Sunday
/// — so a trailing-year window ALWAYS lands on a full-year-wide grid.
///
/// Every cell carries its real calendar date; cells outside `[first … today]`
/// become gaps (hatched, inert), except that a date the server actually
/// shipped is never hatched: a series running past `today` (a skewed server
/// clock, out of contract) keeps its data instead of vanishing behind the
/// hatch. The before-first hatch deliberately does NOT consult the value map:
/// the account's first-activity anchor is what decides that no data existed,
/// however many dense zero-filler rows arrive.
///
/// `max_override` pins the intensity scale; `None` derives it from `days`.
pub fn heatmap_calendar_grid(
    days: &[HeatmapDay],
    today: &str,
    first: Option<&str>,
    max_override: Option<f64>,
) -> Vec<HeatmapCell> {
    let first_row = match days.first() {
        Some(day) => day,
        None => return Vec::new(),
    };
    let start = match heatmap_parse_iso(&first_row.date) {
        Some(date) => date,
        None => return Vec::new(),
    };
    let today_date = match heatmap_parse_iso(today) {
        Some(date) => date,
        None => return Vec::new(),
    };
    let lead = start.weekday().num_days_from_monday() as usize;
    let grid_start = match start.checked_sub_days(chrono::Days::new(lead as u64)) {
        Some(date) => date,
        None => return Vec::new(),
    };
    let total = lead + days.len();
    let span = total + ((7 - (total % 7)) % 7);
    let max = max_override.unwrap_or_else(|| days.iter().fold(0.0f64, |m, d| m.max(d.value)));
    let mut value_by_date: std::collections::HashMap<&str, f64> =
        std::collections::HashMap::with_capacity(days.len());
    for day in days {
        value_by_date.insert(day.date.as_str(), day.value);
    }
    // A malformed / future `first` hatches nothing.
    let hatch_from = first
        .and_then(heatmap_parse_iso)
        .filter(|date| *date <= today_date);

    let mut cells: Vec<HeatmapCell> = Vec::with_capacity(span);
    for index in 0..span {
        let date = match grid_start.checked_add_days(chrono::Days::new(index as u64)) {
            Some(date) => date,
            None => break,
        };
        let iso = date.format("%Y-%m-%d").to_string();
        let shipped = value_by_date.get(iso.as_str()).copied();
        if date > today_date && shipped.is_none() {
            cells.push(HeatmapCell::Gap {
                date: iso,
                phase: HeatmapGapPhase::After,
            });
            continue;
        }
        if let Some(hatch) = hatch_from
            && date < hatch
        {
            cells.push(HeatmapCell::Gap {
                date: iso,
                phase: HeatmapGapPhase::Before,
            });
            continue;
        }
        // Dates in the head padding before the series' first row predate the
        // requested window — plain empty days, never gaps.
        let value = shipped.unwrap_or(0.0);
        cells.push(HeatmapCell::Day {
            date: iso,
            value,
            level: heatmap_bucket_level(value, max),
        });
    }
    cells
}

/// Vue's `monthMarkers`: a short month label over the week column that
/// CONTAINS a month's first day, `""` otherwise. The leading-month rule falls
/// out of that anchor: a window starting mid-month has no label over its
/// partial head, and no month lands one column late.
pub fn heatmap_month_markers(cells: &[HeatmapCell]) -> Vec<String> {
    let weeks = heatmap_weeks(cells);
    let mut markers: Vec<String> = Vec::with_capacity(weeks);
    // Belt-and-braces for hand-built cell lists: on a contiguous axis a
    // 7-day column holds at most one "01", so the dedup guard never fires.
    let mut last_first_month: i32 = -1;
    for week in 0..weeks {
        let mut month: Option<u32> = None;
        for row in 0..7 {
            let cell = match cells.get(week * 7 + row) {
                Some(cell) => cell,
                None => break,
            };
            let is_month_start = cell.date().get(8..10) == Some("01");
            if is_month_start && !cell.is_future_gap() {
                month = cell
                    .date()
                    .get(5..7)
                    .and_then(|raw| raw.parse::<u32>().ok());
                break;
            }
        }
        match month {
            Some(month) if month as i32 != last_first_month => markers.push(month.to_string()),
            _ => markers.push(String::new()),
        }
        if let Some(month) = month {
            last_first_month = month as i32;
        }
    }
    markers
}

/// The number of week columns the cell list occupies (Vue: `Math.ceil(len/7)`).
pub fn heatmap_weeks(cells: &[HeatmapCell]) -> usize {
    cells.len().div_ceil(7)
}

// ── the inline grid geometry (pure) ────────────────────────────────────

fn heatmap_px(value: f64) -> String {
    let rounded = (value * 100.0).round() / 100.0;
    if rounded == 0.0 {
        "0px".to_string()
    } else {
        format!("{rounded}px")
    }
}

/// `repeat(<weeks>, <cell>px)` — the shared column template.
pub fn heatmap_columns_style(weeks: usize, cell_size: f64) -> String {
    format!("repeat({weeks}, {})", heatmap_px(cell_size))
}

/// The grid's inline geometry: column template, the fixed 7-row rhythm, a
/// column-first flow and the cell gap.
pub fn heatmap_grid_style(weeks: usize, cell_size: f64, cell_gap: f64) -> String {
    format!(
        "grid-template-columns:{};grid-template-rows:repeat(7, {});grid-auto-flow:column;gap:{}",
        heatmap_columns_style(weeks, cell_size),
        heatmap_px(cell_size),
        heatmap_px(cell_gap)
    )
}

/// The month-marker row's inline geometry. A marker may overflow its column
/// into the empty columns ahead (the GitHub convention), so only a marker on
/// the LAST column reserves inline-end room for its ink.
pub fn heatmap_markers_style(
    weeks: usize,
    cell_size: f64,
    cell_gap: f64,
    trailing_pad: Option<&str>,
) -> String {
    let mut style = format!(
        "grid-template-columns:{};column-gap:{}",
        heatmap_columns_style(weeks, cell_size),
        heatmap_px(cell_gap)
    );
    if let Some(pad) = trailing_pad {
        style.push_str(";padding-inline-end:");
        style.push_str(pad);
    }
    style
}

/// The marker row's reserved trailing room when the last column is marked
/// (`cellSize * 2 + cellGap`), else `None`.
pub fn heatmap_markers_trailing_pad(
    markers: &[String],
    cell_size: f64,
    cell_gap: f64,
) -> Option<String> {
    match markers.last() {
        Some(last) if !last.is_empty() => Some(heatmap_px(cell_size * 2.0 + cell_gap)),
        _ => None,
    }
}

/// The weekday rail's row rhythm.
pub fn heatmap_rail_style(cell_gap: f64) -> String {
    format!("row-gap:{}", heatmap_px(cell_gap))
}

/// One rail row's height/line-height.
pub fn heatmap_rail_cell_style(cell_size: f64) -> String {
    format!(
        "height:{size};line-height:{size}",
        size = heatmap_px(cell_size)
    )
}

/// The legend swatch's inline geometry + the SAME fill/opacity decision the
/// cells ride (never a second, hand-written copy of the scale).
pub fn heatmap_legend_swatch_style(level: u8) -> String {
    let mut style = format!(
        "width:10px;height:10px;border-radius:2px;background:{};display:inline-block",
        heatmap_cell_fill(level)
    );
    if let Some(opacity) = heatmap_cell_opacity(level) {
        style.push_str(";opacity:");
        style.push_str(opacity);
    }
    style
}

// ── labels (the locale layer) ──────────────────────────────────────────

/// A Monday-first weekday name (Vue formats `Date.UTC(2024, 0, 1 + index)` —
/// 2024-01-01 IS a Monday, so the anchor is the same).
pub fn heatmap_weekday_label(locale: &DateLocale, index: usize) -> String {
    match NaiveDate::from_ymd_opt(2024, 1, 1 + index as u32) {
        Some(date) => date
            .format_localized("%a", locale.chrono_locale)
            .to_string(),
        None => String::new(),
    }
}

/// A month marker's short name (Vue: `{ month: "short" }` of the marker
/// number); an empty marker renders the empty slot.
pub fn heatmap_month_label(locale: &DateLocale, marker: &str) -> String {
    match marker.parse::<u32>() {
        Ok(month) if (1..=12).contains(&month) => locale.month_short(month),
        _ => String::new(),
    }
}

/// A cell's medium date text (Vue: `dateStyle: "medium"`).
pub fn heatmap_date_label(locale: &DateLocale, iso: &str) -> Option<String> {
    let date = heatmap_parse_iso(iso)?;
    Some(locale.display_text(date))
}

/// Minimal `{name}` interpolation, the same shapes the i18n bundles carry.
pub fn heatmap_fill_template(template: &str, vars: &[(&str, &str)]) -> String {
    let mut out = String::with_capacity(template.len());
    let mut rest = template;
    while let Some(open) = rest.find('{') {
        out.push_str(&rest[..open]);
        let after = &rest[open + 1..];
        match after.find('}') {
            Some(close) => {
                let key = &after[..close];
                if let Some((_, value)) = vars.iter().find(|(name, _)| *name == key) {
                    out.push_str(value);
                }
                rest = &after[close + 1..];
            }
            None => {
                out.push_str(&rest[open..]);
                rest = "";
            }
        }
    }
    out.push_str(rest);
    out
}

/// The plain decimal text of a value (Vue: `String(value)`).
pub fn heatmap_number_text(value: f64) -> String {
    format!("{value}")
}

/// One day cell's `title` (Vue: `cellTitle`) — `"{date} · {n} {unit}"`, or the
/// unitless template.
pub fn heatmap_cell_title(locale: &DateLocale, unit: &str, date: &str, value: f64) -> String {
    let date_text = heatmap_date_label(locale, date).unwrap_or_else(|| date.to_string());
    let number = heatmap_number_text(value);
    let template = if unit.is_empty() {
        hikari_i18n::t(
            "components.hk.calendarHeatmap.cellTitleNoUnit",
            "{date} · {n}",
        )
    } else {
        hikari_i18n::t(
            "components.hk.calendarHeatmap.cellTitle",
            "{date} · {n} {unit}",
        )
    };
    heatmap_fill_template(
        &template,
        &[("date", &date_text), ("n", &number), ("unit", unit)],
    )
}

/// The grid's accessible summary (Vue: `hikari::calendarHeatmap.summary`).
pub fn heatmap_summary(weeks: usize) -> String {
    let template = hikari_i18n::t(
        "components.hk.calendarHeatmap.summary",
        "Daily usage across {weeks} weeks",
    );
    heatmap_fill_template(&template, &[("weeks", &weeks.to_string())])
}

// ── props ──────────────────────────────────────────────────────────────

#[define_props]
pub struct CalendarHeatmapProps {
    /// The dense daily series, oldest → newest, inclusive of today.
    pub days: Vec<HeatmapDay>,

    /// The account's first activity date (Vue: `first`, null = never).
    pub first: Option<String>,

    /// The unit the legend/tooltip names ("" = unitless values).
    #[default]
    pub unit: String,

    /// Peak day pinned across windows; `None` derives it from `days`.
    pub max: Option<f64>,

    /// Square-cell scale (Vue: `cellSize`, default 14).
    #[default(14.0)]
    pub cell_size: f64,

    /// Gap between cells (Vue: `cellGap`, default 3).
    #[default(3.0)]
    pub cell_gap: f64,

    /// The UTC "today" the window is clamped against (Vue calls
    /// `todayIso()`); `None` = the host's UTC today.
    pub today: Option<String>,

    /// The label locale; `None` = the i18n context's active language.
    pub language: Option<hikari_i18n::Language>,

    /// The `toolbar` slot, right of the legend (range tabs / controls).
    pub toolbar: Option<Element>,
}

// ── render assembly (no math below this line) ───────────────────────────

fn heatmap_rail_nodes(locale: &DateLocale, cell_size: f64) -> Vec<VNode> {
    let mut nodes: Vec<VNode> = Vec::with_capacity(7);
    let style = heatmap_rail_cell_style(cell_size);
    for row in 0..7 {
        // The first (Monday) and last (Sunday) rows carry the labels.
        let label = if row == 0 || row == 6 {
            heatmap_weekday_label(locale, row)
        } else {
            String::new()
        };
        nodes.push(VNode::Element(Box::new(
            VElement::new("span")
                .style(style.clone())
                .child(VNode::Text(VText::new(&label))),
        )));
    }
    nodes
}

fn heatmap_marker_nodes(markers: &[String], locale: &DateLocale) -> Vec<VNode> {
    markers
        .iter()
        .map(|marker| {
            let label = heatmap_month_label(locale, marker);
            VNode::Element(Box::new(
                VElement::new("span").child(VNode::Text(VText::new(&label))),
            ))
        })
        .collect()
}

fn heatmap_cell_nodes(cells: &[HeatmapCell], locale: &DateLocale, unit: &str) -> Vec<VNode> {
    let mut nodes: Vec<VNode> = Vec::with_capacity(cells.len());
    for cell in cells {
        match cell {
            HeatmapCell::Gap { date, phase } => {
                nodes.push(VNode::Element(Box::new(
                    VElement::new("span")
                        .attr("data-gap", phase.as_str())
                        .attr("data-date", date.clone())
                        .attr("aria-hidden", "true")
                        .style(heatmap_gap_style()),
                )));
            }
            HeatmapCell::Day { date, value, level } => {
                nodes.push(VNode::Element(Box::new(
                    VElement::new("span")
                        .attr("data-level", i32::from(*level))
                        .attr("data-date", date.clone())
                        .attr("title", heatmap_cell_title(locale, unit, date, *value))
                        .style(heatmap_level_style(*level)),
                )));
            }
        }
    }
    nodes
}

fn heatmap_legend_nodes() -> Vec<VNode> {
    HEATMAP_LEGEND_LEVELS
        .iter()
        .map(|level| {
            VNode::Element(Box::new(
                VElement::new("span")
                    .attr("data-legend-level", i32::from(*level))
                    .style(heatmap_legend_swatch_style(*level)),
            ))
        })
        .collect()
}

#[component]
pub fn CalendarHeatmap(props: CalendarHeatmapProps) -> Element {
    let language = props.language.unwrap_or_else(active_language);
    let locale = date_locale(language);
    let today = props.today.clone().unwrap_or_else(heatmap_today_iso);
    let cells = heatmap_calendar_grid(&props.days, &today, props.first.as_deref(), props.max);
    let weeks = heatmap_weeks(&cells);
    let markers = heatmap_month_markers(&cells);
    let max = props
        .max
        .unwrap_or_else(|| props.days.iter().fold(0.0f64, |m, day| m.max(day.value)));
    let trailing_pad = heatmap_markers_trailing_pad(&markers, props.cell_size, props.cell_gap);

    let rail_nodes = heatmap_rail_nodes(&locale, props.cell_size);
    let marker_nodes = heatmap_marker_nodes(&markers, &locale);
    let cell_nodes = heatmap_cell_nodes(&cells, &locale, &props.unit);
    let legend_swatches = heatmap_legend_nodes();
    let legend_less = VNode::Text(VText::new(&hikari_i18n::t(
        "components.hk.calendarHeatmap.less",
        "Less",
    )));
    let legend_more = VNode::Text(VText::new(&hikari_i18n::t(
        "components.hk.calendarHeatmap.more",
        "More",
    )));
    let summary = heatmap_summary(weeks);
    let rail_style = heatmap_rail_style(props.cell_gap);
    let markers_style = heatmap_markers_style(
        weeks,
        props.cell_size,
        props.cell_gap,
        trailing_pad.as_deref(),
    );
    let grid_style = heatmap_grid_style(weeks, props.cell_size, props.cell_gap);
    // A slot is an `Element`, not a vnode array: collect it so the head can
    // spread it (an `if let` inside `rsx!` would have to be an expression).
    let toolbar_nodes: Vec<VNode> = match &props.toolbar {
        Some(toolbar) => vec![toolbar.clone()],
        None => Vec::new(),
    };

    // The legend row is built as ONE vnode run — Less, the five swatches,
    // More — so its order is Vue's by construction; the run is mounted as a
    // fragment (the same flattening `rsx!` applies when it spreads the
    // rail / marker / cell lists below).
    let toolbar_children: Vec<VNode> = toolbar_nodes;
    let legend_children: Vec<VNode> = {
        let mut nodes = vec![legend_less];
        nodes.extend(legend_swatches);
        nodes.push(legend_more);
        nodes
    };

    rsx! {
        div { class: "hk-calendar-heatmap",
            div { class: "hk-calendar-heatmap-head",
                span {
                    class: "hk-calendar-heatmap-legend",
                    "data-testid": "hk-calendar-heatmap-legend",
                    {VNode::Fragment(legend_children)}
                }
                {VNode::Fragment(toolbar_children)}
            }
            div { class: "hk-calendar-heatmap-scroll",
                div { class: "hk-calendar-heatmap-body",
                    div {
                        class: "hk-calendar-heatmap-rail",
                        "aria-hidden": "true",
                        style: rail_style,
                        ..rail_nodes
                    }
                    div { class: "hk-calendar-heatmap-cells",
                        div {
                            class: "hk-calendar-heatmap-markers",
                            style: markers_style,
                            ..marker_nodes
                        }
                        div {
                            class: "hk-calendar-heatmap-grid",
                            "data-testid": "hk-calendar-heatmap",
                            "data-max": heatmap_number_text(max),
                            role: "img",
                            "aria-label": summary,
                            style: grid_style,
                            ..cell_nodes
                        }
                    }
                }
            }
        }
    }
}

impl StyledComponent for CalendarHeatmapComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCalendarHeatmap.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "calendar-heatmap"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use hikari_i18n::Language;

    /// A Monday, for grid-shape assertions (the Vue suite's anchor too).
    const MON: &str = "2025-12-01";

    fn english() -> DateLocale {
        date_locale(Language::English)
    }

    fn day(date: &str, value: f64) -> HeatmapDay {
        HeatmapDay {
            date: date.to_string(),
            value,
        }
    }

    // ── props defaults ─────────────────────────────────────────────────

    #[test]
    fn calendar_heatmap_defaults_match_the_vue_props() {
        let props = CalendarHeatmapProps::default();
        assert!(props.days.is_empty());
        assert!(props.first.is_none());
        assert_eq!(props.unit, "");
        assert!(props.max.is_none());
        assert_eq!(props.cell_size, 14.0);
        assert_eq!(props.cell_gap, 3.0);
        assert!(props.today.is_none());
        assert!(props.language.is_none());
        assert!(props.toolbar.is_none());
    }

    // ── date math ──────────────────────────────────────────────────────

    #[test]
    fn heatmap_weekday_and_shift_math_is_monday_first_utc() {
        assert_eq!(heatmap_weekday_index(MON), Some(0)); // Monday
        assert_eq!(heatmap_weekday_index("2025-12-07"), Some(6)); // Sunday
        assert_eq!(heatmap_weekday_index("2025-12-02"), Some(1));
        assert_eq!(heatmap_weekday_index("not-a-date"), None);
        assert_eq!(heatmap_shift_iso(MON, 7).as_deref(), Some("2025-12-08"));
        assert_eq!(heatmap_shift_iso(MON, -1).as_deref(), Some("2025-11-30"));
        assert_eq!(
            heatmap_shift_iso("2026-01-01", -1).as_deref(),
            Some("2025-12-31")
        );
        assert_eq!(heatmap_shift_iso("", 1), None);
    }

    // ── the intensity scale ────────────────────────────────────────────

    #[test]
    fn heatmap_levels_keep_the_empty_channel_separate() {
        // Level 0 is the empty wash — never the primary token, never an
        // opacity step.
        assert_eq!(heatmap_cell_fill(0), HEATMAP_EMPTY_FILL);
        assert!(heatmap_cell_fill(0).contains("muted"));
        assert!(!heatmap_cell_fill(0).contains("primary"));
        assert_eq!(heatmap_cell_opacity(0), None);
        for level in 1..=HEATMAP_MAX_LEVEL {
            assert_eq!(heatmap_cell_fill(level), HEATMAP_PRIMARY_FILL);
            assert_eq!(
                heatmap_cell_opacity(level),
                Some(HEATMAP_LEVEL_OPACITY[usize::from(level - 1)])
            );
        }
        assert_eq!(
            heatmap_level_style(0),
            format!("border-radius:3px;background:{HEATMAP_EMPTY_FILL}")
        );
        assert_eq!(
            heatmap_level_style(4),
            "border-radius:3px;background:var(--hi-color-primary);opacity:0.95"
        );
        assert!(heatmap_gap_style().contains("pointer-events:none"));
        assert!(heatmap_gap_style().contains(HEATMAP_GAP_HATCH));
    }

    #[test]
    fn heatmap_buckets_scale_against_the_window_max() {
        assert_eq!(heatmap_bucket_level(0.0, 10.0), 0);
        assert_eq!(heatmap_bucket_level(-2.0, 10.0), 0);
        assert_eq!(heatmap_bucket_level(f64::NAN, 10.0), 0);
        assert_eq!(heatmap_bucket_level(5.0, 0.0), 0);
        // Even the smallest consumption shows one step above empty (ceil).
        assert_eq!(heatmap_bucket_level(0.5, 10.0), 1);
        assert_eq!(heatmap_bucket_level(2.5, 10.0), 1);
        assert_eq!(heatmap_bucket_level(3.0, 10.0), 2);
        assert_eq!(heatmap_bucket_level(7.5, 10.0), 3);
        assert_eq!(heatmap_bucket_level(10.0, 10.0), 4);
        // A pinned scale (the `max` prop) reaches the buckets.
        assert_eq!(heatmap_bucket_level(5.0, 40.0), 1);
    }

    // ── the grid ───────────────────────────────────────────────────────

    #[test]
    fn heatmap_grid_pads_to_full_weeks_and_hatches_outside_the_window() {
        // Empty input → empty grid.
        assert!(heatmap_calendar_grid(&[], "2025-12-03", None, None).is_empty());
        // A single Monday stays a 7-cell week: no lead padding.
        let week = heatmap_calendar_grid(&[day(MON, 1.0)], MON, None, None);
        assert_eq!(week.len(), 7);
        assert!(matches!(week[0], HeatmapCell::Day { .. }));
        // A single Wednesday gets 2 head cells back to Monday, then pads out
        // to Sunday — a full column.
        let midweek = heatmap_calendar_grid(&[day("2025-12-03", 1.0)], "2025-12-03", None, None);
        assert_eq!(midweek.len(), 7);
        assert_eq!(midweek[0].date(), "2025-12-01");
        assert_eq!(midweek[6].date(), "2025-12-07");
        // A day after `today` is a future gap (never a fake zero); the
        // unarrived tail hatches too.
        let ahead = heatmap_calendar_grid(&[day(MON, 1.0)], MON, None, None);
        assert!(ahead[1].is_future_gap(), "Monday+1 is after today");
        assert!(ahead.iter().skip(1).all(|cell| cell.is_future_gap()));
        // Levels ride the window max.
        let levels = heatmap_calendar_grid(
            &[day(MON, 10.0), day("2025-12-02", 5.0)],
            "2025-12-02",
            None,
            None,
        );
        match &levels[0] {
            HeatmapCell::Day { level, .. } => assert_eq!(*level, 4),
            other => panic!("expected a day cell, got {other:?}"),
        }
        match &levels[1] {
            HeatmapCell::Day { level, .. } => assert_eq!(*level, 2),
            other => panic!("expected a day cell, got {other:?}"),
        }
    }

    #[test]
    fn heatmap_grid_hatches_only_before_the_first_activity_anchor() {
        // The series carries dense zero filler BEFORE the account's first
        // activity: those cells are `before` gaps, not fake zeros.
        let days = [
            day("2025-12-01", 0.0),
            day("2025-12-02", 0.0),
            day("2025-12-03", 3.0),
        ];
        let cells = heatmap_calendar_grid(&days, "2025-12-03", Some("2025-12-03"), None);
        assert!(matches!(
            cells[0],
            HeatmapCell::Gap {
                phase: HeatmapGapPhase::Before,
                ..
            }
        ));
        assert!(matches!(
            cells[2],
            HeatmapCell::Day {
                value: 3.0,
                level: 4,
                ..
            }
        ));
        // A future / malformed `first` hatches nothing at all.
        for first in [Some("2026-06-01"), Some("garbage"), None] {
            let grid = heatmap_calendar_grid(&days, "2025-12-03", first, None);
            assert!(
                grid.iter().all(|cell| !matches!(
                    cell,
                    HeatmapCell::Gap {
                        phase: HeatmapGapPhase::Before,
                        ..
                    }
                )),
                "a {first:?} anchor must hatch nothing"
            );
        }
        // A date the server actually shipped is NEVER hatched as future,
        // even when it runs past `today` (a skewed server clock).
        let skewed = heatmap_calendar_grid(
            &[day("2025-12-01", 1.0), day("2025-12-02", 1.0)],
            "2025-12-01",
            None,
            None,
        );
        assert!(matches!(skewed[1], HeatmapCell::Day { .. }));
        // The empty grid never has cells to hatch.
        assert!(heatmap_weeks(&[]) == 0);
    }

    #[test]
    fn heatmap_month_markers_label_the_column_carrying_a_first() {
        // December 2025 starts on a Monday: one full month, one marker.
        let days: Vec<HeatmapDay> = (1..=14)
            .map(|day_of_month| day(&format!("2025-12-{day_of_month:02}"), 1.0))
            .collect();
        let cells = heatmap_calendar_grid(&days, "2025-12-14", None, None);
        let markers = heatmap_month_markers(&cells);
        assert_eq!(markers.len(), heatmap_weeks(&cells));
        assert_eq!(markers[0], "12");
        assert!(markers[1..].iter().all(|marker| marker.is_empty()));
        // A DENSE window crossing the month boundary never labels the partial
        // head month (its 1st is off-axis) but labels January on the column
        // carrying its 1st.
        let mut crossing: Vec<HeatmapDay> = Vec::new();
        let mut cursor = "2025-12-24".to_string();
        while cursor.as_str() <= "2026-01-05" {
            crossing.push(day(&cursor, 1.0));
            cursor = heatmap_shift_iso(&cursor, 1).expect("dense series shifts");
        }
        let crossing_cells = heatmap_calendar_grid(&crossing, "2026-01-05", None, None);
        let crossing_markers = heatmap_month_markers(&crossing_cells);
        assert_eq!(crossing_markers[0], "", "the head month's 1st is off-axis");
        assert!(
            crossing_markers.iter().any(|marker| marker == "1"),
            "January must be labelled: {crossing_markers:?}"
        );
        assert!(
            !crossing_markers.iter().any(|marker| marker == "12"),
            "December's 1st never appears on this axis: {crossing_markers:?}"
        );
        // An unarrived tail carries no marker for a month the chart does not
        // draw yet; an empty cell list has no markers at all.
        let padded = heatmap_calendar_grid(&[day("2025-12-29", 1.0)], "2025-12-29", None, None);
        assert!(!heatmap_month_markers(&padded).contains(&"1".to_string()));
        assert!(heatmap_month_markers(&[]).is_empty());
    }

    // ── the inline geometry ────────────────────────────────────────────

    #[test]
    fn heatmap_grid_geometry_stays_compact_and_pins_the_trailing_marker() {
        assert_eq!(heatmap_columns_style(53, 14.0), "repeat(53, 14px)");
        assert_eq!(
            heatmap_grid_style(2, 14.0, 3.0),
            "grid-template-columns:repeat(2, 14px);grid-template-rows:repeat(7, 14px);grid-auto-flow:column;gap:3px"
        );
        assert_eq!(heatmap_rail_style(3.0), "row-gap:3px");
        assert_eq!(
            heatmap_rail_cell_style(14.0),
            "height:14px;line-height:14px"
        );
        // Only a marker on the LAST column reserves trailing room.
        let marked = vec!["12".to_string(), "".to_string()];
        assert_eq!(
            heatmap_markers_trailing_pad(&marked, 14.0, 3.0),
            None,
            "the last column is unmarked"
        );
        let trailing = vec!["12".to_string(), "1".to_string()];
        assert_eq!(
            heatmap_markers_trailing_pad(&trailing, 14.0, 3.0).as_deref(),
            Some("31px")
        );
        assert_eq!(
            heatmap_markers_style(2, 14.0, 3.0, None),
            "grid-template-columns:repeat(2, 14px);column-gap:3px"
        );
        assert!(
            heatmap_markers_style(2, 14.0, 3.0, Some("31px")).ends_with(";padding-inline-end:31px")
        );
        assert_eq!(
            heatmap_legend_swatch_style(0),
            format!(
                "width:10px;height:10px;border-radius:2px;background:{HEATMAP_EMPTY_FILL};display:inline-block"
            )
        );
        assert!(heatmap_legend_swatch_style(3).ends_with(";opacity:0.66"));
    }

    // ── labels ─────────────────────────────────────────────────────────

    #[test]
    fn heatmap_labels_follow_the_active_locale_layer() {
        let english = english();
        assert_eq!(heatmap_weekday_label(&english, 0), "Mon");
        assert_eq!(heatmap_weekday_label(&english, 6), "Sun");
        assert_eq!(heatmap_month_label(&english, "12"), "Dec");
        assert_eq!(heatmap_month_label(&english, ""), "");
        assert_eq!(heatmap_month_label(&english, "13"), "");
        assert_eq!(
            heatmap_date_label(&english, "2025-12-01").as_deref(),
            Some("Dec 1, 2025")
        );
        assert_eq!(heatmap_date_label(&english, "nope"), None);
        assert_eq!(
            heatmap_cell_title(&english, "GB", "2025-12-01", 12.0),
            "Dec 1, 2025 · 12 GB"
        );
        assert_eq!(
            heatmap_cell_title(&english, "", "2025-12-01", 0.0),
            "Dec 1, 2025 · 0"
        );
        assert_eq!(
            heatmap_fill_template("{a} · {b} {unit}", &[("a", "x"), ("b", "y")]),
            "x · y "
        );
        assert_eq!(heatmap_summary(53), "Daily usage across 53 weeks");
    }

    // ── class-name mapping ────────────────────────────────────────────

    #[test]
    fn calendar_heatmap_class_names_match_the_vue_sheet() {
        let html = CalendarHeatmap(CalendarHeatmapProps {
            days: vec![day(MON, 1.0)],
            today: Some(MON.to_string()),
            language: Some(Language::English),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-calendar-heatmap\"",
            "class=\"hk-calendar-heatmap-head\"",
            "class=\"hk-calendar-heatmap-legend\"",
            "class=\"hk-calendar-heatmap-scroll\"",
            "class=\"hk-calendar-heatmap-body\"",
            "class=\"hk-calendar-heatmap-rail\"",
            "class=\"hk-calendar-heatmap-cells\"",
            "class=\"hk-calendar-heatmap-markers\"",
            "class=\"hk-calendar-heatmap-grid\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
    }

    // ── DOM contract ──────────────────────────────────────────────────

    #[test]
    fn calendar_heatmap_renders_the_legend_the_grid_and_the_gaps() {
        let html = CalendarHeatmap(CalendarHeatmapProps {
            days: vec![
                day("2025-12-01", 4.0),
                day("2025-12-02", 1.0),
                day("2025-12-03", 2.0),
            ],
            today: Some("2025-12-03".to_string()),
            first: Some("2025-12-01".to_string()),
            unit: "GB".to_string(),
            cell_size: 14.0,
            cell_gap: 3.0,
            language: Some(Language::English),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-calendar-heatmap\"",
            "hk-calendar-heatmap-head",
            "hk-calendar-heatmap-legend",
            "data-testid=\"hk-calendar-heatmap-legend\"",
            "data-legend-level=\"0\"",
            "data-legend-level=\"4\"",
            "hk-calendar-heatmap-scroll",
            "hk-calendar-heatmap-body",
            "hk-calendar-heatmap-rail",
            "hk-calendar-heatmap-markers",
            "hk-calendar-heatmap-grid",
            "data-testid=\"hk-calendar-heatmap\"",
            "data-max=\"4\"",
            "role=\"img\"",
            "grid-auto-flow:column",
            "data-level=\"4\"",
            "data-date=\"2025-12-01\"",
            "title=\"Dec 1, 2025 · 4 GB\"",
            "data-gap=\"after\"",
            "Less",
            "More",
            "Daily usage across 1 weeks",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // Monday and Sunday rail rows carry names, the others stay silent.
        assert!(html.contains(">Mon<"), "{html}");
        assert!(html.contains(">Sun<"), "{html}");
    }

    #[test]
    fn calendar_heatmap_renders_an_empty_grid_without_any_days() {
        let html = CalendarHeatmap(CalendarHeatmapProps {
            today: Some("2025-12-01".to_string()),
            language: Some(Language::English),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains("data-testid=\"hk-calendar-heatmap\""),
            "{html}"
        );
        assert!(!html.contains("data-level="), "{html}");
        assert!(!html.contains("data-gap="), "{html}");
        assert!(html.contains("data-max=\"0\""), "{html}");
    }

    #[test]
    fn calendar_heatmap_styles_come_from_the_canonical_vue_sheet() {
        let css = CalendarHeatmapComponent::styles();
        assert!(
            css.contains(".hk-calendar-heatmap-grid")
                && css.contains(".hk-calendar-heatmap-legend"),
            "calendar heatmap css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored calendar heatmap sheet"
        );
        assert_eq!(CalendarHeatmapComponent::name(), "calendar-heatmap");
    }
}
