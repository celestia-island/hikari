// hi-components/src/data/waterfall.rs
// Waterfall — mirror of the canonical Vue `HkWaterfall`: the base view for
// bucket-grouped card waterfalls (the chat reports / history / node list
// layouts share it).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkWaterfall.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so every `.hk-waterfall*` class name is literal and
// identical in both forms. The DOM contract below mirrors the Vue render
// output:
//
//   div.hk-waterfall[data-columns][aria-label?]
//     {rail}                                   (slot: behind the scroller)
//     div.hk-waterfall-scroll
//       ── no buckets ──
//       {empty}                                (slot)
//       ── else, one section per bucket ──
//       section.hk-waterfall-bucket[data-waterfall-bucket]
//         {bucket header}                      (per-bucket content)
//         div.hk-waterfall-columns
//           div.hk-waterfall-column[data-empty]*
//             {cards}                          (one per item, render order)
//     {overlay}                                (slot)
//
// HkWaterfall paints sections/columns of host-provided cards (no `<svg>` of
// its own), so no `dangerous_inner_html` host appears here: an absent header
// or slot is `empty_vnode()`.
//
// The layout math is PURE and lives in this file, pinned by the tests:
// the flat-stream bucketing ([`waterfall_group_buckets`]), the column count
// ([`waterfall_column_count`]), the one-bucket column distribution
// ([`waterfall_distribute`] — the OLDEST→NEWEST accumulation walk Vue
// performs), and the scroll-derived geometry the mechanism owns
// ([`waterfall_active_bucket`]'s hit test and
// [`waterfall_back_top_visible`]'s hysteresis). The component only assembles
// nodes.
//
// Behaviour deltas vs Vue (documented, one per deviation):
//   * NO `bucketOf` CALLBACK — Vue takes an opaque item stream plus a
//     `bucketOf(item, index)` function. Here the sections are data: the host
//     passes the already-bucketed [`WaterfallProps::buckets`], and a host that
//     holds one flat stream buckets it with
//     [`waterfall_group_buckets`] (which reads each item's own `bucket` field
//     and keeps Vue's first-appearance order). A per-bucket header rides
//     [`WaterfallBucket::header`] instead of a `bucketHeader` slot.
//   * NO WINDOWING / NO ANIMATION — Vue wraps every card in `HWindowedItem`
//     (estimated heights + overscan) inside an `HScrollContainer` running
//     `mode="windowed"`, and animates the columns through `HListTransition`.
//     Neither component is mirrored in this wave, so the mirror mounts every
//     card in static order inside a plain `overflow:auto` scroll region, and
//     the `animate` / `estimatedItemHeight`(`Of`) / `overscanScreens` /
//     `itemKeyOf` props are not part of the API. Consequence: a bucket with
//     thousands of cards pays full DOM cost; a host that needs windowing keeps
//     its own virtual list inside the card slot.
//   * NO MEASUREMENT API — `columns="auto"` needs the container width, which
//     Vue reads through a `ResizeObserver`. The mirror takes it as the
//     [`WaterfallProps::width`] prop (0 = unknown → one column).
//   * THE SCROLL MECHANISM IS HOST-OWNED: the active-bucket tracking (a
//     rAF-throttled pass over the sections' viewport-relative tops), the
//     `jumpToBucket`/`backToTop` scroll calls and the back-to-top visibility
//     signal all need a live scroll element. The mirror exports the pure
//     decision functions ([`waterfall_active_bucket`],
//     [`waterfall_back_top_visible`]) plus the validated section attribute
//     ([`waterfall_section_attr`]) so a host reproduces Vue's behaviour
//     exactly, and the `rail` slot already receives everything the host needs.
//   * `sectionAttr` is validated to `data-[a-z0-9-]+` (Vue's own rule) before
//     it can become an attribute name; anything else falls back to
//     `data-waterfall-bucket`.
//
// Replaces nothing: the family had no card waterfall before this mirror.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct WaterfallComponent;

/// The section attribute Vue falls back to (`sectionAttr`).
pub const WATERFALL_DEFAULT_SECTION_ATTR: &str = "data-waterfall-bucket";

/// Vue's `columnMinWidth` default (px).
pub const WATERFALL_DEFAULT_COLUMN_MIN_WIDTH: f64 = 320.0;

// ── input model ────────────────────────────────────────────────────────

