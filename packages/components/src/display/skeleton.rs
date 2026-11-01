// hi-components/src/display/skeleton.rs
// Skeleton — mirror of the canonical Vue `HkSkeleton`: the single loading
// placeholder atom (shimmer block) plus the rows convenience that fills the
// sheet's orphaned `.hk-skeleton-list` container.
//
// Sources mirrored: `packages/vue/src/components/HkSkeleton.tsx` and its
// sheet. The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkSkeleton.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-skeleton*`
// class names are literal and identical in both forms. DOM contract (single
// atom, mirrors Vue one-to-one):
//
//   div.hk-skeleton data-tone={tone} [data-animated="true"]
//       style: width / height / border-radius
//       aria-hidden="true"
//
// Rows form (see the delta below):
//
//   div.hk-skeleton-list
//     div.hk-skeleton data-tone={tone} [data-animated="true"]  (one per row)
//         style: width={row width} / height / border-radius
//         aria-hidden="true"
//
// Delta vs Vue (documented, mirror-only): Vue's `HkSkeleton` is a single
// atom — it has no row list — yet HkSkeleton.scss ships an unused
// `.hk-skeleton-list` (flex column) class. The mirror keeps the retired Rust
// `rows` convenience (the one behaviour worth preserving from the legacy
// `Skeleton`: N stacked lines with the last one short) but expresses it with
// the Vue sheet's own container class, and derives the geometry through the
// pure [`skeleton_row_count`] / [`skeleton_row_widths`] instead of hardcoding
// it in the renderer. `rows: None` is the Vue atom, byte-for-byte.
//
// Retired legacy surfaces (reported with the wave, not mirrored): `SkeletonCard`
// / `SkeletonTable` and their `hk-skeleton-card*` / `hk-skeleton-table*`
// classes have no Vue counterpart and no sheet in the mirror.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct SkeletonComponent;

/// Vue's `SkeletonTone` (`"primary" | "muted"`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum SkeletonTone {
    #[default]
    Primary,
    Muted,
}

impl SkeletonTone {
    /// The `data-tone` value exactly as Vue emits it.
    pub fn name(self) -> &'static str {
        match self {
            SkeletonTone::Primary => "primary",
            SkeletonTone::Muted => "muted",
        }
    }
}

/// The width of the last row in the rows form, as Vue's legacy Rust
/// counterpart emitted it (a ragged last line reads as text, not a bar).
pub const SKELETON_LAST_ROW_WIDTH: &str = "60%";

/// The number of `.hk-skeleton` rows a `rows` request renders: `None` (and any
/// request of 0 or 1) is the single Vue atom.
pub fn skeleton_row_count(rows: Option<u32>) -> u32 {
    match rows {
        Some(rows) if rows > 1 => rows,
        _ => 1,
    }
}

/// The per-row widths for [`skeleton_row_count`] rows: every row is full width
/// but the last, which takes [`SKELETON_LAST_ROW_WIDTH`].
pub fn skeleton_row_widths(row_count: u32) -> Vec<String> {
    let row_count = row_count.max(1);
    (0..row_count)
        .map(|index| {
            if index + 1 == row_count {
                SKELETON_LAST_ROW_WIDTH.to_string()
            } else {
                "100%".to_string()
            }
        })
        .collect()
}

/// One placeholder atom's inline geometry (Vue's `style` object).
pub fn skeleton_style(width: &str, height: &str, radius: &str) -> String {
    format!("width:{width};height:{height};border-radius:{radius}")
}

#[define_props]
pub struct SkeletonProps {
    /// Vue default `"100%"`.
    #[default("100%".to_string())]
    pub width: String,

    /// Vue default `"16px"`.
    #[default("16px".to_string())]
    pub height: String,

    /// Vue default `"var(--hk-radius-sm, 4px)"`.
    #[default("var(--hk-radius-sm, 4px)".to_string())]
    pub radius: String,

    /// Shimmer sweep (`data-animated`; Vue default true, `false` omits the
    /// attribute entirely).
    #[default(true)]
    pub animated: bool,

    /// Vue default `"primary"`.
    #[default]
    pub tone: SkeletonTone,

    /// Mirror-only rows convenience — `None` is the Vue atom (see the header
    /// delta).
    pub rows: Option<u32>,
}

