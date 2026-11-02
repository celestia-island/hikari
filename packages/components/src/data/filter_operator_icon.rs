// hi-components/src/data/filter_operator_icon.rs
// FilterOperatorIcon — mirror of the canonical Vue `HkFilterOperatorIcon`: the
// filter operator's glyph as an ICON, never a text character.
//
// STYLESHEET: none, on purpose. The canonical Vue component ships no sheet of
// its own — `scripts/sync-vue-mirror.py`'s W3 `DATA_SHEETS` list says so in as
// many words ("HkTrendChart and HkFilterOperatorIcon have no sheet of their
// own (they compose chart/filter sheets already vendored or imported by their
// parents)") — and its render emits no class name the sheet could target: the
// glyph is sized and inked by whoever hosts it (`.hk-filter-panel-op` carries
// the color and the box). `styles()` is therefore the empty sheet, the same
// convention `basic::kbd` established.
//
// DOM contract (Vue renders the bare `<svg>` as the component root):
//
//   span[style="display:contents"]        (the crate-wide SVG host: an rsx
//                                          `svg {}` child would be an HTML
//                                          element, and `dangerous_inner_html`
//                                          suppresses an element's children —
//                                          so the svg gets its OWN boxless host)
//     <svg xmlns width={size} height={size} viewBox="0 0 24 24" fill="none"
//          stroke="currentColor" stroke-width="2" stroke-linecap="round"
//          stroke-linejoin="round" [class="lucide lucide-{name}"]
//          aria-hidden="true">
//       <path d="…"/> | <line x1 x2 y1 y2/>   (the operator's geometry)
//     </svg>
//
// Glyph family (user direction 2026-10-15: font stacks render U+2249 ≉
// unevenly — the operator buttons are UI chrome, so they draw like every other
// icon in the family). Lucide ships =, ≠ and ≈; the ordered four and ≉ are
// hikari-authored in lucide's exact stroke grammar (24×24, stroke 2,
// currentColor), and ≉ is lucide's own ≈ path pair with EqualNot's slash
// composed in, so the set reads as one family. The path data below is copied
// VERBATIM from `HkFilterOperatorIcon.tsx` (the hikari-authored five) and from
// lucide's `equal` / `equal-not` / `equal-approximately` icon nodes (ISC) —
// `<line>` elements included, because that is what lucide draws for = and ≠.
//
// Deltas vs Vue (documented, not accidental):
//   * the glyph is TRUSTED STATIC MARKUP through `dangerous_inner_html` on the
//     `display: contents` host (crate-wide SVG rule), so the DOM carries one
//     extra boxless `span` around the svg Vue renders directly.
//   * lucide's own class token pair is spelled `lucide lucide-{name}` — the
//     crate's inlined-lucide convention (`entry/number_steppers.rs`), not
//     lucide-vue-next 1.0.0's `lucide lucide-{name}-icon lucide-{name}`. The
//     hikari-authored five carry NO class at all, exactly the Vue component.
//   * `op` is Vue's required prop; `#[define_props]` makes every Rust field
//     total, so the mirror's `Default` is `FilterOperator::Eq`.

use crate::data::filter_panel::FilterOperator;
use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct FilterOperatorIconComponent;

/// One drawing primitive of a glyph. `Line` exists because lucide draws `=` and
/// `≠` with `<line>` elements, not paths — keeping the shape keeps the emitted
/// markup the same svg Vue renders.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum FilterOperatorGlyph {
    Path(&'static str),
    Line {
        x1: &'static str,
        y1: &'static str,
        x2: &'static str,
        y2: &'static str,
    },
}

/// `Equal` (lucide, ISC): two full-width rules.
const EQUAL_GLYPH: [FilterOperatorGlyph; 2] = [
    FilterOperatorGlyph::Line {
        x1: "5",
        y1: "9",
        x2: "19",
        y2: "9",
    },
    FilterOperatorGlyph::Line {
        x1: "5",
        y1: "15",
        x2: "19",
        y2: "15",
    },
];