/// One card of a waterfall. `bucket` is only read by
/// [`waterfall_group_buckets`] (the sections themselves carry their keys);
/// `content` is the mirrored `card` slot for that item.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct WaterfallItem {
    /// Stable identity of the card (Vue: `itemKeyOf`, or the positional
    /// fallback). Carried so a host that re-buckets never loses it.
    pub key: String,
    /// The bucket this item belongs to (Vue: `bucketOf(item, index)`).
    pub bucket: String,
    /// The card content (Vue: the `card` slot for this item).
    pub content: Element,
}

/// One section of the waterfall — a day section of the reports view, or the
/// single unnamed section of an ungrouped list.
#[derive(Clone, PartialEq, Debug, Default)]
pub struct WaterfallBucket {
    /// Bucket identity, mirrored onto the section's `data-*` attribute so a
    /// jump can address the section. Empty for an ungrouped list.
    pub key: String,
    /// The section header (Vue: the `bucketHeader` slot).
    pub header: Option<Element>,
    /// Items in display order (newest-first for the chat waterfalls).
    pub items: Vec<WaterfallItem>,
}

/// The column count: a fixed number, or `Auto` derived from the measured
/// width and `column_min_width` (Vue: `columns: number | "auto"`).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum WaterfallColumns {
    Count(usize),
    Auto,
}

impl Default for WaterfallColumns {
    fn default() -> Self {
        // Vue's `columns` default is 1.
        WaterfallColumns::Count(1)
    }
}

// ── bucketing (pure) ───────────────────────────────────────────────────

/// Group one flat item stream into sections by each item's own `bucket` key,
/// preserving FIRST-APPEARANCE order — exactly Vue's `Map`-backed
/// `bucketOf` walk.
pub fn waterfall_group_buckets(items: &[WaterfallItem]) -> Vec<WaterfallBucket> {
    let mut buckets: Vec<WaterfallBucket> = Vec::new();
    for item in items {
        match buckets.iter_mut().find(|bucket| bucket.key == item.bucket) {
            Some(bucket) => bucket.items.push(item.clone()),
            None => buckets.push(WaterfallBucket {
                key: item.bucket.clone(),
                header: None,
                items: vec![item.clone()],
            }),
        }
    }
    buckets
}

/// The attribute each section carries its bucket key on: only a plain
/// `data-*` attribute passes (Vue's `/^data-[a-z0-9-]+$/`), everything else
/// falls back — the prop is free text and must never become a selector.
pub fn waterfall_section_attr(raw: &str) -> String {
    let valid = raw.strip_prefix("data-").is_some_and(|rest| {
        !rest.is_empty()
            && rest
                .chars()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    });
    if valid {
        raw.to_string()
    } else {
        WATERFALL_DEFAULT_SECTION_ATTR.to_string()
    }
}

// ── columns (pure) ─────────────────────────────────────────────────────

/// Vue's `columnCount`: `Auto` derives the count from the measured width
/// (never below one, even for a container narrower than a single column),
/// a fixed count is floored at one.
pub fn waterfall_column_count(
    columns: WaterfallColumns,
    width: f64,
    column_min_width: f64,
) -> usize {
    match columns {
        WaterfallColumns::Auto => {
            if !width.is_finite() || width <= 0.0 {
                return 1;
            }
            let min_width = if column_min_width.is_finite() && column_min_width > 0.0 {
                column_min_width
            } else {
                1.0
            };
            let count = (width / min_width).floor();
            if count < 1.0 { 1 } else { count as usize }
        }
        WaterfallColumns::Count(count) => count.max(1),
    }
}

/// Distribute one bucket's `item_count` items across `cols` columns: walk
/// OLDEST → NEWEST (the last index backwards) into the currently SHORTEST
/// column, then insert at the front so each column stays newest-first. A
/// newly prepended (newest) item is the last step of the walk, so no older
/// item changes column — only the receiving column animates/repaints.
///
/// Returns item INDICES per column, in render order.
pub fn waterfall_distribute(item_count: usize, cols: usize) -> Vec<Vec<usize>> {
    let cols = cols.max(1);
    let mut columns: Vec<Vec<usize>> = vec![Vec::new(); cols];
    for index in (0..item_count).rev() {
        let mut target = 0usize;
        for column in 1..cols {
            if columns[column].len() < columns[target].len() {
                target = column;
            }
        }
        columns[target].insert(0, index);
    }
    columns
}