/// Build one `.hk-skeleton` atom for the given width.
fn skeleton_atom(props: &SkeletonProps, width: &str) -> VNode {
    let mut atom = VElement::new("div")
        .class("hk-skeleton")
        .attr("data-tone", props.tone.name())
        .attr("style", skeleton_style(width, &props.height, &props.radius))
        .attr("aria-hidden", "true");
    if props.animated {
        atom = atom.attr("data-animated", "true");
    }
    VNode::Element(Box::new(atom))
}

#[component]
pub fn Skeleton(props: SkeletonProps) -> Element {
    let row_count = skeleton_row_count(props.rows);
    if row_count == 1 {
        return skeleton_atom(&props, &props.width);
    }

    let mut list = VElement::new("div").class("hk-skeleton-list");
    for width in skeleton_row_widths(row_count) {
        list = list.child(skeleton_atom(&props, &width));
    }
    VNode::Element(Box::new(list))
}

impl StyledComponent for SkeletonComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkSkeleton.scss", no_hash }
            .0
    }

    fn name() -> &'static str {
        "skeleton"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skeleton_tone_names_match_vue() {
        assert_eq!(SkeletonTone::Primary.name(), "primary");
        assert_eq!(SkeletonTone::Muted.name(), "muted");
    }

    #[test]
    fn skeleton_defaults_match_the_vue_props() {
        let props = SkeletonProps::default();
        assert_eq!(props.width, "100%");
        assert_eq!(props.height, "16px");
        assert_eq!(props.radius, "var(--hk-radius-sm, 4px)");
        assert!(props.animated);
        assert_eq!(props.tone, SkeletonTone::Primary);
        assert_eq!(props.rows, None);
    }

    #[test]
    fn skeleton_row_count_collapses_to_the_vue_atom() {
        assert_eq!(skeleton_row_count(None), 1);
        assert_eq!(skeleton_row_count(Some(0)), 1);
        assert_eq!(skeleton_row_count(Some(1)), 1);
        assert_eq!(skeleton_row_count(Some(3)), 3);
    }

    #[test]
    fn skeleton_row_widths_shorten_only_the_last_row() {
        assert_eq!(skeleton_row_widths(1), vec!["60%".to_string()]);
        assert_eq!(
            skeleton_row_widths(3),
            vec!["100%".to_string(), "100%".to_string(), "60%".to_string()]
        );
        // A zero row count still yields one drawable atom.
        assert_eq!(skeleton_row_widths(0), vec!["60%".to_string()]);
    }

    #[test]
    fn skeleton_style_serializes_the_vue_geometry() {
        assert_eq!(
            skeleton_style("100%", "16px", "var(--hk-radius-sm, 4px)"),
            "width:100%;height:16px;border-radius:var(--hk-radius-sm, 4px)"
        );
    }

    #[test]
    fn skeleton_renders_the_vue_atom() {
        let html = Skeleton(SkeletonProps::default()).render_to_html();
        for needle in [
            "hk-skeleton",
            "data-tone=\"primary\"",
            "data-animated=\"true\"",
            "aria-hidden=\"true\"",
            "width:100%;height:16px;border-radius:var(--hk-radius-sm, 4px)",
        ] {
            assert!(html.contains(needle), "missing {needle}: {html}");
        }
        assert!(!html.contains("hk-skeleton-list"), "{html}");
    }

    #[test]
    fn skeleton_without_animation_omits_the_marker() {
        let html = Skeleton(SkeletonProps {
            animated: false,
            tone: SkeletonTone::Muted,
            ..Default::default()
        })
        .render_to_html();
        assert!(!html.contains("data-animated"), "{html}");
        assert!(html.contains("data-tone=\"muted\""), "{html}");
    }

    #[test]
    fn skeleton_rows_render_the_list_container() {
        let html = Skeleton(SkeletonProps {
            rows: Some(3),
            ..Default::default()
        })
        .render_to_html();
        assert!(html.contains("hk-skeleton-list"), "{html}");
        assert_eq!(html.matches("class=\"hk-skeleton\"").count(), 3, "{html}");
        assert!(html.contains("width:60%"), "{html}");
    }

    #[test]
    fn skeleton_styles_come_from_the_canonical_vue_sheet() {
        let css = SkeletonComponent::styles();
        for needle in [".hk-skeleton", ".hk-skeleton-list", "hk-skeleton-shimmer"] {
            assert!(
                css.contains(needle),
                "skeleton css must carry {needle}: {css}"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored skeleton sheet"
        );
    }
}
