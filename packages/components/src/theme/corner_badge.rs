// hi-components/src/theme/corner_badge.rs
// CornerBadge — mirror of the canonical Vue `HkCornerBadge` (the generic
// corner mark for ANY anchor: a traffic dot, a notification count with a
// "N+" cap, or a custom text pill pinned to one corner).
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkCornerBadge.scss`, vendored under
// `src/styles/vue-mirror/` and guarded by `tests/vue_mirror_drift_tests.rs`),
// compiled with `no_hash` so the `.hk-corner-badge*` class names are literal
// and identical in both forms. The sheet is shared chrome on the Rust side
// (`styled::vue_corner_badge_css` registers it for the IconButton dot), but
// the component still owns its own `styles()` so a registry-only host that
// pulls `corner-badge` gets the full dot/pill/variant table.
//
// DOM contract (mirrors the Vue render output one-to-one):
//
//   span.hk-corner-badge-anchor
//     {children}                                (the ANCHOR, never the label)
//     span.hk-corner-badge .hk-corner-badge-{variant}
//          .hk-corner-badge--dot | .hk-corner-badge--pill
//          data-corner={corner} [style=--hk-corner-badge-offset:{n}px]
//          [aria-hidden=true] | [role=img aria-label={label}]
//          {text}                                (pill only; dot renders none)
//
// Behaviour taken from the Vue component, not reinvented:
//   * the label resolution order — `count` first (0 hides unless `showZero`;
//     past `max` it renders `{max}+`; equal-to-max does NOT cap), then the
//     `text` pill (empty string hides), see [`corner_badge_text`];
//   * visibility = `dot || text !== null` ([`corner_badge_visible`]) — a dot
//     with a hidden count still shows;
//   * decorative by default: without a `label` the mark is `aria-hidden`;
//     with one it becomes `role="img"` + `aria-label` (the only place a
//     count is announced);
//   * the offset style exists ONLY for a non-zero offset (Vue `props.offset
//     ? {…} : undefined` — `0` means "sit ON the corner").
//
// The default slot is the ANCHOR, exactly like Vue — overloading it with the
// label text was the bug this component exists to retire. The mirror is
// STATELESS (nothing to store; ledger L48 never comes into play).

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct CornerBadgeComponent;

/// The color channels HkBadge standardizes (Vue: same variant names, same
/// override escape hatch; default here is `primary` — Vue's own default).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum CornerBadgeVariant {
    Default,
    #[default]
    Primary,
    Success,
    Error,
    Warning,
    Info,
    Muted,
}

impl CornerBadgeVariant {
    /// The `hk-corner-badge-{variant}` tone class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            CornerBadgeVariant::Default => "hk-corner-badge-default",
            CornerBadgeVariant::Primary => "hk-corner-badge-primary",
            CornerBadgeVariant::Success => "hk-corner-badge-success",
            CornerBadgeVariant::Error => "hk-corner-badge-error",
            CornerBadgeVariant::Warning => "hk-corner-badge-warning",
            CornerBadgeVariant::Info => "hk-corner-badge-info",
            CornerBadgeVariant::Muted => "hk-corner-badge-muted",
        }
    }
}

/// Which corner of the anchor the mark pins to (Vue default `top-right`).
#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum CornerBadgeCorner {
    #[default]
    TopRight,
    TopLeft,
    BottomRight,
    BottomLeft,
}

impl CornerBadgeCorner {
    /// The `data-corner` value the sheet's geometry rules key on.
    pub fn data_corner(self) -> &'static str {
        match self {
            CornerBadgeCorner::TopRight => "top-right",
            CornerBadgeCorner::TopLeft => "top-left",
            CornerBadgeCorner::BottomRight => "bottom-right",
            CornerBadgeCorner::BottomLeft => "bottom-left",
        }
    }
}

/// Vue's `text` computed, verbatim: the count form wins over the custom
/// label — `0` hides unless `showZero`, a count PAST `max` renders `{max}+`
/// (equal-to-max does not cap), anything else renders the count itself.
/// Without a count, a non-empty `text` shows; `None` means "hidden".
pub fn corner_badge_text(
    count: Option<i64>,
    max: Option<i64>,
    show_zero: bool,
    text: Option<&str>,
) -> Option<String> {
    match count {
        Some(count) => {
            if count == 0 && !show_zero {
                return None;
            }
            match max {
                Some(max) if count > max => Some(format!("{max}+")),
                _ => Some(count.to_string()),
            }
        }
        None => text
            .filter(|text| !text.is_empty())
            .map(|text| text.to_string()),
    }
}

/// Vue's `show` computed: `props.dot || text.value !== null` — a bare dot is
/// visible even when the count/label resolution hid the text.
pub fn corner_badge_visible(dot: bool, text: Option<&str>) -> bool {
    dot || text.is_some()
}