/// `EqualNot` (lucide, ISC): the two rules plus the slash.
const EQUAL_NOT_GLYPH: [FilterOperatorGlyph; 3] = [
    FilterOperatorGlyph::Line {
        x1: "5",
        y1: "9",
        x2: "19",
        y2: "9",
    },
    FilterOperatorGlyph::Line {
        x1: "5",
        y1: "15",
        x2: "19",
        y2: "15",
    },
    FilterOperatorGlyph::Line {
        x1: "19",
        y1: "5",
        x2: "5",
        y2: "19",
    },
];

/// `EqualApproximately` (lucide, ISC): the fuzzy pair.
const EQUAL_APPROXIMATELY_GLYPH: [FilterOperatorGlyph; 2] = [
    FilterOperatorGlyph::Path("M5 15a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"),
    FilterOperatorGlyph::Path("M5 9a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"),
];

/// ≉ — lucide's ≈ pair with EqualNot's slash composed in (hikari-authored).
const NOT_APPROXIMATELY_GLYPH: [FilterOperatorGlyph; 3] = [
    FilterOperatorGlyph::Path("M5 15a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"),
    FilterOperatorGlyph::Path("M5 9a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"),
    FilterOperatorGlyph::Path("m5 19 14-14"),
];

/// `<` (hikari-authored in lucide's stroke grammar).
const LESS_THAN_GLYPH: [FilterOperatorGlyph; 1] = [FilterOperatorGlyph::Path("m19 6-11 6 11 6")];

/// `≤`.
const LESS_THAN_OR_EQUAL_GLYPH: [FilterOperatorGlyph; 2] = [
    FilterOperatorGlyph::Path("m19 5-11 6 11 6"),
    FilterOperatorGlyph::Path("M8 20h11"),
];

/// `>`.
const GREATER_THAN_GLYPH: [FilterOperatorGlyph; 1] = [FilterOperatorGlyph::Path("m5 6 11 6-11 6")];

/// `≥`.
const GREATER_THAN_OR_EQUAL_GLYPH: [FilterOperatorGlyph; 2] = [
    FilterOperatorGlyph::Path("m5 5 11 6-11 6"),
    FilterOperatorGlyph::Path("M5 20h11"),
];

/// The operator's drawing primitives, in draw order.
pub fn operator_glyph(op: FilterOperator) -> &'static [FilterOperatorGlyph] {
    match op {
        FilterOperator::Eq => &EQUAL_GLYPH,
        FilterOperator::Ne => &EQUAL_NOT_GLYPH,
        FilterOperator::Approx => &EQUAL_APPROXIMATELY_GLYPH,
        FilterOperator::Napprox => &NOT_APPROXIMATELY_GLYPH,
        FilterOperator::Lt => &LESS_THAN_GLYPH,
        FilterOperator::Lte => &LESS_THAN_OR_EQUAL_GLYPH,
        FilterOperator::Gt => &GREATER_THAN_GLYPH,
        FilterOperator::Gte => &GREATER_THAN_OR_EQUAL_GLYPH,
    }
}

/// The lucide icon name for the operators lucide ships — `None` for the five
/// hikari-authored in its grammar, which (exactly like the Vue component) carry
/// no `class` attribute at all.
pub fn operator_glyph_lucide_name(op: FilterOperator) -> Option<&'static str> {
    match op {
        FilterOperator::Eq => Some("equal"),
        FilterOperator::Ne => Some("equal-not"),
        FilterOperator::Approx => Some("equal-approximately"),
        FilterOperator::Napprox
        | FilterOperator::Lt
        | FilterOperator::Lte
        | FilterOperator::Gt
        | FilterOperator::Gte => None,
    }
}

