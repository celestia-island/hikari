// hi-components/src/data/selection_waterfall.rs
// SelectionWaterfall — mirror of the canonical Vue `HkSelectionWaterfall`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSelectionWaterfall.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the
// `.hk-selection-waterfall*` class names are literal and identical in both
// forms. DOM contract (mirrors Vue one-to-one):
//
//   div.hk-selection-waterfall                       (items present)
//     h4.hk-selection-waterfall-title?               (group_title)
//     div.hk-selection-waterfall-flow
//       div.hk-selection-waterfall-item  role="button" tabindex="0"
//           aria-selected={true|false} [data-selected]
//         span.hk-selection-waterfall-check?         (selected option only)
//           span[style="display:contents"]>svg       (10px lucide Check)
//         span.hk-selection-waterfall-name
//         span.hk-selection-waterfall-tag [data-variant]?
//         span.hk-selection-waterfall-desc?
//
// Selection STATE is a pure function of the controlled props (`multi` +
// `selected_ids`) — no signal, no local state. Single mode is defined by the
// EXACTLY-ONE rule the Vue template spells out
// (`selectedIds.length === 1 && selectedIds[0] === id`), so a stray multi-id
// array selects nothing instead of lighting up several pills;
// `selection_waterfall_next_selection` is the set operation a host applies in
// `on_select` (single replaces the set, multi toggles). The id-set primitives
// live with the sibling `SelectionGrid` mirror and are shared here — the two
// selection surfaces answer the same set questions.
//
// Layout math is pure and unit-tested instead of painted: the sheet lays the
// pills out with `display:flex; flex-wrap:wrap; gap: var(--space-6)`, so the
// mirror carries that rule as data — `selection_waterfall_wrap_rows` is the
// greedy wrap (a pill rides the current row while it fits and CROSSES to the
// next row otherwise; an oversized pill starts its own row instead of being
// pushed forever) and `selection_waterfall_rows` is the row count. An empty
// flow has no rows.
//
// NOTE on the wave brief's "cross-column duration conversion": this component
// has no time axis — neither it nor its sibling `HkSelectionGrid` declares a
// duration / span prop in either Vue source — so there is no duration math to
// mirror. The cross-column math it does have is the wrap-overflow rule above.
// Recorded so the omission reads as a documented delta.
//
// The SVG rides `dangerous_inner_html` (ledger L49: an rsx `svg {}` builds an
// HTML-namespace node that never paints) on its OWN `display:contents` host;
// the host is a span here because the pill's check wrapper is a span, and a
// `div` inside a span would be invalid phrasing content.
//
// Deltas vs Vue (documented): the `select` emit carries the option id
// (`EventHandler<String>`, like the sibling `SelectionGrid` / `Tree` mirrors)
// instead of the item object; `minColWidth` — which Vue declares but its
// template never consumes (there is no track template or `--min` var in the
// sheet) — is kept for prop parity and stays inert in both forms; `image` on
// the item is likewise declared upstream and never rendered; an empty `items`
// list renders the empty vnode (Vue returns `null`).

use crate::data::selection_grid::{
    selection_check_host, selection_has_id, selection_single_id, selection_toggle_id,
};
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SelectionWaterfallComponent;

/// The sheet's pill-flow gap in px (`.hk-selection-waterfall-flow { gap:
/// var(--space-6, 0.375rem) }`).
pub const SELECTION_WATERFALL_GAP_PX: f64 = 6.0;

/// Vue's `minColWidth` default — declared upstream, consumed nowhere (see the
/// header delta); kept so the prop contract matches.
pub const SELECTION_WATERFALL_MIN_COL_WIDTH_PX: f64 = 140.0;

/// One option of the flow (Vue: `WaterfallItem`).
#[derive(Clone, PartialEq, Debug, Default)]
pub struct SelectionWaterfallItem {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub tag: Option<String>,
    /// The tag's `data-variant` (Vue: `tagVariant`, absent for the plain
    /// treatment the sheet's base rule paints).
    pub tag_variant: Option<String>,
    /// Declared upstream and never rendered (no image rule in the sheet) —
    /// kept for prop parity.
    pub image: Option<String>,
}

/// Whether one pill is drawn as selected — the Vue rule verbatim: multi mode
/// asks the id set, single mode trusts only a one-element id list.
pub fn selection_waterfall_is_selected(
    multi: bool,
    selected_ids: &[String],
    item_id: &str,
) -> bool {
    if multi {
        selection_has_id(selected_ids, item_id)
    } else {
        selection_single_id(selected_ids) == Some(item_id)
    }
}

