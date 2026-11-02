// hi-components/src/basic/badge.rs
// Badge — mirror of the canonical Vue `HkBadge`.
//
// The stylesheet is the SAME sheet the Vue library ships
// (`packages/vue/src/components/HkBadge.scss`, vendored under
// `src/styles/vue-mirror/`), compiled with `no_hash` so the `.hk-badge*`
// class names are literal and identical in both forms. DOM contract:
//
//   span.hk-badge.hk-badge-{variant}
//        data-size={size} [data-pill=false] [data-mono] [data-uppercase]
//        [data-dot-only]                 (style: --hk-badge-{text,bg,border})
//     span[data-el="dot"]?                (the dot marker)
//     {children}                          (the default slot)
//
// The boolean markers are PRESENCE attributes in Vue (`data-mono={true}` emits
// an empty attribute, `undefined` omits it) — the mirror builds the element
// through `VElement` so a false flag is genuinely absent instead of an empty
// attribute a `[data-mono]` selector would still match.
//
// Delta vs Vue (documented): the legacy Rust badge carried numeric
// `count`/`max`/`show_zero` semantics; the canonical Vue badge is a text/dot
// shell, so those props are retired with the migration.

use crate::prelude::*;
use crate::styled::StyledComponent;

pub struct BadgeComponent;

/// The seven toned variants (Vue default `default`).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum BadgeVariant {
    #[default]
    Default,
    Primary,
    Success,
    Error,
    Warning,
    Info,
    Muted,
}

impl BadgeVariant {
    /// The `hk-badge-{variant}` modifier class exactly as Vue emits it.
    pub fn class_name(self) -> &'static str {
        match self {
            BadgeVariant::Default => "hk-badge-default",
            BadgeVariant::Primary => "hk-badge-primary",
            BadgeVariant::Success => "hk-badge-success",
            BadgeVariant::Error => "hk-badge-error",
            BadgeVariant::Warning => "hk-badge-warning",
            BadgeVariant::Info => "hk-badge-info",
            BadgeVariant::Muted => "hk-badge-muted",
        }
    }
}

/// The two size steps (Vue: `data-size`, default md).
#[derive(Clone, Copy, PartialEq, Debug, Default)]
pub enum BadgeSize {
    Sm,
    #[default]
    Md,
}

impl BadgeSize {
    pub fn data_size(self) -> &'static str {
        match self {
            BadgeSize::Sm => "sm",
            BadgeSize::Md => "md",
        }
    }
}

#[define_props]
pub struct BadgeProps {
    #[default]
    pub variant: BadgeVariant,

    /// Render the leading dot marker.
    #[default]
    pub dot: bool,

    #[default]
    pub size: BadgeSize,

    /// Monospace ink (`data-mono`).
    #[default]
    pub mono: bool,

    /// Uppercase ink (`data-uppercase`).
    #[default]
    pub uppercase: bool,

    /// Pill radius (Vue default true; `false` emits `data-pill="false"`).
    #[default(true)]
    pub pill: bool,

    /// `--hk-badge-text` override.
    pub color: Option<String>,

    /// `--hk-badge-bg` override.
    pub bg_color: Option<String>,

    /// `--hk-badge-border` override.
    pub border_color: Option<String>,

    /// The badge content (Vue: the default slot).
    pub children: Element,
}

#[component]
pub fn Badge(props: BadgeProps) -> Element {
    let has_content = !matches!(props.children, VNode::Fragment(ref nodes) if nodes.is_empty());
    let dot_only = props.dot && !has_content;

    let mut style = String::new();
    if let Some(color) = &props.color {
        style.push_str(&format!("--hk-badge-text:{color};"));
    }
    if let Some(bg) = &props.bg_color {
        style.push_str(&format!("--hk-badge-bg:{bg};"));
    }
    if let Some(border) = &props.border_color {
        style.push_str(&format!("--hk-badge-border:{border};"));
    }

    let mut el = VElement::new("span")
        .class(format!("hk-badge {}", props.variant.class_name()))
        .attr("data-size", props.size.data_size());
    if !props.pill {
        el = el.attr("data-pill", "false");
    }
    if props.mono {
        el = el.attr("data-mono", "");
    }
    if props.uppercase {
        el = el.attr("data-uppercase", "");
    }
    if dot_only {
        el = el.attr("data-dot-only", "");
    }
    if !style.is_empty() {
        el = el.style(style);
    }
    if props.dot {
        el = el.child(rsx! {
            span { "data-el": "dot" }
        });
    }

    let children = rsx! {
        {props.children.clone()}
    };
    VNode::Element(Box::new(el.child(children)))
}

impl StyledComponent for BadgeComponent {
    fn styles() -> &'static str {
        tairitsu_macros::scss! { file: "src/styles/vue-mirror/components/HkBadge.scss", no_hash }.0
    }

    fn name() -> &'static str {
        "badge"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn badge_variant_classes_match_vue() {
        assert_eq!(BadgeVariant::Default.class_name(), "hk-badge-default");
        assert_eq!(BadgeVariant::Primary.class_name(), "hk-badge-primary");
        assert_eq!(BadgeVariant::Error.class_name(), "hk-badge-error");
        assert_eq!(BadgeVariant::Muted.class_name(), "hk-badge-muted");
    }

    #[test]
    fn badge_defaults_match_the_vue_props() {
        let props = BadgeProps::default();
        assert_eq!(props.variant, BadgeVariant::Default);
        assert_eq!(props.size, BadgeSize::Md);
        assert!(!props.dot);
        assert!(!props.mono);
        assert!(!props.uppercase);
        assert!(props.pill);
        assert!(props.color.is_none());
        assert!(props.bg_color.is_none());
        assert!(props.border_color.is_none());
    }

    #[test]
    fn badge_styles_come_from_the_canonical_vue_sheet() {
        let css = BadgeComponent::styles();
        assert!(
            css.contains(".hk-badge"),
            "badge css must carry the vue classes"
        );
        assert!(
            !css.contains("CSS generation failed"),
            "scss compilation failed for the mirrored badge sheet"
        );
    }
}