/// Vue's offset style guard: only a NON-ZERO offset writes the clearance
/// custom property (`0` means "sit ON the corner" and emits nothing).
pub fn corner_badge_offset_style(offset: i64) -> Option<String> {
    (offset != 0).then(|| format!("--hk-corner-badge-offset:{offset}px"))
}

#[define_props]
pub struct CornerBadgeProps {
    #[default]
    pub variant: CornerBadgeVariant,

    /// Bare dot form (the green/red/traffic light) — renders no text.
    #[default]
    pub dot: bool,

    /// Count form: the number, or `{max}+` past `max`, hidden at `0`
    /// unless `show_zero`.
    pub count: Option<i64>,

    pub max: Option<i64>,

    #[default]
    pub show_zero: bool,

    /// Custom label text (the pill form). The default slot stays the ANCHOR.
    pub text: Option<String>,

    #[default]
    pub corner: CornerBadgeCorner,

    /// Extra clearance from the corner in px (0 = sit ON the corner).
    #[default]
    pub offset: i64,

    /// Accessible name; without it the mark is decorative (`aria-hidden`).
    pub label: Option<String>,

    /// The anchored child (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn CornerBadge(props: CornerBadgeProps) -> Element {
    let text = corner_badge_text(
        props.count,
        props.max,
        props.show_zero,
        props.text.as_deref(),
    );
    let visible = corner_badge_visible(props.dot, text.as_deref());

    let mut anchor = VElement::new("span").class("hk-corner-badge-anchor");
    anchor = anchor.child(props.children);

    if visible {
        let form = if props.dot {
            "hk-corner-badge--dot"
        } else {
            "hk-corner-badge--pill"
        };
        let mut mark = VElement::new("span").class(format!(
            "hk-corner-badge {} {form}",
            props.variant.class_name()
        ));
        mark = mark.attr("data-corner", props.corner.data_corner());
        if let Some(style) = corner_badge_offset_style(props.offset) {
            mark = mark.style(style);
        }
        // Decorative by default; a `label` is the only announcement path.
        match props.label.as_deref() {
            Some(label) => {
                mark = mark.attr("role", "img").attr("aria-label", label);
            }
            None => {
                mark = mark.attr("aria-hidden", "true");
            }
        }
        if !props.dot
            && let Some(text) = text
        {
            mark = mark.child(VNode::Text(VText::new(&text)));
        }
        anchor = anchor.child(VNode::Element(Box::new(mark)));
    }

    VNode::Element(Box::new(anchor))
}

impl StyledComponent for CornerBadgeComponent {
    fn styles() -> &'static str {
        // The canonical Vue sheet, compiled verbatim (no_hash keeps the
        // `.hk-corner-badge*` names literal so this CSS matches the Vue
        // build). Also registered as shared chrome by
        // `styled::vue_corner_badge_css` (IconButton's dots).
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkCornerBadge.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "corner-badge"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn corner_badge_defaults_match_the_vue_props() {
        let props = CornerBadgeProps::default();
        assert_eq!(props.variant, CornerBadgeVariant::Primary);
        assert!(!props.dot);
        assert_eq!(props.count, None);
        assert_eq!(props.max, None);
        assert!(!props.show_zero);
        assert_eq!(props.text, None);
        assert_eq!(props.corner, CornerBadgeCorner::TopRight);
        assert_eq!(props.offset, 0);
        assert_eq!(props.label, None);
    }

    #[test]
    fn corner_badge_variant_classes_match_vue() {
        assert_eq!(
            CornerBadgeVariant::Default.class_name(),
            "hk-corner-badge-default"
        );
        assert_eq!(
            CornerBadgeVariant::Primary.class_name(),
            "hk-corner-badge-primary"
        );
        assert_eq!(
            CornerBadgeVariant::Success.class_name(),
            "hk-corner-badge-success"
        );
        assert_eq!(
            CornerBadgeVariant::Error.class_name(),
            "hk-corner-badge-error"
        );
        assert_eq!(
            CornerBadgeVariant::Muted.class_name(),
            "hk-corner-badge-muted"
        );
    }

    #[test]
    fn corner_badge_corners_feed_the_sheets_data_rules() {
        assert_eq!(CornerBadgeCorner::TopRight.data_corner(), "top-right");
        assert_eq!(CornerBadgeCorner::TopLeft.data_corner(), "top-left");
        assert_eq!(CornerBadgeCorner::BottomRight.data_corner(), "bottom-right");
        assert_eq!(CornerBadgeCorner::BottomLeft.data_corner(), "bottom-left");
    }