/// The id set a click produces, i.e. the set operation a host applies in
/// `on_select`: single mode REPLACES the set (exactly one pill stays selected,
/// re-clicking it keeps it selected — Vue's single mode has no deselect),
/// multi mode toggles the clicked id.
pub fn selection_waterfall_next_selection(
    multi: bool,
    selected_ids: &[String],
    item_id: &str,
) -> Vec<String> {
    if multi {
        selection_toggle_id(selected_ids, item_id)
    } else {
        vec![item_id.to_string()]
    }
}

/// The row each pill lands on under the sheet's `flex-wrap: wrap` flow: a pill
/// stays on the current row while it still fits (`used + gap + width <=
/// available_width`) and crosses to the next row otherwise. The first pill of a
/// row always starts it — an oversized pill must not be pushed forever, so it
/// simply takes a row of its own (the sheet lets it overflow that row rather
/// than trapping the flow).
pub fn selection_waterfall_wrap_rows(
    pill_widths: &[f64],
    available_width: f64,
    gap: f64,
) -> Vec<usize> {
    let gap = if gap.is_finite() { gap.max(0.0) } else { 0.0 };
    let mut rows = Vec::with_capacity(pill_widths.len());
    let mut row = 0usize;
    let mut used = 0.0f64;
    let mut row_empty = true;
    for width in pill_widths {
        let width = if width.is_finite() {
            width.max(0.0)
        } else {
            0.0
        };
        if row_empty {
            used = width;
            row_empty = false;
        } else if used + gap + width <= available_width {
            used += gap + width;
        } else {
            row += 1;
            used = width;
        }
        rows.push(row);
    }
    rows
}

/// The number of wrapped rows the flow occupies; an empty flow has none.
pub fn selection_waterfall_rows(pill_widths: &[f64], available_width: f64, gap: f64) -> usize {
    match selection_waterfall_wrap_rows(pill_widths, available_width, gap).last() {
        Some(last) => last + 1,
        None => 0,
    }
}

#[define_props]
pub struct SelectionWaterfallProps {
    /// The options (required upstream; an empty list renders nothing).
    #[default]
    pub items: Vec<SelectionWaterfallItem>,

    /// The selected ids (Vue: `selectedIds`, default `[]`). Single mode reads
    /// this list through the exactly-one rule.
    #[default]
    pub selected_ids: Vec<String>,

    /// Multi-select mode (default false).
    #[default]
    pub multi: bool,

    pub group_title: Option<String>,

    /// Inert in both forms (see the header delta; Vue default 140).
    #[default(SELECTION_WATERFALL_MIN_COL_WIDTH_PX)]
    pub min_col_width: f64,

    /// Fired with the clicked option's id (Vue emits the item object).
    pub on_select: Option<EventHandler<String>>,
}

#[component]
pub fn SelectionWaterfall(props: SelectionWaterfallProps) -> Element {
    // Vue renders `null` for an empty list; an empty vnode is that nothing.
    if props.items.is_empty() {
        return empty_vnode();
    }

    let mut pills: Vec<VNode> = Vec::with_capacity(props.items.len());
    for item in &props.items {
        let is_selected =
            selection_waterfall_is_selected(props.multi, &props.selected_ids, &item.id);

        let mut pill = VElement::new("div")
            .key(item.id.as_str())
            .class("hk-selection-waterfall-item")
            .attr("role", "button")
            .attr("tabindex", "0")
            .attr("aria-selected", if is_selected { "true" } else { "false" });
        if is_selected {
            pill = pill.attr("data-selected", "");
            // The check wrapper only exists on a selected pill (Vue's
            // conditional render, unlike the grid's faded-in cell).
            pill = pill.child(VNode::Element(Box::new(
                VElement::new("span")
                    .class("hk-selection-waterfall-check")
                    .child(selection_check_host("span", 10)),
            )));
        }
        pill = pill.child(rsx! {
            span { class: "hk-selection-waterfall-name", {item.title.clone()} }
        });
        if let Some(tag) = &item.tag {
            pill = pill.child(rsx! {
                span {
                    class: "hk-selection-waterfall-tag",
                    "data-variant": item.tag_variant.clone(),
                    {tag.clone()}
                }
            });
        }
        if let Some(description) = &item.description {
            pill = pill.child(rsx! {
                span { class: "hk-selection-waterfall-desc", {description.clone()} }
            });
        }

        let select = props.on_select.clone();
        let select_id = item.id.clone();
        pill = pill.on_click(move |_: MouseEvent| {
            if let Some(handler) = &select {
                handler.call(select_id.clone());
            }
        });
        let select = props.on_select.clone();
        let select_id = item.id.clone();
        pill = pill.on_keydown(move |event: KeyboardEvent| {
            if event.key != "Enter" && event.key != " " {
                return;
            }
            event.prevent_default();
            if let Some(handler) = &select {
                handler.call(select_id.clone());
            }
        });

        pills.push(VNode::Element(Box::new(pill)));
    }

    let flow = VElement::new("div")
        .class("hk-selection-waterfall-flow")
        .children(pills);

    let mut root = VElement::new("div").class("hk-selection-waterfall");
    if let Some(title) = &props.group_title {
        root = root.child(rsx! {
            h4 { class: "hk-selection-waterfall-title", {title.clone()} }
        });
    }
    root = root.child(VNode::Element(Box::new(flow)));
    VNode::Element(Box::new(root))
}