/// The complete `<svg>` markup for one operator at the given box size — the
/// verbatim counterpart of what `HkFilterOperatorIcon` renders (see the header).
pub fn operator_glyph_svg(op: FilterOperator, size: u32) -> String {
    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round""#
    );
    if let Some(name) = operator_glyph_lucide_name(op) {
        svg.push_str(&format!(r#" class="lucide lucide-{name}""#));
    }
    svg.push_str(r#" aria-hidden="true">"#);
    for glyph in operator_glyph(op) {
        match glyph {
            FilterOperatorGlyph::Path(d) => svg.push_str(&format!(r#"<path d="{d}"/>"#)),
            FilterOperatorGlyph::Line { x1, y1, x2, y2 } => svg.push_str(&format!(
                r#"<line x1="{x1}" x2="{x2}" y1="{y1}" y2="{y2}"/>"#
            )),
        }
    }
    svg.push_str("</svg>");
    svg
}

#[define_props]
pub struct FilterOperatorIconProps {
    /// The operator whose glyph renders (Vue: `op`, required).
    pub op: FilterOperator,

    /// Glyph box in px (Vue default 14).
    #[default(14)]
    pub size: u32,
}

#[component]
pub fn FilterOperatorIcon(props: FilterOperatorIconProps) -> Element {
    // Trusted static markup on its own boxless host (crate-wide SVG rule).
    rsx! {
        span {
            style: "display:contents",
            dangerous_inner_html: operator_glyph_svg(props.op, props.size),
        }
    }
}

impl StyledComponent for FilterOperatorIconComponent {
    fn styles() -> &'static str {
        // Vue ships no sheet for this component: the glyph is chrome that its
        // host (.hk-filter-panel-op) inks and boxes. Same convention as
        // basic::kbd — an empty table, not an error.
        ""
    }

    fn name() -> &'static str {
        "filter-operator-icon"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filter_operator_icon_defaults_match_the_vue_props() {
        let props = FilterOperatorIconProps::default();
        assert_eq!(props.size, 14);
        // Vue requires `op`; the Rust Default is total and lands on `Eq`.
        assert_eq!(props.op, FilterOperator::Eq);
    }

    #[test]
    fn filter_operator_icon_glyph_shapes_match_the_vue_source() {
        // Lucide's = / ≠ are LINE pairs (+ the slash), not paths.
        assert_eq!(operator_glyph(FilterOperator::Eq).len(), 2);
        assert!(
            operator_glyph(FilterOperator::Eq)
                .iter()
                .all(|glyph| matches!(glyph, FilterOperatorGlyph::Line { .. }))
        );
        assert_eq!(operator_glyph(FilterOperator::Ne).len(), 3);
        // ≈ and ≉ are the composed path pair (+ slash for ≉).
        let approx = operator_glyph(FilterOperator::Approx);
        assert_eq!(approx.len(), 2);
        assert_eq!(
            approx[0],
            FilterOperatorGlyph::Path("M5 15a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0")
        );
        let napprox = operator_glyph(FilterOperator::Napprox);
        assert_eq!(napprox.len(), 3);
        assert_eq!(napprox[2], FilterOperatorGlyph::Path("m5 19 14-14"));
        // The ordered four: 1 / 2 / 1 / 2 primitives, hikari-authored.
        assert_eq!(operator_glyph(FilterOperator::Lt).len(), 1);
        assert_eq!(operator_glyph(FilterOperator::Lte).len(), 2);
        assert_eq!(operator_glyph(FilterOperator::Gt).len(), 1);
        assert_eq!(operator_glyph(FilterOperator::Gte).len(), 2);
        assert_eq!(
            operator_glyph(FilterOperator::Lte)[1],
            FilterOperatorGlyph::Path("M8 20h11")
        );
        assert_eq!(
            operator_glyph(FilterOperator::Gte)[1],
            FilterOperatorGlyph::Path("M5 20h11")
        );
    }

    #[test]
    fn filter_operator_icon_lucide_names_cover_only_the_shipped_three() {
        assert_eq!(
            operator_glyph_lucide_name(FilterOperator::Eq),
            Some("equal")
        );
        assert_eq!(
            operator_glyph_lucide_name(FilterOperator::Ne),
            Some("equal-not")
        );
        assert_eq!(
            operator_glyph_lucide_name(FilterOperator::Approx),
            Some("equal-approximately")
        );
        // The hikari-authored five carry no class, exactly like Vue.
        for op in [
            FilterOperator::Napprox,
            FilterOperator::Lt,
            FilterOperator::Lte,
            FilterOperator::Gt,
            FilterOperator::Gte,
        ] {
            assert_eq!(operator_glyph_lucide_name(op), None, "{op:?}");
        }
    }

    #[test]
    fn filter_operator_icon_markup_matches_the_vue_svg_grammar() {
        let svg = operator_glyph_svg(FilterOperator::Eq, 14);
        for needle in [
            r#"xmlns="http://www.w3.org/2000/svg""#,
            r#"width="14""#,
            r#"height="14""#,
            r#"viewBox="0 0 24 24""#,
            r#"fill="none""#,
            r#"stroke="currentColor""#,
            r#"stroke-width="2""#,
            r#"stroke-linecap="round""#,
            r#"stroke-linejoin="round""#,
            r#"aria-hidden="true""#,
            r#"class="lucide lucide-equal""#,
        ] {
            assert!(svg.contains(needle), "missing {needle}: {svg}");
        }
        // Two rules, drawn as lucide's <line> pair.
        assert_eq!(svg.matches("<line").count(), 2, "{svg}");
        assert_eq!(
            svg.matches(r#"y1="9""#).count(),
            1,
            "the first rule sits at y=9: {svg}"
        );

        // The box size scales with the prop.
        assert!(operator_glyph_svg(FilterOperator::Gt, 20).contains(r#"width="20""#));

        // hikari-authored operators carry NO class attribute at all.
        let ordered = operator_glyph_svg(FilterOperator::Lte, 14);
        assert!(!ordered.contains("class="), "{ordered}");
        assert!(
            ordered.contains(r#"<path d="m19 5-11 6 11 6"/>"#),
            "{ordered}"
        );
        assert!(ordered.contains(r#"<path d="M8 20h11"/>"#), "{ordered}");
        // ≉ composes ≈'s pair with the slash.
        let napprox = operator_glyph_svg(FilterOperator::Napprox, 14);
        assert_eq!(napprox.matches("<path").count(), 3, "{napprox}");
        assert!(napprox.contains(r#"<path d="m5 19 14-14"/>"#), "{napprox}");
    }

    #[test]
    fn filter_operator_icon_styles_are_empty_by_design() {
        let css = FilterOperatorIconComponent::styles();
        // No sheet of its own (see the header): the glyph is styled by its host.
        assert_eq!(css, "");
        assert!(
            !css.contains("CSS generation failed"),
            "the sheet-less operator icon must not report a compile failure"
        );
    }

    #[test]
    fn filter_operator_icon_render_contract() {
        let html = FilterOperatorIcon(FilterOperatorIconProps {
            op: FilterOperator::Napprox,
            size: 14,
        })
        .render_to_html();
        // The boxless host carries the trusted svg and adds no class/box.
        assert!(html.contains(r#"style="display:contents""#), "{html}");
        assert!(html.starts_with("<span"), "{html}");
        assert!(html.contains("<svg"), "{html}");
        assert!(html.contains(r#"aria-hidden="true""#), "{html}");
        assert!(html.contains(r#"width="14""#), "{html}");
        assert!(html.ends_with("</span>"), "{html}");
        // No class of its own, and no hk-* hook the sheet could miss.
        assert!(!html.contains("class="), "{html}");
        assert!(!html.contains("hk-"), "{html}");

        // The lucide branch keeps the lucide class, no host hook.
        let lucide = FilterOperatorIcon(FilterOperatorIconProps {
            op: FilterOperator::Eq,
            size: 14,
        })
        .render_to_html();
        assert!(
            lucide.contains(r#"class="lucide lucide-equal""#),
            "{lucide}"
        );
    }
}