    #[test]
    fn corner_badge_text_follows_vues_resolution_order() {
        // Count form wins; zero hides unless showZero.
        assert_eq!(corner_badge_text(Some(0), None, false, None), None);
        assert_eq!(
            corner_badge_text(Some(0), None, true, None),
            Some("0".into())
        );
        // Past max caps at "{max}+"; AT max renders the plain count.
        assert_eq!(
            corner_badge_text(Some(99), Some(9), false, None),
            Some("9+".into())
        );
        assert_eq!(
            corner_badge_text(Some(9), Some(9), false, None),
            Some("9".into())
        );
        assert_eq!(
            corner_badge_text(Some(3), None, false, None),
            Some("3".into())
        );
        // The custom pill only applies without a count; empty text hides.
        assert_eq!(
            corner_badge_text(None, None, false, Some("beta")),
            Some("beta".into())
        );
        assert_eq!(corner_badge_text(None, None, false, Some("")), None);
        assert_eq!(corner_badge_text(None, None, false, None), None);
    }

    #[test]
    fn corner_badge_visible_is_dot_or_text() {
        assert!(corner_badge_visible(true, None), "a bare dot shows");
        assert!(corner_badge_visible(false, Some("3")));
        assert!(!corner_badge_visible(false, None));
        // A hidden count with a dot still shows (the dot is the mark).
        assert!(corner_badge_visible(true, None));
    }

    #[test]
    fn corner_badge_offset_style_only_exists_for_a_non_zero_offset() {
        assert_eq!(corner_badge_offset_style(0), None);
        assert_eq!(
            corner_badge_offset_style(5),
            Some("--hk-corner-badge-offset:5px".to_string())
        );
        assert_eq!(
            corner_badge_offset_style(-2),
            Some("--hk-corner-badge-offset:-2px".to_string())
        );
    }

    #[test]
    fn corner_badge_renders_the_vue_dom_contract() {
        // Pill form, capped count, decorative (aria-hidden), top-right.
        let html = CornerBadge(CornerBadgeProps {
            variant: CornerBadgeVariant::Error,
            count: Some(99),
            max: Some(9),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            html.contains(
                r#"<span aria-hidden="true" data-corner="top-right" class="hk-corner-badge hk-corner-badge-error hk-corner-badge--pill">9+</span>"#
            ),
            "{html}"
        );
        assert!(html.contains(r#"class="hk-corner-badge-anchor""#), "{html}");
    }

    #[test]
    fn corner_badge_renders_the_dot_and_labelled_forms() {
        // Bare dot: no text child, the --dot class, bottom-left corner and
        // a clearance offset.
        let dot = CornerBadge(CornerBadgeProps {
            dot: true,
            corner: CornerBadgeCorner::BottomLeft,
            offset: 4,
            ..Default::default()
        })
        .render_to_html();
        assert!(
            dot.contains(
                // Vue keeps aria-hidden="true" on the label-less dot (only
                // `label` swaps it for role=img + aria-label).
                r#"<span aria-hidden="true" data-corner="bottom-left" class="hk-corner-badge hk-corner-badge-primary hk-corner-badge--dot" style="--hk-corner-badge-offset:4px"></span>"#
            ),
            "{dot}"
        );

        // Labelled pill: role=img + aria-label replace aria-hidden.
        let labelled = CornerBadge(CornerBadgeProps {
            count: Some(3),
            label: Some("3 notifications".to_string()),
            ..Default::default()
        })
        .render_to_html();
        assert!(
            labelled.contains(
                r#"<span aria-label="3 notifications" data-corner="top-right" role="img" class="hk-corner-badge hk-corner-badge-primary hk-corner-badge--pill">3</span>"#
            ),
            "{labelled}"
        );
        assert!(!labelled.contains("aria-hidden"), "{labelled}");
    }

    #[test]
    fn corner_badge_hides_entirely_without_a_mark() {
        let html = CornerBadge(CornerBadgeProps::default()).render_to_html();
        assert!(html.contains(r#"class="hk-corner-badge-anchor""#), "{html}");
        assert!(!html.contains("hk-corner-badge--"), "{html}");
    }

    #[test]
    fn corner_badge_styles_come_from_the_canonical_vue_sheet() {
        let css = CornerBadgeComponent::styles();
        for class_name in [
            ".hk-corner-badge-anchor",
            ".hk-corner-badge--dot",
            ".hk-corner-badge--pill",
            ".hk-corner-badge-primary",
            ".hk-corner-badge-muted",
            // grass unquotes the value — the same canonical form the Vue
            // build's own styles test asserts.
            "[data-corner=bottom-left]",
        ] {
            assert!(
                css.contains(class_name),
                "corner badge css must come from the vue-mirror sheet (missing {class_name})"
            );
        }
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored corner-badge sheet"
        );
    }
}