impl StyledComponent for SelectionWaterfallComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSelectionWaterfall.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "selection-waterfall"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str) -> SelectionWaterfallItem {
        SelectionWaterfallItem {
            id: id.to_string(),
            title: format!("Pill {id}"),
            ..Default::default()
        }
    }

    fn ids(ids: &[&str]) -> Vec<String> {
        ids.iter().map(|id| id.to_string()).collect()
    }

    #[test]
    fn selection_waterfall_defaults_match_the_vue_props() {
        let props = SelectionWaterfallProps::default();
        assert!(props.items.is_empty());
        assert!(props.selected_ids.is_empty());
        assert!(!props.multi);
        assert!(props.group_title.is_none());
        assert_eq!(props.min_col_width, SELECTION_WATERFALL_MIN_COL_WIDTH_PX);
        assert_eq!(props.min_col_width, 140.0);
        assert!(props.on_select.is_none());
    }

    #[test]
    fn selection_waterfall_single_mode_is_mutually_exclusive() {
        // Empty set: nothing selected.
        assert!(!selection_waterfall_is_selected(false, &[], "a"));
        // Exactly one id: only that pill is selected.
        assert!(selection_waterfall_is_selected(false, &ids(&["a"]), "a"));
        assert!(!selection_waterfall_is_selected(false, &ids(&["a"]), "b"));
        // The exactly-one rule: a stray multi-id array selects NOTHING.
        let all = ids(&["a", "b"]);
        assert!(!selection_waterfall_is_selected(false, &all, "a"));
        assert!(!selection_waterfall_is_selected(false, &all, "b"));
        // A click replaces the set, and re-clicking keeps the pill selected.
        assert_eq!(
            selection_waterfall_next_selection(false, &ids(&["a"]), "b"),
            ids(&["b"])
        );
        assert_eq!(
            selection_waterfall_next_selection(false, &ids(&["a"]), "a"),
            ids(&["a"])
        );
    }

    #[test]
    fn selection_waterfall_multi_mode_selects_the_listed_ids_and_toggles() {
        // Empty set: the first click selects.
        assert!(!selection_waterfall_is_selected(true, &[], "a"));
        assert_eq!(
            selection_waterfall_next_selection(true, &[], "a"),
            ids(&["a"])
        );
        // All selected: every listed id answers true.
        let all = ids(&["a", "b", "c"]);
        assert!(selection_waterfall_is_selected(true, &all, "a"));
        assert!(selection_waterfall_is_selected(true, &all, "c"));
        // Toggling a member removes exactly that member.
        assert_eq!(
            selection_waterfall_next_selection(true, &all, "b"),
            ids(&["a", "c"])
        );
        // Toggling it back re-appends (Vue: `[...ids, id]`).
        assert_eq!(
            selection_waterfall_next_selection(true, &ids(&["a", "c"]), "b"),
            ids(&["a", "c", "b"])
        );
    }

    #[test]
    fn selection_waterfall_wrap_rows_cross_the_row_on_overflow() {
        let gap = SELECTION_WATERFALL_GAP_PX;
        // 100 + 6 + 100 = 206 fits in 250; adding a third pill crosses over.
        assert_eq!(
            selection_waterfall_wrap_rows(&[100.0, 100.0, 100.0], 250.0, gap),
            vec![0, 0, 1]
        );
        // Everything fits on one row.
        assert_eq!(
            selection_waterfall_wrap_rows(&[10.0, 20.0], 250.0, gap),
            vec![0, 0]
        );
        // An oversized pill takes its own row instead of trapping the flow.
        assert_eq!(
            selection_waterfall_wrap_rows(&[400.0, 50.0], 250.0, gap),
            vec![0, 1]
        );
        // The empty flow has no rows at all.
        assert_eq!(
            selection_waterfall_wrap_rows(&[], 250.0, gap),
            Vec::<usize>::new()
        );
    }

    #[test]
    fn selection_waterfall_rows_counts_the_wrapped_rows() {
        let gap = SELECTION_WATERFALL_GAP_PX;
        assert_eq!(selection_waterfall_rows(&[], 250.0, gap), 0);
        assert_eq!(selection_waterfall_rows(&[100.0], 250.0, gap), 1);
        assert_eq!(
            selection_waterfall_rows(&[100.0, 100.0, 100.0], 250.0, gap),
            2
        );
        // A degenerate width still lays every pill out (one row each).
        assert_eq!(selection_waterfall_rows(&[10.0, 10.0], 0.0, gap), 2);
    }

    #[test]
    fn selection_waterfall_wrap_rows_honours_the_gap() {
        // The same widths pack into one row at gap 0 and cross over at the
        // sheet's 6px gap — the gap is the only thing that changed.
        assert_eq!(
            selection_waterfall_wrap_rows(&[80.0, 80.0, 80.0], 250.0, 0.0),
            vec![0, 0, 0]
        );
        assert_eq!(
            selection_waterfall_wrap_rows(&[80.0, 80.0, 80.0], 250.0, SELECTION_WATERFALL_GAP_PX),
            vec![0, 0, 1]
        );
        // A non-finite pill width collapses to zero rather than poisoning the
        // row arithmetic.
        assert_eq!(
            selection_waterfall_wrap_rows(&[f64::NAN, 10.0], 250.0, SELECTION_WATERFALL_GAP_PX),
            vec![0, 0]
        );
    }

    #[test]
    fn selection_waterfall_renders_the_vue_dom() {
        let html = SelectionWaterfall(SelectionWaterfallProps {
            group_title: Some("Pick a node".to_string()),
            items: vec![
                SelectionWaterfallItem {
                    tag: Some("edge".to_string()),
                    tag_variant: Some("info".to_string()),
                    description: Some("gateway".to_string()),
                    ..item("a")
                },
                item("b"),
            ],
            selected_ids: ids(&["a"]),
            ..Default::default()
        })
        .render_to_html();

        for needle in [
            "hk-selection-waterfall",
            "hk-selection-waterfall-title",
            "hk-selection-waterfall-flow",
            "hk-selection-waterfall-item",
            "hk-selection-waterfall-name",
            "hk-selection-waterfall-tag",
            "hk-selection-waterfall-desc",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(html.contains(r#"role="button""#), "{html}");
        assert!(html.contains(r#"tabindex="0""#), "{html}");
        assert!(html.contains(r#"data-variant="info""#), "{html}");
        // The check wrapper exists only on the selected pill.
        assert_eq!(
            html.matches("hk-selection-waterfall-check").count(),
            1,
            "{html}"
        );
        assert!(
            html.contains("<svg") && html.contains(r#"width="10""#),
            "the check glyph must ride the innerHTML host: {html}"
        );
        assert_eq!(html.matches(r#"aria-selected="true""#).count(), 1, "{html}");
        assert_eq!(html.matches("data-selected=\"\"").count(), 1, "{html}");
    }

    #[test]
    fn selection_waterfall_multi_mode_renders_every_listed_pill_as_selected() {
        let html = SelectionWaterfall(SelectionWaterfallProps {
            items: vec![item("a"), item("b"), item("c")],
            multi: true,
            selected_ids: ids(&["a", "c"]),
            ..Default::default()
        })
        .render_to_html();
        assert_eq!(html.matches(r#"aria-selected="true""#).count(), 2, "{html}");
        assert_eq!(html.matches("data-selected=\"\"").count(), 2, "{html}");
        assert_eq!(
            html.matches("hk-selection-waterfall-check").count(),
            2,
            "{html}"
        );
    }

    #[test]
    fn selection_waterfall_single_mode_selects_nothing_from_a_stray_array() {
        // The exactly-one rule reaches the DOM: two ids mean no selection.
        let html = SelectionWaterfall(SelectionWaterfallProps {
            items: vec![item("a"), item("b")],
            selected_ids: ids(&["a", "b"]),
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains(r#"aria-selected="true""#), "{html}");
        assert!(!html.contains("hk-selection-waterfall-check"), "{html}");
    }

    #[test]
    fn selection_waterfall_empty_list_renders_nothing() {
        let html = SelectionWaterfall(SelectionWaterfallProps::default()).render_to_html();
        assert!(
            html.is_empty(),
            "an empty flow renders the empty vnode: {html}"
        );
    }

    #[test]
    fn selection_waterfall_registers_under_its_vue_name() {
        // The style registry key both forms bundle the sheet under.
        assert_eq!(SelectionWaterfallComponent::name(), "selection-waterfall");
    }

    #[test]
    fn selection_waterfall_styles_come_from_the_canonical_vue_sheet() {
        let css = SelectionWaterfallComponent::styles();
        assert!(
            css.contains(".hk-selection-waterfall") && css.contains(".hk-selection-waterfall-item"),
            "selection waterfall css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored selection waterfall sheet"
        );
    }
}