/// The `data-empty` marker of a column: an EMPTY column — a bucket with
/// fewer cards than columns — collapses (`flex: 0 0 0`) instead of eating a
/// share of the row and leaving the surviving card at half width.
pub fn waterfall_empty_column_attr(item_count: usize) -> Option<String> {
    if item_count == 0 {
        Some(String::new())
    } else {
        None
    }
}

// ── scroll geometry (pure) ─────────────────────────────────────────────

/// The active bucket from the sections' VIEWPORT-RELATIVE tops (each
/// `section.top - viewport.top`): the last section whose top passed
/// `threshold` below the viewport top. `None` means "nothing passed yet" —
/// Vue then falls back to the first bucket's key.
pub fn waterfall_active_bucket(tops: &[f64], threshold: f64) -> Option<usize> {
    let mut best: Option<usize> = None;
    for (index, top) in tops.iter().enumerate() {
        if !top.is_finite() {
            break;
        }
        if top - threshold <= 0.0 {
            best = Some(index);
        } else {
            // A later section can never be active once one has not passed.
            break;
        }
    }
    best
}

/// The back-to-top visibility hysteresis (Vue's `senseBackTop`): `show` gates
/// the whole signal, `hide` adds the hysteresis band, and inside the band the
/// previous state wins.
pub fn waterfall_back_top_visible(
    scroll_top: f64,
    show: Option<f64>,
    hide: Option<f64>,
    was_visible: bool,
) -> bool {
    let show = match show {
        Some(show) => show,
        None => return false,
    };
    match hide {
        Some(hide) => {
            if scroll_top > show {
                true
            } else if scroll_top < hide {
                false
            } else {
                was_visible
            }
        }
        None => scroll_top > show,
    }
}

// ── props ──────────────────────────────────────────────────────────────

#[define_props]
pub struct WaterfallProps {
    /// The sections to render (Vue: `items` + `bucketOf`).
    pub buckets: Vec<WaterfallBucket>,

    /// Column count, or `Auto` from `width` / `column_min_width`.
    #[default(WaterfallColumns::Count(1))]
    pub columns: WaterfallColumns,

    /// Minimum column width (px) used by `Auto` (Vue: `columnMinWidth`).
    #[default(WATERFALL_DEFAULT_COLUMN_MIN_WIDTH)]
    pub column_min_width: f64,

    /// Container width in px for `Auto` (Vue measures it; 0 = unknown →
    /// one column).
    #[default]
    pub width: f64,

    /// The `data-*` attribute carrying each section's bucket key (Vue:
    /// `sectionAttr`); validated by [`waterfall_section_attr`].
    #[default(WATERFALL_DEFAULT_SECTION_ATTR.to_string())]
    pub section_attr: String,

    /// Accessible label for the waterfall region (Vue: `ariaLabel`).
    pub aria_label: Option<String>,

    /// The `rail` slot, drawn behind the scroller (a timeline mirroring the
    /// buckets).
    pub rail: Option<Element>,

    /// The `overlay` slot (floating affordances such as a back-to-top FAB).
    pub overlay: Option<Element>,

    /// The `empty` slot, rendered instead of the sections when there are no
    /// buckets.
    pub empty: Option<Element>,
}

// ── render assembly (no math below this line) ───────────────────────────

fn waterfall_section_node(
    bucket: &WaterfallBucket,
    section_attr: &str,
    column_count: usize,
) -> VNode {
    let columns = waterfall_distribute(bucket.items.len(), column_count);
    let mut column_nodes: Vec<VNode> = Vec::with_capacity(columns.len());
    for column in &columns {
        let cards: Vec<VNode> = column
            .iter()
            .map(|index| bucket.items[*index].content.clone())
            .collect();
        column_nodes.push(VNode::Element(Box::new(
            VElement::new("div")
                .class("hk-waterfall-column")
                .apply_attr("data-empty", waterfall_empty_column_attr(column.len()))
                .children(cards),
        )));
    }
    let header = match &bucket.header {
        Some(header) => header.clone(),
        None => empty_vnode(),
    };
    VNode::Element(Box::new(
        VElement::new("section")
            .class("hk-waterfall-bucket")
            .apply_attr(section_attr, bucket.key.clone())
            .child(header)
            .child(VNode::Element(Box::new(
                VElement::new("div")
                    .class("hk-waterfall-columns")
                    .children(column_nodes),
            ))),
    ))
}

fn waterfall_slot_nodes(slot: &Option<Element>) -> Vec<VNode> {
    match slot {
        Some(node) => vec![node.clone()],
        None => Vec::new(),
    }
}

#[component]
pub fn Waterfall(props: WaterfallProps) -> Element {
    let section_attr = waterfall_section_attr(&props.section_attr);
    let column_count = waterfall_column_count(props.columns, props.width, props.column_min_width);
    let body: Vec<VNode> = if props.buckets.is_empty() {
        waterfall_slot_nodes(&props.empty)
    } else {
        props
            .buckets
            .iter()
            .map(|bucket| waterfall_section_node(bucket, &section_attr, column_count))
            .collect()
    };
    let rail_nodes = waterfall_slot_nodes(&props.rail);
    let overlay_nodes = waterfall_slot_nodes(&props.overlay);
    let aria_label = props.aria_label.clone();

    rsx! {
        div {
            class: "hk-waterfall",
            "data-columns": column_count as i32,
            "aria-label": aria_label,
            ..rail_nodes
            div { class: "hk-waterfall-scroll", ..body }
            ..overlay_nodes
        }
    }
}

impl StyledComponent for WaterfallComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkWaterfall.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "waterfall"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(key: &str, bucket: &str) -> WaterfallItem {
        WaterfallItem {
            key: key.to_string(),
            bucket: bucket.to_string(),
            content: rsx! { div { class: "card", {key.to_string()} } },
        }
    }

    fn bucket(key: &str, items: Vec<WaterfallItem>) -> WaterfallBucket {
        WaterfallBucket {
            key: key.to_string(),
            header: None,
            items,
        }
    }

    // ── props defaults ─────────────────────────────────────────────────

    #[test]
    fn waterfall_defaults_match_the_vue_props() {
        let props = WaterfallProps::default();
        assert!(props.buckets.is_empty());
        assert_eq!(props.columns, WaterfallColumns::Count(1));
        assert_eq!(props.column_min_width, WATERFALL_DEFAULT_COLUMN_MIN_WIDTH);
        assert_eq!(props.width, 0.0);
        assert_eq!(props.section_attr, WATERFALL_DEFAULT_SECTION_ATTR);
        assert!(props.aria_label.is_none());
        assert!(props.rail.is_none());
        assert!(props.overlay.is_none());
        assert!(props.empty.is_none());
    }

    // ── bucketing (pure) ───────────────────────────────────────────────

    #[test]
    fn waterfall_group_buckets_keeps_first_appearance_order() {
        // Empty stream → no sections.
        assert!(waterfall_group_buckets(&[]).is_empty());
        // A single item → one section with one card.
        let single = waterfall_group_buckets(&[item("a", "day-1")]);
        assert_eq!(single.len(), 1);
        assert_eq!(single[0].key, "day-1");
        assert_eq!(single[0].items.len(), 1);
        assert_eq!(single[0].items[0].key, "a");
        assert!(single[0].header.is_none());
        // Interleaved keys group in first-appearance order, keeping each
        // bucket's internal order (Vue's insertion-ordered Map).
        let grouped = waterfall_group_buckets(&[
            item("newest", "day-2"),
            item("older", "day-1"),
            item("oldest", "day-1"),
            item("also-new", "day-2"),
        ]);
        assert_eq!(
            grouped.iter().map(|b| b.key.as_str()).collect::<Vec<_>>(),
            vec!["day-2", "day-1"]
        );
        assert_eq!(
            grouped[0]
                .items
                .iter()
                .map(|item| item.key.as_str())
                .collect::<Vec<_>>(),
            vec!["newest", "also-new"]
        );
        assert_eq!(
            grouped[1]
                .items
                .iter()
                .map(|item| item.key.as_str())
                .collect::<Vec<_>>(),
            vec!["older", "oldest"]
        );
    }

    #[test]
    fn waterfall_section_attr_validates_before_it_can_become_an_attribute() {
        assert_eq!(
            waterfall_section_attr("data-waterfall-bucket"),
            "data-waterfall-bucket"
        );
        assert_eq!(waterfall_section_attr("data-day"), "data-day");
        assert_eq!(waterfall_section_attr("data-a1-b2"), "data-a1-b2");
        // Anything else falls back — including a selector-breaking key.
        for raw in [
            "",
            "data-",
            "id",
            "data-Upper",
            "data-x\"y",
            "data-x]",
            "DATa-x",
        ] {
            assert_eq!(
                waterfall_section_attr(raw),
                WATERFALL_DEFAULT_SECTION_ATTR,
                "invalid attr {raw:?} must fall back"
            );
        }
    }

    // ── the columns (pure) ─────────────────────────────────────────────

    #[test]
    fn waterfall_column_count_fixes_or_derives_the_count() {
        // Fixed counts: floored at one.
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Count(1), 0.0, 320.0),
            1
        );
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Count(4), 500.0, 320.0),
            4
        );
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Count(0), 500.0, 320.0),
            1
        );
        // Auto: floor(width / minWidth), never below one.
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Auto, 1000.0, 320.0),
            3
        );
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Auto, 640.0, 320.0),
            2
        );
        // Extremely narrow container / unknown width / a degenerate minimum:
        // one column, never zero and never a division by zero.
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Auto, 100.0, 320.0),
            1
        );
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Auto, 0.0, 320.0),
            1
        );
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Auto, 900.0, 0.0),
            900
        );
        assert_eq!(
            waterfall_column_count(WaterfallColumns::Auto, f64::NAN, 320.0),
            1
        );
    }

    #[test]
    fn waterfall_distribute_walks_oldest_to_newest_into_the_shortest_column() {
        // No items at all still yields the full column set (all empty).
        assert_eq!(waterfall_distribute(0, 3), vec![vec![], vec![], vec![]]);
        // One column keeps the stream's own order.
        assert_eq!(waterfall_distribute(3, 1), vec![vec![0, 1, 2]]);
        // A single item lands in the first column (ties keep the earlier
        // column).
        assert_eq!(waterfall_distribute(1, 2), vec![vec![0], vec![]]);
        // Five items across two columns: the older half fills column 0, the
        // newest items go to whichever column is currently shortest, and
        // every column stays newest-first.
        assert_eq!(waterfall_distribute(5, 2), vec![vec![0, 2, 4], vec![1, 3]]);
        // More columns than items: one card each, the rest collapsed.
        assert_eq!(waterfall_distribute(2, 3), vec![vec![1], vec![0], vec![]]);
        // The distribution is deterministic and never drops or duplicates an
        // index.
        let mut seen: Vec<usize> = waterfall_distribute(7, 3).into_iter().flatten().collect();
        seen.sort_unstable();
        assert_eq!(seen, vec![0, 1, 2, 3, 4, 5, 6]);
        assert_eq!(waterfall_distribute(7, 3), waterfall_distribute(7, 3));
    }

    #[test]
    fn waterfall_empty_columns_collapse() {
        assert_eq!(waterfall_empty_column_attr(0), Some(String::new()));
        assert_eq!(waterfall_empty_column_attr(1), None);
        assert_eq!(waterfall_empty_column_attr(9), None);
    }

    // ── the scroll geometry (pure) ─────────────────────────────────────

    #[test]
    fn waterfall_active_bucket_reads_the_viewport_relative_tops() {
        // Nothing has passed the threshold yet → the caller falls back to the
        // first bucket.
        assert_eq!(waterfall_active_bucket(&[], 24.0), None);
        assert_eq!(waterfall_active_bucket(&[100.0, 400.0], 24.0), None);
        // The threshold is inclusive: a top exactly at it counts as passed.
        assert_eq!(waterfall_active_bucket(&[24.0, 400.0], 24.0), Some(0));
        // The LAST passed section wins, and a later one that has not passed
        // stops the walk.
        assert_eq!(
            waterfall_active_bucket(&[-120.0, -10.0, 5.0], 24.0),
            Some(2)
        );
        assert_eq!(
            waterfall_active_bucket(&[-120.0, 300.0, 5.0], 24.0),
            Some(0)
        );
        // Nonsense geometry (NaN) never claims a section.
        assert_eq!(waterfall_active_bucket(&[-100.0, f64::NAN], 24.0), Some(0));
    }

    #[test]
    fn waterfall_back_top_visible_hysteresis_matches_the_scroll_host() {
        // `show` gates the whole signal.
        assert!(!waterfall_back_top_visible(9999.0, None, None, true));
        // Without `hide` it is the single `top > show` test.
        assert!(!waterfall_back_top_visible(100.0, Some(200.0), None, true));
        assert!(waterfall_back_top_visible(201.0, Some(200.0), None, false));
        // With `hide` the band keeps the previous state.
        assert!(waterfall_back_top_visible(
            300.0,
            Some(200.0),
            Some(120.0),
            false
        ));
        assert!(waterfall_back_top_visible(
            150.0,
            Some(200.0),
            Some(120.0),
            true
        ));
        assert!(!waterfall_back_top_visible(
            150.0,
            Some(200.0),
            Some(120.0),
            false
        ));
        assert!(!waterfall_back_top_visible(
            119.0,
            Some(200.0),
            Some(120.0),
            true
        ));
    }

    // ── class-name / attribute mapping ────────────────────────────────

    #[test]
    fn waterfall_attributes_mirror_the_vue_section_contract() {
        // `data-columns` is the root's column count; the section attribute is
        // the validated bucket-key carrier; an empty column carries
        // `data-empty`.
        assert_eq!(waterfall_section_attr("data-day"), "data-day");
        assert_eq!(
            waterfall_empty_column_attr(0).as_deref(),
            Some(""),
            "an empty column marks data-empty=\"\""
        );
    }

    // ── class-name mapping ────────────────────────────────────────────

    #[test]
    fn waterfall_class_names_match_the_vue_sheet() {
        let html = Waterfall(WaterfallProps {
            buckets: vec![bucket("day-1", vec![item("a", "day-1")])],
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-waterfall\"",
            "class=\"hk-waterfall-scroll\"",
            "class=\"hk-waterfall-bucket\"",
            "class=\"hk-waterfall-columns\"",
            "class=\"hk-waterfall-column\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(html.contains("data-columns=\"1\""), "{html}");
    }

    // ── DOM contract ──────────────────────────────────────────────────

    #[test]
    fn waterfall_renders_buckets_columns_and_the_empty_slot() {
        let html = Waterfall(WaterfallProps {
            buckets: vec![
                bucket("day-2", vec![item("a", "day-2")]),
                bucket(
                    "day-1",
                    vec![item("b", "day-1"), item("c", "day-1"), item("d", "day-1")],
                ),
            ],
            columns: WaterfallColumns::Count(2),
            aria_label: Some("Reports".to_string()),
            ..Default::default()
        })
        .render_to_html();
        for needle in [
            "class=\"hk-waterfall\"",
            "data-columns=\"2\"",
            "aria-label=\"Reports\"",
            "hk-waterfall-scroll",
            "hk-waterfall-bucket",
            "data-waterfall-bucket=\"day-2\"",
            "data-waterfall-bucket=\"day-1\"",
            "hk-waterfall-columns",
            "hk-waterfall-column",
            "data-empty=\"\"",
            "class=\"card\"",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        // day-2 has ONE card across two columns → the second column is empty;
        // day-1's three cards split 2/1.
        assert_eq!(html.matches("hk-waterfall-column\"").count(), 4);
        assert_eq!(html.matches("data-empty=\"\"").count(), 1);
    }

    #[test]
    fn waterfall_renders_the_empty_and_rail_slots() {
        let html = Waterfall(WaterfallProps {
            rail: Some(rsx! { div { class: "rail", "R" } }),
            empty: Some(rsx! { div { class: "empty-slot", "Nothing" } }),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("class=\"rail\""), "{html}");
        assert!(html.contains("empty-slot"), "{html}");
        assert!(!html.contains("hk-waterfall-bucket"), "{html}");
        // With no buckets and no slot there is simply nothing in the scroller.
        let bare = Waterfall(WaterfallProps::default()).render_to_html();
        assert!(bare.contains("hk-waterfall-scroll"), "{bare}");
        assert!(!bare.contains("hk-waterfall-bucket"), "{bare}");
    }

    #[test]
    fn waterfall_styles_come_from_the_canonical_vue_sheet() {
        let css = WaterfallComponent::styles();
        assert!(
            css.contains(".hk-waterfall")
                && css.contains(".hk-waterfall-bucket")
                && css.contains(".hk-waterfall-column"),
            "waterfall css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored waterfall sheet"
        );
        assert_eq!(WaterfallComponent::name(), "waterfall");
    }
}
